import { defineEventHandler, getRequestURL } from 'h3';
import core, { isCorePath } from '../../handlers/core';
import business from '../../handlers/business';
import { runWithRequestObservation } from '../../utils/observability';

type ApiResponse = Awaited<ReturnType<typeof core> | ReturnType<typeof business>>;

/** One unambiguous router. Core and commerce modules share the same API namespace. */
export default defineEventHandler(event => {
  const path = getRequestURL(event).pathname.replace(/^\/api\/v1/, '');
  return runWithRequestObservation<ApiResponse>(event, () => isCorePath(path) ? core(event) : business(event));
});
