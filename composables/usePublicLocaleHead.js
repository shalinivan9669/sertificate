import { useHead, useLocaleHead, useRoute } from '#imports';
import { canonicalPublicUrl, isNonIndexableRoute } from '~/config/public-route-runtime';

export function usePublicLocaleHead() {
  const route = useRoute();
  // @nuxtjs/i18n 10.x: dir/lang/seo, locales[].language (not the old iso API).
  const localeHead = useLocaleHead({ dir: true, lang: true, seo: { canonicalQueries: [] } });
  useHead(() => {
    const privateRoute = isNonIndexableRoute(route.path);
    return {
      htmlAttrs: localeHead.value.htmlAttrs,
      link: privateRoute ? [] : localeHead.value.link?.map((link) => (
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
