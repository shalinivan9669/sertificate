<script setup>
import { computed } from 'vue';
import HomePage from '~/components/HomePage.vue';
import useCity from '~/composables/useCity';
import { useHead } from '#imports';

const { city } = useCity();
const resolvedCity = computed(() => city.value || null);

useHead(() => {
  const current = resolvedCity.value;
  const titleCity = current?.nameRuPrepositional || 'в Казахстане';
  return {
    title: `Обучение по охране труда и промышленной безопасности ${titleCity} – учебный центр`,
    meta: [
      {
        name: 'description',
        content: `Охрана труда, промышленная безопасность, ПТМ, электробезопасность ${titleCity}. Онлайн, очно и выездно. Удостоверения гос. образца.`,
      },
    ],
  };
});
</script>

<template>
  <HomePage :city="resolvedCity" />
</template>
