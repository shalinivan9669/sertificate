<script setup>
import { computed } from 'vue';
import { useRoute, createError, useHead } from '#imports';
import { courses } from '~/config/courses';
import { getCityBySlug } from '~/composables/useCity';
import CoursePage from '~/components/CoursePage.vue';
import HomePage from '~/components/HomePage.vue';

const route = useRoute();

const courseSlug = computed(() =>
  Array.isArray(route.params.course) ? route.params.course[0] : route.params.course,
);

const course = computed(() => courses.find((item) => item.slug === courseSlug.value) || null);
const cityFromSlug = computed(() => getCityBySlug(courseSlug.value));

if (cityFromSlug.value && !course.value) {
  useHead(() => {
    const titleCity = cityFromSlug.value?.nameRuPrepositional || 'в вашем городе';
    return {
      title: `Обучение по охране труда и безопасности ${titleCity}`,
      meta: [
        {
          name: 'description',
          content: `Охрана труда, промышленная безопасность, ПТМ, электробезопасность ${titleCity}. Онлайн, очно и выездно. Удостоверения гос. образца.`,
        },
      ],
    };
  });
}

if (!course.value && !cityFromSlug.value) {
  throw createError({ statusCode: 404, statusMessage: 'Course not found' });
}
</script>

<template>
  <HomePage v-if="cityFromSlug && !course" :city="cityFromSlug" />
  <CoursePage v-else :course="course" />
</template>
