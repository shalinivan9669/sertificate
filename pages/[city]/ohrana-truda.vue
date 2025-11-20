<script setup>
import { computed } from 'vue';
import CoursePage from '~/components/CoursePage.vue';
import { courses } from '~/config/courses';
import useCity from '~/composables/useCity';

const { city } = useCity();
const course = computed(() => courses.find((item) => item.slug === 'ohrana-truda'));
</script>

<template>
  <CoursePage v-if="course" :course="course" :city="city" />
  <p v-else>Курс не найден.</p>
</template>
