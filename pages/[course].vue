<script setup>
import { computed } from 'vue';
import { createError, useHead, useRoute } from '#imports';
import { courses } from '~/config/courses';
import SeoUniqueBlocks from '~/components/SeoUniqueBlocks.vue';
import CoursePage from '~/components/CoursePage.vue';
import { getCityContentBySlug, useSeoContent } from '~/composables/useSeoContent';

const route = useRoute();
const courseSlug = computed(() =>
  Array.isArray(route.params.course) ? route.params.course[0] : route.params.course,
);

const course = computed(() => courses.find((item) => item.slug === courseSlug.value) || null);
const cityContent = computed(() => getCityContentBySlug(courseSlug.value));
const seoContent = useSeoContent(cityContent, null);

if (!course.value && !cityContent.value) {
  throw createError({ statusCode: 404, statusMessage: 'Course not found' });
}

useHead(() => {
  if (!seoContent.value) return {};
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
  <SeoUniqueBlocks
    v-if="seoContent && !course"
    :content="seoContent"
    :cta-query="{ source: 'seo-city', slug: courseSlug }"
  />
  <CoursePage v-else :course="course" />
</template>
