# Validation record — OpenPrint 0.2 / Neofab Studio and CAD

Recorded on 2026-11-15. See [OpenPrint CI](https://github.com/ultim8digital/openprint/actions/workflows/ci.yml) for verification tied to repository commits. Local checks below passed; the new CAD-enabled Linux/container CI run is pending at the time of this record. This is evidence for the checked scenarios, not a certification of the whole service.

## Observed locally

Environment: macOS arm64, Node.js 24.21.0, locked npm dependencies, Python 3.12 in a fresh project virtual environment, CadQuery 2.8.0 with pinned runtime dependencies, and Chromium through Playwright. Earlier manual Studio inspection through Orca is dated separately below.

| Check                                      | Result / evidence                                                                                                                                                                                                                              |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TypeScript frontend/server                 | Passed `npm run typecheck`                                                                                                                                                                                                                     |
| API/domain, files, backups, geometry       | 38 tests passed via `npm test`: the prior 27 community/Studio tests plus 11 CAD tests                                                                                                                                                          |
| Production build                           | Passed `npm run build`                                                                                                                                                                                                                         |
| Browser discovery / keyboard / mobile / EN | Passed the first Playwright scenario                                                                                                                                                                                                           |
| Full customer–provider workflow            | Passed creation of a real browser-generated STL, registration, request publication, pre-quote question, offer, exact acceptance, authorized file download, provider delivery, customer completion and JSON data export                         |
| Maker/author/moderator workflow            | Passed profile edit, explicit-rights model upload, pending state, moderator approval and public-library appearance                                                                                                                             |
| Neofab template handoff                    | Passed manual FDM brief, dirty-edit confirmation gate, confirmed JSON packet, exact downloaded STL SHA-256, one published job and frozen reload                                                                                                |
| Neofab mixed-process handoff               | Passed furniture BOM with wood/metal processes, retained questions/assumptions and unknown component quantity, no fabricated geometry, direct request and denial of unrelated-user access                                                      |
| Native CAD runtime                         | A fresh project Python environment installed the pinned requirements and passed `worker.py --check`; the plate and three-part shelf compiled and their actual files passed the server schemas/manifests/SHA-256 checks                         |
| Native geometry tests                      | 26 passed, 2 skipped locally; both skipped tests cover Linux-only parent-death/startup-race behavior. Linux execution remains pending CI                                                                                                       |
| CAD browser flows                          | Two CAD flows passed: manual editing/versioning and a real-CadQuery assembly build, preview, exact-version rebuild and provider handoff. The full seven-flow browser suite passed using the fresh project runtime                              |
| Automatic accessibility                    | axe reported zero violations on the checked overview/Studio views and CAD desktop/mobile views; this is not a full-site WCAG audit                                                                                                             |
| Third-party calls                          | The discovery/navigation scenario observed no compulsory third-party requests with the map closed                                                                                                                                              |
| Dependency advisory check                  | `npm audit --omit=dev` on 2026-11-15 reported zero known vulnerabilities; absence of advisories does not prove absence of defects                                                                                                              |
| Manual inspection                          | On 2026-11-15, Orca created a fictional shelf project, loaded the three-part sample, saved CAD at project version 3 and completed a native build with history/files visible. On 2026-11-14, overview and Studio were inspected at 1440px/390px |
| Container                                  | Docker is unavailable on the local Mac. The new optional CAD image, Linux resource limits and restart smoke checks are configured in CI; their release result is pending and must be read from the linked workflow                             |

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

`tests/studio.test.ts` covers real HTTP/session ownership, whole source-idea preservation within the accepted length, CAS, confirmation history, preserved unresolved questions, exact immutable STL bytes, concurrent publication and rejection of changed publication parameters. It also checks non-FDM workshop matching, complete mixed-process handoff, history limits, additive migration and reopening, export/account closure, and retained usage after a project is deleted.

`tests/cad.test.ts` exercises actual HTTP sessions and SQLite with an injected deterministic compiler transport. Its eleven tests cover strict schemas; ownership/Origin/version conflicts; request replay; exact confirmed artifact handoff; direct recipients, quotation grants, revocation after profile unpublication and accepted-provider access; stale completion; editing a confirmed CAD revision; cancellation/timeouts; persistent attempt and storage limits; rejected missing/tampered/spec-mismatched/mesh-mismatched artifacts; account deletion during a build; queued restart and interrupted work; CAD BLOB backup/restore; and v2→v3 migration with existing confirmations. These transport fixtures establish application state and permissions, not native geometry correctness.

The separate Python suite runs the actual CadQuery/OpenCascade kernel: analytic volumes, STEP round-trip, distinct assembly components and transforms, extrusion/fillet/chamfer, intersections, declared missing geometry, bounding boxes, mesh indices, artifact hashes, strict input limits, CSV formula protection and atomic CLI failure. `scripts/cad-check.mjs` compiles the actual plate/shelf examples and passes their files through the Node validator. Passing a geometric check does not establish physical strength, manufacturability or completeness of the declared design.

AI tests inject a deterministic test transport into the real server. They check the fixed Responses endpoint, strict schema, selected model, explicit consent, request deduplication, attempt limits, two-call instance concurrency, provider refusal, timeout, incomplete response, stale edits/confirmation, withheld invented dimensions and account closure while a call is running. They establish application behavior under these fixtures, **not live model quality or provider availability**. The earlier validation on 2026-11-14 used the actual `database.ts` from the original 0.1 implementation to create a v1 database; v2 migration and reopening preserved existing data and passed SQLite foreign-key checks. The current CAD suite separately covers v2→v3 migration.

All seven browser tests use an isolated fictional database and the built frontend, not mocked application fetch results. The native assembly flow requires `CAD_PYTHON`; it ran with the actual project-local runtime in this validation. A run without that runtime executes six tests and skips the native assembly flow; it must not be reported as seven executed flows. `OPENAI_API_KEY` is explicitly empty in the browser-test server environment. Test artifacts and private tokens stay outside version control. Formatting and `git diff --check` also passed.

## Not established by these checks

No physical model printing, actual commercial deal, public adoption, production traffic benchmark, multi-process load test, independent penetration test, manual screen-reader evaluation, native iPhone/Android check, Safari/Firefox automation or complete locale/content review has been performed. The optional external OSM tile service is not guaranteed to be available. Real deployment DNS/TLS, operator recovery procedures, backup scheduling and off-site restoration depend on each installation.

No live paid OpenAI call was performed. No API key was configured in this workspace. Manual declarative CAD and assembly generation are implemented and checked as described above. AI-generated CAD, arbitrary STEP import into editable feature history, CAM/G-code, FEA, machine-profile validation, automatic multi-agent task routing, monetary budget accounting and multi-provider work orders are not implemented. Configuring a model name and receiving a structured test response do not establish that the selected model is available to an operator or that its engineering output is correct.

The initial overview does not load Three.js or Leaflet. Three.js is loaded with the relevant tools/CAD preview and still produces Vite’s >500 KB raw-chunk warning. No measured Lighthouse/Core Web Vitals claim is made. Native-process resource limits are not evidence of a complete filesystem/network sandbox, especially on macOS where the Linux virtual-memory cap is not applied.

See [PRODUCT.md](PRODUCT.md), [SECURITY.md](../SECURITY.md) and [SELF_HOSTING.md](SELF_HOSTING.md) for scope and operating boundaries.
