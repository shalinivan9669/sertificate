<script setup lang="ts">
const { api, tr, date, errorText } = useLmsApi();
const localePath = useLocalePath();
const { data, pending, error, refresh } = await useAsyncData('lms-notifications', () => api<{ notifications: Array<{ id: string; template: string; status: string; createdAt: string; payload?: { enrollmentId: string; kind: string; dueAt: string; timezone: string } }> }>('/me/notifications'));
const busy = ref('');
const failure = ref('');
const title = (template: string) => ({
  'learning.reminder': tr('Наступил выбранный день напоминания об обучении.', 'Оқу туралы еске салудың таңдалған күні келді.'),
  'operations.incident': tr('Операционное событие требует внимания. Откройте контроль операций.', 'Операциялық оқиға назар аударуды қажет етеді. Операцияларды бақылауды ашыңыз.'),
  'learning.enrolled': tr('Вам доступно новое обучение. Оно появилось в списке назначений.', 'Сізге жаңа оқу қолжетімді. Ол тағайындаулар тізімінде көрсетілген.'),
  'notification.enrollment': tr('Доступ к программе подтверждён. Откройте обучение в кабинете.', 'Бағдарламаға қолжетімділік расталды. Жеке кабинетте оқуды ашыңыз.'),
  'assessment.graded': tr('Результат проверки знаний сохранён. Откройте обучение, чтобы посмотреть итог.', 'Білімді тексеру нәтижесі сақталды. Қорытындыны көру үшін оқуды ашыңыз.'),
  'notification.credential': tr('Документ оформлен и доступен в разделе «Мои документы».', 'Құжат рәсімделді және «Менің құжаттарым» бөлімінде қолжетімді.'),
  'notification.invoice_confirmed': tr('Поступление по счёту подтверждено сотрудником финансовой службы. Назначения сотрудников обновлены.', 'Қаржы қызметінің қызметкері шот бойынша түсімді растады. Қызметкерлердің тағайындаулары жаңартылды.'),
}[template] || tr('В вашем кабинете обновились сведения об обучении.', 'Жеке кабинетіңіздегі оқу мәліметтері жаңартылды.'));
async function markRead(id: string) {
  busy.value = id; failure.value = '';
  try { await api(`/me/notifications/${encodeURIComponent(id)}/read`, { method: 'POST', body: {} }); await refresh(); }
  catch (cause) { failure.value = errorText(cause); }
  finally { busy.value = ''; }
}
</script>
<template>
  <section class="space-y-4" aria-labelledby="notification-title">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h2 id="notification-title" class="text-2xl font-bold">{{ tr('Уведомления об обучении', 'Оқу туралы хабарландырулар') }}</h2>
      <button type="button" class="lms-button secondary" :disabled="pending" @click="refresh()">{{ tr('Обновить', 'Жаңарту') }}</button>
    </div>
    <p v-if="failure" class="lms-error" role="alert">{{ failure }}</p>
    <LmsState :pending="pending" :error="error" @retry="refresh()">
      <p v-if="!data?.notifications.length" class="lms-card text-slate-600">{{ tr('Новых уведомлений пока нет.', 'Әзірге жаңа хабарландырулар жоқ.') }}</p>
      <ul v-else class="space-y-3">
        <li v-for="notice in data.notifications" :key="notice.id" class="lms-card space-y-3">
          <p :class="notice.status === 'unread' ? 'font-semibold' : ''">{{ title(notice.template) }}</p>
          <p class="text-sm text-slate-600">{{ date(notice.createdAt) }}</p>
          <template v-if="notice.template === 'learning.reminder' && notice.payload"><p>{{ notice.payload.kind === 'access_deadline' ? tr('Срок доступа к назначенному обучению', 'Тағайындалған оқуға қолжетімділік мерзімі') : tr('Запланированная дата повторного обучения', 'Қайта оқудың жоспарланған күні') }}: {{ date(notice.payload.dueAt) }} · {{ notice.payload.timezone }}</p><NuxtLink class="lms-button secondary" :to="localePath('/cabinet/reminders')">{{ tr('Открыть напоминания', 'Еске салуларды ашу') }}</NuxtLink></template>
          <NuxtLink v-if="notice.template === 'operations.incident'" class="lms-button secondary" :to="localePath('/admin/incidents')">{{ tr('Контроль операций', 'Операцияларды бақылау') }}</NuxtLink>
          <button v-if="notice.status === 'unread'" type="button" class="lms-button secondary" :disabled="busy === notice.id" @click="markRead(notice.id)">{{ tr('Отметить прочитанным', 'Оқылған деп белгілеу') }}</button>
          <p v-else class="text-sm text-slate-600">{{ tr('Прочитано', 'Оқылды') }}</p>
        </li>
      </ul>
    </LmsState>
  </section>
</template>
