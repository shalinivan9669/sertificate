<script setup>
import { computed } from 'vue';
import { useHead, useI18n, useLocalePath, useRoute, useRuntimeConfig } from '#imports';
import { getFormatByType } from '~/config/formats';
import { getCityPrepositional } from '~/composables/useCity';

const props = defineProps({
  type: {
    type: String,
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

const format = computed(() => getFormatByType(props.type));
const { locale, t } = useI18n();
const localePath = useLocalePath();
const route = useRoute();
const runtimeConfig = useRuntimeConfig();

const cityPrepositional = computed(
  () =>
    getCityPrepositional(resolvedCity.value, locale.value) ||
    (locale.value === 'kk' ? 'Қазақстанда' : 'в Казахстане'),
);

const resolveSeoValue = (value, fallback = '') => {
  if (!value) return fallback;
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    return value[locale.value] || value.ru || value.kk || fallback;
  }
  return fallback;
};

const resolveLocalized = (value, fallback = '') => {
  if (!value) return fallback;
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    return value[locale.value] || value.ru || value.kk || fallback;
  }
  return fallback;
};

const resolveList = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === 'object') {
    return value[locale.value] || value.ru || value.kk || [];
  }
  return [];
};

const metaTitle = computed(() => {
  if (!format.value) return '';
  return resolveSeoValue(format.value.seo?.title).replaceAll(
    '{{cityPrepositional}}',
    cityPrepositional.value,
  );
});

const metaDescription = computed(() => {
  if (!format.value) return '';
  return resolveSeoValue(format.value.seo?.description).replaceAll(
    '{{cityPrepositional}}',
    cityPrepositional.value,
  );
});

const baseUrl = computed(() => runtimeConfig.public.siteUrl || 'https://otcenter.kz');
const canonicalUrl = computed(() => new URL(route.path || '/', baseUrl.value).toString());

useHead(() => ({
  title: metaTitle.value,
  meta: [
    { name: 'description', content: metaDescription.value },
    { property: 'og:title', content: metaTitle.value },
    { property: 'og:description', content: metaDescription.value },
    { name: 'twitter:title', content: metaTitle.value },
    { name: 'twitter:description', content: metaDescription.value },
  ],
  script: [
    {
      type: 'application/ld+json',
      children: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: metaTitle.value,
        description: metaDescription.value,
        url: canonicalUrl.value,
      }),
    },
  ],
}));
</script>

<template>
  <article v-if="format" class="space-y-8">
    <header class="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm space-y-3">
      <p class="text-sm font-semibold text-brand-accent uppercase tracking-wide">{{ t('home.formatsBadge') }}</p>
      <h1 class="text-3xl font-bold text-slate-900">{{ metaTitle }}</h1>
      <p class="text-lg text-slate-700">{{ metaDescription }}</p>
    </header>

    <section
      v-for="section in format.sections"
      :key="section.id"
      class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-3"
    >
      <h2 class="text-xl font-semibold text-slate-900">{{ resolveLocalized(section.title) }}</h2>
      <p class="text-slate-700">{{ resolveLocalized(section.subtitle) }}</p>
      <ul class="grid gap-2 text-slate-700 list-disc pl-5">
        <li v-for="item in resolveList(section.bullets)" :key="item">{{ item }}</li>
      </ul>
    </section>

    <section class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm text-center space-y-3">
      <h2 class="text-xl font-semibold text-slate-900">{{ t('formatLanding.ctaTitle') }}</h2>
      <p class="text-slate-700">{{ t('formatLanding.ctaDescription') }}</p>
      <div class="flex justify-center gap-3">
        <NuxtLink :to="localePath('/contacts')" class="inline-flex items-center justify-center px-5 py-3 rounded-lg bg-brand-accent text-white font-semibold hover:bg-emerald-700 transition">{{ t('cta.apply') }}</NuxtLink>
        <a class="inline-flex items-center justify-center px-5 py-3 rounded-lg border border-slate-200 text-brand font-semibold hover:border-brand hover:text-brand transition" href="tel:+77755619871">{{ t('cta.call') }}</a>
      </div>
    </section>
  </article>
  <p v-else>{{ t('formatLanding.empty') }}</p>
</template>
