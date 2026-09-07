# Implementation and acceptance status matrix

Snapshot date: **2026-09-07, after the 17:06 UTC artifact audit**. All **58 backlog requirements and 84 acceptance cases** from the separately extracted handoff are retained. Current counts are **39 passed, 0 failed, 13 blocked and 6 not_run backlog rows**, and **75 passed, 0 failed, 4 blocked and 5 not_run acceptance rows**. Passing local checks do not establish production readiness.

## Source preservation and method

The original `OT_CENTER_CODEX_HANDOFF_2026-09-07/data/backlog.csv` and `data/acceptance_cases.csv` remain unchanged. The two status CSVs preserve every source ID, row order and source-column value. Only the original `status` heading is renamed `source_status`; four appended columns contain `implementation`, `status`, `evidence` and `limitations`.

The bundled Artifact Tool imports the sources, authors the matrices and checks them before UTF-8 CSV export with BOM, comma delimiters and quoted multiline-safe fields. Validation compares all source cells, all 58/84 unique IDs, permitted statuses and a full import/export round trip. No formulas, account credentials, raw personal records, verification tokens, PDF contents or private source prices are introduced. The final export passed these checks; rendered review samples cover changed B48/B50/B52 and T029/T076/T079 rows. Full text remains in the CSV.

- `passed`: the requirement was actually verified at its stated service, HTTP, browser or artifact scope, with limits identified.
- `failed`: a listed check ran and remains unsuccessful.
- `blocked`: missing external configuration, approved content, human review or provider capability prevents completion; implemented portions remain described.
- `not_run`: the exact composite scenario or required final scope is incomplete, even when narrower related checks passed.

Counts describe requirements, not tests. Several tests may support one case; one browser sequence may support several cases. Historical source statuses are never counted as implementation results.

## Current analytics and observability package

The source test, browser, compiled-runtime and artifact checks below are separate evidence. A successful source test is not relabelled as a hosted or browser run.

| Scope | Actual result | Evidence |
| --- | --- | --- |
| Complete source regression after the handled-auth-status fix | **144/144 passed**, zero failures/skips, 38.84 s, exit 0. Full lint and final Nuxt typecheck passed. | `implementation-analytics-release-tests.log`, `implementation-analytics-release-typecheck.log`. The preceding 143-test run predates the additional 401 regression. |
| Five browser suites, Node `cb3895e4-c572-4c0d-8891-2345381742f4` | Classic 8, auth 6, contact 2 locales, learner 11, staff 13, all passed at 16:59:27 UTC. Separate synthetic DB and disabled external delivery. | `artifacts/core-browser/f11f680f-e518-4640-aaa6-0205bc80f4df/report.json`. This artifact precedes the narrow handled-auth logging fix. |
| Client analytics and administrator report, Node cb3895e4 | **16/16 passed**: all eight client event names, consent/no-consent/revocation, allowed payloads, actual admin sign-in/TOTP, 19 report rows, UTC retention boundaries and learner denial. | `artifacts/analytics-browser/2bd3d1af-f545-4e05-bfa5-550b22aafd59/report.json`, `docs/ANALYTICS_CLIENT.md`. |
| Compiled HTTP/log sample, final Node `c4d9bf39-890d-4f44-8562-0075ce696d08` | **28/28 passed**, exit 0, 36.841 s, completed 17:03:09 UTC. Fifteen negative responses produced fifteen `api_error` increments, including actual auth 401; two autosave failures and 17 closed-schema logs were observed. No private canaries in 14 categories appeared in the checked samples. | `artifacts/privacy-runtime/6d6e3e21-a4e0-492b-a73e-d3157667271b/report.json`, `docs/RUNTIME_PRIVACY_AUDIT.md`. |
| Final Node c4d9bf39 and Vercel `05782487-f284-4714-bebc-e8828c7859e3` | Both builds exited 0. Each contains **550 public pages, 551 HTML including GSC, 16,976 asset references, zero missing resources and one build ID**. No private prerender. | Build checks recorded in `IMPLEMENTATION_STATUS.md`; current artifact audit below. |
| Complete final public bundle audit, 17:06:52 UTC | All **93 JS and 6 CSS files**, 99 identical paths/SHA256 per artifact; 93 AST parses, 1,209 public text files and **113 exact private canaries with zero matches**. No maps. | `artifacts/privacy/public-bundle-audit-c4d9bf39-05782487.json`, `docs/PUBLIC_BUNDLE_AUDIT_2026-09-07.md`. |

