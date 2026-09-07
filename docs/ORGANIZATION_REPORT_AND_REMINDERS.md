# B42 corporate reporting and B44 learning reminders

This continuation implements the factual report requirements in handoff `spec/07_B2B_ADMIN_CRM.md` and the calendar reminder workflow without assuming academic validity periods. Everything described below is application functionality; external database readiness, hosted scheduling and SMTP delivery require their own evidence.

## Corporate report

`GET /api/v1/organizations` accepts `page` and `pageSize`. `GET /api/v1/organizations/:id` accepts `page` (assignments), `memberPage`, `invitationPage`, `pageSize` and optional `programId`. Page numbers start at 1; page size defaults to 50 and is limited to 100. Every list returns its real total, current page, total pages, previous/next flags and visible range. A request beyond the last page clamps to that page. Organization selection also has pagination, replacing the previous invisible 100-organization cap.

The overview uses five SELECT statements within a read transaction: current membership, counts, members, one report CTE, invitations. No query is issued per learner. Required lesson counts are derived from the enrollment's immutable program version. Optional lessons and unknown progress records cannot inflate the required percentage. Practice counts only when `completed_by` is another account. A zero required denominator returns `null`, not a made-up 100%.

Each assignment exposes independent `accessStatus`, `learning`, `assessment` and `credential` objects. `progressStatus` is a primary label, while the other axes remain visible in the interface so that, for example, expired access does not hide an already issued document. The most recently created exam attempt is shown, including a failed retake after an earlier pass. Equal timestamps use insertion order to choose the latest attempt. An elapsed active attempt is labelled `awaiting_grading`; reading a report never calculates a client result or mutates an attempt. Documents distinguish none/pending/issued/revoked/superseded; replacement pending state takes precedence over the revoked predecessor. The report does not select question forms, answer banks, document bytes or verification secrets.

`GET /api/v1/organizations/:id/report.csv?programId=...` exports the complete matching report, independent of the current page. CSV cells are escaped and neutralize spreadsheet formula prefixes. The hard limit is 5,000 assignment rows. Above this bound the server returns `413 REPORT_TOO_LARGE`; the UI reports the real row count and asks for a program filter. It never downloads a silent partial export. Very large exports within one program still require a future bounded export-job feature. No compliance percentage is claimed.

## Reminder rules

Migration `007-learning-reminders.sql` adds rules, per-offset delivery records and learner preferences. There are no seeded rules. A rule is tied to a real enrollment and verified learner. A learner can manage their own rule; an active organization owner/manager can manage the organization's rules. Other tenants cannot inspect or mutate them.

Two kinds are supported:

- `access_deadline`: uses the exact future `enrollments.access_until`; the client cannot supply a substitute date. Completed, suspended, cancelled and expired access cannot create this reminder.
- `renewal`: requires an explicit future local calendar date, reason and IANA time zone. It is a planned training date. It does not calculate certificate validity, legal frequency, eligibility, a new enrollment, payment or document.

The user chooses one to three distinct offsets from 0 to 365 calendar days. Offset 0 means the planned day. Calendar boundaries use the selected IANA time zone, including 23/25-hour DST days. Invalid dates and entirely skipped local dates are rejected. Delivery can occur during the selected local day when the durable scheduler next runs. There is no promised exact sending hour. Access-deadline delivery also stops at the actual access expiry. Old delivery windows are marked missed instead of sending several late notices at once.

Create requests use `Idempotency-Key`; updates require the current revision and reason. Rescheduling invalidates old queued jobs atomically. Cancellation suppresses future jobs and unread notices for the old revision while preserving previously read history. The learner can opt out separately for access deadlines and renewal; an organization manager cannot override this preference. Re-enabling a preference does not replay cancelled rules.

The worker hooks are `scheduleLearningReminders({limit, budgetMs})` and `deliverLearningReminder(job)`. Scheduling is bounded to 50 slots and a 5-second processing budget. Slot identity is unique per rule/revision/offset. Delivery performs a second current-state check before creating the inbox notification. The outbox template is `learning.reminder`; the safe notification payload contains only reminder/enrollment IDs, kind, due date and time zone. No external email or mass mailing is performed by this service. A Vercel daily cron can run later in the selected local day or miss a window during an outage; the UI exposes missed windows rather than promising delivery.

API endpoints:

- `GET/POST /api/v1/me/learning-reminders` and `GET/POST /api/v1/organizations/:id/learning-reminders`.
- `POST /api/v1/learning-reminders/:id/update` and `/cancel`.
- `GET/POST /api/v1/me/reminder-preferences`.
- `GET /api/v1/me/learning-reminders/enrollments` provides a separately paginated, safe enrollment selector.

The RU/KK interface lives at `/cabinet/reminders` and inside the organization page. Its link is in the personal cabinet; the public learning navigation remains unchanged. Reminder data uses the existing `lms-` cache namespace and is cleared on logout.

## Executed checks

- `node --import tsx --test tests/organization-report.test.ts tests/business-integration.test.ts`: 30 passed, no failures/skips, 15.23 seconds. This included all 23 pre-existing business integration scenarios after the report changes.
- `node --import tsx --test tests/organization-report.test.ts tests/learning-reminders.test.ts`: latest 16 passed, no failures/skips, 16.13 seconds, after deterministic timestamp tie handling and reminder cancellation fixes. Log: ignored `artifacts/organization-reminders-tests.log`.
- Focused ESLint on the changed services, handlers, report/reminder pages/components and their fixtures/scripts: passed.
- Full Nuxt typecheck: parent recorded exit 0 after typed notification DTO correction. This is a local source check; no hosted functional claim follows from it.

The seven report tests cover zero facts, pinned required progress/practice, failed/active/voided/expired exam states, pending/issued/revoked/replacement document facts, fresh ACL, 520 assignments across stable pages, 108 memberships, 105 invitations, a complete 521-line CSV, explicit rejection above 5,000 rows, organization filtering, more than 100 organizations, and read transaction commit/rollback followed by a successful write. The zero-denominator defensive fixture is deliberately an unpublished historical draft; the publication service correctly refuses such a program.

The nine reminder tests cover UTC offsets, DST, nonexistent dates, source deadlines, explicit renewal dates, idempotency, tenant access, scheduler/delivery races, stale revisions, revoked membership after enqueue, changed deadlines, bounded missed windows, learner opt-out with read-history retention, and safe pagination. They use a new temporary libSQL database and synthetic metadata only.

Browser QA in `tests/organization-report-fixtures.ts` and `tests/organization-report-browser.mjs` passed **13/13 checkpoints**, exit 0, at **2026-09-07 15:34:34 UTC** against a copied Node artifact `c76fd093-af00-4e6b-9b68-b69a40dc2480`. It created a new `ot-report-browser-*` temporary database, never reused the learner/pilot database, and wrote credentials only into an ignored local manifest. Actual browser sign-in and form submissions on port 3104 verified a zero-state organization, factual report states, all 71 assignments across pages, 62 memberships, 60 invitations, program-filtered CSV download, RU desktop/KK 360px, organization create→reschedule→cancel and personal opt-out. The Kazakh preference stayed disabled after navigation, there was no horizontal overflow, and no JavaScript errors were recorded. Screenshots were inspected. Evidence: ignored `artifacts/organization-report/report.json`, `ru-desktop.png`, `kk-mobile.png`, `kk-reminders-mobile.png`. The initial browser run stopped at an overly strict wrapped-select test locator; only the locator was corrected before the complete passing run.

Hosted Turso foreign-key/concurrency checks, actual Vercel cron execution, production rollback and SMTP notifications are not established by these local tests.
