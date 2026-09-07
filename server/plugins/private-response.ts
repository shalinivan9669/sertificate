import { setResponseHeaders } from 'h3';
import { isNonIndexableRoute } from '../../config/public-route-runtime.js';

export default defineNitroPlugin((nitroApp) => {
  // Nuxt's error renderer may overwrite route-rule cache headers. Enforce the
  // same boundary just before headers are sent, including private 404 responses.
  nitroApp.hooks.hook('beforeResponse', (event) => {
    if (!isNonIndexableRoute(event.path)) return;
    setResponseHeaders(event, {
      'cache-control': 'private, no-store, max-age=0',
      'x-robots-tag': 'noindex, nofollow, noarchive',
      'referrer-policy': 'same-origin',
    });
  });
});
