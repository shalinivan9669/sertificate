import { navigateTo } from '#imports';
import {
  logRedesignFlow,
  summarizeCompletionState,
  summarizeLearningState,
} from '~/composables/useRedesignFlowDebug';
import { getLearningCompletionState } from '~/composables/useRedesignLearningProgress';
import { REDESIGN_STAGE_ORDER, useRedesignFlow, normalizeCourseId } from '~/composables/useRedesignFlow';
import { useRedesignSelection } from '~/composables/useRedesignSelection';
import { getRuntimeFlowFixture } from '~/composables/useRedesignRuntimeMock';

const stripLocalePrefix = (path) => path.replace(/^\/kk(?=\/|$)/, '') || '/';

const isRedesignPath = (path) => {
  const normalized = stripLocalePrefix(path);

  return (
    normalized === '/' ||
    normalized === '/categories' ||
    normalized === '/wizard' ||
    normalized === '/program-selection' ||
    normalized === '/courses' ||
    normalized === '/b2b' ||
    normalized === '/cabinet' ||
    normalized === '/payment/pending' ||
    normalized.startsWith('/courses/') ||
    normalized.startsWith('/learn/') ||
    normalized.startsWith('/payment/') ||
    normalized.startsWith('/certificates/')
  );
};

const isLearningPath = (path) => /^\/learn\/[^/]+$/.test(path);
const isConfirmPath = (path) => /^\/learn\/[^/]+\/confirm$/.test(path);
const isPreTestPath = (path) => /^\/learn\/[^/]+\/pre-test$/.test(path);
const isExamPath = (path) => /^\/learn\/[^/]+\/exam$/.test(path);
const isFailedPath = (path) => /^\/learn\/[^/]+\/failed$/.test(path);
const isSuccessPath = (path) => /^\/learn\/[^/]+\/success$/.test(path);
const isCertificatePath = (path) => /^\/certificates\/[^/]+$/.test(path);
const isPaymentPath = (path) => /^\/payment\/[^/]+$/.test(path) && path !== '/payment/pending';

const stageIndex = (stage) => REDESIGN_STAGE_ORDER.indexOf(stage);

const getCourseId = (to, selectionCourseId, state) => {
  const params = to.params || {};
  const paramId = typeof params.id === 'string' ? params.id : null;
  const paramCourseId = typeof params.courseId === 'string' ? params.courseId : null;

  return normalizeCourseId(paramId || paramCourseId || selectionCourseId || state.courseId);
};

const buildPaths = (courseId) => ({
  cabinet: '/cabinet',
  categories: '/program-selection',
  certificate: `/certificates/${courseId}`,
  confirm: `/learn/${courseId}/confirm`,
  course: `/courses/${courseId}`,
  exam: `/learn/${courseId}/exam`,
  failed: `/learn/${courseId}/failed`,
  home: '/',
  learning: `/learn/${courseId}`,
  pending: '/payment/pending',
  payment: `/payment/${courseId}`,
  pretest: `/learn/${courseId}/pre-test`,
  programSelection: '/program-selection',
  success: `/learn/${courseId}/success`,
  wizard: '/program-selection',
});

const setRouteState = (flow, courseId, stage, extras = {}) => {
  flow.patchFlow({
    courseId,
    stage,
    ...extras,
  });
};

const getLearningAccessState = (courseId, state, includeActiveSection = false) =>
  getLearningCompletionState(
    getRuntimeFlowFixture(courseId).learningExperience,
    state.learning || {},
    { includeActiveSection },
  );

