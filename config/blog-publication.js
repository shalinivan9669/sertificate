// Existing articles remain published. New imports require an explicit editorial
// decision; a research status or a complete draft is never that decision.
const existingPublishedSlugs = new Set([
  'ohrana-truda-kazakhstan-2026', 'promyshlennaya-bezopasnost-kazakhstan-2026',
  'pozharnyj-tekhnicheskiy-minimum', 'elektrobezopasnost-gruppy-dopuska-kazakhstan-2026',
  'raboty-na-vysote-kazakhstan-2026', 'biot-novye-pravila-2026-2027',
  'ptm-rasshifrovka-programmy-2026', 'reestr-professionalnyh-riskov-2026',
  'gazoopasnye-raboty-dopusk-kazakhstan', 'prombezopasnost-itr-periodichnost-obucheniya',
  'elektrobezopasnost-prisvoenie-gruppy-dokumenty-rk', 'udostoverenie-ohrana-truda-proverka-kazakhstan',
  'ohrana-truda-tehnika-bezopasnosti-raznica', 'instruktazhi-ohrana-truda-zhurnal-kazakhstan',
  'plan-obucheniya-personala-2027', 'proverki-ohrany-truda-itogi-2026',
  'antikorrupcionnyj-komplaens-trudovye-garantii-2026', 'proizvodstvennyj-kontrol-neftegaz-2026',
  'vnutrennie-trenery-ohrana-truda-2026', 'ii-umnye-kaski-ohrana-truda-2026',
  'obuchenie-udostoverenie-sertifikat-professiya', 'otopitelnyj-sezon-bezopasnost-rabochih-mest-2026',
  'pozharnaya-bezopasnost-kafe-torgovlya-2026', 'otopitelnyj-sezon-almaty-2026-2027',
  'otopitelnyj-sezon-karaganda-2026-2027', 'esutd-trudovye-dogovory-proverka-2026',
  'kontrol-ohrany-truda-strojploshchadka-2026',
]);

export function getPublishedBlogLocales(post) {
  if (!post || post.contentKind === 'localization_brief' || post.content_kind === 'localization_brief') return [];
  const status = post.publicationStatus ?? post.publication_status;
  const packageStatus = post.packagePublicationStatus;
  if (status && status !== 'published' || packageStatus?.startsWith('HOLD')) return [];
  const existing = existingPublishedSlugs.has(post.slug);
  if (!existing && (status !== 'published' || post.editorialApproved !== true)) return [];
  const locales = post.publishedLocales ?? (existing ? ['ru', 'kk'] : []);
  return ['ru', 'kk'].filter((locale) => locales.includes(locale)
    && typeof post.title?.[locale] === 'string' && post.title[locale].trim()
    && typeof post.seoTitle?.[locale] === 'string' && post.seoTitle[locale].trim()
    && typeof post.description?.[locale] === 'string' && post.description[locale].trim()
    && typeof post.bodyHtml?.[locale] === 'string' && post.bodyHtml[locale].trim()
    && /^\d{4}-\d{2}-\d{2}$/.test(post.date || ''));
}

export function getBlogModifiedAt(post, locale) {
  if (locale) return post.updatedAtByLocale?.[locale] || post.updatedAt || post.date;
  return [post.updatedAt || post.date, ...Object.values(post.updatedAtByLocale || {})].filter(Boolean).sort().at(-1);
}
