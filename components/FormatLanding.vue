<script setup>
import { computed } from 'vue';
import { useHead, useI18n, useLocalePath, useRoute, useRuntimeConfig } from '#imports';
import { leadContextQuery } from '~/shared/lead-context';
import { getFormatByType } from '~/config/formats';
import { getCityBySlug, getCityPrepositional } from '~/composables/useCity';

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
  (props.city && 'value' in props.city ? props.city.value : props.city) || getCityBySlug(route.query.city),
);

const format = computed(() => getFormatByType(props.type));
const { locale, t } = useI18n();
const heading = computed(() => ({
  online: { ru: 'Онлайн-обучение', kk: 'Онлайн оқу' },
  ochnoe: { ru: 'Обучение в учебном центре', kk: 'Оқу орталығында оқу' },
  vyezdnoe: { ru: 'Обучение на вашей площадке', kk: 'Ұйымыңыздың аумағында оқу' },
  srochnoe: { ru: 'Обучение в ближайшие сроки', kk: 'Жақын мерзімде оқу' },
  tender: { ru: 'Обучение для участия в тендере', kk: 'Тендерге қатысуға арналған оқу' },
}[props.type]?.[locale.value === 'kk' ? 'kk' : 'ru'] || metaTitle.value.split(' | ')[0]));
const route = useRoute();
const runtimeConfig = useRuntimeConfig();
const localePath = useLocalePath();

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

const programSelectionRoute = computed(() => ({
  path: localePath('/program-selection'),
  query: {
    source: 'format',
    slug: format.value?.slug || '',
    ...leadContextQuery({
      format: { online: 'online', ochnoe: 'classroom', vyezdnoe: 'onsite' }[props.type] || route.query.format,
      city: resolvedCity.value?.slug || route.query.city,
    }),
  },
}));

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
  <article v-if="format" class="ed-public ed-format-page">
    <EditorialPageHeader :title="resolvedCity ? metaTitle : heading" :lead="metaDescription" :back-to="{ path: localePath('/courses'), query: leadContextQuery(programSelectionRoute.query) }" :back-label="locale === 'kk' ? 'Оқу бағыттары' : 'Направления обучения'">
      <template #context><span>{{ cityPrepositional }}</span></template>
      <div class="ed-public-actions"><NuxtLink :to="programSelectionRoute" class="ed-public-button">{{ locale === 'kk' ? 'Бағдарлама таңдау' : 'Подобрать программу' }}</NuxtLink><a href="#format-details" class="ed-public-link">{{ locale === 'kk' ? 'Формат туралы' : 'Об этом формате' }}</a></div>
    </EditorialPageHeader>
    <div id="format-details" class="ed-public-strips">
      <section v-for="section in format.sections" :id="section.id" :key="section.id">
        <h2>{{ resolveLocalized(section.title) }}</h2>
        <div><p>{{ resolveLocalized(section.subtitle) }}</p><ul class="ed-public-list"><li v-for="item in resolveList(section.bullets)" :key="item">{{ item }}</li></ul></div>
      </section>
    </div>
    <section class="ed-public-callout">
      <h2>{{ t('formatLanding.ctaTitle') }}</h2><p>{{ t('formatLanding.ctaDescription') }}</p>
      <div class="ed-public-actions"><NuxtLink :to="programSelectionRoute" class="ed-public-button">{{ locale === 'kk' ? 'Бағдарлама таңдау' : 'Подобрать программу' }}</NuxtLink><a class="ed-public-link" href="tel:+77766803282">{{ t('cta.call') }}</a></div>
    </section>
  </article>
  <p v-else>{{ t('formatLanding.empty') }}</p>
</template>