export default defineNuxtRouteMiddleware((to) => {
  const normalizedPath = stripLocalePrefix(to.path || '/');

  if (!isRedesignPath(normalizedPath)) {
    return;
  }

  const selection = useRedesignSelection();
  const courseId = getCourseId(to, selection.selection.value.courseId, { courseId: selection.selection.value.courseId });
  const flow = useRedesignFlow(courseId);
  const state = flow.flow.value;
  const paths = buildPaths(courseId);
  const currentStageIndex = stageIndex(state.stage);
  const browseFallbackPath = currentStageIndex >= stageIndex('course') ? paths.course : paths.learning;

  logRedesignFlow('route-middleware', 'enter', {
    from: typeof to.redirectedFrom?.fullPath === 'string' ? to.redirectedFrom.fullPath : null,
    to: to.fullPath,
    normalizedPath,
    stage: state.stage,
    branch: state.branch,
    learning: summarizeLearningState(state.learning || {}),
  });

  if (isConfirmPath(normalizedPath) && currentStageIndex < stageIndex('learning')) {
    logRedesignFlow('route-middleware', 'redirect-confirm-to-learning', {
      to: to.fullPath,
      stage: state.stage,
      target: paths.learning,
    });
    return navigateTo(paths.learning);
  }

  if (isPreTestPath(normalizedPath)) {
    const fromLearning = to.query?.fromLearning === '1';
    const learningAccessState = getLearningAccessState(courseId, state, fromLearning);
    const canAccessPretest =
      currentStageIndex >= stageIndex('pretest') ||
      state.stage === 'confirm' ||
      (state.stage === 'learning' && learningAccessState.allRequiredCompleted);

    logRedesignFlow('route-middleware', 'pretest-guard', {
      to: to.fullPath,
      fromLearning,
      stage: state.stage,
      currentStageIndex,
      completion: summarizeCompletionState(learningAccessState),
      canAccessPretest,
    });

    if (!canAccessPretest) {
      logRedesignFlow('route-middleware', 'redirect-pretest-to-learning', {
        to: to.fullPath,
        target: paths.learning,
      });
      return navigateTo(paths.learning);
    }
  }

  if (isExamPath(normalizedPath) && currentStageIndex < stageIndex('pretest')) {
    logRedesignFlow('route-middleware', 'redirect-exam-to-pretest', {
      to: to.fullPath,
      stage: state.stage,
      target: paths.pretest,
    });
    return navigateTo(paths.pretest);
  }

  if (isFailedPath(normalizedPath)) {
    if (state.branch === 'pass') {
      return navigateTo(paths.success);
    }

    if (state.branch === 'browse') {
      return navigateTo(browseFallbackPath);
    }

    if (currentStageIndex < stageIndex('exam')) {
      return navigateTo(paths.exam);
    }

    setRouteState(flow, courseId, 'failed', { branch: 'fail' });
    return;
  }

  if (isPaymentPath(normalizedPath)) {
    if (state.branch === 'pass') {
      return navigateTo(paths.success);
    }

    if (state.branch === 'browse') {
      return navigateTo(browseFallbackPath);
    }

    if (currentStageIndex < stageIndex('failed')) {
      return navigateTo(paths.exam);
    }

    setRouteState(flow, courseId, 'payment', { branch: 'fail' });
    return;
  }

  if (isSuccessPath(normalizedPath)) {
    if (state.branch === 'fail') {
      return navigateTo(paths.exam);
    }

    if (state.branch === 'browse') {
      return navigateTo(browseFallbackPath);
    }

    if (currentStageIndex < stageIndex('exam')) {
      return navigateTo(paths.exam);
    }

    setRouteState(flow, courseId, 'success', { branch: 'pass' });
    return;
  }

  if (isCertificatePath(normalizedPath)) {
    if (state.stage === 'b2b') {
      setRouteState(flow, courseId, 'certificate', { branch: 'pass' });
      return;
    }

    if (state.branch === 'fail') {
      return navigateTo(paths.exam);
    }

    if (state.branch === 'browse') {
      return navigateTo(browseFallbackPath);
    }

    if (currentStageIndex < stageIndex('success')) {
      return navigateTo(paths.success);
    }

    setRouteState(flow, courseId, 'certificate', { branch: 'pass' });
    return;
  }

  if (normalizedPath === '/payment/pending') {
    if (state.stage === 'b2b') {
      setRouteState(flow, courseId, 'pending', { branch: 'pass' });
      return;
    }

    if (state.branch === 'fail') {
      return navigateTo(paths.exam);
    }

    if (state.branch === 'browse') {
      return navigateTo(browseFallbackPath);
    }

    if (currentStageIndex < stageIndex('certificate')) {
      return navigateTo(paths.certificate);
    }

    setRouteState(flow, courseId, 'pending', { branch: 'pass' });
    return;
  }

  if (normalizedPath === '/cabinet') {
    if (state.stage === 'b2b') {
      setRouteState(flow, courseId, 'overview', { branch: 'pass' });
      return;
    }

    if (state.branch === 'fail') {
      return navigateTo(paths.payment);
    }

    if (state.branch === 'browse') {
      return navigateTo(browseFallbackPath);
    }

    if (currentStageIndex < stageIndex('success')) {
      return navigateTo(paths.success);
    }

    if (state.stage === 'success') {
      return navigateTo(paths.certificate);
    }

    if (state.stage === 'certificate') {
      return navigateTo(paths.pending);
    }

    setRouteState(flow, courseId, 'overview', { branch: 'pass' });
    return;
  }

  if (normalizedPath === '/') {
    selection.patchSelection({ courseId });
    setRouteState(flow, courseId, 'home', { branch: 'browse' });
    return;
  }

  if (normalizedPath === '/categories' || normalizedPath === '/wizard' || normalizedPath === '/program-selection') {
    selection.patchSelection({ courseId });
    setRouteState(flow, courseId, 'wizard', { branch: 'browse' });
    return;
  }

  if (normalizedPath === '/courses') {
    selection.patchSelection({ courseId });
    setRouteState(flow, courseId, 'catalog', { branch: 'browse' });
    return;
  }

  if (/^\/courses\/[^/]+$/.test(normalizedPath)) {
    selection.patchSelection({ courseId });
    setRouteState(flow, courseId, 'course', { branch: 'browse' });
    return;
  }

  if (isLearningPath(normalizedPath)) {
    selection.patchSelection({ courseId });
    setRouteState(flow, courseId, 'learning', { branch: state.branch || 'browse' });
    return;
  }

  if (normalizedPath === '/b2b') {
    selection.patchSelection({ courseId });
    setRouteState(flow, courseId, 'b2b', { branch: 'browse' });
  }
});
