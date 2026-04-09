<script setup>
import { computed, watch } from 'vue';
import LearningArticle from '~/components/redesign-flow/learning/LearningArticle.vue';
import LearningFooterBar from '~/components/redesign-flow/learning/LearningFooterBar.vue';
import LearningSidebar from '~/components/redesign-flow/learning/LearningSidebar.vue';
import LearningTopBar from '~/components/redesign-flow/learning/LearningTopBar.vue';
import {
  logRedesignFlow,
  summarizeCompletionState,
  summarizeLearningState,
} from '~/composables/useRedesignFlowDebug';
import {
  countCompletedRequiredSections,
  getLearningCompletionState,
} from '~/composables/useRedesignLearningProgress';
import { getRuntimeFlowFixture } from '~/composables/useRedesignRuntimeMock';

definePageMeta({ layout: 'fullwidth' });

const route = useRoute();
const { paths, flow, syncCourseId } = useRedesignRoutes();

const courseId = computed(() => (Array.isArray(route.params.id) ? route.params.id[0] : route.params.id));
const runtime = computed(() => getRuntimeFlowFixture(courseId.value));
const learningFixture = computed(() => runtime.value.learningExperience);
const logLearning = (event, payload = {}) =>
  logRedesignFlow('learning-page', event, {
    courseId: courseId.value,
    path: route.fullPath,
    ...payload,
  });

syncCourseId();

const getLearningProgress = (sectionIds = []) => {
  const completedCount = countCompletedRequiredSections(learningFixture.value, sectionIds);
  const initialCount = learningFixture.value.initialCompletedSectionIds.length;
  const totalCount = learningFixture.value.modules
    .filter((module) => learningFixture.value.requiredModuleIds.includes(module.id))
    .reduce((total, module) => total + module.sections.length, 0);

  if (completedCount <= initialCount) {
    return learningFixture.value.progressStart;
  }

  const ratio = (completedCount - initialCount) / Math.max(totalCount - initialCount, 1);
  return Math.min(100, Math.round(learningFixture.value.progressStart + ratio * (100 - learningFixture.value.progressStart)));
};

const ensureLearningState = () => {
  const currentLearning = flow.flow.value.learning || {};
  const completedModuleIds =
    Array.isArray(currentLearning.completedModuleIds) && currentLearning.completedModuleIds.length
      ? currentLearning.completedModuleIds
      : [...learningFixture.value.initialCompletedModuleIds];
  const completedSectionIds =
    Array.isArray(currentLearning.completedSectionIds) && currentLearning.completedSectionIds.length
      ? currentLearning.completedSectionIds
      : [...learningFixture.value.initialCompletedSectionIds];

  flow.patchFlow({
    stage: 'learning',
    learning: {
      activeModuleId: currentLearning.activeModuleId || learningFixture.value.initialActiveModuleId,
      activeSectionId: currentLearning.activeSectionId || learningFixture.value.initialActiveSectionId,
      completedModuleIds,
      completedSectionIds,
      acknowledged: Boolean(currentLearning.acknowledged),
    },
    overview: {
      ...(flow.flow.value.overview || {}),
      currentStep: 'learning',
      progress: getLearningProgress(completedSectionIds),
    },
  });

  logLearning('ensure-learning-state', {
    learning: summarizeLearningState({
      ...currentLearning,
      completedModuleIds,
      completedSectionIds,
    }),
  });
};

ensureLearningState();

const learningState = computed(() => flow.flow.value.learning || {});
const activeModuleId = computed(() => learningState.value.activeModuleId || learningFixture.value.initialActiveModuleId);
const activeSectionId = computed(() => learningState.value.activeSectionId || learningFixture.value.initialActiveSectionId);
const completedModuleIds = computed(() => learningState.value.completedModuleIds || []);
const completedSectionIds = computed(() => learningState.value.completedSectionIds || []);

const requiredModules = computed(() =>
  learningFixture.value.modules.filter((module) => learningFixture.value.requiredModuleIds.includes(module.id)),
);

const sectionSequence = computed(() =>
  requiredModules.value.flatMap((module) =>
    module.sections.map((section) => ({
      moduleId: module.id,
      sectionId: section.id,
    })),
  ),
);

const activeModule = computed(
  () =>
    learningFixture.value.modules.find((module) => module.id === activeModuleId.value) ||
    learningFixture.value.modules[0],
);

