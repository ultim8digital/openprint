#!/usr/bin/env python3
"""Translate PUBLIC OpenPrint copy with an explicitly configured TranslateGemma server.

No dependencies, application credentials, shared coordinator or model startup. The default
is a dry run. --run additionally requires a finite --max-calls budget. Failed strings
remain in the private cache/report; a locale is published only when every string passes
structural validation. This is machine translation, not a semantic or legal review.

Example (configuration file is local and never committed):
  python3 scripts/translate-locales.py --config /private/provider.env --probe
  python3 scripts/translate-locales.py --source src/locales/source.json --locales pl,ja,ta-IN \
    --limit 8 --output-dir .local/i18n/pilot --config /private/provider.env --run --max-calls 72
  python3 scripts/translate-locales.py --self-test

Configuration: MT_SERVER_27B (full /v1/completions URL), MT_SERVER_MODEL,
MT_SERVER_KEY_FILE or MT_SERVER_KEY. --config parses only these literal assignments;
it never executes a shell. Environment values override the file. HTTPS is required
except for an explicitly configured loopback server. HTTP redirects are rejected.
"""
from __future__ import annotations

import argparse
from collections import Counter
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import shlex
import sys
import tempfile
import threading
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request

VERSION = "openprint-translategemma-v2"
ROOT = Path(__file__).resolve().parent.parent
# These are the app50 locale identifiers, with the historic OpenPrint en-US alias en.
LANGUAGES = {
    "en": ("English (United States)", "en", "LATIN"),
    "es-ES": ("Spanish (Spain)", "es", "LATIN"),
    "ar-SA": ("Arabic", "ar", "ARABIC"),
    "fr-FR": ("French (France)", "fr", "LATIN"),
    "hi": ("Hindi", "hi", "DEVANAGARI"), "th": ("Thai", "th", "THAI"),
    "ru": ("Russian", "ru", "CYRILLIC"), "de-DE": ("German", "de", "LATIN"),
    "it": ("Italian", "it", "LATIN"), "pt-BR": ("Portuguese (Brazil)", "pt-BR", "LATIN"),
    "nl-NL": ("Dutch", "nl", "LATIN"), "sv": ("Swedish", "sv", "LATIN"),
    "da": ("Danish", "da", "LATIN"), "no": ("Norwegian Bokmål", "nb", "LATIN"),
    "tr": ("Turkish", "tr", "LATIN"), "vi": ("Vietnamese", "vi", "LATIN"),
    "ja": ("Japanese", "ja", "CJK"), "ko": ("Korean", "ko", "HANGUL"),
    "zh-Hans": ("Chinese (Simplified)", "zh-Hans", "CJK"),
    "zh-Hant": ("Chinese (Traditional)", "zh-Hant", "CJK"),
    "en-GB": ("English (United Kingdom)", "en-GB", "LATIN"),
    "en-AU": ("English (Australia)", "en-AU", "LATIN"),
    "en-CA": ("English (Canada)", "en-CA", "LATIN"),
    "es-MX": ("Spanish (Mexico)", "es-419", "LATIN"),
    "fr-CA": ("French (Canada)", "fr-CA", "LATIN"),
    "pt-PT": ("Portuguese (Portugal)", "pt-PT", "LATIN"),
    "pl": ("Polish", "pl", "LATIN"), "uk": ("Ukrainian", "uk", "CYRILLIC"),
    "id": ("Indonesian", "id", "LATIN"), "cs": ("Czech", "cs", "LATIN"),
    "sk": ("Slovak", "sk", "LATIN"), "hu": ("Hungarian", "hu", "LATIN"),
    "ro": ("Romanian", "ro", "LATIN"), "hr": ("Croatian", "hr", "LATIN"),
    "el": ("Greek", "el", "GREEK"), "fi": ("Finnish", "fi", "LATIN"),
    "sl-SI": ("Slovenian", "sl", "LATIN"), "ca": ("Catalan", "ca", "LATIN"),
    "he": ("Hebrew", "he", "HEBREW"), "ms": ("Malay", "ms", "LATIN"),
    "bn-BD": ("Bengali", "bn", "BENGALI"), "gu-IN": ("Gujarati", "gu", "GUJARATI"),
    "kn-IN": ("Kannada", "kn", "KANNADA"), "ml-IN": ("Malayalam", "ml", "MALAYALAM"),
    "mr-IN": ("Marathi", "mr", "DEVANAGARI"), "or-IN": ("Odia", "or", "ORIYA"),
    "pa-IN": ("Punjabi", "pa", "GURMUKHI"), "ta-IN": ("Tamil", "ta", "TAMIL"),
    "te-IN": ("Telugu", "te", "TELUGU"), "ur-PK": ("Urdu", "ur", "ARABIC"),
}
PLACEHOLDER = re.compile(r"\{[A-Za-z_][A-Za-z0-9_]*\}")
# Protect syntax and names that are identifiers, rather than words to translate.
PROTECTED = re.compile(
    r"\{[A-Za-z_][A-Za-z0-9_]*\}|`[^`\n]+`|https?://[^\s<>]*[A-Za-z0-9/#?=&_%~-]|https?://"
    r"|(?<![A-Za-z0-9_])(?:OpenPrint|Neofab|CadQuery|OpenCascade|OpenAI|GitHub|Docker|SQLite|"
    r"PostgreSQL|Supabase|Vercel|React|TypeScript|JavaScript|Python|Node\.js|Three\.js|"
    r"OpenStreetMap|MapLibre|Leaflet|WebGL|Google|Modal|vLLM|TranslateGemma|"
    r"CAD|CAM|CNC|FDM|FFF|SLA|SLS|MJF|DLP|STL|STEP|STP|OBJ|3MF|DXF|SVG|"
    r"JSON|CSV|ZIP|PDF|API|HTTP|HTTPS|URL|HTML|CSS|UTF-8|ASCII|UUID|SHA-256|"
    r"GPL|AGPL|MIT|CC0|CC-BY|BY-NC|BY-SA|CC|OSM|ISO|NFC|2D|3D)(?![A-Za-z0-9_])"
    r"|(?<![A-Za-z0-9_])[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+(?![A-Za-z0-9_])"
    r"|(?<![A-Za-z0-9_])(?:[A-Za-z0-9_][A-Za-z0-9_-]*/)+[A-Za-z0-9_./-]+"
    r"|(?<![A-Za-z0-9_])[A-Za-z0-9_.-]+\.(?:json|step|stl|zip|md|py|ts|tsx|mjs|yaml|yml|csv)(?![A-Za-z0-9_])"
)
TECHNICAL_LITERALS = frozenset({
    "CAD", "CAM", "CNC", "STL", "STEP", "FDM", "FFF", "SLA", "SLS", "MJF", "DLP",
    "JSON", "CSV", "ZIP", "PDF", "API", "HTTP", "HTTPS", "URL", "3D", "2D", "CC0",
    "MIT", "GPL", "AGPL", "OpenPrint", "Neofab", "Neofab Studio", "OpenAI", "WebGL",
    "UUID", "SHA-256", "PLA", "ABS", "PETG", "TPU", "PA", "PA-CF", "PC", "PEEK", "ASA",
    "{size} mm", "{size} KB",
})
SENTINEL = re.compile(r"⟦\d+⟧")
CONFIG_KEYS = {"MT_SERVER_27B", "MT_SERVER_MODEL", "MT_SERVER_KEY_FILE", "MT_SERVER_KEY"}
NUMBER_WORDS = {word: str(index) for index, word in enumerate(
    "zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty".split())}
