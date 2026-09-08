<script setup lang="ts">
import type { LeadCohortCounts, LeadCohortReport } from '~/shared/analytics';

const props = defineProps<{ report: LeadCohortReport }>();
const { tr, locale } = useLmsApi();
const audiences = computed(() => props.report.audiences.filter(row => row.audience !== 'unknown' || row.accepted > 0));
function audienceTitle(audience: 'b2c' | 'b2b' | 'unknown') {
  return audience === 'b2b' ? tr('Обращения компаний', 'Компаниялардың өтініштері')
    : audience === 'b2c' ? tr('Индивидуальные обращения', 'Жеке өтініштер')
      : tr('Тип обращения требует проверки', 'Өтініш түрін тексеру қажет');
}
function counts(row: LeadCohortCounts) {
  return [
    { name: tr('Принято', 'Қабылданды'), value: row.accepted },
    { name: tr('Доставлено в CRM', 'CRM жүйесіне жеткізілді'), value: row.delivered },
    { name: tr('Доставка не подтверждена', 'Жеткізу расталмаған'), value: row.pending },
    { name: tr('Из них: примечание не подтверждено', 'Оның ішінде: ескертпе расталмаған'), value: row.notePending },
    { name: tr('Некорректные данные — нужна проверка', 'Деректер қате — тексеру қажет'), value: row.invalid },
  ];
}
function percent(value: number | null) {
  return value === null ? tr('Нет заявок для расчёта', 'Есептеу үшін өтінімдер жоқ')
    : new Intl.NumberFormat(locale.value === 'kk' ? 'kk-KZ' : 'ru-KZ', { style: 'percent', maximumFractionDigits: 1 }).format(value);
}
function utc(value: string) {
  return new Intl.DateTimeFormat(locale.value === 'kk' ? 'kk-KZ' : 'ru-KZ', { timeZone: 'UTC', dateStyle: 'short', timeStyle: 'medium' }).format(new Date(value));
}
</script>

<template>
  <section class="lms-card min-w-0 space-y-5" :aria-label="tr('Доставка принятых заявок', 'Қабылданған өтінімдерді жеткізу')">
    <h2 class="text-xl font-semibold">{{ tr('Доставка принятых заявок', 'Қабылданған өтінімдерді жеткізу') }}</h2>
    <p class="text-sm text-slate-600">{{ tr('Здесь считаются заявки, принятые в выбранном окне, и текущее состояние доставки именно этих заявок. Обращение, принятое раньше этого окна, не попадёт в расчёт, даже если его доставили сегодня. Повтор отправки одной заявки не увеличивает число обращений.', 'Мұнда таңдалған аралықта қабылданған өтінімдер және дәл сол өтінімдердің ағымдағы жеткізу күйі есептеледі. Осы аралықтан бұрын қабылданған өтініш бүгін жеткізілсе де, есепке кірмейді. Бір өтінімді қайта жіберу өтініштер санын арттырмайды.') }}</p>
    <p class="text-sm">{{ tr('Приём заявок:', 'Өтінімдерді қабылдау:') }} <time :datetime="report.window.from">{{ utc(report.window.from) }}</time> — <time :datetime="report.window.until">{{ utc(report.window.until) }}</time> {{ tr('(начало включено, конец исключён), UTC.', '(басталуы кіреді, аяқталуы кірмейді), UTC.') }} {{ tr('Состояние при чтении отчёта:', 'Есеп оқылған кездегі күй:') }} <time :datetime="report.asOf">{{ utc(report.asOf) }}</time> UTC.</p>
    <p class="lms-note">{{ tr('Источник — служебные записи приёма и доставки, включая обращения без согласия на необязательную статистику. Этот раздел доступен при выключенном сборе событий. Доля доставленных относится к заявкам и не измеряет конверсию посетителей, продажи или качество обращения.', 'Дереккөз — міндетті емес статистикаға келісімсіз өтініштерді қоса алғанда, қабылдау және жеткізу қызметтік жазбалары. Бұл бөлім оқиғаларды жинау өшірілгенде де қолжетімді. Жеткізілгендердің үлесі өтінімдерге қатысты және келушілер конверсиясын, сатылымды немесе өтініш сапасын өлшемейді.') }}</p>
    <p v-if="report.totals.accepted === 0" role="status">{{ tr('В выбранном окне принятых заявок нет.', 'Таңдалған аралықта қабылданған өтінімдер жоқ.') }}</p>
    <div class="rounded-lg bg-slate-50 p-4">
      <h3 class="font-semibold">{{ tr('Все обращения', 'Барлық өтініштер') }}</h3>
      <dl class="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div v-for="item in counts(report.totals)" :key="item.name"><dt class="text-sm text-slate-600">{{ item.name }}</dt><dd class="font-semibold tabular-nums">{{ item.value }}</dd></div>
        <div><dt class="text-sm text-slate-600">{{ tr('Доля доставленных от принятых', 'Қабылданғандардың ішіндегі жеткізілгендер үлесі') }}</dt><dd class="font-semibold tabular-nums">{{ percent(report.totals.deliveryRate) }}</dd></div>
      </dl>
    </div>
    <div class="grid gap-4 lg:grid-cols-2">
      <article v-for="row in audiences" :key="row.audience" class="min-w-0 rounded-lg border border-slate-200 p-4" :aria-label="audienceTitle(row.audience)">
        <h3 class="font-semibold">{{ audienceTitle(row.audience) }}</h3>
        <dl class="mt-3 space-y-3">
          <div v-for="item in counts(row)" :key="item.name" class="flex items-start justify-between gap-3"><dt class="min-w-0 text-sm text-slate-600">{{ item.name }}</dt><dd class="shrink-0 font-semibold tabular-nums">{{ item.value }}</dd></div>
          <div class="border-t border-slate-200 pt-3"><dt class="text-sm text-slate-600">{{ tr('Доля доставленных от принятых', 'Қабылданғандардың ішіндегі жеткізілгендер үлесі') }}</dt><dd class="font-semibold tabular-nums">{{ percent(row.deliveryRate) }}</dd></div>
        </dl>
      </article>
    </div>
    <p class="text-sm text-slate-600">{{ tr('Примечание без подтверждения входит в число заявок с неподтверждённой доставкой. Этот счётчик не обещает автоматический повтор: причины ошибок и остановленные задания проверяются в операционном разделе.', 'Расталмаған ескертпе жеткізілуі расталмаған өтінімдер санына кіреді. Бұл есептегіш автоматты қайталауды уәде етпейді: қате себептері мен тоқтатылған тапсырмалар операциялық бөлімде тексеріледі.') }}</p>
  </section>
</template>
