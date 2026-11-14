# Data handling / Работа с данными

This document describes the application’s behavior. Each instance operator must identify their own contact, purposes, applicable obligations and backup-retention policy. It is not a legal determination for every jurisdiction.

## Stored data

The community’s local database stores account names, self-asserted email addresses, password hashes, sessions/recovery-token digests, provider profiles, project briefs, offers/accepted terms, messages, notifications, model metadata, reports, blocks and operational decision events. Uploads are private files outside the web root, with owner, size and SHA-256 metadata.

Neofab Studio stores private ideas, structured requirements, component lists, operations, acceptance criteria, revisions and confirmation hashes. Its AI usage ledger stores model names, attempt status, token counts, request hashes and timestamps. API keys stay in the server environment; they are never stored in project records or sent to the browser.

When an operator configures OpenAI and a participant explicitly enables and requests AI assistance, that project's idea, current structured brief and the participant's instruction are sent to the OpenAI API. Account email, session secrets, other participants' projects and uploaded CAD files are not included. Requests use `store: false`; this does not promise that the provider has no other retention or abuse-monitoring obligations. Consult [OpenAI's current data controls](https://developers.openai.com/api/docs/guides/your-data) and the operator's terms. The manual Studio workflow sends no data to an AI provider.

No advertising analytics, cross-site cookies or external font services are bundled. Rate limiting uses hashed IP keys in bounded process memory, not an advertising profile. Reverse proxies and hosts may retain their own access logs according to the operator’s configuration.

## Visibility

- Provider profiles, approved library models and public project briefs are public. Closed public briefs remain accessible by URL even after leaving the open project board.
- A direct request is visible only to its customer, targeted provider and necessary moderator/assigned access as implemented; the instance operator has technical server access.
- A customer attachment is downloadable by its owner and chosen provider. No blanket moderator API exposes private project files. Library-submission files can be inspected by moderators for publication review.
- Conversations are scoped to the customer and that provider. Reported message content is available to moderators in the corresponding report context.
- An approved library file is intentionally downloadable by everyone under its recorded license and attribution.
- Optional map tiles contact OpenStreetMap only after the user opens the map. The browser sends its ordinary network information and the instance origin; no private job file is sent to OSM. External provider websites open only when followed.

There is no end-to-end encryption: the operator controls the server, database and backups. Choose an operator you trust. HTTPS protects transport when the instance is correctly configured.

## Browser storage

An HttpOnly cookie holds a random seven-day session token. The interface stores language preference in localStorage, and an account-scoped brief draft and pending parametric dimensions in sessionStorage. These drafts stay on the current browser/tab and are cleared after successful publication; a reloaded selected local file must be reselected. Clear browser data on a shared device if needed. Account credentials are not stored in localStorage.

## Export, changes and removal

Settings provides a JSON export of the signed-in user’s account/profile, own briefs, own offers, own messages, own models and file metadata. Download files separately using your existing permissions. The export does not include password hashes, session tokens or recovery secrets.

The export also includes owned Studio projects, their revisions/confirmations and AI usage metadata. Closing an account removes the private Studio projects and revisions. Minimal AI attempt/token metadata remains against the anonymized account to preserve instance rate-limit accounting; it contains no raw prompt or response text. A brief already published to a manufacturing job follows that job's visibility and retained-agreement rules.

Password changes require the current password and revoke other sessions and outstanding recovery links. An operator can verify an identity request and issue a private single-use recovery link; no automatic recovery email is sent.

Account closure requires a password and is refused while the person has assigned/delivered work, or when it would remove the last administrator. On closure, the application suspends the account, replaces its name/email/password access, revokes sessions/recovery links, hides/clears the provider profile, removes owned library models, anonymizes owned messages and clears public brief text. Eligible unreferenced files are removed. Accepted terms, original offer scopes, ownership IDs and minimal operational records remain as deal history. They may contain text the parties originally agreed to share. This is **account anonymization with retained agreements**, not a promise to erase every trace from other people’s contracts.

Downloaded copies and previously granted content licenses cannot be recalled. Operators control when personal data expires in private backups. After a storage failure, some file cleanup may need retrying. Unreferenced uploads older than 24 hours are cleaned while the app runs; referenced files do not automatically expire.
