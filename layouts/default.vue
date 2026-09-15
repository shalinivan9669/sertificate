<script setup>
import { computed } from 'vue';
import { useLocalePath, useSwitchLocalePath, useI18n } from '#imports';
import CitySwitcher from '~/components/CitySwitcher.vue';
import { usePublicLocaleHead } from '~/composables/usePublicLocaleHead';
const localePath = useLocalePath();
const switchLocalePath = useSwitchLocalePath();
const localeLinksReady = ref(false);
onMounted(() => { localeLinksReady.value = true; });
const languageLink = (code) => {
  const destination = switchLocalePath(code);
  return localeLinksReady.value ? destination : destination?.split('#')[0];
};
const { locale } = useI18n();
const { open: menuOpen, show: showMenu, link: menuLink } = useEditorialMenu();
const route = useRoute();
const isLearning = computed(() => /^\/(?:kk\/)?(?:learn|cabinet|admin|auth|payment|certificates)(?:\/|$)/.test(route.path));
usePublicLocaleHead();
const copy = computed(() => locale.value === 'kk' ? {
  eyebrow: 'Білім. Қауіпсіздік. Адамдарға қамқорлық.', country: 'Қазақстан бойынша оқыту',
  cabinet: 'Жеке кабинет', platform: 'Оқыту', company: 'Орталық',
  about: 'Жұмыста сенімді болу үшін білім. Қазақстандағы еңбекті қорғау және өнеркәсіптік қауіпсіздік бойынша оқыту.',
  catalog: 'Курстар каталогы', selection: 'Бағдарлама таңдау', business: 'Компанияларға',
  accreditation: 'Аккредиттеу', blog: 'Пайдалы материалдар', privacy: 'Құпиялылық саясаты',
  offer: 'Жария оферта', contacts: 'Байланыс', rights: 'Барлық құқықтар қорғалған.',
  help: 'Сұрақтарыңыз бар ма? Байланыстамыз.', menu: 'Мәзір', skip: 'Мазмұнға өту',
} : {
  eyebrow: 'Знания. Безопасность. Забота о людях.', country: 'Обучение по всему Казахстану',
  cabinet: 'Личный кабинет', platform: 'Обучение', company: 'Учебный центр',
  about: 'Знания для уверенности в работе. Обучение по охране труда и промышленной безопасности в Казахстане.',
  catalog: 'Каталог курсов', selection: 'Подобрать программу', business: 'Для компаний',
  accreditation: 'Аккредитация', blog: 'Полезные материалы', privacy: 'Политика конфиденциальности',
  offer: 'Публичная оферта', contacts: 'Контакты', rights: 'Все права защищены.',
  help: 'Есть вопросы? Мы на связи.', menu: 'Меню', skip: 'Перейти к содержимому',
});
</script>
<template>
  <div class="civic-site editorial-site" :class="{ 'ed-workspace': isLearning }">
    <a class="civic-skip" href="#main-content">{{ copy.skip }}</a>
    <div class="civic-topline"><div class="civic-container"><span><span class="civic-status-dot" />{{ copy.eyebrow }}</span><span class="civic-country">{{ copy.country }}</span></div></div>
    <header class="civic-header">
      <div class="civic-container civic-header-main">
        <NuxtLink :to="localePath('/')" class="civic-brand" aria-label="OT Center"><span class="civic-brand-mark" aria-hidden="true"><CivicIcon name="sun" /></span><span>OT<span class="civic-brand-light">Center</span><small>{{ locale === 'kk' ? 'ОҚЫТУ ОРТАЛЫҒЫ' : 'УЧЕБНЫЙ ЦЕНТР' }}</small></span></NuxtLink>
        <nav class="ed-header-chapters" :aria-label="copy.menu"><NuxtLink :to="menuLink('/courses')">{{ locale === 'kk' ? 'Бағдарламалар' : 'Программы' }}</NuxtLink><NuxtLink :to="menuLink('/b2b')">{{ copy.business }}</NuxtLink><NuxtLink :to="menuLink('/contacts')">{{ copy.contacts }}</NuxtLink></nav>
        <div class="civic-header-actions">
          <div class="ed-header-city"><CivicIcon name="pin" /><CitySwitcher /></div>
          <div class="civic-language" aria-label="Русский / Қазақша"><NuxtLink :to="languageLink('ru')" :aria-current="locale === 'ru' ? 'true' : undefined" :class="{ active: locale === 'ru' }" lang="ru">RU</NuxtLink><NuxtLink :to="languageLink('kk')" :aria-current="locale === 'kk' ? 'true' : undefined" :class="{ active: locale === 'kk' }" lang="kk">KK</NuxtLink></div>
          <NuxtLink :to="menuLink('/cabinet')" class="civic-account" :aria-label="copy.cabinet"><CivicIcon name="user" /><span>{{ copy.cabinet }}</span></NuxtLink>
          <button type="button" class="ed-menu-trigger" :aria-label="copy.menu" :aria-expanded="menuOpen" aria-haspopup="dialog" aria-controls="editorial-menu" @click="showMenu()"><span>{{ copy.menu }}</span><CivicIcon name="menu" /></button>
        </div>
      </div>
      <div class="civic-context-bar civic-container"><div class="civic-city-switch"><CivicIcon name="pin" /><CitySwitcher /></div><NuxtLink :to="menuLink('/cabinet')" class="civic-phone"><CivicIcon name="user" />{{ locale === 'kk' ? 'Оқуды жалғастыру' : 'Продолжить обучение' }}</NuxtLink></div>
    </header>
    <EditorialNavigation />
    <main id="main-content" class="civic-main" tabindex="-1"><div class="civic-container civic-page"><slot /></div></main>
    <footer class="civic-footer">
      <div class="civic-container civic-footer-grid">
        <div class="civic-footer-about"><NuxtLink :to="localePath('/')" class="civic-brand"><span class="civic-brand-mark" aria-hidden="true"><CivicIcon name="sun" /></span><span>OT<span class="civic-brand-light">Center</span></span></NuxtLink><p>{{ copy.about }}</p><span class="civic-footer-motto">{{ copy.eyebrow }}</span></div>
        <div><h2>{{ copy.platform }}</h2><NuxtLink :to="localePath('/courses')">{{ copy.catalog }}</NuxtLink><NuxtLink :to="localePath('/program-selection')">{{ copy.selection }}</NuxtLink><NuxtLink :to="localePath('/b2b')">{{ copy.business }}</NuxtLink><NuxtLink :to="localePath('/cabinet')">{{ copy.cabinet }}</NuxtLink></div>
        <div><h2>{{ copy.company }}</h2><NuxtLink :to="localePath('/licenses')">{{ copy.accreditation }}</NuxtLink><NuxtLink :to="localePath('/blog')">{{ copy.blog }}</NuxtLink><NuxtLink :to="localePath('/contacts')">{{ copy.contacts }}</NuxtLink></div>
        <div class="civic-footer-contact"><h2>{{ copy.help }}</h2><a href="tel:+77766803282">8 (776) 680-32-82</a><a href="mailto:otcenterkz@proton.me">otcenterkz@proton.me</a><span>Қазақстан · Казахстан</span></div>
      </div>
      <div class="civic-container civic-footer-bottom"><span>© {{ new Date().getFullYear() }} OT Center. {{ copy.rights }}</span><div><NuxtLink :to="localePath('/privacy')">{{ copy.privacy }}</NuxtLink><NuxtLink :to="localePath('/public-offer')">{{ copy.offer }}</NuxtLink></div></div>
    </footer>
  </div>
</template>
