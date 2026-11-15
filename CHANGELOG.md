# Changelog

## 0.4.0 — 2026-11-15

- Imported studio catalogues now appear alongside registered makers in directory search and on the map, with explicit source labels and separate contact paths.
- The map loads every matching coordinate independently of the 12-card list page, with member/catalogue colours, coordinate counts and an explicit 50,000-point limit.
- Optional operator CLI validates an allowlisted JSON snapshot before atomic per-source replacement. Stable studio IDs survive reimport; accounts, orders and other sources are preserved.
- SQLite schema 5 stores catalogue records separately from user profiles. Imported records do not acquire accounts, moderator review or the ability to receive platform orders.
- Real catalogue datasets remain outside Git and container images. Empty installations stay empty until an operator imports a source.

## 0.3.0 — 2026-11-15

- Optional AI CAD proposals with summary, questions, a bounded declarative specification and separate reviewed application to the original project revision. Applying a proposal does not compile, confirm or publish it.
- Task-based server model routing: brief clarification, detailed review and CAD; shared idempotent request ledger, attempt quotas and concurrency limits. CAD output has its own token limit.
- SQLite schema v4 stores private proposals and task metadata, with immutable source state, stale-result protection, account export and deletion.
- Proposal review and usage controls in RU/EN, preserving manual CAD without an API key. Model quality and account availability still require live evaluation; no paid API call is claimed by the automated fixtures.

## 0.2.0 — 2026-11-15

Neofab Studio connects a versioned manufacturing brief to a local CAD package and a named provider. The community workflow remains usable without CAD or an AI key.

- Private versioned manufacturing briefs, components/BOM, operations, open questions, assumptions and acceptance criteria for broad CAD/CAM projects.
- Russian/English Studio UI, manual workflow without keys, confirmation of exact revisions, maker matching and idempotent request publication.
- Optional local CadQuery engine for bounded declarative parts and assemblies: boxes, cylinders, extrusions, fillets and chamfers; assembly/per-part STEP and STL, BOM, JSON specification, mesh, report and ZIP package.
- Editable CAD components/operations, assembly preview, component isolation and exploded view. Simple FDM templates remain available without Python.
- Durable single-worker CAD queue, cancellation, timeout/restart recovery, revision-bound results, persistent daily usage and reserved output quotas. No generated executable source is run.
- Confirmed packets bind exact brief/specification/artifact hashes. Direct recipients receive the package on publication; owners can grant named conversation participants quotation access and revoke it before assignment.
- SQLite schema v3 migration, private CAD BLOB storage, account export/closure and hash-verified database backup manifest v2.
- Optional server-side Responses API with separate clarification/review models, explicit text-sharing consent, strict output validation, bounded calls and tokens, persistent usage and request deduplication.
- Expanded technology/material vocabulary, manual design/manufacturing intent, and explicit preservation of unresolved questions, assumptions and unknown component quantities.
- Optional Python setup and CAD Docker Compose override; MIT compiler extraction with retained provenance and license.
- Local validation: 38 Node tests, seven browser flows including CAD editing and a native CadQuery assembly workflow, production build and separate native-kernel checks. See [VALIDATION.md](docs/VALIDATION.md) for current CI status and exact evidence boundaries.
- CAM/G-code, FEA, automatic AI-to-CAD generation, model-routing cascades, payments and multi-provider work orders are not implemented. No live paid OpenAI call or physical manufacturing result is claimed.

## 0.1.0 — 2026-11-13

First public implementation of OpenPrint, an independent self-hosted 3D printing and engineering community.

- Russian/English maker directory, explicit filters and an optional OpenStreetMap map.
- Public/direct project briefs, private attachments and pre-quote questions.
- Immutable offer revisions, exact acceptance snapshots, transaction-safe selection and customer-confirmed completion.
- Paginated private conversations, read cursors, in-app notifications, reports and blocks.
- Author-attributed, CC-licensed model sharing with moderator review.
- Browser-local STL/OBJ inspection and parametric block, plate and tube STL export.
- Server sessions, operator-issued one-use admin/recovery setup, password changes, data export and explicit account anonymization.
- SQLite/local-file persistence, safe orphan cleanup, hash-verified stopped-instance backup, restore instructions and container configuration.
- Fictional isolated local demo; no copied production directory, private Git history, user data or API credentials.
- API/geometry tests, full browser workflows, overview axe checks, pinned-dependency lockfile and CI.

Version 0.1 intentionally excludes payments/escrow, automatic identity verification, team membership, AI generation, SSR, physical-print certification, original-service migration and horizontal scaling. See [product scope](docs/PRODUCT.md).
