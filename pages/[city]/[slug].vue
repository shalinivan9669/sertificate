<script setup>
import { computed } from 'vue';
import { useRoute, createError } from '#imports';
import { courses } from '~/config/courses';
import { formats } from '~/config/formats';
import { getCityBySlug } from '~/composables/useCity';
import CoursePage from '~/components/CoursePage.vue';
import FormatLanding from '~/components/FormatLanding.vue';

const route = useRoute();

const citySlug = computed(() =>
  Array.isArray(route.params.city) ? route.params.city[0] : route.params.city,
);
const pageSlug = computed(() =>
  Array.isArray(route.params.slug) ? route.params.slug[0] : route.params.slug,
);

const city = computed(() => getCityBySlug(citySlug.value));
const course = computed(() => courses.find((item) => item.slug === pageSlug.value) || null);
const format = computed(() => formats.find((item) => item.slug === pageSlug.value) || null);

if (!city.value) {
  throw createError({ statusCode: 404, statusMessage: 'City not found' });
}

if (!course.value && !format.value) {
  throw createError({ statusCode: 404, statusMessage: 'Page not found' });
}
</script>

<template>
  <CoursePage v-if="course" :course="course" :city="city" />
  <FormatLanding v-else :type="format.type" :city="city" />
</template>