The initial compiled runtime sample on cb3895e4 was **25 passed / 1 failure**: Better Auth correctly returned 401, but H3 still exposed event status 200 before unwrapping its Web Response, so the observer missed that failure. This was missing telemetry, not evidence of a secret leak. The wrapper now copies only the returned status into the event and returns the original Response. A real wrong-password test preserves the SDK body and cookie behavior while requiring one safe log/counter. The focused 19-test suite passed, and the new compiled 28-test run closed the original failure. Failed evidence remains in its original report.

**B48 is now not_run for its full scope.** Eight optional client events and eleven confirmed server event types are connected to actual actions, with strict dimensions, deduplication, retention and an MFA-protected aggregate report. Server transitions use committed domain/audit facts; actual 2-seat and 100-seat invoice confirmations produce one payment event per invoice and one activation per seat, including replay and retention tests. Optional analytics failures do not roll back learning or mandatory audit. Full landing→consultation→CRM attribution and its funnel are not implemented/verified. Different browser and server populations are labelled explicitly, with `conversionRate=null`; the working aggregate is not declared complete attribution. This is a remaining engineering scope, not an invented dependency on an external analytics account.

**B52 remains blocked for complete production operations.** Migration 010 adds nullable request/correlation metadata to audit/outbox history. Generated IDs and `AsyncLocalStorage.run` isolate concurrent HTTP operations and per-job delivery spans; closed structured logs, controlled error bodies and bounded API/autosave counters passed source and actual compiled checks. External alert recipient/channel, SMTP, hosted scheduling and production failure injection remain unconfigured/unverified. **T076 passes at its actual local sample scope**; real provider/SMTP/hosted logs were not examined. Successful owner auth/learning DTOs are excluded from the negative-response scan, while their private canaries are still searched in stdout.

**B50 and T029 pass for the new local artifacts.** Manual review of positive signatures found only an empty `correctOptionIds` array and four lazy staff-editor member accesses in `DxmIlFk3.js`; `DV4hE_NC.js` retains the guarded optional `async_hooks` helper. Neither is an embedded answer bank. Auth/learning data remains server-authorized. No genuine provider-secret values were available for exact comparison, and hosted CDN files were not audited. Earlier performance measurements retain their earlier build IDs; the new bundle scan is not a new timing or capacity measurement.

The CI classic guard fixes the reviewed Git blobs of `HomePageClassic.vue` and its actual `pages/index.vue` route at commit 413ad4a, with no automatic baseline refresh. Its new browser suite passed **eight RU/KK viewport cases** on cb3895e4 and checked the existing structure, selected computed styles, nine historical links, six format cards, grid columns, logo and overflow. RU 1440 and KK 360 screenshots were viewed. This is source/structural/style protection, **not pixel-diff**; see `docs/CI_CLASSIC_PRESERVATION.md`. The new GitHub run has not yet executed at this snapshot.

The separate keyboard-only learner pilot on Node4855f35b completed **6/6 stages**, 18 focused controls and eight genuine API mutations without mouse or focus bypass (`docs/KEYBOARD_LEARNING_PILOT.md`). **T079 remains not_run** because screen-reader smoke is still missing. AX data and accessible locators do not establish screen-reader speech or virtual-cursor behavior.

The current full test run also verifies encrypted backup/restore of schema **001–010**, including correlation metadata, and a populated **005→010** additive upgrade with unchanged old values, NULL new metadata, FK/integrity and immutable triggers. These are distinct from the earlier timed 001–005 CLI drill and old6aa read/refusal experiment. Neither old-runtime write rollback nor compatibility with schema010 is claimed as tested; B53/T083 remain not_run.

No new remote CI, hosted readiness, provider delivery or production deployment result is inferred from this package's local results. The following sections retain historical evidence with its original artifact and schema scope.

## Previous operational package evidence

