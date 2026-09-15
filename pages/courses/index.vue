<script setup lang="ts">
import { leadContextQuery } from '~/shared/lead-context';
import { getPublicCourseValue } from '~/shared/public-course-value';

const { api, tr, locale } = useLmsApi();
const path = useLocalePath();
const route = useRoute();
const { selection, fromQuery } = useLmsSelection();
fromQuery(route.query);
watch(() => route.query, query => fromQuery(query));
const contextQuery = computed(() => leadContextQuery({ city: route.query.city || selection.value.city, format: route.query.format || selection.value.format }));
const { data, pending, error, refresh } = await useAsyncData('lms-catalog', () => api<{ programs: LmsProgram[] }>('/catalog/programs'));
// Published offers can change after prerendering; wait until payload hydration ends.
onNuxtReady(() => { void refresh(); });
const queryText = (value: unknown) => typeof value === 'string' ? value.slice(0, 150) : '';
const queryDirection = (value: unknown) => LMS_DIRECTIONS.some(item => item.id === value) ? String(value) : '';
const search = ref(queryText(route.query.q));
const direction = ref(queryDirection(route.query.direction));
watch(() => [route.query.q, route.query.direction], () => {
  search.value = queryText(route.query.q);
  direction.value = queryDirection(route.query.direction);
});
const appliedSearch = computed(() => queryText(route.query.q).trim());
const appliedDirection = computed(() => queryDirection(route.query.direction));
const filtersActive = computed(() => Boolean(appliedSearch.value || appliedDirection.value));
const navigating = ref(false);
async function applyFilters(reset = false) {
  if (navigating.value) return;
  navigating.value = true;
  const query = { ...route.query, ...contextQuery.value };
  delete query.q;
  delete query.direction;
  if (!reset && search.value.trim()) query.q = search.value.trim();
  if (!reset && direction.value) query.direction = direction.value;
  try { await navigateTo({ path: route.path, query, hash: route.hash }, { replace: true }); }
  finally { navigating.value = false; }
}
const programs = computed(() => (data.value?.programs || []).filter(program =>
  (!appliedDirection.value || program.directionId === appliedDirection.value) &&
  [program.title.ru, program.title.kk, program.sourceProduct?.guidance?.summary.ru, program.sourceProduct?.guidance?.summary.kk]
    .filter(Boolean).join(' ').toLowerCase().includes(appliedSearch.value.toLowerCase()),
));
const programQuery = computed(() => ({
  ...contextQuery.value,
  ...(appliedSearch.value ? { q: appliedSearch.value } : {}),
  ...(appliedDirection.value ? { direction: appliedDirection.value } : {}),
}));
const value = (program: LmsProgram) => getPublicCourseValue(program.directionId || program.id);
const priceRequest = (program: LmsProgram) => ({
  path: path('/contacts'), hash: '#request-form',
  query: { ...leadContextQuery({ ...contextQuery.value, programId: program.directionId || program.id }), request: 'price' },
});
const availability = (program: LmsProgram) => program.versions.some(version => version.intakeOpen !== false)
  ? tr('Есть варианты для записи', 'Тіркелуге болатын нұсқалар бар')
  : program.versions.length ? tr('Набор уточняется', 'Қабылдау нақтыланады') : tr('Подбор с консультантом', 'Кеңесшімен таңдау');
useHead(() => ({
  title: tr('Каталог программ — OT Center', 'Бағдарламалар каталогы — OT Center'),
  meta: [{ name: 'description', content: tr('Направления и программы обучения OT Center. Содержание, условия, языки и запись на обучение.', 'OT Center оқу бағыттары мен бағдарламалары. Мазмұны, шарттары, тілдері және оқуға жазылу.') }],
}));
</script>

