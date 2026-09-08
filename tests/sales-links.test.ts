import assert from 'node:assert/strict';
import type { TransactionMode } from '@libsql/client';
import {before,after,test} from 'node:test';
import {createHmac,randomUUID} from 'node:crypto';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,sep,basename} from 'node:path';
import {closeDb,getDb,execute,queryAll,queryOne} from '../server/db';
import {acceptLead} from '../server/services/leads';
import {qualifyLead,linkLead,revokeSalesLink,recordSalesProposal,attachProposalOrganization,attachProposalAssignments,withdrawSalesProposal,listSalesLeads,getSalesLead,salesTargets} from '../server/services/sales-links';
import {salesReport} from '../server/services/sales-report';
import {completeLesson,confirmPractice} from '../server/services/learning';
import {startAttempt,saveAnswer,submitAttempt} from '../server/services/assessment';
import {PDFDocument} from 'pdf-lib';
import {createCredentialTemplate,approveCredentialTemplate,issueCredential,renderCredential,revokeCredential} from '../server/services/credentials';
import {createInvoice,confirmInvoice} from '../server/services/invoices';
import {createOrder,checkout,processPaymentWebhook,refundOrder} from '../server/services/commerce';
import type {AppUser} from '../server/utils/auth';

let directory:string;const keys=['NODE_ENV','OT_DATABASE_PATH','OT_MIGRATIONS_DIR','TURSO_DATABASE_URL','TURSO_AUTH_TOKEN','VERCEL','OT_ANALYTICS_ENABLED','OT_PAYMENT_TERMS_APPROVED','OT_PAYMENT_TERMS_VERSION','OT_PAYMENT_PROVIDER','OT_APP_ENV','OT_SANDBOX_WEBHOOK_SECRET','OT_SANDBOX_MERCHANT','OT_INVOICE_ENABLED','OT_INVOICE_ISSUER_JSON'];
const previous=Object.fromEntries(keys.map(key=>[key,process.env[key]]));
const admin:AppUser={id:'sales-admin',name:'ISOLATED SALES ADMIN',email:'sales-admin@example.test',role:'admin',twoFactorEnabled:true,mfaVerifiedAt:Date.now()};
const learner:AppUser={...admin,id:'sales-learner',name:'PRIVATE_LEARNER_NAME',email:'sales-learner@example.test',role:'learner',twoFactorEnabled:false,mfaVerifiedAt:null};
const reason='ISOLATED TEST verified explicit relationship';
const rejects=(promise:Promise<unknown>,code:string)=>assert.rejects(promise,(e:any)=>e?.data?.code===code);
const from=new Date(Date.now()-86400000).toISOString();const until=()=>new Date(Date.now()+1000).toISOString();
const data={title:'ISOLATED SALES TEST - NOT TRAINING',language:'ru',accessModel:'free',modules:[{id:'m',title:'TEST',lessons:[{id:'l1',title:'TEST1',kind:'text',required:true,body:'TEST',media:[]},{id:'l2',title:'TEST2',kind:'text',required:true,body:'TEST',media:[]}]}],assessment:{durationMinutes:10,maxAttempts:3,passPercent:100,questionCount:1,retakeDelayMinutes:0},questions:[{id:'q1',text:'TEST?',topic:'Test',options:[{id:'a',text:'TEST CORRECT'},{id:'b',text:'TEST WRONG'}],correctOptionIds:['a']}]};
before(async()=>{directory=await mkdtemp(join(tmpdir(),'ot-sales-test-'));Object.assign(process.env,{NODE_ENV:'test',OT_DATABASE_PATH:join(directory,'test.sqlite'),OT_ANALYTICS_ENABLED:'0'});for(const key of ['OT_MIGRATIONS_DIR','VERCEL','TURSO_DATABASE_URL','TURSO_AUTH_TOKEN'])delete process.env[key];await getDb();
  Object.assign(process.env,{OT_PAYMENT_TERMS_APPROVED:'1',OT_PAYMENT_TERMS_VERSION:'ISOLATED-TEST',OT_PAYMENT_PROVIDER:'sandbox',OT_APP_ENV:'test',OT_SANDBOX_WEBHOOK_SECRET:randomUUID(),OT_SANDBOX_MERCHANT:'ISOLATED-SALES-TEST',OT_INVOICE_ENABLED:'1',OT_INVOICE_ISSUER_JSON:JSON.stringify({name:'ISOLATED TEST ISSUER DO NOT PAY',bin:'000000000000',address:'ISOLATED TEST ADDRESS',bankName:'ISOLATED TEST BANK',bic:'TESTKZ00',iban:'KZ000000000000000000',paymentPurpose:'ISOLATED TEST ONLY DO NOT PAY'})});
  for(const user of [admin,learner])await execute('INSERT INTO "user"(id,name,email,emailVerified,createdAt,updatedAt,role,twoFactorEnabled) VALUES(?,?,?,1,?,?,?,?)',[user.id,user.name,user.email,Date.now(),Date.now(),user.role,Number(user.twoFactorEnabled)]);
  // Pinned source content fixture only. All tested sales transitions and happy-path grading use services.
  await execute("INSERT INTO program_versions(id,program_id,version,status,data_json,created_by,approved_by,published_at,created_at,updated_at) VALUES('sales-version','ohrana-truda',1,'published',?,?,?,?,?,?)",[JSON.stringify(data),admin.id,learner.id,from,from,from]);
});
after(async()=>{await closeDb();const target=resolve(directory);assert.ok(target.startsWith(resolve(tmpdir())+sep)&&basename(target).startsWith('ot-sales-test-'));await rm(target,{recursive:true,force:true,maxRetries:10,retryDelay:100});for(const key of keys){if(previous[key]===undefined)delete process.env[key];else process.env[key]=previous[key];}});
async function newLead(b2b=false){const result=await acceptLead({name:'PRIVATE_SALES_NAME',email:'private-sales@example.test',phone:'+77000000000',organizationName:b2b?'PRIVATE_SALES_ORG':''},randomUUID());assert.ok('submissionId'in result);return result.submissionId;}
async function qualified(b2b=false){const id=await newLead(b2b);await qualifyLead(admin,id,{status:'in_review',revision:0,reason},randomUUID());await qualifyLead(admin,id,{status:'qualified',revision:1,reason},randomUUID());return id;}
async function enrollment(organizationId:string|null=null,versionId='sales-version'){const id=randomUUID();await execute('INSERT INTO enrollments(id,user_id,version_id,organization_id,status,created_at) VALUES(?,?,?,?,?,?)',[id,learner.id,versionId,organizationId,'active',new Date().toISOString()]);return id;}
async function publication(content:unknown){const id=randomUUID(),version=Number((await queryOne('SELECT MAX(version) n FROM program_versions WHERE program_id=?',['ohrana-truda']))?.n||0)+1;await execute("INSERT INTO program_versions(id,program_id,version,status,data_json,created_by,approved_by,published_at,created_at,updated_at) VALUES(?,'ohrana-truda',?,'published',?,?,?,?,?,?)",[id,version,JSON.stringify(content),admin.id,learner.id,from,from,from]);return id;}
async function organization(){const id=randomUUID();await execute('INSERT INTO organizations(id,name,created_at) VALUES(?,?,?)',[id,'PRIVATE_TEST_ORG',from]);await execute('INSERT INTO memberships(organization_id,user_id,role,created_at) VALUES(?,?,?,?)',[id,learner.id,'owner',from]);return id;}
const stage=(report:Awaited<ReturnType<typeof salesReport>>,kind:'b2c'|'proposals'|'journeyOutcomes',id:string)=>report[kind].stages.find(stage=>stage.id===id)?.count||0;

