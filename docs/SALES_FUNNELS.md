# Explicit sales relationships and current learning outcomes

This implements the internal relationships needed by handoff B48/specification 09. It does not match people by email, telephone, name, BIN, organization name or browser identity. Staff explicitly select existing records. A link records attribution; it does not accept a payment, grant access, complete a lesson, grade an attempt, issue a document, or send a proposal.

## Protected staff workflow

All `/api/v1/admin/leads` reads and writes require a verified current database user with the `admin` role, enabled MFA, and a recent MFA assertion. A stale admin session cannot read the workspace or replay an old command after role removal. Organization managers cannot access platform leads through these endpoints.

The list and target chooser return 25 records per page, with `total`, `hasMore`, `page`, and `pageSize`. Target search accepts an exact identifier or identifier prefix; an empty query lists the latest actual records. Labels identify the learner/program/date or organization/invoice/date for the authorized staff member. Lead detail contains protected contact/context data. These values do not appear in the aggregate sales report.

Every mutation requires an `Idempotency-Key` and a reason of 10–2,000 characters. The command, durable audit record, and idempotency result are atomic. Same-key retries return the current authorized resource without repeating the transition; changing the body with the same key is rejected. Audits retain actor, target, reason and request correlation in the existing private audit history.

| Action | Required facts and effect |
| --- | --- |
| `POST /admin/leads/:id/qualification` | Exact current `revision`; `new → in_review → qualified/rejected`, with explicit reopening of `qualified/rejected → in_review`. `requestType` is `unspecified`, `training`, `document_status`, or `other`; omission preserves its current value. Malformed/unknown-audience records cannot be qualified. |
| `POST /admin/leads/:id/links` | A qualified B2C lead, `kind: order/enrollment`, and a real selected target outside an organization. Corrupt order/learner/version/organization relationships are rejected. |
| `POST /admin/leads/:id/links/:linkId/revoke` | Revoke that lead's attribution link while retaining its immutable identity/history and all training/payment records. |
| `POST /admin/leads/:id/proposals` | A qualified B2B lead, a reference of 3–200 characters, and an explicit previously sent `sentAt` between lead acceptance and now. This records a staff-attested sent fact; it sends no message. |
| `POST /admin/leads/:id/proposals/:proposalId/organization` | Attach one actual active organization. It cannot be silently replaced; an incorrect proposal can be withdrawn and a new explicit proposal recorded. |
| `POST /admin/leads/:id/proposals/:proposalId/assignments` | Exactly one of 1–100 unique actual enrollment IDs or one confirmed invoice. Each enrollment must belong to the selected organization and a current active member. Invoice mode validates every exact line/fulfillment/order/enrollment identity, version and successful payment state. Missing, foreign, unconfirmed or corrupt fulfillment causes an atomic refusal. No future or other organization assignments are inferred. |
| `POST /admin/leads/:id/proposals/:proposalId/withdraw` | Retain the sent record, record withdrawal, revoke its attribution links, and preserve the underlying organization/training/payment history. |

One active order/enrollment cannot receive credit for two leads or two proposals. Cross-kind ambiguity between an order and its eventual enrollment also invalidates attribution. Competing transactions are serialized by the existing database transaction contract; the loser receives a conflict. Historical malformed cross-links are counted as `invalidLinks` and do not fabricate a completed stage. Each lead has an explicit history limit of 500 links and 50 proposals; reaching it returns a conflict, not silently truncated history.

## Report populations and denominators

`GET /api/v1/admin/analytics?days=1..31` preserves existing event totals and their `conversionRate: null`, and adds `sales: SalesReport`. It uses the same exact UTC half-open window `[from, until)`. `asOf` identifies a current-state snapshot. The report does not reconstruct the state at an earlier date.

| Report | Cohort unit and creation boundary | Stages |
| --- | --- | --- |
| `journeyOutcomes` | Consented per-tab journeys created in the window and unexpired at `asOf`; these are not deduplicated people or unique visitors. | Journey → recorded entry → program → later consultation → explicitly attributed accepted lead → currently qualified lead → confirmed access → learning started → required content → passing assessment → issued, non-revoked document in that same eligible chain. A direct program entry supplies both entry and program. |
| `b2c` | Accepted B2C lead rows created in the window, including leads without optional browser attribution. | Accepted → currently qualified → the same learning suffix. |
| `proposals` | Explicit sent-proposal records **registered** (`created_at`) in the window. `sentAt` is the recorded earlier sent fact, not the cohort timestamp. Withdrawn records remain in the original sent denominator. | Sent fact → currently linked organization → exact assignment → the same learning suffix. One proposal with two seats counts once at each stage. |

Each stage contains a unique unit count, the immediately preceding stage's count as `denominator`, and a ratio or `null` when the denominator is zero. The first denominator is `cohortSize`. Every later stage requires one complete chain through **one actual enrollment**; lessons from one enrollment cannot combine with an exam or document from another. Multiple leads or assignments in one journey still count the journey once per stage. A journey can reach learning outcomes through its explicitly linked B2C assignment or an exact B2B proposal assignment; no shared contact identity joins them.

