# OpenPrint

**From a requirement to CAD and a maker. An open workshop community with Neofab Studio.**

[Русский](README.md) · [Self-hosting](docs/SELF_HOSTING.md) · [Architecture](docs/ARCHITECTURE.md) · [Contributing](CONTRIBUTING.md) · [Validation](docs/VALIDATION.md)

Run OpenPrint for a city, maker club, or small network of workshops. Customers share a brief; makers ask questions and send offers; both parties discuss scope and record the exact agreement. There is no required Vercel, Supabase, AI, or email-service account.

![OpenPrint overview with fictional demo data](docs/images/overview.png)

## Try it locally

Requires **Node.js 24 LTS**. Clone this repository, then:

```sh
npm ci
npm run demo
```

Open **http://localhost:5173**. Switch between fictional customers, workshops, an engineer, and the moderator using the demo bar. All sample people, companies, and projects are fictional. Demo data lives in `.local/demo`.

**Do not expose demo mode publicly.** It includes one-click access to fictional accounts. Real instances start empty, have no default administrator password, and have no demo sign-in endpoint.

## Who is it for?

- Customers: public or direct briefs, private attachments, comparable offers, recorded agreements, and customer-confirmed completion.
- Workshops and engineers: self-managed profiles, an open project board, direct requests, questions before quoting, immutable offer revisions, and delivery status.
- Model creators: share original designs with attribution and a CC license, moderator review, and publication controls.
- Moderators: review profiles and model files, handle reports, hide inappropriate content, and inspect decision history.
- Community operators: one Node.js process, SQLite, local private uploads, CLI administrator setup and recovery, backup/restore instructions, and Docker Compose.
- Visitors: search makers, download approved open models, inspect STL/OBJ files locally, and build custom-size parts without signing in.

The interface supports Russian and English. User-generated content stays in its original language. The optional OpenStreetMap map loads only on request; core workflows require no third-party API calls.

## Neofab Studio and local CAD

Neofab expands the project toward a digital factory for functional parts, repairs, spares, furniture, engineered assemblies and small batches. Studio connects a private idea, editable requirements, components, a CAD revision, a confirmed package and an immutable request to a maker.

The manual path needs no API key. Optional server-side OpenAI Responses assistance prepares a draft, with separate configurable models for clarification and detailed review, attempt limits and token usage records. Live paid API calls have not been validated for this build.

Version 0.2 adds an optional local CadQuery engine for parts and assemblies made from boxes, cylinders, extrusions, fillets and chamfers. It produces assembly and per-part STEP/STL, BOM, source JSON and a geometry report, with revision history and a 3D component viewer. The owner can grant a named participant access for quotation; the recipient of a direct request receives the confirmed CAD package when it is sent. Public briefs do not expose CAD files. The three simple FDM templates remain available without Python. CAM, machine code, strength analysis and multi-workshop execution are future work.

See the [setup guide](docs/NEOFAB_SETUP.md), [CAD engine instructions](docs/CAD_ENGINE.md), [CAD/CAM architecture](docs/NEOFAB_BLUEPRINT.md) and [business hypotheses](docs/NEOFAB_BUSINESS.md) (the Studio/product guides are in Russian).

## Run a real community

```sh
npm ci
npm run build
cp .env.example .env
npm run admin -- operator@example.org
npm start
```

The administrator command prints a private, one-use setup link that expires in 30 minutes. Open **http://localhost:3000**. Configure your public HTTPS origin, operator contact, moderation process, and backups before exposing the instance. See [self-hosting](docs/SELF_HOSTING.md).

You can also keep the source only on GitHub, without operating a public site. A running shared community still needs a computer or server.

The default Docker image needs no Python. To include the optional CAD runtime, use `docker compose -f compose.yaml -f compose.cad.yaml up --build -d`. A local installation can instead set the server-side `CAD_PYTHON` interpreter path; see [self-hosting](docs/SELF_HOSTING.md).

## Deliberate limits

OpenPrint 0.2 is intended for small communities. It does not provide payments, escrow, identity verification, manufacturing-safety certification, antivirus scanning, or dispute arbitration. Makers and customers arrange payments and delivery directly. CAD geometry checks cover the declared model; they do not establish strength, process suitability or physical performance. Physical manufacturing has not been validated.

The declarative CAD scope is limited to 24 physical components and 300 operations. Arbitrary STEP import into editable feature history, CAM, G-code and FEA are outside this release. Use one application process with local storage. Team memberships, horizontal scaling, SMTP, AI-generated CAD, automatic agent routing, SSR/SEO, automatic translation of member content, and Supabase account migration are not included. The operator can access server data; this is not end-to-end encryption. See [product scope](docs/PRODUCT.md), [privacy](PRIVACY.md), and [security](SECURITY.md).

## Development

```sh
npm run dev
npm run check
npx playwright install chromium
npm run test:e2e
npm run format:check
```

The test suite covers real API sessions and permissions, stale and concurrent offer acceptance, file access, paginated conversations, recovery, moderation, backup and restore, generated mesh topology, and complete browser workflows. Automated accessibility checks are included; they are not a claim of full WCAG compliance. See [validation](docs/VALIDATION.md).

Native geometry checks and the browser assembly-build scenario need CadQuery and `CAD_PYTHON`. Without that runtime, six browser tests execute and the native assembly test is skipped. See [CAD engine instructions](docs/CAD_ENGINE.md) for installation and test commands.

## License and provenance

Code, UI, original SVG illustrations, and documentation are [MIT](LICENSE). Member-uploaded models have their own explicit licenses. Three fictional demo geometries are offered under CC0; their generator code remains MIT.

The optional CAD compiler adapts an MIT-licensed geometry module; attribution and the extraction boundary are recorded in [cad-worker/NOTICE.md](cad-worker/NOTICE.md). Provider integrations, private history, user data and credentials are excluded.

Inspired by [3d-online.app](https://3d-online.app), implemented separately. No production database, scraped company directory, private Git history, user files, or credentials were copied. Contributions welcome: [CONTRIBUTING.md](CONTRIBUTING.md).
