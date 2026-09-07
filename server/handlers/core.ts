import { defineEventHandler, getRequestURL, setHeader } from 'h3';
import { authConfiguration } from '../services/auth';
import { catalogProgram, catalogPrograms, createProgram, createVersion, getAuthoringGuide, listVersions, publishVersion, reviewVersion, updateVersion } from '../services/catalog';
import { activateEnrollment, completeLesson, confirmPractice, createEnrollment, enrollmentDetails, getLesson, myEnrollments } from '../services/learning';
import { getAttempt, saveAnswer, startAttempt, submitAttempt } from '../services/assessment';
import { changeRole, listUsers } from '../services/core-administration';
import { requireUser } from '../utils/auth';
import { entityId, fail, integer, isoDate, jsonBody, requestKey, textValue } from '../utils/validation';

export function isCorePath(path: string) {
  return /^\/(?:auth\/config|catalog\/programs(?:\/[^/]+)?|me(?:\/enrollments)?|enrollments(?:\/.*)?|attempts(?:\/.*)?|admin\/programs(?:\/[^/]+\/authoring-guide)?|admin\/program-versions(?:\/.*)?|admin\/enrollments(?:\/.*)?|admin\/users(?:\/.*)?)$/.test(path);
}

/** Core route table. Existing named business endpoints take precedence over this catch-all. */
export default defineEventHandler(async (event) => {
  const path = getRequestURL(event).pathname.replace(/^\/api\/v1/, '');
  const method = event.method;
  if (method === 'GET' && path === '/auth/config') { setHeader(event, 'Cache-Control', 'no-store'); return authConfiguration(); }
  if (method === 'GET' && path === '/catalog/programs') return catalogPrograms();
  let match = path.match(/^\/catalog\/programs\/([^/]+)$/);
  if (method === 'GET' && match) return catalogProgram(entityId(match[1]));
  const actor = await requireUser(event);
  if (method === 'GET' && path === '/me') return { user: { id: actor.id, name: actor.name, email: actor.email, role: actor.role, twoFactorEnabled: actor.twoFactorEnabled, mfaVerified: Boolean(actor.mfaVerifiedAt && Date.now() - actor.mfaVerifiedAt < 12 * 60 * 60 * 1000) } };
  if (method === 'GET' && path === '/me/enrollments') return myEnrollments(actor);
  if (method === 'GET' && path === '/admin/users') return listUsers(actor, getRequestURL(event).searchParams.get('query') || '');
  match = path.match(/^\/admin\/users\/([^/]+)\/role$/);
  if (method === 'POST' && match) { const body = await jsonBody(event, ['role', 'reason']); return changeRole(actor, entityId(match[1]), textValue(body.role, 'role', 30), textValue(body.reason, 'reason', 2000)); }
  if (method === 'POST' && path === '/enrollments') {
    const body = await jsonBody(event, ['versionId']);
    return createEnrollment(actor, { userId: actor.id, versionId: entityId(body.versionId) }, requestKey(event), true);
  }
  match = path.match(/^\/enrollments\/([^/]+)$/);
  if (method === 'GET' && match) return enrollmentDetails(actor, entityId(match[1]));
  match = path.match(/^\/enrollments\/([^/]+)\/lessons\/([^/]+)$/);
  if (method === 'GET' && match) return getLesson(actor, entityId(match[1]), entityId(match[2]));
  match = path.match(/^\/enrollments\/([^/]+)\/progress\/([^/]+)$/);
  if (method === 'PUT' && match) {
    const body = await jsonBody(event, ['revision', 'completed']);
    if (body.completed !== true) fail(400, 'INVALID_COMPLETION', 'Only lesson completion can be submitted');
    return completeLesson(actor, entityId(match[1]), entityId(match[2]), integer(body.revision, 'revision'));
  }
  match = path.match(/^\/enrollments\/([^/]+)\/attempts$/);
  if (method === 'POST' && match) { await jsonBody(event, []); return startAttempt(actor, entityId(match[1]), requestKey(event)); }
  match = path.match(/^\/attempts\/([^/]+)$/);
  if (method === 'GET' && match) return getAttempt(actor, entityId(match[1]));
  match = path.match(/^\/attempts\/([^/]+)\/answers\/([^/]+)$/);
  if (method === 'PUT' && match) {
    const body = await jsonBody(event, ['revision', 'selectedOptionIds']);
    return saveAnswer(actor, entityId(match[1]), entityId(match[2]), body.selectedOptionIds, integer(body.revision, 'revision'));
  }
  match = path.match(/^\/attempts\/([^/]+)\/submit$/);
  if (method === 'POST' && match) { await jsonBody(event, []); return submitAttempt(actor, entityId(match[1])); }
  if (method === 'GET' && path === '/admin/program-versions') return listVersions(actor);
  match = path.match(/^\/admin\/programs\/([^/]+)\/authoring-guide$/);
  if (method === 'GET' && match) return getAuthoringGuide(actor, entityId(match[1]));
  if (method === 'POST' && path === '/admin/programs') { const body = await jsonBody(event, ['id', 'directionId', 'title']); return createProgram(actor, body); }
  if (method === 'POST' && path === '/admin/program-versions') {
    const body = await jsonBody(event, ['programId', 'data']); return createVersion(actor, entityId(body.programId), body.data);
  }
  match = path.match(/^\/admin\/program-versions\/([^/]+)$/);
  if (method === 'PATCH' && match) { const body = await jsonBody(event, ['revision', 'data']); return updateVersion(actor, entityId(match[1]), integer(body.revision, 'revision'), body.data); }
  match = path.match(/^\/admin\/program-versions\/([^/]+)\/review$/);
  if (method === 'POST' && match) { const body = await jsonBody(event, ['revision']); return reviewVersion(actor, entityId(match[1]), integer(body.revision, 'revision')); }
  match = path.match(/^\/admin\/program-versions\/([^/]+)\/publish$/);
  if (method === 'POST' && match) { const body = await jsonBody(event, ['revision', 'evidence']); return publishVersion(actor, entityId(match[1]), integer(body.revision, 'revision'), textValue(body.evidence, 'evidence', 4000)); }
  if (method === 'POST' && path === '/admin/enrollments') {
    const body = await jsonBody(event, ['userId', 'versionId', 'accessUntil', 'reason', 'evidence']);
    return createEnrollment(actor, { userId: entityId(body.userId), versionId: entityId(body.versionId), accessUntil: body.accessUntil ? isoDate(body.accessUntil, 'accessUntil') : null, reason: textValue(body.reason, 'reason', 2000), evidence: textValue(body.evidence, 'evidence', 4000) }, requestKey(event));
  }
  match = path.match(/^\/admin\/enrollments\/([^/]+)\/activate$/);
  if (method === 'POST' && match) { const body = await jsonBody(event, ['reason']); return activateEnrollment(actor, entityId(match[1]), textValue(body.reason, 'reason', 2000)); }
  match = path.match(/^\/admin\/enrollments\/([^/]+)\/practice\/([^/]+)$/);
  if (method === 'POST' && match) { const body = await jsonBody(event, ['evidence', 'reason']); return confirmPractice(actor, entityId(match[1]), entityId(match[2]), textValue(body.evidence, 'evidence', 4000), textValue(body.reason, 'reason', 2000)); }
  fail(404, 'ENDPOINT_NOT_FOUND', 'API endpoint not found');
});
