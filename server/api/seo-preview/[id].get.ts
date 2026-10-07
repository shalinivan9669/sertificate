import { defineEventHandler, getRequestURL, getRouterParam, setResponseHeaders, setResponseStatus } from 'h3';
import { isPreviewableSeoDraft, seoDraftPreviewAllowed, seoDraftPrivateHeaders } from '../../utils/seo-draft-preview';

export default defineEventHandler(async (event) => {
  setResponseHeaders(event, seoDraftPrivateHeaders);
  const notFound = () => { setResponseStatus(event, 404, 'Not found'); return null; };
  const hostname = getRequestURL(event, { xForwardedHost: false, xForwardedProto: false }).hostname;
  if (!seoDraftPreviewAllowed(process.env, hostname)) return notFound();
  const { default: registry } = await import('../../content/seo-expansion-drafts.json');
  const id = getRouterParam(event, 'id');
  const drafts: readonly unknown[] = registry.drafts;
  const draft = drafts.filter(isPreviewableSeoDraft).find((entry) => entry.contentId === id);
  if (!draft) return notFound();
  return { draft };
});