# Japanese and Korean commonly write hexadecimal as 16 + their word for radix.
# This names the base; it does not change the required number of key characters.
NUMBER_WORDS["hexadecimal"] = "16"
SCRIPT_PREFIXES = {
    "LATIN", "CYRILLIC", "GREEK", "HEBREW", "ARABIC", "BENGALI", "GUJARATI",
    "KANNADA", "MALAYALAM", "DEVANAGARI", "ORIYA", "GURMUKHI", "TAMIL", "TELUGU",
    "THAI", "HANGUL", "CJK", "HIRAGANA", "KATAKANA", "IDEOGRAPHIC",
}


def digest(value):
    return hashlib.sha256(json.dumps(value, ensure_ascii=False, sort_keys=True,
                                    separators=(",", ":")).encode()).hexdigest()


def atomic_json(path, value, private=False):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary = tempfile.mkstemp(prefix="." + path.name + ".", dir=path.parent)
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8") as handle:
            json.dump(value, handle, ensure_ascii=False, indent=2, sort_keys=True)
            handle.write("\n")
            handle.flush()
            os.fsync(handle.fileno())
        os.chmod(temporary, 0o600 if private else 0o644)
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def normalize_digits(text):
    return "".join(str(unicodedata.decimal(char)) if char.isdecimal() else char for char in text)


def protect(text):
    if "⟦" in text or "⟧" in text:
        raise ValueError("source contains reserved translation sentinel")
    values = []

    def replace(match):
        values.append(match.group())
        return f"⟦{len(values)}⟧"

    return PROTECTED.sub(replace, text), values


def restore(text, values, source=""):
    text = normalize_digits(text)
    expected = Counter(f"⟦{index + 1}⟧" for index in range(len(values)))
    # A model can mistakenly wrap a literal number in token brackets. Repair only
    # out-of-range token IDs which are exact, unprotected numbers in the source.
    # In-range IDs are ambiguous and must fail instead of changing a placeholder.
    source_numbers = Counter(re.findall(r"(?<![\w.])\d+(?![\w.])", PROTECTED.sub("", normalize_digits(source))))
    source_numbers.update(NUMBER_WORDS[word] for word in re.findall(r"\b[a-z]+\b", source.lower()) if word in NUMBER_WORDS)
    def repair_number(match):
        number = match.group()[1:-1]
        if match.group() not in expected and source_numbers[number] > 0:
            source_numbers[number] -= 1
            return number
        return match.group()
    text = SENTINEL.sub(repair_number, text)
    # A model may copy an immutable placeholder from the Russian reference
    # instead of its masked English token. Accept only that exact placeholder,
    # with precisely the missing multiplicity; never infer a missing link/name.
    present = Counter(SENTINEL.findall(text))
    placeholder_indices = {}
    for index, value in enumerate(values, start=1):
        if PLACEHOLDER.fullmatch(value) and not present[f"⟦{index}⟧"]:
            placeholder_indices.setdefault(value, []).append(index)
    for value, indices in placeholder_indices.items():
        if text.count(value) == len(indices):
            for index in indices:
                text = text.replace(value, f"⟦{index}⟧", 1)
    if Counter(SENTINEL.findall(text)) != expected:
        raise ValueError("protected token mismatch")
    text = SENTINEL.sub(lambda match: values[int(match.group()[1:-1]) - 1], text)
    if "⟦" in text or "⟧" in text:
        raise ValueError("invalid protected token")
    return text


def number_values(text):
    text = normalize_digits(PROTECTED.sub("", text)).replace("٫", ".").replace("٬", ",")
    numbers = re.findall(r"\d+(?:(?:[.,']|[ \u00a0\u202f](?=\d{3}(?!\d)))\d+)*", text)
    canonical = []
    for number in numbers:
        groups = re.split(r"[.,' \u00a0\u202f]", number)
        # Permit locale decimal/group separators without changing numeric values.
        canonical.append("".join(groups[:-1]) + "." + groups[-1]
                         if len(groups) > 1 and len(groups[-1]) != 3 else "".join(groups))
    return Counter(canonical)


