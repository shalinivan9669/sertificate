/** Isolated local acceptance scenarios, never production data or runtime imports. */
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { closeDb, execute, queryOne } from '../server/db';
import { createVersion, publishVersion, reviewVersion, type ProgramData } from '../server/services/catalog';
import { createEnrollment, completeLesson } from '../server/services/learning';
import { startAttempt, saveAnswer, submitAttempt } from '../server/services/assessment';
import { createCredentialTemplate, approveCredentialTemplate, issueCredential, renderCredential, getCredential } from '../server/services/credentials';
import type { AppUser } from '../server/utils/auth';

if (process.env.NODE_ENV !== 'test' || process.env.OT_ALLOW_TEST_SEED !== '1' || process.env.VERCEL || process.env.VERCEL_ENV || process.env.TURSO_DATABASE_URL || process.env.TURSO_AUTH_TOKEN) throw new Error('Explicit local synthetic acceptance environment required');
const directory = await mkdtemp(join(tmpdir(),'ot-extra-acceptance-'));
process.env.OT_DATABASE_PATH = join(directory,'e2e.sqlite');
process.env.OT_E2E_FIXTURE_PATH = resolve('.data/extra-acceptance-fixture.json');
process.env.BETTER_AUTH_URL = 'http://127.0.0.1:3106'; process.env.NUXT_PUBLIC_SITE_URL = process.env.BETTER_AUTH_URL;
await import('./e2e-fixtures');
const fixture = JSON.parse(await readFile(process.env.OT_E2E_FIXTURE_PATH,'utf8'));
const editor = fixture.editor as AppUser; const reviewer = fixture.reviewer as AppUser;
async function publication(content: ProgramData, program='ohrana-truda') {
  const draft=(await createVersion(editor,program,content)).version; const reviewed=(await reviewVersion(editor,draft.id,draft.revision)).version;
  return (await publishVersion(reviewer,reviewed.id,reviewed.revision,'Independent synthetic acceptance fixture review')).version.id;
}
try {
  const original=JSON.parse((await queryOne('SELECT data_json FROM program_versions WHERE id=?',[fixture.versionId]))!.data_json) as ProgramData;
  const kkVersionId=await publication({ ...original,language:'kk',title:'[TEST ONLY] KK acceptance learning' });
  const paidVersionId=await publication({ ...original,title:'[TEST ONLY] Paid acceptance metadata',accessModel:'paid',priceMinor:12300 },'ptm');
  const issuer: AppUser={ id:'extra-test-issuer',name:'SYNTHETIC ISSUER',email:'extra-issuer@example.test',role:'issuer',twoFactorEnabled:true,mfaVerifiedAt:Date.now() };
  await execute('INSERT INTO "user"(id,name,email,emailVerified,role,twoFactorEnabled,createdAt,updatedAt) VALUES(?,?,?,1,?,1,1,1)',[issuer.id,issuer.name,issuer.email,issuer.role]);
  const learner={ ...fixture.other,role:'learner',twoFactorEnabled:false } as AppUser;
  const en=(await createEnrollment(learner,{userId:learner.id,versionId:fixture.versionId},randomUUID(),true)).enrollment;
  await completeLesson(learner,en.id,fixture.lessonId,0);
  let attempt=await startAttempt(learner,en.id,randomUUID());
  for (const question of original.questions) attempt=await saveAnswer(learner,attempt.id,question.id,question.correctOptionIds,attempt.revision);
  await submitAttempt(learner,attempt.id);
  const document=await PDFDocument.create(); const page=document.addPage([620,800]);
  page.drawText('SYNTHETIC LOCAL ACCEPTANCE TEST - NO VALIDITY',{x:25,y:765,size:12,font:await document.embedFont(StandardFonts.Helvetica)});
  const fieldMap=Object.fromEntries(['learnerName','programTitle','serial','issuedAt','verificationUrl','issuerName'].map((key,index)=>{ document.getForm().createTextField(key).addToPage(page,{x:25,y:700-index*70,width:565,height:48}); return [key,key]; }));
  const template=(await createCredentialTemplate(issuer.id,{programId:'ohrana-truda',name:'SYNTHETIC ACCEPTANCE FORM',issuerName:'TEST ISSUER - NO VALIDITY',pdfBase64:Buffer.from(await document.save()).toString('base64'),fieldMap})).template;
  await approveCredentialTemplate(reviewer.id,template.id,'Independent synthetic PDF form review');
  const credential=(await issueCredential(issuer.id,en.id,'Synthetic service pipeline for HTTP contract test')).credential;
  await renderCredential(credential.id);
  const final=await getCredential(credential.id,learner.id);
  if (final.status !== 'issued') throw new Error('Synthetic service-issued credential required');
  await writeFile(process.env.OT_E2E_FIXTURE_PATH,JSON.stringify({...fixture,kkVersionId,paidVersionId,baseUrl:'http://127.0.0.1:3106',verificationUrl:final.verificationUrl,verificationSerial:final.serial,verificationLearner:learner.name,notice:'SYNTHETIC LOCAL TEST DATA ONLY'}),{mode:0o600});
  console.log('Extra acceptance fixture ready; all secrets remain in ignored local manifest.');
} finally { await closeDb(); }
