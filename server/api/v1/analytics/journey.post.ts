import { defineEventHandler, getCookie, getHeader, getRequestIP, readBody } from 'h3';
import { analyticsCookieName } from '../../../../shared/analytics';
import { recordPublicJourney } from '../../../services/lead-attribution';
import { limit } from '../../../utils/business';
import { runWithRequestObservation } from '../../../utils/observability';

export default defineEventHandler(event => runWithRequestObservation(event, async () => {
  const ip = process.env.VERCEL ? getHeader(event, 'x-vercel-forwarded-for') || 'unknown' : getRequestIP(event) || 'unknown';
  return recordPublicJourney(await readBody(event), getCookie(event, analyticsCookieName), () => limit(`journey:${ip}`, 90, 60000));
}));