def structural_issues(source, text, locale):
    issues = []
    if not isinstance(text, str) or not text.strip() or len(text) > 12000:
        return ["empty or oversized translation"]
    if Counter(PLACEHOLDER.findall(source)) != Counter(PLACEHOLDER.findall(text)):
        issues.append("placeholder mismatch")
    # Protect exact source terms while allowing native suffixes (CADを) and
    # source plurals becoming invariant acronyms (English APIs -> Spanish API).
    source_terms = Counter(PROTECTED.findall(source))
    target_terms = Counter(PROTECTED.findall(text))
    if any((text.count(term) != source.count(term) if term in {"http://", "https://"}
            else target_terms[term] != count) for term, count in source_terms.items()):
        issues.append("protected term mismatch")
    source_numbers, target_numbers = number_values(source), number_values(text)
    spelled_numbers = Counter(NUMBER_WORDS[word] for word in re.findall(r"\b[a-z]+\b", source.lower()) if word in NUMBER_WORDS)
    # A written English quantity can naturally become a digit in the translation.
    # Existing source digits must still be present, and invented quantities fail.
    if source_numbers - target_numbers or (target_numbers - source_numbers) - spelled_numbers:
        issues.append("number mismatch")
    if source.count("\n") != text.count("\n"):
        issues.append("line break mismatch")
    if source.count("**") != text.count("**"):
        issues.append("Markdown emphasis mismatch")
    markdown_links = re.compile(r"(?<!\\)\[[^\]\n]*\]\((\{[A-Za-z_][A-Za-z0-9_]*\})\)")
    if Counter(markdown_links.findall(source)) != Counter(markdown_links.findall(text)):
        issues.append("Markdown link mismatch")
    plain_source = PROTECTED.sub("", source)
    plain_text = PROTECTED.sub("", text)
    if re.search(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f\u202a-\u202e\u2066-\u2069\ufffd]|⟦|⟧|<start_of_turn>|<end_of_turn>", text):
        issues.append("unexpected control or model token")
    if re.search(r"(?i)^(?:here is|translation\s*:|sure[,!])|\bas an ai\b|please provide (?:the|a) text", text):
        issues.append("model commentary")
    if re.search(r"(.{2,40})\1{8,}", text):
        issues.append("repetition")
    if len(plain_text) > max(90, len(plain_source) * 5):
        issues.append("excessive expansion")
    target_script = LANGUAGES[locale][2]
    seen = set()
    for char in plain_text:
        if char.isalpha() or unicodedata.category(char) in {"Mn", "Mc"}:
            prefix = unicodedata.name(char, "").split(" ")[0]
            if prefix in SCRIPT_PREFIXES:
                seen.add(prefix)
    allowed = {target_script, "LATIN"}
    if target_script == "CJK":
        allowed |= {"HIRAGANA", "KATAKANA", "IDEOGRAPHIC"}
    if target_script == "HANGUL":
        allowed |= {"CJK", "IDEOGRAPHIC"}
    if seen - allowed:
        issues.append("unexpected script")
    translatable_words = re.findall(r"[A-Za-z]{2,}", plain_source)
    if locale not in {"en", "en-GB", "en-AU", "en-CA"} and len(translatable_words) >= 4 and plain_text.casefold() == plain_source.casefold():
        issues.append("unchanged English sentence")
    if target_script != "LATIN" and translatable_words and not (seen - {"LATIN"}):
        issues.append("target script missing")
    return issues


def authored_english(text, locale):
    if locale == "en":
        return text
    masked, tokens = protect(text)
    # Bounded spelling variants, never rewrite protected commands, codes or URLs.
    replacements = {"color": "colour", "colors": "colours", "colored": "coloured",
                    "center": "centre", "centers": "centres", "fiber": "fibre",
                    "fibers": "fibres", "canceled": "cancelled", "canceling": "cancelling"}
    if locale != "en-CA":
        replacements |= {"analyze": "analyse", "analyzing": "analysing", "organization": "organisation",
                         "organizations": "organisations", "customize": "customise", "customized": "customised",
                         "customization": "customisation", "millimeter": "millimetre", "millimeters": "millimetres",
                         "anonymize": "anonymise", "anonymized": "anonymised", "authorize": "authorise",
                         "authorized": "authorised", "unauthorized": "unauthorised"}

    def replacement(match):
        original = match.group()
        result = replacements[original.lower()]
        return result.upper() if original.isupper() else result.capitalize() if original.istitle() else result

    masked = re.sub(r"\b(?:" + "|".join(replacements) + r")\b", replacement, masked, flags=re.I)
    return restore(masked, tokens)


def load_source(path):
    raw = Path(path).read_bytes()
    if len(raw) > 4 * 1024 * 1024:
        raise ValueError("source exceeds 4 MiB")
    data = json.loads(raw)
    if data.get("version") != 1:
        raise ValueError("unsupported source version")
    rows = data.get("messages", data.get("blocks"))
    if not isinstance(rows, list) or not 1 <= len(rows) <= 5000:
        raise ValueError("source must contain 1..5000 messages or blocks")
    selected, identifiers = [], set()
    for row in rows:
        if "kind" in row and row["kind"] in {"code", "navigation"}:
            continue
        if not isinstance(row.get("id"), str) or not re.fullmatch(r"[A-Za-z][A-Za-z0-9_-]{0,79}", row["id"]) or row["id"] in identifiers:
            raise ValueError("invalid or duplicate source ID")
        if not isinstance(row.get("en"), str) or not row["en"].strip() or len(row["en"]) > 3000:
            raise ValueError("source text must contain 1..3000 characters")
        if not isinstance(row.get("ru", ""), str):
            raise ValueError("Russian reference must be text")
        protect(row["en"])
        identifiers.add(row["id"])
        selected.append({"id": row["id"], "en": row["en"], "ru": row.get("ru", "")})
    return selected


