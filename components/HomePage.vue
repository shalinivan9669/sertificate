<script setup>
import { computed } from 'vue';
import { useI18n, useLocalePath } from '#imports';
import { getSortedBlogPosts } from '~/config/blog';
import { cities } from '~/config/cities';
import { getCityName, getCityPrepositional } from '~/composables/useCity';

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
const formatCards = computed(() => asList(tm('home.formatCards')));
const whyItems = computed(() => asList(tm('home.whyItems')));
const licensesItems = computed(() => asList(tm('home.licensesItems')));
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
      <header class="space-y-2">
        <p class="text-sm font-semibold text-brand-accent">{{ t('home.directionsBadge') }}</p>
        <h2 class="text-2xl font-bold text-slate-900">{{ t('home.directionsTitle') }}</h2>
        <p class="text-slate-700">{{ t('home.directionsSubtitle') }}</p>
      </header>
      <div class="grid gap-4 md:grid-cols-3">
        <NuxtLink
          v-for="direction in directions"
          :key="direction.slug"
          :to="withCityPath(direction.slug)"
          class="group rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:-translate-y-0.5 hover:shadow-md transition"
        >
          <h3 class="text-lg font-semibold text-slate-900 group-hover:text-brand">{{ direction.title }}</h3>
          <p class="mt-2 text-sm text-slate-700">{{ direction.description }}</p>
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
      <div class="grid gap-4 sm:grid-cols-3">
        <div
          v-for="item in licensesItems"
          :key="item"
          class="h-28 rounded-xl border border-dashed border-slate-300 bg-white flex items-center justify-center text-slate-500"
        >
          {{ item }}
        </div>
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
        <a class="inline-flex items-center justify-center px-5 py-3 rounded-lg border border-slate-200 text-brand font-semibold hover:border-brand hover:text-brand transition" href="tel:+77470966900">{{ t('cta.call') }}</a>
      </div>
    </section>
  </div>
</template>
