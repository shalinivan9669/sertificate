<script setup>
import { ref, useHead, useI18n } from '#imports';

const { t } = useI18n();
const isSubmitting = ref(false);

const handleSubmit = async (event) => {
  const form = event.target;

  if (!(form instanceof HTMLFormElement) || isSubmitting.value) {
    return;
  }

  const formData = new FormData(form);
  const city = String(formData.get('city') || '').trim();
  const comment = String(formData.get('comment') || '').trim();

  const message = [city ? `City: ${city}` : '', comment].filter(Boolean).join('\n');
  const payload = {
    name: String(formData.get('name') || '').trim(),
    phone: String(formData.get('phone') || '').trim(),
    email: String(formData.get('email') || '').trim(),
    city,
    comment,
    message,
    company: String(formData.get('company') || '').trim(),
  };

  isSubmitting.value = true;

  try {
    await $fetch('/api/amo-lead', {
      method: 'POST',
      body: payload,
    });

    form.reset();
    window.alert('Request sent successfully. We will contact you soon.');
  } catch (error) {
    const messageText =
      error?.data?.statusMessage ||
      error?.statusMessage ||
      'Failed to send request. Please try again.';

    window.alert(messageText);
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
        <p class="text-slate-700">{{ t('footer.phoneLabel') }}: <a href="tel:+77470966900" class="text-brand">+77470966900</a></p>
        <p class="text-slate-700">{{ t('footer.emailLabel') }}: <a href="mailto:otcenterkz@proton.me" class="text-brand">otcenterkz@proton.me</a></p>
        <p class="text-slate-700">{{ t('contacts.scheduleLabel') }}: {{ t('contacts.scheduleValue') }}</p>
      </section>

      <section class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-3 md:col-span-2">
        <h2 class="text-xl font-semibold text-slate-900">{{ t('contacts.formTitle') }}</h2>
        <form class="grid gap-3 md:grid-cols-2" @submit.prevent="handleSubmit">
          <input type="text" name="name" :placeholder="t('contacts.namePlaceholder')" class="rounded-lg border border-slate-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-accent" />
          <input type="tel" name="phone" :placeholder="t('contacts.phonePlaceholder')" class="rounded-lg border border-slate-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-accent" />
          <input type="email" name="email" :placeholder="t('contacts.emailPlaceholder')" class="rounded-lg border border-slate-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-accent" />
          <input type="text" name="company" tabindex="-1" autocomplete="off" class="hidden" aria-hidden="true" />
          <input type="text" name="city" :placeholder="t('contacts.cityPlaceholder')" class="rounded-lg border border-slate-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-accent" />
          <textarea name="comment" :placeholder="t('contacts.commentPlaceholder')" rows="3" class="md:col-span-2 rounded-lg border border-slate-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-accent"></textarea>
          <div class="md:col-span-2 flex flex-wrap gap-3">
            <button type="submit" :disabled="isSubmitting" class="inline-flex items-center justify-center px-5 py-3 rounded-lg bg-brand-accent text-white font-semibold hover:bg-emerald-700 transition disabled:opacity-70 disabled:cursor-not-allowed">{{ isSubmitting ? 'Sending...' : t('contacts.submit') }}</button>
            <a href="tel:+77470966900" class="inline-flex items-center justify-center px-5 py-3 rounded-lg border border-slate-200 text-brand font-semibold hover:border-brand hover:text-brand transition">{{ t('cta.call') }}</a>
          </div>
        </form>
      </section>
    </div>
  </main>
</template>
