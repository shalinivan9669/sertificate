<script setup>
import { computed } from 'vue';
import { createError, useHead, useRoute } from '#imports';
import { formats } from '~/config/formats';
import { getCityBySlug } from '~/composables/useCity';
import SeoUniqueBlocks from '~/components/SeoUniqueBlocks.vue';
import FormatLanding from '~/components/FormatLanding.vue';
import { getCityContentBySlug, getCourseContentBySlug, useSeoContent } from '~/composables/useSeoContent';

const route = useRoute();

const citySlug = computed(() =>
  Array.isArray(route.params.city) ? route.params.city[0] : route.params.city,
);
const pageSlug = computed(() =>
  Array.isArray(route.params.slug) ? route.params.slug[0] : route.params.slug,
);

const cityContent = computed(() => getCityContentBySlug(citySlug.value));
const courseContent = computed(() => getCourseContentBySlug(pageSlug.value));
const format = computed(() => formats.find((item) => item.slug === pageSlug.value) || null);
const formatCity = computed(() => getCityBySlug(citySlug.value));

if (!cityContent.value) {
  throw createError({ statusCode: 404, statusMessage: 'City not found' });
}

if (!courseContent.value && !format.value) {
  throw createError({ statusCode: 404, statusMessage: 'Page not found' });
}

const seoContent = useSeoContent(cityContent, courseContent);

useHead(() => {
  if (!seoContent?.value) return {};
  return {
    title: seoContent.value.meta.title,
    meta: [
      { name: 'description', content: seoContent.value.meta.description },
      { property: 'og:title', content: seoContent.value.meta.title },
      { property: 'og:description', content: seoContent.value.meta.description },
    ],
  };
});
</script>

<template>
  <SeoUniqueBlocks v-if="seoContent && courseContent" :content="seoContent" />
  <FormatLanding v-else :type="format.type" :city="formatCity" />
</template>
