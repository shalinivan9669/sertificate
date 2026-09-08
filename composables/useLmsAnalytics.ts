import { analyticsClientEvents, analyticsConsentVersion, analyticsDimensions, createAnalyticsQueue, type AnalyticsClientEvent, type AnalyticsDimensions } from '~/utils/lms-analytics-client';
import { analyticsCookieName } from '~/shared/analytics';

interface AnalyticsConfig { enabled: boolean; consentVersion: string; retentionDays: number | null }
let queue: ReturnType<typeof createAnalyticsQueue> | undefined;
let configRequest: Promise<AnalyticsConfig | null> | undefined;
let configAbort: AbortController | undefined;

export function useLmsAnalytics() {
  const app = useNuxtApp();
  // Vue's useI18n requires a component setup instance. Nuxt plugins use the already
  // installed global composer; unref keeps both the composer and legacy shape reactive.
  const locale = getCurrentInstance() ? useI18n().locale : computed(() => unref(app.$i18n.locale));
  const cookie = useCookie<string | null>(analyticsCookieName, { sameSite: 'lax', path: '/', encode: value => encodeURIComponent(value || ''), decode: value => typeof value === 'string' ? decodeURIComponent(value) : null, default: () => null });
  const consented = useState('lms-analytics-consented', () => false);
  const config = useState<AnalyticsConfig | null>('lms-analytics-config', () => null);
  const configPending = useState('lms-analytics-config-pending', () => false);
  const configError = useState('lms-analytics-config-error', () => false);
  const enabled = computed(() => config.value?.enabled === true && config.value.consentVersion === analyticsConsentVersion && Number.isInteger(config.value.retentionDays) && Number(config.value.retentionDays) >= 1 && Number(config.value.retentionDays) <= 90);
  const allowed = () => import.meta.client && consented.value && document.cookie.split(';').some(value => value.trim() === analyticsCookieName + '=' + analyticsConsentVersion);

  async function loadConfig(force = false): Promise<AnalyticsConfig | null> {
    if (!import.meta.client) return null;
    if (config.value && !force) return config.value;
    if (configRequest) return configRequest;
    configPending.value = true; configError.value = false;
    configAbort = new AbortController();
    configRequest = $fetch<AnalyticsConfig>('/api/v1/analytics/config', { credentials: 'same-origin', retry: 0, timeout: 5000, signal: configAbort.signal })
      .then(value => { config.value = value; return value; })
      .catch(() => { configError.value = true; return null; })
      .finally(() => { configPending.value = false; configRequest = undefined; configAbort = undefined; });
    return configRequest;
  }
  function withdraw() {
    consented.value = false; cookie.value = null;
    queue?.clear(); configAbort?.abort();
    if (import.meta.client) window.dispatchEvent(new Event('ot-analytics-withdraw'));
  }
  function optIn() {
    if (!import.meta.client || !enabled.value) return false;
    cookie.value = analyticsConsentVersion; consented.value = true; return true;
  }
  function track(name: AnalyticsClientEvent, dimensions: AnalyticsDimensions = {}) {
    if (!allowed() || !analyticsClientEvents.includes(name)) return;
    queue ||= createAnalyticsQueue({ allowed, send: async (event, signal) => {
      await loadConfig();
      if (!allowed() || !enabled.value || signal.aborted) return;
      await $fetch('/api/v1/analytics', { method: 'POST', credentials: 'same-origin', retry: 0, body: event, signal });
    } });
    queue.enqueue({ id: crypto.randomUUID(), name, dimensions: analyticsDimensions({ ...dimensions, locale: locale.value === 'kk' ? 'kk' : 'ru' }) });
  }
  const restoreConsent = () => { consented.value = cookie.value === analyticsConsentVersion; };
  if (getCurrentInstance()) onMounted(restoreConsent);
  else if (import.meta.client) app.hook('app:mounted', restoreConsent);
  watch(consented, value => { if (!value) queue?.clear(); });
  return { consented, config, configPending, configError, enabled, loadConfig, optIn, withdraw, track };
}
