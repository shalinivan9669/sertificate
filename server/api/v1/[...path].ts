import { defineEventHandler, getRequestURL } from 'h3';
import core, { isCorePath } from '../../handlers/core';
import business from '../../handlers/business';
import { runWithRequestObservation } from '../../utils/observability';

/** One unambiguous router. Core and commerce modules share the same API namespace. */
export default defineEventHandler(event => {
  const path = getRequestURL(event).pathname.replace(/^\/api\/v1/, '');
  return runWithRequestObservation(event, () => isCorePath(path) ? core(event) : business(event));
});
