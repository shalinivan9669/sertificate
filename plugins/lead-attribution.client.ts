export default defineNuxtPlugin({
  name: 'lead-attribution',
  dependsOn: ['i18n:plugin'],
  setup() {
    const route = useRoute();
    const analytics = useLmsAnalytics();
    const attribution = useLeadAttribution();
    // Nuxt restores a prerendered page's real query after suspense hydration.
    // Optional collection waits for that route and the restored explicit consent.
    onNuxtReady(() => {
      watch([() => route.fullPath, analytics.consented], () => { void attribution.observe(route.path, route.query); }, { immediate: true });
    });
    window.addEventListener('ot-analytics-withdraw', attribution.clear);
  },
});
