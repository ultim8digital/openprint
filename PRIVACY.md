# Data handling / Работа с данными

This document describes the application’s behavior. Each instance operator must identify their own contact, purposes, applicable obligations and backup-retention policy. It is not a legal determination for every jurisdiction.

## Stored data

An operator can import a separate studio catalogue containing organisation names, public descriptions, cities/regions/countries, coordinates, technologies/materials, websites, public business phones/addresses, source attribution and import dates. Import excludes email, opening hours, ratings/reviews and other unlisted fields. Catalogue entries are public directory records, not participant accounts, reviewed providers or order recipients. Operators update/remove them by replacing the corresponding source snapshot. These records are included in the local database backup; source files are not bundled in the public code repository.

The community’s local database stores account names, self-asserted email addresses, password hashes, sessions/recovery-token digests, provider profiles, project briefs, offers/accepted terms, messages, notifications, model metadata, reports, blocks and operational decision events. Uploads are private files outside the web root, with owner, size and SHA-256 metadata.

Neofab Studio stores private ideas, structured requirements, component lists, operations, acceptance criteria, revisions and confirmation hashes. Its AI usage ledger stores model names, attempt status, token counts, request hashes and timestamps. API keys stay in the server environment; they are never stored in project records or sent to the browser.

Optional CAD stores versioned JSON specifications, queued/build status and diagnostic details, geometry reports, artifact hashes and the generated files themselves as private SQLite BLOBs. It also records the exact package attached to a job and named-provider access grants. The local compiler receives the specification and writes a private temporary directory; completed/failed work directories are removed. CAD compilation does not call an AI provider.

When an operator configures OpenAI and a participant explicitly enables and requests AI assistance, that project's idea, current structured brief and the participant's instruction are sent to the OpenAI API. A CAD proposal request also includes the saved declarative CAD specification, if attached. Account email, session secrets, other participants' projects and uploaded CAD files are not included. CAD proposals, summaries and questions are stored privately with the source revision and usage record. Requests use `store: false`; this does not promise that the provider has no other retention or abuse-monitoring obligations. Consult [OpenAI's current data controls](https://developers.openai.com/api/docs/guides/your-data) and the operator's terms. The manual Studio workflow sends no data to an AI provider.

No advertising analytics, cross-site cookies or external font services are bundled. Rate limiting uses hashed IP keys in bounded process memory, not an advertising profile. Reverse proxies and hosts may retain their own access logs according to the operator’s configuration.

## Visibility

- Provider profiles, approved library models and public project briefs are public. Closed public briefs remain accessible by URL even after leaving the open project board.
- A direct request is visible only to its customer, targeted provider and necessary moderator/assigned access as implemented; the instance operator has technical server access.
- A customer attachment is downloadable by its owner and chosen provider. No blanket moderator API exposes private project files. Library-submission files can be inspected by moderators for publication review.
- A confirmed CAD package is separate from an ordinary uploaded attachment. The recipient of a direct request receives access when it is sent. For a public request, the owner can give a named participant in the discussion access for quotation and revoke it before assignment. The accepted provider retains access to the agreed package. Publishing a public brief does not publish CAD files.
- Conversations are scoped to the customer and that provider. Reported message content is available to moderators in the corresponding report context.
- An approved library file is intentionally downloadable by everyone under its recorded license and attribution.
- Optional map tiles contact OpenStreetMap only after the user opens the map. The browser sends its ordinary network information and the instance origin; no private job file is sent to OSM. External provider websites open only when followed.

There is no end-to-end encryption: the operator controls the server, database and backups. Choose an operator you trust. HTTPS protects transport when the instance is correctly configured.

## Browser storage

An HttpOnly cookie holds a random seven-day session token. The interface stores language preference in localStorage, and an account-scoped brief draft and pending parametric dimensions in sessionStorage. These drafts stay on the current browser/tab and are cleared after successful publication; a reloaded selected local file must be reselected. Clear browser data on a shared device if needed. Account credentials are not stored in localStorage.

## Export, changes and removal

Settings provides a JSON export of the signed-in user’s account/profile, own briefs, own offers, own messages, own models and file metadata. Download files separately using your existing permissions. The export does not include password hashes, session tokens or recovery secrets.

The export also includes owned Studio projects, their revisions/confirmations, CAD specifications/build metadata/artifact manifests, CAD AI proposals and AI usage metadata. Binary CAD files are downloaded separately through authorized artifact links. Closing an account removes its Studio projects, CAD proposals/revisions/builds/artifacts and associated CAD handoffs/grants. A late build or AI response cannot restore them. This also ends future server downloads of those CAD packages; participants may already possess copies.

Minimal AI attempt/token metadata and CAD queued/access events remain against the anonymized account for operational history and instance limits. These retained CAD events contain identifiers/timestamps, not specifications or generated files. A brief already published to a manufacturing job follows that job's visibility and retained-agreement rules; accepted agreement text can remain even when its CAD files are removed.

Password changes require the current password and revoke other sessions and outstanding recovery links. An operator can verify an identity request and issue a private single-use recovery link; no automatic recovery email is sent.

Account closure requires a password and is refused while the person has assigned/delivered work, or when it would remove the last administrator. On closure, the application suspends the account, replaces its name/email/password access, revokes sessions/recovery links, hides/clears the provider profile, removes owned library models, anonymizes owned messages and clears public brief text. Eligible unreferenced files are removed. Accepted terms, original offer scopes, ownership IDs and minimal operational records remain as deal history. They may contain text the parties originally agreed to share. This is **account anonymization with retained agreements**, not a promise to erase every trace from other people’s contracts.

Downloaded copies and previously granted content licenses cannot be recalled. Operators control when personal data expires in private backups. After a storage failure, some file cleanup may need retrying. Unreferenced uploads older than 24 hours are cleaned while the app runs; referenced files do not automatically expire.
