# OpenPrint

**An open directory of printing studios and workshops. No registration or moderators.**

<details>
<summary>Choose a language</summary>

[English (US)](../../README.md) · [Español (España)](../../docs/readme/README.es-ES.md) · [العربية](../../docs/readme/README.ar-SA.md) · [Français (France)](../../docs/readme/README.fr-FR.md) · [हिन्दी](../../docs/readme/README.hi.md) · [ไทย](../../docs/readme/README.th.md) · [Русский](../../docs/readme/README.ru.md) · [Deutsch](../../docs/readme/README.de-DE.md) · [Italiano](../../docs/readme/README.it.md) · [Português (Brasil)](../../docs/readme/README.pt-BR.md) · [Nederlands](../../docs/readme/README.nl-NL.md) · [Svenska](../../docs/readme/README.sv.md) · [Dansk](../../docs/readme/README.da.md) · [Norsk bokmål](../../docs/readme/README.no.md) · [Türkçe](../../docs/readme/README.tr.md) · [Tiếng Việt](../../docs/readme/README.vi.md) · [日本語](../../docs/readme/README.ja.md) · [한국어](../../docs/readme/README.ko.md) · [简体中文](../../docs/readme/README.zh-Hans.md) · [繁體中文](../../docs/readme/README.zh-Hant.md) · [English (UK)](../../docs/readme/README.en-GB.md) · **[English (Australia)](../../docs/readme/README.en-AU.md)** · [English (Canada)](../../docs/readme/README.en-CA.md) · [Español (México)](../../docs/readme/README.es-MX.md) · [Français (Canada)](../../docs/readme/README.fr-CA.md) · [Português (Portugal)](../../docs/readme/README.pt-PT.md) · [Polski](../../docs/readme/README.pl.md) · [Українська](../../docs/readme/README.uk.md) · [Bahasa Indonesia](../../docs/readme/README.id.md) · [Čeština](../../docs/readme/README.cs.md) · [Slovenčina](../../docs/readme/README.sk.md) · [Magyar](../../docs/readme/README.hu.md) · [Română](../../docs/readme/README.ro.md) · [Hrvatski](../../docs/readme/README.hr.md) · [Ελληνικά](../../docs/readme/README.el.md) · [Suomi](../../docs/readme/README.fi.md) · [Slovenščina](../../docs/readme/README.sl-SI.md) · [Català](../../docs/readme/README.ca.md) · [עברית](../../docs/readme/README.he.md) · [Bahasa Melayu](../../docs/readme/README.ms.md) · [বাংলা](../../docs/readme/README.bn-BD.md) · [ગુજરાતી](../../docs/readme/README.gu-IN.md) · [ಕನ್ನಡ](../../docs/readme/README.kn-IN.md) · [മലയാളം](../../docs/readme/README.ml-IN.md) · [मराठी](../../docs/readme/README.mr-IN.md) · [ଓଡ଼ିଆ](../../docs/readme/README.or-IN.md) · [ਪੰਜਾਬੀ](../../docs/readme/README.pa-IN.md) · [தமிழ்](../../docs/readme/README.ta-IN.md) · [తెలుగు](../../docs/readme/README.te-IN.md) · [اردو](../../docs/readme/README.ur-PK.md)

</details>

Find a maker on the map, check their capabilities and contact them directly. If your workshop is missing, add its contacts and services: the listing appears immediately. Save the private management link to edit or delete your listing later. The default catalog has no accounts, email confirmation or approval queue.

Run OpenPrint with Node.js 24 and local SQLite. Vercel, Supabase, an email provider, paid AI and third-party login are not required. GitHub hosts the source and releases; a shared website accepting submissions needs a running API server. [GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages) alone cannot run the Node.js API or persist visitor changes.

## Catalog features