const activeSection = computed(
  () =>
    activeModule.value.sections.find((section) => section.id === activeSectionId.value) ||
    activeModule.value.sections[0],
);

const breadcrumbModuleTitle = computed(() => {
  const moduleNumber = activeModule.value.navTitle.match(/\d+/)?.[0] || '01';
  return `Module ${moduleNumber.padStart(2, '0')}`;
});

const breadcrumbSectionTitle = computed(() => {
  const sectionNumber = activeSection.value.navTitle.match(/^\d+\.\d+/)?.[0] || activeSection.value.navTitle;
  return `Section ${sectionNumber}`;
});

const activeSequenceIndex = computed(() =>
  sectionSequence.value.findIndex((item) => item.moduleId === activeModuleId.value && item.sectionId === activeSectionId.value),
);

const learningCompletionState = computed(() =>
  getLearningCompletionState(learningFixture.value, learningState.value),
);
const projectedLearningCompletionState = computed(() =>
  getLearningCompletionState(learningFixture.value, learningState.value, { includeActiveSection: true }),
);
const progressText = computed(() => `${getLearningProgress(completedSectionIds.value)}%`);
const allRequiredSectionsCompleted = computed(() => learningCompletionState.value.allRequiredCompleted);
const projectedCompletedModuleIds = computed(() => new Set(projectedLearningCompletionState.value.completedModuleIds));
const isLastRequiredSection = computed(() => activeSequenceIndex.value === sectionSequence.value.length - 1);
const nextButtonLabel = computed(() =>
  allRequiredSectionsCompleted.value || isLastRequiredSection.value
    ? 'Proceed to Test'
    : 'Next Section',
);
const forcedPretestPath = computed(() => `${paths.value.pretest}?fromLearning=1`);

watch(
  () => route.fullPath,
  (nextPath, previousPath) => {
    logLearning('route-changed', {
      from: previousPath || null,
      to: nextPath,
      stage: flow.flow.value.stage,
    });
  },
  { immediate: true },
);

const goToPretest = async (completionState = projectedLearningCompletionState.value) => {
  logLearning('go-to-pretest:start', {
    target: forcedPretestPath.value,
    learning: summarizeLearningState(learningState.value),
    completion: summarizeCompletionState(completionState),
  });

  flow.patchFlow({
    stage: 'pretest',
    learning: {
      ...learningState.value,
      activeModuleId: activeModule.value.id,
      activeSectionId: activeSection.value.id,
      completedModuleIds: completionState.completedModuleIds,
      completedSectionIds: completionState.completedSectionIds,
      acknowledged: Boolean(learningState.value.acknowledged),
    },
    overview: {
      ...(flow.flow.value.overview || {}),
      currentStep: 'pretest',
      progress: 100,
    },
  });

  logLearning('go-to-pretest:patched-flow', {
    stage: flow.flow.value.stage,
    learning: summarizeLearningState(flow.flow.value.learning || {}),
  });

  try {
    const navigationResult = await navigateTo(forcedPretestPath.value);
    logLearning('go-to-pretest:navigate-resolved', {
      target: forcedPretestPath.value,
      navigationResult: navigationResult ?? null,
    });
  } catch (error) {
    console.error('[redesign-flow] learning-page:go-to-pretest:error', error);
    throw error;
  }
};

const moduleCards = computed(() =>
  learningFixture.value.modules.map((module, index, items) => {
    const previousModule = items[index - 1];
    const previousCompleted = !previousModule || projectedCompletedModuleIds.value.has(previousModule.id);
    const state = module.examEntry
      ? projectedLearningCompletionState.value.allRequiredCompleted
        ? 'available'
        : 'locked'
      : learningCompletionState.value.completedModuleIds.includes(module.id)
        ? 'completed'
        : activeModuleId.value === module.id
          ? 'active'
          : previousCompleted
            ? 'available'
            : 'locked';

    return {
      ...module,
      state,
      sections: module.sections.map((section) => ({
        ...section,
        active: module.id === activeModuleId.value && section.id === activeSectionId.value,
      })),
    };
  }),
);

const patchLearning = (updates) => {
  const nextLearning = {
    ...learningState.value,
    ...updates,
  };

  flow.patchFlow({
    learning: nextLearning,
    overview: {
      ...(flow.flow.value.overview || {}),
      currentStep: 'learning',
      progress: getLearningProgress(nextLearning.completedSectionIds || []),
    },
  });

  logLearning('patch-learning', {
    updates,
    nextLearning: summarizeLearningState(nextLearning),
  });
};

