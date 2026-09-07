<script setup>
import { ref, useHead, useI18n, useLocalePath, useRoute } from '#imports';

const { t, locale } = useI18n();
const path = useLocalePath();
const route = useRoute();
const tr = (ru, kk) => locale.value === 'kk' ? kk : ru;
const isSubmitting = ref(false);
const status = ref('');
const failure = ref('');
let submissionKey = '';
let submittedPayload = '';

const handleSubmit = async (event) => {
  const form = event.target;

  if (!(form instanceof HTMLFormElement) || isSubmitting.value) {
    return;
  }

  const formData = new FormData(form);
  const city = String(formData.get('city') || '').trim();
  const comment = String(formData.get('comment') || '').trim();

  const payload = {
    name: String(formData.get('name') || '').trim(),
    phone: String(formData.get('phone') || '').trim(),
    email: String(formData.get('email') || '').trim(),
    city,
    comment,
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
    await $fetch('/api/amo-lead', {
      method: 'POST',
      headers: { 'Idempotency-Key': submissionKey },
      body: payload,
      retry: 0,
    });

    form.reset();
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
  title: t('contacts.title'),
  meta: [
    {
      name: 'description',
      content: t('contacts.subtitle'),
    },
  ],
}));
</script>

<template>
  <main class="space-y-8">
    <header class="space-y-2">
      <p class="text-sm font-semibold text-brand-accent uppercase tracking-wide">{{ t('nav.contacts') }}</p>
      <h1 class="text-3xl font-bold text-slate-900">{{ t('contacts.title') }}</h1>
      <p class="text-slate-700">{{ t('contacts.subtitle') }}</p>
    </header>

    <div class="grid gap-6 md:grid-cols-3">
      <section class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-3">
        <h2 class="text-xl font-semibold text-slate-900">{{ t('contacts.detailsTitle') }}</h2>
        <p class="text-slate-700">{{ t('footer.phoneLabel') }}: <a href="tel:+77755619871" class="text-brand">+77755619871</a></p>
        <p class="text-slate-700">{{ t('footer.emailLabel') }}: <a href="mailto:otcenterkz@proton.me" class="text-brand">otcenterkz@proton.me</a></p>
        <p class="text-slate-700">{{ t('contacts.scheduleLabel') }}: {{ t('contacts.scheduleValue') }}</p>
      </section>

      <section class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-3 md:col-span-2">
        <h2 class="text-xl font-semibold text-slate-900">{{ t('contacts.formTitle') }}</h2>
        <form class="grid gap-3 md:grid-cols-2" :aria-busy="isSubmitting" @submit.prevent="handleSubmit">
          <input type="text" name="name" maxlength="120" autocomplete="name" :aria-label="t('contacts.namePlaceholder')" :placeholder="t('contacts.namePlaceholder')" class="rounded-lg border border-slate-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-accent" />
          <input type="tel" name="phone" maxlength="30" autocomplete="tel" :aria-label="t('contacts.phonePlaceholder')" :placeholder="t('contacts.phonePlaceholder')" class="rounded-lg border border-slate-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-accent" />
          <input type="email" name="email" maxlength="254" autocomplete="email" :aria-label="t('contacts.emailPlaceholder')" :placeholder="t('contacts.emailPlaceholder')" class="rounded-lg border border-slate-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-accent" />
          <input type="text" name="company" tabindex="-1" autocomplete="off" class="hidden" aria-hidden="true" />
          <input type="text" name="city" maxlength="80" autocomplete="address-level2" :aria-label="t('contacts.cityPlaceholder')" :placeholder="t('contacts.cityPlaceholder')" class="rounded-lg border border-slate-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-accent" />
          <textarea name="comment" maxlength="3000" :aria-label="t('contacts.commentPlaceholder')" :placeholder="t('contacts.commentPlaceholder')" rows="3" class="md:col-span-2 rounded-lg border border-slate-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-accent"></textarea>
          <label class="md:col-span-2 flex items-start gap-2 text-sm text-slate-700">
            <input type="checkbox" name="consent" required class="mt-1 shrink-0" />
            <span>{{ tr('Согласен на обработку данных для ответа на заявку.', 'Өтінімге жауап беру үшін деректерді өңдеуге келісемін.') }} <NuxtLink :to="path('/privacy')" class="text-brand underline">{{ tr('Политика конфиденциальности', 'Құпиялылық саясаты') }}</NuxtLink></span>
          </label>
          <p v-if="status" role="status" class="md:col-span-2 text-emerald-800">{{ status }}</p>
          <p v-if="failure" role="alert" class="md:col-span-2 text-red-800">{{ failure }}</p>
          <div class="md:col-span-2 flex flex-wrap gap-3">
            <button type="submit" :disabled="isSubmitting" class="inline-flex items-center justify-center px-5 py-3 rounded-lg bg-brand-accent text-white font-semibold hover:bg-emerald-700 transition disabled:opacity-70 disabled:cursor-not-allowed">{{ isSubmitting ? tr('Отправка…', 'Жіберілуде…') : t('contacts.submit') }}</button>
            <a href="tel:+77755619871" class="inline-flex items-center justify-center px-5 py-3 rounded-lg border border-slate-200 text-brand font-semibold hover:border-brand hover:text-brand transition">{{ t('cta.call') }}</a>
          </div>
        </form>
      </section>
    </div>
  </main>
</template>
