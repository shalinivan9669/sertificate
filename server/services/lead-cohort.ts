import { queryAll, type Db } from '../db';
import type { LeadCohortCounts, LeadCohortReport } from '../../shared/analytics';

type Audience = LeadCohortReport['audiences'][number]['audience'];
type Aggregate = Omit<LeadCohortCounts, 'deliveryRate'> & { audience: Audience };
const audiences: Audience[] = ['b2c', 'b2b', 'unknown'];
const emptyCounts = (): Omit<LeadCohortCounts, 'deliveryRate'> => ({ accepted: 0, delivered: 0, pending: 0, notePending: 0, invalid: 0 });
const withRate = (counts: Omit<LeadCohortCounts, 'deliveryRate'>): LeadCohortCounts => ({ ...counts, deliveryRate: counts.accepted ? counts.delivered / counts.accepted : null });

/** Called only by the protected analytics report. One indexed SELECT, no identifiers or payload leave SQL. */
export async function leadDeliveryCohort(from: string, until: string, asOf: string, db?: Db): Promise<LeadCohortReport> {
  // CASE protects JSON functions from corrupt historical payloads. The accepted service always
  // persists organizationName as a string; a missing/non-string value cannot establish audience.
  // CRM references must satisfy the provider adapter's positive, safe integer contract.
  const rows = await queryAll<Aggregate>(`
    WITH classified AS (
      SELECT status,crm_lead_id,crm_note_id,
        CASE WHEN json_valid(payload_json) THEN
          CASE WHEN json_type(payload_json)='object' AND json_type(payload_json,'$.organizationName')='text'
            THEN CASE WHEN length(trim(json_extract(payload_json,'$.organizationName')))>0 THEN 'b2b' ELSE 'b2c' END
            ELSE 'unknown' END
          ELSE 'unknown' END AS audience,
        CASE WHEN typeof(crm_lead_id) IN ('integer','real') AND crm_lead_id BETWEEN 1 AND 9007199254740991
          AND crm_lead_id=CAST(crm_lead_id AS INTEGER) THEN 1 ELSE 0 END AS lead_valid,
        CASE WHEN typeof(crm_note_id) IN ('integer','real') AND crm_note_id BETWEEN 1 AND 9007199254740991
          AND crm_note_id=CAST(crm_note_id AS INTEGER) THEN 1 ELSE 0 END AS note_valid
      FROM lead_submissions WHERE created_at>=? AND created_at<?
    ), states AS (
      SELECT audience, CASE
        WHEN audience='unknown' THEN 'invalid'
        WHEN status='delivered' AND lead_valid=1 AND note_valid=1 THEN 'delivered'
        WHEN status='accepted' AND crm_lead_id IS NULL AND crm_note_id IS NULL THEN 'pending'
        WHEN status='note_pending' AND lead_valid=1 AND crm_note_id IS NULL THEN 'note_pending'
        ELSE 'invalid' END AS delivery_state
      FROM classified
    )
    SELECT audience,COUNT(*) AS accepted,
      SUM(CASE WHEN delivery_state='delivered' THEN 1 ELSE 0 END) AS delivered,
      SUM(CASE WHEN delivery_state IN ('pending','note_pending') THEN 1 ELSE 0 END) AS pending,
      SUM(CASE WHEN delivery_state='note_pending' THEN 1 ELSE 0 END) AS notePending,
      SUM(CASE WHEN delivery_state='invalid' THEN 1 ELSE 0 END) AS invalid
    FROM states GROUP BY audience`, [from, until], db);
  const counts = new Map(rows.map(row => [row.audience, row]));
  const totals = emptyCounts();
  const groups = audiences.map(audience => {
    const row = counts.get(audience);
    const count = row ? { accepted: Number(row.accepted), delivered: Number(row.delivered), pending: Number(row.pending), notePending: Number(row.notePending), invalid: Number(row.invalid) } : emptyCounts();
    for (const key of ['accepted', 'delivered', 'pending', 'notePending', 'invalid'] as const) totals[key] += count[key];
    return { audience, ...withRate(count) };
  });
  // Current stored status for the creation cohort, not status reconstructed at a past timestamp.
  return { unit: 'accepted_leads', window: { from, until, bounds: '[from,until)' }, asOf, statusTime: 'current', totals: withRate(totals), audiences: groups };
}
