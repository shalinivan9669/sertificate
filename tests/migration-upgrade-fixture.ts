import assert from 'node:assert/strict';
import { copyFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join, resolve, sep } from 'node:path';
import { createClient, type Client } from '@libsql/client';
import { migrate } from '../server/db';

const identifier = (value: string) => '"' + value.replaceAll('"','""') + '"';
async function tableNames(db: Client) {
  return (await db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")).rows.map(row=>String(row.name));
}
async function snapshot(db: Client, names: string[]) {
  const data: Record<string, unknown[]> = {};
  for (const name of names) {
    const result = await db.execute(`SELECT * FROM ${identifier(name)} ORDER BY rowid`);
    data[name] = result.rows.map(row=>Object.fromEntries(result.columns.map((column,index)=>[column,row[index]])));
  }
  return data;
}


async function verifyUpgrade(baseline: number, directory: string) {
  const historicalDirectory = join(directory,`migrations-through-${baseline}`); await mkdir(historicalDirectory);
  const currentDirectory = resolve('server/db/migrations');
  const names = (await readdir(currentDirectory)).filter(name=>/^\d+[-_].*\.sql$/.test(name)).sort();
  const historical = names.filter(name=>Number(name.slice(0,3))<=baseline);
  assert.equal(historical.length,baseline); assert.equal(names.length,13,'This explicitly bounded regression targets schema 013');
  for (const name of historical) await copyFile(join(currentDirectory,name),join(historicalDirectory,name));
  const db = createClient({url:'file:'+join(directory,'upgrade.sqlite').replaceAll('\\','/'),concurrency:1,intMode:'number'});
  const exec = (sql: string,args: any[] = [])=>db.execute({sql,args});
  const stamp = '2026-01-01T00:00:00.000Z';
  try {
    await migrate(db,historicalDirectory);
    // Historical SQL fixtures are deliberately synthetic. This tests preservation, not
    // enrollment eligibility, finance authorization or academic document issuance.
    await exec('INSERT INTO "user"(id,name,email,emailVerified,createdAt,updatedAt,role,twoFactorEnabled) VALUES(?,?,?,1,1,1,?,1)', ['upgrade-learner','ТЕСТ ONLY migration user','migration-learner@example.test','learner']);
    await exec('INSERT INTO "user"(id,name,email,emailVerified,createdAt,updatedAt,role,twoFactorEnabled) VALUES(?,?,?,1,1,1,?,1)', ['upgrade-reviewer','TEST reviewer','migration-reviewer@example.test','reviewer']);
    await exec('INSERT INTO program_versions(id,program_id,version,status,data_json,created_by,approved_by,published_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)', ['upgrade-version','ohrana-truda',1,'published',JSON.stringify({title:'TEST ONLY historical program',language:'kk',modules:[{id:'module',lessons:[{id:'lesson',required:true}]}],questions:[{id:'PRIVATE_QUESTION_UPGRADE_CANARY',correctOptionIds:['PRIVATE_ANSWER_UPGRADE_CANARY']}]}),'upgrade-learner','upgrade-reviewer',stamp,stamp,stamp]);
    await exec('INSERT INTO organizations(id,name,created_at) VALUES(?,?,?)',['upgrade-org','TEST ONLY organization',stamp]);
    await exec('INSERT INTO memberships(organization_id,user_id,role,created_at) VALUES(?,?,?,?)',['upgrade-org','upgrade-learner','member',stamp]);
    await exec('INSERT INTO enrollments(id,user_id,version_id,organization_id,status,access_until,created_at,reason) VALUES(?,?,?,?,?,?,?,?)',['upgrade-enrollment','upgrade-learner','upgrade-version','upgrade-org','completed','2027-01-01T00:00:00.000Z',stamp,'TEST historical record']);
    await exec('INSERT INTO lesson_progress(enrollment_id,lesson_id,completed,revision,evidence_json,completed_by,completed_at) VALUES(?,?,1,3,?,?,?)',['upgrade-enrollment','lesson','{"private":"PRIVATE_PROGRESS_CANARY"}','upgrade-learner',stamp]);
    await exec('INSERT INTO attempts(id,enrollment_id,status,deadline_at,revision,form_json,answers_json,result_json,created_at,submitted_at) VALUES(?,?,?,?,?,?,?,?,?,?)',['upgrade-attempt','upgrade-enrollment','graded',stamp,4,'{"questions":["PRIVATE_FORM_CANARY"]}','{"q":["PRIVATE_DRAFT_CANARY"]}','{"pass":true,"score":100,"gradedAt":"2026-01-01T00:00:00.000Z"}',stamp,stamp]);
    await exec('INSERT INTO credentials(id,enrollment_id,attempt_id,serial,status,snapshot_json,verification_hash,document_base64,document_sha256,issued_at,issued_by,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',['upgrade-credential','upgrade-enrollment','upgrade-attempt','TEST-ONLY-UPGRADE-SERIAL','issued','{"learnerName":"PRIVATE_SNAPSHOT_CANARY","programTitle":"TEST ONLY","verificationUrl":"https://example.test/verify/PRIVATE_TEST_TOKEN"}','PRIVATE_VERIFICATION_HASH_CANARY',Buffer.from('TEST ONLY PRIVATE PDF BYTES').toString('base64'),'PRIVATE_DOCUMENT_HASH_CANARY',stamp,'upgrade-reviewer',stamp]);
    await exec('INSERT INTO outbox(id,type,aggregate_id,payload_json,status,attempts,available_at,last_error,created_at,updated_at,lease_token,lease_until) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',['upgrade-job','auth.email','upgrade-learner','{"to":"migration-learner@example.test","token":"PRIVATE_MAIL_CANARY"}','pending',2,stamp,'TEST_RETRY',stamp,stamp,null,null]);
    await exec('INSERT INTO consent_records(id,user_id,purpose,version,granted_at) VALUES(?,?,?,?,?)',['upgrade-consent','upgrade-learner','privacy','TEST-V1',stamp]);
    await exec('INSERT INTO audit_events(id,actor_id,organization_id,action,target,reason,created_at) VALUES(?,?,?,?,?,?,?)',['upgrade-audit','upgrade-reviewer','upgrade-org','TEST_HISTORICAL_ACTION','upgrade-enrollment','TEST ONLY immutable evidence',stamp]);
    await exec('INSERT INTO notifications(id,user_id,purpose,template,payload_json,status,dedupe_key,created_at) VALUES(?,?,?,?,?,?,?,?)',['upgrade-notice','upgrade-learner','service','TEST_TEMPLATE','{"private":"PRIVATE_NOTICE_CANARY"}','read','upgrade-notice-key',stamp]);
    await exec('INSERT INTO corporate_invoices(id,number,organization_id,version_id,status,amount_minor,currency,snapshot_json,created_by,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)',['upgrade-invoice','TEST-INVOICE','upgrade-org','upgrade-version','preparing',101,'KZT','{"private":"PRIVATE_INVOICE_CANARY"}','upgrade-reviewer',stamp]);
    await exec('INSERT INTO corporate_invoice_lines(id,invoice_id,user_id,amount_minor,snapshot_json,allocated_amount_minor) VALUES(?,?,?,?,?,?)',['upgrade-line','upgrade-invoice','upgrade-learner',101,'{"test":true}',0]);
    // The old schema allowed zero and negative refund amounts. Preserve those exact
    // historical facts for review instead of normalizing them into invented receipts.
    for (const [index, amount] of [125000, 0, -1].entries()) {
      const order = `upgrade-refund-order-${index}`, payment = `upgrade-refund-payment-${index}`;
      await exec('INSERT INTO orders(id,user_id,version_id,status,amount_minor,currency,snapshot_json,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)', [order,'upgrade-learner','upgrade-version','refunded',125000,'KZT','{"synthetic":"old financial fact"}',stamp,stamp]);
      await exec('INSERT INTO payments(id,order_id,provider,status,amount_minor,currency,merchant,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)', [payment,order,'sandbox','refunded',125000,'KZT','TEST ONLY',stamp,stamp]);
      await exec('INSERT INTO refunds(id,order_id,status,amount_minor,reason,actor_id,created_at) VALUES(?,?,?,?,?,?,?)', [`upgrade-refund-${index}`,order,'confirmed',amount,'TEST legacy financial fact','upgrade-reviewer',stamp]);
    }
    for (const [index,status] of ['accepted','note_pending','delivered'].entries()) {
      await exec('INSERT INTO lead_submissions(id,payload_json,request_hash,idempotency_key,status,crm_lead_id,crm_note_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)',
        [`upgrade-lead-${index}`,JSON.stringify({name:'PRIVATE MIGRATION LEAD',email:'migration-lead@example.test',organizationName:index?'TEST historical organization':''}),`TEST-HASH-${index}`,`TEST-KEY-${index}`,status,index?100+index:null,status==='delivered'?201:null,stamp,stamp]);
    }
    if (baseline >= 10) {
      await exec('INSERT INTO audit_events(id,actor_id,action,target,created_at,request_id,correlation_id,origin_request_id,source_job_id) VALUES(?,?,?,?,?,?,?,?,?)',
        ['upgrade-correlated-audit','upgrade-reviewer','TEST_PRIOR_OBSERVATION','upgrade-lead-0',stamp,'PRIVATE_PRIOR_REQUEST','PRIVATE_PRIOR_CORRELATION','PRIVATE_PRIOR_ORIGIN','PRIVATE_PRIOR_JOB']);
      await exec('UPDATE outbox SET request_id=?,correlation_id=?,origin_request_id=?,source_job_id=? WHERE id=?',
        ['PRIVATE_PRIOR_REQUEST','PRIVATE_PRIOR_CORRELATION','PRIVATE_PRIOR_ORIGIN','PRIVATE_PRIOR_JOB','upgrade-job']);
    }
    const oldTables = await tableNames(db); const before = await snapshot(db,oldTables);
    const snapshotPath = join(directory,'synthetic-before-upgrade.json'); await writeFile(snapshotPath,JSON.stringify(before),{mode:0o600});
    const protectedSchema = (await exec("SELECT type,name,tbl_name,sql FROM sqlite_master WHERE type IN ('index','trigger') AND sql IS NOT NULL ORDER BY name")).rows;

    await migrate(db,currentDirectory);
    const after = await snapshot(db,oldTables);
    const exported = JSON.parse(await readFile(snapshotPath,'utf8'));
    for (const name of oldTables.filter(name=>name!=='schema_migrations')) {
      let expected = baseline < 10 && ['audit_events','outbox'].includes(name) ? exported[name].map((row: Record<string, unknown>) => ({ ...row, request_id: null, correlation_id: null, origin_request_id: null, source_job_id: null })) : exported[name];
      if (name === 'refunds') expected = expected.map((row: Record<string, unknown>) => ({ ...row, payment_id: null, currency: 'KZT', refunded_total_minor: null }));
      assert.deepEqual(after[name],expected,`${name}: every old value unchanged; new context columns intentionally NULL`);
    }
    assert.deepEqual(after.schema_migrations!.slice(0,baseline),exported.schema_migrations);
    assert.deepEqual(after.schema_migrations!.slice(baseline).map((row:any)=>row.name),names.slice(baseline));
    assert.equal(after.schema_migrations!.length,13);
    const newTables = (await tableNames(db)).filter(name=>!oldTables.includes(name));
    const expectedAdditions = baseline < 12 ? ['lead_qualifications','sales_links','sales_proposals'] : [];
    if (baseline < 11) expectedAdditions.push('lead_attributions','public_journey_steps','public_journeys');
    if (baseline < 10) expectedAdditions.push('credential_batch_items','credential_batches','learning_reminder_deliveries','learning_reminder_preferences','learning_reminders','operational_counters','operational_incidents','program_intake_controls','support_notes');
    assert.deepEqual(newTables,expectedAdditions.sort());
    for (const name of newTables) assert.equal(Number((await exec(`SELECT COUNT(*) n FROM ${identifier(name)}`)).rows[0]!.n),0,`${name}: migration invents no attribution, qualification, proposal, link or operational fact`);
    assert.equal(Number((await exec('PRAGMA foreign_keys')).rows[0]!.foreign_keys),1);
    assert.deepEqual((await exec('PRAGMA foreign_key_check')).rows,[]);
    assert.deepEqual((await exec('PRAGMA integrity_check')).rows.map(row=>row.integrity_check),['ok']);
    for (const schema of protectedSchema) {
      const actual=(await exec('SELECT type,name,tbl_name,sql FROM sqlite_master WHERE name=?',[schema.name])).rows[0];
      if (schema.name === 'refunds_one_confirmed') { assert.equal(actual,undefined,'only the one-refund restriction is replaced by the cumulative ledger'); continue; }
      assert.deepEqual(actual,schema,`historical ${schema.type} ${schema.name} unchanged`);
    }
    assert.equal(Number((await exec("SELECT COUNT(*) n FROM sqlite_master WHERE type='index' AND name='refunds_confirmed_order'")).rows[0]!.n),1);
    await assert.rejects(exec("UPDATE refunds SET amount_minor=1 WHERE id='upgrade-refund-0'"),/immutable/i);
    await assert.rejects(exec("DELETE FROM refunds WHERE id='upgrade-refund-1'"),/immutable/i);
    await assert.rejects(exec('UPDATE program_versions SET data_json=? WHERE id=?',['{}','upgrade-version']),/immutable/i);
    await assert.rejects(exec('DELETE FROM program_versions WHERE id=?',['upgrade-version']),/immutable/i);
    await assert.rejects(exec('UPDATE attempts SET result_json=? WHERE id=?',['{"pass":false}','upgrade-attempt']),/immutable/i);
    await assert.rejects(exec('UPDATE audit_events SET reason=? WHERE id=?',['changed','upgrade-audit']),/append-only/i);
    await assert.rejects(exec('DELETE FROM audit_events WHERE id=?',['upgrade-audit']),/append-only/i);
    await assert.rejects(exec('INSERT INTO enrollments(id,user_id,version_id,created_at) VALUES(?,?,?,?)',['bad-old-reference','no-user','upgrade-version',stamp]),/FOREIGN KEY/i);
    await assert.rejects(exec('INSERT INTO support_notes(id,user_id,author_id,body,created_at) VALUES(?,?,?,?,?)',['bad-new-reference','no-user','upgrade-reviewer','TEST invalid reference only',stamp]),/FOREIGN KEY/i);
    await migrate(db,currentDirectory);
    assert.deepEqual(await snapshot(db,oldTables),after,'replaying the upgrade and rejecting invalid mutations never resets historical data or migration timestamps');
  } finally { db.close(); }
}

const [baselineText, directoryText] = process.argv.slice(2);
assert.equal(process.env.NODE_ENV, 'test');
assert.equal(process.env.OT_ALLOW_MIGRATION_FIXTURE, '1', 'Explicit isolated migration fixture only');
assert.ok(!process.env.VERCEL && !process.env.TURSO_DATABASE_URL && !process.env.TURSO_AUTH_TOKEN);
assert.ok(baselineText === '5' || baselineText === '10' || baselineText === '12');
assert.ok(directoryText);
const directory = resolve(directoryText);
assert.ok(directory.startsWith(`${resolve(tmpdir())}${sep}`) && basename(directory).startsWith('ot-migration-upgrade-'));
await verifyUpgrade(Number(baselineText), directory);
process.stdout.write(JSON.stringify({ baseline: Number(baselineText), target: 13, assertions: 'passed' }) + '\n');
