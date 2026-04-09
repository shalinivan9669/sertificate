const FLOW_COOKIE = 'ot-redesign-flow';

export const DEFAULT_REDESIGN_COURSE_ID = 'industrial-safety';

export const REDESIGN_COURSE_IDS = [
  'industrial-safety',
  'labor-safety',
  'fire-safety',
];

export const REDESIGN_STAGE_ORDER = [
  'home',
  'categories',
  'wizard',
  'catalog',
  'course',
  'learning',
  'confirm',
  'pretest',
  'exam',
  'failed',
  'payment',
  'success',
  'certificate',
  'pending',
  'overview',
  'b2b',
];

const normalizeCourseId = (courseId) => {
  if (REDESIGN_COURSE_IDS.includes(courseId)) {
    return courseId;
  }

  return DEFAULT_REDESIGN_COURSE_ID;
};

const createDefaultFlow = (courseId = DEFAULT_REDESIGN_COURSE_ID) => ({
  courseId: normalizeCourseId(courseId),
  stage: 'home',
  branch: 'browse',
  learning: {
    activeModuleId: 'module-1',
    activeSectionId: 'module-1-section-1',
    completedModuleIds: [],
    completedSectionIds: [],
    acknowledged: false,
  },
  test: {
    currentQuestionIndex: 0,
    answers: {},
    score: 0,
    correctCount: 0,
    passed: false,
    submitted: false,
    submittedAt: '',
  },
  payment: {
    methodId: 'card',
    status: 'idle',
    transactionId: '',
    retryCount: 0,
    lastPaidAt: '',
  },
  certificate: {
    number: '',
    status: 'draft',
    issuedAt: '',
    history: [],
  },
  overview: {
    progress: null,
    currentStep: 'selection',
  },
});

const normalizeStage = (stage) => (REDESIGN_STAGE_ORDER.includes(stage) ? stage : 'home');

const normalizeBranch = (branch) => (branch === 'fail' || branch === 'pass' ? branch : 'browse');

const normalizeFlow = (value = {}, courseId = DEFAULT_REDESIGN_COURSE_ID) => ({
  ...createDefaultFlow(courseId),
  ...value,
  learning: {
    ...createDefaultFlow(courseId).learning,
    ...(value.learning || {}),
  },
  test: {
    ...createDefaultFlow(courseId).test,
    ...(value.test || {}),
  },
  payment: {
    ...createDefaultFlow(courseId).payment,
    ...(value.payment || {}),
  },
  certificate: {
    ...createDefaultFlow(courseId).certificate,
    ...(value.certificate || {}),
  },
  overview: {
    ...createDefaultFlow(courseId).overview,
    ...(value.overview || {}),
  },
  stage: normalizeStage(value.stage),
  branch: normalizeBranch(value.branch),
  courseId: normalizeCourseId(value.courseId || courseId),
});

export function useRedesignFlow(courseIdInput) {
  const cookie = useCookie(FLOW_COOKIE, {
    default: () => ({}),
    sameSite: 'lax',
    path: '/',
  });
  const memory = useState(FLOW_COOKIE, () => ({}));

  const courseId = computed(() => {
    const value = unref(courseIdInput);
    return normalizeCourseId(value || DEFAULT_REDESIGN_COURSE_ID);
  });

  const syncStore = (nextValue) => {
    const normalized = normalizeFlow(nextValue, courseId.value);

    memory.value = {
      ...(memory.value || {}),
      [courseId.value]: normalized,
    };

    try {
      cookie.value = {
        ...(cookie.value || {}),
        [courseId.value]: normalized,
      };
    } catch (error) {
      console.warn('Failed to persist redesign flow cookie, using in-memory state.', error);
    }

    return normalized;
  };

  const flow = computed({
    get: () => {
      const source = memory.value?.[courseId.value] ?? cookie.value?.[courseId.value];
      const normalized = normalizeFlow(source, courseId.value);

      if (!memory.value?.[courseId.value]) {
        memory.value = {
          ...(memory.value || {}),
          [courseId.value]: normalized,
        };
      }

      return normalized;
    },
    set: (next) => {
      syncStore(next);
    },
  });

  const patchFlow = (updates) => {
    syncStore({ ...flow.value, ...updates });
  };

  const setStage = (stage, updates = {}) => {
    patchFlow({ ...updates, stage });
  };

  const setBranch = (branch, updates = {}) => {
    patchFlow({ ...updates, branch });
  };

  const setCourseId = (courseId) => {
    patchFlow({ courseId: normalizeCourseId(courseId) });
  };

  const resetFlow = () => {
    syncStore(createDefaultFlow(courseId.value));
  };

  const stageIndex = (stage) => REDESIGN_STAGE_ORDER.indexOf(stage);

  return {
    flow,
    patchFlow,
    resetFlow,
    setBranch,
    setCourseId,
    setStage,
    stageIndex,
  };
}

export { normalizeCourseId };