- Search by name, city and technology. The map includes matching locations independently of list pagination.
- Publish without an account. Choose a map point or enter coordinates; listings without coordinates remain searchable.
- Edit or delete one listing with its private link. Version checks protect against conflicting edits in different tabs.
- Find existing studios before publishing. Exact name, city and address duplicates are rejected automatically.
- Import a catalog with source attribution. Operator imports cannot overwrite self-published listings.
- View OpenStreetMap tiles without an API key. Tiles load when a map is displayed, including the default landing page.
- Choose the interface language from the language menu. Read the full README in your language through the language index above.

Publication does not verify business ownership or service quality. Confirm equipment, capabilities and terms with the studio. Anyone holding the private management link can control that listing. Keep it private; there is no email recovery. Read the [self-publication guide](../../docs/OPEN_CATALOG.md).

## Run your own instance

Install Node.js 24, clone this repository and run:

```sh
npm ci
npm run build
cp .env.example .env
npm start
```

Open `http://localhost:3000`. The default `APP_MODE=catalog` needs no administrator or user setup. Configure `APP_URL`, HTTPS and backups using the [self-hosting guide](../../docs/SELF_HOSTING.md). Docker Compose is also available: `docker compose up --build -d`.

The supported deployment is one application process with SQLite on a local disk. Automatic publication and request quotas limit abuse without a moderation queue. A shared office IP can share a publication quota. See [limits and management-link behavior](../../docs/OPEN_CATALOG.md) before opening a public instance.

Use the [catalog import CLI](../../docs/CATALOG_IMPORT.md) for an existing dataset after checking its rights. Instance datasets, uploads and backups are not bundled in the repository or container images.

## Optional community and Neofab mode

Set `APP_MODE=community` explicitly to enable private projects, provider quotations, the model library and Neofab Studio. These workflows use their own accounts and permissions. Switching modes preserves stored data. Catalog mode does not expose private community history through its API or resume queued CAD work.

[Neofab Studio](../../docs/NEOFAB_SETUP.md) supports versioned manufacturing briefs, bills of materials and bounded declarative CAD with STEP/STL exports. CAD and AI are optional. AI proposals require review and a separate application step; they do not automatically publish orders or build geometry. CAM, G-code and physical manufacturing validation are not implemented.

## Data rights and privacy

The MIT software license does not grant rights to imported business records. Attribution alone does not authorise copying data from Google Maps, 2GIS, Yandex Maps or other sources. Verify permissions for storage, publication and redistribution before using a dataset. See [data provenance and review boundaries](../../docs/DATA_PROVENANCE.md).

Self-published contact details are public; management keys are private. Keep databases and backups out of publicly served directories, and provide a contact for corrections and removal requests. Read [privacy](../../PRIVACY.md) and [security](../../SECURITY.md) before deployment.

## Development and translation

```sh
npm run dev
npm run check
npx playwright install chromium
npm run test:e2e
npm run format:check
```

GitHub Actions checks types, API and browser workflows, and the default and native CAD containers. Tests use fictional records. Exact evidence, coverage and remaining limits are recorded in [validation](../../docs/VALIDATION.md) and [product scope](../../docs/PRODUCT.md).

The English README is the reference for full translated editions. The [language index](../../docs/i18n/README.md) documents translation maintenance and review limits. Interface localization does not translate user-authored listings, project content or every external technical diagnostic.

## Licensing and contributions

The original source, UI, SVG illustrations, documentation and parametric generator are [MIT licensed](../../LICENSE). Dependencies retain their own licenses and notices. User models have a separate license chosen by their authors. Fictional demo profile and brief text, and three generated demo designs, are dedicated under CC0; the generator remains MIT. See [third-party notices](../../THIRD_PARTY_NOTICES.md).

This independent implementation develops the idea of [3d-online.app](https://3d-online.app). Original production accounts, secrets, private Git history and user files are not included. The adapted MIT Neofab CAD compiler retains its [original license and provenance notice](../../cad-worker/NOTICE.md).

Contributions can include code, translation corrections, usability improvements, open parametric parts, installation checks and feedback from real workshops. Start with [CONTRIBUTING.md](../../CONTRIBUTING.md).