That package's full local test command finished **124/124 passed, zero failures/skips, exit 0, 34.22 seconds** (`implementation-staff-workflows-124-tests.log`), including the populated schema005→009 upgrade regression. The preceding 123-test run also passed. Full ESLint and final sequential/prepush Nuxt typecheck passed. Two earlier runs stopped on Windows EBUSY while deleting an artificial negative-FK fixture; only its lifecycle was corrected, while real file-backed FK tests remain. The earlier typecheck with implicit-any errors in rollback scripts is also excluded from passing evidence.

These independent browser runs exercised Node **c76fd093-af00-4e6b-9b68-b69a40dc2480**, each on a separate synthetic database:

| Run | Actual outcome | Evidence |
| --- | --- | --- |
| Core portable launcher, port 3105 | Auth 6; contact 2 locales; learner 11; staff 13. Four suites passed, exit 0. | `artifacts/core-browser/e0a5a852-aed2-40aa-8217-8f39a92c4fdb/report.json`, 15:37:02 UTC. |
| Document operations, port 3103 | 20/20 checkpoints, exit 0, zero JavaScript errors. | `docs/DOCUMENT-OPERATIONS-PILOT.md`, `artifacts/document-pilot/report.json`, 15:36:18 UTC. |
| Organization report/reminders, port 3104 | 13/13 checkpoints, exit 0, zero JavaScript errors. | `docs/ORGANIZATION_REPORT_AND_REMINDERS.md`, `artifacts/organization-report/report.json`, 15:34:34 UTC. |
| Additional acceptance, port 3106 | Eight scenarios plus JavaScript check: 9/9, exit 0. | `docs/ACCEPTANCE_EXTRA_BROWSER.md`, `artifacts/acceptance-extra/report.json`, 15:57:14 UTC. |

Authentication and MFA were actual UI flows. The document pilot began with users and a published synthetic version only: no enrollment, completed lesson, practice, attempt, template, credential or render job was seeded. Subsequent mutations used UI controls; SQL observations were SELECT-only. Specialized fixtures explicitly identify seeded facts and controlled time changes. Contact responses were intercepted for validation/error/retry, so those locale checks do not prove actual CRM delivery.

The learner suite was additionally rerun against the final clean Node artifact **4855f35b**: **11 passed, exit 0**, finished 15:52:24 UTC. Evidence is `artifacts/core-browser/e27e7ba2-5360-4350-8bc7-4166c8ad961a/report.json`. The other suites retain their exact c76 scope; their JavaScript assets are identical to the final build.

The extra run closes T008/T010/T020/T051/T062/T063 locally: KK/Astana/program survives selection and authentication; home/catalog preserve an active attempt; controlled expiry of the actual session yields 401 and reauthentication restores answers/deadline; a real order remains created without access after `/success?paid=true` returns 404; verification exposes exactly six safe fields with private-cache/robots headers; bad-token enumeration reaches a uniform 429 after 29 invalid 404 responses. Session expiry used a controlled test timestamp, not a wait for its full lifetime.

The final repeated extra run also closes T033/T040 with a new independent 390px Chromium context and an actual separate server session. Completed lesson/pinned version and the active form/order/deadline/answers matched the first session, which remained usable. This proves independent browser-session continuity; it does not claim two physical devices were used.

## Prior operational requirements evidence

B42 now has direct report evidence beyond the earlier invoice example. Independent access, required-learning, practice, latest-exam and document states use real denominators. Browser checks cover an empty organization, 71 assignments, 62 members, 60 invitations, paging, filtered CSV and RU desktop/KK 360px. Service tests cover 520 assignments and more than 100 organizations. CSV is complete up to 5,000 rows; larger results return explicit 413 with a real count and filter guidance. A single program above that bound still needs a future export job. No silent truncation or invented compliance percentage is accepted.

B43 now has a complete local operator pilot: role grant/revoke, practice selectors/evidence, server exam, queue failure/retry, repair, owner PDF/QR, withdrawal/reissue, incident acknowledgment/recovery, support-note correction history, batch preview/confirmation with duplicate reuse, and intake close/reopen. These support its local passed status. Provider reconciliation, actual issuer templates and external production channels remain separate limitations.

