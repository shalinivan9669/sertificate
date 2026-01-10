<script setup>
import { computed } from 'vue';
import { useHead, useI18n, useLocalePath, useRoute, useRuntimeConfig } from '#imports';
import { getCityName, getCityPrepositional } from '~/composables/useCity';

const props = defineProps({
  course: {
    type: Object,
    required: true,
  },
  city: {
    type: [Object, null],
    default: null,
  },
});

const resolvedCity = computed(() =>
  props.city && 'value' in props.city ? props.city.value : props.city,
);

const { locale, t, tm } = useI18n();
const localePath = useLocalePath();
const route = useRoute();
const runtimeConfig = useRuntimeConfig();

const courseName = computed(() => props.course.name[locale.value] || props.course.name.ru);
const cityName = computed(
  () =>
    getCityName(resolvedCity.value, locale.value) ||
    (locale.value === 'kk' ? 'Қазақстан бойынша' : 'по Казахстану'),
);
const cityPrepositional = computed(
  () =>
    getCityPrepositional(resolvedCity.value, locale.value) ||
    (locale.value === 'kk' ? 'Қазақстанда' : 'в Казахстане'),
);

const fillTemplate = (template) =>
  template
    .replaceAll('{{city}}', cityName.value)
    .replaceAll('{{cityPrepositional}}', cityPrepositional.value);

const resolveSeoValue = (value, fallback) => {
  if (!value) return fallback;
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    return value[locale.value] || value.ru || value.kk || fallback;
  }
  return fallback;
};

const fallbackDescription = computed(() => {
  if (locale.value === 'kk') {
    return `Еңбекті қорғау және ТБ бойынша оқу ${cityPrepositional.value}: куәлік беру, білімді тексеру, аттестаттау.`;
  }
  return `Обучение по охране труда и ТБ ${cityPrepositional.value}: выдача удостоверений, проверка знаний, аттестация.`;
});

const metaTitle = computed(() =>
  fillTemplate(resolveSeoValue(props.course.seo?.title, courseName.value)),
);
const metaDescription = computed(() =>
  fillTemplate(resolveSeoValue(props.course.seo?.description, fallbackDescription.value)),
);

const courseContentHtml = computed(() => props.course.contentHtml || '');

const baseUrl = computed(() => runtimeConfig.public.siteUrl || 'https://example.kz');
const canonicalUrl = computed(() => new URL(route.path || '/', baseUrl.value).toString());

const asList = (value) => (Array.isArray(value) ? value : []);
const includesItems = computed(() => asList(tm('course.includesItems')));
const benefitsItems = computed(() => asList(tm('course.benefitsItems')));
const processItems = computed(() => asList(tm('course.processItems')));
const requirementsItems = computed(() => asList(tm('course.requirementsItems')));
const whyItems = computed(() => asList(tm('course.whyItems')));
const faqItems = computed(() => {
  const items = asList(tm('course.faqItems'));
  return items.map((item, index) => ({
    q: item.q,
    a: t(`course.faqItems.${index}.a`, { hours: course.durationHours }),
  }));
});

const courseSchema = computed(() => ({
  '@context': 'https://schema.org',
  '@type': 'Course',
  name: courseName.value,
  description: metaDescription.value,
  url: canonicalUrl.value,
  provider: {
    '@type': 'EducationalOrganization',
    name:
      runtimeConfig.public.siteName ||
      (locale.value === 'kk' ? 'Оқу орталығы' : 'Учебный центр'),
    url: baseUrl.value,
  },
  educationalCredentialAwarded:
    locale.value === 'kk' ? 'Куәлік/сертификат' : 'Удостоверение/сертификат',
  courseMode: ['online', 'in-person'],
  areaServed: resolvedCity.value
    ? [
        {
          '@type': 'City',
          name: getCityName(resolvedCity.value, locale.value),
        },
      ]
    : [
        {
          '@type': 'Country',
          name: 'Kazakhstan',
        },
      ],
}));

const breadcrumbSchema = computed(() => {
  const items = [
    {
      '@type': 'ListItem',
      position: 1,
      name: t('nav.home'),
      item: new URL(localePath('/'), baseUrl.value).toString(),
    },
  ];

  if (resolvedCity.value?.slug) {
    items.push({
      '@type': 'ListItem',
      position: items.length + 1,
      name: getCityName(resolvedCity.value, locale.value),
      item: new URL(localePath(`/${resolvedCity.value.slug}`), baseUrl.value).toString(),
    });
  }

  items.push({
    '@type': 'ListItem',
    position: items.length + 1,
    name: courseName.value,
    item: canonicalUrl.value,
  });

  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items,
  };
});

