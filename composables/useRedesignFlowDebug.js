const DEBUG_PREFIX = '[redesign-flow]';

export const summarizeLearningState = (learningState = {}) => ({
  activeModuleId: learningState.activeModuleId || null,
  activeSectionId: learningState.activeSectionId || null,
  completedModuleIds: Array.isArray(learningState.completedModuleIds) ? [...learningState.completedModuleIds] : [],
  completedSectionIds: Array.isArray(learningState.completedSectionIds) ? [...learningState.completedSectionIds] : [],
  acknowledged: Boolean(learningState.acknowledged),
});

export const summarizeCompletionState = (completionState = {}) => ({
  allRequiredCompleted: Boolean(completionState.allRequiredCompleted),
  completedModuleIds: Array.isArray(completionState.completedModuleIds) ? [...completionState.completedModuleIds] : [],
  completedSectionIds: Array.isArray(completionState.completedSectionIds) ? [...completionState.completedSectionIds] : [],
  completedRequiredSections: completionState.completedRequiredSections ?? null,
  totalRequiredSections: completionState.totalRequiredSections ?? null,
});

export const logRedesignFlow = (scope, event, payload = {}) => {
  console.info(`${DEBUG_PREFIX} ${scope}:${event}`, {
    timestamp: new Date().toISOString(),
    ...payload,
  });
};
