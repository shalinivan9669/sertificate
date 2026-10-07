<script setup lang="ts">
import { buildWhatsAppContactUrl } from '~/shared/whatsapp-contact';

const route = useRoute();
const { locale } = useI18n();
const config = useRuntimeConfig();
const error = useError();
const formHasFocus = ref(false);
const href = computed(() => buildWhatsAppContactUrl(route.path, config.public.siteUrl, locale.value));
const label = computed(() => locale.value === 'kk'
  ? 'WhatsApp арқылы оқу туралы сұрау (жаңа терезеде ашылады)'
  : 'Уточнить условия обучения в WhatsApp (откроется в новой вкладке)');
function updateFocus() {
  const focused = document.activeElement;
  formHasFocus.value = focused instanceof Element
    && Boolean(focused.closest('form, dialog, [role="dialog"], input, textarea, select, [contenteditable="true"]'));
}
const scheduleFocusCheck = () => queueMicrotask(updateFocus);
onMounted(() => {
  updateFocus();
  document.addEventListener('focusin', updateFocus);
  document.addEventListener('focusout', scheduleFocusCheck);
});
onBeforeUnmount(() => {
  document.removeEventListener('focusin', updateFocus);
  document.removeEventListener('focusout', scheduleFocusCheck);
});
</script>

<template>
  <a v-if="href && !formHasFocus && !error" class="public-whatsapp-contact" :href="href" :aria-label="label" :title="label" target="_blank" rel="noopener noreferrer nofollow" referrerpolicy="no-referrer">
    <CivicIcon name="phone" />
    <span>WhatsApp</span>
  </a>
</template>

<style scoped>
.public-whatsapp-contact { position: fixed; z-index: 20; right: max(16px, env(safe-area-inset-right)); bottom: calc(16px + env(safe-area-inset-bottom)); display: inline-flex; align-items: center; justify-content: center; gap: 10px; min-height: 52px; max-width: calc(100vw - 32px); padding: 12px 18px; border: 1px solid var(--ed-success); border-radius: 28px; background: var(--ed-success); color: var(--ed-white); box-shadow: 0 3px 14px rgb(16 38 42 / 18%); font: 600 15px/1.3 var(--ed-sans); text-decoration: none; transition: background-color var(--ed-motion), box-shadow var(--ed-motion); }
.public-whatsapp-contact:hover { background: var(--ed-ink); box-shadow: 0 4px 18px rgb(16 38 42 / 24%); }
.public-whatsapp-contact:focus-visible { outline: 3px solid var(--ed-focus); outline-offset: 4px; }
.public-whatsapp-contact:active { box-shadow: 0 1px 6px rgb(16 38 42 / 18%); }
@media (prefers-reduced-motion: reduce) { .public-whatsapp-contact { transition: none; } }
</style>
