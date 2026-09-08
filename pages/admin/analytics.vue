<script setup lang="ts">
import { clientAnalyticsEvents, serverAnalyticsEvents, type LeadCohortReport } from '~/shared/analytics';
import type { SalesReport } from '~/shared/sales-report';

type EventName = typeof clientAnalyticsEvents[number] | typeof serverAnalyticsEvents[number];
interface AnalyticsReport {
  configuration: { enabled: boolean; retentionDays: number | null; consentVersion: string };
  window: { from: string; until: string; days: number; timezone: 'UTC'; bounds: '[from,until)' };
  unit: 'deduplicated_events';
  clientPopulation: 'opted_in_browser_actions';
  serverPopulation: 'confirmed_service_transitions';
  uniqueVisitorsMeasured: false;
  conversionRate: null;
  client: Array<{ name: EventName; events: number }>;
  server: Array<{ name: EventName; events: number }>;
  totals: { client: number; server: number };
  leadCohort: LeadCohortReport;
  sales: SalesReport;
}
const { api, tr, locale } = useLmsApi();
const path = useLocalePath();
const selectedDays = ref(7);
const appliedDays = ref(7);
const { data, pending, error, refresh } = await useAsyncData('lms-admin-analytics', () => api<AnalyticsReport>('/admin/analytics', { query: { days: appliedDays.value } }));
const titles = computed<Record<EventName, string>>(() => ({
  program_view: tr('Открытие программы', 'Бағдарламаны ашу'),
  selection_start: tr('Начало подбора программы', 'Бағдарлама таңдауды бастау'),
  selection_complete: tr('Показ результата подбора', 'Таңдау нәтижесін көрсету'),
  contact_click: tr('Нажатие ссылки для связи', 'Байланыс сілтемесін басу'),
  lead_form_start: tr('Начало заполнения заявки', 'Өтінімді толтыруды бастау'),
  checkout_view: tr('Просмотр условий заказа', 'Тапсырыс шарттарын қарау'),
  lesson_open: tr('Открытие урока', 'Сабақты ашу'),
  support_open: tr('Обращение за помощью', 'Көмекке жүгіну'),
  lead_accepted: tr('Заявка принята сервером', 'Өтінім серверде қабылданды'),
  lead_crm_delivered: tr('Заявка доставлена в CRM', 'Өтінім CRM жүйесіне жеткізілді'),
  enrollment_activated: tr('Доступ к обучению открыт', 'Оқуға қолжетімділік ашылды'),
  lesson_completed: tr('Урок завершён', 'Сабақ аяқталды'),
  assessment_started: tr('Попытка проверки знаний начата', 'Білімді тексеру әрекеті басталды'),
  assessment_submitted: tr('Ответы переданы на проверку', 'Жауаптар тексеруге берілді'),
  assessment_graded: tr('Результат рассчитан сервером', 'Нәтиже серверде есептелді'),
  payment_confirmed: tr('Платёж подтверждён', 'Төлем расталды'),
  refund_confirmed: tr('Возврат подтверждён', 'Қайтару расталды'),
  credential_issued: tr('Документ выдан', 'Құжат берілді'),
  credential_revoked: tr('Документ отозван', 'Құжаттың күші жойылды'),
}));
const groups = computed(() => data.value ? [
  { id: 'client', title: tr('Действия браузера с согласием', 'Келісім берілген браузер әрекеттері'), description: tr('Только действия браузеров, разрешивших необязательную статистику.', 'Міндетті емес статистикаға рұқсат берген браузерлердің әрекеттері ғана.'), total: data.value.totals.client, rows: data.value.client },
  { id: 'server', title: tr('Подтверждённые операции сервера', 'Сервердің расталған операциялары'), description: tr('Зафиксированные переходы состояния услуг. Они не ограничены группой браузеров с согласием.', 'Қызмет күйлерінің тіркелген өзгерістері. Олар келісім берген браузерлер тобымен шектелмейді.'), total: data.value.totals.server, rows: data.value.server },
] : []);
function utc(value: string) {
  return new Intl.DateTimeFormat(locale.value === 'kk' ? 'kk-KZ' : 'ru-KZ', { timeZone: 'UTC', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date(value));
}
async function reload() { appliedDays.value = selectedDays.value; await refresh(); }
useHead(() => ({ title: tr('Статистика действий — OT Center', 'Әрекеттер статистикасы — OT Center'), meta: [{ name: 'robots', content: 'noindex, nofollow' }] }));
</script>
<template>
  <LmsShell :title="tr('Статистика действий', 'Әрекеттер статистикасы')" back="/admin">
    <p class="text-slate-600">{{ tr('Отчёт считает события после удаления повторных отправок. Одно лицо может выполнить несколько событий; уникальные посетители здесь не измеряются.', 'Есеп қайталама жіберілімдерді алып тастағаннан кейінгі оқиғаларды санайды. Бір адам бірнеше оқиға орындай алады; мұнда бірегей келушілер өлшенбейді.') }}</p>
    <p class="lms-note">{{ tr('У браузерных действий и серверных операций разные группы участников. Их отношение не является конверсией, поэтому процент конверсии не рассчитывается. Агрегат может включать тестовые действия этого окружения, в том числе операции sandbox; отдельного разделения по каналам в этом отчёте нет.', 'Браузер әрекеттері мен сервер операцияларының қатысушылар топтары әртүрлі. Олардың арақатынасы конверсия болып саналмайды, сондықтан конверсия пайызы есептелмейді. Жиынтық осы ортаның сынақ әрекеттерін, соның ішінде sandbox операцияларын қамтуы мүмкін; бұл есепте арналар бойынша бөлек көрсетілмейді.') }}</p>
    <form class="lms-card flex flex-wrap items-end gap-4" @submit.prevent="reload">
      <label class="space-y-2"><span>{{ tr('Период отчёта', 'Есеп кезеңі') }}</span><select v-model.number="selectedDays" :disabled="pending"><option :value="7">{{ tr('Последние 7 дней', 'Соңғы 7 күн') }}</option><option :value="14">{{ tr('Последние 14 дней', 'Соңғы 14 күн') }}</option><option :value="30">{{ tr('Последние 30 дней', 'Соңғы 30 күн') }}</option></select></label>
      <button class="lms-button" :disabled="pending">{{ pending ? tr('Обновляем отчёт…', 'Есеп жаңартылуда…') : tr('Обновить отчёт', 'Есепті жаңарту') }}</button>
    </form>
    <LmsState :pending="pending" :error="error" @retry="refresh()">
      <template v-if="data">
        <section class="lms-card space-y-3" :aria-label="tr('Условия отчёта', 'Есеп шарттары')">
          <p class="font-semibold">{{ data.configuration.enabled ? tr('Сбор статистики включён.', 'Статистика жинау қосылған.') : tr('Сбор статистики выключен. Ниже показаны ранее сохранённые события выбранного окна.', 'Статистика жинау өшірілген. Төменде таңдалған аралықта бұрын сақталған оқиғалар көрсетілген.') }}</p>
          <p class="text-sm">{{ tr('Фактическое окно:', 'Нақты аралық:') }} {{ data.window.days }} {{ tr('дней.', 'күн.') }} {{ tr('От', 'Басталуы') }} <time :datetime="data.window.from">{{ utc(data.window.from) }}</time> {{ tr('включительно до', 'қоса алғанда, аяқталуы') }} <time :datetime="data.window.until">{{ utc(data.window.until) }}</time> {{ tr('исключительно, UTC.', 'қоспағанда, UTC.') }}</p>
          <p v-if="data.window.days < appliedDays" class="text-sm">{{ tr('Выбранный период ограничен настроенным окном хранения статистики.', 'Таңдалған кезең статистиканы сақтау баптауымен шектелген.') }}</p>
          <p class="text-sm">{{ tr('Окно хранения в настройках:', 'Баптаулардағы сақтау аралығы:') }} {{ data.configuration.retentionDays == null ? tr('не настроено', 'бапталмаған') : data.configuration.retentionDays + ' ' + tr('дней', 'күн') }}. {{ tr('Очистка выполняется отдельным серверным заданием. Отчёт обновляется при открытии и вручную.', 'Тазалау бөлек серверлік тапсырмамен орындалады. Есеп ашылғанда және қолмен жаңартылады.') }}</p>
        </section>
        <p v-if="data.totals.client === 0 && data.totals.server === 0" class="lms-note" role="status">{{ tr('В выбранном окне событий нет.', 'Таңдалған аралықта оқиғалар жоқ.') }}</p>
        <div class="grid gap-6 lg:grid-cols-2">
          <section v-for="group in groups" :key="group.id" class="lms-card min-w-0 space-y-4" :aria-label="group.title">
            <h2 class="text-xl font-semibold">{{ group.title }}</h2>
            <p class="text-sm text-slate-600">{{ group.description }}</p>
            <p class="font-semibold">{{ tr('Всего событий:', 'Оқиғалар саны:') }} {{ group.total }}</p>
            <table class="w-full text-sm"><caption class="sr-only">{{ group.title }}</caption><thead><tr class="border-b text-left"><th scope="col" class="py-3 pr-3">{{ tr('Действие', 'Әрекет') }}</th><th scope="col" class="whitespace-nowrap py-3 text-right">{{ tr('События', 'Оқиғалар') }}</th></tr></thead><tbody><tr v-for="row in group.rows" :key="row.name" class="border-b last:border-0"><th scope="row" class="py-3 pr-3 text-left font-normal">{{ titles[row.name] || tr('Другой тип события', 'Оқиғаның басқа түрі') }}</th><td class="py-3 text-right tabular-nums">{{ row.events }}</td></tr></tbody></table>
          </section>
        </div>
        <LmsLeadCohort v-if="data.leadCohort" :report="data.leadCohort" />
        <LmsSalesFunnel v-if="data.sales" :report="data.sales" />
      </template>
    </LmsState>
    <NuxtLink v-if="lmsErrorStatus(error) === 403" class="lms-button secondary" :to="path('/cabinet/security')">{{ tr('Проверить подтверждение безопасности входа', 'Кіру қауіпсіздігін растауды тексеру') }}</NuxtLink>
  </LmsShell>
</template>