test('sales workspace rejects unprivileged, missing MFA and freshly revoked admin including idempotent replays',async()=>{
  const lead=await newLead();await rejects(listSalesLeads(learner),'FORBIDDEN');await rejects(getSalesLead({...admin,mfaVerifiedAt:null},lead),'MFA_REQUIRED');await rejects(salesTargets(learner,{kind:'organization'}),'FORBIDDEN');
  const key=randomUUID(),body={status:'in_review',revision:0,reason};await qualifyLead(admin,lead,body,key);
  await execute('UPDATE "user" SET role=? WHERE id=?',['learner',admin.id]);await rejects(qualifyLead(admin,lead,body,key),'FORBIDDEN');await rejects(salesReport(admin,from,until()),'FORBIDDEN');await execute('UPDATE "user" SET role=? WHERE id=?',['admin',admin.id]);
});
test('qualification transitions require revision/reason and are atomic/idempotent with durable audit',async()=>{
  const lead=await newLead();await rejects(qualifyLead(admin,lead,{status:'qualified',revision:0,reason},randomUUID()),'QUALIFICATION_TRANSITION_INVALID');await rejects(qualifyLead(admin,lead,{status:'in_review',revision:0,reason:'x'},randomUUID()),'VALIDATION_ERROR');
  const key=randomUUID(),body={status:'in_review',revision:0,requestType:'document_status',reason};const one=await qualifyLead(admin,lead,body,key);const replay=await qualifyLead(admin,lead,body,key);assert.equal(one.lead.qualification.revision,1);assert.equal(replay.lead.qualification.revision,1);
  await rejects(qualifyLead(admin,lead,{...body,reason:'ISOLATED other changed reason'},key),'IDEMPOTENCY_CONFLICT');await rejects(qualifyLead(admin,lead,{status:'qualified',revision:0,reason},randomUUID()),'REVISION_CONFLICT');
  await execute("CREATE TRIGGER test_sales_audit_failure BEFORE INSERT ON audit_events WHEN NEW.action='sales.qualification_qualified' BEGIN SELECT RAISE(ABORT,'ISOLATED AUDIT FAILURE'); END");
  await assert.rejects(qualifyLead(admin,lead,{status:'qualified',revision:1,reason},randomUUID()));assert.equal((await getSalesLead(admin,lead)).lead.qualification.status,'in_review');await execute('DROP TRIGGER test_sales_audit_failure');
  await qualifyLead(admin,lead,{status:'qualified',revision:1,reason},randomUUID());await qualifyLead(admin,lead,{status:'in_review',revision:2,reason},randomUUID());await qualifyLead(admin,lead,{status:'rejected',revision:3,reason},randomUUID());
  const report=await salesReport(admin,from,until());assert.equal(report.metrics.find(x=>x.id==='documentStatusRequests')?.value,1);
});
test('explicit links validate actual entities and immutable identity, prevent duplicate credit, and revoke without changing training',async()=>{
  const lead=await qualified(),other=await qualified(),e=await enrollment(),org=await organization(),foreign=await enrollment(org);
  await rejects(linkLead(admin,lead,{kind:'enrollment',targetId:'missing',reason},randomUUID()),'SALES_TARGET_NOT_FOUND');await rejects(linkLead(admin,lead,{kind:'enrollment',targetId:foreign,reason},randomUUID()),'SALES_ORGANIZATION_MISMATCH');
  const key=randomUUID(),body={kind:'enrollment',targetId:e,reason};const result=await linkLead(admin,lead,body,key);const replay=await linkLead(admin,lead,body,key);assert.equal(result.lead.links.length,1);assert.deepEqual(replay.lead.links,result.lead.links);
  await rejects(linkLead(admin,other,body,randomUUID()),'SALES_TARGET_ALREADY_LINKED');await assert.rejects(execute('UPDATE sales_links SET lead_id=? WHERE id=?',[other,result.lead.links[0]!.id]),/immutable/);
  await revokeSalesLink(admin,lead,result.lead.links[0]!.id,{reason},randomUUID());assert.equal((await queryOne('SELECT status FROM enrollments WHERE id=?',[e]))?.status,'active');await linkLead(admin,other,body,randomUUID());
  const choices=await salesTargets(admin,{kind:'enrollment',query:e});assert.equal(choices.targets.length,1);assert.equal(choices.targets[0]?.id,e);
});
test('B2B proposal is an explicit sent fact and only specific active-organization assignments advance it',async()=>{
  const lead=await qualified(true),org=await organization(),otherOrg=await organization(),e=await enrollment(org),future=await enrollment(org),foreign=await enrollment(otherOrg);
  const base=await salesReport(admin,from,until());const count=stage(base,'proposals','sent');
  await rejects(recordSalesProposal(admin,lead,{sentAt:new Date(Date.now()+86400000).toISOString(),reference:'FUTURE',reason},randomUUID()),'PROPOSAL_TIME_INVALID');
  const body={sentAt:new Date().toISOString(),reference:'ISOLATED SENT REFERENCE',reason},key=randomUUID();const sent=await recordSalesProposal(admin,lead,body,key);await recordSalesProposal(admin,lead,body,key);const proposal=sent.lead.proposals[0]!;
  assert.equal(stage(await salesReport(admin,from,until()),'proposals','sent'),count+1);await rejects(attachProposalAssignments(admin,lead,proposal.id,{enrollmentIds:[e],reason},randomUUID()),'PROPOSAL_ORGANIZATION_REQUIRED');
  await attachProposalOrganization(admin,lead,proposal.id,{organizationId:org,reason},randomUUID());await rejects(attachProposalAssignments(admin,lead,proposal.id,{enrollmentIds:[e,foreign],reason},randomUUID()),'SALES_ORGANIZATION_MISMATCH');assert.equal((await getSalesLead(admin,lead)).lead.links.length,0);
  await rejects(attachProposalAssignments(admin,lead,proposal.id,{enrollmentIds:[e,e],reason},randomUUID()),'DUPLICATE_ENROLLMENTS');await attachProposalAssignments(admin,lead,proposal.id,{enrollmentIds:[e],reason},randomUUID());await attachProposalAssignments(admin,lead,proposal.id,{enrollmentIds:[e],reason},randomUUID());assert.equal((await getSalesLead(admin,lead)).lead.links.length,1);
  assert.ok(!(await getSalesLead(admin,lead)).lead.links.some(link=>link.targetId===future));await execute("UPDATE memberships SET status='revoked' WHERE organization_id=?",[org]);await rejects(attachProposalAssignments(admin,lead,proposal.id,{enrollmentIds:[future],reason},randomUUID()),'ACTIVE_MEMBERSHIP_REQUIRED');
  await withdrawSalesProposal(admin,lead,proposal.id,{reason},randomUUID());assert.ok((await getSalesLead(admin,lead)).lead.links.every(link=>link.revokedAt));assert.equal((await queryOne('SELECT status FROM enrollments WHERE id=?',[e]))?.status,'active');
});
test('server progression uses one pinned enrollment path, never client status or mixed assignments',async()=>{
  const lead=await qualified(),e=await enrollment();await linkLead(admin,lead,{kind:'enrollment',targetId:e,reason},randomUUID());const before=await salesReport(admin,from,until());
  await execute("UPDATE enrollments SET status='completed' WHERE id=?",[e]);const spoofed=await salesReport(admin,from,until());assert.equal(stage(spoofed,'b2c','requiredContent'),stage(before,'b2c','requiredContent'));await execute("UPDATE enrollments SET status='active' WHERE id=?",[e]);
  await completeLesson(learner,e,'l1',0);await completeLesson(learner,e,'l2',0);
  const attempt=await startAttempt(learner,e,randomUUID());await saveAnswer(learner,attempt.id,'q1',['a'],0);await submitAttempt(learner,attempt.id);
  const report=await salesReport(admin,from,until());assert.equal(stage(report,'b2c','assessmentPassed'),stage(before,'b2c','assessmentPassed')+1);assert.equal(stage(report,'b2c','validCredential'),stage(before,'b2c','validCredential'));
  const pdf=await PDFDocument.create(),page=pdf.addPage([620,800]);page.drawText('ISOLATED TEST - NO VALIDITY',{x:25,y:750});
  const fields=Object.fromEntries(['learnerName','programTitle','serial','issuedAt','verificationUrl','issuerName'].map((key,index)=>{pdf.getForm().createTextField(key).addToPage(page,{x:25,y:670-index*60,width:550,height:40});return[key,key];}));
  const template=await createCredentialTemplate(admin.id,{programId:'ohrana-truda',name:'ISOLATED SALES PDF',issuerName:'ISOLATED ISSUER',pdfBase64:Buffer.from(await pdf.save()).toString('base64'),fieldMap:fields});
  await approveCredentialTemplate(learner.id,template.template.id,reason);const credential=(await issueCredential(admin.id,e,reason)).credential;
  assert.equal(stage(await salesReport(admin,from,until()),'b2c','validCredential'),stage(before,'b2c','validCredential'));await renderCredential(credential.id);
  assert.equal(stage(await salesReport(admin,from,until()),'b2c','validCredential'),stage(before,'b2c','validCredential')+1);await revokeCredential(admin.id,credential.id,reason);
  assert.equal(stage(await salesReport(admin,from,until()),'b2c','validCredential'),stage(before,'b2c','validCredential'));
  const serialized=JSON.stringify(report);for(const canary of ['PRIVATE_','@example.test','+77000000000','TEST CORRECT','correctOptionIds',e,lead])assert.ok(!serialized.includes(canary));
  for(const group of [report.b2c,report.proposals,report.journeyOutcomes])for(let i=1;i<group.stages.length;i++){assert.equal(group.stages[i]!.denominator,group.stages[i-1]!.count);assert.ok(group.stages[i]!.count<=group.stages[i]!.denominator);}
});