The public path requires program-before-consultation sequence and server receipt ordering. Only steps with `sequence <= lead_attributions.last_sequence` and receipt time no later than the immutable acceptance snapshot may support an accepted-lead path. A late request with an earlier sequence cannot retroactively create that path. Attribution expiry removes optional joined journey/source reporting while preserving operational leads, explicit links and academic history.

Current confirmed access requires the verified learner, published pinned version, active eligible enrollment, unexpired access, current active organization membership where applicable, and an actual successful matching order for paid access. Pending/tampered/refunded payment state does not grant credit. Learning uses persisted completion/attempt facts. Required practice needs completion by a distinct staff actor. Passing assessment uses a non-void terminal server result with Boolean `pass: true`. The final stage also requires an issued document file/hash connected to that enrollment and passing attempt; pending rendering and revocation do not qualify.

`validCredential` is the final stage of this **currently eligible complete chain**, not a count of every document whose public verification is valid. Expiry of LMS access does not itself revoke a document. The existing public verification contract uses issued/revoked status; renewal dates belong to optional reminders and do not introduce a document expiry policy. No new legal validity period is inferred.

The report caps each cohort at 1,000 units and related links/attributions at 5,000. Overflow is explicit (`truncated: true`, empty `stages`); a narrower window is required. Optional source rows are withheld on overflow. Reads use a transaction snapshot and bounded set queries, with no per-seat service/query loop. The focused test observes at most nine SQL reads and no writes for a populated report, including metrics, and confirms use of the order/enrollment index. This is a local query-shape check, not a hosted load/cost guarantee.

## Operational measurements

The report separates real service state from optional consented browser observations:

- CRM pending count and mean delivery lag for the accepted-lead creation cohort; lag samples require a delivered record with valid positive CRM lead/note IDs and ordered timestamps. The existing `leadCohort` separately reports invalid historical delivery records.
- Issued/unconfirmed corporate invoices, active unstarted organization assignments, pending document rendering, and mean actual issuance duration, using their creation cohorts. A pending state is not a promise of successful automatic processing.
- Current counts of unpublished versions and directions without a published version.
- Document-status requests explicitly classified by staff. A generic support event is not reclassified as a document-status request.
- API, autosave, authentication and checkout HTTP failure counters. Their scope is the UTC day buckets overlapping the chosen window, explicitly labeled `utc_days`; assessment failure is not a technical error.
- Distinct consented journeys with an authentication start, a server-confirmed verified session after that start, or no current confirmation. `authUnconfirmed` describes current absence of confirmation, not a causal abandonment conclusion. The endpoint stores only the confirmation timestamp, not a learner/account ID.
- Distinct journeys with selection start and a later actual matched/unmatched published-variant result. Repeated results do not inflate the unit. One journey may have both matched and unmatched results at different times, so the outcomes are not mutually exclusive. Outcomes use started journeys as their `sampleSize`; starts use the whole selected journey cohort. Oversized journey windows yield unavailable metrics rather than partial counts.

`qualifiedSources` groups the first closed source/route/city context of currently qualified leads in the selected unexpired journey cohort. It deduplicates leads, validates the context using the shared allowlist, and returns `unknown` for malformed context. It has no raw URL, search query, referrer, campaign string, contact, entity identifier or answer content. It does not assert visitor conversion or joined external CRM qualification.

External search queries, CPA, and market share remain explicitly unavailable because no source data exists. Stale-material count is `null` because an approved review deadline/policy has not been provided; the system does not invent a duration. Telemetry collection remains separately opt-in/gated. Valid configured retention deletes expired optional event records even when new collection is disabled, without deleting business/audit/academic history.

## Executed local verification

On 2026-09-08 the command below completed with **18 passing tests, zero failures/skips**, in **16.810 seconds**: 13 new sales/report scenarios and the 5 existing accepted-lead cohort scenarios.

```powershell
node --import tsx --test --test-reporter=tap tests/sales-links.test.ts tests/lead-cohort.test.ts
```

Evidence: ignored `artifacts/sales-links-tests.log`. All databases are new temporary local fixtures. The suite exercises role/MFA revocation and replay, optimistic qualification revisions, audit-failure rollback, actual target validation, concurrent duplicate-credit prevention, B2B proposal/organization/exact-assignment links, current membership, real signed **sandbox** payment acceptance/refund, real local manual-invoice confirmation with two fulfillments, actual lesson/assessment services, distinct-staff practice, and actual isolated PDF reserve/render/revoke. Malformed/mixed fixtures demonstrate that direct status flags or facts from different enrollments cannot fabricate completion. Ordered/expired journey facts, source privacy, metric denominators, half-open bounds, caps, query counts, and index use are also checked.

Focused ESLint completed with exit 0 for the changed services/types/handler/tests. The subsequent tiny report integration change passes the same `now` to both report snapshots and passed focused ESLint. Full repository tests, Linux CI, rebuilt browser QA, and production/Turso behavior for this packet are reported separately by the release coordinator; this document does not claim those runs or any real payment/email/provider delivery.
