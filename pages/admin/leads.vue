<script setup lang="ts">
import type { SalesLeadSummary as LeadSummary } from '~/shared/sales-report';
const { api, tr, date } = useLmsApi();
const path = useLocalePath();
const selectedStatus = ref('all');
const appliedStatus = ref('all');
const page = ref(1);
const selectedId = ref('');
const { data, pending, error, refresh } = await useAsyncData('lms-sales-leads', () => api<{ leads: LeadSummary[]; pagination: { page: number; pageSize: number; total: number; hasMore: boolean } }>('/admin/leads', { query: { page: page.value, status: appliedStatus.value } }));
const stages = computed(() => ({ new: tr('Новая', 'Жаңа'), in_review: tr('На рассмотрении', 'Қаралуда'), qualified: tr('Квалифицирована', 'Іріктелген'), rejected: tr('Не подходит', 'Сәйкес емес') }));
async function search() { page.value = 1; appliedStatus.value = selectedStatus.value; await refresh(); }
async function turn(delta: number) { page.value += delta; await refresh(); }
useHead(() => ({ title: tr('Заявки и этапы работы — OT Center', 'Өтінімдер және жұмыс кезеңдері — OT Center'), meta: [{ name: 'robots', content: 'noindex, nofollow' }] }));
</script>
<template>
  <LmsShell :title="tr('Заявки и этапы работы', 'Өтінімдер және жұмыс кезеңдері')" back="/admin">
    <p class="text-slate-600">{{ tr('Рассмотрите обращение и явно укажите относящиеся к нему записи. Совпадение имени или email не создаёт связь автоматически.', 'Өтінішті қарап, оған қатысты жазбаларды нақты көрсетіңіз. Аты немесе email сәйкес келсе де, байланыс автоматты түрде құрылмайды.') }}</p>
    <form class="lms-card flex flex-wrap items-end gap-4" @submit.prevent="search">
      <label class="space-y-2"><span>{{ tr('Этап заявки', 'Өтінім кезеңі') }}</span><select v-model="selectedStatus" :disabled="pending"><option value="all">{{ tr('Все этапы', 'Барлық кезеңдер') }}</option><option v-for="(label, value) in stages" :key="value" :value="value">{{ label }}</option></select></label>
      <button class="lms-button" :disabled="pending">{{ tr('Обновить список заявок', 'Өтінімдер тізімін жаңарту') }}</button>
      <NuxtLink class="lms-button secondary" :to="path('/admin/analytics')">{{ tr('Отчёты по этапам', 'Кезеңдер бойынша есептер') }}</NuxtLink>
    </form>
    <LmsState :pending="pending" :error="error" @retry="refresh()">
      <template v-if="data">
        <p class="text-sm">{{ tr('Найдено заявок:', 'Табылған өтінімдер:') }} {{ data.pagination.total }}</p>
        <p v-if="!data.leads.length" class="lms-note" role="status">{{ tr('На выбранном этапе заявок нет.', 'Таңдалған кезеңде өтінімдер жоқ.') }}</p>
        <ul class="grid gap-4 md:grid-cols-2">
          <li v-for="lead in data.leads" :key="lead.id" class="lms-card min-w-0 space-y-3" :class="selectedId === lead.id ? 'border-brand-accent' : ''">
            <p class="font-semibold break-words">{{ lead.contact.organizationName || lead.contact.name || tr('Обращение без имени', 'Аты көрсетілмеген өтініш') }}</p>
            <p class="break-all text-sm">{{ lead.contact.email || lead.contact.phone || tr('Контакт не указан', 'Байланыс көрсетілмеген') }}</p>
            <p class="text-sm">{{ stages[lead.qualification.status] }} · {{ date(lead.createdAt) }}</p>
            <p class="break-all text-xs text-slate-500">{{ tr('Номер заявки:', 'Өтінім нөмірі:') }} {{ lead.id }}</p>
            <button class="lms-button secondary" :aria-pressed="selectedId === lead.id" @click="selectedId = lead.id">{{ tr('Рассмотреть заявку', 'Өтінімді қарау') }}</button>
          </li>
        </ul>
        <div class="flex flex-wrap gap-3"><button class="lms-button secondary" :disabled="pending || data.pagination.page <= 1" @click="turn(-1)">{{ tr('Предыдущая страница', 'Алдыңғы бет') }}</button><button class="lms-button secondary" :disabled="pending || !data.pagination.hasMore" @click="turn(1)">{{ tr('Следующая страница', 'Келесі бет') }}</button></div>
      </template>
    </LmsState>
    <LmsLeadWorkspace v-if="selectedId" :key="selectedId" :lead-id="selectedId" @changed="refresh()" />
    <NuxtLink v-if="lmsErrorStatus(error) === 403" class="lms-button secondary" :to="path('/cabinet/security')">{{ tr('Проверить второй фактор входа', 'Кірудің екінші факторын тексеру') }}</NuxtLink>
  </LmsShell>
</template>
