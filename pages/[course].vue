<script setup>
import { computed } from 'vue';
import { useRoute, createError, useHead, useI18n } from '#imports';
import { courses } from '~/config/courses';
import { getCityBySlug, getCityPrepositional } from '~/composables/useCity';
import CoursePage from '~/components/CoursePage.vue';
import HomePage from '~/components/HomePage.vue';

const route = useRoute();
const { locale } = useI18n();

const courseSlug = computed(() =>
  Array.isArray(route.params.course) ? route.params.course[0] : route.params.course,
);

const course = computed(() => courses.find((item) => item.slug === courseSlug.value) || null);
const cityFromSlug = computed(() => getCityBySlug(courseSlug.value));

if (cityFromSlug.value && !course.value) {
  useHead(() => {
    const titleCity =
      getCityPrepositional(cityFromSlug.value, locale.value) ||
      (locale.value === 'kk' ? 'Қазақстанда' : 'в Казахстане');

    const title =
      locale.value === 'kk'
        ? `Еңбекті қорғау және еңбек қауіпсіздігі оқыту ${titleCity}`
        : `Обучение по охране труда и ТБ ${titleCity} — удостоверение`;

    const description =
      locale.value === 'kk'
        ? `Еңбекті қорғау оқыту, техникалық қауіпсіздік, БИОТ және өнеркәсіптік қауіпсіздік оқыту ${titleCity}. Онлайн/қашықтан, куәлік/сертификат, аттестация, білімді тексеру.`
        : `Обучение по охране труда, технике безопасности, БИОТ и промышленной безопасности ${titleCity}. Онлайн/дистанционно, без отрыва от работы. Удостоверение, сертификат, аттестация, проверка знаний.`;

    return {
      title,
      meta: [
        { name: 'description', content: description },
        { property: 'og:title', content: title },
        { property: 'og:description', content: description },
        { name: 'twitter:title', content: title },
        { name: 'twitter:description', content: description },
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
