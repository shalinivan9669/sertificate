<script setup>
import { seoExpansionMetadata } from '~/content/seo-expansion-metadata';
import { publicContactPhone } from '~/config/public-contacts';
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch, useHead, useI18n, useLocalePath, useNuxtApp, useRoute, useRouter } from '#imports';
import { courseDirections } from '~/shared/course-registry';
import { leadCities, leadCityLabel, leadCityValue, leadFormats, leadProgramQuery, leadProgramsComment, readLeadContext, readLeadPrograms } from '~/shared/lead-context';

const { t, locale } = useI18n();
const path = useLocalePath();
const route = useRoute();
const tr = (ru, kk) => locale.value === 'kk' ? kk : ru;
const { track } = useLmsAnalytics();
const { snapshot: attributionSnapshot } = useLeadAttribution();
const isSubmitting = ref(false);
const status = ref('');
const failure = ref('');
const context = reactive({ programId: '', city: '', format: '', comment: '' });
const selectedPrograms = ref([]);
const commentEdited = ref(false);
const companyRequestQuery = computed(() => leadProgramQuery({
  ...context,
  programIds: [context.programId, ...selectedPrograms.value],
  city: leadCityValue(context.city),
}));
const priceRequested = ref(false);
const nuxtApp = useNuxtApp();
const router = useRouter();
let stopContextPrefill = () => {};
let stopCitySync = () => {};
let appliedCity = '';
let appliedProgram = '';
let appliedFormat = '';
let lastGeneratedComment = '';
onMounted(() => {
  const applyContext = () => {
    priceRequested.value = router.currentRoute.value.query.request === 'price';
    const query = router.currentRoute.value.query;
    selectedPrograms.value = readLeadPrograms(query);
    const initial = { ...readLeadContext(query), programId: selectedPrograms.value[0] || '' };
    const values = { ...initial, city: leadCityLabel(initial.city, locale.value) };
    // Follow query changes only while the field still has our last automatic
    // value. A different selection, including clearing it, belongs to the user.
    if (context.programId === appliedProgram) {
      context.programId = values.programId;
      appliedProgram = values.programId;
    }
    if (context.format === appliedFormat) {
      context.format = values.format;
      appliedFormat = values.format;
    }
    // Preserve a manually entered location when the page city changes.
    if (!context.city || leadCityValue(context.city) === appliedCity) context.city = values.city;
    appliedCity = initial.city;
    if (!commentEdited.value && (!context.comment.trim() || context.comment === lastGeneratedComment)) {
      lastGeneratedComment = leadProgramsComment(query, locale.value);
      context.comment = lastGeneratedComment;
    }
  };
  // Prerendered routes restore their query after suspense resolves.
  if (nuxtApp.isHydrating) stopContextPrefill = nuxtApp.hooks.hookOnce('app:suspense:resolve', applyContext);
  else applyContext();
  stopCitySync = watch([
    () => router.currentRoute.value.query.city,
    () => router.currentRoute.value.query.request,
    () => router.currentRoute.value.query.program,
    () => router.currentRoute.value.query.programs,
    () => router.currentRoute.value.query.format,
    locale,
  ], applyContext);
});
onBeforeUnmount(() => { stopContextPrefill(); stopCitySync(); });
let submissionKey = '';
let submittedPayload = '';

