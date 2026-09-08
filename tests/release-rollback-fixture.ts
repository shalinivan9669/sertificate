/** Synthetic historical records for the executable release rollback drill; never app imports. */
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createClient } from '@libsql/client';
import { hashPassword } from 'better-auth/crypto';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { exportDatabase } from '../scripts/db-backup';

export async function seedReleaseRollback(source: string, directory: string, databasePath: string, password: string) {
  assert.equal(process.env.OT_ALLOW_RELEASE_ROLLBACK_DRILL, '1');
  const { migrate } = await import(pathToFileURL(join(source, 'server/db/index.ts')).href);
  const { requiredMigrations } = await import(pathToFileURL(join(source, 'server/db/required-migrations.ts')).href);
  assert.equal(requiredMigrations.length, 12);
  const migrations = join(source, 'server/db/migrations');
  const historical = join(directory, 'migrations-010'); await mkdir(historical);
  for (const name of requiredMigrations.slice(0, 10)) await writeFile(join(historical, name), await readFile(join(migrations, name)), { flag: 'wx' });
  const db = createClient({ url: `file:${databasePath.replaceAll('\\', '/')}`, concurrency: 1 });
  const sql = (text: string, args: any[] = []) => db.execute({ sql: text, args });
  const stamp = new Date().toISOString();
  const ids = { learner: randomUUID(), outsider: randomUUID(), editor: randomUUID(), reviewer: randomUUID(), version: randomUUID(), historicalEnrollment: randomUUID(), historicalAttempt: randomUUID(), credential: randomUUID(), order: randomUUID(), payment: randomUUID(), organization: randomUUID(), historicalLead: randomUUID() };
  const program = {
    title: 'SYNTHETIC RELEASE ROLLBACK ONLY — no academic validity', language: 'ru', audience: 'Synthetic fixture users', prerequisites: '', outcomes: 'Exercise storage continuity', limitations: 'Not approved training content', format: 'local test', durationHours: 1,
    priceMinor: 0, currency: 'KZT', accessModel: 'free', billingBasis: 'learner', documentDescription: 'No real document', support: 'Synthetic test support', sourceRefs: ['tests/release-rollback-fixture.ts'], reviewedAt: stamp.slice(0, 10),
    modules: [{ id: 'rollback-module', title: 'SYNTHETIC', lessons: [{ id: 'rollback-lesson', title: 'SYNTHETIC lesson', kind: 'text', required: true, body: 'Synthetic rollback continuity exercise. No occupational competence is certified.', media: [] }] }],
    assessment: { durationMinutes: 30, maxAttempts: 2, passPercent: 100, questionCount: 2, retakeDelayMinutes: 0 },
    questions: [1, 2].map(index => ({ id: `rollback-q${index}`, text: `SYNTHETIC question ${index}`, topic: 'Continuity', options: [{ id: 'right', text: 'SYNTHETIC right' }, { id: 'wrong', text: 'SYNTHETIC wrong' }], correctOptionIds: ['right'] })),
  };
  try {
    await migrate(db, historical);
    const passwordHash = await hashPassword(password);
    for (const [role, id] of Object.entries({ learner: ids.learner, outsider: ids.outsider, editor: ids.editor, reviewer: ids.reviewer })) {
      await sql('INSERT INTO "user"(id,name,email,emailVerified,role,twoFactorEnabled,createdAt,updatedAt) VALUES(?,?,?,1,?,0,?,?)', [id, 'SYNTHETIC ' + role, `${role}@rollback.example.test`, role === 'outsider' ? 'learner' : role, Date.now(), Date.now()]);
      await sql('INSERT INTO account(id,accountId,providerId,userId,password,createdAt,updatedAt) VALUES(?,?,?,?,?,?,?)', [randomUUID(), id, 'credential', id, passwordHash, Date.now(), Date.now()]);
    }
    await sql('INSERT INTO program_versions(id,program_id,version,status,data_json,created_by,approved_by,review_evidence,published_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)', [ids.version, 'ohrana-truda', 1, 'published', JSON.stringify(program), ids.editor, ids.reviewer, 'SYNTHETIC fixture only; not content approval', stamp, stamp, stamp]);
    await sql('INSERT INTO organizations(id,name,created_at) VALUES(?,?,?)', [ids.organization, 'SYNTHETIC organization', stamp]);
    await sql('INSERT INTO memberships(organization_id,user_id,role,created_at) VALUES(?,?,?,?)', [ids.organization, ids.learner, 'member', stamp]);
    await sql('INSERT INTO enrollments(id,user_id,version_id,organization_id,status,created_at,reason) VALUES(?,?,?,?,?,?,?)', [ids.historicalEnrollment, ids.learner, ids.version, ids.organization, 'completed', stamp, 'SYNTHETIC historical preservation record']);
    await sql('INSERT INTO lesson_progress(enrollment_id,lesson_id,completed,revision,evidence_json,completed_by,completed_at) VALUES(?,?,1,3,?,?,?)', [ids.historicalEnrollment, 'rollback-lesson', '{"synthetic":"historical evidence"}', ids.learner, stamp]);
    await sql('INSERT INTO attempts(id,enrollment_id,status,deadline_at,revision,form_json,answers_json,result_json,created_at,submitted_at) VALUES(?,?,?,?,?,?,?,?,?,?)', [ids.historicalAttempt, ids.historicalEnrollment, 'graded', stamp, 4, JSON.stringify({ versionId: ids.version, questions: program.questions, rules: program.assessment }), '{"rollback-q1":["right"],"rollback-q2":["right"]}', JSON.stringify({ pass: true, score: 100, total: 2, correct: 2, gradedAt: stamp, topics: [] }), stamp, stamp]);
    const pdf = await PDFDocument.create(); const font = await pdf.embedFont(StandardFonts.Helvetica);
    pdf.addPage([600, 400]).drawText('SYNTHETIC ROLLBACK DOCUMENT - NO VALIDITY', { x: 30, y: 350, size: 14, font });
    const pdfBytes = await pdf.save(); const documentHash = createHash('sha256').update(pdfBytes).digest('hex');
    const documentBase64 = Buffer.from(pdfBytes).toString('base64');
    await sql('INSERT INTO credentials(id,enrollment_id,attempt_id,serial,status,snapshot_json,verification_hash,document_base64,document_sha256,issued_at,issued_by,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)', [ids.credential, ids.historicalEnrollment, ids.historicalAttempt, 'SYNTHETIC-ROLLBACK-ONLY', 'issued', JSON.stringify({ learnerName: 'SYNTHETIC learner', programTitle: program.title, issuerName: 'SYNTHETIC ONLY', verificationUrl: 'https://example.test/verify/NOT-REAL' }), randomUUID(), documentBase64, createHash('sha256').update(documentBase64).digest('hex'), stamp, ids.reviewer, stamp]);
    await sql('INSERT INTO orders(id,user_id,organization_id,version_id,status,amount_minor,currency,snapshot_json,enrollment_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)', [ids.order, ids.learner, ids.organization, ids.version, 'paid', 125000, 'KZT', '{"synthetic":"historical financial snapshot; DO NOT PAY"}', ids.historicalEnrollment, stamp, stamp]);
    await sql('INSERT INTO payments(id,order_id,provider,status,amount_minor,currency,merchant,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)', [ids.payment, ids.order, 'synthetic-fixture', 'succeeded', 125000, 'KZT', 'SYNTHETIC NO MERCHANT', stamp, stamp]);
    await sql('INSERT INTO payment_events(id,payment_id,payload_hash,event_type,received_at) VALUES(?,?,?,?,?)', [randomUUID(), ids.payment, 'SYNTHETIC HISTORICAL EVENT', 'succeeded', stamp]);
    await sql('INSERT INTO refunds(id,order_id,status,amount_minor,reason,actor_id,created_at) VALUES(?,?,?,?,?,?,?)', [randomUUID(), ids.order, 'pending', 125000, 'SYNTHETIC pending refund; DO NOT SEND', ids.reviewer, stamp]);
    await sql('INSERT INTO lead_submissions(id,payload_json,request_hash,idempotency_key,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?)', [ids.historicalLead, '{"email":"historical@rollback.example.test"}', 'SYNTHETIC', randomUUID(), 'accepted', stamp, stamp]);
    await sql('INSERT INTO audit_events(id,actor_id,action,target,reason,created_at) VALUES(?,?,?,?,?,?)', [randomUUID(), ids.reviewer, 'SYNTHETIC_HISTORICAL_EVIDENCE', ids.credential, 'Preserve this exact record', stamp]);
    const before = await exportDatabase(db);
    await migrate(db, migrations);
    const expanded = await exportDatabase(db);
    for (const table of before.tables) {
      const after = expanded.tables.find(value => value.name === table.name)!;
      assert.deepEqual(after.columns, table.columns);
      if (table.name === 'schema_migrations') { assert.deepEqual(after.rows.slice(0, 10), table.rows); assert.equal(after.rows.length, 12); }
      else assert.deepEqual(after.rows, table.rows, 'Expansion preserves every historical row: ' + table.name);
    }
    await sql('INSERT INTO public_journeys(id,consent_version,created_at,updated_at,expires_at) VALUES(?,?,?,?,?)', ['synthetic-journey', 'synthetic-consent-v2', stamp, stamp, '2099-01-01T00:00:00.000Z']);
    await sql('INSERT INTO public_journey_steps(id,journey_id,sequence,step,context_json,created_at) VALUES(?,?,1,?,?,?)', ['synthetic-step', 'synthetic-journey', 'program', '{"programId":"ohrana-truda"}', stamp]);
    await sql('INSERT INTO lead_attributions(lead_id,journey_id,last_sequence,first_touch_json,last_touch_json,consent_version,created_at,expires_at) VALUES(?,?,1,?,?,?,?,?)', [ids.historicalLead, 'synthetic-journey', '{"synthetic":true}', '{"synthetic":true}', 'synthetic-consent-v2', stamp, '2099-01-01T00:00:00.000Z']);
    await sql('INSERT INTO lead_qualifications(lead_id,status,request_type,updated_by,updated_at) VALUES(?,?,?,?,?)', [ids.historicalLead, 'qualified', 'training', ids.reviewer, stamp]);
    await sql('INSERT INTO sales_proposals(id,lead_id,sent_at,reference,organization_id,created_by,created_at) VALUES(?,?,?,?,?,?,?)', ['synthetic-proposal', ids.historicalLead, stamp, 'SYNTHETIC-NOT-SENT', ids.organization, ids.reviewer, stamp]);
    await sql('INSERT INTO sales_links(id,lead_id,proposal_id,kind,enrollment_id,created_by,created_at) VALUES(?,?,?,?,?,?,?)', ['synthetic-sales-link', ids.historicalLead, 'synthetic-proposal', 'enrollment', ids.historicalEnrollment, ids.reviewer, stamp]);
    await sql('INSERT INTO support_notes(id,user_id,author_id,body,created_at) VALUES(?,?,?,?,?)', ['synthetic-support', ids.learner, ids.reviewer, 'SYNTHETIC append-only support record', stamp]);
    await sql('INSERT INTO program_intake_controls(version_id,is_open,actor_id,reason,updated_at) VALUES(?,0,?,?,?)', [ids.version, ids.reviewer, 'SYNTHETIC closed intake; preserve existing access', stamp]);
    await sql('INSERT INTO operational_incidents(id,fingerprint,kind,severity,target_type,target_id,owner_role,details_json,first_seen_at,last_seen_at) VALUES(?,?,?,?,?,?,?,?,?,?)', ['synthetic-incident', randomUUID(), 'credential_pending', 'warning', 'credential', ids.credential, 'issuer', '{"synthetic":true}', stamp, stamp]);
    await sql('INSERT INTO learning_reminders(id,user_id,enrollment_id,kind,due_at,timezone,lead_days_json,created_by,reason,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)', ['synthetic-reminder', ids.learner, ids.historicalEnrollment, 'renewal', '2099-01-01T00:00:00.000Z', 'Asia/Qyzylorda', '[0]', ids.learner, 'SYNTHETIC reminder; no delivery', stamp, stamp]);
    // Existing access survives closed intake; no application creation boundary is bypassed during HTTP tests.
    const activeEnrollment = randomUUID();
    await sql('INSERT INTO enrollments(id,user_id,version_id,status,created_at,reason) VALUES(?,?,?,?,?,?)', [activeEnrollment, ids.learner, ids.version, 'active', stamp, 'SYNTHETIC access assigned before rollback']);
    assert.deepEqual((await db.execute('PRAGMA foreign_key_check')).rows, []);
    return { ids, activeEnrollment, documentHash, baseline: 10, target: 12, oldTableCount: before.tables.length, expandedTableCount: expanded.tables.length, historicalRows: before.tables.reduce((sum, value) => sum + value.rows.length, 0) };
  } finally { db.close(); }
}
