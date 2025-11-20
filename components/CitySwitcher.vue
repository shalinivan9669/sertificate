<script setup>
import { computed } from 'vue';
import { useRoute, useRouter } from '#imports';
import { cities } from '~/config/cities';

const route = useRoute();
const router = useRouter();

const currentCity = computed(() =>
  Array.isArray(route.params.city) ? route.params.city[0] : route.params.city,
);

const changeCity = (event) => {
  const slug = event.target.value;
  const segments = route.path.split('/').filter(Boolean);

  if (currentCity.value) {
    segments[0] = slug;
    router.push('/' + segments.join('/'));
    return;
  }

  // Для страниц без города отправляем на главную выбранного города.
  router.push(`/${slug}`);
};
</script>

<template>
  <div class="city-switcher">
    <label class="city-switcher__label" for="city-select">Город</label>
    <select id="city-select" class="city-switcher__select" :value="currentCity" @change="changeCity">
      <option value="" disabled>Выберите город</option>
      <option
        v-for="city in cities"
        :key="city.slug"
        :value="city.slug"
      >
        {{ city.nameRu }}
      </option>
    </select>
  </div>
</template>