The pilot found two product defects. The instructor form required an undiscoverable raw lesson ID; it now selects assignments and practical lessons from the exact pinned version. PDF flattening left six dangling annotation references; cleanup now removes unresolved/form-widget references while preserving valid annotations and painted content. Seven repair tests and the repeated full pilot verified the fix. Two actual downloaded PDFs passed pypdf/Poppler structure checks, Cyrillic extraction and QR image decoding; both PNGs were visually reviewed. The original file hash and academic history survive replacement. These documents are explicitly synthetic and have no qualification validity.

Migration 008 stores intake separately from immutable program history. New self/staff/org enrollment, order and invoice creation check current state inside their transaction. Prior idempotent replays and accepted learning/invoice obligations continue. Three tests and the UI pilot verified closing intake, completing existing work and reopening it. Old writers that ignore intake are unsafe for live rollback.

B44 has working in-app reminders with explicit planned dates, IANA/DST, offsets, revisions, deduplication, cancellation, missed windows and opt-out. Nine service tests and the report/reminder browser verify this. No legal certificate-validity period is calculated. Actual SMTP delivery and Vercel scheduling remain unconnected/unverified, so the complete external-operation requirement stays blocked.

B52 has bounded incident detection, redacted counters, scoped in-app alerts, MFA acknowledgment, source-aware resolution and retry. The pilot exercised the operator path; seven tests include rejected-webhook audit without raw payloads/signatures. No expected external alert was sent to the owner. B52/T081 remain blocked for recipient/channel configuration and production failure injection. T052/T065 pass only for implemented internal sandbox/transport and visible durable incident behavior; an official payment provider remains unconnected.

## Prior build, HTTP and privacy evidence

Final sequential cold Node **4855f35b-6913-4002-a0fa-7c87ad77c0a7** and cold Vercel **ca57b6d3-18bb-45e9-93e2-afaf737785b9** both exited 0 and passed the strict gate: **550 public HTML plus one Google verification file, 15,797 asset references, one build ID and zero missing resources**, with no private prerender.

The earlier Node c76 directory acquired an unrelated metadata file during parallel Nuxt typecheck and failed its artifact-ID gate. That failed gate was retained and closed by the new sequential build. Functional browser evidence still names c76; its JavaScript files have identical paths/SHA to final Node/Vercel. Browser success and artifact integrity are separate evidence, not interchangeable claims.

Full HTTP inventory repeated on c76 at **15:39:21 UTC** passed **550 public pages, 10 private header checks, 6 true404s, sitemap550, canonical/hreflang and robots** (`artifacts/seo/http-contract-all-report.json`). Local responses do not prove hosted CDN isolation or production DNS/aliases.

The final audit `artifacts/privacy/public-bundle-audit-4855f35b-ca57b6d3.json` checked **89 JavaScript and 5 CSS files per artifact**, identical paths/SHA, 89 parsed ASTs and 1,204 public text files each. **102 exact private canaries had zero matches**; maps were absent and both artifact identity gates passed. Positive `correctOptionIds` signatures are an empty array and four lazy staff-editor member accesses, not embedded answers. Privileged APIs enforce authorization independently of downloadable UI. No real-provider secrets were available for exact comparison; this is not universal proof against transformed secrets.

The previous explicit-noindex build remains separate evidence (`docs/PREVIEW-NOINDEX-QA.md`, 84765834): 550 public pages, sitemap550, 15,770 resolved references, noindex/nofollow and robots Disallow:/. Default indexable checks remain strict. Noindex preview intentionally disallows crawling; robots is not authentication.

## Prior design and performance evidence

The valid visual review retains 52 responsive pages, eight HomePageClassic comparisons, six explicitly identified CSS-zoom checks and two keyboard/name/error checks. HomePageClassic and the brand were preserved.

The earlier 6aa performance experiment measured 12 public baseline/after navigations, one terminal exam view and 100 GET requests at concurrency10, all successful. Health p95 was 76.63 ms and catalog p95 108.07 ms. Its terminal shift near 0.18 is a historical finding that was subsequently reproduced and addressed.

`docs/LMS_NAV_LAYOUT_LAB.md` records two narrow CSS corrections. Candidate718c3f06 passed **32/32 GET-only navigations**; 16 controlled font-swap cases stayed within1 CSS pixel, and 101 loaded KK header widths retained their geometry. Natural RU390 terminal shift changed0.18025→0.00055; KK360 changed0.19926→0.00884; final maximum observed sum was0.03620. These are single-run local observations and controlled geometry checks, not field CLS/INP/CWV, active-exam load or remote capacity evidence. Native zoom, screen-reader acceptance and human KK/SME review are not certified by these checks.

