import { defineEventHandler, getRequestURL } from 'h3';
import { isPreviewableSeoDraft, seoDraftPreviewAllowed, seoDraftPreviewIds, seoDraftPrivateHeaders } from '../utils/seo-draft-preview';

export default defineEventHandler(async (event) => {
  const url = getRequestURL(event, { xForwardedHost: false, xForwardedProto: false });
  const match = /^\/(?:kk\/)?preview\/seo\/([^/]+)\/?$/.exec(url.pathname);
  const id = match?.[1];
  if (!id) return;
  const allowed = url.pathname.startsWith('/preview/seo/') && seoDraftPreviewIds.includes(id)
    && seoDraftPreviewAllowed(process.env, url.hostname);
  // Expected preview denials are ordinary HTTP responses. Nitro's generic
  // error renderer overwrites cache headers on thrown page 404s.
  if (allowed) {
    const { default: registry } = await import('../content/seo-expansion-drafts.json');
    const drafts: readonly unknown[] = registry.drafts;
    if (drafts.some((draft) => isPreviewableSeoDraft(draft) && draft.contentId === id)) return;
  }
  return new Response('Not found', { status: 404, headers: seoDraftPrivateHeaders });
});
