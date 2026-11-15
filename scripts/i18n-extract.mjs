import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parsers } from 'prettier/plugins/typescript';
import { format, resolveConfig } from 'prettier';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.join(root, 'src/locales/source.json');
const check = process.argv.includes('--check');
if (process.argv.slice(2).some((arg) => arg !== '--check'))
  throw new Error('Usage: node scripts/i18n-extract.mjs [--check]');
const messages = new Map();
const unresolved = [];
const literal = (node) =>
  node?.type === 'Literal' && typeof node.value === 'string'
    ? node.value
    : node?.type === 'TemplateLiteral' && node.expressions.length === 0
      ? node.quasis[0].value.cooked
      : null;

// Match the browser runtime: FNV-1a over JavaScript UTF-16 code units, with a NUL separator.
function pairId(ru, en) {
  let hash = 0x811c9dc5;
  const source = ru + '\0' + en;
  for (let index = 0; index < source.length; index++)
    hash = Math.imul(hash ^ source.charCodeAt(index), 0x01000193) >>> 0;
  return 'm_' + hash.toString(16).padStart(8, '0');
}
function add(ru, en, ref) {
  const placeholders = (value) =>
    [...new Set([...value.matchAll(/\{([A-Za-z][A-Za-z0-9_]*)\}/g)].map((match) => match[1]))]
      .sort()
      .join(',');
  if (placeholders(ru) !== placeholders(en)) throw new Error(`Placeholder mismatch at ${ref}`);
  const id = pairId(ru, en);
  const previous = messages.get(id);
  if (previous && (previous.ru !== ru || previous.en !== en))
    throw new Error(`Message ID collision: ${id} at ${ref}`);
  if (previous) previous.refs.add(ref);
  else messages.set(id, { id, ru, en, refs: new Set([ref]) });
}
for (const dir of ['src', 'shared', 'server']) {
  const files = (await readdir(path.join(root, dir)))
    .filter(
      (file) =>
        /\.tsx?$/.test(file) &&
        (dir !== 'server' || /^(?:studio.*|cad-data|cad-ai)\.ts$/.test(file)),
    )
    .sort();
  for (const name of files) {
    if (dir === 'src' && /^i18n(?:\.|-)/.test(name)) continue;
    const file = `${dir}/${name}`;
    const source = await readFile(path.join(root, file), 'utf8');
    const tree = await parsers.typescript.parse(source, { filepath: file });
    const at = (node) =>
      `${file}:${node.loc?.start.line ?? source.slice(0, node.range[0]).split('\n').length}`;
    function walk(node) {
      if (!node || typeof node !== 'object') return;
      if (
        node.type === 'CallExpression' &&
        node.callee?.type === 'Identifier' &&
        node.callee.name === 't'
      ) {
        const ru = literal(node.arguments[0]),
          en = literal(node.arguments[1]);
        if (ru !== null && en !== null) add(ru, en, at(node));
        else {
          const expression = source.slice(node.range[0], node.range[1]).replace(/\s+/g, ' ');
          // These are fixed, extracted tables rather than user content or computed messages.
          const allowed =
            (file === 'src/Studio.tsx' && expression === 't(check.ru, check.en)') ||
            (file === 'src/core.tsx' && expression === 't(...pair)') ||
            (file === 'src/errors.ts' && ['t(...pair)', 't(...value)'].includes(expression));
          if (!allowed) unresolved.push(`${at(node)} ${expression}`);
        }
      }
      if (node.type === 'CallExpression' && node.callee?.type === 'Identifier') {
        const offset =
          file === 'src/core.tsx' && node.callee.name === 'translate'
            ? 1
            : file === 'server/studio-geometry.ts' && node.callee.name === 'add'
              ? 2
              : -1;
        if (offset >= 0) {
          const ru = literal(node.arguments[offset]),
            en = literal(node.arguments[offset + 1]);
          if (ru !== null && en !== null) add(ru, en, at(node));
        }
      }
      // Legacy pair tables and server check messages remain part of the same catalog.
      if (node.type === 'ArrayExpression' && node.elements.length === 2) {
        const first = literal(node.elements[0]),
          second = literal(node.elements[1]);
        if (first !== null && second !== null) {
          if (/[А-Яа-яЁё]/.test(first) && !/[А-Яа-яЁё]/.test(second)) add(first, second, at(node));
          else if (!/[А-Яа-яЁё]/.test(first) && /[А-Яа-яЁё]/.test(second))
            add(second, first, at(node));
        }
      }
      if (node.type === 'ObjectExpression') {
        const properties = new Map(
          node.properties
            .filter((property) => property.type === 'Property')
            .map((property) => [property.key.name ?? property.key.value, property.value]),
        );
        const ru = literal(properties.get('ru')),
          en = literal(properties.get('en'));
        if (ru !== null && en !== null) add(ru, en, at(node));
        const ruNode = properties.get('ru'),
          enNode = properties.get('en');
        if (ruNode?.type === 'ConditionalExpression' && enNode?.type === 'ConditionalExpression') {
          if (source.slice(...ruNode.test.range) !== source.slice(...enNode.test.range))
            throw new Error(`Mismatched conditional translation at ${at(node)}`);
          for (const branch of ['consequent', 'alternate']) {
            const ru = literal(ruNode[branch]),
              en = literal(enNode[branch]);
            if (ru === null || en === null)
              throw new Error(`Unextractable conditional translation at ${at(node)}`);
            add(ru, en, at(node));
          }
        }
      }
      for (const [key, value] of Object.entries(node)) {
        if (['range', 'loc', 'tokens', 'comments', 'parent'].includes(key)) continue;
        if (Array.isArray(value)) value.forEach(walk);
        else if (value && typeof value === 'object') walk(value);
      }
    }
    walk(tree);
  }
}
if (unresolved.length)
  throw new Error('Unextractable translation calls:\n' + unresolved.join('\n'));
const result = {
  version: 1,
  messages: [...messages.values()]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((message) => ({ ...message, refs: [...message.refs].sort() })),
};
const json = await format(JSON.stringify(result), {
  ...(await resolveConfig(output)),
  parser: 'json',
});
if (check) {
  if ((await readFile(output, 'utf8')) !== json)
    throw new Error('Translation source is stale. Run node scripts/i18n-extract.mjs');
  console.log(`Translation source checked: ${result.messages.length} messages`);
} else {
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, json);
  console.log(`Translation source written: ${result.messages.length} messages`);
}
