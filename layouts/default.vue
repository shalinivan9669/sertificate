<script setup>
import { computed } from 'vue';
import {
  useLocalePath,
  useSwitchLocalePath,
  useI18n,
} from '#imports';
import CitySwitcher from '~/components/CitySwitcher.vue';
import { usePublicLocaleHead } from '~/composables/usePublicLocaleHead';

const localePath = useLocalePath();
const switchLocalePath = useSwitchLocalePath();
const { locale, t } = useI18n();
usePublicLocaleHead();

const copy = computed(() => locale.value === 'kk' ? {
  online: 'Онлайн оқу', cabinet: 'Жеке кабинет', platform: 'Оқыту', company: 'Орталық',
  about: 'Қазақстандағы өнеркәсіптік қауіпсіздік және еңбекті қорғау бойынша оқыту орталығы.',
  phone: 'Телефон', catalog: 'Курстар каталогы', selection: 'Бағдарлама таңдау',
  business: 'Компанияларға', accreditation: 'Аккредиттеу', blog: 'Блог',
  privacy: 'Құпиялылық саясаты', offer: 'Жария оферта', contacts: 'Байланыс',
  rights: 'Барлық құқықтар қорғалған.',
} : {
  online: 'Онлайн-обучение', cabinet: 'Личный кабинет', platform: 'Обучение', company: 'Компания',
  about: 'Центр обучения по промышленной безопасности и охране труда в Казахстане.',
  phone: 'Телефон', catalog: 'Каталог курсов', selection: 'Подобрать программу',
  business: 'Для компаний', accreditation: 'Аккредитация', blog: 'Блог',
  privacy: 'Политика конфиденциальности', offer: 'Публичная оферта', contacts: 'Контакты',
  rights: 'Все права защищены.',
});
</script>

<template>
  <div class="min-h-screen flex flex-col bg-surface text-on-surface">
    <header class="border-b border-slate-200 bg-white/70 backdrop-blur">
      <div class="container flex flex-wrap sm:flex-nowrap items-center justify-between py-4 gap-4">
        <NuxtLink :to="localePath('/')" class="flex shrink-0 items-center text-lg font-semibold text-brand">
          <img src="/logo.png" alt="OT Center" class="h-14 w-auto sm:h-20" />
        </NuxtLink>
        <div class="flex w-full sm:w-auto flex-wrap items-center justify-between gap-3">
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
          <NuxtLink :to="localePath('/')" class="hover:text-brand">{{ t('nav.home') }}</NuxtLink>
          <NuxtLink :to="`${localePath('/') }#courses`" class="hover:text-brand">{{ t('nav.courses') }}</NuxtLink>
          <NuxtLink :to="`${localePath('/') }#formats`" class="hover:text-brand">{{ t('nav.formats') }}</NuxtLink>
          <NuxtLink :to="localePath('/blog')" class="hover:text-brand">{{ t('nav.blog') }}</NuxtLink>
          <NuxtLink :to="localePath('/contacts')" class="hover:text-brand">{{ t('nav.contacts') }}</NuxtLink>
          <NuxtLink :to="localePath('/courses')" class="hover:text-brand">{{ copy.online }}</NuxtLink>
          <NuxtLink :to="localePath('/cabinet')" class="hover:text-brand">{{ copy.cabinet }}</NuxtLink>
        </div>
      </nav>
    </header>

    <main class="flex-1">
      <div class="container py-10">
        <slot />
      </div>
    </main>

    <!-- Premium Industrial Footer -->
    <footer class="bg-[#0A192F] text-white">
      <div class="w-full py-16 px-8 grid grid-cols-1 md:grid-cols-2 gap-12 max-w-screen-2xl mx-auto border-b border-white/5">
        <div class="space-y-6">
          <div class="text-2xl font-extrabold tracking-tighter">OT Center</div>
          <p class="text-slate-400 max-w-md text-sm leading-relaxed">
            {{ copy.about }}
          </p>
          <div class="space-y-1">
            <p class="text-slate-400 text-sm">
              {{ copy.phone }}:
              <a href="tel:+77755619871" class="text-[#4A90E2] hover:underline">+7 775 561 98 71</a>
            </p>
            <p class="text-slate-400 text-sm">
              Email:
              <a href="mailto:otcenterkz@proton.me" class="text-[#4A90E2] hover:underline">otcenterkz@proton.me</a>
            </p>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-8">
          <div>
            <h5 class="font-bold mb-6 text-[#4A90E2] uppercase tracking-widest text-xs">{{ copy.platform }}</h5>
            <ul class="space-y-3 text-xs text-slate-400">
              <li><NuxtLink :to="localePath('/courses')" class="hover:text-white transition-colors">{{ copy.catalog }}</NuxtLink></li>
              <li><NuxtLink :to="localePath('/program-selection')" class="hover:text-white transition-colors">{{ copy.selection }}</NuxtLink></li>
              <li><NuxtLink :to="localePath('/b2b')" class="hover:text-white transition-colors">{{ copy.business }}</NuxtLink></li>
              <li><NuxtLink :to="localePath('/cabinet')" class="hover:text-white transition-colors">{{ copy.cabinet }}</NuxtLink></li>
            </ul>
          </div>
          <div>
            <h5 class="font-bold mb-6 text-[#4A90E2] uppercase tracking-widest text-xs">{{ copy.company }}</h5>
            <ul class="space-y-3 text-xs text-slate-400">
              <li><NuxtLink :to="localePath('/licenses')" class="hover:text-white transition-colors">{{ copy.accreditation }}</NuxtLink></li>
              <li><NuxtLink :to="localePath('/blog')" class="hover:text-white transition-colors">{{ copy.blog }}</NuxtLink></li>
              <li><NuxtLink :to="localePath('/privacy')" class="hover:text-white transition-colors">{{ copy.privacy }}</NuxtLink></li>
              <li><NuxtLink :to="localePath('/public-offer')" class="hover:text-white transition-colors">{{ copy.offer }}</NuxtLink></li>
            </ul>
          </div>
        </div>
      </div>
      <div class="max-w-screen-2xl mx-auto px-8 py-6 flex flex-col md:flex-row justify-between items-center text-[10px] text-slate-500 font-medium">
        <div>© {{ new Date().getFullYear() }} OT Center Kazakhstan. {{ copy.rights }}</div>
        <div class="flex flex-wrap justify-center gap-x-6 gap-y-2 mt-4 md:mt-0 uppercase tracking-widest">
          <NuxtLink :to="localePath('/privacy')" class="hover:underline">{{ copy.privacy }}</NuxtLink>
          <NuxtLink :to="localePath('/public-offer')" class="hover:underline">{{ copy.offer }}</NuxtLink>
          <NuxtLink :to="localePath('/contacts')" class="hover:underline">{{ copy.contacts }}</NuxtLink>
        </div>
      </div>
    </footer>
  </div>
</template>

<style scoped>
footer a { color: #cbd5e1; }
footer a[href^='tel:'], footer a[href^='mailto:'] { color: #93c5fd; }
footer a:hover, footer a:focus-visible { color: #fff; }
footer a:focus-visible { outline: 2px solid #93c5fd; outline-offset: 4px; }
</style>
