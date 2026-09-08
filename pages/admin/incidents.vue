<script setup lang="ts">
const { api, tr, date, errorText } = useLmsApi();
const localePath = useLocalePath();
const status = ref('active');
const page = ref(1);
const { data, pending, error, refresh } = await useAsyncData('lms-operational-incidents', () => api<any>('/admin/incidents', { query: { status: status.value, page: page.value, pageSize: 25 } }));
const chosen = ref<any>(null);
const action = ref<'acknowledge' | 'resolve'>('acknowledge');
const reason = ref('');
const busy = ref(false);
const failure = ref('');
const success = ref('');
const kindLabel = (kind: string) => ({
  outbox_failed: tr('Задание остановлено после повторов', 'Қайталаулардан кейін тапсырма тоқтатылды'),
  outbox_stalled: tr('Задание ожидает слишком долго', 'Тапсырма тым ұзақ күтіп тұр'),
  lead_undelivered: tr('Заявка не передана в CRM', 'Өтінім CRM жүйесіне жіберілмеді'),
  credential_pending: tr('Документ ожидает подготовки', 'Құжат дайындауды күтіп тұр'),
  payment_pending: tr('Ожидается сверка платежа', 'Төлемді салыстырып тексеру күтілуде'),
  webhook_rejected: tr('Событие платёжной интеграции отклонено', 'Төлем интеграциясының оқиғасы қабылданбады'),
}[kind] || kind);
const stateLabel = (value: string) => ({ open: tr('Новый', 'Жаңа'), acknowledged: tr('В работе', 'Орындалуда'), resolved: tr('Закрыт', 'Жабылды') }[value] || value);
const ownerLabel = (value: string) => ({ admin: tr('Администратор', 'Әкімші'), issuer: tr('Оформление документов', 'Құжаттарды рәсімдеу'), finance: tr('Финансы', 'Қаржы') }[value] || value);
function choose(incident: any, next: 'acknowledge' | 'resolve') { chosen.value = incident; action.value = next; reason.value = ''; failure.value = ''; success.value = ''; }
async function reload(reset = false) { if (reset) page.value = 1; await refresh(); }
async function turn(delta: number) { page.value += delta; await refresh(); }
async function save() {
  if (!chosen.value) return;
  busy.value = true; failure.value = ''; success.value = '';
  try { await api(`/admin/incidents/${encodeURIComponent(chosen.value.id)}`, { method: 'POST', body: { action: action.value, reason: reason.value } }); chosen.value = null; success.value = tr('Состояние и основание сохранены в журнале.', 'Күйі мен негіздемесі журналға сақталды.'); await refresh(); }
  catch (cause) { failure.value = errorText(cause); } finally { busy.value = false; }
}
useHead(() => ({ title: tr('Контроль операций — OT Center', 'Операцияларды бақылау — OT Center'), meta: [{ name: 'robots', content: 'noindex, nofollow' }] }));
</script>
<template>
  <LmsShell :title="tr('Контроль операций', 'Операцияларды бақылау')" back="/admin">
    <p class="text-slate-600">{{ tr('Здесь фиксируются ошибки и длительные ожидания. Ответственный принимает событие в работу и указывает основание закрытия. Активную причину сначала нужно устранить.', 'Мұнда қателер мен ұзақ күтулер тіркеледі. Жауапты қызметкер оқиғаны жұмысқа қабылдап, жабу негізін көрсетеді. Алдымен белсенді себепті жою қажет.') }}</p>
    <form class="lms-card flex flex-wrap items-end gap-4" @submit.prevent="reload(true)">
      <label class="space-y-2"><span>{{ tr('Состояние событий', 'Оқиғалардың күйі') }}</span><select v-model="status"><option value="active">{{ tr('Открытые и в работе', 'Ашық және орындалуда') }}</option><option value="resolved">{{ tr('Закрытые', 'Жабылған') }}</option><option value="all">{{ tr('Все', 'Барлығы') }}</option></select></label>
      <button class="lms-button secondary" :disabled="pending">{{ tr('Обновить список', 'Тізімді жаңарту') }}</button>
    </form>
    <LmsState :pending="pending" :error="error" @retry="refresh()">
      <template v-if="data">
        <p class="text-sm">{{ tr('Найдено событий', 'Табылған оқиғалар') }}: {{ data.pagination.total }}. {{ tr('Страница', 'Бет') }} {{ data.pagination.page }}.</p>
        <p v-if="!data.incidents.length" class="lms-card">{{ tr('Событий с выбранным состоянием пока нет.', 'Таңдалған күйдегі оқиғалар әзірге жоқ.') }}</p>
        <ul class="space-y-4">
          <li v-for="incident in data.incidents" :key="incident.id" class="lms-card space-y-3">
            <div class="flex flex-wrap items-center gap-3"><h2 class="text-xl font-bold">{{ kindLabel(incident.kind) }}</h2><span class="rounded-full px-3 py-1 text-sm" :class="incident.severity === 'critical' ? 'bg-red-100 text-red-900' : 'bg-amber-100 text-amber-900'">{{ incident.severity === 'critical' ? tr('Требует внимания', 'Назар аударуды қажет етеді') : tr('Предупреждение', 'Ескерту') }}</span></div>
            <p>{{ stateLabel(incident.status) }} · {{ ownerLabel(incident.ownerRole) }} · {{ incident.acknowledgedBy ? tr('Ответственный принял в работу', 'Жауапты қызметкер жұмысқа қабылдады') : tr('Ещё не принято в работу', 'Әлі жұмысқа қабылданбады') }}</p>
            <p class="text-sm text-slate-600">{{ tr('Первое обнаружение', 'Алғаш анықталған') }}: {{ date(incident.firstSeenAt) }}. {{ tr('Последнее наблюдение', 'Соңғы бақылау') }}: {{ date(incident.lastSeenAt) }}.</p>
            <p class="break-all text-sm">{{ tr('Запись', 'Жазба') }}: {{ incident.targetId }} · {{ tr('Код причины', 'Себеп коды') }}: {{ incident.details.code }} · {{ tr('Наблюдений', 'Бақылаулар') }}: {{ incident.observations }}</p>
            <div class="flex flex-wrap gap-3"><NuxtLink class="lms-button secondary" :to="localePath(incident.kind === 'credential_pending' ? '/admin/documents' : '/admin')">{{ tr('Открыть рабочий раздел', 'Жұмыс бөлімін ашу') }}</NuxtLink><button v-if="incident.status !== 'resolved'" class="lms-button secondary" @click="choose(incident, 'acknowledge')">{{ tr('Принять в работу', 'Жұмысқа қабылдау') }}</button><button v-if="incident.status !== 'resolved'" class="lms-button secondary" @click="choose(incident, 'resolve')">{{ tr('Закрыть с основанием', 'Негіздемемен жабу') }}</button></div>
          </li>
        </ul>
        <div class="flex flex-wrap gap-3"><button class="lms-button secondary" :disabled="pending || page <= 1" @click="turn(-1)">{{ tr('Предыдущая страница', 'Алдыңғы бет') }}</button><button class="lms-button secondary" :disabled="pending || !data.pagination.hasMore" @click="turn(1)">{{ tr('Следующая страница', 'Келесі бет') }}</button></div>
        <details v-if="data.thresholds" class="lms-card space-y-3"><summary class="cursor-pointer font-semibold">{{ tr('Условия обнаружения и доставки', 'Анықтау және жеткізу шарттары') }}</summary><p class="text-sm">{{ tr('Порог ожидания в минутах: очередь / CRM / документ / платёж', 'Күту шегі, минут: кезек / CRM / құжат / төлем') }}: {{ data.thresholds.outboxMinutes }} / {{ data.thresholds.leadMinutes }} / {{ data.thresholds.credentialMinutes }} / {{ data.thresholds.paymentMinutes }}.</p><p class="text-sm">{{ tr('Проверка выполняется ограниченной порцией по расписанию или вручную из управления. Это не непрерывный мониторинг.', 'Тексеру кесте бойынша немесе басқару бөлімінен қолмен, шектеулі көлемде орындалады. Бұл үздіксіз бақылау емес.') }}</p><p class="text-sm">{{ data.externalAlerts.enabled && data.externalAlerts.configured ? tr('Отправка ответственному по email включена. Результат доставки проверяется в очереди.', 'Жауапты қызметкерге email жіберу қосылған. Жеткізу нәтижесі кезекте тексеріледі.') : tr('Внешние оповещения не настроены или отключены; события доступны здесь и в кабинете сотрудников.', 'Сыртқы хабарландырулар бапталмаған немесе өшірілген; оқиғалар осында және қызметкерлер кабинетінде қолжетімді.') }}</p><ul class="text-sm"><li v-for="counter in data.counters" :key="counter.day + counter.metric">{{ counter.day }} · {{ counter.metric }}: {{ counter.count }}</li></ul></details>
      </template>
    </LmsState>
    <form v-if="chosen" class="lms-card space-y-4" @submit.prevent="save()"><h2 class="text-xl font-bold">{{ action === 'acknowledge' ? tr('Принять событие в работу', 'Оқиғаны жұмысқа қабылдау') : tr('Закрыть событие', 'Оқиғаны жабу') }}: {{ kindLabel(chosen.kind) }}</h2><label class="block space-y-2"><span>{{ tr('Основание и выполненные действия', 'Негіздеме және орындалған әрекеттер') }}</span><textarea v-model="reason" required minlength="10" maxlength="2000" /></label><p class="text-sm text-slate-600">{{ tr('Не добавляйте пароли, реквизиты или лишние персональные сведения.', 'Құпиясөздерді, деректемелерді немесе артық жеке мәліметтерді қоспаңыз.') }}</p><div class="flex flex-wrap gap-3"><button class="lms-button" :disabled="busy">{{ tr('Сохранить решение', 'Шешімді сақтау') }}</button><button class="lms-button secondary" type="button" :disabled="busy" @click="chosen = null">{{ tr('Отмена', 'Болдырмау') }}</button></div></form>
    <p v-if="failure" class="lms-error" role="alert">{{ failure }}</p><p v-if="success" class="lms-success" role="status">{{ success }}</p>
  </LmsShell>
</template>
