import { cities } from './config/cities';
import { courses } from './config/courses';
import { formats } from './config/formats';
import { blogPosts } from './config/blog';

const siteUrl = 'https://example.kz';
const siteName = 'Учебный центр по охране труда и промышленной безопасности';
const defaultLocale = 'ru-KZ';
const compatibilityDate = '2025-11-20';

const getBlogRoutes = () => blogPosts.map((post) => post._path);

const buildCityRoutes = () => cities.map((city) => `/${city.slug}`);
const buildCourseRoutes = () =>
  cities.flatMap((city) => courses.map((course) => `/${city.slug}/${course.slug}`));
const buildFormatRoutes = () =>
  cities.flatMap((city) => formats.map((format) => `/${city.slug}/${format.slug}`));

const localePrefixes = ['kk'];
const prefixRoutes = (routes, locale) =>
  routes.map((route) => (route === '/' ? `/${locale}` : `/${locale}${route}`));

const staticRoutes = () => {
  const baseRoutes = [
    '/',
    '/blog',
    '/contacts',
    '/licenses',
    '/public-offer',
    '/privacy',
    ...courses.map((course) => `/${course.slug}`),
    ...formats.map((format) => `/${format.slug}`),
  ];
  const allRoutes = [
    ...baseRoutes,
    ...getBlogRoutes(),
    ...buildCityRoutes(),
    ...buildCourseRoutes(),
    ...buildFormatRoutes(),
  ];
  return [...allRoutes, ...localePrefixes.flatMap((locale) => prefixRoutes(allRoutes, locale))];
};

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
  makesOffer: courses.map((course) => ({
    '@type': 'Course',
    name: course.name.ru,
    identifier: course.slug,
  })),
};

const locationsLd = cities.map((city) => ({
  '@type': 'LocalBusiness',
  name: `${siteName}, г. ${city.nameRu}`,
  address: {
    '@type': 'PostalAddress',
    addressLocality: city.nameRu,
    addressCountry: 'KZ',
  },
  areaServed: city.nameRu,
}));

export default defineNuxtConfig({
  ssr: true,
  compatibilityDate,
  devtools: { enabled: false },
  runtimeConfig: {
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
  modules: ['@nuxtjs/i18n', '@nuxtjs/seo', '@nuxtjs/tailwindcss'],
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
      titleTemplate: (titleChunk) =>
        titleChunk ? `Учебный центр по охране труда - ${titleChunk}` : siteName,
      meta: [
        {
          name: 'description',
          content:
            'Обучение по охране труда, ТБ, БИОТ и промышленной безопасности по всему Казахстану. Онлайн/дистанционно, очно и выездно. Удостоверения, сертификаты, аттестация и проверка знаний.',
        },
        { property: 'og:site_name', content: siteName },
        { property: 'og:type', content: 'website' },
        { name: 'twitter:card', content: 'summary_large_image' },
      ],
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        { rel: 'icon', type: 'image/png', sizes: '512x512', href: '/logo.png' },
        { rel: 'apple-touch-icon', sizes: '512x512', href: '/logo.png' },
      ],
      script: [
        {
          type: 'application/ld+json',
          children: JSON.stringify({
            '@context': 'https://schema.org',
            '@graph': [organizationLd, ...locationsLd],
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
      { code: 'ru', iso: 'ru-KZ', name: 'Русский' },
      { code: 'kk', iso: 'kk-KZ', name: 'Қазақша' },
    ],
  },
  seo: {
    site: {
      url: siteUrl,
      name: siteName,
      defaultLocale,
    },
    sitemap: {
      enabled: true,
      hostname: siteUrl,
      routes: staticRoutes,
      cacheTtl: 60 * 60,
    },
    robots: {
      enabled: true,
      sitemap: `${siteUrl}/sitemap.xml`,
      rules: [
        {
          userAgent: '*',
          allow: '/',
          disallow: ['/admin', '/preview', '/_nuxt', '/api'],
        },
      ],
    },
  },
  nitro: {
    prerender: {
      crawlLinks: true,
      routes: staticRoutes(),
    },
  },
});






