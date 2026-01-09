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

const { locale, t } = useI18n();
const localePath = useLocalePath();
const route = useRoute();
const runtimeConfig = useRuntimeConfig();

const courseName = computed(() => props.course.name[locale.value] || props.course.name.ru);
const cityName = computed(() =>
  getCityName(resolvedCity.value, locale.value) ||
  (locale.value === 'kk' ? 'Сіздің қалаңыз' : 'В вашем городе'),
);
const cityPrepositional = computed(
  () =>
    getCityPrepositional(resolvedCity.value, locale.value) ||
    (locale.value === 'kk' ? 'сіздің қалаңызда' : 'в вашем городе'),
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
    return `Еңбекті қорғау және еңбек қауіпсіздігі бойынша оқыту ${cityPrepositional.value}: білімді тексеру, аттестация, куәлік/сертификат.`;
  }
  return `Обучение по охране труда и ТБ ${cityPrepositional.value}: проверка знаний, аттестация, удостоверение/сертификат.`;
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

const courseSchema = computed(() => ({
  '@context': 'https://schema.org',
  '@type': 'Course',
  name: courseName.value,
  description: metaDescription.value,
  url: canonicalUrl.value,
  provider: {
    '@type': 'EducationalOrganization',
    name: runtimeConfig.public.siteName || 'Учебный центр',
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
      <p class="text-sm font-semibold text-brand-accent uppercase tracking-wide">Курс</p>
      <h1 class="text-3xl md:text-4xl font-bold text-slate-900 leading-tight">{{ metaTitle }}</h1>
      <p class="text-lg text-slate-700">
        {{ metaDescription }}
      </p>
      <div class="flex flex-wrap gap-3 text-sm text-slate-700">
        <span class="inline-flex items-center gap-2 rounded-full bg-brand-soft px-3 py-1 border border-slate-200">
          <strong class="font-semibold text-slate-900">Длительность:</strong> {{ course.durationHours }} акад. часов
        </span>
        <span class="inline-flex items-center gap-2 rounded-full bg-brand-soft px-3 py-1 border border-slate-200">
          <strong class="font-semibold text-slate-900">Обязательность:</strong>
          {{ course.mandatoryByLaw ? 'Требуется по законодательству' : 'По запросу компании' }}
        </span>
        <span class="inline-flex items-center gap-2 rounded-full bg-brand-soft px-3 py-1 border border-slate-200">
          <strong class="font-semibold text-slate-900">Город:</strong>
          {{ getCityName(resolvedCity, locale) || 'Любой регион' }}
        </span>
      </div>
    </header>

    <section class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-3">
      <h2 class="text-xl font-semibold text-slate-900">Что разберём на курсе</h2>
      <ul class="grid gap-2 text-slate-700 list-disc ml-4">
        <li>Нормативные требования и ответственность работодателя.</li>
        <li>Практика безопасной работы и алгоритмы действий в нештатных ситуациях.</li>
        <li>Документирование обучения и подготовка к проверкам.</li>
        <li>Ответы на вопросы сотрудников и разбор кейсов из вашей отрасли.</li>
      </ul>
    </section>

    <section class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-3">
      <h2 class="text-xl font-semibold text-slate-900">Программа курса</h2>
      <div v-if="courseContentHtml" class="prose max-w-none prose-slate" v-html="courseContentHtml" />
      <div v-else class="text-slate-700">
        Программа скоро появится в онлайн-формате. Если нужен подробный план прямо сейчас, напишите нам — отправим
        расписание и содержание модулей.
      </div>
    </section>

    <section class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-3">
      <h2 class="text-xl font-semibold text-slate-900">Выгоды для компании</h2>
      <ul class="grid gap-2 text-slate-700 list-disc ml-4">
        <li>Снижаете штрафные риски и упорядочиваете документы.</li>
        <li>Повышаете осознанность сотрудников в вопросах безопасности.</li>
        <li>Минимизируете простои за счёт готовых чек-листов и регламентов.</li>
        <li>Получаете консультации по адаптации программы под ваши условия {{ cityPrepositional }}.</li>
      </ul>
    </section>

    <section class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-3">
      <h2 class="text-xl font-semibold text-slate-900">Как проходит обучение</h2>
      <p class="text-slate-700">
        Теория и практика идут блоками: дистанционно или очно, по удобному графику. По завершении — тестирование и
        оформление удостоверений, протоколов комиссии и приказов.
      </p>
    </section>

    <section class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
      <h2 class="text-xl font-semibold text-slate-900">Записаться на обучение</h2>
      <p class="text-slate-700">
        Первая консультация бесплатна: подберём формат, согласуем график, подготовим пакет документов.
      </p>
      <div class="flex flex-wrap gap-3">
        <a class="inline-flex items-center justify-center px-5 py-3 rounded-lg bg-brand-accent text-white font-semibold hover:bg-emerald-700 transition" href="#contact">Получить консультацию</a>
        <a class="inline-flex items-center justify-center px-5 py-3 rounded-lg border border-slate-200 text-brand font-semibold hover:border-brand hover:text-brand transition" href="tel:+77000000000">{{ t('cta.call') }}</a>
      </div>
    </section>

    <section class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-3">
      <h2 class="text-xl font-semibold text-slate-900">Почему выбирают нас</h2>
      <ul class="grid gap-2 text-slate-700 list-disc ml-4">
        <li>Работаем по всей стране, организуем выездные и онлайн-группы.</li>
        <li>Преподаватели с практическим опытом и актуальными методиками.</li>
        <li>Готовые шаблоны приказов, журналы и чек-листы.</li>
        <li>Помогаем подготовиться к проверкам и аудиту.</li>
      </ul>
    </section>

    <section class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-3">
      <h2 class="text-xl font-semibold text-slate-900">FAQ</h2>
      <div class="divide-y divide-slate-200">
        <details class="py-3">
          <summary class="cursor-pointer font-semibold text-slate-900">Можно ли обучаться онлайн?</summary>
          <p class="mt-2 text-slate-700">
            Да, все лекции и тесты доступны дистанционно. Практика и итоговая проверка проходят в удобном формате по
            согласованию.
          </p>
        </details>
        <details class="py-3">
          <summary class="cursor-pointer font-semibold text-slate-900">Сколько длится курс?</summary>
          <p class="mt-2 text-slate-700">
            Средняя продолжительность — {{ course.durationHours }} академических часов. График можем уплотнить или
            разбить на несколько недель.
          </p>
        </details>
        <details class="py-3">
          <summary class="cursor-pointer font-semibold text-slate-900">Когда выдаётся удостоверение?</summary>
          <p class="mt-2 text-slate-700">
            Сразу после успешного тестирования и оформления протокола комиссии. Документы высылаем в электронном
            виде и передаём оригиналы.
          </p>
        </details>
      </div>
    </section>
  </article>
</template>
