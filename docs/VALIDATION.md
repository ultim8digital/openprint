# Validation record — Neofab Studio preview on OpenPrint 0.1

Recorded on 2026-11-14. See [OpenPrint CI](https://github.com/ultim8digital/openprint/actions/workflows/ci.yml) for verification tied to repository commits. This is evidence for the checked scenarios, not a certification of the whole service.

## Observed locally

Environment: macOS arm64, Node.js 24.21.0, locked npm dependencies, Chromium through Playwright, and manual browser inspection through Orca.

| Check                                      | Result / evidence                                                                                                                                                                                                      |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TypeScript frontend/server                 | Passed `npm run typecheck`                                                                                                                                                                                             |
| API/domain, files, backups, geometry       | 27 tests passed via `npm test`, including 13 Studio tests                                                                                                                                                              |
| Production build                           | Passed `npm run build`                                                                                                                                                                                                 |
| Browser discovery / keyboard / mobile / EN | Passed the first Playwright scenario                                                                                                                                                                                   |
| Full customer–provider workflow            | Passed creation of a real browser-generated STL, registration, request publication, pre-quote question, offer, exact acceptance, authorized file download, provider delivery, customer completion and JSON data export |
| Maker/author/moderator workflow            | Passed profile edit, explicit-rights model upload, pending state, moderator approval and public-library appearance                                                                                                     |
| Neofab template handoff                    | Passed manual FDM brief, dirty-edit confirmation gate, confirmed JSON packet, exact downloaded STL SHA-256, one published job and frozen reload                                                                        |
| Neofab mixed-process handoff               | Passed furniture BOM with wood/metal processes, retained questions/assumptions and unknown component quantity, no fabricated geometry, direct request and denial of unrelated-user access                              |
| Automatic accessibility                    | axe reported zero violations on the overview and the checked Studio start/confirmed-editor views at desktop/mobile widths, including 390px; this is not a full-site WCAG audit                                         |
| Third-party calls                          | The discovery/navigation scenario observed no compulsory third-party requests with the map closed                                                                                                                      |
| Dependency advisory check                  | `npm audit --omit=dev` reported zero known vulnerabilities at the recorded time; it does not prove absence of defects                                                                                                  |
| Manual responsive inspection               | Overview and Studio inspected at 1440px and 390px. Created, edited and confirmed a fictional furniture brief through Orca, including keyboard submission; no horizontal overflow in the checked mobile view            |
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

`tests/studio.test.ts` covers real HTTP/session ownership, whole source-idea preservation within the accepted length, CAS, confirmation history, preserved unresolved questions, exact immutable STL bytes, concurrent publication and rejection of changed publication parameters. It also checks non-FDM workshop matching, complete mixed-process handoff, history limits, additive v1→v2 migration and reopening, export/account closure, and retained usage after a project is deleted.

AI tests inject a deterministic test transport into the real server. They check the fixed Responses endpoint, strict schema, selected model, explicit consent, request deduplication, attempt limits, two-call instance concurrency, provider refusal, timeout, incomplete response, stale edits/confirmation, withheld invented dimensions and account closure while a call is running. They establish application behavior under these fixtures, **not live model quality or provider availability**. A separate migration check used the actual `database.ts` from the original `origin/main` implementation to create a v1 database; v2 migration and reopening preserved existing data and passed SQLite foreign-key checks.

All five browser tests use an isolated fictional database and the built frontend, not mocked application fetch results. `OPENAI_API_KEY` is explicitly empty in their server environment. Test artifacts and private tokens stay outside version control. Formatting and `git diff --check` also passed.

## Not established by these checks

No physical model printing, actual commercial deal, public adoption, production traffic benchmark, multi-process load test, independent penetration test, manual screen-reader evaluation, native iPhone/Android check, Safari/Firefox automation or complete locale/content review has been performed. The optional external OSM tile service is not guaranteed to be available. Real deployment DNS/TLS, operator recovery procedures, backup scheduling and off-site restoration depend on each installation.

No live paid OpenAI call was performed. No API key was configured in this workspace. Separate CAD-worker integration, generated assembly CAD, CAM/G-code, machine-profile validation, automatic multi-agent task routing, monetary budget accounting and multi-provider work orders are not implemented in this preview. Configuring a model name and receiving a structured test response do not establish that the selected model is available to an operator or that its engineering output is correct.

The initial overview does not load Three.js or Leaflet. The lazy Three.js chunk is approximately 153 KB gzip in this build and still produces Vite’s >500 KB raw-chunk warning. This is disclosed rather than hidden; no measured Lighthouse/Core Web Vitals claim is made.

See [PRODUCT.md](PRODUCT.md), [SECURITY.md](../SECURITY.md) and [SELF_HOSTING.md](SELF_HOSTING.md) for scope and operating boundaries.