test('journey funnel accepts direct program landing, respects order and pre-accept snapshots, and never joins by contact',async()=>{
  const makeJourney=async(leadId:string,options:{late?:boolean;reverse?:boolean}={})=>{const id=randomUUID(),start=new Date(Date.now()-10000).toISOString(),snapshot=new Date().toISOString(),expires=new Date(Date.now()+3600000).toISOString();const context={routeId:'program',programId:'ohrana-truda',locale:'ru',source:'search',city:'astana'};
    await execute('INSERT INTO public_journeys(id,consent_version,created_at,updated_at,expires_at) VALUES(?,?,?,?,?)',[id,'analytics-v2',start,snapshot,expires]);
    for(const[sequence,step]of [[1,options.reverse?'consultation':'program'],[2,options.reverse?'program':'consultation']]as const)await execute('INSERT INTO public_journey_steps(id,journey_id,sequence,step,context_json,created_at) VALUES(?,?,?,?,?,?)',[randomUUID(),id,sequence,step,JSON.stringify(context),options.late&&sequence===2?new Date(Date.now()+100).toISOString():start]);
    await execute('INSERT INTO lead_attributions(lead_id,journey_id,last_sequence,first_touch_json,last_touch_json,consent_version,created_at,expires_at) VALUES(?,?,?,?,?,?,?,?)',[leadId,id,2,JSON.stringify(context),JSON.stringify(context),'analytics-v2',snapshot,expires]);return id;};
  const before=await salesReport(admin,from,until()),lead=await qualified(),e=await enrollment();await linkLead(admin,lead,{kind:'enrollment',targetId:e,reason},randomUUID());const id=await makeJourney(lead);
  const late=await qualified();await makeJourney(late,{late:true});const reversed=await qualified();await makeJourney(reversed,{reverse:true});
  const result=await salesReport(admin,from,until(),Date.now()+1000);assert.equal(stage(result,'journeyOutcomes','journeys'),stage(before,'journeyOutcomes','journeys')+3);assert.equal(stage(result,'journeyOutcomes','landing'),stage(before,'journeyOutcomes','landing')+3);
  assert.equal(stage(result,'journeyOutcomes','accepted'),stage(before,'journeyOutcomes','accepted')+1);assert.equal(stage(result,'journeyOutcomes','confirmedAccess'),stage(before,'journeyOutcomes','confirmedAccess')+1);assert.ok(result.qualifiedSources.some(row=>row.routeId==='program'&&row.city==='astana'&&row.qualifiedLeads===3));
  await execute('UPDATE public_journeys SET expires_at=? WHERE id=?',[from,id]);assert.equal(stage(await salesReport(admin,from,until()),'journeyOutcomes','confirmedAccess'),stage(before,'journeyOutcomes','confirmedAccess'));
  assert.equal((await getSalesLead(admin,lead)).lead.links.length,1,'expiry does not erase operational relationships');
});

