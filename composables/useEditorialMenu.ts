import { getCityBySlug } from '~/composables/useCity';

export type EditorialMenuSection = 'start' | 'programs' | 'places' | 'learning' | 'center';

export function useEditorialMenu() {
  const open = useState('editorial-menu-open', () => false);
  const section = useState<EditorialMenuSection>('editorial-menu-section', () => 'start');
  const route = useRoute();
  const path = useLocalePath();
  const { selection } = useLmsSelection();
  // Public pages are prerendered without a visitor's query or cookie. Keep the
  // first client render identical, then resolve the visitor's saved context.
  const hydrated = ref(false);
  onMounted(() => { hydrated.value = true; });
  const city = computed(() =>
    getCityBySlug(route.params.city) || getCityBySlug(route.params.course) ||
    (hydrated.value ? getCityBySlug(route.query.city) || getCityBySlug(selection.value.city) : null),
  );
  const format = computed(() => {
    if (!hydrated.value) return 'online';
    const value = route.query.format || selection.value.format;
    return typeof value === 'string' && ['online', 'classroom', 'onsite'].includes(value) ? value : '';
  });
  function link(destination: string, options: { format?: string; city?: string; hash?: string } = {}) {
    const selectedCity = options.city || city.value?.slug;
    const selectedFormat = options.format || format.value;
    return { path: path(destination), query: {
      ...(selectedCity ? { city: selectedCity } : {}),
      ...(selectedFormat ? { format: selectedFormat } : {}),
    }, ...(options.hash ? { hash: options.hash } : {}) };
  }
  function localLink(destination: string, formatValue?: string) {
    return link(`${city.value ? '/' + city.value.slug : ''}/${destination}`, { format: formatValue });
  }
  function show(value: EditorialMenuSection = 'start') {
    section.value = value;
    open.value = true;
  }
  return { open, section, city, format, link, localLink, show };
}
