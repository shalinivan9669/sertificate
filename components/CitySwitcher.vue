<script setup>
import { computed } from 'vue';
import { useRoute, useRouter, useLocalePath, useI18n } from '#imports';
import { cities } from '~/config/cities';
import { getCityBySlug, getCityName } from '~/composables/useCity';

const route = useRoute();
const router = useRouter();
const localePath = useLocalePath();
const { locale, t } = useI18n();
const { selection, set } = useLmsSelection();
const selectId = useId();

const currentCity = computed(() => {
  const param = Array.isArray(route.params.city) ? route.params.city[0] : route.params.city;
  if (param) return param;
  const courseParam = Array.isArray(route.params.course) ? route.params.course[0] : route.params.course;
  return getCityBySlug(courseParam)?.slug || getCityBySlug(route.query.city)?.slug || getCityBySlug(selection.value.city)?.slug || null;
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
  if (!getCityBySlug(slug)) return;
  set('city', slug);
  const normalizedPath = stripLocalePrefix(route.path);
  const segments = normalizedPath.split('/').filter(Boolean);

  if (getCityBySlug(segments[0])) {
    segments[0] = slug;
    router.push({ path: localePath('/' + segments.join('/')), query: { ...route.query, city: slug }, hash: route.hash });
    return;
  }
  // Keep active learning, answers and entered forms mounted when city changes.
  if (['courses', 'program-selection', 'learn', 'cabinet', 'payment', 'auth', 'b2b', 'contacts', 'admin', 'certificates', 'verify'].includes(segments[0])) {
    router.push({ path: route.path, query: { ...route.query, city: slug }, hash: route.hash });
    return;
  }
  router.push({ path: localePath(`/${slug}`), query: { ...route.query, city: slug } });
};
</script>

<template>
  <div class="flex items-center gap-2">
    <label class="text-sm text-slate-600" :for="selectId">{{ t('citySwitcher.label') }}</label>
    <select
      :id="selectId"
      :aria-label="t('citySwitcher.label')"
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
