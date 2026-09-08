# OT Center: identity, catalog, learning and assessment

This implementation extends the existing Nuxt site. The nine marketing direction identifiers and their public paths are preserved, and the supplied product inventory adds eleven directions for a total of twenty. The three historical runtime aliases resolve only to their matching direction; unknown identifiers return 404. The registry contains service metadata and consultation guidance, not approved course material, prices, hours or completed learner records. Source mapping and the protected authoring checklist are documented in [CORE_SOURCE_CATALOG.md](CORE_SOURCE_CATALOG.md).

## Deployment and storage

The intended deployment is a Nuxt/Nitro Node function on Vercel with an explicitly configured remote libSQL/Turso database. A free plan is an infrastructure option, not an account or database created by this implementation. Vercel's temporary filesystem is never used as a persistent database: `VERCEL` without a valid remote URL and token produces a 503 response for persistent functions. Public catalog consultation entries remain available without database configuration.

Required environment variables for the deployed identity and learning APIs:

| Variable | Purpose |
| --- | --- |
| `TURSO_DATABASE_URL` | Explicit `libsql://` or `https://` database endpoint |
| `TURSO_AUTH_TOKEN` | Server-only database credential |
| `BETTER_AUTH_URL` | Exact application origin, including protocol; HTTPS in production |
| `BETTER_AUTH_SECRET` | Stable server-only secret, at least 32 characters |
| `SMTP_URL`, `MAIL_FROM` | Transactional email transport and sender |
| `OT_EMAIL_DELIVERY_ENABLED=1` | Explicitly enables transport delivery of queued authentication email |
| `OT_CONTENT_HOSTS` | Comma-separated exact HTTPS hosts allowed for approved media, when used |

The remote path uses `@libsql/client/web` and `drizzle-orm/libsql/web`, so it does not load a native SQLite binary. Local development and isolated tests use an explicit file database, defaulting to `.data/ot-center.sqlite`. Local native libSQL uses its supported `concurrency: 1` option because the Windows native pooled driver reproduced a pending-statement error after concurrent report reads. This local driver setting is not a distributed lock or a claim about remote concurrency. Domain integrity comes from database write transactions, immutable triggers and unique constraints.

Remote schema migrations are explicit release/CLI operations. They do not run on serverless cold starts. `migrate(client)` applies numeric SQL files transactionally and checks already-applied checksums. An applied migration must never be edited. Local isolated databases are migrated on first use. Remote migration and runtime requests have not been exercised against an owner's database or account during this work.

The shared asynchronous database contract is `getDb`, `queryOne`, `queryAll`, `execute`, `withTransaction`, `audit`, and `enqueue`. Every operation inside a transaction must receive its `tx` argument and be awaited. `withTransaction` retries only failure to acquire a transaction; it never replays a callback or a commit whose outcome could be uncertain.

## Identity and administration

Better Auth 1.7 uses its supported password hashing, verification, reset, server sessions, cookie handling and TOTP/backup-code plugin. No application-specific password or session cryptography is implemented. Email verification is mandatory before learning API access. Password reset invalidates existing sessions; logout revokes the old cookie. Roles cannot be selected during registration or supplied by cookies.

Authentication routes are mounted under `/api/auth`. The UI uses `/sign-up/email`, `/sign-in/email`, `/sign-out`, `/send-verification-email`, `/verify-email`, `/request-password-reset`, `/reset-password`, `/two-factor/enable`, `/two-factor/verify-totp` and `/two-factor/verify-backup-code`. `GET /api/v1/auth/config` reports whether authentication and email delivery are configured. A queued verification message is not described as delivered.

The verification callback writes `auth.email` to the same database transaction as Better Auth signup through Better Auth's transaction context adapter. This is necessary: a separate database write from inside signup would contend with the existing transaction, and the auth library deliberately catches email callback errors. Delivery, when explicitly enabled, is scheduled through the Nitro request lifecycle for the specific user whose message was queued. The durable worker can retry later. It never sends mass notifications as a side effect of a request.

