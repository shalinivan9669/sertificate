<script setup lang="ts">
import { seoExpansionServices } from '~/content/seo-expansion-services';
import { getSortedBlogPosts } from '#build/blog-summaries.mjs';
import { leadContextQuery } from '~/shared/lead-context';
const { contentId } = defineProps<{ contentId: keyof typeof seoExpansionServices }>();
const { locale } = useI18n();
const route = useRoute();
const content = computed(() => locale.value === 'ru' ? seoExpansionServices[contentId] : undefined);
const planningArticles = computed(() => content.value && contentId === 'SV01'
  ? getSortedBlogPosts('ru').filter(post => [
    'kp-na-obuchenie-personala-kak-sravnit',
    'audit-obucheniya-pered-koncom-goda',
    'obuchenie-smennoy-komandy-yazyki-grafik',
  ].includes(post.slug)) : []);
</script>

<template>
  <div v-if="content" class="seo-service-block" v-html="content.bodyHtml" />
  <section v-if="planningArticles.length" class="seo-service-block">
    <h2>Планирование обучения для компании</h2>
    <ul>
      <li v-for="post in planningArticles" :key="post.slug"><NuxtLink :to="{ path: post._path, query: leadContextQuery(route.query) }">{{ post.title.ru }}</NuxtLink></li>
    </ul>
  </section>
  <div v-if="content && contentId === 'SV09'" class="ed-public-links">
    <a href="/downloads/seo-2026-2027/T04_quote_request.md" download>Шаблон запроса КП (Markdown)</a>
    <a href="/downloads/seo-2026-2027/T08_group_request.csv" download>Обезличенный состав группы (CSV)</a>
  </div>
</template>

<style scoped>
.seo-service-block { min-width: 0; margin-block: 28px; }
.seo-service-block :deep(h2) { margin: 28px 0 16px; font-size: clamp(24px, 2.3vw, 32px); scroll-margin-top: 120px; }
.seo-service-block :deep(p) { max-width: 72ch; margin-block: 14px; line-height: 1.75; }
.seo-service-block :deep(a) { text-decoration: underline; text-underline-offset: 4px; }
.seo-service-block :deep(.seo-table-scroll) { max-width: 100%; overflow-x: auto; margin-block: 20px; }
.seo-service-block :deep(table) { width: 100%; min-width: 420px; border-collapse: collapse; font-size: 15px; line-height: 1.6; }
.seo-service-block :deep(th), .seo-service-block :deep(td) { padding: 12px; border: 1px solid var(--ed-rule); text-align: left; vertical-align: top; }
.seo-service-block :deep(th) { color: var(--ed-ink); background: var(--ed-soft); }
</style>