useHead(() => ({
  title: metaTitle.value,
  meta: [
    { name: 'description', content: metaDescription.value },
    { property: 'og:title', content: metaTitle.value },
    { property: 'og:description', content: metaDescription.value },
    { property: 'og:type', content: 'article' },
    { name: 'twitter:title', content: metaTitle.value },
    { name: 'twitter:description', content: metaDescription.value },
  ],
  script: [
    {
      type: 'application/ld+json',
      children: JSON.stringify(courseSchema.value),
    },
    {
      type: 'application/ld+json',
      children: JSON.stringify(breadcrumbSchema.value),
    },
  ],
}));
</script>

<template>
  <article class="space-y-10">
    <header class="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm space-y-4">
      <p class="text-sm font-semibold text-brand-accent uppercase tracking-wide">{{ t('course.badge') }}</p>
      <h1 class="text-3xl md:text-4xl font-bold text-slate-900 leading-tight">{{ metaTitle }}</h1>
      <p class="text-lg text-slate-700">
        {{ metaDescription }}
      </p>
      <div class="flex flex-wrap gap-3 text-sm text-slate-700">
        <span class="inline-flex items-center gap-2 rounded-full bg-brand-soft px-3 py-1 border border-slate-200">
          <strong class="font-semibold text-slate-900">{{ t('course.durationLabel') }}:</strong>
          {{ course.durationHours }} {{ t('course.durationUnit') }}
        </span>
        <span class="inline-flex items-center gap-2 rounded-full bg-brand-soft px-3 py-1 border border-slate-200">
          <strong class="font-semibold text-slate-900">{{ t('course.mandatoryLabel') }}:</strong>
          {{ course.mandatoryByLaw ? t('course.mandatoryYes') : t('course.mandatoryNo') }}
        </span>
        <span class="inline-flex items-center gap-2 rounded-full bg-brand-soft px-3 py-1 border border-slate-200">
          <strong class="font-semibold text-slate-900">{{ t('course.cityLabel') }}:</strong>
          {{ getCityName(resolvedCity, locale) || t('course.anyRegion') }}
        </span>
      </div>
    </header>

    <section class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-3">
      <h2 class="text-xl font-semibold text-slate-900">{{ t('course.includesTitle') }}</h2>
      <ul class="grid gap-2 text-slate-700 list-disc ml-4">
        <li v-for="item in includesItems" :key="item">{{ item }}</li>
      </ul>
    </section>

    <section class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-3">
      <h2 class="text-xl font-semibold text-slate-900">{{ t('course.programTitle') }}</h2>
      <div v-if="courseContentHtml" class="prose max-w-none prose-slate" v-html="courseContentHtml" />
      <div v-else class="text-slate-700">
        {{ t('course.programFallback', { courseName, cityPrepositional }) }}
      </div>
    </section>

    <section class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-3">
      <h2 class="text-xl font-semibold text-slate-900">{{ t('course.benefitsTitle') }}</h2>
      <ul class="grid gap-2 text-slate-700 list-disc ml-4">
        <li v-for="item in benefitsItems" :key="item">{{ item }}</li>
      </ul>
    </section>

    <section class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-3">
      <h2 class="text-xl font-semibold text-slate-900">{{ t('course.processTitle') }}</h2>
      <ul class="grid gap-2 text-slate-700 list-disc ml-4">
        <li v-for="item in processItems" :key="item">{{ item }}</li>
      </ul>
    </section>

    <section class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
      <h2 class="text-xl font-semibold text-slate-900">{{ t('course.signupTitle') }}</h2>
      <p class="text-slate-700">
        {{ t('course.signupText') }}
      </p>
      <div class="flex flex-wrap gap-3">
        <a class="inline-flex items-center justify-center px-5 py-3 rounded-lg bg-brand-accent text-white font-semibold hover:bg-emerald-700 transition" href="#contact">{{ t('course.signupCta') }}</a>
        <a class="inline-flex items-center justify-center px-5 py-3 rounded-lg border border-slate-200 text-brand font-semibold hover:border-brand hover:text-brand transition" href="tel:+77470966900">{{ t('cta.call') }}</a>
      </div>
    </section>

    <section class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-3">
      <h2 class="text-xl font-semibold text-slate-900">{{ t('course.whyTitle') }}</h2>
      <ul class="grid gap-2 text-slate-700 list-disc ml-4">
        <li v-for="item in whyItems" :key="item">{{ item }}</li>
      </ul>
    </section>

    <section class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-3">
      <h2 class="text-xl font-semibold text-slate-900">{{ t('course.requirementsTitle') }}</h2>
      <ul class="grid gap-2 text-slate-700 list-disc ml-4">
        <li v-for="item in requirementsItems" :key="item">{{ item }}</li>
      </ul>
    </section>

    <section class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-3">
      <h2 class="text-xl font-semibold text-slate-900">{{ t('course.faqTitle') }}</h2>
      <div class="divide-y divide-slate-200">
        <details v-for="item in faqItems" :key="item.q" class="py-3">
          <summary class="cursor-pointer font-semibold text-slate-900">{{ item.q }}</summary>
          <p class="mt-2 text-slate-700">{{ item.a }}</p>
        </details>
      </div>
    </section>
  </article>
</template>
