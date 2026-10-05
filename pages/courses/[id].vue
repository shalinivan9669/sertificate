<script setup lang="ts">
import { leadContextQuery } from '~/shared/lead-context';
import { preferredProgramVersion } from '~/shared/program-version-selection';
import { getPublicCourseValue } from '~/shared/public-course-value';
import { getPublicCourseSeo } from '~/shared/public-course-seo';
import { getCourseSearchContent } from '~/shared/course-search-content';
import { canonicalPublicPath } from '~/config/public-route-runtime';

type ProgramDetails = Omit<LmsProgram, 'versions'> & {
  versions: Array<LmsProgram['versions'][number] & { limitations?: string; support?: string }>;
};
const route = useRoute();
const router = useRouter();
const path = useLocalePath();
const { api, tr, locale, date, errorText } = useLmsApi();
const requestedProgramId = computed(() => String(route.params.id));
const { data, pending, error, refresh } = await useAsyncData(
  () => 'lms-program-' + requestedProgramId.value,
  (_nuxtApp, { signal }) => api<{ program: ProgramDetails }>('/catalog/programs/' + encodeURIComponent(requestedProgramId.value), { signal }),
);
// Refresh after hydration: Nuxt reuses the prerender payload during onMounted.
onNuxtReady(() => { void refresh(); });
if (lmsErrorStatus(error.value) === 404)
  throw createError({ statusCode: 404, statusMessage: 'Программа не найдена' });
watch(error, (value) => {
  if (lmsErrorStatus(value) === 404) showError({ statusCode: 404, statusMessage: 'Программа не найдена' });
});
const program = computed(() => data.value?.program);
const { track } = useLmsAnalytics();
onMounted(() => {
  watch(() => program.value?.id, value => { if (value) track('program_view', { programId: value }); }, { immediate: true });
});
const busy = ref(false);
const selecting = ref(false);
const failure = ref('');
const version = computed(() => preferredProgramVersion(program.value?.versions || [], {
  versionId: route.query.versionId, language: locale.value, format: route.query.format,
}));
const contextQuery = computed(() => leadContextQuery({ city: route.query.city, format: route.query.format }));
const consultationQuery = computed(() => leadContextQuery({ programId: program.value?.directionId || program.value?.id, ...contextQuery.value }));
const priceRequestRoute = computed(() => ({ path: path('/contacts'), query: { ...consultationQuery.value, request: 'price' }, hash: '#request-form' }));
const catalogQuery = computed(() => ({
  ...contextQuery.value,
  ...(typeof route.query.q === 'string' ? { q: route.query.q } : {}),
  ...(typeof route.query.direction === 'string' ? { direction: route.query.direction } : {}),
}));
const versionQuery = computed(() => ({ ...catalogQuery.value, ...(version.value ? { versionId: version.value.id } : {}) }));
const formatLabel = (value?: string) => ({ online: tr('Онлайн', 'Онлайн'), classroom: tr('В учебном центре', 'Оқу орталығында'), onsite: tr('На площадке организации', 'Ұйым аумағында') }[value || ''] || value || tr('Уточняется', 'Нақтыланады'));
const formatMismatch = computed(() => typeof route.query.format === 'string' && version.value && version.value.format !== route.query.format);
const title = computed(() => program.value?.title[locale.value === 'kk' ? 'kk' : 'ru'] || tr('Программа обучения', 'Оқу бағдарламасы'));
const guidance = computed(() => program.value?.sourceProduct?.guidance);
const courseValue = computed(() => getPublicCourseValue(program.value?.directionId || program.value?.id));
const audience = computed(() => version.value?.audience || guidance.value?.audience[locale.value === 'kk' ? 'kk' : 'ru']);
const seo = computed(() => getPublicCourseSeo(requestedProgramId.value, locale.value)
  || getPublicCourseSeo(program.value?.directionId || program.value?.id, locale.value));