const moveToLocation = (moduleId, sectionId, completionState = null) => {
  patchLearning({
    activeModuleId: moduleId,
    activeSectionId: sectionId,
    ...(completionState
      ? {
          completedModuleIds: completionState.completedModuleIds,
          completedSectionIds: completionState.completedSectionIds,
        }
      : {}),
  });
};

const openModule = async (moduleId) => {
  const targetModule = learningFixture.value.modules.find((module) => module.id === moduleId);
  if (!targetModule) {
    logLearning('open-module:missing-target', { moduleId });
    return;
  }

  if (targetModule.id === activeModuleId.value) {
    logLearning('open-module:already-active', { moduleId });
    return;
  }

  const completionState = projectedLearningCompletionState.value;
  logLearning('open-module', {
    moduleId,
    examEntry: Boolean(targetModule.examEntry),
    completion: summarizeCompletionState(completionState),
  });

  if (targetModule.examEntry) {
    if (completionState.allRequiredCompleted) {
      await goToPretest(completionState);
    } else {
      logLearning('open-module:blocked-exam-entry', {
        moduleId,
        completion: summarizeCompletionState(completionState),
      });
    }
    return;
  }

  if (!targetModule.sections?.length) {
    return;
  }

  const firstIncompleteSection = targetModule.sections.find(
    (section) => !completionState.completedSectionIds.includes(section.id),
  );
  moveToLocation(moduleId, (firstIncompleteSection || targetModule.sections[0]).id, completionState);
};

const openSection = ({ moduleId, sectionId }) => {
  if (moduleId === activeModuleId.value && sectionId === activeSectionId.value) {
    logLearning('open-section:already-active', { moduleId, sectionId });
    return;
  }

  logLearning('open-section', {
    moduleId,
    sectionId,
    completion: summarizeCompletionState(projectedLearningCompletionState.value),
  });
  moveToLocation(moduleId, sectionId, projectedLearningCompletionState.value);
};

const goBack = () => {
  const currentIndex = activeSequenceIndex.value;
  if (currentIndex > 0) {
    const previous = sectionSequence.value[currentIndex - 1];
    logLearning('go-back:previous-section', {
      currentIndex,
      previous,
    });
    moveToLocation(previous.moduleId, previous.sectionId, projectedLearningCompletionState.value);
    return;
  }

  logLearning('go-back:course-page');
  navigateTo(paths.value.course);
};

const saveAndExit = () => navigateTo(paths.value.cabinet);

const goNext = async () => {
  const completionState = projectedLearningCompletionState.value;
  const currentIndex = activeSequenceIndex.value;

  logLearning('go-next', {
    currentIndex,
    activeModuleId: activeModuleId.value,
    activeSectionId: activeSectionId.value,
    completion: summarizeCompletionState(completionState),
  });

  if (completionState.allRequiredCompleted || currentIndex === sectionSequence.value.length - 1 || currentIndex === -1) {
    await goToPretest(completionState);
    return;
  }

  const nextStep = sectionSequence.value[currentIndex + 1];
  patchLearning({
    activeModuleId: nextStep.moduleId,
    activeSectionId: nextStep.sectionId,
    completedModuleIds: completionState.completedModuleIds,
    completedSectionIds: completionState.completedSectionIds,
  });
};
</script>

<template>
  <div class="flex h-screen flex-col overflow-hidden bg-surface text-on-surface">
    <LearningTopBar
      :course-title="runtime.runtime.currentCourseTitle"
      :participant-meta="`Safety Inspector ID: ${runtime.runtime.participant.inspectorId}`"
      :participant-name="runtime.runtime.participant.profileName"
      :progress-text="progressText"
    />

    <div class="flex flex-1 overflow-hidden">
      <LearningSidebar
        :pretest-to="forcedPretestPath"
        :modules="moduleCards"
        @open-module="openModule"
        @open-section="openSection"
      />

      <LearningArticle
        :module-title="breadcrumbModuleTitle"
        :root-breadcrumb="learningFixture.rootBreadcrumb"
        :section="activeSection"
        :section-title="breadcrumbSectionTitle"
      />
    </div>

    <LearningFooterBar
      :can-go-back="true"
      :next-label="nextButtonLabel"
      @back="goBack"
      @next="goNext"
      @save="saveAndExit"
    />
  </div>
</template>
