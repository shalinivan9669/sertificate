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
  const baseUrl = runtimeConfig.public.siteUrl || 'https://example.kz';
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
  <div class="min-h-screen flex flex-col bg-slate-50 text-slate-900">
    <header class="border-b border-slate-200 bg-white/70 backdrop-blur">
      <div class="container flex items-center justify-between py-4 gap-4">
        <NuxtLink :to="localePath('/')" class="text-lg font-semibold text-brand">UC Safety</NuxtLink>
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

    <footer class="border-t border-slate-200 bg-white/80 backdrop-blur">
      <div class="container py-10 grid gap-8 md:grid-cols-4 text-sm text-slate-700">
        <section>
          <h3 class="font-semibold text-slate-900 mb-3">Контакты</h3>
          <p>Телефон: +7 (700) 000-00-00</p>
          <p>Email: info@example.kz</p>
          <p>График: будни 09:00–18:00</p>
        </section>
        <section>
          <h3 class="font-semibold text-slate-900 mb-3">Документы</h3>
          <ul class="space-y-2">
            <li><NuxtLink :to="localePath('/licenses')">Лицензии</NuxtLink></li>
            <li><NuxtLink :to="localePath('/public-offer')">Договор оферты</NuxtLink></li>
            <li><NuxtLink :to="localePath('/privacy')">Политика конфиденциальности</NuxtLink></li>
          </ul>
        </section>
        <section>
          <h3 class="font-semibold text-slate-900 mb-3">Навигация</h3>
          <ul class="space-y-2">
            <li><NuxtLink :to="localePath('/')">{{ t('nav.home') }}</NuxtLink></li>
            <li><NuxtLink :to="localePath('/blog')">{{ t('nav.blog') }}</NuxtLink></li>
            <li><NuxtLink :to="localePath('/contacts')">{{ t('nav.contacts') }}</NuxtLink></li>
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
