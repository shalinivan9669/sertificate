import {
  DEFAULT_REDESIGN_COURSE_ID,
  normalizeCourseId as normalizeFlowCourseId,
  useRedesignFlow,
} from '~/composables/useRedesignFlow';
import { useRedesignSelection } from '~/composables/useRedesignSelection';

export const REDESIGN_PUBLIC_PATHS = {
  contacts: '/contacts',
  cabinet: '/cabinet',
  categories: '/program-selection',
  certificate: '/certificates/industrial-safety',
  courses: '/courses',
  home: '/',
  licenses: '/licenses',
  paymentPending: '/payment/pending',
  programSelection: '/program-selection',
  privacy: '/privacy',
  publicOffer: '/public-offer',
  wizard: '/program-selection',
  b2b: '/b2b',
};

const normalizeRouteCourseId = (value) => {
  if (Array.isArray(value)) {
    return value[0] || DEFAULT_REDESIGN_COURSE_ID;
  }

  return normalizeFlowCourseId(value || DEFAULT_REDESIGN_COURSE_ID);
};

const buildRedesignPaths = (courseId) => ({
  b2b: REDESIGN_PUBLIC_PATHS.b2b,
  cabinet: REDESIGN_PUBLIC_PATHS.cabinet,
  categories: REDESIGN_PUBLIC_PATHS.categories,
  certificate: `/certificates/${courseId}`,
  contacts: REDESIGN_PUBLIC_PATHS.contacts,
  course: `/courses/${courseId}`,
  courses: REDESIGN_PUBLIC_PATHS.courses,
  exam: `/learn/${courseId}/exam`,
  failed: `/learn/${courseId}/failed`,
  home: REDESIGN_PUBLIC_PATHS.home,
  learning: `/learn/${courseId}`,
  confirm: `/learn/${courseId}/confirm`,
  payment: `/payment/${courseId}`,
  pending: REDESIGN_PUBLIC_PATHS.paymentPending,
  pretest: `/learn/${courseId}/pre-test`,
  programSelection: REDESIGN_PUBLIC_PATHS.programSelection,
  privacy: REDESIGN_PUBLIC_PATHS.privacy,
  publicOffer: REDESIGN_PUBLIC_PATHS.publicOffer,
  success: `/learn/${courseId}/success`,
  terms: REDESIGN_PUBLIC_PATHS.publicOffer,
  wizard: REDESIGN_PUBLIC_PATHS.wizard,
  licenses: REDESIGN_PUBLIC_PATHS.licenses,
});

export function useRedesignRoutes() {
  const route = useRoute();
  const selectionStore = useRedesignSelection();
  const routeCourseId = computed(() => {
    const params = route.params || {};
    const paramId = typeof params.id === 'string' ? params.id : null;
    const paramCourseId = typeof params.courseId === 'string' ? params.courseId : null;

    return normalizeRouteCourseId(
      paramId || paramCourseId || selectionStore.selection.value.courseId || DEFAULT_REDESIGN_COURSE_ID,
    );
  });
  const flow = useRedesignFlow(routeCourseId);

  const courseId = computed(() => normalizeFlowCourseId(routeCourseId.value || DEFAULT_REDESIGN_COURSE_ID));

  const paths = computed(() => buildRedesignPaths(courseId.value));

  const syncCourseId = () => {
    selectionStore.setCourseId(courseId.value);
    flow.setCourseId(courseId.value);
  };

  return {
    courseId,
    flow,
    paths,
    selection: selectionStore.selection,
    patchSelection: selectionStore.patchSelection,
    syncCourseId,
  };
}