const handleSubmit = async (event) => {
  const form = event.target;

  if (!(form instanceof HTMLFormElement) || isSubmitting.value) {
    return;
  }

  const formData = new FormData(form);
  const city = leadCityValue(String(formData.get('city') || ''));
  const comment = String(formData.get('comment') || '').trim();
  const selectedContext = readLeadContext({ programId: formData.get('programId'), format: formData.get('format') });

  const payload = {
    name: String(formData.get('name') || '').trim(),
    phone: String(formData.get('phone') || '').trim(),
    email: String(formData.get('email') || '').trim(),
    city,
    programId: selectedContext.programId,
    format: selectedContext.format,
    comment: priceRequested.value ? [tr('Запрос стоимости обучения.', 'Оқу бағасын сұрау.'), comment].filter(Boolean).join('\n') : comment,
    company: String(formData.get('company') || '').trim(),
    locale: locale.value === 'kk' ? 'kk' : 'ru',
    sourcePath: route.path,
    consentVersion: 'service-v1',
    marketingConsent: false,
  };

  status.value = '';
  failure.value = '';
  if (!payload.phone && !payload.email) {
    failure.value = tr('Укажите телефон или email для ответа.', 'Жауап алу үшін телефон немесе email көрсетіңіз.');
    form.elements.namedItem('phone')?.focus();
    return;
  }
  if (!formData.has('consent')) {
    failure.value = tr('Подтвердите согласие на обработку заявки.', 'Өтінімді өңдеуге келісіміңізді растаңыз.');
    return;
  }
  const fingerprint = JSON.stringify(payload);
  if (!submissionKey || fingerprint !== submittedPayload) {
    submissionKey = crypto.randomUUID();
    submittedPayload = fingerprint;
  }
  isSubmitting.value = true;

  try {
    const attribution = await attributionSnapshot();
    await $fetch('/api/amo-lead', {
      method: 'POST',
      headers: { 'Idempotency-Key': submissionKey },
      body: { ...payload, ...(attribution ? { attribution } : {}) },
      retry: 0,
    });

    form.reset();
    Object.assign(context, { programId: '', city: '', format: '', comment: '' });
    commentEdited.value = false;
    appliedProgram = '';
    appliedFormat = '';
    lastGeneratedComment = '';
    submissionKey = '';
    submittedPayload = '';
    status.value = tr('Заявка принята. Сотрудник центра свяжется с вами после её обработки.', 'Өтінім қабылданды. Орталық қызметкері оны өңдегеннен кейін сізбен байланысады.');
  } catch (error) {
    failure.value = error?.statusCode === 429 || error?.status === 429
      ? tr('Слишком много запросов. Повторите через минуту.', 'Сұраулар тым көп. Бір минуттан кейін қайталаңыз.')
      : tr('Не удалось подтвердить приём заявки. Проверьте данные и соединение и повторите — введённые данные сохранены.', 'Өтінімнің қабылданғанын растау мүмкін болмады. Деректер мен байланысты тексеріп, қайталаңыз — енгізілген деректер сақталды.');
  } finally {
    isSubmitting.value = false;
  }
};

useHead(() => ({
  title: tr(seoExpansionMetadata.contacts.title, t('contacts.title')),
  meta: [
    {
      name: 'description',
      content: tr(seoExpansionMetadata.contacts.description, t('contacts.subtitle')),
    },
  ],
}));
</script>