`requireUser` checks the real session and reads current database permissions on every protected request. `requireRole` also requires a session whose TOTP or backup-code verification completed within the last 12 hours. Enabling MFA on an account alone is insufficient; old sessions have no assurance. Privileged endpoints require a new code after role changes. Remembered-device bypass is disabled. The persistent authentication limiter ignores arbitrary client-supplied `X-Forwarded-For`; on Vercel it uses the platform-owned forwarding header, and local requests share a conservative per-path bucket.

Roles are `learner`, `editor`, `reviewer`, `instructor`, `issuer`, `finance` and `admin`. An admin can exercise these staff functions after MFA. The first administrator must be an already verified account and must be bootstrapped explicitly from an owner-controlled shell:

```powershell
node --env-file=.env --import tsx scripts/core-admin.ts --bootstrap --email owner@example.com --reason "Owner authorizes initial administrator"
```

This command is unavailable over HTTP, cannot run again once an administrator exists, creates no password and sends no email. The owner signs in and configures/verifies TOTP next. Authenticated administrators can search users through `GET /api/v1/admin/users?query=...` and change another verified user's role through `POST /api/v1/admin/users/{id}/role` with `{role,reason}`. Role changes record an audit event and clear prior MFA assurance. Self-role changes and removal of the last admin are rejected.

## Catalog and publication

`GET /api/v1/catalog/programs` returns `{storageAvailable,programs}`. Each program includes its stable `id`, `directionId`, `slug`, bilingual direction title, preserved `publicPath`, approved `versions`, and `availability` (`published` or `consultation`). `GET /api/v1/catalog/programs/{id}` also accepts a known historical alias. The public DTO never includes lessons' full bodies, question keys or unpublished prices.

Staff content endpoints:

| Method/path | Input | Result |
| --- | --- | --- |
| `POST /api/v1/admin/programs` | `{id,directionId,title:{ru,kk}}` | New program variant under an existing direction |
| `GET /api/v1/admin/program-versions` | MFA editor/reviewer session | Up to 200 actual versions including protected editor data |
| `POST /api/v1/admin/program-versions` | `{programId,data}` | `{version}` in draft state |
| `PATCH /api/v1/admin/program-versions/{id}` | `{revision,data}` | Updated draft; stale writes return 409 |
| `POST /api/v1/admin/program-versions/{id}/review` | `{revision}` | Complete draft enters review |
| `POST /api/v1/admin/program-versions/{id}/publish` | `{revision,evidence}` | Another authorized reviewer publishes immutable content |

`ProgramData` contains `title`, `language`, `audience`, `prerequisites`, `outcomes`, `limitations`, `format`, `durationHours`, `priceMinor`, `currency: 'KZT'`, `accessModel: 'free' | 'manual' | 'paid'`, `documentDescription`, `support`, `sourceRefs`, `reviewedAt`, `modules`, `assessment` and the server-only `questions` bank. A module contains `{id,title,lessons}`. A lesson contains `{id,title,kind:'text'|'practice',required,body,media}`. Body text is rendered as text, never trusted HTML. Images require alt text; videos require a transcript. Media URLs require an explicit allowed HTTPS host, and active HTML/SVG/script file URLs are rejected. This media model does not make an external public URL private; confidential uploads require a separate authorized storage workflow.

Assessment policy has `durationMinutes`, `maxAttempts`, `passPercent`, `questionCount` and `retakeDelayMinutes`. Questions have `{id,text,topic,options:[{id,text}],correctOptionIds}`. Server validation bounds all arrays and text, rejects unsupported properties, duplicate identifiers and invalid option references, and limits a version to 500 KB. Publication requires real sources, required lesson material, metadata and enough questions for the approved form. Editing changes the current author, so modifying another author's draft cannot bypass independent review.

Publication and enrollment do not query or re-check the organization's legal permissions. The owner confirmed those permissions. No invented syllabus or test fixture is silently published as real training.

## Learning

`GET /api/v1/me/enrollments` returns up to 200 actual assignments using two database queries for the entire cabinet: one joined enrollment/version query and one bounded progress query. It does not make a database request per enrollment. A summary includes `{id,status,versionId,programId,title,language,organizationId,progress:{completed,total,percent},accessUntil}`. `GET /api/v1/enrollments/{id}` adds module/lesson metadata with completion revisions, the approved assessment policy, server eligibility reasons, `activeAttemptId` and `latestAttemptId`. Ownership is checked before access; another learner's identifier returns 404. A single public program lookup also queries only that program and its approved versions.

