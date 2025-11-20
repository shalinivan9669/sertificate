import fs from 'node:fs';
import path from 'node:path';
import { cities } from './config/cities';
import { courses } from './config/courses';
import { formats } from './config/formats';

const siteUrl = 'https://example.kz';
const defaultLocale = 'ru-KZ';

const blogDir = path.resolve('./content/blog');

const getBlogRoutes = () => {
  if (!fs.existsSync(blogDir)) {
    return [];
  }

  return fs
    .readdirSync(blogDir)
    .filter((file) => file.endsWith('.md'))
    .map((file) => `/blog/${file.replace(/\\.md$/, '')}`);
};

const buildCityRoutes = () => cities.map((city) => `/${city.slug}`);
const buildCourseRoutes = () =>
  cities.flatMap((city) => courses.map((course) => `/${city.slug}/${course.slug}`));
const buildFormatRoutes = () =>
  cities.flatMap((city) => formats.map((format) => `/${city.slug}/${format.slug}`));

const staticRoutes = () => {
  const baseRoutes = ['/', '/blog'];
  return [
    ...baseRoutes,
    ...getBlogRoutes(),
    ...buildCityRoutes(),
    ...buildCourseRoutes(),
    ...buildFormatRoutes(),
  ];
};

const organizationLd = {
  '@type': 'EducationalOrganization',
  name: 'Учебный центр по охране труда и промышленной безопасности',
  url: siteUrl,
  logo: `${siteUrl}/logo.png`,
  sameAs: ['https://example.kz'],
  address: {
    '@type': 'PostalAddress',
    addressCountry: 'KZ',
    addressRegion: 'Казахстан',
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
  name: `Учебный центр по охране труда, г. ${city.nameRu}`,
  address: {
    '@type': 'PostalAddress',
    addressLocality: city.nameRu,
    addressCountry: 'KZ',
  },
  areaServed: city.nameRu,
}));

export default defineNuxtConfig({
  ssr: true,
  compatibilityDate: '2025-11-20',
  devtools: { enabled: false },
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
  modules: ['@nuxtjs/i18n', '@nuxt/content', '@nuxtjs/seo', '@nuxtjs/tailwindcss'],
  css: ['~/assets/css/tailwind.css'],
  postcss: {
    plugins: {
      tailwindcss: {},
      autoprefixer: {},
    },
  },
  app: {
    head: {
      htmlAttrs: { lang: 'ru' },
      charset: 'utf-8',
      viewport: 'width=device-width, initial-scale=1',
      title: 'Учебный центр по охране труда и промышленной безопасности',
      titleTemplate: (titleChunk) =>
        titleChunk
          ? `Учебный центр по охране труда – ${titleChunk}`
          : 'Учебный центр по охране труда и промышленной безопасности',
      meta: [
        { name: 'description', content: 'Лицензированный учебный центр: охрана труда, промышленная безопасность, ПТМ, электробезопасность по всей РК.' },
        { property: 'og:site_name', content: 'Учебный центр по охране труда и промышленной безопасности' },
        { property: 'og:type', content: 'website' },
        { property: 'og:locale', content: 'ru_KZ' },
      ],
      link: [{ rel: 'canonical', href: siteUrl }],
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
    vueI18n: './i18n.config.js',
    baseUrl: siteUrl,
    locales: [
      { code: 'ru', iso: 'ru-KZ', name: 'Русский' },
      { code: 'kk', iso: 'kk-KZ', name: 'Қазақша' },
    ],
  },
  content: {
    documentDriven: true,
  },
  seo: {
    site: {
      url: siteUrl,
      name: 'Учебный центр по охране труда и промышленной безопасности',
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
      routes: staticRoutes(),
    },
  },
});
