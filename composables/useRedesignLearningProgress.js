const asArray = (value) => (Array.isArray(value) ? value : []);

export const getRequiredLearningModules = (learningExperience = {}) => {
  const requiredModuleIds = new Set(asArray(learningExperience.requiredModuleIds));

  return asArray(learningExperience.modules).filter((module) => requiredModuleIds.has(module.id));
};

export const getRequiredLearningSectionCount = (learningExperience = {}) =>
  getRequiredLearningModules(learningExperience).reduce(
    (total, module) => total + asArray(module.sections).length,
    0,
  );

export const countCompletedRequiredSections = (learningExperience = {}, sectionIds = []) => {
  const completedSectionIds = new Set(asArray(sectionIds));

  return getRequiredLearningModules(learningExperience).reduce(
    (total, module) =>
      total + asArray(module.sections).filter((section) => completedSectionIds.has(section.id)).length,
    0,
  );
};

export const getCompletedRequiredModuleIds = (
  learningExperience = {},
  sectionIds = [],
  existingModuleIds = [],
) => {
  const completedSectionIds = new Set(asArray(sectionIds));
  const completedModuleIds = new Set(asArray(existingModuleIds));

  getRequiredLearningModules(learningExperience).forEach((module) => {
    const sections = asArray(module.sections);

    if (sections.length > 0 && sections.every((section) => completedSectionIds.has(section.id))) {
      completedModuleIds.add(module.id);
    }
  });

  return Array.from(completedModuleIds);
};

export const getLearningCompletionState = (
  learningExperience = {},
  learningState = {},
  options = {},
) => {
  const completedSectionIds = new Set(asArray(learningState.completedSectionIds));

  if (options.includeActiveSection && learningState.activeSectionId) {
    completedSectionIds.add(learningState.activeSectionId);
  }

  const effectiveCompletedSectionIds = Array.from(completedSectionIds);
  const completedRequiredSections = countCompletedRequiredSections(
    learningExperience,
    effectiveCompletedSectionIds,
  );
  const totalRequiredSections = getRequiredLearningSectionCount(learningExperience);
  const effectiveCompletedModuleIds = getCompletedRequiredModuleIds(
    learningExperience,
    effectiveCompletedSectionIds,
    learningState.completedModuleIds,
  );

  return {
    allRequiredCompleted: completedRequiredSections >= totalRequiredSections,
    completedModuleIds: effectiveCompletedModuleIds,
    completedRequiredSections,
    completedSectionIds: effectiveCompletedSectionIds,
    totalRequiredSections,
  };
};