test('mixed enrollments and corrupted link identities cannot fabricate completed stages',async()=>{
  const lead=await qualified(),e1=await enrollment(),e2=await enrollment();await linkLead(admin,lead,{kind:'enrollment',targetId:e1,reason},randomUUID());await linkLead(admin,lead,{kind:'enrollment',targetId:e2,reason},randomUUID());
  const before=await salesReport(admin,from,until());await completeLesson(learner,e1,'l1',0);await completeLesson(learner,e1,'l2',0);
  // Deliberately corrupt academic fixture: a passed result on a DIFFERENT assignment without required lessons.
  await execute("INSERT INTO attempts(id,enrollment_id,status,deadline_at,form_json,result_json,created_at,submitted_at) VALUES(?,?,'graded',?,'{}','{\"pass\":true}',?,?)",[randomUUID(),e2,from,from,from]);
  const result=await salesReport(admin,from,until());assert.equal(stage(result,'b2c','requiredContent'),stage(before,'b2c','requiredContent')+1);assert.equal(stage(result,'b2c','assessmentPassed'),stage(before,'b2c','assessmentPassed'));
  const other=await qualified(true),org=await organization();const sent=await recordSalesProposal(admin,other,{sentAt:new Date().toISOString(),reference:randomUUID(),reason},randomUUID());const proposal=sent.lead.proposals[0]!;await attachProposalOrganization(admin,other,proposal.id,{organizationId:org,reason},randomUUID());
  const wrong=await enrollment();await execute('INSERT INTO sales_links(id,lead_id,proposal_id,kind,enrollment_id,created_by,created_at) VALUES(?,?,?,?,?,?,?)',[randomUUID(),lead,proposal.id,'enrollment',wrong,admin.id,from]);
  const corrupt=await salesReport(admin,from,until());assert.ok(corrupt.b2c.invalidLinks>result.b2c.invalidLinks);assert.equal(stage(corrupt,'proposals','assigned'),stage(result,'proposals','assigned'));
});

