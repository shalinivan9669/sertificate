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
  <div class="layout wrap">
    <header class="header">
      <div class="header__top">
        <NuxtLink to="/" class="logo">UC Safety</NuxtLink>
        <div class="header__actions">
          <CitySwitcher />
          <div class="lang-switch">
            <NuxtLink
              :class="['lang', locale === 'ru' && 'lang--active']"
              :to="switchLocalePath('ru')"
            >
              RU
            </NuxtLink>
            <span>/</span>
            <NuxtLink
              :class="['lang', locale === 'kk' && 'lang--active']"
              :to="switchLocalePath('kk')"
            >
              KK
            </NuxtLink>
          </div>
        </div>
      </div>
      <nav class="nav">
        <NuxtLink :to="localePath('/')" class="nav__link">Главная</NuxtLink>
        <NuxtLink :to="`${localePath('/') }#courses`" class="nav__link">Курсы</NuxtLink>
        <NuxtLink :to="`${localePath('/') }#formats`" class="nav__link">Форматы обучения</NuxtLink>
        <NuxtLink :to="localePath('/blog')" class="nav__link">Блог</NuxtLink>
        <NuxtLink :to="localePath('/contacts')" class="nav__link">Контакты</NuxtLink>
      </nav>
    </header>

    <main class="main-container">
      <slot />
    </main>

    <footer class="footer">
      <div class="footer__columns">
        <section class="footer__col">
          <h3>Контакты</h3>
          <p>Телефон: +7 (700) 000-00-00</p>
          <p>Email: info@example.kz</p>
          <p>График: пн–пт 09:00–18:00</p>
        </section>
        <section class="footer__col">
          <h3>Документы</h3>
          <ul>
            <li><NuxtLink to="/licenses">Лицензии</NuxtLink></li>
            <li><NuxtLink to="/public-offer">Договор оферты</NuxtLink></li>
            <li><NuxtLink to="/privacy">Политика конфиденциальности</NuxtLink></li>
          </ul>
        </section>
        <section class="footer__col">
          <h3>Навигация</h3>
          <ul>
            <li><NuxtLink to="/">Главная</NuxtLink></li>
            <li><NuxtLink to="/blog">Блог</NuxtLink></li>
            <li><NuxtLink to="/contacts">Контакты</NuxtLink></li>
          </ul>
        </section>
        <section class="footer__col">
          <h3>Города</h3>
          <CitySwitcher />
        </section>
      </div>
      <div class="footer__bottom">© {{ new Date().getFullYear() }} Учебный центр. Все права защищены.</div>
    </footer>
  </div>
</template>
