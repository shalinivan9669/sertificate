<script setup>
import { computed } from 'vue';
import { useHead, useI18n, useLocalePath, useRoute, useRuntimeConfig } from '#imports';
import { getCityName, getCityPrepositional } from '~/composables/useCity';
import {
  buildProgramSelectionQuery,
  getSelectionPresetFromCourse,
} from '~/composables/useProgramFlowMock';

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

const isLaborSafety = computed(() => props.course.slug === 'ohrana-truda');

const canonicalPath = computed(() => route.meta?.canonicalPath || route.path || '/');

const specialContent = computed(() => {
  if (!isLaborSafety.value) return null;

  const isKk = locale.value === 'kk';
  const copy = isKk
    ? {
        title: 'Еңбекті қорғау бойынша оқыту {{cityPrepositional}} — ОТ және ТБ курстары',
      description:
          'Еңбекті қорғау және техника қауіпсіздігі бойынша оқыту қызметкерлер мен жауапты тұлғаларға арналған. Формат, бағдарлама, оқудан кейінгі құжаттар және кеңеске өтінім.',
        heading: 'Еңбекті қорғау бойынша оқыту {{cityPrepositional}}',
        faqTitle: 'Жиі қойылатын сұрақтар',
        sections: [
          {
            id: 'who-needs',
            title: 'Кімдерге оқыту қажет',
            bullets: [
              'еңбекті қорғау бойынша міндеті бар басшылар мен мамандарға',
              'нұсқама, рұқсат немесе бақылауға жауапты қызметкерлерге',
              'ішкі талаптарда қарастырылған жағдайда басқа қызметкерлерге',
              'ОТ және ТБ мәселелерін жүйелі жабу керек ұйымдарға',
            ],
          },
          {
            id: 'includes',
            title: 'Оқуға не кіреді',
            bullets: [
              'еңбекті қорғаудың негізгі талаптары',
              'жұмыс орнындағы типтік тәуекелдер',
              'қауіпсіз жұмыс ережелері және оқиға кезіндегі әрекеттер',
              'оқу қорытындысы бойынша білімді тексеру',
              'компания міндетіне сай ұсыныстар',
            ],
          },
          {
            id: 'difference',
            title: 'Еңбекті қорғау мен техника қауіпсіздігі: айырмашылығы',
            text:
              'Еңбекті қорғау - бұл талаптар, рәсімдер және жауапкершілік жүйесі. Техника қауіпсіздігі - нақты жұмыс орнында қауіпсіз жұмыс істеуге көмектесетін практикалық ережелер.',
          },
          {
            id: 'format',
            title: 'Өту форматы',
            text:
              'Қашықтан, күндізгі немесе көшпелі форматты таңдауға болады. Команда мен жұмыс кестесіне сай нұсқаны іріктейміз.',
            links: [
              { label: 'ҚТ және ТБ', to: '/online-obuchenie' },
              { label: 'техника қауіпсіздігі курстары', to: '/ochnoe-obuchenie' },
              { label: 'еңбекті қорғау және техника қауіпсіздігі бойынша оқыту', to: '/vyezdnoe-obuchenie' },
            ],
          },
          {
            id: 'docs',
            title: 'Оқығаннан кейін берілетін құжаттар',
            text:
              'Оқыту аяқталған соң бағдарлама мен таңдалған форматта қарастырылған құжаттар рәсімделеді. Нақты тізімді алдын ала нақтылаған дұрыс.',
          },
          {
            id: 'organizations',
            title: 'Ұйымдар мен жауапты тұлғалар үшін',
            bullets: [
              'топты бөлімге немесе компанияға қарай таңдау',
              'кестені тоқтаусыз келісу',
              'қатысушылар тізімі мен құжаттар бойынша көмек',
              'басталар алдында кеңес беру',
            ],
            links: [
              { label: 'кеңеске өтінім', to: '/contacts' },
              { label: 'лицензиялар', to: '/licenses' },
            ],
          },
        ],
        faqItems: [
          {
            q: 'Еңбекті қорғау бойынша оқуды кімдерден өту керек?',
            a: 'Еңбекті қорғау бойынша міндеті бар басшыларға, мамандарға және жауапты тұлғаларға, сондай-ақ ішкі талаптар немесе бағдарламада қарастырылған қызметкерлерге.',
          },
          {
            q: 'Еңбекті қорғау мен техника қауіпсіздігі несімен ерекшеленеді?',
            a: 'Еңбекті қорғау - қауіпсіздікті ұйымдастыру талаптары мен жүйесі, ал техника қауіпсіздігі - нақты жұмыс орнындағы практикалық ережелер.',
          },
          {
            q: 'Қашықтан оқуға бола ма?',
            a: 'Иә, егер таңдалған формат пен міндет соған мүмкіндік берсе. Кейбір бағдарламалар қашықтан немесе аралас сценарийде өтеді.',
          },
          {
            q: 'Қызметкер қандай құжат алады?',
            a: 'Бұл бағдарлама мен форматқа байланысты. Құжаттар тізімін бастар алдында ұйым міндетіне сай келісіп алған дұрыс.',
          },
          {
            q: 'Ұйымдар үшін қолайлы ма?',
            a: 'Иә, форматты топқа, бөлімге немесе бүкіл компанияға қарай бейімдеуге болады.',
          },
          {
            q: 'Қаншалықты жиі өту керек?',
            a: 'Мерзімділік бағдарламаға және ұйымның ішкі талаптарына байланысты. Жазылмас бұрын ағымдағы кестені нақтылаған дұрыс.',
          },
          {
            q: 'ОТ және ТБ деген не?',
            a: 'Бұл еңбекті қорғау мен техника қауіпсіздігінің қысқартылған атауы.',
          },
        ],
      }
    : {
        title: 'Обучение по охране труда {{cityPrepositional}} — курсы ОТ и ТБ',
      description:
          'Обучение по охране труда и технике безопасности для сотрудников и ответственных лиц. Формат, программа, документы после прохождения и заявка на консультацию.',
        heading: 'Обучение по охране труда {{cityPrepositional}}',
        faqTitle: 'Частые вопросы',
        sections: [
          {
            id: 'who-needs',
            title: 'Кому нужно обучение по охране труда',
            bullets: [
              'руководителям и специалистам, на которых возложены обязанности по охране труда',
              'ответственным за инструктажи, допуск и контроль',
              'сотрудникам, если это предусмотрено внутренними требованиями',
              'организациям, которым нужно системно закрыть вопросы ОТ и ТБ',
            ],
          },
          {
            id: 'includes',
            title: 'Что входит в обучение',
            bullets: [
              'базовые требования и роль охраны труда в организации',
              'типовые риски на рабочем месте',
              'правила безопасной работы и действия при инцидентах',
              'проверка знаний по итогам обучения',
              'рекомендации под задачу компании',
            ],
          },
          {
            id: 'difference',
            title: 'Охрана труда и техника безопасности: в чём разница',
            text:
              'Охрана труда - это система требований, процедур и ответственности. Техника безопасности - практические правила, которые помогают работать безопасно на конкретном месте.',
          },
          {
            id: 'format',
            title: 'Формат прохождения',
            text:
              'Можно выбрать дистанционный, очный или выездной формат. Подберем вариант под команду и рабочий график.',
            links: [
              { label: 'ОТ и ТБ', to: '/online-obuchenie' },
              { label: 'курсы по технике безопасности', to: '/ochnoe-obuchenie' },
              { label: 'обучение по охране труда и технике безопасности', to: '/vyezdnoe-obuchenie' },
            ],
          },
          {
            id: 'docs',
            title: 'Документы после обучения',
            text:
              'После обучения оформляются документы, предусмотренные программой и выбранным форматом. Точный комплект лучше уточнить заранее, чтобы учесть требования организации.',
          },
          {
            id: 'organizations',
            title: 'Для организаций и ответственных лиц',
            bullets: [
              'подбор группы под подразделение или компанию',
              'согласование графика без лишнего простоя',
              'помощь со списком участников и документами',
              'консультация перед стартом',
            ],
            links: [
              { label: 'заявка на консультацию', to: '/contacts' },
              { label: 'лицензии', to: '/licenses' },
            ],
          },
        ],
        faqItems: [
          {
            q: 'Кому нужно проходить обучение по охране труда?',
            a: 'Руководителям, специалистам и ответственным лицам, а также сотрудникам, для которых это предусмотрено внутренними требованиями или программой обучения.',
          },
          {
            q: 'Чем отличается охрана труда от техники безопасности?',
            a: 'Охрана труда описывает систему требований и организацию безопасности, а техника безопасности - конкретные правила безопасной работы на месте.',
          },
          {
            q: 'Можно ли пройти обучение дистанционно?',
            a: 'Да, если выбранный формат и задача это допускают. Для части программ подойдут онлайн- или смешанные сценарии.',
          },
          {
            q: 'Какие документы получает сотрудник после обучения?',
            a: 'Это зависит от программы и формата. Состав комплекта лучше заранее согласовать под задачу организации.',
          },
          {
            q: 'Подходит ли обучение для организаций?',
            a: 'Да, формат можно подбирать под группу, подразделение или всю компанию.',
          },
          {
            q: 'Как часто нужно проходить обучение по охране труда?',
            a: 'Периодичность зависит от программы и внутренних требований организации. Перед записью лучше сверить актуальный график.',
          },
          {
            q: 'Что такое ОТ и ТБ?',
            a: 'Это сокращение для охраны труда и техники безопасности.',
          },
        ],
      };

  return {
    title: fillTemplate(copy.title),
    description: copy.description,
    heading: fillTemplate(copy.heading),
    faqTitle: copy.faqTitle,
    sections: copy.sections.map((section) => ({
      ...section,
      links: section.links
        ? section.links.map((link) => ({
            ...link,
            to: localePath(link.to),
          }))
        : undefined,
    })),
    faqItems: copy.faqItems,
  };
});

