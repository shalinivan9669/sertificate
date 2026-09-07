import assert from 'node:assert/strict';
import { test } from 'node:test';
import { copyFile, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
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

test('additive migration upgrade 001-005 to 001-009 preserves every old row, private payload and immutable/FK constraint', async () => {
  const directory = await mkdtemp(join(tmpdir(),'ot-migration-upgrade-'));
  const historicalDirectory = join(directory,'migrations-through-005'); await mkdir(historicalDirectory);
  const currentDirectory = resolve('server/db/migrations');
  const names = (await readdir(currentDirectory)).filter(name=>/^\d+[-_].*\.sql$/.test(name)).sort();
  const historical = names.filter(name=>Number(name.slice(0,3))<=5);
  assert.equal(historical.length,5); assert.equal(names.length,9,'This explicitly bounded regression targets schema 009');
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
    const oldTables = await tableNames(db); const before = await snapshot(db,oldTables);
    const snapshotPath = join(directory,'synthetic-before-upgrade.json'); await writeFile(snapshotPath,JSON.stringify(before),{mode:0o600});
    const protectedSchema = (await exec("SELECT type,name,tbl_name,sql FROM sqlite_master WHERE type IN ('index','trigger') AND sql IS NOT NULL ORDER BY name")).rows;

    await migrate(db,currentDirectory);
    const after = await snapshot(db,oldTables);
    const exported = JSON.parse(await readFile(snapshotPath,'utf8'));
    for (const name of oldTables.filter(name=>name!=='schema_migrations')) assert.deepEqual(after[name],exported[name],`${name}: all rows and private values unchanged`);
    assert.deepEqual(after.schema_migrations!.slice(0,5),exported.schema_migrations);
    assert.deepEqual(after.schema_migrations!.slice(5).map((row:any)=>row.name),names.slice(5));
    assert.equal(after.schema_migrations!.length,9);
    const newTables = (await tableNames(db)).filter(name=>!oldTables.includes(name));
    assert.deepEqual(newTables,['credential_batch_items','credential_batches','learning_reminder_deliveries','learning_reminder_preferences','learning_reminders','operational_counters','operational_incidents','program_intake_controls','support_notes']);
    for (const name of newTables) assert.equal(Number((await exec(`SELECT COUNT(*) n FROM ${identifier(name)}`)).rows[0]!.n),0,`${name}: no seeded controls, reminders, alerts, notes or batch actions`);
    assert.equal(Number((await exec('PRAGMA foreign_keys')).rows[0]!.foreign_keys),1);
    assert.deepEqual((await exec('PRAGMA foreign_key_check')).rows,[]);
    assert.deepEqual((await exec('PRAGMA integrity_check')).rows.map(row=>row.integrity_check),['ok']);
    for (const schema of protectedSchema) {
      const actual=(await exec('SELECT type,name,tbl_name,sql FROM sqlite_master WHERE name=?',[schema.name])).rows[0];
      assert.deepEqual(actual,schema,`historical ${schema.type} ${schema.name} unchanged`);
    }
    await assert.rejects(exec('UPDATE program_versions SET data_json=? WHERE id=?',['{}','upgrade-version']),/immutable/i);
    await assert.rejects(exec('DELETE FROM program_versions WHERE id=?',['upgrade-version']),/immutable/i);
    await assert.rejects(exec('UPDATE attempts SET result_json=? WHERE id=?',['{"pass":false}','upgrade-attempt']),/immutable/i);
    await assert.rejects(exec('UPDATE audit_events SET reason=? WHERE id=?',['changed','upgrade-audit']),/append-only/i);
    await assert.rejects(exec('DELETE FROM audit_events WHERE id=?',['upgrade-audit']),/append-only/i);
    await assert.rejects(exec('INSERT INTO enrollments(id,user_id,version_id,created_at) VALUES(?,?,?,?)',['bad-old-reference','no-user','upgrade-version',stamp]),/FOREIGN KEY/i);
    await assert.rejects(exec('INSERT INTO support_notes(id,user_id,author_id,body,created_at) VALUES(?,?,?,?,?)',['bad-new-reference','no-user','upgrade-reviewer','TEST invalid reference only',stamp]),/FOREIGN KEY/i);
    await migrate(db,currentDirectory);
    assert.deepEqual(await snapshot(db,oldTables),after,'replaying the upgrade and rejecting invalid mutations never resets historical data or migration timestamps');
  } finally {
    db.close(); const target=resolve(directory);
    assert.ok(target.startsWith(`${resolve(tmpdir())}${sep}`)&&basename(target).startsWith('ot-migration-upgrade-'));
    await rm(target,{recursive:true,force:true,maxRetries:10,retryDelay:100});
  }
});
