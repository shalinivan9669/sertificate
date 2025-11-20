<script setup>
import { useHead, useLocalePath, useSwitchLocalePath, useI18n } from '#imports';
import CitySwitcher from '~/components/CitySwitcher.vue';

const localePath = useLocalePath();
const switchLocalePath = useSwitchLocalePath();
const { locale } = useI18n();

useHead({
  titleTemplate: (chunk) =>
    chunk
      ? `Учебный центр по охране труда – ${chunk}`
      : 'Учебный центр по охране труда и промышленной безопасности',
  meta: [
    {
      name: 'description',
      content:
        'Лицензированный учебный центр: охрана труда, промышленная безопасность, ПТМ, электробезопасность, онлайн и выездное обучение по всей РК.',
    },
    { property: 'og:site_name', content: 'Учебный центр по охране труда и промышленной безопасности' },
    { property: 'og:type', content: 'website' },
    { property: 'og:locale', content: 'ru_KZ' },
  ],
});
</script>

<template>
  <div class="min-h-screen flex flex-col bg-slate-50 text-slate-900">
    <header class="border-b border-slate-200 bg-white/70 backdrop-blur">
      <div class="container flex items-center justify-between py-4 gap-4">
        <NuxtLink to="/" class="text-lg font-semibold text-brand">UC Safety</NuxtLink>
        <div class="flex items-center gap-3">
          <CitySwitcher />
          <div class="flex items-center gap-1 text-sm text-slate-600">
            <NuxtLink
              :class="[
                'px-2 py-1 rounded hover:text-brand',
                locale === 'ru' ? 'bg-slate-100 text-brand font-medium' : '',
              ]"
              :to="switchLocalePath('ru')"
            >
              RU
            </NuxtLink>
            <span>/</span>
            <NuxtLink
              :class="[
                'px-2 py-1 rounded hover:text-brand',
                locale === 'kk' ? 'bg-slate-100 text-brand font-medium' : '',
              ]"
              :to="switchLocalePath('kk')"
            >
              KK
            </NuxtLink>
          </div>
        </div>
      </div>
      <nav class="border-t border-slate-200 bg-white">
        <div class="container flex flex-wrap items-center gap-4 py-3 text-sm font-medium text-slate-700">
          <NuxtLink :to="localePath('/')" class="hover:text-brand">Главная</NuxtLink>
          <NuxtLink :to="`${localePath('/') }#courses`" class="hover:text-brand">Курсы</NuxtLink>
          <NuxtLink :to="`${localePath('/') }#formats`" class="hover:text-brand">Форматы обучения</NuxtLink>
          <NuxtLink :to="localePath('/blog')" class="hover:text-brand">Блог</NuxtLink>
          <NuxtLink :to="localePath('/contacts')" class="hover:text-brand">Контакты</NuxtLink>
        </div>
      </nav>
    </header>

    <main class="flex-1">
      <div class="container py-10">
        <slot />
      </div>
    </main>

    <footer class="border-t border-slate-200 bg-white/80 backdrop-blur">
      <div class="container py-10 grid gap-8 md:grid-cols-4 text-sm text-slate-700">
        <section>
          <h3 class="font-semibold text-slate-900 mb-3">Контакты</h3>
          <p>Телефон: +7 (700) 000-00-00</p>
          <p>Email: info@example.kz</p>
          <p>График: пн–пт 09:00–18:00</p>
        </section>
        <section>
          <h3 class="font-semibold text-slate-900 mb-3">Документы</h3>
          <ul class="space-y-2">
            <li><NuxtLink to="/licenses">Лицензии</NuxtLink></li>
            <li><NuxtLink to="/public-offer">Договор оферты</NuxtLink></li>
            <li><NuxtLink to="/privacy">Политика конфиденциальности</NuxtLink></li>
          </ul>
        </section>
        <section>
          <h3 class="font-semibold text-slate-900 mb-3">Навигация</h3>
          <ul class="space-y-2">
            <li><NuxtLink to="/">Главная</NuxtLink></li>
            <li><NuxtLink to="/blog">Блог</NuxtLink></li>
            <li><NuxtLink to="/contacts">Контакты</NuxtLink></li>
          </ul>
        </section>
        <section>
          <h3 class="font-semibold text-slate-900 mb-3">Города</h3>
          <CitySwitcher />
        </section>
      </div>
      <div class="border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-500">
        © {{ new Date().getFullYear() }} Учебный центр. Все права защищены.
      </div>
    </footer>
  </div>
</template>
