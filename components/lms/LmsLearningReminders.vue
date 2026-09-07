<script setup lang="ts">
const props = defineProps<{ organizationId?: string; enrollments?: any[] }>();
const { api, tr, date, errorText } = useLmsApi();
const page = ref(1); const choicePage = ref(1);
const endpoint = computed(() => props.organizationId ? `/organizations/${encodeURIComponent(props.organizationId)}/learning-reminders` : '/me/learning-reminders');
const { data, pending, error, refresh } = await useAsyncData(`lms-learning-reminders-${props.organizationId || 'me'}`, () => api<any>(endpoint.value, { query: { page: page.value } }));
const { data: personalChoices, refresh: refreshChoices } = await useAsyncData(`lms-reminder-choices-${props.organizationId || 'me'}`, () => props.organizationId ? Promise.resolve(null) : api<any>('/me/learning-reminders/enrollments', { query: { page: choicePage.value } }));
const choices = computed(() => props.organizationId ? props.enrollments || [] : personalChoices.value?.enrollments || []);
const mode = ref<'create' | 'update' | 'cancel'>('create'); const editing = ref<any>(null);
const enrollmentId = ref(''); const kind = ref('access_deadline'); const dueDate = ref(''); const timezone = ref('Asia/Qyzylorda'); const offsets = ref('30,7,0');
const reason = ref(''); const confirmed = ref(false); const busy = ref(false); const failure = ref(''); const message = ref(''); let key = '';
const selectedEnrollment = computed(() => choices.value.find((row: any) => row.id === enrollmentId.value));
const kindLabel = (value: string) => value === 'renewal' ? tr('Повторная подготовка: плановая дата', 'Қайта даярлау: жоспарлы күн') : tr('Окончание доступа к обучению', 'Оқуға қолжетімділіктің аяқталуы');
const stateLabel = (value: string) => ({ active: tr('Запланировано', 'Жоспарланған'), completed: tr('Расписание завершено', 'Кесте аяқталды'), cancelled: tr('Отменено', 'Бас тартылды') }[value] || value);
watch([enrollmentId, kind, dueDate, timezone, offsets, reason], () => { confirmed.value = false; key = ''; });
function reset() { mode.value = 'create'; editing.value = null; enrollmentId.value = ''; reason.value = ''; dueDate.value = ''; confirmed.value = false; key = ''; }
function choose(row: any, action: 'update' | 'cancel') {
  mode.value = action; editing.value = row; enrollmentId.value = row.enrollmentId; kind.value = row.kind; dueDate.value = row.dueDate; timezone.value = row.timezone; offsets.value = row.leadDays.join(','); reason.value = ''; confirmed.value = false; failure.value = ''; message.value = '';
}
async function submit() {
  if (busy.value || !confirmed.value) return;
  busy.value = true; failure.value = ''; message.value = '';
  try {
    if (mode.value === 'cancel') await api(`/learning-reminders/${editing.value.id}/cancel`, { method: 'POST', body: { revision: editing.value.revision, reason: reason.value } });
    else {
      const leadDays = offsets.value.split(',').map(value => Number(value.trim()));
      if (!/^[0-9]+(?:\s*,\s*[0-9]+){0,2}$/.test(offsets.value.trim()) || leadDays.some(value => value > 365) || new Set(leadDays).size !== leadDays.length) throw Object.assign(new Error('INVALID_OFFSETS'), { userMessage: tr('Укажите от 1 до 3 разных целых чисел от 0 до 365 через запятую.', 'Үтірмен 0-ден 365-ке дейін 1–3 түрлі бүтін сан көрсетіңіз.') });
      const common = { timezone: timezone.value, leadDays, reason: reason.value, ...(kind.value === 'renewal' ? { dueDate: dueDate.value } : {}) };
      if (mode.value === 'update') await api(`/learning-reminders/${editing.value.id}/update`, { method: 'POST', body: { ...common, revision: editing.value.revision } });
      else { key ||= crypto.randomUUID(); await api(endpoint.value, { method: 'POST', headers: { 'Idempotency-Key': key }, body: { ...common, enrollmentId: enrollmentId.value, kind: kind.value } }); }
    }
    message.value = mode.value === 'cancel' ? tr('Напоминание отменено. Новых уведомлений по нему не будет.', 'Еске салудан бас тартылды. Ол бойынша жаңа хабарлама болмайды.') : tr('Расписание сохранено. Уведомления появятся в кабинете в выбранные дни при запуске очереди.', 'Кесте сақталды. Таңдалған күндері кезек іске қосылғанда хабарламалар кабинетте пайда болады.');
    reset(); await refresh();
  } catch (cause: any) { failure.value = cause?.userMessage || errorText(cause); }
  finally { busy.value = false; }
}
async function changePage(value: number) { page.value = value; await refresh(); }
async function changeChoices(value: number) { choicePage.value = value; enrollmentId.value = ''; await refreshChoices(); }
</script>
<template>
  <section class="lms-card space-y-5" :aria-label="tr('Расписание напоминаний', 'Еске салу кестесі')">
    <h2 class="text-xl font-bold">{{ tr('Напоминания об обучении', 'Оқу туралы еске салулар') }}</h2>
    <p class="text-sm text-slate-600">{{ tr('Только уведомления в кабинете. Срок доступа берётся из назначения; дату повторной подготовки задаёте вы. Дата не определяет срок действия документа. В выбранный день уведомление создаётся при ближайшем запуске очереди; точное время не обещается.', 'Тек кабинеттегі хабарламалар. Қолжетімділік мерзімі тағайындаудан алынады; қайта даярлау күнін өзіңіз белгілейсіз. Күн құжаттың жарамдылық мерзімін анықтамайды. Таңдалған күні хабарлама кезек келесі рет іске қосылғанда жасалады; нақты уақытқа кепілдік берілмейді.') }}</p>
    <p v-if="organizationId" class="text-sm text-slate-600">{{ tr('Для нового расписания выберите назначение с текущей страницы отчёта выше. Учащийся может отключить напоминания в своём кабинете.', 'Жаңа кесте үшін жоғарыдағы есептің осы бетіндегі тағайындауды таңдаңыз. Тыңдаушы өз кабинетінде еске салуларды өшіре алады.') }}</p>
    <p v-if="failure" class="lms-error" role="alert">{{ failure }}</p><p v-if="message" class="lms-success" role="status">{{ message }}</p>
    <LmsState :pending="pending" :error="error" @retry="refresh()">
      <p v-if="!data?.reminders.length" class="lms-note">{{ tr('Напоминания ещё не назначены.', 'Еске салулар әлі тағайындалмаған.') }}</p>
      <article v-for="row in data?.reminders || []" :key="row.id" class="rounded-xl border p-4 space-y-2" :data-reminder-id="row.id">
        <h3 class="font-semibold">{{ kindLabel(row.kind) }} · {{ row.learnerName }}</h3>
        <p class="text-sm">{{ row.programTitle }}</p>
        <p>{{ row.dueDate }} · {{ row.timezone }} · {{ stateLabel(row.status) }}</p>
        <p class="text-sm">{{ tr('За сколько дней', 'Неше күн бұрын') }}: {{ row.leadDays.join(', ') }}. {{ tr('Создано уведомлений', 'Жасалған хабарламалар') }}: {{ row.delivered }}; {{ tr('ожидают дня', 'күні күтілуде') }}: {{ row.scheduled }}; {{ tr('в очереди', 'кезекте') }}: {{ row.queued }}; {{ tr('пропущено окон доставки', 'өткізіп алынған жеткізу кезеңдері') }}: {{ row.missed }}.</p>
        <p class="text-sm text-slate-600">{{ row.reason }}</p>
        <div class="flex flex-wrap gap-3"><button type="button" class="lms-button secondary" :disabled="busy" @click="choose(row, 'update')">{{ tr('Изменить расписание', 'Кестені өзгерту') }}</button><button v-if="row.status === 'active'" type="button" class="lms-button secondary" :disabled="busy" @click="choose(row, 'cancel')">{{ tr('Отменить напоминание', 'Еске салудан бас тарту') }}</button></div>
      </article>
      <nav v-if="data" class="flex flex-wrap items-center gap-3" :aria-label="tr('Страницы напоминаний', 'Еске салу беттері')"><span>{{ tr('Страница', 'Бет') }} {{ data.pagination.page }} / {{ data.pagination.totalPages }} · {{ tr('Всего', 'Барлығы') }} {{ data.pagination.total }}</span><button type="button" class="lms-button secondary" :disabled="busy || pending || !data.pagination.hasPrevious" @click="changePage(data.pagination.page - 1)">{{ tr('Предыдущие', 'Алдыңғы') }}</button><button type="button" class="lms-button secondary" :disabled="busy || pending || !data.pagination.hasMore" @click="changePage(data.pagination.page + 1)">{{ tr('Следующие', 'Келесі') }}</button></nav>
    </LmsState>
    <form class="space-y-4 border-t pt-5" @submit.prevent="submit">
      <h3 class="font-semibold">{{ mode === 'create' ? tr('Новое напоминание', 'Жаңа еске салу') : mode === 'cancel' ? tr('Подтвердить отмену', 'Бас тартуды растау') : tr('Перенести напоминание', 'Еске салуды ауыстыру') }}</h3>
      <template v-if="mode !== 'cancel'">
        <label class="block space-y-2"><span>{{ tr('Назначение для напоминания', 'Еске салуға арналған тағайындау') }}</span><select v-model="enrollmentId" required :disabled="mode === 'update' || busy"><option value="" disabled>{{ tr('Выберите назначение', 'Тағайындауды таңдаңыз') }}</option><option v-if="editing && !selectedEnrollment" :value="editing.enrollmentId">{{ editing.learnerName }} · {{ editing.enrollmentId }}</option><option v-for="enrollment in choices" :key="enrollment.id" :value="enrollment.id">{{ enrollment.name || '' }} · {{ enrollment.programTitle || enrollment.title }} · {{ enrollment.id.slice(0, 8) }}</option></select></label>
        <nav v-if="!organizationId && personalChoices?.pagination.totalPages > 1" class="flex flex-wrap gap-3" :aria-label="tr('Страницы назначений для напоминания', 'Еске салуға арналған тағайындау беттері')"><span>{{ choicePage }} / {{ personalChoices.pagination.totalPages }}</span><button type="button" class="lms-button secondary" :disabled="busy || mode !== 'create' || !personalChoices.pagination.hasPrevious" @click="changeChoices(choicePage - 1)">{{ tr('Предыдущие назначения', 'Алдыңғы тағайындаулар') }}</button><button type="button" class="lms-button secondary" :disabled="busy || mode !== 'create' || !personalChoices.pagination.hasMore" @click="changeChoices(choicePage + 1)">{{ tr('Следующие назначения', 'Келесі тағайындаулар') }}</button></nav>
        <div class="grid gap-4 sm:grid-cols-2"><label class="block space-y-2"><span>{{ tr('Вид напоминания', 'Еске салу түрі') }}</span><select v-model="kind" :disabled="mode === 'update' || busy"><option value="access_deadline">{{ kindLabel('access_deadline') }}</option><option value="renewal">{{ kindLabel('renewal') }}</option></select></label><label class="block space-y-2"><span>{{ tr('Часовой пояс IANA', 'IANA уақыт белдеуі') }}</span><input v-model="timezone" required maxlength="80" placeholder="Asia/Qyzylorda" :disabled="busy" /></label></div>
        <label v-if="kind === 'renewal'" class="block space-y-2"><span>{{ tr('Плановая дата повторной подготовки', 'Қайта даярлаудың жоспарлы күні') }}</span><input v-model="dueDate" type="date" required :disabled="busy" /></label>
        <p v-else class="lms-note">{{ tr('Фактический срок доступа', 'Нақты қолжетімділік мерзімі') }}: {{ selectedEnrollment?.accessUntil ? date(selectedEnrollment.accessUntil) : editing?.dueAt ? date(editing.dueAt) : tr('У назначения должен быть установлен будущий срок.', 'Тағайындаудың болашақ мерзімі белгіленуі керек.') }}</p>
        <label class="block space-y-2"><span>{{ tr('За сколько календарных дней: до 3 значений через запятую', 'Неше күнтізбелік күн бұрын: үтірмен 3 мәнге дейін') }}</span><input v-model="offsets" required maxlength="20" placeholder="30,7,0" :disabled="busy" /></label>
        <p class="text-sm text-slate-600">{{ tr('0 — в сам день. Прошедшие дни не вызывают рассылку задним числом. Если очередь не запускалась в выбранный день, этот срок будет отмечен как пропущенный.', '0 — сол күні. Өткен күндер үшін хабарлама кейіннен жіберілмейді. Таңдалған күні кезек іске қосылмаса, мерзім өткізіп алынған деп белгіленеді.') }}</p>
      </template>
      <label class="block space-y-2"><span>{{ tr('Основание расписания или изменения', 'Кесте не өзгеріс негіздемесі') }}</span><textarea v-model="reason" required minlength="10" maxlength="1000" :disabled="busy" /></label>
      <label class="flex items-start gap-3"><input v-model="confirmed" type="checkbox" required :disabled="busy" /><span>{{ tr('Подтверждаю выбранное действие и указанные даты.', 'Таңдалған әрекет пен көрсетілген күндерді растаймын.') }}</span></label>
      <div class="flex flex-wrap gap-3"><button class="lms-button" :disabled="busy || !confirmed || mode !== 'cancel' && !enrollmentId">{{ mode === 'cancel' ? tr('Подтвердить отмену напоминания', 'Еске салудан бас тартуды растау') : tr('Сохранить расписание', 'Кестені сақтау') }}</button><button v-if="mode !== 'create'" type="button" class="lms-button secondary" :disabled="busy" @click="reset">{{ tr('Закрыть изменение', 'Өзгертуді жабу') }}</button></div>
    </form>
  </section>
</template>
