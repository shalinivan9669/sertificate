<script setup>
import { computed } from 'vue';
import ConfirmCompletedModules from '~/components/redesign-flow/confirm/ConfirmCompletedModules.vue';
import { getRuntimeFlowFixture } from '~/composables/useRedesignRuntimeMock';

definePageMeta({ layout: 'fullwidth' });

const route = useRoute();
const { paths, flow, syncCourseId } = useRedesignRoutes();

const courseId = computed(() => (Array.isArray(route.params.id) ? route.params.id[0] : route.params.id));
const runtime = computed(() => getRuntimeFlowFixture(courseId.value));
const learningFixture = computed(() => runtime.value.learningExperience);

syncCourseId();

const learningState = computed(() => flow.flow.value.learning || {});
const requiredModuleIds = computed(() => runtime.value.learningExperience.requiredModuleIds);
const requiredSections = computed(() =>
  learningFixture.value.modules
    .filter((module) => requiredModuleIds.value.includes(module.id))
    .flatMap((module) => module.sections || []),
);
const forcedFromLearning = computed(() => route.query.fromLearning === '1');
const completedModuleIds = computed(() => learningState.value.completedModuleIds || []);
const completedSectionIds = computed(() => learningState.value.completedSectionIds || []);
const completedRequiredModuleIds = computed(() => {
  const completedIds = new Set(completedModuleIds.value);

  learningFixture.value.modules.forEach((module) => {
    if (!requiredModuleIds.value.includes(module.id) || !module.sections?.length) {
      return;
    }

    if (module.sections.every((section) => completedSectionIds.value.includes(section.id))) {
      completedIds.add(module.id);
    }
  });

  return Array.from(completedIds);
});
const completedModulesSynced = computed(
  () =>
    completedRequiredModuleIds.value.length === completedModuleIds.value.length &&
    completedRequiredModuleIds.value.every((moduleId) => completedModuleIds.value.includes(moduleId)),
);
const effectiveCompletedSectionIds = computed(() =>
  forcedFromLearning.value
    ? [...new Set([...completedSectionIds.value, ...requiredSections.value.map((section) => section.id)])]
    : completedSectionIds.value,
);
const effectiveCompletedModuleIds = computed(() =>
  forcedFromLearning.value
    ? [...new Set([...completedRequiredModuleIds.value, ...requiredModuleIds.value])]
    : completedRequiredModuleIds.value,
);
const allModulesCompleted = computed(() =>
  requiredModuleIds.value.every((moduleId) => effectiveCompletedModuleIds.value.includes(moduleId)),
);

if (!completedModulesSynced.value) {
  flow.patchFlow({
    learning: {
      ...learningState.value,
      completedModuleIds: completedRequiredModuleIds.value,
      completedSectionIds: completedSectionIds.value,
    },
  });
}

const acknowledged = computed({
  get: () => Boolean(learningState.value.acknowledged),
  set: (value) => {
    flow.patchFlow({
      stage: 'confirm',
      learning: {
        ...learningState.value,
        acknowledged: value,
      },
      overview: {
        ...(flow.flow.value.overview || {}),
        currentStep: 'confirm',
        progress: 100,
      },
    });
  },
});

const canContinue = computed(() => allModulesCompleted.value && acknowledged.value);

flow.patchFlow({
  stage: 'confirm',
  learning: {
    ...learningState.value,
    completedModuleIds: effectiveCompletedModuleIds.value,
    completedSectionIds: effectiveCompletedSectionIds.value,
  },
  overview: {
    ...(flow.flow.value.overview || {}),
    currentStep: 'confirm',
    progress: 100,
  },
});

const goToPretest = () => {
  if (!canContinue.value) {
    return;
  }

  navigateTo(paths.value.pretest);
};

const backToLearning = () => navigateTo(paths.value.learning);
</script>

<template>
  <div class="min-h-screen bg-surface font-body text-on-surface">
    <main class="flex min-h-screen flex-grow items-center justify-center p-4 md:p-8">
      <div class="w-full max-w-2xl overflow-hidden rounded-lg border border-outline-variant/10 bg-surface-container-lowest shadow-[0_40px_40px_rgba(10,25,47,0.06)]">
        <div class="industrial-gradient relative overflow-hidden p-8 text-white">
          <div class="absolute right-0 top-0 p-4 opacity-10">
            <span class="material-symbols-outlined text-9xl">task_alt</span>
          </div>
          <div class="relative z-10">
            <div class="mb-4 flex items-center gap-3">
              <div class="h-1 w-12 bg-[#4A90E2]"></div>
              <span class="font-label text-xs font-semibold uppercase tracking-widest text-secondary-container">INDUSTRIAL COMPLIANCE</span>
            </div>
            <h1 class="font-headline text-3xl font-extrabold leading-tight tracking-tight md:text-4xl">
              {{ runtime.confirm.title }}
            </h1>
          </div>
        </div>

        <div class="p-8 md:p-10">
          <p class="mb-8 font-medium leading-relaxed text-on-surface-variant">
            {{ runtime.confirm.description }}
          </p>

          <ConfirmCompletedModules :modules="runtime.confirm.completedModules" />

          <div class="space-y-6 border-t border-outline-variant/20 pt-8">
            <div class="border-l-4 border-error bg-error-container/10 p-4">
              <div class="flex gap-3">
                <span class="material-symbols-outlined text-error">gavel</span>
                <p class="text-xs leading-relaxed text-on-surface-variant">
                  <span class="font-bold text-on-surface">Юридическое уведомление:</span>
                  {{ runtime.confirm.legalNotice }}
                </p>
              </div>
            </div>

            <label class="group flex cursor-pointer items-start gap-3">
              <div class="relative mt-1 flex items-center">
                <input v-model="acknowledged" type="checkbox" class="peer h-5 w-5 rounded border-outline-variant bg-surface-container-highest text-secondary transition-all focus:ring-secondary/30">
              </div>
              <span class="select-none text-sm font-semibold text-on-surface">
                С материалами ознакомлен(а) и готов(а) к тестированию
              </span>
            </label>
          </div>

          <div class="mt-10 flex flex-col gap-4 sm:flex-row">
            <button
              class="industrial-gradient flex flex-1 items-center justify-center gap-2 rounded-md px-6 py-4 font-bold tracking-wide text-white shadow-lg shadow-[#0A192F]/20 transition-all hover:opacity-90 active:scale-95 disabled:pointer-events-none disabled:opacity-50"
              :disabled="!canContinue"
              type="button"
              @click="goToPretest"
            >
              <span>Перейти к тестированию</span>
              <span class="material-symbols-outlined">arrow_forward</span>
            </button>
            <button
              class="flex flex-1 items-center justify-center gap-2 rounded-md border border-outline-variant/30 bg-surface-container-high px-6 py-4 font-bold tracking-wide text-on-surface-variant transition-colors hover:bg-surface-container-highest"
              type="button"
              @click="backToLearning"
            >
              <span class="material-symbols-outlined">menu_book</span>
              <span>Вернуться к модулям</span>
            </button>
          </div>
        </div>

        <div class="flex flex-col items-center justify-between bg-surface-container-low px-8 py-4 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant sm:flex-row">
          <div class="flex items-center gap-2">
            <span class="material-symbols-outlined text-sm">verified</span>
            <span>ID ПРОТОКОЛА: {{ runtime.confirm.protocolId }}</span>
          </div>
          <div class="mt-2 sm:mt-0">
            {{ runtime.confirm.systemLabel }}
          </div>
        </div>
      </div>
    </main>
  </div>
</template>