const specialDescription = computed(() => {
  if (!specialContent.value) return null;

  if (locale.value === 'kk') {
    return `Еңбекті қорғау және техника қауіпсіздігі бойынша оқыту қызметкерлер мен жауапты тұлғаларға арналған ${cityPrepositional.value}. Формат, бағдарлама, оқудан кейінгі құжаттар және кеңеске өтінім.`;
  }

  return `Обучение по охране труда и технике безопасности для сотрудников и ответственных лиц ${cityPrepositional.value}. Формат, программа, документы после прохождения и заявка на консультацию.`;
});

const cityIntro = computed(() => {
  if (!specialContent.value || !resolvedCity.value) return null;

  if (locale.value === 'kk') {
    return `Бұл бет ${cityPrepositional.value} еңбекті қорғау бойынша оқытуға арналған. Мұнда ОТ және ТБ бойынша негізгі форматтар, мазмұны және жалпы Қазақстан бойынша лендингке сілтеме жиналған.`;
  }

  return `Страница посвящена обучению по охране труда ${cityPrepositional.value}. Здесь собраны основные форматы, частые вопросы по ОТ и ТБ и ссылка на общий лендинг по Казахстану.`;
});

const programSelectionRoute = computed(() => ({
  path: '/program-selection',
  query: buildProgramSelectionQuery(
    getSelectionPresetFromCourse(props.course.slug, resolvedCity.value?.slug || ''),
  ),
}));

