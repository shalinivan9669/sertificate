export function seoDraftPreviewAllowed(environment: Record<string, string | undefined>, hostname: string) {
  return environment.OT_SEO_DRAFT_PREVIEW === '1'
    && ['development', 'test'].includes(environment.NODE_ENV || '')
    && !environment.VERCEL && !environment.VERCEL_ENV
    && ['localhost', '127.0.0.1', '[::1]', '::1'].includes(hostname.toLowerCase());
}

export function isPreviewableSeoDraft(draft: any): draft is SeoPreviewDraft {
  return seoDraftPreviewIds.includes(draft?.contentId)
    && draft.locale === 'ru' && draft.publicationStatus === 'draft'
    && draft.packagePublicationStatus === 'READY_CONDITIONAL'
    && draft.automaticPublicationAllowed === false && draft.deploymentAuthorized === false
    && typeof draft.bodyHtml === 'string' && draft.bodyHtml.length > 0;
}
export const seoDraftPreviewIds = ['N04', 'N05', 'N06', 'N07', 'N10', 'N11'];
export const seoDraftPrivateHeaders = {
  'cache-control': 'private, no-store, max-age=0',
  'x-robots-tag': 'noindex, nofollow, noarchive',
  'referrer-policy': 'same-origin',
};

export function isSeoDraftPreviewApiPath(path: string) {
  return seoDraftPreviewIds.some((id) => path === `/api/seo-preview/${id}`);
}

export interface SeoPreviewDraft {
  contentId: string;
  locale: 'ru';
  publicationStatus: 'draft';
  packagePublicationStatus: 'READY_CONDITIONAL';
  automaticPublicationAllowed: false;
  deploymentAuthorized: false;
  targetPath: string;
  h1: string;
  description: string;
  checkedAt: string;
  reviewDueAt: string;
  dependencies: string[];
  toc: { id: string; title: string }[];
  bodyHtml: string;
}
