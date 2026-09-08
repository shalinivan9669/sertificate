import { queryAll, queryOne, withTransaction, type Db } from '../db';
import { assertSalesAdmin } from './sales-links';
import type { AppUser } from '../utils/auth';
import type { SalesFunnel, SalesMetric, SalesReport, SalesStageId } from '../../shared/sales-report';
import { journeyContextSchema } from '../../shared/lead-attribution';

const LIMIT=1000, LINK_LIMIT=5000;
const b2cCondition="CASE WHEN json_valid(l.payload_json) THEN json_type(l.payload_json,'$.organizationName')='text' AND trim(json_extract(l.payload_json,'$.organizationName'))='' ELSE 0 END";
const inList=(ids:string[])=>ids.map(()=>'?').join(',');
type Cohort={id:string;total:number;qualified?:number;lead_id?:string;organization_id?:string|null;status?:string};
type Truth={id:string;lead_id:string;proposal_id:string|null;enrollment_id:string|null;valid:number;access:number;started:number;required:number;passed:number;credential:number};
function funnel(unit:SalesFunnel['unit'],cohort:Cohort[],stages:Array<[SalesStageId,number]>,invalidLinks:number,overflow=false):SalesFunnel{
  const cohortSize=Number(cohort[0]?.total||0),truncated=cohortSize>LIMIT||overflow;let previous=cohortSize;
  return {unit,cohortSize,invalidLinks,truncated,limit:LIMIT,stages:truncated?[]:stages.map(([id,count])=>{const result={id,count,denominator:previous,rate:previous?count/previous:null};previous=count;return result;})};
}
const suffix:SalesStageId[]=['confirmedAccess','started','requiredContent','assessmentPassed','validCredential'];
function chain(row:Truth):number {if(!row.valid||!row.access)return 0;if(!row.started)return 1;if(!row.required)return 2;if(!row.passed)return 3;if(!row.credential)return 4;return 5;}
async function linkTruth(leadIds:string[],asOf:string,tx:Db):Promise<Truth[]>{
  if(!leadIds.length)return[];
  // Required content, grade and file status are read from pinned server facts in one bounded query.
  // Identity ambiguity invalidates attribution; it never blocks payment or changes an entitlement.
  return queryAll<Truth>(`WITH selected AS (
    SELECT sl.*,COALESCE(sl.enrollment_id,o.enrollment_id) assigned_id,o.user_id payer_id,o.organization_id order_org,o.version_id order_version,
      p.lead_id proposal_lead,p.organization_id proposal_org,p.status proposal_status
    FROM sales_links sl LEFT JOIN orders o ON o.id=sl.order_id LEFT JOIN sales_proposals p ON p.id=sl.proposal_id
    WHERE sl.revoked_at IS NULL AND sl.lead_id IN (${inList(leadIds)}) ORDER BY sl.created_at,sl.id LIMIT ${LINK_LIMIT+1}
  ), facts AS (
    SELECT s.id,s.lead_id,s.proposal_id,e.id enrollment_id,e.user_id,e.organization_id,e.version_id,
      CASE WHEN s.kind='order' AND s.payer_id IS NOT NULL AND s.order_org IS NULL AND s.assigned_id IS NULL THEN 1
        WHEN e.id IS NOT NULL AND v.status='published'
        AND (s.kind!='order' OR (s.payer_id=e.user_id AND s.order_org IS e.organization_id AND s.order_version=e.version_id))
        AND ((s.proposal_id IS NULL AND e.organization_id IS NULL) OR (s.proposal_lead=s.lead_id AND s.proposal_status='sent' AND s.proposal_org=e.organization_id))
        AND NOT EXISTS(SELECT 1 FROM sales_links x WHERE x.enrollment_id=e.id AND x.revoked_at IS NULL AND x.lead_id!=s.lead_id)
        AND NOT EXISTS(SELECT 1 FROM orders xo JOIN sales_links x ON x.order_id=xo.id WHERE xo.enrollment_id=e.id AND x.revoked_at IS NULL AND x.lead_id!=s.lead_id)
        THEN 1 ELSE 0 END valid,
      CASE WHEN u.emailVerified=1 AND e.status IN ('active','learning_complete','assessment_eligible','completed') AND (e.access_until IS NULL OR e.access_until>?)
        AND (e.organization_id IS NULL OR EXISTS(SELECT 1 FROM memberships m JOIN organizations org ON org.id=m.organization_id WHERE m.organization_id=e.organization_id AND m.user_id=e.user_id AND m.status='active' AND org.status='active'))
        AND CASE WHEN json_valid(v.data_json) THEN json_extract(v.data_json,'$.accessModel') IN ('free','manual') OR (json_extract(v.data_json,'$.accessModel')='paid' AND EXISTS(SELECT 1 FROM orders paid WHERE paid.enrollment_id=e.id AND paid.user_id=e.user_id AND paid.version_id=e.version_id AND paid.organization_id IS e.organization_id AND paid.status IN ('succeeded','partially_refunded'))) ELSE 0 END
        THEN 1 ELSE 0 END access,
      CASE WHEN EXISTS(SELECT 1 FROM lesson_progress lp WHERE lp.enrollment_id=e.id AND lp.completed=1)
        OR EXISTS(SELECT 1 FROM attempts a WHERE a.enrollment_id=e.id AND a.status!='voided') THEN 1 ELSE 0 END started,
      CASE WHEN json_valid(v.data_json) THEN
        EXISTS(SELECT 1 FROM json_each(v.data_json,'$.modules') m,json_each(CASE WHEN m.type='object' THEN m.value ELSE '{}' END,'$.lessons') l WHERE json_extract(CASE WHEN l.type='object' THEN l.value ELSE '{}' END,'$.required')=1)
        AND NOT EXISTS(SELECT 1 FROM json_each(v.data_json,'$.modules') m,json_each(CASE WHEN m.type='object' THEN m.value ELSE '{}' END,'$.lessons') l
          WHERE json_extract(CASE WHEN l.type='object' THEN l.value ELSE '{}' END,'$.required')=1 AND NOT EXISTS(SELECT 1 FROM lesson_progress lp WHERE lp.enrollment_id=e.id AND lp.lesson_id=json_extract(l.value,'$.id') AND lp.completed=1
            AND (json_extract(l.value,'$.kind')!='practice' OR (lp.completed_by IS NOT NULL AND lp.completed_by!=e.user_id)))) ELSE 0 END required,
      CASE WHEN EXISTS(SELECT 1 FROM attempts a WHERE a.enrollment_id=e.id AND a.status IN ('graded','expired')
        AND CASE WHEN json_valid(a.result_json) THEN json_type(a.result_json,'$.pass')='true' ELSE 0 END) THEN 1 ELSE 0 END passed,
      CASE WHEN EXISTS(SELECT 1 FROM credentials c JOIN attempts a ON a.id=c.attempt_id AND a.enrollment_id=c.enrollment_id
        WHERE c.enrollment_id=e.id AND c.status='issued' AND c.issued_at IS NOT NULL AND length(c.document_base64)>0 AND length(c.document_sha256)=64
          AND a.status IN ('graded','expired') AND CASE WHEN json_valid(a.result_json) THEN json_type(a.result_json,'$.pass')='true' ELSE 0 END) THEN 1 ELSE 0 END credential
    FROM selected s LEFT JOIN enrollments e ON e.id=s.assigned_id LEFT JOIN "user" u ON u.id=e.user_id LEFT JOIN program_versions v ON v.id=e.version_id
  ) SELECT * FROM facts`,[...leadIds,asOf],tx);
}
async function operationalMetrics(from:string,until:string,asOf:string,tx:Db):Promise<SalesMetric[]>{
  const metric=await queryOne(`SELECT
    (SELECT COUNT(*) FROM lead_submissions WHERE created_at>=?1 AND created_at<?2 AND status!='delivered') crm_pending,
    (SELECT AVG((julianday(updated_at)-julianday(created_at))*86400) FROM lead_submissions WHERE created_at>=?1 AND created_at<?2 AND status='delivered' AND typeof(crm_lead_id)='integer' AND crm_lead_id>0 AND crm_lead_id<=9007199254740991 AND typeof(crm_note_id)='integer' AND crm_note_id>0 AND crm_note_id<=9007199254740991 AND updated_at>=created_at AND updated_at<=?3) crm_seconds,
    (SELECT COUNT(*) FROM lead_submissions WHERE created_at>=?1 AND created_at<?2 AND status='delivered' AND typeof(crm_lead_id)='integer' AND crm_lead_id>0 AND crm_lead_id<=9007199254740991 AND typeof(crm_note_id)='integer' AND crm_note_id>0 AND crm_note_id<=9007199254740991 AND updated_at>=created_at AND updated_at<=?3) crm_sample,
    (SELECT COUNT(*) FROM corporate_invoices WHERE created_at>=?1 AND created_at<?2 AND status='issued') invoice_pending,
    (SELECT COUNT(*) FROM enrollments e JOIN "user" u ON u.id=e.user_id WHERE e.created_at>=?1 AND e.created_at<?2 AND u.emailVerified=1 AND e.organization_id IS NOT NULL AND e.status IN ('active','learning_complete','assessment_eligible','completed') AND (e.access_until IS NULL OR e.access_until>?3) AND EXISTS(SELECT 1 FROM memberships m JOIN organizations o ON o.id=m.organization_id WHERE m.organization_id=e.organization_id AND m.user_id=e.user_id AND m.status='active' AND o.status='active') AND NOT EXISTS(SELECT 1 FROM lesson_progress lp WHERE lp.enrollment_id=e.id AND lp.completed=1) AND NOT EXISTS(SELECT 1 FROM attempts a WHERE a.enrollment_id=e.id AND a.status!='voided')) unstarted,
    (SELECT COUNT(*) FROM credentials WHERE created_at>=?1 AND created_at<?2 AND status='pending') credential_pending,
    (SELECT AVG((julianday(issued_at)-julianday(created_at))*86400) FROM credentials WHERE created_at>=?1 AND created_at<?2 AND status='issued' AND issued_at>=created_at AND issued_at<=?3 AND document_base64 IS NOT NULL) credential_seconds,
    (SELECT COUNT(*) FROM credentials WHERE created_at>=?1 AND created_at<?2 AND status='issued' AND issued_at>=created_at AND issued_at<=?3 AND document_base64 IS NOT NULL) credential_sample,
    (SELECT COUNT(*) FROM program_versions WHERE status!='published') unpublished,
    (SELECT COUNT(*) FROM programs p WHERE NOT EXISTS(SELECT 1 FROM program_versions v WHERE v.program_id=p.id AND v.status='published')) no_publication,
    (SELECT COUNT(*) FROM lead_submissions l JOIN lead_qualifications q ON q.lead_id=l.id WHERE l.created_at>=?1 AND l.created_at<?2 AND q.request_type='document_status') document_requests`,[from,until,asOf],tx);
  const counters=await queryAll<{metric:string;n:number}>('SELECT metric,SUM(count) n FROM operational_counters WHERE day>=? AND day<=? GROUP BY metric',[from.slice(0,10),new Date(Date.parse(until)-1).toISOString().slice(0,10)],tx);
  const counts=new Map(counters.map(row=>[row.metric,Number(row.n)]));
  const record=(id:SalesMetric['id'],field:string,scope:SalesMetric['scope']='created_in_window'):SalesMetric=>({id,value:Number(metric?.[field]||0),unit:'records',sampleSize:Number(metric?.[field]||0),scope});
  const duration=(id:SalesMetric['id'],field:string,samples:string):SalesMetric=>({id,value:metric?.[field]===null?null:Number(metric?.[field]),unit:'seconds',sampleSize:Number(metric?.[samples]||0),scope:'created_in_window'});
  return [record('crmPending','crm_pending'),duration('crmDeliveryLagSeconds','crm_seconds','crm_sample'),record('invoicePending','invoice_pending'),record('unstartedAssignments','unstarted'),record('credentialPending','credential_pending'),duration('credentialIssuanceSeconds','credential_seconds','credential_sample'),record('unpublishedVersions','unpublished','current_inventory'),record('programsWithoutPublication','no_publication','current_inventory'),record('documentStatusRequests','document_requests'),
    ...([['apiErrors','api_error'],['autosaveFailures','autosave_failure'],['authErrors','auth_failure'],['checkoutErrors','checkout_failure']] as const).map(([id,metric])=>({id,value:counts.get(metric)||0,unit:'records' as const,sampleSize:counts.get(metric)||0,scope:'utc_days' as const})),
    {id:'staleMaterials',value:null,unit:'records',sampleSize:0,scope:'current_inventory',unavailableReason:'approved_material_review_deadline_not_defined'}];
}
export async function salesReport(actor:AppUser,from:string,until:string,now=Date.now()):Promise<SalesReport>{
  return withTransaction(async tx=>{
    await assertSalesAdmin(actor,tx);const asOf=new Date(now).toISOString();
    const b2c=await queryAll<Cohort>(`SELECT l.id,COUNT(*) OVER() total,CASE WHEN q.status='qualified' THEN 1 ELSE 0 END qualified FROM lead_submissions l LEFT JOIN lead_qualifications q ON q.lead_id=l.id WHERE l.created_at>=? AND l.created_at<? AND ${b2cCondition} ORDER BY l.created_at,l.id LIMIT ${LIMIT+1}`,[from,until],tx);
    const proposals=await queryAll<Cohort>(`SELECT p.id,p.lead_id,p.organization_id,p.status,COUNT(*) OVER() total FROM sales_proposals p WHERE p.created_at>=? AND p.created_at<? ORDER BY p.created_at,p.id LIMIT ${LIMIT+1}`,[from,until],tx);
    const journeys=await queryAll<Cohort>(`SELECT id,COUNT(*) OVER() total FROM public_journeys WHERE created_at>=? AND created_at<? AND expires_at>? ORDER BY created_at,id LIMIT ${LIMIT+1}`,[from,until,asOf],tx);
    const journeyIds=journeys.map(row=>row.id);
    const paths=journeyIds.length?await queryAll<{id:string;landing:number;program:number;consultation:number;auth_started:number;auth_confirmed:number;selection_started:number;selection_matched:number;selection_unmatched:number}>(`SELECT j.id,
      EXISTS(SELECT 1 FROM public_journey_steps s WHERE s.journey_id=j.id AND s.created_at<=?1) landing,
      EXISTS(SELECT 1 FROM public_journey_steps p WHERE p.journey_id=j.id AND p.step='program' AND p.created_at<=?1) program,
      EXISTS(SELECT 1 FROM public_journey_steps p JOIN public_journey_steps c ON c.journey_id=p.journey_id AND c.sequence>p.sequence WHERE p.journey_id=j.id AND p.step='program' AND c.step='consultation' AND p.created_at<=c.created_at AND c.created_at<=?1) consultation,
      EXISTS(SELECT 1 FROM public_journey_steps s WHERE s.journey_id=j.id AND s.step='auth_start' AND s.created_at<=?1) auth_started,
      EXISTS(SELECT 1 FROM public_journey_steps s WHERE s.journey_id=j.id AND s.step='auth_start' AND s.created_at<=j.auth_confirmed_at AND j.auth_confirmed_at<=?1) auth_confirmed,
      EXISTS(SELECT 1 FROM public_journey_steps s WHERE s.journey_id=j.id AND s.step='selection_start' AND s.created_at<=?1) selection_started,
      EXISTS(SELECT 1 FROM public_journey_steps s JOIN public_journey_steps r ON r.journey_id=s.journey_id AND r.sequence>s.sequence WHERE s.journey_id=j.id AND s.step='selection_start' AND r.step='selection_matched' AND s.created_at<=r.created_at AND r.created_at<=?1) selection_matched,
      EXISTS(SELECT 1 FROM public_journey_steps s JOIN public_journey_steps r ON r.journey_id=s.journey_id AND r.sequence>s.sequence WHERE s.journey_id=j.id AND s.step='selection_start' AND r.step='selection_unmatched' AND s.created_at<=r.created_at AND r.created_at<=?1) selection_unmatched
      FROM public_journeys j WHERE j.id IN (${inList(journeyIds)})`,[asOf,...journeyIds],tx):[];
    const attributions=journeyIds.length?await queryAll<{journey_id:string;lead_id:string;qualified:number;coherent:number;first_touch_json:string}>(`SELECT la.journey_id,la.lead_id,CASE WHEN q.status='qualified' THEN 1 ELSE 0 END qualified,la.first_touch_json,
      EXISTS(SELECT 1 FROM public_journey_steps p JOIN public_journey_steps c ON c.journey_id=p.journey_id AND c.sequence>p.sequence
        WHERE p.journey_id=la.journey_id AND p.step='program' AND c.step='consultation' AND p.sequence<=la.last_sequence AND c.sequence<=la.last_sequence
          AND p.created_at<=c.created_at AND p.created_at<=la.created_at AND c.created_at<=la.created_at) coherent
      FROM lead_attributions la JOIN lead_submissions l ON l.id=la.lead_id LEFT JOIN lead_qualifications q ON q.lead_id=la.lead_id
      WHERE la.journey_id IN (${inList(journeyIds)}) AND la.expires_at>? AND la.created_at<=? AND l.created_at<=la.created_at LIMIT ${LINK_LIMIT+1}`,[...journeyIds,asOf,asOf],tx):[];
    const leadIds=[...new Set([...b2c.map(row=>row.id),...proposals.map(row=>row.lead_id!),...attributions.map(row=>row.lead_id)])];
    const truths=await linkTruth(leadIds,asOf,tx);const overflow=truths.length>LINK_LIMIT||attributions.length>LINK_LIMIT;
    const depths=new Map<string,number>(),leadDepths=new Map<string,number>();for(const row of truths){const depth=chain(row),key=JSON.stringify([row.lead_id,row.proposal_id]);depths.set(key,Math.max(depths.get(key)||0,depth));leadDepths.set(row.lead_id,Math.max(leadDepths.get(row.lead_id)||0,depth));}
    const maxDepth=(leadId:string,proposalId:string|null)=>depths.get(JSON.stringify([leadId,proposalId]))||0;
    const bStages:Array<[SalesStageId,number]>=[['accepted',b2c.length],['qualified',b2c.filter(row=>row.qualified).length],...suffix.map((stage,index):[SalesStageId,number]=>[stage,b2c.filter(row=>row.qualified&&maxDepth(row.id,null)>index).length])];
    const validProposals=proposals.filter(row=>row.status==='sent');
    const pStages:Array<[SalesStageId,number]>=[['sent',proposals.length],['organizationLinked',validProposals.filter(row=>row.organization_id).length],['assigned',validProposals.filter(row=>row.organization_id&&truths.some(link=>link.proposal_id===row.id&&link.valid)).length],...suffix.map((stage,index):[SalesStageId,number]=>[stage,validProposals.filter(row=>row.organization_id&&maxDepth(row.lead_id!,row.id)>index).length])];
    const jAccepted=new Set(attributions.filter(row=>row.coherent).map(row=>row.journey_id));
    const jQualified=attributions.filter(row=>row.coherent&&row.qualified);
    const jStages:Array<[SalesStageId,number]>=[['journeys',journeys.length],['landing',paths.filter(row=>row.landing).length],['program',paths.filter(row=>row.program).length],['consultation',paths.filter(row=>row.consultation).length],['accepted',jAccepted.size],['qualified',new Set(jQualified.map(row=>row.journey_id)).size],...suffix.map((stage,index):[SalesStageId,number]=>[stage,new Set(jQualified.filter(row=>(leadDepths.get(row.lead_id)||0)>index).map(row=>row.journey_id)).size])];
    const sources=new Map<string,{routeId:string;city:string;source:string;qualifiedLeads:number}>();
    const seen=new Set<string>();for(const row of attributions.filter(row=>row.qualified)){if(seen.has(row.lead_id))continue;seen.add(row.lead_id);let context:ReturnType<typeof journeyContextSchema.parse>|undefined;try{const parsed=journeyContextSchema.safeParse(JSON.parse(row.first_touch_json));if(parsed.success)context=parsed.data;}catch{/* No arbitrary values in safe source report. */}
      const routeId=context?.routeId||'unknown',source=context?.source||'unknown',city=context?.city||'unknown';
      const key=JSON.stringify([routeId,city,source]),value=sources.get(key)||{routeId,city,source,qualifiedLeads:0};value.qualifiedLeads++;sources.set(key,value);}
    const journeyLeadIds=new Set(attributions.map(row=>row.lead_id)),b2cIds=new Set(b2c.map(row=>row.id)),proposalIds=new Set(proposals.map(row=>row.id));
    const authStarted=paths.filter(row=>row.auth_started).length,authConfirmed=paths.filter(row=>row.auth_confirmed).length,selectionStarted=paths.filter(row=>row.selection_started).length;
    const journeyMetric=(id:SalesMetric['id'],value:number,sampleSize:number):SalesMetric=>({id,value:journeys.length>LIMIT?null:value,unit:'records',sampleSize:journeys.length>LIMIT?0:sampleSize,scope:'journey_cohort',...(journeys.length>LIMIT?{unavailableReason:'report_window_too_large'}:{})});
    const journeyMetrics=[journeyMetric('authStarted',authStarted,journeys.length),journeyMetric('authConfirmed',authConfirmed,authStarted),journeyMetric('authUnconfirmed',authStarted-authConfirmed,authStarted),journeyMetric('selectionStarted',selectionStarted,journeys.length),journeyMetric('selectionMatched',paths.filter(row=>row.selection_matched).length,selectionStarted),journeyMetric('selectionUnmatched',paths.filter(row=>row.selection_unmatched).length,selectionStarted)];
    return {window:{from,until,bounds:'[from,until)'},asOf,statusTime:'current',
      journeyOutcomes:funnel('opted_in_tab_journeys',journeys,jStages,truths.filter(row=>!row.valid&&journeyLeadIds.has(row.lead_id)).length,overflow),
      b2c:funnel('accepted_b2c_leads',b2c,bStages,truths.filter(row=>!row.valid&&b2cIds.has(row.lead_id)).length,overflow),
      proposals:funnel('sent_proposals',proposals,pStages,truths.filter(row=>!row.valid&&row.proposal_id&&proposalIds.has(row.proposal_id)).length,overflow),
      metrics:[...await operationalMetrics(from,until,asOf,tx),...journeyMetrics],qualifiedSources:overflow||journeys.length>LIMIT?[]:[...sources.values()],unavailable:['external_search_queries','cpa','market_share']};
  },undefined,'read');
}
