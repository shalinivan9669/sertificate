<script setup>
import { computed } from 'vue';
import { useHead, useI18n } from '#imports';
import HomePageEditorial from '~/components/HomePageEditorial.vue';
import { seoExpansionMetadata } from '~/content/seo-expansion-metadata';

const { t, locale } = useI18n();

const metaTitle = computed(() => locale.value === 'ru' ? seoExpansionMetadata.home.title : t('home.metaTitle'));
const metaDescription = computed(() => locale.value === 'ru' ? seoExpansionMetadata.home.description : t('home.metaDescription'));

useHead(() => ({
  title: metaTitle.value,
  meta: [
    { name: 'description', content: metaDescription.value },
    { property: 'og:title', content: metaTitle.value },
    { property: 'og:description', content: metaDescription.value },
    { name: 'twitter:title', content: metaTitle.value },
    { name: 'twitter:description', content: metaDescription.value },
  ],
}));
</script>

<template>
  <HomePageEditorial />
</template>
