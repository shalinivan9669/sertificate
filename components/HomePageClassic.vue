<script setup>
import { computed, ref } from 'vue';
import { useI18n, useLocalePath } from '#imports';
import { getSortedBlogPosts } from '~/config/blog';
import { cities } from '~/config/cities';
import { licenseDownloadFiles } from '~/config/licenses-files';
import { getCityName, getCityPrepositional } from '~/composables/useCity';
import { additionalSourceDirections, sourceProductCardSummaries } from '~/shared/source-products';
import { getPublicCoursePricing } from '~/shared/public-course-pricing';

const props = defineProps({
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
const cityPrepositional = computed(() =>
  resolvedCity.value ? getCityPrepositional(resolvedCity.value, locale.value) : null,
);

const asList = (value) => (Array.isArray(value) ? value : []);
const directions = computed(() => asList(tm('home.directions')));
const courseGroup = ref('all');
const courseLanguage = computed(() => locale.value === 'kk' ? 'kk' : 'ru');
const courseCopy = computed(() => locale.value === 'kk' ? {
  title: 'Курстар мен бағалар', subtitle: 'Қызметкерлер мен ұйымдарға арналған 20 бағыт. Қажетті курсты таңдап, оқыту шарттарымен танысыңыз.',
  all: 'Барлық бағыттар', added: 'Жаңа бағыттар', existing: 'Негізгі бағыттар', badge: 'Жаңа',
  catalog: 'Толық каталог', details: 'Толығырақ', conditions: 'Мазмұны мен шарттары', filters: 'Курс бағыттарын таңдау',
} : {
  title: 'Курсы и цены', subtitle: '20 направлений для сотрудников и организаций. Выберите курс и посмотрите условия обучения.',
  all: 'Все направления', added: 'Новые направления', existing: 'Основные направления', badge: 'Новое',
  catalog: 'Полный каталог', details: 'Подробнее', conditions: 'Содержание и условия', filters: 'Выбор направлений обучения',
});
const homeCourses = computed(() => [
  ...additionalSourceDirections.map(direction => ({
    slug: direction.id, title: direction.title[courseLanguage.value],
    description: sourceProductCardSummaries[direction.id]?.[courseLanguage.value] || '', isNew: true,
    pricing: getPublicCoursePricing(direction.id),
  })),
  ...directions.value.map(direction => ({ ...direction, isNew: false, pricing: getPublicCoursePricing(direction.slug) })),
]);
const visibleCourses = computed(() => homeCourses.value.filter(course =>
  courseGroup.value === 'all' || (courseGroup.value === 'new' ? course.isNew : !course.isNew),
));
const courseFilters = computed(() => [
  { id: 'all', label: courseCopy.value.all, count: homeCourses.value.length },
  { id: 'new', label: courseCopy.value.added, count: additionalSourceDirections.length },
  { id: 'existing', label: courseCopy.value.existing, count: directions.value.length },
]);
const catalogRoute = (slug = '') => localePath({
  path: '/courses' + (slug ? '/' + slug : ''),
  query: resolvedCity.value?.slug ? { city: resolvedCity.value.slug } : {},
});
const formatCards = computed(() => asList(tm('home.formatCards')));
const whyItems = computed(() => asList(tm('home.whyItems')));
const licensesItems = computed(() => asList(tm('home.licensesItems')));
const licensesCards = computed(() =>
  licensesItems.value.map((label, index) => {
    const source = licenseDownloadFiles[index] || null;
    const file =
      typeof source === 'string' ? source : source && typeof source === 'object' ? source.file : null;
    const fileName =
      typeof file === 'string' && file.trim().length > 0 ? file.split('/').pop() : null;
    const preview =
      source && typeof source === 'object' && typeof source.preview === 'string'
        ? source.preview
        : null;
    const previewAlt =
      source && typeof source === 'object' && typeof source.previewAlt === 'string'
        ? source.previewAlt
        : label;

    return {
      label,
      file,
      fileName,
      preview,
      previewAlt,
      hasFile: Boolean(fileName),
    };
  }),
);
const testimonialsItems = computed(() => asList(tm('home.testimonialsItems')));
const seoFormats = computed(() => asList(tm('home.seoFormats')));
const seoRoles = computed(() => asList(tm('home.seoRoles')));
const seoSynonyms = computed(() => asList(tm('home.seoSynonyms')));

const heroTitle = computed(() =>
  cityPrepositional.value
    ? t('home.heroTitleCity', { city: cityPrepositional.value })
    : t('home.heroTitleDefault'),
);

const withCityPath = (slug) => {
  const base = resolvedCity.value?.slug ? `/${resolvedCity.value.slug}/${slug}` : `/${slug}`;
  return localePath(base);
};

const localizePost = (post) => ({
  ...post,
  title: post.title?.[locale.value] || post.title?.ru || post.title,
  description: post.description?.[locale.value] || post.description?.ru || post.description,
});

const blogArticles = computed(() => getSortedBlogPosts().map(localizePost).slice(0, 4));
</script>

<template>
  <div class="space-y-16">
    <section class="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 md:p-10">
      <div class="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div class="space-y-4 max-w-3xl">
          <p class="text-sm uppercase tracking-wide text-brand-accent font-semibold">
            {{ t('home.heroBadge') }}
          </p>
          <h1 class="text-3xl md:text-4xl font-bold text-slate-900 leading-tight">
            {{ heroTitle }}
          </h1>
          <p class="text-lg text-slate-700">
            {{ t('home.heroDescription') }}
          </p>
          <div class="flex flex-wrap gap-3">
            <a class="inline-flex items-center justify-center px-5 py-3 rounded-lg bg-brand-accent text-white font-semibold hover:bg-emerald-700 transition" href="#contact">{{ t('cta.apply') }}</a>
            <a class="inline-flex items-center justify-center px-5 py-3 rounded-lg border border-slate-200 text-brand font-semibold hover:border-brand hover:text-brand transition" href="#courses">{{ t('cta.viewCourses') }}</a>
          </div>
        </div>
        <div class="hidden md:block w-64 h-40 rounded-xl bg-gradient-to-br from-brand-soft to-white border border-slate-200" />
      </div>
    </section>

    <section id="courses" class="space-y-6">
      <header class="flex flex-wrap items-end justify-between gap-4">
        <div class="space-y-2">
          <p class="text-sm font-semibold text-brand-accent">{{ t('home.directionsBadge') }}</p>
          <h2 class="text-2xl font-bold text-slate-900">{{ courseCopy.title }}</h2>
          <p class="text-slate-700">{{ courseCopy.subtitle }}</p>
        </div>
        <NuxtLink :to="catalogRoute()" class="font-semibold text-brand-accent underline underline-offset-4">{{ courseCopy.catalog }} →</NuxtLink>
      </header>
      <div class="flex flex-wrap gap-2" role="group" :aria-label="courseCopy.filters">
        <button
          v-for="filter in courseFilters" :key="filter.id" type="button"
          :aria-pressed="courseGroup === filter.id"
          class="rounded-lg border px-4 py-2 text-sm font-semibold transition"
          :class="courseGroup === filter.id ? 'border-brand-accent bg-brand-accent text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-brand-accent'"
          @click="courseGroup = filter.id"
        >{{ filter.label }} <span class="ml-1">{{ filter.count }}</span></button>
      </div>
      <div class="grid gap-4 md:grid-cols-3">
        <NuxtLink
          v-for="direction in visibleCourses"
          :key="direction.slug"
          :to="direction.isNew ? catalogRoute(direction.slug) : withCityPath(direction.slug)"
          class="group flex flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:-translate-y-0.5 hover:shadow-md transition"
        >
          <span v-if="direction.isNew" class="mb-3 self-start rounded-full bg-brand-soft px-2.5 py-1 text-xs font-semibold text-brand">{{ courseCopy.badge }}</span>
          <h3 class="text-lg font-semibold text-slate-900 group-hover:text-brand">{{ direction.title }}</h3>
          <p class="mb-4 mt-2 flex-1 text-sm text-slate-700">{{ direction.description }}</p>
          <div class="border-t border-slate-100 pt-4">
            <p class="text-lg font-bold text-brand">{{ direction.pricing.label[courseLanguage] }}</p>
            <p v-if="direction.pricing.basis" class="mt-1 text-sm text-slate-600">
              {{ direction.pricing.basisLabel[courseLanguage] }}<span v-if="direction.pricing.taxLabel[courseLanguage]"> · {{ direction.pricing.taxLabel[courseLanguage] }}</span>
            </p>
            <p class="mt-3 text-sm font-semibold text-brand-accent">{{ direction.isNew ? courseCopy.conditions : courseCopy.details }} →</p>
          </div>
        </NuxtLink>
      </div>
    </section>

    <section id="formats" class="space-y-6">
      <header class="space-y-2">
        <p class="text-sm font-semibold text-brand-accent">{{ t('home.formatsBadge') }}</p>
        <h2 class="text-2xl font-bold text-slate-900">{{ t('home.formatsTitle') }}</h2>
        <p class="text-slate-700">{{ t('home.formatsSubtitle') }}</p>
      </header>
      <div class="grid gap-4 md:grid-cols-3">
        <NuxtLink
          v-for="format in formatCards"
          :key="format.slug"
          :to="withCityPath(format.slug)"
          class="group rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:-translate-y-0.5 hover:shadow-md transition"
        >
          <h3 class="text-lg font-semibold text-slate-900 group-hover:text-brand">{{ format.title }}</h3>
          <p class="mt-2 text-sm text-slate-700">{{ format.description }}</p>
        </NuxtLink>
      </div>
    </section>

    <section class="space-y-4">
      <header class="space-y-2">
        <p class="text-sm font-semibold text-brand-accent">{{ t('home.whyBadge') }}</p>
        <h2 class="text-2xl font-bold text-slate-900">{{ t('home.whyTitle') }}</h2>
      </header>
      <div class="grid gap-3 md:grid-cols-2">
        <div
          v-for="item in whyItems"
          :key="item"
          class="rounded-lg border border-slate-200 bg-white p-4 text-slate-700"
        >
          {{ item }}
        </div>
      </div>
    </section>

    <section class="space-y-4">
      <header class="space-y-2">
        <p class="text-sm font-semibold text-brand-accent">{{ t('home.licensesBadge') }}</p>
        <h2 class="text-2xl font-bold text-slate-900">{{ t('home.licensesTitle') }}</h2>
        <p class="text-slate-700">{{ t('home.licensesSubtitle') }}</p>
      </header>
      <div
        class="grid gap-4"
        :class="licensesCards.length === 1 ? 'sm:grid-cols-1 max-w-2xl mx-auto' : 'sm:grid-cols-3'"
      >
        <component
          :is="item.hasFile ? 'a' : 'div'"
          v-for="item in licensesCards"
          :key="item.label"
          :href="item.hasFile ? item.file : undefined"
          :download="item.hasFile ? item.fileName : undefined"
          :aria-disabled="!item.hasFile"
          class="h-280 rounded-xl border border-dashed border-slate-300 bg-white flex flex-col items-center justify-center text-slate-500 transition"
          :class="item.hasFile ? 'hover:border-brand hover:text-brand cursor-pointer' : 'cursor-default'"
        >
          <img
            v-if="item.preview"
            :src="item.preview"
            :alt="item.previewAlt"
            class="mb-2 h-244 w-auto max-w-full rounded object-contain"
            loading="lazy"
          >
          <span>{{ item.label }}</span>
          <span v-if="item.hasFile" class="mt-1 text-xs text-slate-400">
            {{ item.fileName }}
          </span>
        </component>
      </div>
    </section>

    <section class="space-y-4">
      <header class="space-y-2">
        <p class="text-sm font-semibold text-brand-accent">{{ t('home.testimonialsBadge') }}</p>
        <h2 class="text-2xl font-bold text-slate-900">{{ t('home.testimonialsTitle') }}</h2>
      </header>
      <div class="grid gap-4 md:grid-cols-2">
        <div
          v-for="item in testimonialsItems"
          :key="item.title"
          class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
        >
          <h3 class="font-semibold text-slate-900">{{ item.title }}</h3>
          <p class="mt-2 text-slate-700">{{ item.description }}</p>
        </div>
      </div>
    </section>

    <section class="space-y-4">
      <header class="space-y-2">
        <p class="text-sm font-semibold text-brand-accent">{{ t('home.blogBadge') }}</p>
        <h2 class="text-2xl font-bold text-slate-900">{{ t('home.blogTitle') }}</h2>
        <p class="text-slate-700">{{ t('home.blogSubtitle') }}</p>
      </header>
      <div class="grid gap-4 md:grid-cols-2">
        <article
          v-for="post in blogArticles || []"
          :key="post._path"
          class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
        >
          <header class="flex items-center justify-between">
            <h3 class="text-lg font-semibold text-slate-900">
              <NuxtLink :to="localePath(post._path)" class="hover:text-brand">{{ post.title }}</NuxtLink>
            </h3>
            <time :datetime="post.date" class="text-xs text-slate-500">{{ post.date }}</time>
          </header>
          <p class="mt-2 text-sm text-slate-700">{{ post.description }}</p>
        </article>
        <p v-if="!blogArticles || blogArticles.length === 0" class="text-slate-600 col-span-full">
          {{ t('home.blogEmpty') }}
        </p>
      </div>
    </section>

    <section class="space-y-6" id="seo">
      <header class="space-y-2">
        <h2 class="text-2xl font-bold text-slate-900">{{ t('home.seoTitle') }}</h2>
        <p class="text-slate-700">{{ t('home.seoDescription') }}</p>
      </header>
      <div class="grid gap-4 md:grid-cols-2">
        <div class="rounded-lg border border-slate-200 bg-white p-4 text-slate-700">
          <h3 class="font-semibold text-slate-900">{{ t('home.seoFormatsTitle') }}</h3>
          <ul class="mt-2 grid gap-2 list-disc ml-4">
            <li v-for="item in seoFormats" :key="item">{{ item }}</li>
          </ul>
        </div>
        <div class="rounded-lg border border-slate-200 bg-white p-4 text-slate-700">
          <h3 class="font-semibold text-slate-900">{{ t('home.seoRolesTitle') }}</h3>
          <ul class="mt-2 grid gap-2 list-disc ml-4">
            <li v-for="item in seoRoles" :key="item">{{ item }}</li>
          </ul>
        </div>
        <div class="rounded-lg border border-slate-200 bg-white p-4 text-slate-700 md:col-span-2">
          <h3 class="font-semibold text-slate-900">{{ t('home.seoSynonymsTitle') }}</h3>
          <ul class="mt-2 grid gap-2 list-disc ml-4">
            <li v-for="item in seoSynonyms" :key="item">{{ item }}</li>
          </ul>
        </div>
      </div>
    </section>

    <section class="space-y-4" id="cities">
      <header class="space-y-2">
        <p class="text-sm font-semibold text-brand-accent">{{ t('nav.cities') }}</p>
        <h2 class="text-2xl font-bold text-slate-900">{{ t('home.seoGeoTitle') }}</h2>
        <p class="text-slate-700">{{ t('home.seoGeoDescription') }}</p>
      </header>
      <div class="flex flex-wrap gap-2">
        <NuxtLink
          v-for="city in cities"
          :key="city.slug"
          :to="localePath(`/${city.slug}`)"
          class="rounded-full border border-slate-200 bg-white px-3 py-1 text-sm text-slate-700 hover:border-brand hover:text-brand transition"
        >
          {{ getCityName(city, locale) }}
        </NuxtLink>
      </div>
    </section>

    <section id="contact" class="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center space-y-3">
      <p class="text-sm font-semibold text-brand-accent">{{ t('home.contactBadge') }}</p>
      <h2 class="text-2xl font-bold text-slate-900">{{ t('home.contactTitle') }}</h2>
      <p class="text-slate-700">{{ t('home.contactDescription') }}</p>
      <div class="flex justify-center gap-3">
        <NuxtLink :to="localePath('/contacts')" class="inline-flex items-center justify-center px-5 py-3 rounded-lg bg-brand-accent text-white font-semibold hover:bg-emerald-700 transition">{{ t('cta.apply') }}</NuxtLink>
        <a class="inline-flex items-center justify-center px-5 py-3 rounded-lg border border-slate-200 text-brand font-semibold hover:border-brand hover:text-brand transition" href="tel:+77755619871">{{ t('cta.call') }}</a>
      </div>
    </section>
  </div>
</template>
