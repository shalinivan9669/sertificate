<script setup>
import { computed } from 'vue';
import { useHead, useI18n, useLocalePath, useRoute, useRuntimeConfig } from '#imports';
import { getCityName, getCityPrepositional } from '~/composables/useCity';
import { resolveCourseDirection } from '~/shared/course-registry';
import { getPublicCourseValue } from '~/shared/public-course-value';
import { getPublicCourseLandingSeo } from '~/shared/public-course-seo';
import { getCourseSearchContent } from '~/shared/course-search-content';
import { leadContextQuery, leadFormats } from '~/shared/lead-context';
import { directionDetails } from '~/content/direction-details';
import { getCourseGuidance } from '~/content/course-guidance';
import { buildCityPageContext } from '~/content/city-page-context';
import { getCityContentBySlug, getCourseContentBySlug, useSeoContent } from '~/composables/useSeoContent';

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
const journeyContext = useLeadJourneyContext(computed(() => ({
  programId: props.course.slug, city: resolvedCity.value?.slug || route.query.city, format: route.query.format,
  ...(route.query.programs !== undefined ? { programs: route.query.programs } : {}),
})));
const { track } = useLmsAnalytics();
const recordContact = () => track('contact_click', { programId: resolveCourseDirection(props.course.slug)?.id, city: resolvedCity.value?.slug });
const consultationRoute = computed(() => ({
  path: localePath('/contacts'),
  query: leadContextQuery(journeyContext.value),
}));
const priceRequestRoute = computed(() => ({ ...consultationRoute.value, query: { ...consultationRoute.value.query, request: 'price' }, hash: '#request-form' }));
onMounted(() => {
  watch(() => [props.course.slug, resolvedCity.value?.slug], () => {
    const direction = resolveCourseDirection(props.course.slug);
    if (direction) track('program_view', { programId: direction.id, city: resolvedCity.value?.slug });
  }, { immediate: true });
});

const localSeoContent = useSeoContent(
  computed(() => getCityContentBySlug(resolvedCity.value?.slug)),
  computed(() => getCourseContentBySlug(props.course.slug)),
);
const cityOrganization = computed(() => localSeoContent.value?.modules.scenarios.items[2]);
const cityContext = computed(() => route.params.city
  ? buildCityPageContext(resolvedCity.value?.slug, 'course', props.course.slug, locale.value)
  : null);

const courseName = computed(() => props.course.name[locale.value] || props.course.name.ru);
const courseValue = computed(() => getPublicCourseValue(props.course.slug));
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

const durationText = computed(() => specialContent.value?.duration || resolveSeoValue(
  props.course.durationLabel,
  `${props.course.durationHours} ${t('course.durationUnit')}`,
));
const durationAnswer = computed(() => resolveSeoValue(props.course.durationAnswer, ''));

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
const directionContent = computed(() => directionDetails[props.course.slug]?.[locale.value === 'kk' ? 'kk' : 'ru']);

const isLaborSafety = computed(() => props.course.slug === 'ohrana-truda');

const canonicalPath = computed(() => route.meta?.canonicalPath || route.path || '/');

const specialContent = computed(() => {
  const copy = getCourseGuidance(props.course.slug, locale.value);
  if (!copy) return null;
  const laborMetadata = isLaborSafety.value
    ? locale.value === 'kk'
      ? { title: 'Еңбекті қорғау бойынша оқыту {{cityPrepositional}} — ОТ және ТБ курстары', heading: 'Еңбекті қорғау бойынша оқыту {{cityPrepositional}}' }
      : { title: 'Обучение по охране труда {{cityPrepositional}} — курсы ОТ и ТБ', heading: 'Обучение по охране труда {{cityPrepositional}}' }
    : null;
  return {
    ...copy,
    ...(laborMetadata ? { title: fillTemplate(laborMetadata.title), heading: fillTemplate(laborMetadata.heading) } : {}),
    sections: copy.sections.map(section => ({
      ...section,
      links: section.links?.map(link => ({ ...link, to: localePath(link.to) })),
    })),
    articles: copy.articles.map(article => ({ ...article, to: localePath(article.to) })),
  };
});
// Local landing pages focus on arranging this group; national pages retain the full guide.
const visibleGuidanceSections = computed(() => cityContext.value
  ? specialContent.value?.sections.filter(section => ['who-needs', 'programme', 'docs'].includes(section.id)) || []
  : specialContent.value?.sections.filter(section => !(locale.value === 'ru' && isLaborSafety.value && !resolvedCity.value && section.id === 'before-enrollment')) || []);
