<script setup>
import { useHead, useI18n } from '#imports';

const { t } = useI18n();

useHead({
  title: 'Контакты учебного центра',
  meta: [
    {
      name: 'description',
      content:
        'Контакты учебного центра по охране труда и промышленной безопасности: телефон, email, адрес, форма заявки.',
    },
  ],
});
</script>

<template>
  <main class="space-y-8">
    <header class="space-y-2">
      <p class="text-sm font-semibold text-brand-accent uppercase tracking-wide">Контакты</p>
      <h1 class="text-3xl font-bold text-slate-900">Свяжитесь с нами</h1>
      <p class="text-slate-700">Ответим на вопросы по программам, стоимости и форматам обучения.</p>
    </header>

    <div class="grid gap-6 md:grid-cols-3">
      <section class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-3">
        <h2 class="text-xl font-semibold text-slate-900">Оперативно</h2>
        <p class="text-slate-700">Телефон: <a href="tel:+77000000000" class="text-brand">+7 (700) 000-00-00</a></p>
        <p class="text-slate-700">Email: <a href="mailto:info@example.kz" class="text-brand">info@example.kz</a></p>
        <p class="text-slate-700">График: будни 09:00–18:00</p>
      </section>

      <section class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-3 md:col-span-2">
        <h2 class="text-xl font-semibold text-slate-900">Оставить заявку</h2>
        <form class="grid gap-3 md:grid-cols-2">
          <input type="text" name="name" placeholder="Ваше имя" class="rounded-lg border border-slate-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-accent" />
          <input type="tel" name="phone" placeholder="Телефон" class="rounded-lg border border-slate-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-accent" />
          <input type="email" name="email" placeholder="Email" class="rounded-lg border border-slate-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-accent" />
          <input type="text" name="city" placeholder="Город" class="rounded-lg border border-slate-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-accent" />
          <textarea name="comment" placeholder="Комментарий" rows="3" class="md:col-span-2 rounded-lg border border-slate-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-accent"></textarea>
          <div class="md:col-span-2 flex flex-wrap gap-3">
            <button type="submit" class="inline-flex items-center justify-center px-5 py-3 rounded-lg bg-brand-accent text-white font-semibold hover:bg-emerald-700 transition">Отправить</button>
            <a href="tel:+77000000000" class="inline-flex items-center justify-center px-5 py-3 rounded-lg border border-slate-200 text-brand font-semibold hover:border-brand hover:text-brand transition">{{ t('cta.call') }}</a>
          </div>
        </form>
      </section>
    </div>
  </main>
</template>