test('an actual signed sandbox order grants only its own verified access; pending, tampered and refunded states do not',async()=>{
  const versionId=await publication({...data,accessModel:'paid',priceMinor:120000,currency:'KZT'}),lead=await qualified();
  const order=await createOrder(learner.id,{versionId},randomUUID());await linkLead(admin,lead,{kind:'order',targetId:order.id,reason},randomUUID());
  const baseline=await salesReport(admin,from,until());const pending=await checkout(order.id,learner.id);
  const event={eventId:randomUUID(),paymentId:pending.paymentId,merchant:process.env.OT_SANDBOX_MERCHANT!,amountMinor:120000,currency:'KZT',status:'succeeded',timestamp:Date.now()};
  const post=async(body:unknown)=>{const raw=JSON.stringify(body);return processPaymentWebhook(raw,createHmac('sha256',process.env.OT_SANDBOX_WEBHOOK_SECRET!).update(raw).digest('hex'));};
  await rejects(post({...event,amountMinor:1}),'PAYMENT_MISMATCH');assert.equal(stage(await salesReport(admin,from,until()),'b2c','confirmedAccess'),stage(baseline,'b2c','confirmedAccess'));
  await post(event);await post(event);const paid=await salesReport(admin,from,until());assert.equal(stage(paid,'b2c','confirmedAccess'),stage(baseline,'b2c','confirmedAccess')+1);assert.equal(paid.b2c.invalidLinks,baseline.b2c.invalidLinks);
  await execute('UPDATE "user" SET emailVerified=0 WHERE id=?',[learner.id]);assert.ok(stage(await salesReport(admin,from,until()),'b2c','confirmedAccess')<stage(paid,'b2c','confirmedAccess'));await execute('UPDATE "user" SET emailVerified=1 WHERE id=?',[learner.id]);
  await refundOrder(order.id,admin.id,reason);assert.equal(stage(await salesReport(admin,from,until()),'b2c','confirmedAccess'),stage(baseline,'b2c','confirmedAccess'));
});

