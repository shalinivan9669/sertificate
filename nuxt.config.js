import { cities } from './config/cities';
import { buildPrivateRouteRules, buildPublicRoutes, buildSitemapEntries, defaultSiteUrl } from './config/public-route-policy.js';

// Preserve the existing host until the owner approves a domain migration.
const siteUrl = process.env.NUXT_PUBLIC_SITE_URL || defaultSiteUrl;
const siteName = 'OT Center';
const defaultLocale = 'ru-KZ';
const compatibilityDate = '2025-11-20';

const organizationLd = {
  '@type': 'EducationalOrganization',
  name: siteName,
  url: siteUrl,
  logo: `${siteUrl}/logo.png`,
  sameAs: [siteUrl],
  address: {
    '@type': 'PostalAddress',
    addressCountry: 'KZ',
    addressRegion: 'Республика Казахстан',
  },
  areaServed: cities.map((city) => ({
    '@type': 'City',
    name: city.nameRu,
  })),
};

export default defineNuxtConfig({
  buildDir: '.nuxt',
  ssr: true,
  compatibilityDate,
  devtools: { enabled: process.env.NODE_ENV !== 'production' },
  runtimeConfig: {
    amoBaseUrl: process.env.AMO_BASE_URL,
    amoAccessToken: process.env.AMO_ACCESS_TOKEN,
    // Backward compatibility with previous env names.
    amoSubdomain: process.env.AMO_SUBDOMAIN,
    amoLongToken: process.env.AMO_LONG_TOKEN,
    amoLeadCityFieldId: process.env.AMO_LEAD_CITY_FIELD_ID,
    amoLeadCommentFieldId: process.env.AMO_LEAD_COMMENT_FIELD_ID,
    public: {
      siteUrl,
      siteName,
    },
  },
  devServer: {
    host: 'localhost',
    port: 3000,
  },
  vite: {
    server: {
      hmr: {
        port: 3003,
      },
    },
  },
  modules: ['@nuxtjs/i18n', '@nuxtjs/robots', '@nuxtjs/sitemap', '@nuxtjs/tailwindcss'],
  css: ['~/assets/css/tailwind.css'],
  postcss: {
    plugins: {
      tailwindcss: {},
      autoprefixer: {},
    },
  },
  app: {
    head: {
      charset: 'utf-8',
      viewport: 'width=device-width, initial-scale=1',
      title: siteName,
      titleTemplate: (titleChunk) => (!titleChunk ? siteName : /OT Center/i.test(titleChunk) ? titleChunk : `${titleChunk} — ${siteName}`),
      meta: [
        {
          name: 'description',
          content:
            'Обучение по охране труда, ТБ, БИОТ и промышленной безопасности по всему Казахстану. Онлайн/дистанционно, очно и выездно. Удостоверения, сертификаты, аттестация и проверка знаний.',
        },
        { property: 'og:site_name', content: siteName },
        { property: 'og:type', content: 'website' },
        { property: 'og:image', content: `${siteUrl}/logo.png` },
        { name: 'twitter:card', content: 'summary_large_image' },
        { name: 'twitter:image', content: `${siteUrl}/logo.png` },
      ],
      link: [
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
        { rel: 'icon', type: 'image/png', sizes: '512x512', href: '/logo.png' },
        { rel: 'apple-touch-icon', sizes: '512x512', href: '/logo.png' },
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Manrope:wght@700;800&family=Inter:wght@400;500;600;700&display=swap' },
        { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0' },
      ],
      script: [
        {
          type: 'application/ld+json',
          children: JSON.stringify({
            '@context': 'https://schema.org',
            '@graph': [organizationLd],
          }),
        },
      ],
    },
  },
  i18n: {
    strategy: 'prefix_except_default',
    defaultLocale: 'ru',
    detectBrowserLanguage: false,
    restructureDir: '.',
    vueI18n: './i18n.config.js',
    baseUrl: siteUrl,
    locales: [
      { code: 'ru', language: 'ru-KZ', name: 'Русский' },
      { code: 'kk', language: 'kk-KZ', name: 'Қазақша' },
    ],
  },
  site: {
    url: siteUrl,
    name: siteName,
    defaultLocale,
    indexable: process.env.OT_NOINDEX !== 'true',
  },
  sitemap: {
    enabled: true,
    excludeAppSources: true,
    autoI18n: false,
    autoLastmod: false,
    discoverImages: false,
    discoverVideos: false,
    urls: buildSitemapEntries(siteUrl),
    cacheMaxAgeSeconds: 60 * 60,
  },
  robots: {
    enabled: true,
    sitemap: `${siteUrl}/sitemap.xml`,
    // HTML noindex remains readable to crawlers; auth is enforced by server APIs.
    disallow: ['/api/', '/kk/api/'],
    disallowNonIndexableRoutes: false,
    mergeWithRobotsTxtPath: false,
  },
  routeRules: buildPrivateRouteRules(),
  nitro: {
    // Nitro's auto-detection currently falls back to Node 22 even on a Node 24
    // build host. Keep the generated function runtime aligned with engines.node.
    vercel: { functions: { runtime: 'nodejs24.x', maxDuration: 60 } },
    externals: {
      inline: [/config[\\/]public-route-(policy|runtime)/, /config[\\/](cities|courses|formats|blog)/, /shared[\\/]source-products/],
      // Native development adapter is optional and its binary cannot be inferred by the tracer.
      traceInclude: process.platform === 'win32' && process.env.NITRO_PRESET !== 'vercel'
        ? ['node_modules/@libsql/win32-x64-msvc/index.node'] : [],
    },
    prerender: {
      crawlLinks: false,
      routes: [...buildPublicRoutes(), '/sitemap.xml', '/robots.txt'],
    },
  },
});




