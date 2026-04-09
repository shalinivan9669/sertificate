<script setup>
import { computed, ref, watch } from 'vue';
import { buildProgramSelectionQuery, getProgramFixture, getSelectionPresetFromQuery, getSelectionReview, PROGRAM_SELECTION_STEPS } from '~/composables/useProgramFlowMock';

definePageMeta({ layout: 'fullwidth' });

useHead({
  title: 'Подбор программы — Sertificat.kz',
  meta: [
    {
      name: 'description',
      content:
        'Новый мастер подбора программы обучения: направление, отрасль, уровень слушателя, профиль риска и review с итоговым маршрутом.',
    },
  ],
});

const route = useRoute();
const { paths, selection, patchSelection, syncCourseId, flow } = useRedesignRoutes();

const activeStep = ref(1);

const applyPresetFromQuery = () => {
  const preset = getSelectionPresetFromQuery(route.query);
  patchSelection(preset);
  syncCourseId();
  flow.patchFlow({ stage: 'wizard', branch: 'browse' });
};

applyPresetFromQuery();

watch(
  () => route.query,
  () => applyPresetFromQuery(),
  { deep: true },
);

const currentProgram = computed(() => getProgramFixture(selection.value.courseId));
const review = computed(() => getSelectionReview(selection.value));
const estimatedPrograms = computed(() => review.value.estimatedPrograms);
const currentDirection = computed(
  () =>
    PROGRAM_SELECTION_STEPS.directions.find((item) => item.id === selection.value.direction) ||
    PROGRAM_SELECTION_STEPS.directions[0],
);
const currentIndustry = computed(
  () =>
    PROGRAM_SELECTION_STEPS.industries.find((item) => item.id === selection.value.industry) ||
    PROGRAM_SELECTION_STEPS.industries[0],
);
const currentAudience = computed(
  () =>
    PROGRAM_SELECTION_STEPS.audiences.find((item) => item.id === selection.value.audience) ||
    PROGRAM_SELECTION_STEPS.audiences[0],
);
const currentProfile = computed(
  () =>
    PROGRAM_SELECTION_STEPS.profiles.find((item) => item.id === selection.value.specialization) ||
    PROGRAM_SELECTION_STEPS.profiles[0],
);

const setDirection = (directionId) => {
  const preset = getSelectionPresetFromQuery({ direction: directionId });
  patchSelection({
    ...preset,
    source: selection.value.source || 'direct',
    slug: selection.value.slug || preset.slug,
  });
  syncCourseId();
};

const setIndustry = (industryId) => patchSelection({ industry: industryId });
const setAudience = (audienceId) => patchSelection({ audience: audienceId });
const setProfile = (profileId) => patchSelection({ specialization: profileId });

const stepLabels = [
  'Направление',
  'Отрасль',
  'Слушатель',
  'Профиль риска',
  'Review',
];

const goNext = () => {
  if (activeStep.value < 5) {
    activeStep.value += 1;
    return;
  }

  navigateTo({
    path: paths.value.course,
    query: buildProgramSelectionQuery(selection.value),
  });
};

const goBack = () => {
  if (activeStep.value > 1) {
    activeStep.value -= 1;
    return;
  }

  navigateTo(paths.value.home);
};

const openCatalog = () =>
  navigateTo({
    path: paths.value.courses,
    query: buildProgramSelectionQuery(selection.value),
  });

const openProgram = () =>
  navigateTo({
    path: paths.value.course,
    query: buildProgramSelectionQuery(selection.value),
  });

const stepCanContinue = computed(() => Boolean(selection.value.courseId));

const directionDocs = computed(() => currentDirection.value.docs || []);
const industryHazards = computed(() => currentIndustry.value.hazards || []);
const audienceResponsibilities = computed(() => currentAudience.value.responsibilities || []);
const profileDocs = computed(() => currentProfile.value.documents || []);
</script>