def provider_config(path):
    values = {}
    if path:
        for line in Path(path).expanduser().read_text().splitlines():
            line = line.strip()
            if line.startswith("export "):
                line = line[7:]
            name, equal, value = line.partition("=")
            if equal and name in CONFIG_KEYS:
                parsed = shlex.split(value, comments=True)
                if len(parsed) != 1:
                    raise ValueError("provider config must contain literal assignments")
                values[name] = parsed[0]
    values.update({name: os.environ[name] for name in CONFIG_KEYS if os.environ.get(name)})
    endpoint = values.get("MT_SERVER_27B", "")
    parsed = urllib.parse.urlsplit(endpoint)
    if (not parsed.hostname or parsed.username or parsed.password or parsed.query or parsed.fragment
            or (parsed.scheme != "https" and not (parsed.scheme == "http" and parsed.hostname in {"127.0.0.1", "localhost", "::1"}))
            or not parsed.path.endswith("/v1/completions")):
        raise ValueError("explicit HTTPS or loopback /v1/completions endpoint required")
    key = values.get("MT_SERVER_KEY", "")
    if not key and values.get("MT_SERVER_KEY_FILE"):
        key = Path(values["MT_SERVER_KEY_FILE"]).expanduser().read_text().strip()
    model = values.get("MT_SERVER_MODEL", "")
    if not model or len(model) > 200 or len(key) > 8192:
        raise ValueError("valid MT_SERVER_MODEL required")
    return endpoint, model, key


def load_reviewed(path, rows):
    if not path or not Path(path).exists():
        return {}
    raw = Path(path).read_bytes()
    if len(raw) > 4 * 1024 * 1024:
        raise ValueError("reviewed translations exceed 4 MiB")
    data = json.loads(raw)
    if data.get("version") != 1 or not isinstance(data.get("entries"), list):
        raise ValueError("invalid reviewed translation registry")
    sources = {row["id"]: row for row in rows}
    results = {}
    for entry in data["entries"]:
        locale, identifier = entry.get("locale"), entry.get("id")
        source = sources.get(identifier)
        if locale not in LANGUAGES or locale in {"en", "ru"} or not source:
            raise ValueError("unknown reviewed locale or source ID")
        if entry.get("en") != source["en"] or entry.get("ru") != source["ru"]:
            raise ValueError("reviewed translation source changed")
        value = entry.get("text")
        if structural_issues(source["en"], value, locale):
            raise ValueError("reviewed translation failed structural validation")
        key = (locale, identifier)
        if key in results:
            raise ValueError("duplicate reviewed translation")
        results[key] = normalize_digits(value)
    return results


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def request_json(url, key, timeout, payload=None):
    headers = {"Accept": "application/json"}
    if key:
        headers["Authorization"] = "Bearer " + key
    if payload is not None:
        headers["Content-Type"] = "application/json"
    request = urllib.request.Request(url, headers=headers, data=None if payload is None else json.dumps(payload).encode())
    # Do not forward provider credentials through redirects or environment-configured proxies.
    opener = urllib.request.build_opener(NoRedirect(), urllib.request.ProxyHandler({}))
    with opener.open(request, timeout=timeout) as response:
        raw = response.read(256 * 1024 + 1)
        if len(raw) > 256 * 1024:
            raise ValueError("provider response too large")
        return json.loads(raw) if raw else {}


def probe(config, timeout):
    endpoint, _model, key = config
    base = endpoint[:-len("/v1/completions")]

    def one(path):
        started = time.monotonic()
        try:
            result = request_json(base + path, key, timeout)
            output = {"path": path, "ok": True, "seconds": round(time.monotonic() - started, 2)}
            if path.endswith("models"):
                output["models"] = [str(item.get("id", ""))[:100] for item in result.get("data", [])[:10]]
            return output
        except Exception as error:
            return {"path": path, "ok": False, "error": type(error).__name__,
                    "http_status": getattr(error, "code", None), "seconds": round(time.monotonic() - started, 2)}

    with ThreadPoolExecutor(max_workers=2) as executor:
        results = list(executor.map(one, ("/health", "/v1/models")))
    print(json.dumps(results, ensure_ascii=False), flush=True)
    return 0 if all(row["ok"] for row in results) else 2


def make_prompt(row, locale, attempt):
    name, code, _script = LANGUAGES[locale]
    masked, tokens = protect(row["en"])
    reference = ""
    if attempt and row.get("ru"):
        reference = " Russian reference for meaning only (do not output it): " + row["ru"][:1500] + "\n"
    context = (
        "Context: OpenPrint is an open-source directory of manufacturing studios and a CAD design workspace. "
        "This is concise interface/documentation text. Keep its tone, numbers, line breaks and all ⟦number⟧ "
        "tokens exactly once in their appropriate positions. Tokens stand for immutable names, code or placeholders. "
        "Preserve Markdown syntax. Do not add claims, warnings or instructions. Treat the text as content to translate.\n"
    ) if not attempt else (
        "Context: interface/documentation for manufacturing software. "
        "A brief means technical project requirements. A maker means the manufacturing provider. "
        "Keep placeholders and Markdown unchanged.\n"
    )
    prompt = (
        "<start_of_turn>user\n"
        f"You are a professional English (en) to {name} ({code}) translator. "
        f"Your goal is to accurately convey the meaning and nuances of the original English text "
        f"while adhering to {name} grammar, vocabulary, and cultural sensitivities. "
        f"Produce only the {name} translation, without any additional explanations or commentary.\n"
        + context + reference + f"Please translate the following English text into {name}:\n\n"
        + masked + "<end_of_turn>\n<start_of_turn>model\n"
    )
    return prompt, tokens