const searchContent = computed(() => getCourseSearchContent(program.value?.directionId || requestedProgramId.value, locale.value));
const pageHeading = computed(() => searchContent.value?.programHeading || title.value);
const runtimeConfig = useRuntimeConfig();
const absoluteUrl = (value: string) => new URL(value, runtimeConfig.public.siteUrl).toString();
useHead(() => ({
  title: seo.value?.title || title.value + ' — OT Center',
  meta: seo.value ? [
    { name: 'description', content: seo.value.description },
    { property: 'og:title', content: seo.value.title },
    { property: 'og:description', content: seo.value.description },
    { name: 'twitter:title', content: seo.value.title },
    { name: 'twitter:description', content: seo.value.description },
  ] : [],
  script: program.value ? [{
    key: 'public-program-structured-data', type: 'application/ld+json',
    innerHTML: JSON.stringify({
      '@context': 'https://schema.org', '@graph': [{
        '@type': 'Course', name: pageHeading.value, description: seo.value?.description,
        url: absoluteUrl(canonicalPublicPath(route.path)),
        provider: { '@type': 'EducationalOrganization', name: 'OT Center', url: absoluteUrl('/') },
      }, {
        '@type': 'BreadcrumbList', itemListElement: [
          { '@type': 'ListItem', position: 1, name: tr('Главная', 'Басты бет'), item: absoluteUrl(path('/')) },
          { '@type': 'ListItem', position: 2, name: tr('Курсы', 'Курстар'), item: absoluteUrl(path('/courses')) },
          { '@type': 'ListItem', position: 3, name: pageHeading.value, item: absoluteUrl(canonicalPublicPath(route.path)) },
        ],
      }],
    }).replace(/</g, '\\u003c'),
  }] : [],
}));

async function selectVersion(event: Event) {
  const id = (event.target as HTMLSelectElement).value;
  if (selecting.value || busy.value || !program.value?.versions.some(item => item.id === id)) return;
  selecting.value = true;
  try {
    // The URL owns explicit selection. No reciprocal watchers or competing navigation.
    await navigateTo({ path: route.path, query: { ...route.query, versionId: id }, hash: route.hash }, { replace: true });
    failure.value = '';
  } finally { selecting.value = false; }
}
async function enroll() {
  if (!version.value || busy.value || selecting.value) return;
  const selectedVersionId = version.value.id;
  const returnTo = router.resolve({ path: route.path, query: { ...route.query, versionId: selectedVersionId }, hash: route.hash }).fullPath;
  busy.value = true;
  failure.value = '';
  try {
    const result = await api<any>('/enrollments', {
      method: 'POST', headers: { 'Idempotency-Key': crypto.randomUUID() }, body: { versionId: selectedVersionId },
    });
    await navigateTo(path('/learn/' + (result.enrollment?.id || result.id)));
  } catch (cause) {
    if (lmsErrorStatus(cause) === 401)
      await navigateTo({ path: path('/auth/login'), query: { returnTo } });
    else failure.value = errorText(cause);
  } finally { busy.value = false; }
}
</script>

