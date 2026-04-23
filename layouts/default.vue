<script setup>
import { computed } from 'vue';
import {
  useHead,
  useLocaleHead,
  useLocalePath,
  useRoute,
  useRuntimeConfig,
  useSwitchLocalePath,
  useI18n,
} from '#imports';
import CitySwitcher from '~/components/CitySwitcher.vue';

const localePath = useLocalePath();
const switchLocalePath = useSwitchLocalePath();
const route = useRoute();
const runtimeConfig = useRuntimeConfig();
const { locale, t } = useI18n();

const localeHead = useLocaleHead({
  addDirAttribute: true,
  identifierAttribute: 'id',
  addSeoAttributes: true,
});

const canonicalUrl = computed(() => {
  const baseUrl = runtimeConfig.public.siteUrl || 'https://otcenter.kz';
  return new URL(route.path || '/', baseUrl).toString();
});

useHead(() => ({
  htmlAttrs: localeHead.value.htmlAttrs,
  link: [
    ...(localeHead.value.link || []),
    { rel: 'canonical', href: canonicalUrl.value },
  ],
  meta: [
    ...(localeHead.value.meta || []),
    { property: 'og:url', content: canonicalUrl.value },
  ],
}));
</script>

<template>
  <div class="min-h-screen flex flex-col bg-surface text-on-surface">
    <header class="border-b border-slate-200 bg-white/70 backdrop-blur">
      <div class="container flex items-center justify-between py-4 gap-4">
        <NuxtLink :to="localePath('/')" class="flex items-center text-lg font-semibold text-brand">
          <img src="/logo.png" alt="OT Center" class="h-20 w-auto" />
        </NuxtLink>
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
          <NuxtLink :to="localePath('/')" class="hover:text-brand">{{ t('nav.home') }}</NuxtLink>
          <NuxtLink :to="`${localePath('/') }#courses`" class="hover:text-brand">{{ t('nav.courses') }}</NuxtLink>
          <NuxtLink :to="`${localePath('/') }#formats`" class="hover:text-brand">{{ t('nav.formats') }}</NuxtLink>
          <NuxtLink :to="localePath('/blog')" class="hover:text-brand">{{ t('nav.blog') }}</NuxtLink>
          <NuxtLink :to="localePath('/contacts')" class="hover:text-brand">{{ t('nav.contacts') }}</NuxtLink>
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
            Ведущий центр аттестации и обучения по промышленной безопасности и охране труда в Казахстане.
          </p>
          <div class="space-y-1">
            <p class="text-slate-400 text-sm">
              Тел:
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
            <h5 class="font-bold mb-6 text-[#4A90E2] uppercase tracking-widest text-xs">Платформа</h5>
            <ul class="space-y-3 text-xs text-slate-400">
              <li><NuxtLink to="/courses" class="hover:text-white transition-colors">Каталог курсов</NuxtLink></li>
              <li><NuxtLink to="/wizard" class="hover:text-white transition-colors">Подобрать курс</NuxtLink></li>
              <li><NuxtLink to="/b2b" class="hover:text-white transition-colors">B2B Портал</NuxtLink></li>
              <li><NuxtLink to="/cabinet" class="hover:text-white transition-colors">Личный кабинет</NuxtLink></li>
            </ul>
          </div>
          <div>
            <h5 class="font-bold mb-6 text-[#4A90E2] uppercase tracking-widest text-xs">Компания</h5>
            <ul class="space-y-3 text-xs text-slate-400">
              <li><NuxtLink :to="localePath('/licenses')" class="hover:text-white transition-colors">Аккредитация</NuxtLink></li>
              <li><NuxtLink :to="localePath('/blog')" class="hover:text-white transition-colors">Блог</NuxtLink></li>
              <li><NuxtLink :to="localePath('/privacy')" class="hover:text-white transition-colors">Политика конфиденциальности</NuxtLink></li>
              <li><NuxtLink :to="localePath('/public-offer')" class="hover:text-white transition-colors">Публичная оферта</NuxtLink></li>
            </ul>
          </div>
        </div>
      </div>
      <div class="max-w-screen-2xl mx-auto px-8 py-6 flex flex-col md:flex-row justify-between items-center text-[10px] text-slate-500 font-medium">
        <div>© {{ new Date().getFullYear() }} OT Center Kazakhstan. Все права защищены.</div>
        <div class="flex gap-8 mt-4 md:mt-0 uppercase tracking-widest">
          <NuxtLink :to="localePath('/privacy')" class="hover:underline">Политика</NuxtLink>
          <NuxtLink :to="localePath('/public-offer')" class="hover:underline">Оферта</NuxtLink>
          <NuxtLink :to="localePath('/contacts')" class="hover:underline">Контакты</NuxtLink>
        </div>
      </div>
    </footer>
  </div>
</template>
