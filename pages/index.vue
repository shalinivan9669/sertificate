<script setup>
import { computed } from 'vue';
import { useHead, useI18n } from '#imports';
import HomePageEditorial from '~/components/HomePageEditorial.vue';

const { t } = useI18n();

const metaTitle = computed(() => t('home.metaTitle'));
const metaDescription = computed(() => t('home.metaDescription'));

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
