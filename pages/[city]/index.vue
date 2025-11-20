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
    title: `Обучение по охране труда и промышленной безопасности ${titleCity} – лицензированный учебный центр`,
    meta: [
      {
        name: 'description',
        content: `Обучение по охране труда, промышленной безопасности, ПТМ, электробезопасности ${titleCity}. Лицензия, удостоверения гос. образца, очно/онлайн/выездно.`,
      },
    ],
  };
});
</script>

<template>
  <HomePage :city="resolvedCity" />
</template>
