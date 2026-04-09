<script setup>
import { computed, watch } from 'vue';
import { buildProgramSelectionQuery, getProgramFixture, getSelectionPresetFromQuery } from '~/composables/useProgramFlowMock';
import { getRuntimeFlowFixture } from '~/composables/useRedesignRuntimeMock';

definePageMeta({ layout: 'fullwidth' });

const route = useRoute();
const { paths, syncCourseId, patchSelection, selection, flow } = useRedesignRoutes();

const courseId = computed(() => (Array.isArray(route.params.id) ? route.params.id[0] : route.params.id));
const program = computed(() => getProgramFixture(courseId.value));
const runtime = computed(() => getRuntimeFlowFixture(courseId.value));
const preset = computed(() => getSelectionPresetFromQuery(route.query));

syncCourseId();

watch(
  preset,
  (value) => {
    patchSelection({
      courseId: value.courseId,
      direction: value.direction,
      industry: value.industry,
      audience: value.audience,
      specialization: value.specialization,
      source: value.source,
      slug: value.slug,
      city: value.city,
    });
    flow.patchFlow({
      stage: 'course',
      branch: 'browse',
      overview: {
        ...(flow.flow.value.overview || {}),
        currentStep: 'course',
        progress: program.value.progress,
      },
    });
  },
  { immediate: true },
);

const learningQuery = computed(() =>
  buildProgramSelectionQuery({
    ...selection.value,
    courseId: program.value.courseId,
  }),
);

const startLearning = () => {
  flow.patchFlow({
    stage: 'learning',
    branch: 'browse',
    learning: {
      activeModuleId: runtime.value.learningExperience.initialActiveModuleId,
      activeSectionId: runtime.value.learningExperience.initialActiveSectionId,
      completedModuleIds: [...runtime.value.learningExperience.initialCompletedModuleIds],
      completedSectionIds: [...runtime.value.learningExperience.initialCompletedSectionIds],
      acknowledged: false,
    },
    overview: {
      ...(flow.flow.value.overview || {}),
      currentStep: 'learning',
      progress: runtime.value.learningExperience.progressStart,
    },
  });

  navigateTo({
    path: paths.value.learning,
    query: learningQuery.value,
  });
};

const goBack = () => {
  navigateTo({
    path: paths.value.programSelection,
    query: buildProgramSelectionQuery({
      ...selection.value,
      courseId: program.value.courseId,
    }),
  });
};
</script>

