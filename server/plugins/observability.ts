import { getResponseStatus, setHeader, setResponseStatus } from 'h3';
import { observeApiResponse } from '../services/request-observations';
import { safeApiFailure } from '../utils/observability';

export default defineNitroPlugin(nitroApp => {
  nitroApp.hooks.hook('error', (error, context) => {
    const event = context.event;
    if (!event?.path.startsWith('/api/')) return;
    // Middleware errors occur before the API run-wrapper. Replace their eventual
    // generic error body and prevent the framework from printing raw exception data.
    event.context.safeApiFailure = safeApiFailure(event, error);
    Object.assign(error, event.context.safeApiFailure, { stack: '', cause: undefined, unhandled: false, fatal: false });
  });
  nitroApp.hooks.hook('beforeResponse', async (event, response) => {
    if (event.context.safeApiFailure) {
      const payload = event.context.safeApiFailure;
      setResponseStatus(event, payload.statusCode, payload.statusMessage);
      setHeader(event, 'Content-Type', 'application/json; charset=utf-8');
      response.body = JSON.stringify(payload);
    }
    // Metadata is explicit on the event. No enterWith hook can leak a concurrent context.
    const work = observeApiResponse(event, getResponseStatus(event));
    if (event.waitUntil) event.waitUntil(work);
    else await work;
  });
});
