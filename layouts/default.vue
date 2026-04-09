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

const localePath = useLocalePath();
const switchLocalePath = useSwitchLocalePath();
const route = useRoute();
const runtimeConfig = useRuntimeConfig();
const { locale } = useI18n();

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
    <!-- Premium Industrial Header -->
    <header class="bg-[#0A192F] sticky top-0 z-50 shadow-[0_4px_40px_rgba(10,25,47,0.3)]">
      <nav class="flex justify-between items-center w-full px-8 py-4 max-w-screen-2xl mx-auto">
        <div class="flex items-center gap-10">
          <NuxtLink :to="localePath('/')" class="flex items-center">
            <img src="/logo.png" alt="OT Center" class="h-12 w-auto" />
          </NuxtLink>
          <ul class="hidden md:flex gap-8 items-center">
            <li>
              <NuxtLink
                to="/courses"
                class="text-slate-400 font-medium hover:text-[#4A90E2] transition-colors duration-200 text-sm"
              >
                Каталог
              </NuxtLink>
            </li>
            <li>
              <NuxtLink
                :to="localePath('/licenses')"
                class="text-slate-400 font-medium hover:text-[#4A90E2] transition-colors duration-200 text-sm"
              >
                Аккредитация
              </NuxtLink>
            </li>
            <li>
              <NuxtLink
                :to="localePath('/contacts')"
                class="text-slate-400 font-medium hover:text-[#4A90E2] transition-colors duration-200 text-sm"
              >
                Контакты
              </NuxtLink>
            </li>
            <li>
              <NuxtLink
                to="/b2b"
                class="text-slate-400 font-medium hover:text-[#4A90E2] transition-colors duration-200 text-sm"
              >
                B2B
              </NuxtLink>
            </li>
          </ul>
        </div>
        <div class="flex items-center gap-4">
          <div class="flex items-center gap-1 text-sm">
            <NuxtLink
              :class="[
                'px-2 py-1 hover:text-[#4A90E2] transition-colors',
                locale === 'ru' ? 'text-white font-semibold' : 'text-slate-400',
              ]"
              :to="switchLocalePath('ru')"
            >
              RU
            </NuxtLink>
            <span class="text-slate-600">/</span>
            <NuxtLink
              :class="[
                'px-2 py-1 hover:text-[#4A90E2] transition-colors',
                locale === 'kk' ? 'text-white font-semibold' : 'text-slate-400',
              ]"
              :to="switchLocalePath('kk')"
            >
              KK
            </NuxtLink>
          </div>
          <NuxtLink
            to="/cabinet"
            class="bg-[#4A90E2] text-white px-5 py-2 font-bold text-sm tracking-tight hover:brightness-110 transition-all"
          >
            Войти
          </NuxtLink>
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
