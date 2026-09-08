<script setup lang="ts">
const { api, tr, errorText } = useLmsApi();
const { data, pending, error, refresh } = await useAsyncData('lms-learning-reminder-preferences', () => api<any>('/me/reminder-preferences'));
const accessDeadline = ref(true); const renewal = ref(true); const busy = ref(false); const failure = ref(''); const message = ref('');
watch(data, value => { if (value) { accessDeadline.value = value.accessDeadline; renewal.value = value.renewal; } }, { immediate: true });
async function save() {
  busy.value = true; failure.value = ''; message.value = '';
  try { await api('/me/reminder-preferences', { method: 'POST', body: { accessDeadline: accessDeadline.value, renewal: renewal.value } }); await refresh(); await refreshNuxtData('lms-learning-reminders-me'); message.value = tr('Настройки сохранены. Отменённые расписания автоматически не возобновляются.', 'Баптаулар сақталды. Бас тартылған кестелер автоматты түрде қайта іске қосылмайды.'); }
  catch (cause) { failure.value = errorText(cause); } finally { busy.value = false; }
}
useHead(() => ({ title: tr('Напоминания — OT Center', 'Еске салулар — OT Center'), meta: [{ name: 'robots', content: 'noindex, nofollow' }] }));
</script>
<template>
  <LmsShell :title="tr('Напоминания', 'Еске салулар')" back="/cabinet">
    <LmsState :pending="pending" :error="error" @retry="refresh()"><form class="lms-card space-y-4" @submit.prevent="save"><h2 class="text-xl font-bold">{{ tr('Мои предпочтения', 'Менің қалауым') }}</h2><label class="flex items-start gap-3"><input v-model="accessDeadline" type="checkbox" /><span>{{ tr('Напоминать об окончании доступа в кабинете', 'Кабинетте қолжетімділіктің аяқталуын еске салу') }}</span></label><label class="flex items-start gap-3"><input v-model="renewal" type="checkbox" /><span>{{ tr('Напоминать о запланированной повторной подготовке в кабинете', 'Кабинетте жоспарланған қайта даярлауды еске салу') }}</span></label><p class="text-sm text-slate-600">{{ tr('Отключение отменит будущие и ещё не прочитанные напоминания этого вида, включая назначенные организацией. Возврат согласия не запускает старые расписания.', 'Өшіру осы түрдегі болашақ және әлі оқылмаған еске салулардан, соның ішінде ұйым тағайындағандарынан бас тартады. Қайта келісу ескі кестелерді іске қоспайды.') }}</p><p v-if="failure" class="lms-error" role="alert">{{ failure }}</p><p v-if="message" class="lms-success" role="status">{{ message }}</p><button class="lms-button" :disabled="busy">{{ tr('Сохранить предпочтения', 'Қалауды сақтау') }}</button></form></LmsState>
    <LmsLearningReminders />
  </LmsShell>
</template>
