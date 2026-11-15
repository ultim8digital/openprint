# OpenPrint

**An open directory of printing studios and workshops. No registration or moderators.**

[Русский](README.md) · [Self-publication](docs/OPEN_CATALOG.md) · [Self-hosting](docs/SELF_HOSTING.md) · [Contributing](CONTRIBUTING.md) · [Validation](docs/VALIDATION.md)

Find a maker on the map and contact them directly. If your workshop is missing, submit its contacts and capabilities: the listing is published immediately. Save the private management link to edit or delete it later. There are no accounts, email confirmation or approval queues in the default catalogue mode.

The public source is MIT licensed. Run it with Node.js 24 and local SQLite; no Vercel, Supabase, email provider, paid AI or third-party login is required. GitHub hosts the code and releases. A shared website accepting anonymous submissions needs a running API server; [GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages) alone cannot execute Node.js or persist visitor changes.

## Catalogue features

- Search by name, city and technology. Map every matching location independently of list pagination.
- Publish without an account; choose a map point or enter coordinates. Unlocated records remain searchable.
- Edit/delete one listing with its private capability link, with version checks for concurrent edits.
- Find existing studios before publishing; exact name/city/address duplicates are rejected automatically.
- Import an existing catalogue with source attribution. Operator imports cannot overwrite self-published listings.
- Russian/English UI and OpenStreetMap tiles without an API key.

Publication does not verify business ownership or quality. Confirm capabilities and terms with the studio. Keep management links private: possession grants control over that listing. There is no email recovery.

## Run your own instance

```sh
npm ci
npm run build
cp .env.example .env
npm start
```

The default `APP_MODE=catalog` needs no administrator or user setup. Configure HTTPS, `APP_URL` and backups using [self-hosting instructions](docs/SELF_HOSTING.md), or run `docker compose up --build -d`. Import an existing dataset with the [catalogue CLI](docs/CATALOG_IMPORT.md). Instance datasets are excluded from this repository and its images.

## Optional community / Neofab mode

Set `APP_MODE=community` explicitly to enable the existing private project, quotation, model library and Neofab Studio workflows, with their original accounts and permissions. Switching modes preserves data. Catalogue mode neither exposes private history through the API nor resumes queued CAD work.

[Neofab Studio](docs/NEOFAB_SETUP.md) supports versioned manufacturing briefs, BOM and bounded declarative CAD with STEP/STL. CAD and AI are optional. CAM/G-code and physical manufacturing validation are not implemented.

## Development

```sh
npm run dev
npm run check
npx playwright install chromium
npm run test:e2e
npm run format:check
```

GitHub Actions verifies API/browser workflows and default/native CAD containers. Tests use fictional data. See [validation evidence](docs/VALIDATION.md), [product scope](docs/PRODUCT.md), [privacy](PRIVACY.md) and [security](SECURITY.md).

This independent implementation develops the idea of [3d-online.app](https://3d-online.app). Original production accounts, secrets, private Git history and user files are not bundled. The code, UI and documentation are [MIT](LICENSE); third-party dependencies and user datasets have separate rights. The CAD extraction retains its [original notice](cad-worker/NOTICE.md). See [third-party notices](THIRD_PARTY_NOTICES.md).