`POST /api/v1/enrollments` with `{versionId}` and `Idempotency-Key` creates an enrollment only for an approved free program whose explicit server price is zero. Staff may create a manual contractual enrollment with `POST /api/v1/admin/enrollments` and `{userId,versionId,accessUntil?,reason,evidence}` plus `Idempotency-Key`. The learner must have a verified email. Paid access is reserved for the separately verified order workflow. `POST /api/v1/admin/enrollments/{id}/activate` activates a pending manual/free assignment with a reason.

`GET /api/v1/enrollments/{id}/lessons/{lessonId}` returns `{lesson,progress}` only for the assigned immutable version and active access. `PUT /api/v1/enrollments/{id}/progress/{lessonId}` accepts exactly `{revision,completed:true}`. Repeating an already saved completion does not increment progress or create another audit event. The learner cannot confirm a practical lesson. `POST /api/v1/admin/enrollments/{id}/practice/{lessonId}` requires an instructor with MFA plus `{evidence,reason}`; an instructor cannot confirm their own practical training.

## Assessment

`POST /api/v1/enrollments/{id}/attempts` accepts JSON `{}` and `Idempotency-Key`. The server checks active ownership, access expiry, completion of required learning/practice, the immutable version, attempt limits and retake waiting time. It snapshots policy, sampled questions and shuffled option order. Reusing the idempotency key or opening another device preserves the same active attempt.

The attempt DTO returned by this endpoint and `GET /api/v1/attempts/{id}` contains:

```text
id, enrollmentId, status, startedAt, deadlineAt, serverTime, revision,
questions: [{id,text,options:[{id,text}]}],
answers: {[questionId]: selectedOptionIds},
result: null | {score,pass,correct,total,gradedAt,topics:[{topic,correct,total}]}
```

The result is a server calculation. The browser never receives `correctOptionIds`, `answerIndex`, scoring keys or protected explanations. `PUT /api/v1/attempts/{id}/answers/{questionId}` accepts `{revision,selectedOptionIds}`; unknown questions/options, stale revisions, late answers and changes to terminal attempts are rejected. `POST /api/v1/attempts/{id}/submit` with JSON `{}` atomically grades once and returns the same immutable result on retries. Wrong option A is not treated as correct.

An expired attempt is finalized with its saved answers by a server read or `expireDueAttempts`, which the worker can invoke with no active browser. Rejection of a late answer commits expiry before returning an error. A successful academic result moves a still-active enrollment to completed; it does not create a payment or a credential. No browser success route, query string, or cookie can alter these states.

## Verification evidence and remaining boundaries

The core suites run through `node --import tsx --test tests/core-domain.test.ts tests/core-auth.test.ts`. They exercise real local libSQL files and actual Better Auth HTTP cookies rather than mock authentication. Their latest individual runs passed 19/19 core domain and 8/8 authentication tests: preserved nine-direction mapping with 20 total directions, hostile return paths, independent content approval, immutability, cross-learner isolation, zero initial progress, practical confirmation, version pinning, stable server question forms, concurrent revision conflict, server expiry, concurrent idempotent grading, real failure/pass outcomes, retake limits, role bootstrap, session revocation, password reset replay, real TOTP, durable rate limiting and the cabinet's two-query budget. Strict targeted TypeScript checks also passed. The separate business suite additionally retains a regression for committing a write after concurrent report reads. These individual run counts are not a claim about the final complete repository suite.

Five additional `tests/core-backup.test.ts` tests passed against actual migrated isolated databases. They check authenticated encrypted round trips, wrong passwords and tampering, exact schema/data/private-document/BLOB restoration, migration checksums, restored immutable triggers and foreign keys, refusal to overwrite a nonempty target, transaction rollback after invalid foreign keys, and rejection of malformed backup inventories. `scripts/db-backup.ts` was corrected to encode BLOB/bigint values explicitly, validate snapshot shape/schema statements, check foreign-key and physical integrity, close the source on failure, and reserve a restore filename atomically with exclusive creation. Decryption and format validation happen before target creation.

