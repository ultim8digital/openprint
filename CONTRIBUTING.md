# Contributing / Участие

OpenPrint is for people who make things together. Useful contributions include code, translation, original reusable parts, clear printing notes, accessible interfaces and reports from actual workshops.

## For makers and model authors

Create/update your provider profile in the application instead of opening a GitHub issue with personal contacts. Publish only models you own or can redistribute under the chosen license. Add dimensions, intended use, limitations and attribution. Do not submit scraped company databases, customer drawings or purchased models without redistribution rights.

For the repository, add original parametric designs with explicit licensing and geometry tests. Avoid embedding personal/private files in commits or screenshots. Demo content must remain clearly fictional.

## For developers

Use Node.js 24 and the committed lockfile:

```sh
npm ci
npm run demo
npm run check
npx playwright install chromium
npm run test:e2e
npm run format
npm run format:check
```

Make a focused branch and pull request. Explain the concrete before/after behavior and relevant validation. A screen change should include desktop/mobile screenshots using fictional data. Schema changes need an incremental migration, preservation of accepted terms, backup/restore consideration and a meaningful regression test.

Check permissions on the server, not just by hiding buttons. Preserve exact offer revisions, private-file access, thread membership, pagination/read cursors, money in integer minor units and customer confirmation. Never grant admin roles from user-editable metadata, the first registration, or an email match alone.

Do not require a paid API for a core user path. Do not silently introduce tracking, third-party font calls or map requests on page load. Run `node scripts/licenses.mjs` after relevant dependency updates and include updated notices.

## For translators and designers

The initial interface uses `t('Russian', 'English')` pairs. Translate both the empty/error/success paths and controls; user-authored content stays as written. Keep clear labels, keyboard access, visible focus, readable contrast, reduced-motion support and narrow-screen layouts. Automatic axe checks complement, not replace, manual accessibility work.

## Reporting bugs

Use the issue template with version, Node/OS, a minimal reproduction, expected/actual behavior and redacted logs. Say whether the issue is in local demo or a real instance. Never include passwords, session cookies, recovery tokens, `.env`, a real database or customer attachments.

Security findings should use private reporting as described in [SECURITY.md](SECURITY.md).

By contributing code you agree to provide it under the repository’s MIT license, unless a clearly scoped file states another compatible license. Model/sample content needs its own explicit grant; a code contribution does not change participant-owned content licenses.
