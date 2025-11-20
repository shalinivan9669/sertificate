<script setup>
import HomePage from '~/components/HomePage.vue';
import { useHead } from '#imports';

useHead({
  title: 'Обучение по охране труда и промышленной безопасности в Казахстане – лицензированный учебный центр',
  meta: [
    {
      name: 'description',
      content:
        'Охрана труда, промышленная безопасность, ПТМ, электробезопасность, работы на высоте, ГПМ, газоопасные работы, экология и первая помощь по всей РК.',
    },
  ],
});
</script>

<template>
  <HomePage />
</template>
