import { computed, nextTick, onBeforeUnmount, onMounted, ref, unref, watch, type MaybeRef } from 'vue';
import { hasLeadProgramSelection, leadProgramSelectionFingerprint, readLeadPrograms, resolveLeadJourneyContext, resolveSavedLeadJourneyContext } from '~/shared/lead-context';

// A clean informational URL keeps its canonical identity. Conversion links can
// recover the visitor's choice without rendering cookie-dependent prerender HTML.
export function useLeadJourneyContext(explicitInput: MaybeRef<unknown>, defaultInput: MaybeRef<unknown> = {}) {
  const { selection } = useLmsSelection();
  const lastJourney = useState<Record<string, string>>('ot-lead-journey-context', () => ({}));
  const hydrated = ref(false);
  const explicit = computed(() => unref(explicitInput));
  const persistExplicit = () => {
    const programs = readLeadPrograms(explicit.value);
    // Viewing one programme must never replace a saved multi-programme order.
    if (hasLeadProgramSelection(explicit.value)) lastJourney.value = {
      programs: programs.join(','), selectionFingerprint: leadProgramSelectionFingerprint(selection.value),
    };
  };
  onMounted(() => {
    hydrated.value = true;
    // The existing navigation owns path/query prefill of the selection cookie.
    void nextTick().then(() => { if (hydrated.value) persistExplicit(); });
  });
  onBeforeUnmount(() => { hydrated.value = false; });
  watch(explicit, () => { if (hydrated.value) void nextTick().then(() => { if (hydrated.value) persistExplicit(); }); });
  return computed(() => resolveLeadJourneyContext(explicit.value,
    resolveSavedLeadJourneyContext(selection.value, lastJourney.value), hydrated.value, unref(defaultInput)));
}