const pageTitle = computed(() => specialContent.value?.title || metaTitle.value);
const pageDescription = computed(() => specialDescription.value || metaDescription.value);
const pageHeading = computed(() => specialContent.value?.heading || courseName.value);
const breadcrumbCurrentName = computed(() => specialContent.value?.heading || courseName.value);

const baseUrl = computed(() => runtimeConfig.public.siteUrl || 'https://otcenter.kz');
const canonicalUrl = computed(() => {
  const path = canonicalPath.value;
  const resolvedPath = path.startsWith('http') ? path : localePath(path);
  return new URL(resolvedPath, baseUrl.value).toString();
});

const asList = (value) => (Array.isArray(value) ? value : []);
const includesItems = computed(() => asList(tm('course.includesItems')));
const benefitsItems = computed(() => asList(tm('course.benefitsItems')));
const processItems = computed(() => asList(tm('course.processItems')));
const requirementsItems = computed(() => asList(tm('course.requirementsItems')));
const whyItems = computed(() => asList(tm('course.whyItems')));
const defaultFaqItems = computed(() => {
  const items = asList(tm('course.faqItems'));
  return items.map((item, index) => ({
    q: item.q,
    a: t(`course.faqItems.${index}.a`, { hours: props.course.durationHours }),
  }));
});
const faqItems = computed(() => specialContent.value?.faqItems || defaultFaqItems.value);

const courseSchema = computed(() => ({
  '@context': 'https://schema.org',
  '@type': 'Course',
  name: courseName.value,
  description: pageDescription.value,
  url: canonicalUrl.value,
  provider: {
    '@type': 'EducationalOrganization',
    name:
      runtimeConfig.public.siteName ||
      'OT Center',
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
    name: breadcrumbCurrentName.value,
    item: canonicalUrl.value,
  });

  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items,
  };
});

const faqSchema = computed(() =>
  faqItems.value.length
    ? {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: faqItems.value.map((item) => ({
          '@type': 'Question',
          name: item.q,
          acceptedAnswer: {
            '@type': 'Answer',
            text: item.a,
          },
        })),
      }
    : null,
);

useHead(() => ({
  title: pageTitle.value,
  titleTemplate: isLaborSafety.value ? (title) => title : undefined,
  meta: [
    { name: 'description', content: pageDescription.value },
    { property: 'og:title', content: pageTitle.value },
    { property: 'og:description', content: pageDescription.value },
    { property: 'og:type', content: 'article' },
    { name: 'twitter:title', content: pageTitle.value },
    { name: 'twitter:description', content: pageDescription.value },
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
    ...(faqSchema.value
      ? [
          {
            type: 'application/ld+json',
            children: JSON.stringify(faqSchema.value),
          },
        ]
      : []),
  ],
}));
</script>