The latest actual local CLI restore drill on 2026-09-07 used a read-only snapshot of the synthetic `.data/e2e.sqlite` database. The source connection had `PRAGMA query_only=ON`; its read transaction took 6 ms, and the CLI ran only against a new snapshot copy while browser testing continued independently. Backup completed in 395 ms and restore in 424 ms; all 34 tables and 106 rows, including migrations 001–005, were restored with identical schema and contents from a 55,944-byte authenticated encrypted archive. Separate CLI calls rejected an existing backup filename, an existing restore database, a wrong password and a tampered archive; failed decryption created no target. Restored foreign keys, physical integrity, immutable published versions and append-only audit constraints were exercised. Exact paths, timings and archive hash are in `docs/CORE_RESTORE_DRILL.json`. All outputs are in a new `.data/restore-drill-...` directory; no migration or write ran on the source. The temporary random passphrase was retained only in the drill process; this synthetic artifact is test evidence rather than an operational owner backup. No remote database, real credential or external service was involved. Production rollback, remote restore time and deployed provider recovery remain `not_run`.

`tests/e2e-fixtures.ts` is an explicit, synthetic browser-test seed, guarded by `NODE_ENV=test`, `OT_ALLOW_TEST_SEED=1`, and a local database filename ending in `e2e.sqlite`. It refuses remote databases and Vercel. It is never imported by the application. Its generated login details and test questions are not real users, approvals, training content or issued credentials.

Owner-provided production database/email configuration, real approved course materials and prices, confidential material storage, external provider integration checks and deployed Vercel/Turso concurrency/restore tests remain separate evidence requirements. Production deployment, real payment operations and mass notifications were not performed by this module.

The latest parent-reported complete repository check passed `npm test` **91/91, zero skips, 27.7 seconds**, including the pending-document recovery, FK safety and CRM total-deadline tests; full lint and typecheck passed. The cold Vercel build with `VERCEL=1` / `VERCEL_ENV=preview` passed after cleanup: 550 public pages plus one GSC verification HTML, no private prerender, 15,770 asset references with zero missing files, and one build ID `34a99837-1e71-4025-83a9-2414427497cf`. The Node 24 function has a 60-second duration limit and measures 18.1 MB (4.57 MB gzip). The latest Node build `6aa9fbb6` also passed 550 public pages and all 15,770 asset references without mixed build IDs or missing files. The stale-cache failure is resolved. Latest local browser suites passed learner11/auth6/contact2 locales/staff13, without JavaScript errors; staff used actual MFA without diagnostic bypass. Visual checks passed52 responsive/8 preserved HomePageClassic comparisons/6 CSS zoom/2 keyboard checks; HTTP passed58 public/10 private/6 real404 plus sitemap550 and robots. These bounded local checks do not certify a real remote database, SMTP delivery, deployed CDN behavior, screen-reader acceptance or production readiness. Final performance and remote CI still await their own results.

The local helper `tests/prepare-performance-session.mjs` passed syntax/ESLint checks and was run after the staff suite ended. It requires the explicit test environment and local e2e fixture, refuses Vercel/Turso variables and nonlocal HTTP origins, and reads the database with `PRAGMA query_only=ON`. It selects an existing terminal attempt only for the original fixture learner/version, signs in through Better Auth HTTP, confirms the verified session and protected terminal DTO, then writes ignored Playwright `{cookies,origins}` state and a relative terminal exam URL. The single successful sign-in created an ordinary server session; no SQL bypass or academic write occurred. The lab reader resolves the relative path against exactly the same localhost origin and blocks browser mutations. The helper emits only preparation status, never credentials/cookies/tokens, and a prepared state is not a completed performance measurement.