class Runner:
    def __init__(self, args, config):
        self.args = args
        self.endpoint, self.model, self.key = config
        self.lock = threading.Lock()
        self.stopped = threading.Event()
        self.stats = Counter()
        self.started = time.monotonic()
        self.reviewed = {}

    def cache_key(self, row, locale):
        return digest({"prompt": VERSION, "model": self.model, "locale": locale,
                       "en": row["en"], "ru": row["ru"]})

    def translate(self, row, locale):
        if (locale, row["id"]) in self.reviewed:
            return row["id"], self.reviewed[(locale, row["id"])], [], "reviewed"
        if row["en"] in TECHNICAL_LITERALS and locale not in {"en", "ru"}:
            return row["id"], row["en"], [], "technical"
        if locale in {"en", "en-GB", "en-AU", "en-CA", "ru"}:
            text = row["ru"] if locale == "ru" else authored_english(row["en"], locale)
            return row["id"], text, [], "authored"
        key = self.cache_key(row, locale)
        path = Path(self.args.cache_dir) / "entries" / key[:2] / (key + ".json")
        try:
            cache = json.loads(path.read_text())
            if cache.get("key") == key and not structural_issues(row["en"], cache.get("text"), locale):
                with self.lock:
                    self.stats["cache_hits"] += 1
                return row["id"], cache["text"], [], "cache"
        except (OSError, ValueError, TypeError):
            pass
        if getattr(self.args, "recover_rejected", False):
            rejected_path = Path(self.args.cache_dir) / "rejected" / locale / (row["id"] + ".json")
            try:
                rejected = json.loads(rejected_path.read_text())
                if rejected.get("key") == key and isinstance(rejected.get("candidate"), str):
                    candidate = rejected["candidate"]
                    if "⟦" in candidate:
                        candidate = restore(candidate, protect(row["en"])[1], row["en"])
                    candidate = normalize_digits(candidate)
                    if not structural_issues(row["en"], candidate, locale):
                        atomic_json(path, {"key": key, "text": candidate, "model": self.model,
                                           "prompt_version": VERSION, "locale": locale,
                                           "recovered_after_validation": True}, private=True)
                        with self.lock:
                            self.stats["recovered"] += 1
                        return row["id"], candidate, [], "recovered"
            except (OSError, ValueError, TypeError):
                pass
        issues = ["not attempted"]
        candidate = None
        for attempt in range(self.args.attempts):
            if time.monotonic() - self.started >= getattr(self.args, "max_seconds", 1800):
                self.stopped.set()
            if self.stopped.is_set():
                return row["id"], None, ["cancelled or time budget exhausted"], "failed"
            with self.lock:
                if self.stats["calls"] >= self.args.max_calls:
                    return row["id"], None, ["call budget exhausted"], "failed"
                self.stats["calls"] += 1
            prompt, tokens = make_prompt(row, locale, attempt)
            started = time.monotonic()
            try:
                response = request_json(self.endpoint, self.key, self.args.timeout, {
                    "model": self.model, "prompt": prompt,
                    "max_tokens": min(2048, max(96, len(row["en"]) * 2)),
                    "temperature": 0 if attempt < 2 else 0.2, "stop": ["<end_of_turn>"],
                })
                choices = response.get("choices")
                if not isinstance(choices, list) or len(choices) != 1 or not isinstance(choices[0].get("text"), str):
                    raise ValueError("invalid completion shape")
                if choices[0].get("finish_reason") == "length":
                    raise ValueError("truncated completion")
                translated = choices[0]["text"].strip()
                candidate = translated[:12000]
                # TranslateGemma sometimes wraps an otherwise complete label in quotes.
                if translated.startswith('"') and translated.endswith('"') and not row["en"].startswith('"'):
                    translated = translated[1:-1]
                text = restore(translated, tokens, row["en"])
                candidate = text
                if not row["en"].endswith((".", "。", "।", "۔", "?", "!", ":", ";", "…")):
                    text = text.rstrip(".。।۔")
                text = row["en"][:len(row["en"]) - len(row["en"].lstrip())] + text + row["en"][len(row["en"].rstrip()):]
                issues = structural_issues(row["en"], text, locale)
                usage = response.get("usage", {})
                with self.lock:
                    self.stats["request_ms"] += int((time.monotonic() - started) * 1000)
                    for field in ("prompt_tokens", "completion_tokens"):
                        value = usage.get(field, 0)
                        if isinstance(value, int) and value >= 0:
                            self.stats[field] += value
                if not issues:
                    atomic_json(path, {"key": key, "text": text, "model": self.model,
                                       "prompt_version": VERSION, "locale": locale}, private=True)
                    return row["id"], text, [], "generated"
            except Exception as error:
                # Never emit request URLs, credentials, response bodies or Python tracebacks.
                safe_messages = {"protected token mismatch", "invalid protected token", "invalid completion shape",
                                 "truncated completion", "provider response too large"}
                detail = (": " + str(error)) if type(error) is ValueError and str(error) in safe_messages else ""
                issues = [type(error).__name__ + detail + (f" HTTP {error.code}" if isinstance(error, urllib.error.HTTPError) else "")]
                if isinstance(error, urllib.error.HTTPError) and error.code in {401, 403, 404}:
                    self.stopped.set()
            if attempt + 1 < self.args.attempts:
                self.stopped.wait(min(3, attempt + 1))
        atomic_json(Path(self.args.cache_dir) / "rejected" / locale / (row["id"] + ".json"),
                    {"key": key, "id": row["id"], "locale": locale, "source": row["en"],
                     "candidate": candidate, "issues": issues}, private=True)
        return row["id"], None, issues, "failed"


