<script setup>
import HomePage from '~/components/HomePage.vue';
import { useHead } from '#imports';

useHead({
  title: 'Обучение по охране труда и промышленной безопасности в Казахстане',
  meta: [
    {
      name: 'description',
      content:
        'Охрана труда, промышленная безопасность, ПТМ, электробезопасность, работы на высоте, газоопасные работы, экологическая безопасность. Лицензированный учебный центр.',
    },
  ],
});
</script>

<template>
  <HomePage />
</template>