## Prior backup and rollback evidence

Five backup tests passed with actual restoration of schema001–009 tables/rows, including reminders, intake, support notes and batches (`implementation-backup-nine-migrations.log`). The separately timed older CLI restore on schema001–005 remains historical; its timing is not relabelled as a new remote restore.

`docs/ROLLBACK_DRILL.md` and `artifacts/rollback/report-2026-09-07T15-44-09-935Z.json` record **15/15 local operations**, exit0. Old6aa completed six protected GET requests with the current synthetic HTTP session on a schema001–009 copy. Of43 tables,42 were unchanged; only the expected Better Auth rateLimit counter changed. Eight unsupported-feature/unknown-migration/checksum cases were blocked before old-runtime startup.

Live write rollback remains blocked: old6aa ignores features006–009. The runtime diagnostic seeded current schema, copied/restored it and reapplied migrations. A separate actual populated schema005→009 upgrade regression subsequently passed **1/1, exit 0**, preserving data, documents and constraints (`tests/migration-upgrade.test.ts`, `artifacts/migration-upgrade-tests.log`). These are distinct upgrade/read/restore tests. B53/T083 retain not_run for the complete rollback scope, with live write rollback blocked and the successful local components stated explicitly. Production/remote RTO/RPO remain unverified.

## Prior hosted release scope

The operational release commit **cc6b662535853196fd2f6404f7c2439c33f69ee3** was pushed and [Quality34141297253](https://github.com/shalinivan9669/sertificate/actions/runs/34141297253), job101803650908, completed **success**. Its downloaded logs confirm **124/124 tests, zero failures/skips,22.44s**, audit0, install/lint/typecheck, Node/SEO/assets, installed Chromium and all four isolated browser suites (auth6/contact2 locales/learner11/staff13, CI runtimeab79c6a4), followed by the Vercel build. This is remote CI on a synthetic local SQLite database, not a remote production database test.

Its [Vercel deployment2mSGsQqBF](https://vercel.com/shalinivan9669s-projects/sertificate/2mSGsQqBFsn5VuexFzCq1fNgxKD1) reached **Ready in1m18s**. The authorized browser opened the classic homepage, catalog20 and ISO9001RU/KK with request-only pricing on [the cc6b662 preview](https://sertificate-czv7s2iyb-shalinivan9669s-projects.vercel.app/). The project's Storage page still lists no databases; the Turso terms step remains pending owner input. These public-page observations do not close hosted LMS readiness, email or CRM delivery. Subsequent documentation-only commits do not alter this runtime evidence.

The prior [GitHub Quality run 34133936157](https://github.com/shalinivan9669/sertificate/actions/runs/34133936157), job 101780349554, passed for commit **8f68**, including **93/93 tests, zero failures/skips, 12.67 seconds**. The earlier [run 34132591085](https://github.com/shalinivan9669/sertificate/actions/runs/34132591085) also passed for1e23fc58. These historical results apply only to their respective commits in [draft PR2](https://github.com/shalinivan9669/sertificate/pull/2); the current operational package has its own result above.

The latest prior 8f68 [Vercel preview](https://sertificate-cw86taz0z-shalinivan9669s-projects.vercel.app/), deployment FH8NyJt2YuKJnsPSkHMfyF1Tpvwr, reached Ready in 1m12s. This is separate from both the earlier public-page observations and the current local operational artifacts.

The earlier protected Vercel preview reached Ready and four public pages were viewed. Its KK cabinet showed request-error/retry, /api/ready was blocked by the client and external requests encountered Vercel SSO. These are not hosted account/readiness passes; protection was not bypassed. The existing production public host answered a read-only redirect/200 check; main was not updated with this LMS.

Production DB/Auth/SMTP, region/retention decisions, official payment adapter, hosted readiness/cache/cron, approved materials/document templates and human KK/SME review remain concrete limits. The owner already authorized deployment after checks and confirmed the center's permissions; these matrices do not reopen legal-entity permission checks. Deployment permission does not replace service readiness, real-payment authorization or mass-mail authorization.
