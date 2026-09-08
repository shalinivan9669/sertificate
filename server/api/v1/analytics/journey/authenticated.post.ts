import { defineEventHandler, getCookie, getHeader, getRequestIP, readBody } from 'h3';
import { analyticsCookieName } from '../../../../../shared/analytics';
import { confirmPublicJourneyAuth } from '../../../../services/lead-attribution';
import { requireUser } from '../../../../utils/auth';
import { limit } from '../../../../utils/business';
import { runWithRequestObservation } from '../../../../utils/observability';

export default defineEventHandler(event => runWithRequestObservation(event, async () => {
  const ip = process.env.VERCEL ? getHeader(event, 'x-vercel-forwarded-for') || 'unknown' : getRequestIP(event) || 'unknown';
  return confirmPublicJourneyAuth(await readBody(event), getCookie(event, analyticsCookieName), () => requireUser(event), () => limit(`journey-auth:${ip}`, 30, 60000));
}));
