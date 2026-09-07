<script setup>
import { computed } from 'vue';
import useCity from '~/composables/useCity';
import { courses } from '~/config/courses';
import CoursePage from '~/components/CoursePage.vue';
import ComplianceCourseNotice from '~/components/ComplianceCourseNotice.vue';
import { useRoute, createError } from '#imports';

const route = useRoute();
const { city } = useCity();

const courseSlug = computed(() =>
  Array.isArray(route.params.course) ? route.params.course[0] : route.params.course,
);

const course = computed(() => courses.find((item) => item.slug === courseSlug.value) || null);

if (!course.value) {
  throw createError({ statusCode: 404, statusMessage: 'Course not found' });
}
</script>

<template>
  <div>
    <ComplianceCourseNotice :course="course" />
    <CoursePage :course="course" :city="city" />
  </div>
</template>