<template>
  <LmsShell :title="pageHeading" :back-query="catalogQuery">
    <LmsState :pending="pending" :error="error" @retry="refresh">
      <div v-if="program" class="ed-program-grid">
        <section class="ed-program-intro" aria-labelledby="program-overview">
          <p class="ed-commerce-kicker">{{ tr('Программа / содержание и условия', 'Бағдарлама / мазмұны мен шарттары') }}</p>
          <h2 id="program-overview">{{ courseValue?.purpose[locale === 'kk' ? 'kk' : 'ru'] || tr('Знания для вашей работы.', 'Жұмысыңызға қажет білім.') }}</h2>
          <p v-if="courseValue || guidance" class="ed-program-lead">{{ courseValue?.description[locale === 'kk' ? 'kk' : 'ru'] || guidance?.summary[locale === 'kk' ? 'kk' : 'ru'] }}</p>
          <p v-else class="ed-program-lead">{{ tr('Изучите содержание и выберите подходящие условия. Язык, формат и порядок записи зависят от доступной версии программы.', 'Мазмұнын қарап, қолайлы шарттарды таңдаңыз. Тіл, формат және тіркелу тәртібі бағдарламаның қолжетімді нұсқасына байланысты.') }}</p>
          <div v-if="audience" class="ed-program-audience"><h3>{{ tr('Кому подойдёт', 'Кімге арналған') }}</h3><p>{{ audience }}</p></div>
          <NuxtLink v-if="program.publicPath !== '/courses/' + program.slug" class="ed-commerce-text-link" :to="{ path: path(program.publicPath), query: contextQuery }">{{ tr('Подробнее о направлении', 'Бағыт туралы толығырақ') }} <span aria-hidden="true">↗</span></NuxtLink>
        </section>
        <aside class="ed-program-passport" aria-labelledby="program-terms">
          <p class="ed-commerce-kicker">{{ tr('Ваш следующий шаг', 'Келесі қадамыңыз') }}</p>
          <h2 id="program-terms">{{ tr('Условия обучения', 'Оқу шарттары') }}</h2>
          <p class="ed-program-cost-note"><strong>{{ tr('Стоимость по запросу', 'Бағасы сұрау бойынша') }}</strong>{{ tr('Уточним вашу задачу, формат и число участников. Подготовим предложение по выбранной программе.', 'Міндетіңізді, форматты және қатысушылар санын нақтылап, таңдалған бағдарлама бойынша ұсыныс дайындаймыз.') }}</p>
          <NuxtLink class="lms-button ed-program-action" :to="priceRequestRoute" @click="track('contact_click', { programId: program.id })">{{ tr('Запросить стоимость', 'Бағасын сұрау') }} <span aria-hidden="true">↗</span></NuxtLink>
          <template v-if="version">
            <label v-if="program.versions.length > 1" class="ed-version-field"><span>{{ tr('Вариант и язык обучения', 'Оқу нұсқасы және тілі') }}</span><select :value="version.id" :disabled="busy || selecting" @change="selectVersion"><option v-for="item in program.versions" :key="item.id" :value="item.id">{{ item.title }} · {{ item.language.toUpperCase() }}</option></select></label>
            <p v-else class="ed-program-version">{{ version.title }}</p>
            <dl class="ed-program-facts">
              <div><dt>{{ tr('Язык обучения', 'Оқу тілі') }}</dt><dd>{{ version.language === 'kk' ? 'Қазақша' : version.language === 'ru' ? 'Русский' : version.language.toUpperCase() }}</dd></div>
              <div><dt>{{ tr('Объём', 'Көлемі') }}</dt><dd>{{ version.durationHours }} {{ tr('часов', 'сағат') }}</dd></div>
              <div v-if="version.format"><dt>{{ tr('Формат', 'Формат') }}</dt><dd>{{ formatLabel(version.format) }}</dd></div>
            </dl>
            <p v-if="formatMismatch" class="ed-program-notice" role="status">{{ tr('В выбранной версии предусмотрен другой формат. Проверьте условия или обсудите своё предпочтение с центром.', 'Таңдалған нұсқада басқа формат көзделген. Шарттарды тексеріңіз немесе қалауыңызды орталықпен талқылаңыз.') }}</p>
            <p v-if="version.intakeOpen === false" class="ed-program-notice">{{ tr('Набор на эту версию приостановлен. Уточните следующий набор в учебном центре.', 'Бұл нұсқаға қабылдау тоқтатылған. Келесі қабылдауды оқу орталығынан нақтылаңыз.') }}</p>
            <button v-else-if="version.accessModel === 'free' && version.billingBasis !== 'organization'" class="lms-button ed-program-action" :disabled="busy || selecting" @click="enroll">{{ busy ? tr('Оформляем запись…', 'Тіркелу рәсімделуде…') : tr('Записаться на обучение', 'Оқуға жазылу') }} <span aria-hidden="true">↗</span></button>
            <NuxtLink v-else-if="version.billingBasis === 'organization'" class="ed-commerce-text-link" :to="{ path: path('/cabinet/organization'), query: versionQuery }">{{ tr('Записать команду', 'Команданы тіркеу') }} <span aria-hidden="true">↗</span></NuxtLink>
            <NuxtLink v-else class="ed-commerce-text-link" :to="{ path: path('/payment/' + program.id), query: versionQuery }">{{ tr('Условия записи и оплаты', 'Тіркелу және төлеу шарттары') }} <span aria-hidden="true">↗</span></NuxtLink>
            <p v-if="failure" class="lms-error" role="alert">{{ failure }}</p>
          </template>
          <template v-else>
            <p class="ed-program-notice">{{ tr('Доступную программу, язык, формат и дату начала согласуем с вами перед записью.', 'Қолжетімді бағдарламаны, тілді, форматты және басталу күнін тіркелу алдында сізбен келісеміз.') }}</p>
          </template>
          <NuxtLink class="ed-commerce-text-link ed-program-team" :to="{ path: path('/b2b'), query: consultationQuery }">{{ tr('Обучение для организации', 'Ұйым үшін оқыту') }}</NuxtLink>
        </aside>
        <section class="ed-program-section" aria-labelledby="program-content">
          <p class="ed-commerce-kicker">01 / {{ tr('Что предстоит изучить', 'Нені үйренесіз') }}</p>
          <h2 id="program-content">{{ tr('Содержание программы', 'Бағдарлама мазмұны') }}</h2>
          <ol v-if="version?.modules.length" class="ed-program-modules"><li v-for="(module, index) in version.modules" :key="module.id"><span class="ed-program-module-number">{{ String(index + 1).padStart(2, '0') }}</span><div><h3>{{ module.title }}</h3><ul><li v-for="lesson in module.lessons" :key="lesson.id">{{ lesson.title }}<span v-if="lesson.kind === 'practice'" class="ed-program-practice">{{ tr('Практика', 'Практика') }}</span></li></ul></div></li></ol>
          <template v-else><p>{{ tr('Специалист предоставит учебную программу с учётом вашей должности, отрасли и необходимых практических занятий.', 'Маман лауазымыңызға, салаңызға және қажетті практикалық сабақтарға сай оқу бағдарламасын ұсынады.') }}</p><ul v-if="guidance?.topics" class="ed-program-topics"><li v-for="topic in guidance.topics[locale === 'kk' ? 'kk' : 'ru']" :key="topic">{{ topic }}</li></ul><p v-if="guidance?.topics" class="ed-commerce-caption">{{ tr('Темы помогают сориентироваться в направлении. Окончательное содержание уточняется при выборе программы.', 'Тақырыптар бағытты түсінуге көмектеседі. Соңғы мазмұн бағдарлама таңдалған кезде нақтыланады.') }}</p></template>
        </section>
        <section v-if="version?.outcomes || version?.documentDescription" class="ed-program-section" aria-labelledby="program-outcomes"><p class="ed-commerce-kicker">02 / {{ tr('После обучения', 'Оқудан кейін') }}</p><h2 id="program-outcomes">{{ tr('Результат и документы', 'Нәтиже мен құжаттар') }}</h2><p v-if="version.outcomes">{{ version.outcomes }}</p><p v-if="version.documentDescription">{{ version.documentDescription }}</p></section>
        <section class="ed-program-section" aria-labelledby="program-before"><p class="ed-commerce-kicker">{{ version?.outcomes || version?.documentDescription ? '03' : '02' }} / {{ tr('Перед началом', 'Бастамас бұрын') }}</p><h2 id="program-before">{{ tr('Что нужно учесть', 'Нені ескеру керек') }}</h2><p v-if="version?.prerequisites">{{ version.prerequisites }}</p><p v-if="version?.limitations">{{ version.limitations }}</p><p v-if="version?.retakePolicy">{{ version.retakePolicy }}</p><p v-if="version?.support">{{ version.support }}</p><p v-if="!version">{{ tr('Подготовьте сведения о должности, видах работ и требованиях работодателя. Для команды укажите число сотрудников и удобный график.', 'Лауазым, жұмыс түрлері және жұмыс берушінің талаптары туралы мәліметтерді дайындаңыз. Команда үшін қызметкерлер санын және қолайлы кестені көрсетіңіз.') }}</p><NuxtLink class="ed-commerce-text-link" :to="path('/public-offer')">{{ tr('Общие условия обучения', 'Оқудың жалпы шарттары') }} <span aria-hidden="true">↗</span></NuxtLink><p v-if="version?.reviewedAt" class="ed-commerce-caption">{{ tr('Содержание проверено', 'Мазмұны тексерілген') }}: {{ date(version.reviewedAt) }}</p></section>
        <CourseSearchIntent :direction-id="program.directionId || program.id" />
      </div>
    </LmsState>
  </LmsShell>
</template>
