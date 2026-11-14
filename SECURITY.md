# Security policy

OpenPrint 0.1 is intended for a small self-hosted community. This repository includes security-relevant tests, but has not undergone an independent penetration test or public load assessment. Run a maintained release and test backups before public use.

## Report privately

Use GitHub’s **Security → Report a vulnerability** for this repository when available. Do not publish exploitable details, real customer files, tokens or database dumps in a public issue. If private reporting is unavailable, contact the repository owner through their published GitHub profile without attaching sensitive evidence to a public thread.

## Implemented boundaries

- Server-owned roles, no first-user admin, no role grants from profile metadata.
- CLI-issued, hashed, expiring, single-use setup/recovery tokens. Administrator promotion occurs only at redemption together with password replacement and session revocation.
- Scrypt password hashes and opaque random session tokens stored hashed in SQLite. HttpOnly/SameSite cookies; Secure under an HTTPS `APP_URL`.
- Exact Origin checks on writes, JSON-only ordinary mutations, no wildcard CORS, bounded request bodies and in-process throttles. Throttles reset on process restart and are not distributed DDoS protection.
- Server validation, parameterized SQL, explicit ownership/participant checks, private attachment downloads and scoped moderator access to submitted library files.
- Immutable offer revisions, a single accepted offer and transactionally recorded agreement terms.
- No server unpacking of uploaded archives, no inline rendering of uploaded SVG/HTML, attachment disposition and `nosniff`.
- CSP, denied embedding, reduced permissions and HTTPS HSTS when configured.
- Neofab Studio checks project ownership on every operation, uses optimistic version checks and records a hash of the confirmed brief. Published snapshots are frozen.
- Optional OpenAI requests use a fixed server-side endpoint, bounded inputs/outputs, persistent attempt reservations, per-project/user/instance limits and idempotency keys. No model-generated program is executed. Schema-valid output remains an unconfirmed proposal.
- AI assistance cannot publish a brief, accept an offer or command equipment. These transitions require explicit application actions and server checks. Matching uses declared maker capabilities; it does not certify a machine or a material.

## Operator responsibilities and limits

Use HTTPS, a dedicated unprivileged user, private local storage, a correctly configured reverse proxy and supported Node.js 24. Keep the demo on loopback without a public proxy. Update dependencies/OS, protect backup storage, set an operator contact, define recovery identity checks, and test actual restores.

The operator can access database/filesystem data; there is no end-to-end encryption or application-level storage encryption. Email identities are self-asserted without automatic verification. Uploaded CAD files receive bounded header checks, not antivirus or complete format validation. Open them using a suitable isolated workflow for untrusted files. Model geometry and moderator badges are not safety or identity certificates.

Instance upload quotas do not cap database, logs, backups or concurrent request memory. Apply appropriate host/proxy resource limits for your deployment. SQLite runs in WAL mode on local disk and this version supports one app process; do not horizontally scale it or use a shared network filesystem.

Account closure retains accepted deal terms and minimal historical records as explained in [PRIVACY.md](PRIVACY.md). It cannot revoke existing model-license grants or files that participants have already downloaded.
