<script setup lang="ts">
import { leadContextQuery, leadProgramQuery } from '~/shared/lead-context';
const { api, tr, locale, errorText } = useLmsApi();
const path = useLocalePath();
const route = useRoute();
const { selection, set, setDirections, toggleDirection, fromQuery, directions } = useLmsSelection();
fromQuery(route.query);
watch(
  () => route.query,
  (q) => fromQuery(q),
  { deep: true },
);
const step = ref(1);
const stepPanel = useTemplateRef<HTMLFormElement>('stepPanel');
watch(step, async () => { await nextTick(); stepPanel.value?.focus({ preventScroll: true }); });
const { track } = useLmsAnalytics();
const attribution = useLeadAttribution();
let selectionStarted = false;
let selectionCompleted = false;
const analyticsContext = () => ({ programId: selection.value.direction, city: selection.value.city, format: selection.value.format, audience: selection.value.role === 'hr' ? 'b2b' : 'b2c' });
function startSelection() {
  if (!selectionStarted) { selectionStarted = true; track('selection_start', analyticsContext()); void attribution.action('selection_start', journeyContext()).catch(() => {}); }
}
function changeStep(value: number) {
  startSelection(); step.value = value > 1 && !chosenDirections.value.length ? 1 : value;
  if (step.value === 4 && !selectionCompleted) { selectionCompleted = true; track('selection_complete', analyticsContext()); }
}
const chosenDirections = computed(() => selection.value.directionIds.flatMap(id => {
  const direction = directions.find(item => item.id === id);
  return direction ? [direction] : [];
}));
type SelectionResult = { versions: LmsProgram['versions']; error: string };
const matches = ref<Record<string, SelectionResult>>({});
const lookupState = ref<'idle' | 'loading' | 'ready'>('idle');
const hasLookupErrors = computed(() => Object.values(matches.value).some(result => result.error));
let lookupKey = '';
let lookupRevision = 0;
const selectionKey = () => JSON.stringify([selection.value.directionIds, locale.value, selection.value.format, selection.value.city]);
const helpRoute = computed(() => ({
  path: selection.value.role === 'hr' ? path('/b2b') : path('/contacts'),
  query: leadProgramQuery(selection.value),
  hash: selection.value.role === 'hr' ? '#team-request' : '#request-form',
}));
function journeyContext() {
  const context = leadContextQuery(selection.value);
  return { routeId: 'selection' as const, locale: locale.value === 'kk' ? 'kk' as const : 'ru' as const, source: 'internal' as const, ...(context.program ? { programId: context.program } : {}), ...(context.city ? { city: context.city } : {}), ...(context.format ? { format: context.format as 'online' | 'classroom' | 'onsite' } : {}) };
}
async function lookupSelection(force = false) {
  if (step.value !== 4 || !chosenDirections.value.length) {
    ++lookupRevision; lookupKey = ''; lookupState.value = 'idle'; matches.value = {}; return;
  }
  const key = selectionKey();
  if (!force && key === lookupKey && ['loading', 'ready'].includes(lookupState.value)) return;
  lookupKey = key; const revision = ++lookupRevision; const context = journeyContext();
  lookupState.value = 'loading'; matches.value = {};
  const pending = chosenDirections.value.map(direction => direction.id);
  const current = () => revision === lookupRevision && key === selectionKey() && step.value === 4;
  // Limit parallel catalogue requests; an unavailable direction does not hide the others.
  async function worker() {
    while (pending.length && current()) {
      const id = pending.shift()!;
      try {
        const result = await api<{ program: LmsProgram }>('/catalog/programs/' + encodeURIComponent(id), { retry: 0 });
        if (!current()) return;
        const versions = result.program.versions.filter(version => version.language === context.locale && version.format === context.format && version.intakeOpen !== false);
        matches.value = { ...matches.value, [id]: { versions, error: '' } };
        void attribution.action(versions.length ? 'selection_matched' : 'selection_unmatched', { ...context, programId: id }).catch(() => {});
      } catch (cause) {
        if (!current()) return;
        matches.value = { ...matches.value, [id]: { versions: [], error: errorText(cause) } };
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(3, pending.length) }, () => worker()));
  if (current()) lookupState.value = 'ready';
}
watch([step, () => selection.value.directionIds.join(','), locale, () => selection.value.format, () => selection.value.city], () => { void lookupSelection(); });
onBeforeUnmount(() => { ++lookupRevision; });
const steps = computed(() => [
  tr("Направления", "Бағыттар"),
  tr("Ваша работа", "Жұмысыңыз"),
  tr("Формат", "Формат"),
  tr("Результат подбора", "Таңдау нәтижесі"),
]);
useHead(() => ({
  title: tr("Подбор программы — OT Center", "Бағдарлама таңдау — OT Center"),
}));
</script>
<template>
  <LmsShell
    :class="{ 'ed-selection-started': step > 1 }"
    :title="
      tr(
        'Подбор программы',
        'Бағдарлама таңдау',
      )
    "
    :subtitle="
      tr(
        'Выберите одно или несколько направлений — подберём варианты для каждой вашей задачи.',
        'Бір немесе бірнеше бағытты таңдаңыз — әр міндетіңізге сәйкес нұсқаларды табамыз.',
      )
    "
  >
    <ol class="ed-selection-steps" :aria-label="tr('Шаги подбора', 'Таңдау қадамдары')">
      <li v-for="(s, i) in steps" :key="s">
        <button
          :class="{ 'is-complete': i + 1 < step }"
          :aria-current="i + 1 === step ? 'step' : undefined"
          @click="changeStep(i + 1)"
        >
          <span class="ed-selection-number" aria-hidden="true">{{ i + 1 }}</span><span>{{ s }}</span>
        </button>
      </li>
    </ol>
    <form
      ref="stepPanel"
      tabindex="-1"
      class="lms-card ed-selection-panel space-y-6"
      :aria-label="`${tr('Шаг', 'Қадам')} ${step} / 4: ${steps[step - 1]}`"
      @change="startSelection"
      @submit.prevent="changeStep(Math.min(4, step + 1))"
    >
      <div class="ed-selection-current" aria-live="polite">
        <p>{{ tr('Шаг', 'Қадам') }} {{ step }} / 4</p>
        <h2>{{ [tr('Что нужно изучить?', 'Нені үйрену керек?'), tr('Расскажите о своей работе', 'Жұмысыңыз туралы айтыңыз'), tr('Как вам удобнее учиться?', 'Қалай оқыған ыңғайлы?'), tr('Ваш следующий шаг', 'Сіздің келесі қадамыңыз')][step - 1] }}</h2>
      </div>
      <fieldset v-if="step === 1" class="space-y-4">
        <legend class="text-xl font-bold">{{ steps[0] }}</legend>
        <p id="direction-help" class="text-slate-600">{{ tr('Можно отметить несколько направлений. Повторное нажатие снимает выбор.', 'Бірнеше бағытты белгілеуге болады. Қайта басу таңдауды алып тастайды.') }}</p>
        <div class="grid gap-3 md:grid-cols-2">
          <label
            v-for="d in directions"
            :key="d.id"
            class="flex min-h-[52px] cursor-pointer items-center gap-3 rounded-xl border p-4"
            :class="
              selection.directionIds.includes(d.id)
                ? 'border-brand-accent bg-brand-soft'
                : 'border-slate-200'
            "
            ><input
              type="checkbox"
              name="direction"
              aria-describedby="direction-help"
              :checked="selection.directionIds.includes(d.id)"
              :value="d.id"
              @change="toggleDirection(d.id)"
            />{{ locale === "kk" ? d.kk : d.ru }}</label
          >
        </div>
        <div class="flex flex-wrap items-center justify-between gap-3">
          <p role="status">{{ tr('Выбрано направлений:', 'Таңдалған бағыттар:') }} {{ chosenDirections.length }}</p>
          <button v-if="chosenDirections.length" type="button" class="lms-button secondary" @click="setDirections([])">{{ tr('Снять выбор', 'Таңдауды алып тастау') }}</button>
        </div>
      </fieldset>
      <div v-else-if="step === 2" class="grid gap-5 md:grid-cols-2">
        <label class="space-y-2"
          ><span>{{ tr("Ваша роль", "Сіздің рөліңіз") }}</span
          ><select
            :value="selection.role"
            @change="set('role', ($event.target as HTMLSelectElement).value)"
          >
            <option value="">
              {{ tr("Выберите роль", "Рөлді таңдаңыз") }}
            </option>
            <option value="worker">
              {{ tr("Рабочий / исполнитель", "Жұмысшы / орындаушы") }}
            </option>
            <option value="manager">
              {{ tr("Руководитель / специалист", "Басшы / маман") }}
            </option>
            <option value="hr">
              {{
                tr(
                  "Организую обучение команды",
                  "Команданы оқытуды ұйымдастырамын",
                )
              }}
            </option>
          </select></label
        ><label class="space-y-2"
          ><span>{{ tr("Отрасль", "Сала") }}</span
          ><select
            :value="selection.industry"
            @change="
              set('industry', ($event.target as HTMLSelectElement).value)
            "
          >
            <option value="">
              {{ tr("Выберите отрасль", "Саланы таңдаңыз") }}
            </option>
            <option value="construction">
              {{ tr("Строительство", "Құрылыс") }}
            </option>
            <option value="industry">
              {{ tr("Промышленность", "Өнеркәсіп") }}
            </option>
            <option value="energy">{{ tr("Энергетика", "Энергетика") }}</option>
            <option value="services">
              {{
                tr("Услуги и другие отрасли", "Қызметтер және басқа салалар")
              }}
            </option>
          </select></label
        >
      </div>
      <fieldset v-else-if="step === 3" class="space-y-4">
        <legend class="text-xl font-bold">
          {{ tr("Предпочтительный формат", "Қалаулы формат") }}
        </legend>
        <label
          v-for="f in [
            { id: 'online', ru: 'Онлайн', kk: 'Онлайн' },
            { id: 'classroom', ru: 'В учебном центре', kk: 'Оқу орталығында' },
            {
              id: 'onsite',
              ru: 'На площадке организации',
              kk: 'Ұйым аумағында',
            },
          ]"
          :key="f.id"
          class="flex cursor-pointer items-center gap-3 rounded-xl border p-4"
          ><input
            type="radio"
            name="format"
            :checked="selection.format === f.id"
            @change="set('format', f.id)"
          />{{ locale === "kk" ? f.kk : f.ru }}</label
        >
      </fieldset>
      <div v-else class="space-y-5">
        <h2 class="text-xl font-bold">{{ tr('Выбрано направлений:', 'Таңдалған бағыттар:') }} {{ chosenDirections.length }}</h2>
        <p class="text-slate-600">{{ tr('Ниже — отдельный результат для каждого направления. Роль, отрасль и необходимую практическую часть уточним при выборе конкретной программы.', 'Төменде әр бағыт бойынша жеке нәтиже көрсетілген. Нақты бағдарламаны таңдағанда рөлді, саланы және қажетті практикалық бөлімді нақтылаймыз.') }}</p>
        <p v-if="selection.format !== 'online'" class="lms-note">{{ tr('Очный и выездной график согласуется с учебным центром.', 'Күндізгі және көшпелі оқу кестесі оқу орталығымен келісіледі.') }}</p>
        <p v-if="lookupState === 'loading'" class="lms-note" role="status">{{ tr('Подбираем опубликованные варианты по выбранным направлениям…', 'Таңдалған бағыттар бойынша жарияланған нұсқаларды іздеп жатырмыз…') }}</p>
        <div class="space-y-4">
          <article v-for="direction in chosenDirections" :key="direction.id" class="space-y-3 rounded-xl border border-slate-200 p-5">
            <h3 class="text-lg font-bold">{{ locale === 'kk' ? direction.kk : direction.ru }}</h3>
            <p v-if="matches[direction.id]?.error" class="lms-error" role="alert">{{ matches[direction.id]?.error }}</p>
            <template v-else-if="matches[direction.id]">
              <div v-if="matches[direction.id]?.versions.length" class="space-y-2">
                <p>{{ tr('Опубликованные варианты на выбранном языке и в выбранном формате:', 'Таңдалған тіл мен форматтағы жарияланған нұсқалар:') }}</p>
                <ul class="list-disc pl-5"><li v-for="version in matches[direction.id]?.versions || []" :key="version.id">{{ version.title }}</li></ul>
              </div>
              <p v-else class="text-slate-600">{{ tr('Опубликованный вариант пока не найден. Специалист уточнит доступные программы и условия.', 'Жарияланған нұсқа әзірге табылмады. Маман қолжетімді бағдарламалар мен шарттарды нақтылайды.') }}</p>
            </template>
            <NuxtLink class="lms-button secondary" :to="{ path: path('/courses/' + direction.id), query: { role: selection.role, industry: selection.industry, format: selection.format, city: selection.city } }">{{ tr('Посмотреть программу', 'Бағдарламаны көру') }}</NuxtLink>
          </article>
        </div>
        <button v-if="hasLookupErrors" type="button" class="lms-button secondary" :disabled="lookupState === 'loading'" @click="lookupSelection(true)">{{ tr('Повторить подбор вариантов', 'Нұсқаларды қайта іздеу') }}</button>
        <div class="flex flex-wrap gap-3">
          <NuxtLink class="lms-button" :to="helpRoute" @click="track('support_open', analyticsContext())">{{ chosenDirections.length > 1 ? tr('Обсудить все выбранные направления', 'Барлық таңдалған бағыттарды талқылау') : tr('Помощь специалиста', 'Маманның көмегі') }}</NuxtLink>
          <button type="button" class="lms-button secondary" @click="changeStep(1)">{{ tr('Изменить выбор', 'Таңдауды өзгерту') }}</button>
        </div>
      </div>
      <div
        v-if="step < 4"
        class="flex flex-wrap justify-between gap-3 border-t pt-5"
      >
        <button
          class="lms-button secondary"
          type="button"
          :disabled="step === 1"
          @click="changeStep(step - 1)"
        >
          {{ tr("Назад", "Артқа") }}</button
        ><button
          class="lms-button"
          :disabled="step === 1 && !chosenDirections.length"
        >
          {{ tr("Следующий шаг", "Келесі қадам") }}
        </button>
      </div>
    </form></LmsShell
  >
</template>