const specialDescription = computed(() => {
  if (props.course.slug === 'promyshlennaya-bezopasnost') {
    return locale.value === 'kk'
      ? `Өнеркәсіптік қауіпсіздік бойынша даярлық ${cityPrepositional.value}: персонал санаты, нысан және жұмыс міндеттеріне сай бағдарлама таңдау. Топ құрамы мен оқу шарттарын келісіңіз.`
      : `Подготовка по промышленной безопасности ${cityPrepositional.value}: подбор программы по категории персонала, объекту и рабочим задачам. Согласуйте состав группы и условия обучения.`;
  }
  if (props.course.slug === 'elektrobezopasnost') {
    return locale.value === 'kk'
      ? `Электр қауіпсіздігі бойынша даярлық ${cityPrepositional.value}: қызметкердің міндеттері, жабдық және қазіргі тобына сай бағдарлама таңдау. Оқу және білімді тексеру шарттарын нақтылаңыз.`
      : `Подготовка по электробезопасности ${cityPrepositional.value}: подбор программы с учётом задач сотрудника, оборудования и действующей группы. Уточните условия обучения и проверки знаний.`;
  }
  if (!isLaborSafety.value) return null;

  if (locale.value === 'kk') {
    return `Еңбекті қорғау және техника қауіпсіздігі бойынша оқыту қызметкерлер мен жауапты тұлғаларға арналған ${cityPrepositional.value}. Формат, бағдарлама, оқудан кейінгі құжаттар және кеңеске өтінім.`;
  }

  return `Обучение по охране труда и технике безопасности для сотрудников и ответственных лиц ${cityPrepositional.value}. Формат, программа, документы после прохождения и заявка на консультацию.`;
});

const cityIntro = computed(() => {
  if (!specialContent.value || !resolvedCity.value) return null;

  if (locale.value === 'kk') {
    return `${cityPrepositional.value} мамандар үшін форматты, кестені және практикалық бөлімді келісеміз. Жазылу алдында қызметкердің міндеттері мен құжаттарды рәсімдеу шарттарын нақтылаймыз.`;
  }

  return `Для специалистов ${cityPrepositional.value} согласуем формат, график и практическую часть. Перед записью уточним задачи работника и условия оформления документов.`;
});

const programSelectionRoute = computed(() => ({
  path: localePath('/program-selection'),
  query: {
    direction: resolveCourseDirection(props.course.slug)?.id,
    ...leadContextQuery({ city: journeyContext.value.city, format: journeyContext.value.format }),
    source: 'course',
  },
}));

