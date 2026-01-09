<script setup>
import { computed } from 'vue';
import { useRoute, useRouter, useLocalePath, useI18n } from '#imports';
import { cities } from '~/config/cities';
import { getCityBySlug, getCityName } from '~/composables/useCity';

const route = useRoute();
const router = useRouter();
const localePath = useLocalePath();
const { locale, t } = useI18n();

const currentCity = computed(() => {
  const param = Array.isArray(route.params.city) ? route.params.city[0] : route.params.city;
  if (param) return param;
  const courseParam = Array.isArray(route.params.course) ? route.params.course[0] : route.params.course;
  return getCityBySlug(courseParam)?.slug || null;
});

const stripLocalePrefix = (path) => {
  const prefix = `/${locale.value}`;
  if (path === prefix) return '/';
  if (path.startsWith(prefix + '/')) {
    return path.slice(prefix.length);
  }
  return path;
};

const changeCity = (event) => {
  const slug = event.target.value;
  const normalizedPath = stripLocalePrefix(route.path);
  const segments = normalizedPath.split('/').filter(Boolean);

  if (currentCity.value) {
    segments[0] = slug;
    router.push(localePath('/' + segments.join('/')));
    return;
  }

  // Если страница без города, отправляем на главную выбранного города.
  router.push(localePath(`/${slug}`));
};
</script>

<template>
  <div class="flex items-center gap-2">
    <label class="text-sm text-slate-600" for="city-select">{{ t('citySwitcher.label') }}</label>
    <select
      id="city-select"
      class="rounded border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent"
      :value="currentCity || ''"
      @change="changeCity"
    >
      <option value="" disabled>{{ t('citySwitcher.placeholder') }}</option>
      <option
        v-for="city in cities"
        :key="city.slug"
        :value="city.slug"
      >
        {{ getCityName(city, locale) }}
      </option>
    </select>
  </div>
</template>
