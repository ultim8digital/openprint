# Validation record — 0.1.0

Recorded on 2026-11-13. See [OpenPrint CI](https://github.com/ultim8digital/openprint/actions/workflows/ci.yml) for verification tied to repository commits. This is evidence for the checked scenarios, not a certification of the whole service.

## Observed locally

Environment: macOS arm64, Node.js 24.21.0, locked npm dependencies, Chromium through Playwright, and manual browser inspection through Orca.

| Check                                      | Result / evidence                                                                                                                                                                                                      |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TypeScript frontend/server                 | Passed `npm run typecheck`                                                                                                                                                                                             |
| API/domain, files, backups, geometry       | 14 tests passed via `npm test`                                                                                                                                                                                         |
| Production build                           | Passed `npm run build`                                                                                                                                                                                                 |
| Browser discovery / keyboard / mobile / EN | Passed the first Playwright scenario                                                                                                                                                                                   |
| Full customer–provider workflow            | Passed creation of a real browser-generated STL, registration, request publication, pre-quote question, offer, exact acceptance, authorized file download, provider delivery, customer completion and JSON data export |
| Maker/author/moderator workflow            | Passed profile edit, explicit-rights model upload, pending state, moderator approval and public-library appearance                                                                                                     |
| Automatic accessibility                    | axe reported zero violations on the overview at desktop and 390px mobile width, including contrast; this is not a full-site WCAG audit                                                                                 |
| Third-party calls                          | The discovery/navigation scenario observed no compulsory third-party requests with the map closed                                                                                                                      |
| Dependency advisory check                  | `npm audit --omit=dev` reported zero known vulnerabilities at the recorded time; it does not prove absence of defects                                                                                                  |
| Manual responsive inspection               | Overview inspected at 1440px and 390px; 390px document width matched viewport width                                                                                                                                    |
| Container                                  | Docker is not installed on the local Mac; the repository CI builds and smoke-tests the container, including cold restart, on Linux                                                                                     |

## What the automated tests prove

`tests/platform.test.ts` exercises actual HTTP requests, cookies and a temporary SQLite/file store, including:

- registration, real sessions, server roles, logout and Origin rejection;
- Unicode case-insensitive maker/project city search, including Cyrillic;
- stale revisions, immutable terms and concurrent selection of different offers;
- private briefs and denial of attachment reads before/after assignment for unrelated users;
- provider delivery followed by customer-only completion;
- 512 messages, access to old/new pages and a bounded read cursor;
- original model rights, private pending files and moderator publication;
- expiring one-use recovery and session revocation;
- admin activation only on redemption of an operator-issued token, with old-session revocation;
- account-removal refusal for active deals and explicit retained-history anonymization;
- malformed files, ownership, referenced-file cleanup protection, private export;
- a stopped-instance database/files backup, integrity check, file-hash check, restore, and corrupted-file rejection.

`tests/parts.test.ts` checks positive valid dimensions, rejected impossible walls/heights, exact money parsing, closed two-face edge incidence and analytical volumes for block, drilled plate and tube meshes.

The three browser tests use an isolated fictional database and the built frontend, not mocked fetch results. Test artifacts and private tokens stay outside version control.

## Not established by these checks

No physical model printing, actual commercial deal, public adoption, production traffic benchmark, multi-process load test, independent penetration test, manual screen-reader evaluation, native iPhone/Android check, Safari/Firefox automation or complete locale/content review has been performed. The optional external OSM tile service is not guaranteed to be available. Real deployment DNS/TLS, operator recovery procedures, backup scheduling and off-site restoration depend on each installation.

The initial overview does not load Three.js or Leaflet. The lazy Three.js chunk is approximately 153 KB gzip in this build and still produces Vite’s >500 KB raw-chunk warning. This is disclosed rather than hidden; no measured Lighthouse/Core Web Vitals claim is made.

See [PRODUCT.md](PRODUCT.md), [SECURITY.md](../SECURITY.md) and [SELF_HOSTING.md](SELF_HOSTING.md) for scope and operating boundaries.
