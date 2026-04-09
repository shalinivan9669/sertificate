import { DEFAULT_REDESIGN_COURSE_ID, normalizeCourseId } from '~/composables/useRedesignFlow';

const SELECTION_COOKIE = 'ot-redesign-selection';

export const REDESIGN_DIRECTION_TO_COURSE = {
  prombez: 'industrial-safety',
  biot: 'labor-safety',
  ptm: 'fire-safety',
};

export const DEFAULT_REDESIGN_SELECTION = {
  courseId: 'industrial-safety',
  direction: 'prombez',
  audience: 'itr',
  specialization: 'construction',
  industry: 'electricity',
  source: 'direct',
  slug: 'industrial-safety',
  city: '',
};

const normalizeSelectionCourseId = (courseId) => {
  return normalizeCourseId(courseId || DEFAULT_REDESIGN_COURSE_ID);
};

const normalizeSelection = (value = {}) => ({
  ...DEFAULT_REDESIGN_SELECTION,
  ...value,
  courseId: normalizeSelectionCourseId(value.courseId || DEFAULT_REDESIGN_SELECTION.courseId),
  source: value.source || DEFAULT_REDESIGN_SELECTION.source,
  slug: value.slug || DEFAULT_REDESIGN_SELECTION.slug,
  city: value.city || DEFAULT_REDESIGN_SELECTION.city,
});

export function useRedesignSelection() {
  const cookie = useCookie(SELECTION_COOKIE, {
    default: () => ({ ...DEFAULT_REDESIGN_SELECTION }),
    sameSite: 'lax',
    path: '/',
  });
  const memory = useState(SELECTION_COOKIE, () => ({ ...DEFAULT_REDESIGN_SELECTION }));

  const syncSelection = (nextValue) => {
    const normalized = normalizeSelection(nextValue);

    memory.value = normalized;

    try {
      cookie.value = normalized;
    } catch (error) {
      console.warn('Failed to persist redesign selection cookie, using in-memory state.', error);
    }

    return normalized;
  };

  const selection = computed({
    get: () => {
      const source = memory.value && Object.keys(memory.value).length ? memory.value : cookie.value;
      const normalized = normalizeSelection(source);

      if (!memory.value || !Object.keys(memory.value).length) {
        memory.value = normalized;
      }

      return normalized;
    },
    set: (next) => {
      syncSelection(next);
    },
  });

  const patchSelection = (updates) => {
    cookie.value = normalizeSelection({ ...selection.value, ...updates });
  };

  const setCourseId = (courseId) => {
    patchSelection({ courseId: normalizeSelectionCourseId(courseId) });
  };

  const resetSelection = () => {
    cookie.value = { ...DEFAULT_REDESIGN_SELECTION };
  };

  return {
    patchSelection,
    resetSelection,
    selection,
    setCourseId,
  };
}
