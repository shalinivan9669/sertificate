# Request and delivery observations

The application generates a fresh UUID for every HTTP request and returns it as `X-Request-Id`. Incoming request/correlation headers are deliberately ignored, including valid UUIDs. Arbitrary headers, URLs, query strings and body content cannot become correlation metadata.

The security middleware and the v1, authentication and legacy `amo-lead` handlers use `AsyncLocalStorage.run` around their actual asynchronous operation. A successful middleware run ends before the next handler; the handler starts its own run using the same event-owned context. No `enterWith` request hook or global mutable current-request object is used.

Migration `010-observability.sql` adds nullable `request_id`, `correlation_id`, `origin_request_id` and `source_job_id` to both `audit_events` and `outbox`, with correlation indexes. Historical columns and values remain unchanged; migration does not invent a request for an old row. Domain `audit()` and `enqueue()` attach the current context in their existing SQL statement/transaction. The Better Auth transactional email adapter and the batched invoice notification insert also attach it, without creating a second transaction or a query per employee.

A delivery attempt starts a new request span inside `run`, retains the source correlation/original HTTP request and identifies its source job. The operator's retry/tick request does not overwrite the originating request. A manual retry has its own audit entry; delivery continues to use the original job. Old UUID jobs use their job ID as a stable fallback correlation. For historical non-UUID job IDs, the first claim records a generated correlation once; logs explicitly leave `sourceJobId` and unknown original HTTP IDs null. Historical job IDs are never renamed. New Better Auth email jobs explicitly use UUIDs through its supported adapter `forceAllowId` option.

## Logs and response boundary

The JSON log schema contains only `schemaVersion`, `event`, UUID-or-null correlation fields, an optional fixed route template, allowed HTTP method, numeric status/elapsed time and a closed operational code. Events are `api_failure`, `outbox_delivered`, `outbox_cancelled`, `outbox_failed` and `telemetry_write_failed`. Cancelled work is not described as delivered. A log-sink failure cannot change a domain result.

Route templates never include an actual question ID, verification token or query. Oversized/unmatched paths become `/api/:unmatched`. Unknown delivery and incident codes become `DELIVERY_FAILED`/`UNCLASSIFIED`; an uppercase string is not automatically trusted. Exception messages, stacks, causes, headers, cookies, answers, provider payloads and learner contact data are not passed to the logger.

The API boundary returns a controlled JSON error with status, application code and request ID, without the generic framework `url`, raw message, stack or cause. Our domain constructors mark their errors in a server-only WeakMap so expected codes remain usable by the UI. Unknown driver/provider failures use neutral status-based codes. Field errors retain only known field names and neutral text. Security middleware returns the same controlled response for body-limit, origin/content-type and unknown API-route errors before a domain handler executes. This is necessary because a framework error handler may send a response directly without running `beforeResponse`.

The Nitro plugin also defensively scrubs captured API errors and observes final response status. It does not establish a global asynchronous context. Better Auth's normal handled responses retain its supported authentication contract; unexpected exceptions at the outer boundary are scrubbed.

Compiled-runtime QA caught a lifecycle mismatch: H3 called `beforeResponse` before unwrapping Better Auth's handled Web `Response`, so a real HTTP 401 still appeared as event status 200 to the observer. The API wrapper now sets the event status from that returned `Response` and returns the same object without rewriting its body, cookies or headers. A real wrong-password HTTP regression requires one sanitized failure log and one counter increment, with the original Better Auth error code preserved. A new compiled-runtime run is required separately from this focused source test.

## Bounded counters

An API response with status 400–599 increments daily `api_error`; a failed mutation of `/api/v1/attempts/:id/answers/:questionId` also increments `autosave_failure`. The route is logged as `/api/v1/attempts/:id/answers`. These counters include rejected/unauthenticated/rate-limited requests; they are not a count of lost answers or a measure of teaching quality.

There is at most one counter statement per failed response, combining both increments; successful requests do not write telemetry. Counts saturate at the signed 32-bit maximum and no per-user metric records are created. A response is observed only once even if a lifecycle hook repeats. Persistence uses the request lifecycle when available. Missing DB configuration or a telemetry write failure never changes the original HTTP/domain outcome. A failed write records only `OBSERVATION_UNAVAILABLE`; counters are best effort and must not be treated as an exact financial or academic ledger.

Queue/payment/issuance/CRM incidents and their external-delivery gates remain separate. This change does not configure a real alert recipient, SMTP, a hosted scheduler, a production logging platform or a remote database.

## Local verification

`tests/observability.test.ts` exercises overlapping asynchronous request/job contexts through real temporary libSQL transactions, actual concurrent HTTP lead requests and idempotent replay, real Better Auth sign-up/email outbox metadata, worker failure/retry and old-job fallback, actual failed autosave requests, an artificial failing SQLite trigger, repeated response hooks, telemetry/log-sink failures, and malformed/oversized/private canaries. Middleware 404/403/413 responses are inspected for reflected URLs/tokens. Raw fixture values remain private; sanitized sample records are written to ignored `artifacts/observability/safe-fixture-samples.json`.

`tests/migration-upgrade.test.ts` now checks populated schema 001–005 → 001–010: all old values are identical, added context columns are null, the nine feature tables remain empty, and historical immutable triggers, foreign keys, integrity and migration replay remain intact.

A first test incorrectly required H3's safe wrapper `cause` to be absent; H3 attaches the safe constructor object. The check now rejects actual private values in the response instead. A later artificial 16-writer test exceeded the existing native transaction-acquisition budget under parallel Windows load. Runtime locking/retry policy was not widened: the isolation test now uses four overlapping writers with real asynchronous interleaving. The failed runs are not evidence of a passed stress/capacity test.

The first compiled privacy run found a real missing observation: Better Auth returned HTTP401, while H3's event still showed its default200 before unwrapping that Web Response. The wrapper now copies only the returned status to the event and returns the exact Response unchanged, preserving cookies, body and headers. A real incorrect-password regression asserts one safe log and counter. The final focused observability8/auth8/security3 run passed19/19; the full source suite passed144/144. The repeated compiled `c4d9bf39` privacy run passed28/28, including all15 negative HTTP responses,17 safe JSON records and14 private-canary categories with no matches. See `RUNTIME_PRIVACY_AUDIT.md` for the exact local sample and evidence. Hosted/production logging remains separately unverified.