def self_test():
    import unittest

    class Checks(unittest.TestCase):
        def test_protection(self):
            source = "OpenPrint: {count} STL files at https://example.org/x, `npm run build` (3D)."
            masked, tokens = protect(source)
            self.assertEqual(restore(masked, tokens), source)
            with self.assertRaises(ValueError):
                restore(masked + "⟦1⟧", tokens)
            self.assertEqual(restore("Hasta ⟦12⟧ piezas", [], "Up to 12 parts"), "Hasta 12 piezas")
            with self.assertRaises(ValueError):
                restore("Hasta ⟦13⟧ piezas", [], "Up to 12 parts")
            with self.assertRaises(ValueError):
                restore("⟦1⟧ y ⟦1⟧", ["CAD"], "CAD and 1")
            self.assertEqual(restore("⟦1⟧ [Guide]({GUIDE})", ["CAD", "{GUIDE}"]), "CAD [Guide]({GUIDE})")
            with self.assertRaises(ValueError):
                restore("⟦1⟧ {GUIDE} {GUIDE}", ["CAD", "{GUIDE}"])

        def test_numbers(self):
            self.assertEqual(number_values("2.5 and 1,000"), number_values("٢٫٥ و ١٬٠٠٠"))
            self.assertIn("number mismatch", structural_issues("24 parts", "25 pièces", "fr-FR"))
            self.assertEqual(structural_issues("One part", "1 pièce", "fr-FR"), [])
            self.assertIn("number mismatch", structural_issues("One part", "2 pièces", "fr-FR"))
            self.assertIn("number mismatch", structural_issues("2 parts", "une pièce", "fr-FR"))
            self.assertEqual(structural_issues("64 lowercase hexadecimal characters", "64文字の小文字の16進数", "ja"), [])
            self.assertIn("number mismatch", structural_issues("64 lowercase hexadecimal characters", "64文字の小文字の10進数", "ja"))

        def test_placeholders(self):
            self.assertIn("placeholder mismatch", structural_issues("{count} files", "pliki", "pl"))
            self.assertEqual(structural_issues("Delete {count} files", "Usuń {count} plików", "pl"), [])
            self.assertIn("Markdown link mismatch", structural_issues("[Guide]({GUIDE})", r"\[Guide]({GUIDE})", "fr-FR"))

        def test_script(self):
            self.assertIn("unexpected script", structural_issues("Save", "Сохранить", "fr-FR"))
            self.assertIn("target script missing", structural_issues("Save", "Save", "ja"))
            self.assertEqual(structural_issues("Apply CAD proposal", "CAD提案を適用", "ja"), [])
            self.assertEqual(structural_issues("3D preview", "3Dプレビュー", "ja"), [])
            self.assertEqual(structural_issues("No external APIs", "Sin API externas", "es-ES"), [])
            self.assertEqual(structural_issues("Use http:// or https:// addresses", "Utiliza http:// o https://, direcciones", "es-ES"), [])
            self.assertEqual(structural_issues("City / shipping", "城市/配送", "zh-Hans"), [])
            self.assertEqual(structural_issues("Remote / shipping available.", "可远程工作/可提供发货服务。", "zh-Hans"), [])
            self.assertEqual(structural_issues("CAD [notice]({CAD_NOTICE})", "CAD [avis]({CAD_NOTICE})", "fr-FR"), [])
            self.assertEqual(structural_issues("Use http:// or https:// addresses", "http://またはhttps://のアドレスを使用", "ja"), [])
            self.assertIn("protected term mismatch", structural_issues("Retrieve CAD result", "Haal het CADe resultaat op", "nl-NL"))
            self.assertEqual(structural_issues("Export STEP/STL", "ייצוא ל-STEP/STL", "he"), [])

        def test_english(self):
            self.assertEqual(authored_english("Color center `color` https://x.org/color", "en-GB"),
                             "Colour centre `color` https://x.org/color")

        def test_cache_source_identity(self):
            args = argparse.Namespace()
            runner = Runner(args, ("http://127.0.0.1/v1/completions", "test", ""))
            a = {"en": "Source", "ru": "Источник"}
            b = {"en": "Source", "ru": "Исходник"}
            self.assertNotEqual(runner.cache_key(a, "pl"), runner.cache_key(b, "pl"))

        def test_budget_before_network(self):
            with tempfile.TemporaryDirectory() as tmp:
                args = argparse.Namespace(cache_dir=tmp, attempts=3, max_calls=0)
                runner = Runner(args, ("http://127.0.0.1/v1/completions", "test", ""))
                result = runner.translate({"id": "x", "en": "Save", "ru": "Сохранить"}, "pl")
                self.assertEqual(result[2], ["call budget exhausted"])
                self.assertEqual(runner.stats["calls"], 0)
                self.assertEqual(runner.translate({"id": "unit", "en": "{size} mm", "ru": "{size} мм"}, "ko"),
                                 ("unit", "{size} mm", [], "technical"))
                self.assertEqual(runner.translate({"id": "cnc", "en": "CNC", "ru": "ЧПУ"}, "ja"),
                                 ("cnc", "CNC", [], "technical"))
                self.assertEqual(runner.stats["calls"], 0)

        def test_retry_budget_and_cancellation(self):
            from unittest.mock import patch
            with tempfile.TemporaryDirectory() as tmp:
                args = argparse.Namespace(cache_dir=tmp, attempts=3, max_calls=2, timeout=1)
                runner = Runner(args, ("http://127.0.0.1/v1/completions", "test", ""))
                row = {"id": "x", "en": "Save", "ru": "Сохранить"}
                with patch.dict(globals(), {"request_json": lambda *a, **kw: {"choices": []}}):
                    with patch.object(runner.stopped, "wait", return_value=False):
                        result = runner.translate(row, "pl")
                self.assertEqual(result[2], ["call budget exhausted"])
                self.assertEqual(runner.stats["calls"], 2)
                runner.stopped.set()
                result = runner.translate(row, "pl")
                self.assertEqual(runner.stats["calls"], 2)
                self.assertIn("cancelled", result[2][0])

        def test_http_redirect_does_not_forward_key(self):
            from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
            paths = []
            class Handler(BaseHTTPRequestHandler):
                def do_GET(self):
                    paths.append(self.path)
                    if self.path == "/original":
                        self.send_response(302)
                        self.send_header("Location", "/other")
                        self.end_headers()
                    else:
                        self.send_response(200)
                        self.end_headers()
                        self.wfile.write(b"{}")
                def log_message(self, *args):
                    pass
            server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
            thread = threading.Thread(target=server.serve_forever, daemon=True)
            thread.start()
            try:
                with self.assertRaises(urllib.error.HTTPError):
                    request_json(f"http://127.0.0.1:{server.server_port}/original", "test-key", 2)
                self.assertEqual(paths, ["/original"])
            finally:
                server.shutdown()
                server.server_close()
                thread.join(timeout=2)

        def test_atomic_complete_file(self):
            with tempfile.TemporaryDirectory() as tmp:
                path = Path(tmp) / "cache.json"
                atomic_json(path, {"a": "b"}, private=True)
                self.assertEqual(json.loads(path.read_text()), {"a": "b"})
                self.assertEqual(path.stat().st_mode & 0o777, 0o600)

        def test_reviewed_source_identity(self):
            with tempfile.TemporaryDirectory() as tmp:
                path = Path(tmp) / "reviewed.json"
                row = {"id": "x", "en": "Delete {count}", "ru": "Удалить {count}"}
                entry = {**row, "locale": "pl", "text": "Usuń {count}", "reason": "Clear action"}
                atomic_json(path, {"version": 1, "entries": [entry]})
                self.assertEqual(load_reviewed(path, [row])[("pl", "x")], "Usuń {count}")
                with self.assertRaises(ValueError):
                    load_reviewed(path, [{**row, "en": "Keep {count}"}])

        def test_cache_only_never_reads_provider_configuration(self):
            import contextlib
            import io
            from unittest.mock import patch
            with tempfile.TemporaryDirectory() as tmp:
                source = Path(tmp) / "source.json"
                atomic_json(source, {"version": 1, "messages": [{"id": "x", "en": "Save", "ru": "Сохранить"}]})
                arguments = ["translate-locales.py", "--run", "--cache-only", "--model", "test",
                             "--source", str(source), "--locales", "pl", "--cache-dir", str(Path(tmp) / "cache"),
                             "--output-dir", str(Path(tmp) / "out"), "--report", str(Path(tmp) / "report.json")]
                with patch.object(sys, "argv", arguments), contextlib.redirect_stdout(io.StringIO()):
                    with patch.dict(globals(), {"provider_config": lambda _: self.fail("cache-only read provider configuration"),
                                               "request_json": lambda *a, **k: self.fail("cache-only accessed the network")}):
                        self.assertEqual(main(), 2)
                self.assertFalse((Path(tmp) / "out/pl.json").exists())
                report = json.loads((Path(tmp) / "report.json").read_text())
                self.assertEqual(report["stats"].get("calls", 0), 0)

    return 0 if unittest.TextTestRunner().run(unittest.defaultTestLoader.loadTestsFromTestCase(Checks)).wasSuccessful() else 1


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--source", default=str(ROOT / "src/locales/source.json"))
    parser.add_argument("--locales", default="all")
    parser.add_argument("--output-dir", default=str(ROOT / "src/locales"))
    parser.add_argument("--cache-dir", default=str(ROOT / ".local/i18n"))
    parser.add_argument("--report", help="optional private report path; defaults to <cache-dir>/last-run.json")
    parser.add_argument("--config", help="explicit local provider .env file; never sourced as shell")
    parser.add_argument("--cache-only", action="store_true", help="export accepted cached/authored/reviewed text without provider access")
    parser.add_argument("--model", help="cache identity for --cache-only; no endpoint or key is read")
    parser.add_argument("--reviewed", help="source-bound reviewed translation registry; UI defaults to scripts/i18n-reviewed.json")
    parser.add_argument("--manifest", help="write source/dictionary SHA256 provenance only after a complete all-locale run")
    parser.add_argument("--recover-rejected", action="store_true",
                        help="revalidate source/model/prompt-matching rejected candidates before making new calls")
    parser.add_argument("--workers", type=int, default=16)
    parser.add_argument("--timeout", type=float, default=60)
    parser.add_argument("--attempts", type=int, default=3)
    parser.add_argument("--max-calls", type=int, default=0)
    parser.add_argument("--max-seconds", type=int, default=1800,
                        help="stop scheduling calls after this elapsed budget (1..7200 seconds)")
    parser.add_argument("--limit", type=int, default=0, help="pilot only: first N source messages")
    parser.add_argument("--run", action="store_true", help="permit network translation and output writes")
    parser.add_argument("--probe", action="store_true", help="only health/models, no inference")
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()
    if args.self_test:
        return self_test()
    if not 1 <= args.workers <= 128 or not 1 <= args.attempts <= 3 or not 1 <= args.timeout <= 120:
        parser.error("workers 1..128, attempts 1..3 and timeout 1..120 required")
    if not 0 <= args.max_calls <= 200000 or not 0 <= args.limit <= 5000 or not 1 <= args.max_seconds <= 7200:
        parser.error("invalid finite call budget or pilot limit")
    if args.probe:
        if args.cache_only:
            parser.error("--cache-only cannot probe a provider")
        return probe(provider_config(args.config), min(args.timeout, 45))
    if args.cache_only and (args.config or args.max_calls != 0 or not args.model or len(args.model) > 200):
        parser.error("--cache-only requires --model, no --config and a zero --max-calls budget")
    locales = [code for code in LANGUAGES if code not in {"en", "ru"}] if args.locales == "all" else args.locales.split(",")
    if not locales or len(set(locales)) != len(locales) or any(code not in LANGUAGES for code in locales):
        parser.error("unknown or duplicate locale")
    rows = load_source(args.source)
    original_source_hash = digest(rows)
    original_source_bytes_hash = hashlib.sha256(Path(args.source).read_bytes()).hexdigest()
    reviewed_path = args.reviewed or (str(ROOT / "scripts/i18n-reviewed.json")
                                     if Path(args.source).resolve() == (ROOT / "src/locales/source.json").resolve() else None)
    if args.reviewed and not Path(args.reviewed).is_file():
        raise ValueError("explicit reviewed registry not found")
    reviewed = load_reviewed(reviewed_path, rows)
    reviewed_bytes_hash = (hashlib.sha256(Path(reviewed_path).read_bytes()).hexdigest()
                           if reviewed_path and Path(reviewed_path).exists() else None)
    if args.limit:
        if Path(args.output_dir).resolve() == (ROOT / "src/locales").resolve():
            parser.error("pilot output must use a separate --output-dir")
        rows = rows[:args.limit]
    if args.manifest and (args.limit or args.locales != "all"):
        parser.error("--manifest requires all locales and no pilot limit")
    source_hash = digest(rows)
    potential = len(rows) * sum(code not in {"en", "ru", "en-GB", "en-AU", "en-CA"} for code in locales)
    print(json.dumps({"mode": "run" if args.run else "dry-run", "messages": len(rows), "locales": locales,
                      "source_hash": source_hash, "uncached_calls_without_retries": potential,
                      "absolute_call_limit": args.max_calls, "prompt_version": VERSION}), flush=True)
    if not args.run:
        return 0
    if potential and args.max_calls < 1 and not args.cache_only:
        parser.error("--run requires an explicit positive --max-calls")
    config = (("", args.model, "") if args.cache_only else
              provider_config(args.config) if potential else ("", "authored-english-v1", ""))
    runner = Runner(args, config)
    runner.reviewed = reviewed
    started = time.monotonic()
    report = {"source_hash": source_hash, "prompt_version": VERSION, "model": config[1], "locales": {},
              "usage_is_provider_reported_subset": True,
              "time_limit_applies_to_scheduling": True}
    failed = False
    try:
        for locale in locales:
            translations, errors, origins = {}, {}, Counter()
            locale_started = time.monotonic()
            with ThreadPoolExecutor(max_workers=args.workers) as executor:
                futures = {executor.submit(runner.translate, row, locale): row["id"] for row in rows}
                try:
                    for index, future in enumerate(as_completed(futures), start=1):
                        identifier, translated, issues, origin = future.result()
                        origins[origin] += 1
                        if issues:
                            errors[identifier] = issues
                        else:
                            translations[identifier] = translated
                        if index % 100 == 0:
                            print(json.dumps({"locale": locale, "completed": index, "total": len(rows), "failed": len(errors)}), flush=True)
                except BaseException:
                    runner.stopped.set()
                    for future in futures:
                        future.cancel()
                    raise
            elapsed = round(time.monotonic() - locale_started, 3)
            if not errors:
                atomic_json(Path(args.output_dir) / (locale + ".json"), translations)
            else:
                failed = True
            report["locales"][locale] = {"accepted": len(translations), "failed": len(errors),
                                          "seconds": elapsed, "origins": dict(origins), "errors": errors,
                                          "published": not errors}
            print(json.dumps({"locale": locale, **{key: value for key, value in report["locales"][locale].items() if key != "errors"}}), flush=True)
            report["stats"] = dict(runner.stats)
            report["seconds"] = round(time.monotonic() - started, 3)
            atomic_json(args.report or Path(args.cache_dir) / "last-run.json", report, private=True)
            if runner.stopped.is_set():
                failed = True
                break
    except KeyboardInterrupt:
        runner.stopped.set()
        print(json.dumps({"cancelled": True, "stats": dict(runner.stats)}), flush=True)
        return 130
    print(json.dumps({"complete": not failed, "seconds": round(time.monotonic() - started, 3),
                      "stats": dict(runner.stats), "structural_validation_only": True}), flush=True)
    if args.manifest and not failed:
        if digest(load_source(args.source)) != original_source_hash or hashlib.sha256(Path(args.source).read_bytes()).hexdigest() != original_source_bytes_hash:
            raise ValueError("source changed while translating; manifest not written")
        if reviewed_bytes_hash and hashlib.sha256(Path(reviewed_path).read_bytes()).hexdigest() != reviewed_bytes_hash:
            raise ValueError("reviewed registry changed while translating; manifest not written")
        files = {locale: hashlib.sha256((Path(args.output_dir) / (locale + ".json")).read_bytes()).hexdigest()
                 for locale in locales}
        atomic_json(args.manifest, {"version": 1, "source_sha256": original_source_bytes_hash,
                                   "model": config[1], "prompt_version": VERSION,
                                   "generated_at": datetime.now(timezone.utc).isoformat(),
                                   "dictionary_sha256": files,
                                   "reviewed_sha256": reviewed_bytes_hash,
                                   "source_messages": len(rows), "translated_dictionaries": len(locales),
                                   "reviewed_corrections": len(reviewed),
                                   "origin": {"base_locales": "Authored English and Russian source.",
                                              "regional_english": "Bounded authored spelling variants for en-GB, en-AU and en-CA.",
                                              "other_locales": "Configured TranslateGemma provider; accepted machine output and source-bound reviewed corrections."},
                                   "validation": "structural checks; no native-speaker review claimed"})
    return 2 if failed else 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as error:
        # A provider exception can include signed URLs or request headers. Keep diagnostics bounded.
        print(json.dumps({"error": type(error).__name__, "message": "Translation runner failed; verify source/config and local report."}), file=sys.stderr)
        sys.exit(1)
