# Changelog

## Unreleased — Neofab Studio preview

- Private versioned manufacturing briefs, components/BOM, operations, open questions, assumptions and acceptance criteria for broad CAD/CAM projects.
- Russian/English Studio UI, manual workflow without keys, confirmation of exact revisions, maker matching and idempotent request publication.
- Deterministic single-part FDM template STL and a confirmed packet with geometry manifest; general CAD/CAM requests remain design briefs.
- Optional server-side Responses API with separate clarification/review models, explicit text-sharing consent, strict output validation, bounded calls and tokens, persistent usage and request deduplication.
- Expanded technology/material vocabulary, SQLite schema v2 migration, private Studio data export and account cleanup.
- Universal Neofab architecture, business hypotheses and operator setup guide. Live AI calls, CAD worker integration, machine code, payments and physical production remain unvalidated or unimplemented as documented.

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
