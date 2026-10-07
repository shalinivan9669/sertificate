<script setup lang="ts">
import type { SeoPreviewDraft } from '~/server/utils/seo-draft-preview';

definePageMeta({ layout: false, key: (route) => route.path });
const route = useRoute();
const { locale } = useI18n();
if (locale.value !== 'ru') throw createError({ statusCode: 404, statusMessage: 'Not found' });
const id = Array.isArray(route.params.id) ? route.params.id[0] : route.params.id;
const { data, error } = await useFetch<{ draft: SeoPreviewDraft } | null>(`/api/seo-preview/${encodeURIComponent(id || '')}`);
if (error.value || !data.value?.draft) throw createError({ statusCode: 404, statusMessage: 'Not found' });
const draft = computed(() => data.value!.draft);
useHead({
  title: `Черновик ${id} — редакционная проверка`,
  htmlAttrs: { lang: 'ru-KZ' },
  meta: [{ name: 'robots', content: 'noindex, nofollow, noarchive' }],
});
</script>

<template>
  <main class="seo-draft-preview">
    <aside class="seo-draft-notice" aria-label="Публикационный статус">
      <strong>Черновик {{ draft.contentId }} · READY_CONDITIONAL</strong>
      <p>Материал подготовлен для локальной редакционной проверки. Публикационные ворота остаются закрыты.</p>
      <p>Проверено в исследовании: {{ draft.checkedAt }}. Следующая проверка: {{ draft.reviewDueAt }}.</p>
      <p>Предлагаемый адрес: <code>{{ draft.targetPath }}</code></p>
      <h2>Перед публикацией</h2>
      <ul><li v-for="dependency in draft.dependencies" :key="dependency">{{ dependency }}</li></ul>
    </aside>
    <h1>{{ draft.h1 }}</h1>
    <p class="seo-draft-description">{{ draft.description }}</p>
    <nav aria-label="Содержание черновика"><a v-for="item in draft.toc" :key="item.id" :href="`#${item.id}`">{{ item.title }}</a></nav>
    <article class="ed-article-body" v-html="draft.bodyHtml" />
  </main>
</template>

<style scoped>
.seo-draft-preview { max-width: 76ch; margin: 2rem auto; padding: 0 1rem 4rem; color: #253034; }
.seo-draft-notice { padding: 1rem 1.25rem; border: 1px solid #b79b54; background: #fff9e8; margin-bottom: 2rem; }
.seo-draft-notice p { margin: .75rem 0; }
.seo-draft-notice code { overflow-wrap: anywhere; }
h1 { font-size: clamp(1.8rem, 5vw, 2.8rem); line-height: 1.2; }
.seo-draft-description { font-size: 1.15rem; margin: 1.5rem 0; }
nav { display: grid; gap: .5rem; margin: 1.5rem 0 2rem; }
a { color: #13635c; text-decoration: underline; }
:deep(h2), :deep(h3) { scroll-margin-top: 1rem; }
:deep(h2) { margin: 2rem 0 1rem; font-size: 1.5rem; line-height: 1.35; font-weight: 600; }
:deep(h3) { margin: 1.5rem 0 .75rem; font-size: 1.2rem; font-weight: 600; }
:deep(p) { margin: 1rem 0; line-height: 1.7; }
:deep(ul), :deep(ol) { padding-left: 1.5rem; margin: 1rem 0; }
:deep(ul) { list-style: disc; }
:deep(ol) { list-style: decimal; }
:deep(li) { margin: .5rem 0; }
:deep(.article-table-scroll) { max-width: 100%; overflow-x: auto; }
:deep(table) { display: block; max-width: 100%; overflow-x: auto; }
:deep(th), :deep(td) { padding: .75rem; border: 1px solid #d2d9d7; text-align: left; vertical-align: top; }
:deep(th) { background: #edf2f0; font-weight: 600; }
</style>