const selectedFormat = computed(() => leadFormats.find(item => item.id === route.query.format)?.title[locale.value === 'kk' ? 'kk' : 'ru']);
const programDetailsRoute = computed(() => ({
  path: localePath('/courses/' + (resolveCourseDirection(props.course.slug)?.id || props.course.slug)),
  query: leadContextQuery({ city: journeyContext.value.city, format: journeyContext.value.format }),
}));
const catalogRoute = computed(() => ({ path: localePath('/courses'), query: leadContextQuery(journeyContext.value) }));
const standardSections = computed(() => cityContext.value ? [] : [
  { id: 'included', title: t('course.includesTitle'), items: includesItems.value },
  { id: 'benefits', title: t('course.benefitsTitle'), items: benefitsItems.value },
  { id: 'process', title: t('course.processTitle'), items: processItems.value },
  { id: 'why', title: t('course.whyTitle'), items: whyItems.value },
  { id: 'requirements', title: t('course.requirementsTitle'), items: requirementsItems.value },
]);
const searchContent = computed(() => getCourseSearchContent(props.course.slug, locale.value));
const landingSeo = computed(() => getPublicCourseLandingSeo(props.course.slug, locale.value));
const pageTitle = computed(() => cityContext.value ? metaTitle.value : landingSeo.value?.title || specialContent.value?.title || metaTitle.value);
const pageDescription = computed(() => cityContext.value?.description || landingSeo.value?.description || specialDescription.value || metaDescription.value);
// The former non-special template used the localized SEO title, including its city.
const pageHeading = computed(() => cityContext.value ? metaTitle.value.split(' | ')[0] : searchContent.value?.heading || specialContent.value?.heading || metaTitle.value);
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
    a: index === 1 && durationAnswer.value
      ? durationAnswer.value
      : t(`course.faqItems.${index}.a`, { hours: props.course.durationHours }),
  }));
});
const faqItems = computed(() => {
  return cityContext.value?.faqs || specialContent.value?.faqItems || defaultFaqItems.value;
});

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
  // Direction pages do not establish an approved document or available format.
  ...(!specialContent.value ? {
    educationalCredentialAwarded: locale.value === 'kk' ? 'Куәлік/сертификат' : 'Удостоверение/сертификат',
    courseMode: ['online', 'in-person'],
  } : {}),
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
    { property: 'og:type', content: 'website' },
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
  <article class="ed-public ed-direction">
    <EditorialPageHeader :title="pageHeading" :lead="pageDescription" :back-to="catalogRoute" :back-label="locale === 'kk' ? 'Оқу бағыттары' : 'Направления обучения'">
      <template #context>
        <NuxtLink v-if="resolvedCity?.slug" :to="localePath(`/${resolvedCity.slug}`)">{{ getCityName(resolvedCity, locale) }}</NuxtLink><span v-if="selectedFormat">{{ selectedFormat }}</span>
      </template>
      <div class="ed-public-actions">
        <NuxtLink :to="programSelectionRoute" class="ed-public-button">{{ locale === 'kk' ? 'Бағдарлама таңдау' : 'Подобрать программу' }}</NuxtLink>
        <NuxtLink :to="priceRequestRoute" class="ed-public-button ed-public-button--quiet" @click="recordContact">{{ locale === 'kk' ? 'Бағасын сұрау' : 'Запросить стоимость' }}</NuxtLink>
      </div>
      <dl class="ed-public-facts">
        <div>
          <dt>{{ locale === 'kk' ? 'Жұмысыңызға пайдасы' : 'Ценность для вашей работы' }}</dt>
          <dd class="ed-public-value">{{ courseValue?.purpose[locale === 'kk' ? 'kk' : 'ru'] || courseName }}</dd>
        </div>
        <div><dt>{{ t('course.durationLabel') }}</dt><dd>{{ durationText }}</dd></div>
        <div><dt>{{ t('course.cityLabel') }}</dt><dd>{{ getCityName(resolvedCity, locale) || t('course.anyRegion') }}<small v-if="!specialContent">{{ t('course.mandatoryLabel') }}: {{ course.mandatoryByLaw ? t('course.mandatoryYes') : t('course.mandatoryNo') }}</small><small v-else>{{ locale === 'kk' ? 'Бағдарлама міндеттеріңізге сай таңдалады' : 'Программа подбирается по вашим обязанностям' }}</small></dd></div>
      </dl>
    </EditorialPageHeader>

    <div class="ed-public-body">
      <div class="ed-public-content">
        <p v-if="cityIntro && !cityContext" class="ed-public-note">{{ cityIntro }}</p>
        <CityPageContext v-if="cityContext" :content="cityContext" />
        <section v-else-if="cityOrganization" id="city-organization" class="ed-public-section">
          <h2>{{ cityOrganization.title }}</h2>
          <p>{{ cityOrganization.text }}</p>
        </section>
        <CourseSearchIntent v-if="!cityContext" :direction-id="props.course.slug" :include-articles="!specialContent" :service-block="props.course.slug === 'ohrana-truda' && !resolvedCity ? 'SV01' : undefined" />
        <template v-if="specialContent">
          <section v-for="section in visibleGuidanceSections" :id="section.id" :key="section.id" class="ed-public-section">
            <h2>{{ section.title }}</h2>
            <p v-if="section.text">{{ section.text }}</p>
            <ul v-if="section.bullets" class="ed-public-list"><li v-for="item in section.bullets" :key="item">{{ item }}</li></ul>
            <NuxtLink v-if="section.programLink" :to="programDetailsRoute" class="ed-public-link">{{ locale === 'kk' ? 'Бағдарламаның мазмұны мен оқу шарттары' : 'Содержание программы и условия обучения' }}</NuxtLink>
            <div v-if="section.links" class="ed-public-links">
              <NuxtLink v-for="link in section.links" :key="link.to" :to="link.to">{{ link.label }}</NuxtLink>
            </div>
          </section>
        </template>
        <template v-else>
          <section id="programme" class="ed-public-section">
            <h2>{{ t('course.programTitle') }}</h2>
            <div v-if="courseContentHtml" class="prose max-w-none prose-slate" v-html="courseContentHtml" />
            <div v-else-if="directionContent">
              <p>{{ directionContent.audience }}</p>
              <ul class="ed-public-list"><li v-for="topic in directionContent.topics" :key="topic">{{ topic }}</li></ul>
              <p>{{ directionContent.clarify }}</p>
            </div>
            <p v-else>{{ t('course.programFallback', { courseName, cityPrepositional }) }}</p>
            <NuxtLink :to="programDetailsRoute" class="ed-public-link">{{ locale === 'kk' ? 'Бағдарламаның мазмұны мен оқу шарттары' : 'Содержание программы и условия обучения' }}</NuxtLink>
          </section>
          <section v-for="section in standardSections" :id="section.id" :key="section.id" class="ed-public-section">
            <h2>{{ section.title }}</h2>
            <ul class="ed-public-list"><li v-for="item in section.items" :key="item">{{ item }}</li></ul>
          </section>
        </template>
        <section id="questions" class="ed-public-section ed-public-faq">
          <h2>{{ specialContent?.faqTitle || t('course.faqTitle') }}</h2>
          <details v-for="item in faqItems" :key="item.q"><summary>{{ item.q }}</summary><p>{{ item.a }}</p></details>
        </section>
        <section v-if="specialContent?.articles.length" id="related-guides" class="ed-public-section">
          <h2>{{ locale === 'kk' ? 'Бағдарлама таңдауға көмектесетін материалдар' : 'Материалы для выбора программы' }}</h2>
          <ul class="ed-public-list"><li v-for="article in specialContent.articles" :key="article.to"><NuxtLink :to="article.to" class="ed-public-link">{{ article.label }}</NuxtLink></li></ul>
        </section>
        <section class="ed-public-callout">
          <h2>{{ t('course.signupTitle') }}</h2>
          <p>{{ specialContent?.signupText || t('course.signupText') }}</p>
          <div class="ed-public-actions"><NuxtLink :to="programSelectionRoute" class="ed-public-button">{{ locale === 'kk' ? 'Бағдарлама таңдау' : 'Подобрать программу' }}</NuxtLink><a href="tel:+77766803282" class="ed-public-link" @click="recordContact">{{ t('cta.call') }}</a></div>
        </section>
      </div>
      <nav class="ed-public-toc" :aria-label="locale === 'kk' ? 'Осы бетте' : 'На этой странице'">
        <h2>{{ locale === 'kk' ? 'Осы бетте' : 'На этой странице' }}</h2>
        <template v-if="cityContext"><a v-for="section in cityContext.sections" :key="section.id" :href="`#${section.id}`">{{ section.title }}</a></template>
        <a v-else-if="cityOrganization" href="#city-organization">{{ cityOrganization.title }}</a>
        <a v-if="!cityContext" href="#training-documents">{{ locale === 'kk' ? 'Оқу бағытын таңдау' : 'Как выбрать обучение' }}</a>
        <ul v-if="specialContent"><li v-for="section in visibleGuidanceSections" :key="section.id"><a :href="`#${section.id}`">{{ section.title }}</a></li></ul>
        <ul v-else><li><a href="#programme">{{ t('course.programTitle') }}</a></li><li v-for="section in standardSections" :key="section.id"><a :href="`#${section.id}`">{{ section.title }}</a></li></ul>
        <a href="#questions">{{ t('course.faqTitle') }}</a>
        <a v-if="specialContent?.articles.length" href="#related-guides">{{ locale === 'kk' ? 'Пайдалы материалдар' : 'Полезные материалы' }}</a>
        <NuxtLink :to="programDetailsRoute">{{ locale === 'kk' ? 'Бағдарламаны ашу' : 'Открыть программу' }}</NuxtLink>
      </nav>
    </div>
  </article>
</template>