<template>
  <div class="ed-public ed-contacts">
    <EditorialPageHeader :title="tr(seoExpansionMetadata.contacts.h1, t('contacts.title'))" :lead="t('contacts.subtitle')" />
    <div class="ed-request-layout">
      <aside class="ed-contact-details">
        <h2>{{ t('contacts.detailsTitle') }}</h2>
        <dl><div class="ed-contact-method"><dt>{{ t('footer.phoneLabel') }}</dt><dd><a :href="`tel:${publicContactPhone.e164}`" @click="track('contact_click')">{{ publicContactPhone.display }}</a></dd></div><div class="ed-contact-method"><dt>{{ t('footer.emailLabel') }}</dt><dd><a href="mailto:otcenterkz@proton.me" @click="track('contact_click')">otcenterkz@proton.me</a></dd></div><div class="ed-contact-method"><dt>{{ t('contacts.scheduleLabel') }}</dt><dd>{{ t('contacts.scheduleValue') }}</dd></div></dl>
        <NuxtLink class="ed-public-link" :to="{ path: path('/b2b'), query: companyRequestQuery }">{{ tr('Обучение сотрудников компании', 'Компания қызметкерлерін оқыту') }}</NuxtLink>
      </aside>
      <section id="request-form" class="ed-request-panel">
        <h2>{{ priceRequested ? tr('Узнать стоимость обучения', 'Оқу бағасын білу') : t('contacts.formTitle') }}</h2>
        <p>{{ priceRequested ? tr('Уточните направление, формат и число участников — мы подготовим предложение по вашей задаче. Для ответа оставьте телефон или email.', 'Бағытты, форматты және қатысушылар санын нақтылаңыз — міндетіңізге сай ұсыныс дайындаймыз. Жауап алу үшін телефон немесе email қалдырыңыз.') : tr('Расскажите, какое обучение вам нужно. Для ответа укажите телефон или email.', 'Қандай оқу қажет екенін жазыңыз. Жауап алу үшін телефон немесе email көрсетіңіз.') }}</p>
        <form class="ed-request-form" :aria-busy="isSubmitting" @input.once="track('lead_form_start')" @submit.prevent="handleSubmit">
          <label><span>{{ tr('Ваше имя', 'Атыңыз') }}</span><input type="text" name="name" maxlength="120" autocomplete="name" :placeholder="t('contacts.namePlaceholder')" /></label>
          <label><span>{{ tr('Телефон', 'Телефон') }}</span><input type="tel" name="phone" maxlength="30" autocomplete="tel" :placeholder="t('contacts.phonePlaceholder')" /></label>
          <label><span>Email</span><input type="email" name="email" maxlength="254" autocomplete="email" :placeholder="t('contacts.emailPlaceholder')" /></label>
          <input type="text" name="company" tabindex="-1" autocomplete="off" class="hidden" aria-hidden="true" />
          <label><span>{{ tr('Город', 'Қала') }}</span><input v-model="context.city" type="text" name="city" list="contact-cities" maxlength="80" autocomplete="address-level2" :placeholder="t('contacts.cityPlaceholder')" /><datalist id="contact-cities"><option v-for="city in leadCities" :key="city.id" :value="city.title[locale === 'kk' ? 'kk' : 'ru']" /></datalist></label>
          <label><span>{{ tr('Направление', 'Бағыт') }}</span><select v-model="context.programId" name="programId"><option value="">{{ tr('Нужна помощь с выбором', 'Таңдауға көмек керек') }}</option><option v-for="direction in courseDirections" :key="direction.id" :value="direction.id">{{ direction.title[locale === 'kk' ? 'kk' : 'ru'] }}</option></select></label>
          <label><span>{{ tr('Предпочтительный формат', 'Қалаулы формат') }}</span><select v-model="context.format" name="format"><option value="">{{ tr('Обсудить со специалистом', 'Маманмен талқылау') }}</option><option v-for="format in leadFormats" :key="format.id" :value="format.id">{{ format.title[locale === 'kk' ? 'kk' : 'ru'] }}</option></select></label>
          <label class="ed-request-wide"><span>{{ tr('Задача или вопрос', 'Міндет немесе сұрақ') }}</span><textarea v-model="context.comment" name="comment" maxlength="3000" :placeholder="t('contacts.commentPlaceholder')" rows="4" @input="commentEdited = true" /></label>
          <label class="ed-request-wide ed-request-consent"><input type="checkbox" name="consent" required /><span>{{ tr('Согласен на обработку данных для ответа на заявку.', 'Өтінімге жауап беру үшін деректерді өңдеуге келісемін.') }} <NuxtLink :to="path('/privacy')">{{ tr('Политика конфиденциальности', 'Құпиялылық саясаты') }}</NuxtLink></span></label>
          <p v-if="status" role="status" class="ed-request-wide lms-success">{{ status }}</p><p v-if="failure" role="alert" class="ed-request-wide lms-error">{{ failure }}</p>
          <div class="ed-request-wide ed-public-actions"><button type="submit" :disabled="isSubmitting" class="ed-public-button">{{ isSubmitting ? tr('Отправка…', 'Жіберілуде…') : priceRequested ? tr('Запросить стоимость', 'Бағасын сұрау') : t('contacts.submit') }}</button></div>
        </form>
      </section>

    </div>
  </div>
</template>