Primary implementation references: [Better Auth Nuxt integration](https://better-auth.com/docs/integrations/nuxt), [Drizzle adapter](https://better-auth.com/docs/adapters/drizzle), [email/password verification and reset](https://better-auth.com/docs/authentication/email-password), [two-factor plugin](https://better-auth.com/docs/plugins/2fa), and [libSQL Client transaction contract](https://tursodatabase.github.io/libsql-client-ts/interfaces/Client.html). The installed package source was inspected to match the pinned two-factor schema and transaction callback behavior.
## Additional verified increments

Corporate invoice behavior, environment configuration and actual isolated checks are documented in [CORE_INVOICES.md](CORE_INVOICES.md). The local baseline/current HomePageClassic and public API lab results are in [PERFORMANCE_LOCAL_LAB_2026-09-07.md](PERFORMANCE_LOCAL_LAB_2026-09-07.md), with raw JSON under `artifacts/performance`. Authentication email subject/body now follow trusted same-origin `/kk` verification/reset callback URLs; actual Better Auth HTTP tests verify both Kazakh flows still queue transactionally. This increment ran auth + invoice tests together: **18/18 passed**, targeted strict TypeScript and targeted ESLint passed. These checks use local isolated data and make no production payment or external delivery claim.

After the product-inventory and billing-basis increment, `tests/core-domain.test.ts tests/invoices.test.ts` ran together and passed **29/29** (18 core domain and 11 invoice tests). The earlier authentication increment remains 8/8. The new tests check 20-direction metadata without invented versions or public quoted prices, retained newer catalog labels, the authoring checklist with source provenance, and fixed organization fees with exact minor-unit allocations across 100 employees. This increment also passed strict targeted TypeScript and ESLint.

## Pending document repair

`POST /api/v1/admin/credentials/{id}/repair` accepts exactly `{templateId,reason}` (reason 10–2000 characters). Both the route and service require an issuer or administrator with a recent verified MFA session. The credential must still be pending with a recorded failed render attempt, no stored PDF and no active render lease. The replacement must be a different independently approved template for the same program and issuer. Issued/revoked documents cannot be repaired through this endpoint.

The transaction changes only the template pointer and repair revision in the reserved snapshot; learner name, program title, version, academic attempt, serial, verification URL/hash, original reservation time and issuance evidence stay unchanged. It requeues the existing durable job, preserves its cumulative attempt count, and records actor/reason, old/new template IDs and the previous failure in the append-only audit. Repeating the same successful repair before processing returns the pending job without another audit event. No PDF is presented as available until rendering succeeds. The render commit compares the exact snapshot it started with, so a direct old render without a lease cannot commit after a repair.

The six isolated `tests/credential-repair.test.ts` checks passed with no skips. They reproduce `UNICODE_TEMPLATE_FONT_REQUIRED`, repair to a newly approved template with an installed Unicode font, and download an actual flattened PDF with the original verification token. Additional checks reject unauthorized roles, missing MFA, forged snapshot fields, draft/wrong-program/wrong-issuer templates, active leases, missing failure evidence and issued/revoked changes. Injected audit failure proves that the template change and job retry roll back together. A deterministic asynchronous race proves the old PDF cannot commit after rebind and the durable job can then succeed. Font discovery supports Windows Arial, Ubuntu DejaVu/Liberation, macOS Arial, or `OT_TEST_UNICODE_FONT_PATH`; no system font or synthetic PDF is redistributed in the repository.

## Remote foreign-key release gate

Remote `getDb()` and the explicit migration CLI read `PRAGMA foreign_keys` on a fresh client and fail closed with `DATABASE_FOREIGN_KEYS_REQUIRED` unless it is 1. This is a check of the actual connection default, not an assumption that setting a PRAGMA in a migration HTTP stream changes future streams. Local native behavior is unchanged. The upstream libSQL build explicitly enables `SQLITE_DEFAULT_FOREIGN_KEYS=1` ([pinned upstream build source](https://github.com/tursodatabase/libsql/blob/d6c75af6353bb1c34985399608e37cd272a35aa1/libsql-ffi/build.rs#L198)); the managed account's actual configuration still requires verification.

After configuring and migrating the approved remote database, run `node --env-file-if-exists=.env --import tsx scripts/db-readiness.ts --remote --probe-foreign-keys`. This opens three separate fresh clients, verifies required migrations and existing foreign keys, and attempts an intentionally invalid enrollment inside a transaction that always rolls back. No user data, emails or tokens are sent as probe content; no rows are committed. A missing FK rejection is a release failure, even if the PRAGMA says 1. The command never creates or migrates a database, and requires `--remote` for a configured remote URL. Its output contains only gate status and migration count. Two actual local `tests/database-safety.test.ts` checks passed for default ON/OFF refusal, a real migrated FK violation, and a broken-schema probe whose otherwise accepted sentinel row was rolled back. The actual remote probe is `not_run`; these local checks do not certify Turso/Vercel behavior or distributed capacity.