<template>
  <article v-if="specialContent" class="space-y-10">
    <nav aria-label="Breadcrumb" class="text-sm text-slate-500">
      <ol class="flex flex-wrap items-center gap-2">
        <li>
          <NuxtLink :to="localePath('/')" class="hover:text-brand">{{ t('nav.home') }}</NuxtLink>
        </li>
        <li class="text-slate-300">/</li>
        <li v-if="resolvedCity?.slug">
          <NuxtLink
            :to="localePath(`/${resolvedCity.slug}`)"
            class="hover:text-brand"
          >
            {{ getCityName(resolvedCity, locale) }}
          </NuxtLink>
        </li>
        <li v-if="resolvedCity?.slug" class="text-slate-300">/</li>
        <li aria-current="page" class="text-slate-700">
          {{ pageHeading }}
        </li>
      </ol>
    </nav>

    <p v-if="resolvedCity?.slug" class="text-sm text-slate-600">
      {{ locale === 'kk' ? 'Жалпы бет:' : 'Общий лендинг:' }}
      <NuxtLink
        :to="localePath('/ohrana-truda')"
        class="font-medium text-brand hover:underline"
      >
        {{ locale === 'kk' ? 'еңбекті қорғау бойынша оқыту' : 'обучение по охране труда' }}
      </NuxtLink>
    </p>

    <section
      v-if="cityIntro"
      class="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-5 text-sm text-slate-700 shadow-sm"
    >
      {{ cityIntro }}
    </section>

    <header class="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm space-y-4">
      <p class="text-sm font-semibold text-brand-accent uppercase tracking-wide">{{ t('course.badge') }}</p>
      <h1 class="text-3xl md:text-4xl font-bold text-slate-900 leading-tight">{{ pageHeading }}</h1>
      <p class="text-lg text-slate-700">
        {{ pageDescription }}
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
      <div class="flex flex-wrap gap-3">
        <NuxtLink
          class="inline-flex items-center justify-center px-5 py-3 rounded-lg bg-brand-accent text-white font-semibold hover:bg-emerald-700 transition"
          :to="programSelectionRoute"
        >
          {{ locale === 'kk' ? 'Бағдарламаны таңдау' : 'Подобрать программу' }}
        </NuxtLink>
        <NuxtLink
          class="inline-flex items-center justify-center px-5 py-3 rounded-lg border border-slate-200 text-brand font-semibold hover:border-brand hover:text-brand transition"
          :to="localePath('/contacts')"
        >
          {{ locale === 'kk' ? 'Кеңеске өтінім' : 'Заявка на консультацию' }}
        </NuxtLink>
        <a
          class="inline-flex items-center justify-center px-5 py-3 rounded-lg border border-slate-200 text-brand font-semibold hover:border-brand hover:text-brand transition"
          href="tel:+77755619871"
        >
          {{ t('cta.call') }}
        </a>
      </div>
    </header>

    <section
      v-for="section in specialContent.sections"
      :key="section.id"
      class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-3"
    >
      <h2 class="text-xl font-semibold text-slate-900">{{ section.title }}</h2>
      <p v-if="section.text" class="text-slate-700">{{ section.text }}</p>
      <ul v-if="section.bullets" class="grid gap-2 text-slate-700 list-disc ml-4">
        <li v-for="item in section.bullets" :key="item">{{ item }}</li>
      </ul>
      <div v-if="section.links" class="flex flex-wrap gap-2 pt-1">
        <NuxtLink
          v-for="link in section.links"
          :key="link.to"
          :to="link.to"
          class="rounded-full border border-slate-200 bg-white px-3 py-1 text-sm text-slate-700 hover:border-brand hover:text-brand transition"
        >
          {{ link.label }}
        </NuxtLink>
      </div>
    </section>

    <section class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-3">
      <h2 class="text-xl font-semibold text-slate-900">{{ specialContent.faqTitle }}</h2>
      <div class="divide-y divide-slate-200">
        <details v-for="item in faqItems" :key="item.q" class="py-3">
          <summary class="cursor-pointer font-semibold text-slate-900">{{ item.q }}</summary>
          <p class="mt-2 text-slate-700">{{ item.a }}</p>
        </details>
      </div>
    </section>
  </article>

  <article v-else class="space-y-10">
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
        <NuxtLink
          class="inline-flex items-center justify-center px-5 py-3 rounded-lg bg-brand-accent text-white font-semibold hover:bg-emerald-700 transition"
          :to="programSelectionRoute"
        >
          Подобрать программу
        </NuxtLink>
        <a class="inline-flex items-center justify-center px-5 py-3 rounded-lg border border-slate-200 text-brand font-semibold hover:border-brand hover:text-brand transition" href="tel:+77755619871">{{ t('cta.call') }}</a>
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