test('confirmed corporate invoice links exactly its two existing fulfillments atomically, never other or future assignments',async()=>{
  const org=await organization();await execute('INSERT INTO memberships(organization_id,user_id,role,created_at) VALUES(?,?,?,?)',[org,admin.id,'member',from]);
  const versionId=await publication({...data,accessModel:'paid',priceMinor:120000,currency:'KZT'}),lead=await qualified(true);
  const proposal=(await recordSalesProposal(admin,lead,{sentAt:new Date().toISOString(),reference:randomUUID(),reason},randomUUID())).lead.proposals[0]!;
  await attachProposalOrganization(admin,lead,proposal.id,{organizationId:org,reason},randomUUID());
  const {invoice}=await createInvoice(learner,org,{versionId,userIds:[learner.id,admin.id],buyer:{name:'PRIVATE TEST BUYER DO NOT PAY',bin:'111111111111',address:'PRIVATE TEST ADDRESS'}},randomUUID());
  await rejects(attachProposalAssignments(admin,lead,proposal.id,{invoiceId:invoice.id,reason},randomUUID()),'CONFIRMED_INVOICE_REQUIRED');
  await confirmInvoice(admin,invoice.id,{amountMinor:invoice.amountMinor,currency:'KZT',reference:randomUUID(),reason});
  const ids=(await queryAll<{enrollment_id:string}>('SELECT f.enrollment_id FROM corporate_invoice_fulfillments f JOIN corporate_invoice_lines l ON l.id=f.line_id WHERE l.invoice_id=?',[invoice.id])).map(row=>row.enrollment_id);
  const unrelated=await enrollment(org);const key=randomUUID(),body={invoiceId:invoice.id,reason};const count=Number((await queryOne('SELECT COUNT(*) n FROM enrollments'))!.n);
  await execute("CREATE TRIGGER test_sales_invoice_audit BEFORE INSERT ON audit_events WHEN NEW.action='sales.proposal_assignments_linked' BEGIN SELECT RAISE(ABORT,'ISOLATED ATOMIC FAILURE'); END");
  await assert.rejects(attachProposalAssignments(admin,lead,proposal.id,body,key));assert.equal((await getSalesLead(admin,lead)).lead.links.length,0);await execute('DROP TRIGGER test_sales_invoice_audit');
  const before=await salesReport(admin,from,until());const result=await attachProposalAssignments(admin,lead,proposal.id,body,key);await attachProposalAssignments(admin,lead,proposal.id,body,key);assert.deepEqual(result.lead.links.map(row=>row.targetId).sort(),ids.sort());assert.ok(!result.lead.links.some(row=>row.targetId===unrelated));
  assert.equal(Number((await queryOne('SELECT COUNT(*) n FROM enrollments'))!.n),count);assert.equal(stage(await salesReport(admin,from,until()),'proposals','confirmedAccess'),stage(before,'proposals','confirmedAccess')+1,'unit is one proposal, not two seats');
  await execute("UPDATE memberships SET status='revoked' WHERE organization_id=?",[org]);assert.equal(stage(await salesReport(admin,from,until()),'proposals','confirmedAccess'),stage(before,'proposals','confirmedAccess'));
});

