<script setup lang="ts">
import { leadContextQuery } from '~/shared/lead-context';
import { getPublicCourseValue } from '~/shared/public-course-value';
import { seoExpansionMetadata } from '~/content/seo-expansion-metadata';

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
  title: tr(seoExpansionMetadata.catalog.title, 'Бағдарламалар каталогы — OT Center'),
  meta: [{ name: 'description', content: tr(seoExpansionMetadata.catalog.description, 'OT Center оқу бағыттары мен бағдарламалары. Мазмұны, шарттары, тілдері және оқуға жазылу.') }],
}));
</script>

<template>
  <LmsShell :title="tr(seoExpansionMetadata.catalog.h1, 'Оқу бағдарламалары')" :subtitle="tr('Сравните направления и содержание. Выберите программу или запросите стоимость обучения для вашей команды.', 'Бағыттар мен мазмұнын салыстырыңыз. Бағдарлама таңдаңыз немесе командаңызға оқу бағасын сұраңыз.')">
    <form class="ed-catalog-filters" role="search" @submit.prevent="applyFilters()">
      <label class="ed-catalog-search"><span>{{ tr('Поиск программы', 'Бағдарламаны іздеу') }}</span><input v-model="search" type="search" maxlength="150" :placeholder="tr('Например, охрана труда', 'Мысалы, еңбекті қорғау')" /></label>
      <label><span>{{ tr('Направление', 'Бағыт') }}</span><select v-model="direction"><option value="">{{ tr('Все направления', 'Барлық бағыттар') }}</option><option v-for="item in LMS_DIRECTIONS" :key="item.id" :value="item.id">{{ locale === 'kk' ? item.kk : item.ru }}</option></select></label>
      <button class="lms-button" :disabled="navigating">{{ tr('Найти', 'Іздеу') }} <span aria-hidden="true">↗</span></button>
    </form>
    <div class="ed-catalog-summary">
      <p role="status" aria-live="polite">{{ pending ? tr('Загружаем программы…', 'Бағдарламалар жүктелуде…') : error ? tr('Не удалось загрузить программы', 'Бағдарламаларды жүктеу мүмкін болмады') : tr('Найдено программ:', 'Табылған бағдарламалар:') }} <strong v-if="!pending && !error">{{ programs.length }}</strong><span v-if="appliedSearch"> · «{{ appliedSearch }}»</span></p>
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
      <div v-else class="ed-catalog-grid">
        <EditorialProgramCard
          v-for="program in programs"
          :key="program.id"
          heading="h2"
          :title="program.title[locale === 'kk' ? 'kk' : 'ru']"
          :description="value(program)?.description[locale === 'kk' ? 'kk' : 'ru'] || program.sourceProduct?.guidance?.summary[locale === 'kk' ? 'kk' : 'ru'] || ''"
          :purpose="value(program)?.purpose[locale === 'kk' ? 'kk' : 'ru']"
          :status="availability(program)"
          :languages="[...new Set(program.versions.map(version => version.language.toUpperCase()))].join(' / ')"
          :to="{ path: path('/courses/' + program.id), query: programQuery }"
          :request-to="priceRequest(program)"
        />
      </div>
    </LmsState>
    <section class="ed-catalog-help" aria-labelledby="catalog-help-title">
      <div>
        <h2 id="catalog-help-title">{{ tr('Начните с вашей задачи', 'Міндетіңізден бастаңыз') }}</h2>
        <p>{{ tr('Нужны несколько направлений или обучение для команды? Подбор поможет учесть вашу работу, город и формат.', 'Бірнеше бағыт немесе командаға оқу қажет пе? Таңдау жұмысыңызды, қала мен форматты ескеруге көмектеседі.') }}</p>
      </div>
      <NuxtLink class="ed-commerce-text-link" :to="{ path: path('/program-selection'), query: contextQuery }">{{ tr('Подобрать обучение', 'Оқуды таңдау') }} <CivicIcon name="arrow" aria-hidden="true" /></NuxtLink>
    </section>
  </LmsShell>
</template>

<style scoped>
.ed-catalog-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 20px;
}
.ed-catalog-help {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px 32px;
  padding: 20px 24px;
  border: 1px solid var(--ed-rule, #ccd3cd);
  border-radius: var(--ed-radius, 4px);
  background: var(--ed-soft, #e8ede7);
}
.ed-catalog-help > div { min-width: 0; }
.ed-catalog-help #catalog-help-title {
  margin: 0 0 6px;
  color: var(--ed-ink, #10262a);
  font: 500 24px/1.25 var(--ed-display, Georgia, serif);
  letter-spacing: -.025em;
}
.ed-catalog-help p {
  max-width: 72ch;
  margin: 0;
  color: var(--ed-muted, #526365);
  font: 400 14px/1.65 var(--ed-sans, Arial, sans-serif);
}
.ed-catalog-help > a { flex-shrink: 0; }
.ed-catalog-help .civic-icon { width: 18px; height: 18px; }
@media (max-width: 800px) {
  .ed-catalog-grid { grid-template-columns: minmax(0, 1fr); gap: 16px; }
  .ed-catalog-help { align-items: flex-start; flex-direction: column; gap: 8px; padding: 20px; }
}
</style>