<template>
  <LmsShell :title="tr('Программы обучения', 'Оқу бағдарламалары')" :subtitle="tr('Выберите знания, которые нужны в вашей работе. В каждой программе — содержание, условия и понятный следующий шаг.', 'Жұмысыңызға қажетті білімді таңдаңыз. Әр бағдарламада мазмұны, шарттары және түсінікті келесі қадам берілген.')">
    <form class="ed-catalog-filters" role="search" @submit.prevent="applyFilters()">
      <label class="ed-catalog-search"><span>{{ tr('Поиск программы', 'Бағдарламаны іздеу') }}</span><input v-model="search" type="search" maxlength="150" :placeholder="tr('Например, охрана труда', 'Мысалы, еңбекті қорғау')" /></label>
      <label><span>{{ tr('Направление', 'Бағыт') }}</span><select v-model="direction"><option value="">{{ tr('Все направления', 'Барлық бағыттар') }}</option><option v-for="item in LMS_DIRECTIONS" :key="item.id" :value="item.id">{{ locale === 'kk' ? item.kk : item.ru }}</option></select></label>
      <button class="lms-button" :disabled="navigating">{{ tr('Найти', 'Іздеу') }} <span aria-hidden="true">↗</span></button>
    </form>
    <div class="ed-catalog-summary">
      <p role="status" aria-live="polite">{{ pending ? tr('Загружаем программы…', 'Бағдарламалар жүктелуде…') : tr('Найдено программ:', 'Табылған бағдарламалар:') }} <strong v-if="!pending">{{ programs.length }}</strong><span v-if="appliedSearch"> · «{{ appliedSearch }}»</span></p>
      <button v-if="filtersActive" class="ed-commerce-text-link" type="button" :disabled="navigating" @click="applyFilters(true)">{{ tr('Сбросить фильтры', 'Сүзгілерді тазалау') }} <span aria-hidden="true">×</span></button>
      <NuxtLink v-else class="ed-commerce-text-link" :to="{ path: path('/program-selection'), query: contextQuery }">{{ tr('Помочь с выбором', 'Таңдауға көмектесу') }} <span aria-hidden="true">↗</span></NuxtLink>
    </div>
    <LmsState :pending="pending" :error="error" @retry="refresh">
      <section v-if="!programs.length" class="ed-catalog-empty" aria-labelledby="catalog-empty-title">
        <p class="ed-commerce-kicker">{{ tr('Можно начать иначе', 'Басқаша бастауға болады') }}</p>
        <h2 id="catalog-empty-title">{{ tr('По этим условиям ничего не найдено.', 'Бұл шарттар бойынша ештеңе табылмады.') }}</h2>
        <p>{{ tr('Измените название или откройте все направления. Если не уверены, какая подготовка нужна, начните с подбора.', 'Атауды өзгертіңіз немесе барлық бағыттарды ашыңыз. Қандай дайындық қажет екенін білмесеңіз, таңдаудан бастаңыз.') }}</p>
        <div><button v-if="filtersActive" class="lms-button" :disabled="navigating" @click="applyFilters(true)">{{ tr('Показать все программы', 'Барлық бағдарламаларды көрсету') }}</button><NuxtLink class="lms-button secondary" :to="{ path: path('/program-selection'), query: contextQuery }">{{ tr('Подобрать обучение', 'Оқуды таңдау') }}</NuxtLink></div>
      </section>
      <div v-else class="ed-course-list">
        <article v-for="(program, index) in programs" :key="program.id" class="ed-course-row">
          <span class="ed-course-number" aria-hidden="true">{{ String(index + 1).padStart(2, '0') }}</span>
          <div class="ed-course-description">
            <p class="ed-commerce-kicker">{{ availability(program) }}</p>
            <h2><NuxtLink :to="{ path: path('/courses/' + program.id), query: programQuery }">{{ program.title[locale === 'kk' ? 'kk' : 'ru'] }}</NuxtLink></h2>
            <p v-if="value(program) || program.sourceProduct?.guidance?.summary" class="ed-course-summary">{{ value(program)?.description[locale === 'kk' ? 'kk' : 'ru'] || program.sourceProduct?.guidance?.summary[locale === 'kk' ? 'kk' : 'ru'] }}</p>
            <p v-if="program.versions.length" class="ed-course-languages">{{ tr('Языки обучения:', 'Оқу тілдері:') }} {{ [...new Set(program.versions.map(version => version.language.toUpperCase()))].join(' / ') }}</p>
          </div>
          <div class="ed-course-terms">
            <p v-if="value(program)" class="ed-course-value">{{ value(program)?.purpose[locale === 'kk' ? 'kk' : 'ru'] }}</p>
            <NuxtLink class="ed-price-request" :to="priceRequest(program)" :aria-label="tr('Запросить стоимость: ', 'Бағасын сұрау: ') + program.title[locale === 'kk' ? 'kk' : 'ru']">{{ tr('Запросить стоимость', 'Бағасын сұрау') }} <span aria-hidden="true">↗</span></NuxtLink>
            <NuxtLink class="ed-course-action" :to="{ path: path('/courses/' + program.id), query: programQuery }" :aria-label="tr('Содержание и условия: ', 'Мазмұны мен шарттары: ') + program.title[locale === 'kk' ? 'kk' : 'ru']"><span>{{ tr('Содержание и условия', 'Мазмұны мен шарттары') }}</span><span aria-hidden="true">↗</span></NuxtLink>
          </div>
        </article>
      </div>
    </LmsState>
  </LmsShell>
</template>
