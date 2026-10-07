import { useHead, useLocaleHead, useRoute } from '#imports';
import { canonicalPublicUrl, isNonIndexableRoute, stripLocale } from '~/config/public-route-runtime';
import { getBlogPublishedLocales } from '#build/blog-summaries.mjs';

export function usePublicLocaleHead() {
  const route = useRoute();
  // @nuxtjs/i18n 10.x: dir/lang/seo, locales[].language (not the old iso API).
  const localeHead = useLocaleHead({ dir: true, lang: true, seo: { canonicalQueries: [] } });
  useHead(() => {
    const privateRoute = isNonIndexableRoute(route.path);
    const article = /^\/blog\//.test(stripLocale(route.path));
    const articleLocales = article ? getBlogPublishedLocales(stripLocale(route.path)) : ['ru', 'kk'];
    return {
      htmlAttrs: localeHead.value.htmlAttrs,
      link: privateRoute ? [] : localeHead.value.link?.filter((link) => link.rel !== 'alternate' || articleLocales.length > 1).map((link) => (
        link.href && (link.rel === 'canonical' || link.rel === 'alternate')
          ? { ...link, href: canonicalPublicUrl(link.href) }
          : link
      )),
      meta: [
        ...localeHead.value.meta.map((meta) => (
          meta.property === 'og:url' && meta.content
            ? { ...meta, content: canonicalPublicUrl(meta.content) }
            : meta
        )),
        ...(privateRoute ? [{ name: 'robots', content: 'noindex, nofollow, noarchive' }] : []),
      ],
    };
  });
}