<template>
  <div class="min-h-screen bg-[#06101d] text-white">
    <header class="sticky top-0 z-40 border-b border-white/5 bg-[#081527]/95 backdrop-blur">
      <div class="mx-auto flex max-w-screen-2xl items-center justify-between gap-6 px-6 py-4 md:px-8">
        <div>
          <div class="text-2xl font-extrabold tracking-tighter">Sertificat.kz</div>
          <div class="text-[10px] uppercase tracking-[0.24em] text-slate-400">Program selection flow</div>
        </div>
        <nav class="hidden items-center gap-6 md:flex">
          <NuxtLink class="text-slate-400 hover:text-white transition-colors" :to="paths.home">Главная</NuxtLink>
          <NuxtLink class="text-white font-semibold" :to="paths.programSelection">Подбор</NuxtLink>
          <NuxtLink class="text-slate-400 hover:text-white transition-colors" :to="paths.courses">Каталог</NuxtLink>
          <NuxtLink class="text-slate-400 hover:text-white transition-colors" :to="paths.cabinet">Кабинет</NuxtLink>
        </nav>
      </div>
    </header>

    <main class="mx-auto max-w-screen-2xl px-6 py-8 md:px-8 md:py-10">
      <section class="rounded-[28px] border border-white/10 bg-[linear-gradient(135deg,#0a192f_0%,#102544_50%,#17345a_100%)] p-6 shadow-[0_30px_80px_rgba(0,0,0,0.28)] md:p-8">
        <div class="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div class="max-w-3xl">
            <div class="mb-4 inline-flex rounded-full border border-white/10 bg-white/5 px-4 py-1 text-[10px] font-bold uppercase tracking-[0.24em] text-slate-300">
              Шаг {{ activeStep }} из 5
            </div>
            <h1 class="text-4xl font-extrabold leading-tight md:text-5xl">
              Подберите программу без повторяющегося UI
            </h1>
            <p class="mt-4 max-w-2xl text-base leading-relaxed text-slate-300 md:text-lg">
              На каждом шаге показываем отдельный тип информации: направление, отрасль, слушатель, профиль риска и итоговый review.
              Это новый вход в runtime-flow, а не старая course runtime-цепочка.
            </p>
          </div>

          <div class="grid min-w-[260px] gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
            <div class="flex items-center justify-between gap-4">
              <span class="uppercase tracking-[0.2em] text-slate-500">Оценка</span>
              <span class="text-white font-bold">{{ estimatedPrograms }}</span>
            </div>
            <div class="flex items-center justify-between gap-4">
              <span class="uppercase tracking-[0.2em] text-slate-500">Course</span>
              <span class="text-white font-bold">{{ currentProgram.title }}</span>
            </div>
            <div class="flex items-center justify-between gap-4">
              <span class="uppercase tracking-[0.2em] text-slate-500">Source</span>
              <span class="text-white font-bold">{{ selection.source }}</span>
            </div>
          </div>
        </div>

        <div class="mt-8 flex flex-wrap gap-3">
          <button
            v-for="(label, index) in stepLabels"
            :key="label"
            class="rounded-full border px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] transition-all"
            :class="activeStep === index + 1 ? 'border-[#4A90E2] bg-[#4A90E2] text-white' : 'border-white/10 bg-white/5 text-slate-400 hover:border-white/20 hover:text-white'"
            @click="activeStep = index + 1"
          >
            {{ label }}
          </button>
        </div>
      </section>

      <div class="mt-8 grid grid-cols-1 gap-8 xl:grid-cols-[1.7fr_0.9fr]">
        <section class="space-y-6">
          <div v-if="activeStep === 1" class="rounded-[28px] border border-white/10 bg-white/5 p-6 md:p-8">
            <div class="mb-6 flex items-center justify-between gap-4">
              <div>
                <h2 class="text-2xl font-extrabold">1. Направление обучения</h2>
                <p class="mt-2 max-w-2xl text-sm leading-relaxed text-slate-300">
                  Здесь пользователь видит, для чего нужна программа, что она закрывает и сколько вариантов может появиться.
                </p>
              </div>
              <div class="hidden rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-right md:block">
                <div class="text-[10px] uppercase tracking-[0.22em] text-slate-500">Estimated</div>
                <div class="text-2xl font-black">{{ currentDirection.estimatedPrograms }}</div>
              </div>
            </div>

            <div class="grid gap-4 md:grid-cols-2">
              <button
                v-for="option in PROGRAM_SELECTION_STEPS.directions"
                :key="option.id"
                class="rounded-2xl border p-5 text-left transition-all"
                :class="selection.direction === option.id ? 'border-[#4A90E2] bg-[#0f2240]' : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/8'"
                @click="setDirection(option.id)"
              >
                <div class="flex items-start justify-between gap-4">
                  <div>
                    <div class="text-lg font-bold">{{ option.title }}</div>
                    <div class="mt-1 text-sm text-slate-300">{{ option.subtitle }}</div>
                    <p class="mt-3 text-sm leading-relaxed text-slate-400">{{ option.description }}</p>
                  </div>
                  <div class="rounded-xl bg-white/5 px-3 py-2 text-right text-xs text-slate-400">
                    <div class="uppercase tracking-[0.18em]">Примерно</div>
                    <div class="mt-1 text-white">{{ option.estimatedPrograms }}</div>
                  </div>
                </div>
                <div class="mt-4 grid gap-3 md:grid-cols-2">
                  <div class="rounded-xl bg-black/20 p-3">
                    <div class="text-[10px] uppercase tracking-[0.22em] text-slate-500">Для кого</div>
                    <div class="mt-1 text-sm text-slate-200">{{ option.fit }}</div>
                  </div>
                  <div class="rounded-xl bg-black/20 p-3">
                    <div class="text-[10px] uppercase tracking-[0.22em] text-slate-500">Документы</div>
                    <div class="mt-1 text-sm text-slate-200">{{ option.docs.join(' · ') }}</div>
                  </div>
                </div>
              </button>
            </div>
          </div>

          <div v-else-if="activeStep === 2" class="rounded-[28px] border border-white/10 bg-white/5 p-6 md:p-8">
            <div class="mb-6 flex items-center justify-between gap-4">
              <div>
                <h2 class="text-2xl font-extrabold">2. Отрасль</h2>
                <p class="mt-2 text-sm leading-relaxed text-slate-300">
                  Здесь важны условия площадки, тип оборудования и набор обязательных ограничений.
                </p>
              </div>
              <div class="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-right">
                <div class="text-[10px] uppercase tracking-[0.22em] text-slate-500">Сейчас выбрано</div>
                <div class="text-base font-bold">{{ currentIndustry.title }}</div>
              </div>
            </div>

            <div class="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
              <div class="grid gap-3 md:grid-cols-2">
                <button
                  v-for="option in PROGRAM_SELECTION_STEPS.industries"
                  :key="option.id"
                  class="rounded-2xl border p-4 text-left transition-all"
                  :class="selection.industry === option.id ? 'border-[#4A90E2] bg-[#0f2240]' : 'border-white/10 bg-white/5 hover:border-white/20'"
                  @click="setIndustry(option.id)"
                >
                  <div class="flex items-start justify-between gap-3">
                    <div>
                      <div class="text-lg font-bold">{{ option.title }}</div>
                      <p class="mt-2 text-sm leading-relaxed text-slate-300">{{ option.description }}</p>
                    </div>
                    <span class="rounded-full bg-white/5 px-3 py-1 text-xs text-slate-400">{{ option.estimatedPrograms }}</span>
                  </div>
                </button>
              </div>

              <div class="rounded-2xl border border-white/10 bg-black/20 p-5">
                <div class="text-[10px] uppercase tracking-[0.24em] text-slate-500">Information scent</div>
                <h3 class="mt-3 text-xl font-bold">{{ currentIndustry.title }}</h3>
                <p class="mt-3 text-sm leading-relaxed text-slate-300">{{ currentIndustry.example }}</p>
                <div class="mt-5 space-y-3">
                  <div class="text-sm font-semibold text-white">Что обычно всплывает в подборе</div>
                  <div class="flex flex-wrap gap-2">
                    <span
                      v-for="item in industryHazards"
                      :key="item"
                      class="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300"
                    >
                      {{ item }}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div v-else-if="activeStep === 3" class="rounded-[28px] border border-white/10 bg-white/5 p-6 md:p-8">
            <div class="mb-6">
              <h2 class="text-2xl font-extrabold">3. Тип слушателя / уровень</h2>
              <p class="mt-2 max-w-2xl text-sm leading-relaxed text-slate-300">
                На этом шаге показываем, кому именно подходит программа и какие обязанности обычно закреплены.
              </p>
            </div>

            <div class="space-y-3">
              <label
                v-for="option in PROGRAM_SELECTION_STEPS.audiences"
                :key="option.id"
                class="flex cursor-pointer items-start gap-4 rounded-2xl border p-4 transition-all"
                :class="selection.audience === option.id ? 'border-[#4A90E2] bg-[#0f2240]' : 'border-white/10 bg-white/5 hover:border-white/20'"
              >
                <input
                  class="mt-1 h-4 w-4 rounded-full border-white/20 bg-transparent text-[#4A90E2] focus:ring-[#4A90E2]"
                  type="radio"
                  name="audience"
                  :checked="selection.audience === option.id"
                  @change="setAudience(option.id)"
                >
                <div class="flex-1">
                  <div class="flex flex-wrap items-center gap-3">
                    <div class="text-lg font-bold">{{ option.title }}</div>
                    <span class="rounded-full bg-white/5 px-3 py-1 text-[10px] uppercase tracking-[0.22em] text-slate-400">
                      {{ option.estimatedPrograms }}
                    </span>
                  </div>
                  <p class="mt-2 text-sm leading-relaxed text-slate-300">{{ option.description }}</p>
                  <div class="mt-3 flex flex-wrap gap-2">
                    <span
                      v-for="item in option.responsibilities"
                      :key="item"
                      class="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-slate-300"
                    >
                      {{ item }}
                    </span>
                  </div>
                </div>
              </label>
            </div>
          </div>

          <div v-else-if="activeStep === 4" class="rounded-[28px] border border-white/10 bg-white/5 p-6 md:p-8">
            <div class="mb-6">
              <h2 class="text-2xl font-extrabold">4. Специфика / профиль опасности</h2>
              <p class="mt-2 max-w-2xl text-sm leading-relaxed text-slate-300">
                Этот шаг отвечает за узкий риск-профиль, документы и ограничения, которые часто определяют итоговый список программ.
              </p>
            </div>

            <div class="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
              <div class="flex flex-wrap gap-3">
                <button
                  v-for="option in PROGRAM_SELECTION_STEPS.profiles"
                  :key="option.id"
                  class="rounded-full border px-4 py-2 text-sm font-semibold transition-all"
                  :class="selection.specialization === option.id ? 'border-[#4A90E2] bg-[#4A90E2] text-white' : 'border-white/10 bg-white/5 text-slate-300 hover:border-white/20'"
                  @click="setProfile(option.id)"
                >
                  {{ option.title }}
                </button>
              </div>

              <div class="rounded-2xl border border-white/10 bg-black/20 p-5">
                <div class="text-[10px] uppercase tracking-[0.24em] text-slate-500">Выбран профиль</div>
                <h3 class="mt-3 text-xl font-bold">{{ currentProfile.title }}</h3>
                <p class="mt-3 text-sm leading-relaxed text-slate-300">{{ currentProfile.description }}</p>
                <div class="mt-5">
                  <div class="text-sm font-semibold text-white">Документы / контроль</div>
                  <div class="mt-3 flex flex-wrap gap-2">
                    <span
                      v-for="item in profileDocs"
                      :key="item"
                      class="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300"
                    >
                      {{ item }}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div v-else class="rounded-[28px] border border-white/10 bg-white/5 p-6 md:p-8">
            <div class="mb-6">
              <h2 class="text-2xl font-extrabold">5. Review</h2>
              <p class="mt-2 text-sm leading-relaxed text-slate-300">
                Финальный экран показывает, что выбрано, сколько вариантов найдено и какие документы понадобятся дальше.
              </p>
            </div>

            <div class="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
              <div class="space-y-4 rounded-2xl border border-white/10 bg-black/20 p-5">
                <div>
                  <div class="text-[10px] uppercase tracking-[0.24em] text-slate-500">Итоговый подбор</div>
                  <div class="mt-2 text-2xl font-black">{{ review.title }}</div>
                  <p class="mt-2 text-sm leading-relaxed text-slate-300">{{ review.subtitle }}</p>
                </div>
                <div class="grid gap-3 md:grid-cols-2">
                  <div class="rounded-2xl bg-white/5 p-4">
                    <div class="text-[10px] uppercase tracking-[0.22em] text-slate-500">Найдено программ</div>
                    <div class="mt-2 text-3xl font-black">{{ review.estimatedPrograms }}</div>
                  </div>
                  <div class="rounded-2xl bg-white/5 p-4">
                    <div class="text-[10px] uppercase tracking-[0.22em] text-slate-500">Следующий шаг</div>
                    <div class="mt-2 text-base font-bold">{{ review.nextStep }}</div>
                  </div>
                </div>
                <div>
                  <div class="text-sm font-semibold text-white">Что понадобится</div>
                  <div class="mt-3 flex flex-wrap gap-2">
                    <span
                      v-for="item in review.docs"
                      :key="item"
                      class="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300"
                    >
                      {{ item }}
                    </span>
                  </div>
                </div>
              </div>

              <div class="space-y-4 rounded-2xl border border-[#4A90E2]/30 bg-[#0f2240] p-5">
                <div class="text-[10px] uppercase tracking-[0.24em] text-slate-400">Summary</div>
                <div class="text-lg font-bold">{{ currentProgram.title }}</div>
                <div class="text-sm text-slate-300">{{ currentDirection.subtitle }}</div>
                <div class="grid gap-3 pt-3 text-sm">
                  <div class="flex justify-between gap-4">
                    <span class="text-slate-400">Direction</span>
                    <span class="font-semibold text-white">{{ currentDirection.title }}</span>
                  </div>
                  <div class="flex justify-between gap-4">
                    <span class="text-slate-400">Industry</span>
                    <span class="font-semibold text-white">{{ currentIndustry.title }}</span>
                  </div>
                  <div class="flex justify-between gap-4">
                    <span class="text-slate-400">Audience</span>
                    <span class="font-semibold text-white">{{ currentAudience.title }}</span>
                  </div>
                  <div class="flex justify-between gap-4">
                    <span class="text-slate-400">Profile</span>
                    <span class="font-semibold text-white">{{ currentProfile.title }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <aside class="space-y-6 rounded-[28px] border border-white/10 bg-white/5 p-6 md:p-7">
          <div class="rounded-2xl border border-[#4A90E2]/30 bg-[#0f2240] p-5">
            <div class="text-[10px] uppercase tracking-[0.24em] text-slate-400">Current selection</div>
            <div class="mt-3 text-xl font-black">{{ currentProgram.title }}</div>
            <div class="mt-2 text-sm text-slate-300">{{ review.subtitle }}</div>
          </div>

          <div class="space-y-4">
            <div>
              <div class="text-[10px] uppercase tracking-[0.24em] text-slate-500">Direction note</div>
              <p class="mt-2 text-sm leading-relaxed text-slate-300">{{ currentDirection.description }}</p>
            </div>
            <div>
              <div class="text-[10px] uppercase tracking-[0.24em] text-slate-500">Docs</div>
              <p class="mt-2 text-sm leading-relaxed text-slate-300">{{ directionDocs.join(' · ') }}</p>
            </div>
            <div>
              <div class="text-[10px] uppercase tracking-[0.24em] text-slate-500">Risk focus</div>
              <p class="mt-2 text-sm leading-relaxed text-slate-300">{{ industryHazards.join(' · ') }}</p>
            </div>
            <div>
              <div class="text-[10px] uppercase tracking-[0.24em] text-slate-500">Audience</div>
              <p class="mt-2 text-sm leading-relaxed text-slate-300">{{ audienceResponsibilities.join(' · ') }}</p>
            </div>
          </div>

          <div class="space-y-3 border-t border-white/10 pt-4">
            <button
              class="w-full rounded-xl bg-[#4A90E2] px-4 py-3 text-sm font-bold text-white transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
              :disabled="!stepCanContinue"
              @click="goNext"
            >
              {{ activeStep === 5 ? 'Открыть программу' : 'Продолжить' }}
            </button>
            <button
              class="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-200 transition-colors hover:border-white/20 hover:bg-white/10"
              @click="goBack"
            >
              {{ activeStep === 1 ? 'Вернуться на главную' : 'Назад' }}
            </button>
            <button
              class="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm font-semibold text-slate-200 transition-colors hover:border-white/20 hover:bg-black/30"
              @click="openCatalog"
            >
              В каталог
            </button>
            <button
              class="w-full rounded-xl border border-[#4A90E2]/40 bg-[#0f2240] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#112a52]"
              @click="openProgram"
            >
              На рекомендованную программу
            </button>
          </div>
        </aside>
      </div>
    </main>
  </div>
</template>
