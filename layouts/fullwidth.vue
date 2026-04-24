<script setup>
import { computed } from 'vue';
import { useHead, useLocaleHead, useLocalePath, useRoute, useRuntimeConfig } from '#imports';

const route = useRoute();
const runtimeConfig = useRuntimeConfig();
const localePath = useLocalePath();

const localeHead = useLocaleHead({
  addDirAttribute: true,
  identifierAttribute: 'id',
  addSeoAttributes: true,
});

const canonicalUrl = computed(() => {
  const baseUrl = runtimeConfig.public.siteUrl || 'https://otcenter.kz';
  const canonicalPath = route.meta?.canonicalPath || route.path || '/';
  const resolvedPath = canonicalPath.startsWith('http') ? canonicalPath : localePath(canonicalPath);
  return new URL(resolvedPath, baseUrl).toString();
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
  <div class="min-h-screen bg-surface text-on-surface">
    <slot />
  </div>
</template>
