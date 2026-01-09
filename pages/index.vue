<script setup>
import { computed } from 'vue';
import { useHead, useI18n } from '#imports';
import HomePage from '~/components/HomePage.vue';

const { t } = useI18n();

const metaTitle = computed(() => t('home.metaTitle'));
const metaDescription = computed(() => t('home.metaDescription'));
const metaKeywords = computed(() => t('home.metaKeywords'));

useHead(() => ({
  title: metaTitle.value,
  meta: [
    { name: 'description', content: metaDescription.value },
    { name: 'keywords', content: metaKeywords.value },
    { property: 'og:title', content: metaTitle.value },
    { property: 'og:description', content: metaDescription.value },
    { name: 'twitter:title', content: metaTitle.value },
    { name: 'twitter:description', content: metaDescription.value },
  ],
}));
</script>

<template>
  <HomePage />
</template>