test('practice requires a distinct staff confirmation; current revocation and expired access remove completion credit',async()=>{
  const versionId=await publication({...data,modules:[{id:'m',title:'TEST',lessons:[{id:'practice',title:'TEST',kind:'practice',required:true,body:'TEST',media:[]}]}]}),lead=await qualified(),e=await enrollment(null,versionId);
  await linkLead(admin,lead,{kind:'enrollment',targetId:e,reason},randomUUID());const before=await salesReport(admin,from,until());
  // Deliberately invalid self-confirmation from a corrupted historical fixture must not receive credit.
  await execute('INSERT INTO lesson_progress(enrollment_id,lesson_id,completed,completed_by,completed_at) VALUES(?,?,1,?,?)',[e,'practice',learner.id,from]);
  assert.equal(stage(await salesReport(admin,from,until()),'b2c','requiredContent'),stage(before,'b2c','requiredContent'));await execute('DELETE FROM lesson_progress WHERE enrollment_id=?',[e]);
  await confirmPractice(admin,e,'practice','ISOLATED confirmed supervised practice',reason);assert.equal(stage(await salesReport(admin,from,until()),'b2c','requiredContent'),stage(before,'b2c','requiredContent')+1);
  await execute('UPDATE lesson_progress SET completed=0 WHERE enrollment_id=?',[e]);assert.equal(stage(await salesReport(admin,from,until()),'b2c','requiredContent'),stage(before,'b2c','requiredContent'));
  await execute('UPDATE enrollments SET access_until=? WHERE id=?',[from,e]);assert.equal(stage(await salesReport(admin,from,until()),'b2c','confirmedAccess'),stage(before,'b2c','confirmedAccess')-1);
});

test('concurrent different leads cannot claim one assignment and every report uses a bounded number of reads without writes',async()=>{
  const leads=await Promise.all([qualified(),qualified()]),e=await enrollment();const results=await Promise.allSettled(leads.map(lead=>linkLead(admin,lead,{kind:'enrollment',targetId:e,reason},randomUUID())));
  assert.equal(results.filter(row=>row.status==='fulfilled').length,1);const rejected=results.find(row=>row.status==='rejected');assert.equal(rejected?.status==='rejected'&&rejected.reason.data.code,'SALES_TARGET_ALREADY_LINKED');
  const db=await getDb(),original=db.transaction.bind(db);const statements:string[]=[];
  db.transaction=async(mode?: TransactionMode)=>{const tx=await original(mode);return new Proxy(tx,{get(target,key){if(key==='execute')return async(input:Parameters<typeof tx.execute>[0])=>{statements.push(typeof input==='string'?input:input.sql);return target.execute(input);};const value=Reflect.get(target,key);return typeof value==='function'?value.bind(target):value;}});};
  try{await salesReport(admin,from,until());}finally{db.transaction=original;}
  assert.ok(statements.length<=9,`bounded reads: ${statements.length}`);assert.ok(statements.every(sql=>/^\s*(SELECT|WITH)\b/i.test(sql)));
  const plans=await queryAll<{detail:string}>('EXPLAIN QUERY PLAN SELECT id FROM orders WHERE enrollment_id=?',[e]);assert.ok(plans.some(row=>row.detail.includes('sales_orders_enrollment')));
});

