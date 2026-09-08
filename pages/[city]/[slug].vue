<script setup>
import { computed } from 'vue';
import { createError, useRoute } from '#imports';
import { resolvePublicCityPage } from '~/config/public-route-runtime';
import CoursePage from '~/components/CoursePage.vue';
import FormatLanding from '~/components/FormatLanding.vue';

const route = useRoute();

const citySlug = computed(() =>
  Array.isArray(route.params.city) ? route.params.city[0] : route.params.city,
);
const pageSlug = computed(() =>
  Array.isArray(route.params.slug) ? route.params.slug[0] : route.params.slug,
);

const resolved = computed(() => resolvePublicCityPage(citySlug.value, pageSlug.value));
if (!resolved.value) {
  throw createError({ statusCode: 404, statusMessage: 'Page not found' });
}
</script>

<template>
  <CoursePage v-if="resolved?.kind === 'course'" :course="resolved.course" :city="resolved.city" />
  <FormatLanding v-else-if="resolved?.kind === 'format'" :type="resolved.format.type" :city="resolved.city" />
</template>
