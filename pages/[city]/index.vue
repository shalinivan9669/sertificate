<script setup>
import { computed } from 'vue';
import { createError, useHead, useRoute } from '#imports';
import SeoUniqueBlocks from '~/components/SeoUniqueBlocks.vue';
import { getCityContentBySlug, useSeoContent } from '~/composables/useSeoContent';

const route = useRoute();
const citySlug = computed(() =>
  Array.isArray(route.params.city) ? route.params.city[0] : route.params.city,
);

const city = computed(() => getCityContentBySlug(citySlug.value));

if (!city.value) {
  throw createError({ statusCode: 404, statusMessage: 'City not found' });
}

const seoContent = useSeoContent(city, null);

useHead(() => ({
  title: seoContent.value?.meta.title,
  meta: [
    { name: 'description', content: seoContent.value?.meta.description },
    { property: 'og:title', content: seoContent.value?.meta.title },
    { property: 'og:description', content: seoContent.value?.meta.description },
  ],
}));
</script>

<template>
  <SeoUniqueBlocks v-if="seoContent" :content="seoContent" />
</template>
