import { z } from 'zod';
import { audit, execute, queryAll, queryOne, withTransaction, type Db } from '../db';
import { assertRole, type AppUser } from '../utils/auth';
import { businessFail as fail, id, idempotent, nowIso, parse } from '../utils/business';
import type { QualificationStatus, SalesLeadDetail, SalesLeadSummary, SalesPagination, SalesTargetChoice } from '../../shared/sales-report';

const identity = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/);
const reason = z.string().trim().min(10).max(2000);
const page = z.coerce.number().int().min(1).max(10000).default(1);
type LeadRow = { id: string; payload_json: string; created_at: string; status: string; qualification_status: QualificationStatus | null; revision: number | null; qualification_updated_at: string | null; request_type: SalesLeadSummary['qualification']['requestType'] | null };
const leadSql = 'SELECT l.*,q.status qualification_status,q.revision,q.updated_at qualification_updated_at,q.request_type FROM lead_submissions l LEFT JOIN lead_qualifications q ON q.lead_id=l.id';
export async function assertSalesAdmin(actor: AppUser, db?: Db) {
  assertRole(actor, []);
  const current = await queryOne('SELECT role,twoFactorEnabled,emailVerified FROM "user" WHERE id=?', [actor.id], db);
  if (!current || current.role !== 'admin' || !current.twoFactorEnabled || !current.emailVerified) fail(403, 'FORBIDDEN');
}
function summary(row: LeadRow): SalesLeadSummary {
  let value: Record<string, unknown> = {}; try { const parsed = JSON.parse(row.payload_json); if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) value = parsed; } catch { /* Explicit unknown audience, never infer contacts. */ }
  const text = (key: string, max = 254) => typeof value[key] === 'string' ? String(value[key]).slice(0, max) : '';
  return { id: row.id, createdAt: row.created_at, deliveryStatus: ['accepted','note_pending','delivered'].includes(row.status) ? row.status : 'unknown', audience: typeof value.organizationName !== 'string' ? 'unknown' : text('organizationName').trim() ? 'b2b' : 'b2c',
    contact: { name: text('name',120), email: text('email'), phone: text('phone',30), organizationName: text('organizationName',200) }, qualification: { status: row.qualification_status || 'new', revision: Number(row.revision || 0), updatedAt: row.qualification_updated_at, requestType: row.request_type || 'unspecified' } };
}
async function lead(id: string, tx?: Db) { const row = await queryOne<LeadRow>(`${leadSql} WHERE l.id=?`, [id], tx); if (!row) fail(404,'LEAD_NOT_FOUND'); return row; }
function qualified(row: LeadRow, audience?: 'b2c' | 'b2b') { const value = summary(row); if (value.qualification.status !== 'qualified' || value.audience === 'unknown') fail(409,'QUALIFIED_LEAD_REQUIRED'); if (audience && value.audience !== audience) fail(409,'LEAD_AUDIENCE_MISMATCH'); }
const paging = (page: number, total: number): SalesPagination => ({ page, pageSize:25,total,hasMore:page*25<total });
export async function listSalesLeads(actor: AppUser, input: unknown = {}) {
  const options = parse(z.object({page,status:z.enum(['all','new','in_review','qualified','rejected']).default('all')}).strict(),input);
  return withTransaction(async tx => {
    await assertSalesAdmin(actor,tx);
    const condition = options.status === 'all' ? '' : " WHERE COALESCE(q.status,'new')=?"; const args = options.status === 'all' ? [] : [options.status];
    const total = Number((await queryOne(`SELECT COUNT(*) n FROM lead_submissions l LEFT JOIN lead_qualifications q ON q.lead_id=l.id${condition}`,args,tx))!.n);
    const rows = await queryAll<LeadRow>(`${leadSql}${condition} ORDER BY l.created_at DESC,l.id DESC LIMIT 25 OFFSET ?`,[...args,(options.page-1)*25],tx);
    return {leads:rows.map(summary),pagination:paging(options.page,total)};
  },undefined,'read');
}
async function detail(leadId: string, tx?: Db): Promise<{lead:SalesLeadDetail}> {
  const row=await lead(leadId,tx); let payload: any={}; try {payload=JSON.parse(row.payload_json)||{};}catch{/* No raw malformed content. */}
  const text=(key:string,max=3000)=>typeof payload[key]==='string'?payload[key].slice(0,max):'';
  const links=await queryAll<SalesLeadDetail['links'][number]>('SELECT id,kind,COALESCE(order_id,enrollment_id) targetId,proposal_id proposalId,created_at createdAt,revoked_at revokedAt FROM sales_links WHERE lead_id=? ORDER BY created_at DESC,id DESC LIMIT 501',[leadId],tx);
  const proposals=await queryAll<SalesLeadDetail['proposals'][number]>('SELECT id,status,sent_at sentAt,reference,organization_id organizationId,created_at createdAt FROM sales_proposals WHERE lead_id=? ORDER BY created_at DESC,id DESC LIMIT 51',[leadId],tx);
  if(links.length>500||proposals.length>50)fail(409,'SALES_HISTORY_LIMIT');
  return {lead:{...summary(row),context:{city:text('city',80),programId:text('programId',100),format:text('format',80),locale:text('locale',2),comment:[text('comment'),text('message')].filter(Boolean).join('\n')},links,proposals}};
}
export async function getSalesLead(actor:AppUser,leadId:string){return withTransaction(async tx=>{await assertSalesAdmin(actor,tx);return detail(leadId,tx);},undefined,'read');}
async function command(actor:AppUser,leadId:string,scope:string,key:string,body:unknown,operation:(row:LeadRow,tx:Db)=>Promise<void>){
  assertRole(actor,[]);
  return idempotent(`sales:${actor.id}:${leadId}:${scope}`,key,body,async tx=>{
    await assertSalesAdmin(actor,tx);const row=await lead(leadId,tx);await operation(row,tx);return {resourceId:leadId,value:await detail(leadId,tx)};
  },async(resourceId,tx)=>{await assertSalesAdmin(actor,tx);return detail(resourceId,tx);});
}
export async function qualifyLead(actor:AppUser,leadId:string,input:unknown,key:string){
  const body=parse(z.object({status:z.enum(['in_review','qualified','rejected']),revision:z.number().int().min(0),requestType:z.enum(['unspecified','training','document_status','other']).optional(),reason}).strict(),input);
  return command(actor,leadId,'qualification',key,body,async(row,tx)=>{
    const old=summary(row).qualification;
    if(old.revision!==body.revision)fail(409,'REVISION_CONFLICT');
    const allowed:Record<QualificationStatus,string[]>={new:['in_review'],in_review:['qualified','rejected'],qualified:['in_review'],rejected:['in_review']};
    if(!allowed[old.status].includes(body.status))fail(409,'QUALIFICATION_TRANSITION_INVALID');
    if(body.status==='qualified'&&summary(row).audience==='unknown')fail(409,'LEAD_DATA_INVALID');
    await execute('INSERT INTO lead_qualifications(lead_id,status,request_type,revision,updated_by,updated_at) VALUES(?,?,?,?,?,?) ON CONFLICT(lead_id) DO UPDATE SET status=excluded.status,request_type=excluded.request_type,revision=excluded.revision,updated_by=excluded.updated_by,updated_at=excluded.updated_at',[leadId,body.status,body.requestType||old.requestType,old.revision+1,actor.id,nowIso()],tx);
    await audit(actor.id,`sales.qualification_${body.status}`,leadId,body.reason,null,tx);
  });
}
async function addLink(actor:AppUser,row:LeadRow,kind:'order'|'enrollment',targetId:string,proposalId:string|null,organizationId:string|null,reason:string,tx:Db){
  const target=kind==='order'?await queryOne('SELECT o.id,o.user_id,o.organization_id,o.enrollment_id,CASE WHEN o.enrollment_id IS NULL OR (e.user_id=o.user_id AND e.version_id=o.version_id AND e.organization_id IS o.organization_id) THEN 1 ELSE 0 END coherent FROM orders o LEFT JOIN enrollments e ON e.id=o.enrollment_id WHERE o.id=?',[targetId],tx):await queryOne('SELECT id,user_id,organization_id FROM enrollments WHERE id=?',[targetId],tx);
  if(!target)fail(404,'SALES_TARGET_NOT_FOUND');
  if(kind==='order'&&!target.coherent)fail(409,'SALES_TARGET_INVALID');
  if((target.organization_id||null)!==organizationId)fail(409,'SALES_ORGANIZATION_MISMATCH');
  if(organizationId&&!await queryOne("SELECT 1 ok FROM memberships m JOIN organizations o ON o.id=m.organization_id WHERE m.organization_id=? AND m.user_id=? AND m.status='active' AND o.status='active'",[organizationId,target.user_id],tx))fail(409,'ACTIVE_MEMBERSHIP_REQUIRED');
  const enrollmentId=kind==='enrollment'?targetId:target.enrollment_id;
  const conflicts=await queryAll('SELECT l.id,l.lead_id,l.proposal_id,l.kind,l.order_id,l.enrollment_id FROM sales_links l WHERE l.revoked_at IS NULL AND (l.order_id=? OR l.enrollment_id=? OR l.order_id IN (SELECT id FROM orders WHERE enrollment_id=?))',[kind==='order'?targetId:null,enrollmentId||null,enrollmentId||null],tx);
  if(conflicts.some(old=>old.lead_id!==row.id||(old.proposal_id||null)!==proposalId))fail(409,'SALES_TARGET_ALREADY_LINKED');
  if(conflicts.some(old=>old.kind===kind&&(old.order_id||old.enrollment_id)===targetId))return;
  if(Number((await queryOne('SELECT COUNT(*) n FROM sales_links WHERE lead_id=?',[row.id],tx))!.n)>=500)fail(409,'SALES_HISTORY_LIMIT');
  const linkId=id();await execute('INSERT INTO sales_links(id,lead_id,proposal_id,kind,order_id,enrollment_id,created_by,created_at) VALUES(?,?,?,?,?,?,?,?)',[linkId,row.id,proposalId,kind,kind==='order'?targetId:null,kind==='enrollment'?targetId:null,actor.id,nowIso()],tx);
  await audit(actor.id,'sales.link_created',linkId,reason,organizationId,tx);
}
export async function linkLead(actor:AppUser,leadId:string,input:unknown,key:string){const body=parse(z.object({kind:z.enum(['order','enrollment']),targetId:identity,reason}).strict(),input);return command(actor,leadId,'link',key,body,async(row,tx)=>{qualified(row,'b2c');await addLink(actor,row,body.kind,body.targetId,null,null,body.reason,tx);});}
export async function revokeSalesLink(actor:AppUser,leadId:string,linkId:string,input:unknown,key:string){const body=parse(z.object({reason}).strict(),input);return command(actor,leadId,`revoke:${linkId}`,key,body,async(_row,tx)=>{
  const link=await queryOne('SELECT * FROM sales_links WHERE id=? AND lead_id=?',[linkId,leadId],tx);if(!link)fail(404,'SALES_LINK_NOT_FOUND');if(link.revoked_at)return;
  await execute('UPDATE sales_links SET revoked_at=?,revoked_by=? WHERE id=?',[nowIso(),actor.id,linkId],tx);await audit(actor.id,'sales.link_revoked',linkId,body.reason,null,tx);
});}
export async function recordSalesProposal(actor:AppUser,leadId:string,input:unknown,key:string){const body=parse(z.object({sentAt:z.iso.datetime(),reference:z.string().trim().min(3).max(200),reason}).strict(),input);return command(actor,leadId,'proposal',key,body,async(row,tx)=>{
  qualified(row,'b2b');if(Date.parse(body.sentAt)>Date.now()||Date.parse(body.sentAt)<Date.parse(row.created_at))fail(400,'PROPOSAL_TIME_INVALID');
  if(await queryOne('SELECT id FROM sales_proposals WHERE lead_id=? AND reference=?',[leadId,body.reference],tx))fail(409,'PROPOSAL_REFERENCE_EXISTS');
  if(Number((await queryOne('SELECT COUNT(*) n FROM sales_proposals WHERE lead_id=?',[leadId],tx))!.n)>=50)fail(409,'SALES_HISTORY_LIMIT');
  const proposalId=id();await execute('INSERT INTO sales_proposals(id,lead_id,sent_at,reference,created_by,created_at) VALUES(?,?,?,?,?,?)',[proposalId,leadId,body.sentAt,body.reference,actor.id,nowIso()],tx);await audit(actor.id,'sales.proposal_sent_recorded',proposalId,body.reason,null,tx);
});}
async function proposal(leadId:string,proposalId:string,tx:Db){const row=await queryOne('SELECT * FROM sales_proposals WHERE id=? AND lead_id=?',[proposalId,leadId],tx);if(!row)fail(404,'PROPOSAL_NOT_FOUND');if(row.status!=='sent')fail(409,'PROPOSAL_WITHDRAWN');return row;}
export async function attachProposalOrganization(actor:AppUser,leadId:string,proposalId:string,input:unknown,key:string){const body=parse(z.object({organizationId:identity,reason}).strict(),input);return command(actor,leadId,`proposal-org:${proposalId}`,key,body,async(row,tx)=>{
  qualified(row,'b2b');const value=await proposal(leadId,proposalId,tx);if(value.organization_id===body.organizationId)return;if(value.organization_id)fail(409,'PROPOSAL_ORGANIZATION_IMMUTABLE');
  if(!await queryOne("SELECT id FROM organizations WHERE id=? AND status='active'",[body.organizationId],tx))fail(404,'ORGANIZATION_NOT_FOUND');
  await execute('UPDATE sales_proposals SET organization_id=? WHERE id=?',[body.organizationId,proposalId],tx);await audit(actor.id,'sales.proposal_organization_linked',proposalId,body.reason,body.organizationId,tx);
});}
export async function attachProposalAssignments(actor:AppUser,leadId:string,proposalId:string,input:unknown,key:string){const body=parse(z.object({enrollmentIds:z.array(identity).min(1).max(100).optional(),invoiceId:identity.optional(),reason}).strict().refine(v=>Boolean(v.enrollmentIds)!==Boolean(v.invoiceId)),input);return command(actor,leadId,`proposal-assignments:${proposalId}`,key,body,async(row,tx)=>{
  qualified(row,'b2b');const value=await proposal(leadId,proposalId,tx);if(!value.organization_id)fail(409,'PROPOSAL_ORGANIZATION_REQUIRED');
  let ids=body.enrollmentIds||[];
  if(body.invoiceId){const invoice=await queryOne('SELECT organization_id,status,version_id FROM corporate_invoices WHERE id=?',[body.invoiceId],tx);if(!invoice)fail(404,'INVOICE_NOT_FOUND');if(invoice.organization_id!==value.organization_id)fail(409,'SALES_ORGANIZATION_MISMATCH');if(invoice.status!=='confirmed')fail(409,'CONFIRMED_INVOICE_REQUIRED');
    const rows=await queryAll<{enrollment_id:string;coherent:number}>(`SELECT f.enrollment_id,CASE WHEN e.user_id=l.user_id AND o.user_id=l.user_id AND e.version_id=? AND o.version_id=e.version_id AND e.organization_id=? AND o.organization_id=e.organization_id AND o.enrollment_id=e.id AND o.status IN ('succeeded','partially_refunded') THEN 1 ELSE 0 END coherent
      FROM corporate_invoice_lines l LEFT JOIN corporate_invoice_fulfillments f ON f.line_id=l.id LEFT JOIN orders o ON o.id=f.order_id LEFT JOIN enrollments e ON e.id=f.enrollment_id WHERE l.invoice_id=? LIMIT 101`,[invoice.version_id,invoice.organization_id,body.invoiceId],tx);
    ids=rows.map(item=>item.enrollment_id);if(!ids.length||ids.length>100||rows.some(row=>!row.coherent))fail(409,'INVOICE_FULFILLMENT_INVALID');}
  if(new Set(ids).size!==ids.length)fail(400,'DUPLICATE_ENROLLMENTS');
  // One set of validation reads and one INSERT for up to100 explicit assignments, not per-seat queries.
  const placeholders=ids.map(()=>'?').join(',');
  const targets=await queryAll('SELECT e.id,e.organization_id,m.status membership_status,o.status organization_status FROM enrollments e LEFT JOIN memberships m ON m.organization_id=e.organization_id AND m.user_id=e.user_id LEFT JOIN organizations o ON o.id=e.organization_id WHERE e.id IN ('+placeholders+')',ids,tx);
  if(targets.length!==ids.length)fail(404,'SALES_TARGET_NOT_FOUND');
  if(targets.some(target=>target.organization_id!==value.organization_id))fail(409,'SALES_ORGANIZATION_MISMATCH');
  if(targets.some(target=>target.membership_status!=='active'||target.organization_status!=='active'))fail(409,'ACTIVE_MEMBERSHIP_REQUIRED');
  const old=await queryAll(`SELECT l.*,COALESCE(l.enrollment_id,o.enrollment_id) assigned_id FROM sales_links l LEFT JOIN orders o ON o.id=l.order_id WHERE l.revoked_at IS NULL AND (l.enrollment_id IN (${placeholders}) OR o.enrollment_id IN (${placeholders}))`,[...ids,...ids],tx);
  if(old.some(link=>link.lead_id!==leadId||link.proposal_id!==proposalId))fail(409,'SALES_TARGET_ALREADY_LINKED');
  const existing=new Set(old.map(link=>link.enrollment_id));const fresh=ids.filter(id=>!existing.has(id));if(!fresh.length)return;
  const count=Number((await queryOne('SELECT COUNT(*) n FROM sales_links WHERE lead_id=?',[leadId],tx))!.n);if(count+fresh.length>500)fail(409,'SALES_HISTORY_LIMIT');
  const timestamp=nowIso();await execute(`INSERT INTO sales_links(id,lead_id,proposal_id,kind,enrollment_id,created_by,created_at) VALUES ${fresh.map(()=>'(?,?,?,?,?,?,?)').join(',')}`,fresh.flatMap(enrollmentId=>[id(),leadId,proposalId,'enrollment',enrollmentId,actor.id,timestamp]),tx);
  await audit(actor.id,'sales.proposal_assignments_linked',proposalId,body.reason,value.organization_id,tx);
});}
export async function withdrawSalesProposal(actor:AppUser,leadId:string,proposalId:string,input:unknown,key:string){const body=parse(z.object({reason}).strict(),input);return command(actor,leadId,`withdraw:${proposalId}`,key,body,async(_row,tx)=>{
  const value=await queryOne('SELECT * FROM sales_proposals WHERE id=? AND lead_id=?',[proposalId,leadId],tx);if(!value)fail(404,'PROPOSAL_NOT_FOUND');if(value.status==='withdrawn')return;
  const timestamp=nowIso();await execute('UPDATE sales_proposals SET status=?,withdrawn_at=?,withdrawn_by=? WHERE id=?',['withdrawn',timestamp,actor.id,proposalId],tx);
  await execute('UPDATE sales_links SET revoked_at=?,revoked_by=? WHERE proposal_id=? AND revoked_at IS NULL',[timestamp,actor.id,proposalId],tx);await audit(actor.id,'sales.proposal_withdrawn',proposalId,body.reason,value.organization_id,tx);
});}
export async function salesTargets(actor:AppUser,input:unknown={}){
  const options=parse(z.object({kind:z.enum(['order','enrollment','organization','invoice']),query:z.string().regex(/^[A-Za-z0-9_-]{0,128}$/).default(''),page}).strict(),input);
  return withTransaction(async tx=>{await assertSalesAdmin(actor,tx);
    const configs={order:{from:'orders t JOIN "user" u ON u.id=t.user_id JOIN program_versions v ON v.id=t.version_id',label:"u.name||' · '||v.program_id||' · '||t.created_at",org:'t.organization_id'},enrollment:{from:'enrollments t JOIN "user" u ON u.id=t.user_id JOIN program_versions v ON v.id=t.version_id',label:"u.name||' · '||v.program_id||' · '||t.created_at",org:'t.organization_id'},organization:{from:'organizations t',label:"t.name||' · '||t.created_at",org:'t.id'},invoice:{from:'corporate_invoices t JOIN organizations o ON o.id=t.organization_id',label:"t.number||' · '||o.name||' · '||t.created_at",org:'t.organization_id'}};
    const c=configs[options.kind],filter=options.query+'%';const total=Number((await queryOne(`SELECT COUNT(*) n FROM ${c.from} WHERE t.id LIKE ?`,[filter],tx))!.n);
    const targets=await queryAll<SalesTargetChoice>(`SELECT t.id,${c.label} label,t.status,${c.org} organizationId FROM ${c.from} WHERE t.id LIKE ? ORDER BY t.created_at DESC,t.id DESC LIMIT 25 OFFSET ?`,[filter,(options.page-1)*25],tx);return {targets,pagination:paging(options.page,total)};
  },undefined,'read');
}