test('selection and verified-auth observations count ordered distinct current journeys with explicit denominators',async()=>{
  const start=new Date(Date.now()-10000).toISOString(),confirmed=new Date(Date.now()-2000).toISOString(),expires=new Date(Date.now()+3600000).toISOString();
  const create=async(steps:string[],auth:string|null=null)=>{const id=randomUUID();await execute('INSERT INTO public_journeys(id,consent_version,created_at,updated_at,expires_at,auth_confirmed_at) VALUES(?,?,?,?,?,?)',[id,'analytics-v2',start,start,expires,auth]);for(let i=0;i<steps.length;i++)await execute('INSERT INTO public_journey_steps(id,journey_id,sequence,step,context_json,created_at) VALUES(?,?,?,?,?,?)',[randomUUID(),id,i+1,steps[i]!,'{}',start]);return id;};
  const before=await salesReport(admin,from,until()),metric=(report:typeof before,id:string)=>report.metrics.find(row=>row.id===id)!;
  await create(['selection_start','selection_unmatched','selection_unmatched','selection_matched','auth_start'],confirmed);
  await create(['auth_start']);await create(['selection_unmatched','selection_start','auth_start'],new Date(Date.now()+86400000).toISOString());await create(['selection_matched'],confirmed);
  const expired=await create(['selection_start','selection_unmatched','auth_start'],confirmed);await execute('UPDATE public_journeys SET expires_at=? WHERE id=?',[from,expired]);
  const report=await salesReport(admin,from,until());assert.equal(metric(report,'selectionStarted').value,Number(metric(before,'selectionStarted').value)+2);assert.equal(metric(report,'selectionUnmatched').value,Number(metric(before,'selectionUnmatched').value)+1);assert.equal(metric(report,'selectionMatched').value,Number(metric(before,'selectionMatched').value)+1);assert.equal(metric(report,'selectionUnmatched').sampleSize,2);
  assert.equal(metric(report,'authStarted').value,Number(metric(before,'authStarted').value)+3);assert.equal(metric(report,'authConfirmed').value,Number(metric(before,'authConfirmed').value)+1);assert.equal(metric(report,'authUnconfirmed').value,Number(metric(before,'authUnconfirmed').value)+2);assert.equal(metric(report,'authUnconfirmed').sampleSize,3);assert.equal(metric(report,'authUnconfirmed').scope,'journey_cohort');
});

test('creation bounds and capped cohorts are explicit; operational counters do not treat exam failure as a technical error',async()=>{
  const begin='2042-01-01T00:00:00.000Z',end='2042-01-02T00:00:00.000Z';const db=await getDb();
  await db.batch(Array.from({length:1001},()=>{const id=randomUUID();return{sql:'INSERT INTO lead_submissions(id,payload_json,request_hash,idempotency_key,created_at,updated_at) VALUES(?,?,?,?,?,?)',args:[id,'{"organizationName":""}',id,id,begin,begin]};}),'write');
  const edge=randomUUID();await execute('INSERT INTO lead_submissions(id,payload_json,request_hash,idempotency_key,created_at,updated_at) VALUES(?,?,?,?,?,?)',[edge,'{"organizationName":""}',edge,edge,end,end]);
  await execute('INSERT INTO operational_counters(day,metric,count) VALUES(?,?,?),(?,?,?)',['2042-01-01','checkout_failure',2,'2042-01-01','auth_failure',3]);
  const report=await salesReport(admin,begin,end,Date.parse(end));assert.equal(report.b2c.cohortSize,1001);assert.equal(report.b2c.truncated,true);assert.deepEqual(report.b2c.stages,[]);
  assert.equal(report.metrics.find(row=>row.id==='checkoutErrors')?.value,2);assert.equal(report.metrics.find(row=>row.id==='authErrors')?.value,3);assert.equal(report.metrics.find(row=>row.id==='apiErrors')?.value,0);
  assert.equal(report.metrics.find(row=>row.id==='staleMaterials')?.value,null);assert.ok(report.unavailable.includes('cpa'));assert.equal((await listSalesLeads(admin,{page:1})).leads.length,25);
});
