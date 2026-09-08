<script setup lang="ts">
import type { SalesLeadDetail as LeadDetail, SalesTargetChoice as TargetChoice, SalesRequestType } from '~/shared/sales-report';
import { resolveCourseDirection } from '~/shared/course-registry';
import { leadCityLabel, leadFormats } from '~/shared/lead-context';
const props = defineProps<{ leadId: string }>();
const emit = defineEmits<{ changed: [] }>();
const { api, tr, date, locale, statusLabel, errorText } = useLmsApi();
const { data, pending, error, refresh } = await useAsyncData('lms-sales-lead-' + props.leadId, () => api<{ lead: LeadDetail }>('/admin/leads/' + encodeURIComponent(props.leadId)));
const lead = computed(() => data.value?.lead);
const busy = ref(false); const failure = ref(''); const success = ref('');
const qualification = ref(''); const qualificationReason = ref('');
const requestType = ref<SalesRequestType>('unspecified');
const action = ref(''); const reason = ref(''); const confirmed = ref(false);
const linkId = ref(''); const proposalId = ref(''); const targetKind = ref('order');
const targetQuery = ref(''); const targetPage = ref(1); const targetBusy = ref(false); const targetError = ref('');
const targetData = ref<{ targets: TargetChoice[]; pagination: { page: number; total: number; hasMore: boolean } } | null>(null);
const selectedTargets = ref<TargetChoice[]>([]);
const sentAt = ref(''); const reference = ref('');
let mutationKey = ''; let mutationSignature = '';
const qualificationOptions = computed(() => lead.value?.qualification.status === 'in_review' ? ['qualified', 'rejected'] : ['in_review']);
const stages = computed<Record<string, string>>(() => ({ new: tr('Новая', 'Жаңа'), in_review: tr('На рассмотрении', 'Қаралуда'), qualified: tr('Квалифицирована', 'Іріктелген'), rejected: tr('Не подходит', 'Сәйкес емес') }));
const requestTypes = computed(() => ({ unspecified: tr('Ещё не определён', 'Әлі анықталмаған'), training: tr('Обучение', 'Оқу'), document_status: tr('Вопрос о статусе документа', 'Құжат күйі туралы сұрақ'), other: tr('Другое обращение', 'Басқа өтініш') }));
const kinds = computed<Record<string, string>>(() => ({ order: tr('Заказ', 'Тапсырыс'), enrollment: tr('Назначение обучения', 'Оқуды тағайындау'), organization: tr('Организация', 'Ұйым'), invoice: tr('Корпоративный счёт', 'Корпоративтік шот') }));
const selectedProposal = computed(() => lead.value?.proposals.find(proposal => proposal.id === proposalId.value));
const needsTarget = computed(() => ['link', 'organization', 'assignments'].includes(action.value));
const multipleTargets = computed(() => action.value === 'assignments' && targetKind.value === 'enrollment');
const actionTitles = computed<Record<string, string>>(() => ({ link: tr('Связать запись с заявкой', 'Жазбаны өтініммен байланыстыру'), revoke: tr('Отозвать ошибочную связь', 'Қате байланысты қайтарып алу'), proposal: tr('Зафиксировать отправленное предложение', 'Жіберілген ұсынысты тіркеу'), organization: tr('Связать предложение с организацией', 'Ұсынысты ұйыммен байланыстыру'), assignments: tr('Указать назначения по предложению', 'Ұсыныс бойынша тағайындауларды көрсету'), withdraw: tr('Отозвать предложение', 'Ұсынысты қайтарып алу') }));
const actionTitle = computed(() => actionTitles.value[action.value] || '');
const deliveryTitles = computed<Record<string, string>>(() => ({ delivered: tr('Доставка в CRM подтверждена', 'CRM жүйесіне жеткізу расталды'), note_pending: tr('Примечание CRM не подтверждено', 'CRM ескертпесі расталмаған'), accepted: tr('Принята локально, доставка CRM не подтверждена', 'Жергілікті қабылданды, CRM жеткізуі расталмаған') }));
const delivery = (status: string) => deliveryTitles.value[status] || tr('Статус доставки требует проверки', 'Жеткізу күйін тексеру қажет');
const contextualFields = computed(() => {
  const value = lead.value?.context; const language = locale.value === 'kk' ? 'kk' : 'ru';
  return { [tr('Направление', 'Бағыт')]: resolveCourseDirection(value?.programId)?.title[language] || value?.programId,
    [tr('Город', 'Қала')]: leadCityLabel(value?.city || '', language) || value?.city,
    [tr('Формат', 'Формат')]: leadFormats.find(format => format.id === value?.format)?.title[language] || value?.format,
    [tr('Язык', 'Тіл')]: value?.locale === 'kk' ? 'Қазақша' : value?.locale === 'ru' ? 'Русский' : value?.locale };
});
const targetStatus = (target: TargetChoice) => targetKind.value === 'organization' && target.status === 'active' ? tr('Действующая организация', 'Қолданыстағы ұйым') : target.status === 'created' ? tr('Создан, исполнение не подтверждено', 'Құрылды, орындалуы расталмаған') : target.status === 'confirmed' ? tr('Исполнение подтверждено', 'Орындалуы расталды') : statusLabel(target.status);
function salesError(cause: any) {
  const code = cause?.data?.data?.code || cause?.data?.code || cause?.data?.statusMessage;
  const messages: Record<string, string> = {
    SALES_ORGANIZATION_MISMATCH: tr('Выбранная запись относится к другой организации. Проверьте предложение и выберите её назначение или счёт.', 'Таңдалған жазба басқа ұйымға тиесілі. Ұсынысты тексеріп, оның тағайындауын немесе шотын таңдаңыз.'),
    SALES_TARGET_ALREADY_LINKED: tr('Эта запись уже связана с другой заявкой или предложением. Сначала проверьте существующую связь.', 'Бұл жазба басқа өтініммен немесе ұсыныспен байланыстырылған. Алдымен бар байланысты тексеріңіз.'),
    PROPOSAL_TIME_INVALID: tr('Дата отправки должна быть после приёма заявки и не позже текущего времени.', 'Жіберу күні өтінім қабылданғаннан кейін және ағымдағы уақыттан кеш болмауы керек.'),
    PROPOSAL_REFERENCE_EXISTS: tr('Предложение с таким подтверждением уже зарегистрировано. Обновите список.', 'Осындай растауы бар ұсыныс тіркелген. Тізімді жаңартыңыз.'),
    PROPOSAL_ORGANIZATION_IMMUTABLE: tr('Организация этого предложения уже закреплена. Для исправления отзовите предложение и зарегистрируйте новое.', 'Бұл ұсыныстың ұйымы бекітілген. Түзету үшін ұсынысты қайтарып алып, жаңасын тіркеңіз.'),
    CONFIRMED_INVOICE_REQUIRED: tr('Связать назначения можно только по счёту с подтверждённым исполнением.', 'Тағайындауларды орындалуы расталған шот бойынша ғана байланыстыруға болады.'),
  };
  return messages[code] || errorText(cause);
}
watch(() => lead.value?.qualification.status, () => { qualification.value = qualificationOptions.value[0] || ''; }, { immediate: true });
watch(() => lead.value?.qualification.requestType, value => { requestType.value = value || 'unspecified'; }, { immediate: true });
watch(targetKind, () => { selectedTargets.value = []; targetData.value = null; targetPage.value = 1; targetQuery.value = ''; confirmed.value = false; });
watch([reason, reference, sentAt, selectedTargets], () => { confirmed.value = false; }, { deep: true });
function choose(kind: string, id = '', type = 'order') {
  action.value = kind; linkId.value = kind === 'revoke' ? id : ''; proposalId.value = ['organization', 'assignments', 'withdraw'].includes(kind) ? id : '';
  targetKind.value = type; targetQuery.value = ''; targetPage.value = 1; targetData.value = null; selectedTargets.value = []; targetError.value = '';
  reason.value = ''; confirmed.value = false; reference.value = ''; sentAt.value = ''; failure.value = ''; success.value = '';
}
async function targets(page = 1) {
  targetBusy.value = true; targetError.value = ''; targetPage.value = page;
  try { targetData.value = await api('/admin/leads/targets', { query: { kind: targetKind.value, query: targetQuery.value, page } }); }
  catch (cause) { targetError.value = salesError(cause); }
  finally { targetBusy.value = false; }
}
function selectTarget(target: TargetChoice, selected: boolean) {
  if (!multipleTargets.value) selectedTargets.value = selected ? [target] : [];
  else if (selected && !selectedTargets.value.some(item => item.id === target.id) && selectedTargets.value.length < 100) selectedTargets.value = [...selectedTargets.value, target];
  else if (!selected) selectedTargets.value = selectedTargets.value.filter(item => item.id !== target.id);
}
async function mutate(suffix: string, body: Record<string, unknown>) {
  if (busy.value) return false;
  busy.value = true; failure.value = ''; success.value = '';
  const url = '/admin/leads/' + encodeURIComponent(props.leadId) + suffix;
  const signature = JSON.stringify({ url, body });
  if (!mutationKey || signature !== mutationSignature) { mutationKey = crypto.randomUUID(); mutationSignature = signature; }
  try {
    const result = await api<{ lead: LeadDetail }>(url, { method: 'POST', headers: { 'Idempotency-Key': mutationKey }, body });
    data.value = result; mutationKey = ''; mutationSignature = ''; action.value = ''; qualificationReason.value = ''; confirmed.value = false;
    success.value = tr('Изменение сохранено сервером. Актуальные записи показаны ниже.', 'Өзгеріс серверде сақталды. Өзекті жазбалар төменде көрсетілген.'); emit('changed'); return true;
  } catch (cause) { failure.value = salesError(cause); return false; }
  finally { busy.value = false; }
}
async function qualify() {
  if (!lead.value) return;
  await mutate('/qualification', { status: qualification.value, requestType: requestType.value, revision: lead.value.qualification.revision, reason: qualificationReason.value });
}
async function executeAction() {
  if (!confirmed.value) return;
  const target = selectedTargets.value[0];
  if (action.value === 'link' && target) await mutate('/links', { kind: targetKind.value, targetId: target.id, reason: reason.value });
  else if (action.value === 'revoke') await mutate('/links/' + encodeURIComponent(linkId.value) + '/revoke', { reason: reason.value });
  else if (action.value === 'proposal') await mutate('/proposals', { sentAt: new Date(sentAt.value).toISOString(), reference: reference.value, reason: reason.value });
  else if (action.value === 'organization' && target) await mutate('/proposals/' + encodeURIComponent(proposalId.value) + '/organization', { organizationId: target.id, reason: reason.value });
  else if (action.value === 'assignments' && selectedTargets.value.length) await mutate('/proposals/' + encodeURIComponent(proposalId.value) + '/assignments', { ...(targetKind.value === 'invoice' ? { invoiceId: target?.id } : { enrollmentIds: selectedTargets.value.map(item => item.id) }), reason: reason.value });
  else if (action.value === 'withdraw') await mutate('/proposals/' + encodeURIComponent(proposalId.value) + '/withdraw', { reason: reason.value });
}
</script>
<template>
  <section class="space-y-5" :aria-label="tr('Работа с выбранной заявкой', 'Таңдалған өтініммен жұмыс')">
    <LmsState :pending="pending" :error="error" @retry="refresh()">
      <template v-if="lead">
        <div class="lms-card space-y-4">
          <h2 class="text-2xl font-bold">{{ tr('Выбранная заявка', 'Таңдалған өтінім') }}</h2>
          <p class="break-all text-sm">{{ lead.id }} · {{ date(lead.createdAt) }}</p>
          <dl class="grid gap-3 sm:grid-cols-2"><div v-for="(value, label) in { [tr('Имя', 'Аты')]: lead.contact.name, Email: lead.contact.email, [tr('Телефон', 'Телефон')]: lead.contact.phone, [tr('Организация', 'Ұйым')]: lead.contact.organizationName, ...contextualFields }" :key="label"><dt class="text-sm text-slate-500">{{ label }}</dt><dd class="break-words">{{ value || tr('Не указано', 'Көрсетілмеген') }}</dd></div></dl>
          <p class="whitespace-pre-wrap break-words">{{ lead.context.comment }}</p>
          <p class="text-sm">{{ delivery(lead.deliveryStatus) }}</p>
          <p class="font-semibold">{{ tr('Этап:', 'Кезең:') }} {{ stages[lead.qualification.status] }}</p>
          <button class="lms-button secondary" :disabled="busy" @click="refresh()">{{ tr('Обновить выбранную заявку', 'Таңдалған өтінімді жаңарту') }}</button>
        </div>
        <form class="lms-card space-y-4" @submit.prevent="qualify">
          <h3 class="text-xl font-semibold">{{ tr('Решение по обращению', 'Өтініш бойынша шешім') }}</h3>
          <label class="block space-y-2"><span>{{ tr('Следующий этап', 'Келесі кезең') }}</span><select v-model="qualification" :disabled="busy"><option v-for="value in qualificationOptions" :key="value" :value="value">{{ stages[value] }}</option></select></label>
          <label class="block space-y-2"><span>{{ tr('Проверенный тип обращения', 'Тексерілген өтініш түрі') }}</span><select v-model="requestType" :disabled="busy"><option v-for="(label, value) in requestTypes" :key="value" :value="value">{{ label }}</option></select></label>
          <label class="block space-y-2"><span>{{ tr('Обоснование решения', 'Шешімнің негіздемесі') }}</span><textarea v-model="qualificationReason" required minlength="10" maxlength="2000" :disabled="busy" /></label>
          <p class="text-sm text-slate-600">{{ tr('Квалификация — решение сотрудника о соответствии обращения. Она не подтверждает оплату, обучение или выдачу документа.', 'Іріктеу — өтініштің сәйкестігі туралы қызметкер шешімі. Ол төлемді, оқуды немесе құжат беруді растамайды.') }}</p>
          <button class="lms-button" :disabled="busy">{{ tr('Сохранить этап заявки', 'Өтінім кезеңін сақтау') }}</button>
        </form>
        <div class="lms-card space-y-4">
          <h3 class="text-xl font-semibold">{{ tr('Связанные записи', 'Байланысты жазбалар') }}</h3>
          <p v-if="!lead.links.length" class="text-sm">{{ tr('Связей пока нет.', 'Байланыстар әзірге жоқ.') }}</p>
          <ul class="space-y-3"><li v-for="link in lead.links" :key="link.id" class="rounded-lg border p-3 space-y-2"><p>{{ kinds[link.kind] }} · {{ link.revokedAt ? tr('Связь отозвана', 'Байланыс қайтарылған') : tr('Действующая связь', 'Қолданыстағы байланыс') }}</p><p class="break-all text-sm">{{ link.targetId }}</p><p v-if="link.proposalId" class="break-all text-xs">{{ tr('Предложение:', 'Ұсыныс:') }} {{ link.proposalId }}</p><button v-if="!link.revokedAt" class="lms-button secondary" :disabled="busy" @click="choose('revoke', link.id)">{{ tr('Исправить связь', 'Байланысты түзету') }}</button></li></ul>
          <div v-if="lead.qualification.status === 'qualified' && lead.audience === 'b2c'" class="flex flex-wrap gap-3"><button class="lms-button secondary" :disabled="busy" @click="choose('link', '', 'order')">{{ tr('Связать заказ', 'Тапсырысты байланыстыру') }}</button><button class="lms-button secondary" :disabled="busy" @click="choose('link', '', 'enrollment')">{{ tr('Связать назначение обучения', 'Оқу тағайындауын байланыстыру') }}</button></div>
        </div>
        <div v-if="lead.audience === 'b2b'" class="lms-card space-y-4">
          <h3 class="text-xl font-semibold">{{ tr('Предложения организации', 'Ұйымға ұсыныстар') }}</h3>
          <p class="text-sm text-slate-600">{{ tr('Здесь фиксируются уже отправленные предложения и их точные связи. Форма не отправляет письма и не создаёт назначения обучения.', 'Мұнда бұрын жіберілген ұсыныстар мен олардың нақты байланыстары тіркеледі. Нысан хат жібермейді және оқуды тағайындамайды.') }}</p>
          <p v-if="!lead.proposals.length">{{ tr('Предложения не зарегистрированы.', 'Ұсыныстар тіркелмеген.') }}</p>
          <article v-for="proposal in lead.proposals" :key="proposal.id" class="rounded-lg border p-4 space-y-3">
            <p class="font-semibold break-words">{{ proposal.reference }}</p><p>{{ date(proposal.sentAt) }} · {{ proposal.status === 'withdrawn' ? tr('Отозвано', 'Қайтарылған') : tr('Отправка зафиксирована', 'Жіберу тіркелген') }}</p><p class="break-all text-xs">{{ proposal.id }}</p><p class="break-all text-sm">{{ tr('Организация:', 'Ұйым:') }} {{ proposal.organizationId || tr('Ещё не связана', 'Әлі байланыстырылмаған') }}</p>
            <div v-if="proposal.status === 'sent' && lead.qualification.status === 'qualified'" class="flex flex-wrap gap-3"><button v-if="!proposal.organizationId" class="lms-button secondary" :disabled="busy" @click="choose('organization', proposal.id, 'organization')">{{ tr('Выбрать организацию', 'Ұйымды таңдау') }}</button><button v-if="proposal.organizationId" class="lms-button secondary" :disabled="busy" @click="choose('assignments', proposal.id, 'enrollment')">{{ tr('Указать назначения', 'Тағайындауларды көрсету') }}</button><button class="lms-button secondary" :disabled="busy" @click="choose('withdraw', proposal.id)">{{ tr('Отозвать предложение', 'Ұсынысты қайтарып алу') }}</button></div>
          </article>
          <button v-if="lead.qualification.status === 'qualified'" class="lms-button secondary" :disabled="busy" @click="choose('proposal')">{{ tr('Зарегистрировать отправленное предложение', 'Жіберілген ұсынысты тіркеу') }}</button>
        </div>
        <section v-if="action" class="lms-card space-y-5" :aria-label="tr('Проверка выбранного действия', 'Таңдалған әрекетті тексеру')">
          <h3 class="text-xl font-semibold">{{ actionTitle }}</h3>
          <p class="break-all text-sm">{{ tr('Заявка:', 'Өтінім:') }} {{ lead.id }}</p>
          <p v-if="selectedProposal" class="break-words">{{ tr('Предложение:', 'Ұсыныс:') }} {{ selectedProposal.reference }} · {{ selectedProposal.organizationId }}</p>
          <p v-if="action === 'revoke'" class="break-all">{{ tr('Отзывается только связь с записью:', 'Тек осы жазбамен байланыс қайтарылады:') }} {{ lead.links.find(link => link.id === linkId)?.targetId }}. {{ tr('Заказ и обучение сохраняются.', 'Тапсырыс пен оқу сақталады.') }}</p>
          <template v-if="needsTarget">
            <form class="space-y-4" @submit.prevent="targets(1)">
              <label v-if="action === 'assignments'" class="block space-y-2"><span>{{ tr('Источник назначений', 'Тағайындаулар дереккөзі') }}</span><select v-model="targetKind" :disabled="busy || targetBusy"><option value="enrollment">{{ tr('Конкретные назначения', 'Нақты тағайындаулар') }}</option><option value="invoice">{{ tr('Исполненный корпоративный счёт', 'Орындалған корпоративтік шот') }}</option></select></label>
              <label class="block space-y-2"><span>{{ tr('Номер записи или начало номера (необязательно)', 'Жазба нөмірі немесе нөмірдің басы (міндетті емес)') }}</span><input v-model="targetQuery" maxlength="100" :disabled="targetBusy || busy" /></label><button class="lms-button secondary" :disabled="targetBusy || busy">{{ tr('Найти доступные записи', 'Қолжетімді жазбаларды табу') }}</button>
            </form>
            <p v-if="targetError" class="lms-error" role="alert">{{ targetError }}</p><p v-if="targetBusy" class="lms-note" role="status">{{ tr('Загружаем записи…', 'Жазбалар жүктелуде…') }}</p>
            <template v-if="targetData"><p class="text-sm">{{ kinds[targetKind] }} · {{ tr('Найдено:', 'Табылды:') }} {{ targetData.pagination.total }}</p><p v-if="!targetData.targets.length" role="status">{{ tr('Записи не найдены.', 'Жазбалар табылмады.') }}</p><ul class="space-y-3"><li v-for="target in targetData.targets" :key="target.id"><label class="flex items-start gap-3 rounded-lg border p-3"><input :type="multipleTargets ? 'checkbox' : 'radio'" name="lead-target" :checked="selectedTargets.some(item => item.id === target.id)" :disabled="busy || targetBusy || (multipleTargets && selectedTargets.length >= 100 && !selectedTargets.some(item => item.id === target.id))" @change="selectTarget(target, ($event.target as HTMLInputElement).checked)" /><span class="min-w-0 break-words">{{ target.label }}<span class="block break-all text-xs text-slate-500">{{ target.id }} · {{ targetStatus(target) }}<span v-if="target.organizationId"> · {{ target.organizationId }}</span></span></span></label></li></ul><div class="flex flex-wrap gap-3"><button class="lms-button secondary" :disabled="busy || targetBusy || targetData.pagination.page <= 1" @click="targets(targetData.pagination.page - 1)">{{ tr('Предыдущие записи', 'Алдыңғы жазбалар') }}</button><button class="lms-button secondary" :disabled="busy || targetBusy || !targetData.pagination.hasMore" @click="targets(targetData.pagination.page + 1)">{{ tr('Следующие записи', 'Келесі жазбалар') }}</button></div></template>
            <div v-if="selectedTargets.length" class="rounded-lg border border-brand-accent p-4 space-y-2"><p class="font-semibold">{{ tr('Выбрано для связи:', 'Байланыстыру үшін таңдалды:') }} {{ selectedTargets.length }}</p><ul class="space-y-2"><li v-for="target in selectedTargets" :key="target.id" class="break-words text-sm">{{ target.label }} · <span class="break-all">{{ target.id }}</span></li></ul><p v-if="action === 'assignments'" class="text-sm">{{ tr('Сервер проверит принадлежность организации и состав назначений. Выбор не подтверждает оплату или завершение обучения.', 'Сервер ұйымға тиесілілікті және тағайындаулар құрамын тексереді. Таңдау төлемді немесе оқудың аяқталуын растамайды.') }}</p></div>
          </template>
          <form class="space-y-4" @submit.prevent="executeAction">
            <template v-if="action === 'proposal'"><label class="block space-y-2"><span>{{ tr('Когда предложение действительно отправлено (местное время)', 'Ұсыныс нақты қашан жіберілді (жергілікті уақыт)') }}</span><input v-model="sentAt" type="datetime-local" step="1" required :disabled="busy" /></label><label class="block space-y-2"><span>{{ tr('Номер или ссылка на подтверждение отправки', 'Жіберу растауының нөмірі немесе сілтемесі') }}</span><input v-model="reference" required minlength="3" maxlength="200" :disabled="busy" /></label></template>
            <label class="block space-y-2"><span>{{ tr('Обоснование действия', 'Әрекеттің негіздемесі') }}</span><textarea v-model="reason" required minlength="10" maxlength="2000" :disabled="busy" /></label>
            <label class="flex items-start gap-3 text-sm"><input v-model="confirmed" type="checkbox" required :disabled="busy || (needsTarget && !selectedTargets.length)" /><span>{{ tr('Проверил выбранную заявку, связанные записи и основание этого действия.', 'Таңдалған өтінімді, байланысты жазбаларды және әрекеттің негізін тексердім.') }}</span></label>
            <div class="flex flex-wrap gap-3"><button class="lms-button" :disabled="busy || !confirmed || (needsTarget && !selectedTargets.length)">{{ busy ? tr('Сохраняем…', 'Сақталуда…') : actionTitle }}</button><button type="button" class="lms-button secondary" :disabled="busy" @click="action = ''">{{ tr('Отменить действие', 'Әрекеттен бас тарту') }}</button></div>
          </form>
        </section>
      </template>
    </LmsState>
    <p v-if="failure" class="lms-error" role="alert">{{ failure }}</p><p v-if="success" class="lms-success" role="status">{{ success }}</p>
  </section>
</template>