<template>
  <div class="min-h-screen bg-[#06101d] text-white">
    <header class="sticky top-0 z-40 border-b border-white/5 bg-[#081527]/95 backdrop-blur">
      <div class="mx-auto flex max-w-screen-2xl items-center justify-between gap-4 px-6 py-4 md:px-8">
        <div>
          <div class="text-2xl font-extrabold tracking-tighter">Sertificat.kz</div>
          <div class="text-[10px] uppercase tracking-[0.24em] text-slate-400">General program page</div>
        </div>
        <div class="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">
          {{ program.title }}
        </div>
      </div>
    </header>

    <main class="mx-auto max-w-screen-2xl px-6 py-8 md:px-8 md:py-10">
      <section class="rounded-[28px] border border-white/10 bg-[linear-gradient(135deg,#0a192f_0%,#102544_50%,#17345a_100%)] p-6 shadow-[0_30px_80px_rgba(0,0,0,0.28)] md:p-8">
        <div class="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div class="max-w-3xl">
            <div class="mb-4 inline-flex rounded-full border border-white/10 bg-white/5 px-4 py-1 text-[10px] font-bold uppercase tracking-[0.24em] text-slate-300">
              Program overview
            </div>
            <h1 class="text-4xl font-extrabold leading-tight md:text-5xl">
              {{ program.title }}
            </h1>
            <p class="mt-4 max-w-2xl text-base leading-relaxed text-slate-300 md:text-lg">
              {{ program.subtitle }}
            </p>
          </div>

          <div class="grid min-w-[280px] gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
            <div class="flex items-center justify-between gap-4">
              <span class="uppercase tracking-[0.2em] text-slate-500">Duration</span>
              <span class="text-white font-bold">{{ program.durationHours }}h</span>
            </div>
            <div class="flex items-center justify-between gap-4">
              <span class="uppercase tracking-[0.2em] text-slate-500">Price</span>
              <span class="text-white font-bold">{{ program.price }}</span>
            </div>
            <div class="flex items-center justify-between gap-4">
              <span class="uppercase tracking-[0.2em] text-slate-500">Modules</span>
              <span class="text-white font-bold">{{ program.modules.length }}</span>
            </div>
            <div class="flex items-center justify-between gap-4">
              <span class="uppercase tracking-[0.2em] text-slate-500">Progress</span>
              <span class="text-white font-bold">{{ program.progress }}%</span>
            </div>
          </div>
        </div>
      </section>

      <div class="mt-8 grid grid-cols-1 gap-8 xl:grid-cols-[1.4fr_0.9fr]">
        <section class="space-y-6">
          <div class="rounded-[28px] border border-white/10 bg-white/5 p-6 md:p-8">
            <div class="grid gap-4 md:grid-cols-2">
              <div class="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div class="text-[10px] uppercase tracking-[0.24em] text-slate-500">Who it is for</div>
                <p class="mt-2 text-sm leading-relaxed text-slate-300">
                  {{ program.docs.join(' · ') }}
                </p>
              </div>
              <div class="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div class="text-[10px] uppercase tracking-[0.24em] text-slate-500">Next step</div>
                <p class="mt-2 text-sm leading-relaxed text-slate-300">
                  После этого экрана flow уходит в learning/runtime и далее в confirm, pre-test, exam и payment branch.
                </p>
              </div>
            </div>
          </div>

          <div class="grid gap-4 md:grid-cols-3">
            <div
              v-for="module in program.modules"
              :key="module.id"
              class="rounded-2xl border border-white/10 bg-white/5 p-4"
            >
              <div class="text-[10px] uppercase tracking-[0.22em] text-slate-500">{{ module.duration }}</div>
              <div class="mt-2 text-base font-bold">{{ module.title }}</div>
              <p class="mt-3 text-sm leading-relaxed text-slate-300">{{ module.shortDescription }}</p>
            </div>
          </div>
        </section>

        <aside class="space-y-6 rounded-[28px] border border-white/10 bg-white/5 p-6 md:p-7">
          <div class="rounded-2xl border border-[#4A90E2]/30 bg-[#0f2240] p-5">
            <div class="text-[10px] uppercase tracking-[0.24em] text-slate-400">Selection context</div>
            <div class="mt-3 text-xl font-black">{{ selection.direction }}</div>
            <div class="mt-2 text-sm text-slate-300">{{ selection.industry }} · {{ selection.audience }}</div>
          </div>

          <div class="space-y-3">
            <button
              class="w-full rounded-xl bg-[#4A90E2] px-4 py-3 text-sm font-bold text-white transition-all hover:brightness-110"
              @click="startLearning"
            >
              Start Learning
            </button>
            <button
              class="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-200 transition-colors hover:border-white/20 hover:bg-white/10"
              @click="goBack"
            >
              Back to selection
            </button>
          </div>

          <div class="rounded-2xl border border-white/10 bg-black/20 p-5 text-sm text-slate-300">
            <div class="text-[10px] uppercase tracking-[0.24em] text-slate-500">Flow route</div>
            <div class="mt-2 font-semibold text-white">{{ paths.learning }}</div>
            <p class="mt-2 leading-relaxed">
              Это переходная страница. Она не заканчивает runtime, а только открывает обучение.
            </p>
          </div>
        </aside>
      </div>
    </main>
  </div>
</template>
