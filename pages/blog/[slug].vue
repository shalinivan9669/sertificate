<script setup>
import { leadContextQuery } from '~/shared/lead-context';
import { computed } from 'vue';
import { useHead, useRoute, createError, useLocalePath, useI18n, useRuntimeConfig, useAsyncData } from '#imports';
import { formatBlogDate, getBlogWordCount } from '~/config/blog-format';
import { getSortedBlogPosts } from '#build/blog-summaries.mjs';
import { loadBlogPost } from '#build/blog-loaders.mjs';
import { getCoursePublicPath } from '~/shared/course-registry';
import { getCourseSearchContent } from '~/shared/course-search-content';

// Re-run setup for another article/language, including its 404 and SSR metadata.
definePageMeta({ key: (route) => route.path });
const route = useRoute();
const localePath = useLocalePath();
const { locale, t } = useI18n();
const runtimeConfig = useRuntimeConfig();
const localize = (value) => value?.[locale.value] || value?.ru || value;
const absoluteUrl = (path) => new URL(path, runtimeConfig.public.siteUrl).toString();
const contextRoute = (path) => ({ path: localePath(path), query: leadContextQuery(route.query) });
const formatDate = (date) => formatBlogDate(date, locale.value);
const copy = computed(() => locale.value === 'kk' ? {
  home: 'Басты бет', blog: 'Блог', breadcrumbs: 'Навигация жолы',
  published: 'Жарияланды', updated: 'Жаңартылды', checked: 'Тексерілді', checkedNote: 'Дереккөздер мен редакциялық толықтыруды салыстыру күні.', minutes: 'мин оқу',
  author: 'Материалды дайындаған', contents: 'Мақала мазмұны',
  imageNote: 'Тақырыптық иллюстрация жасанды интеллект көмегімен жасалды.',
  helpTitle: 'Компания қызметкерлеріне оқу таңдаңыз',
  helpText: 'Рөлдерді, адам санын, қаланы және мерзімдерді көрсетіңіз. Бағдарламаны, форматты және топ құнын келісуге көмектесеміз. Алғашқы өтінімге қызметкерлердің дербес деректері қажет емес.',
  contact: 'Топтық оқуды талқылау', related: 'Тақырып бойынша тағы', allArticles: 'Барлық мақалалар',
} : {
  home: 'Главная', blog: 'Блог', breadcrumbs: 'Хлебные крошки',
  published: 'Опубликовано', updated: 'Обновлено', checked: 'Проверено', checkedNote: 'Дата редакционной сверки источников и внесённого блока.', minutes: 'мин чтения',
  author: 'Материал подготовлен', contents: 'В этой статье',
  imageNote: 'Тематическая иллюстрация создана с помощью искусственного интеллекта.',
  helpTitle: 'Подберите обучение для сотрудников компании',
  helpText: 'Укажите роли, количество человек, город и сроки. Поможем согласовать программу, формат и расчёт для группы. Персональные данные работников для первого обращения не нужны.',
  contact: 'Обсудить обучение группы', related: 'Ещё по теме', allArticles: 'Все статьи',
});

const slug = Array.isArray(route.params.slug) ? route.params.slug[0] : route.params.slug;
const { data: post, error } = await useAsyncData(`blog:${slug}:${locale.value}`, async () => {
  const article = await loadBlogPost(slug, locale.value);
  if (!article) throw createError({ statusCode: 404, statusMessage: 'Post not found' });
  return article;
}, { deep: false });
if (error.value) throw createError(error.value);
const articleLeadRoute = computed(() => ({
  path: localePath('/b2b'),
  query: leadContextQuery({ city: route.query.city, format: route.query.format, program: post.value?.relatedCourses?.[0] }),
  hash: '#team-request',
}));

const localizedPost = computed(() => post.value ? {
  ...post.value,
  title: localize(post.value.title),
  seoTitle: localize(post.value.seoTitle) || localize(post.value.title),
  description: localize(post.value.description),
  tags: localize(post.value.tags) || [],
  toc: localize(post.value.toc) || [],
  imageAlt: localize(post.value.image?.alt),
  imageCaption: localize(post.value.image?.caption) || copy.value.imageNote,
  bodyHtml: localize(post.value.bodyHtml) || '',
  relatedCourses: post.value.relatedCourses || [],
} : null);
const wordCount = computed(() => getBlogWordCount(localizedPost.value?.bodyHtml));
const readingMinutes = computed(() => Math.max(1, Math.ceil(wordCount.value / 180)));
const relatedPosts = computed(() => getSortedBlogPosts(locale.value)
  .filter((item) => item.slug !== post.value?.slug)
  .map((item) => ({
    ...item,
    title: localize(item.title),
    description: localize(item.description),
    relevance: (item.relatedCourses || []).filter((course) => post.value?.relatedCourses?.includes(course)).length,
  }))
  .sort((a, b) => b.relevance - a.relevance)
  .slice(0, 3));
const relatedTraining = computed(() => (localizedPost.value?.relatedCourses || []).flatMap((id) => {
  const destination = getCoursePublicPath(id);
  const label = getCourseSearchContent(id, locale.value)?.heading;
  return destination && label ? [{ id, label, to: contextRoute(destination) }] : [];
}));

useHead(() => {
  const article = localizedPost.value;
  if (!article) return {};
  const url = absoluteUrl(localePath(article._path));
  const imageUrl = article.image?.src ? absoluteUrl(article.image.src) : undefined;
  const organization = { '@type': 'Organization', name: 'OT Center', url: absoluteUrl('/') };
  return {
    title: article.seoTitle,
    meta: [
      { name: 'description', content: article.description },
      { property: 'og:type', content: 'article' },
      { property: 'og:title', content: article.seoTitle },
      { property: 'og:description', content: article.description },
      { property: 'og:url', content: url },
      { property: 'article:published_time', content: article.date },
      { property: 'article:modified_time', content: article.updatedAt || article.date },
      { name: 'author', content: 'OT Center' },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: article.seoTitle },
      { name: 'twitter:description', content: article.description },
      ...(imageUrl ? [
        { property: 'og:image', content: imageUrl },
        { property: 'og:image:width', content: String(article.image.width) },
        { property: 'og:image:height', content: String(article.image.height) },
        { property: 'og:image:alt', content: article.imageAlt },
        { name: 'twitter:image', content: imageUrl },
        { name: 'twitter:image:alt', content: article.imageAlt },
      ] : []),
    ],
    script: [{
      key: 'blog-article-schema',
      type: 'application/ld+json',
      children: JSON.stringify({
        '@context': 'https://schema.org',
        '@graph': [{
          '@type': 'BlogPosting',
          '@id': `${url}#article`,
          url,
          mainEntityOfPage: { '@type': 'WebPage', '@id': url },
          headline: article.title,
          description: article.description,
          datePublished: article.date,
          dateModified: article.updatedAt || article.date,
          inLanguage: locale.value === 'kk' ? 'kk-KZ' : 'ru-KZ',
          author: organization,
          publisher: { ...organization, logo: { '@type': 'ImageObject', url: absoluteUrl('/logo.png') } },
          ...(imageUrl ? { image: { '@type': 'ImageObject', url: imageUrl, width: article.image.width, height: article.image.height, caption: article.imageAlt } } : {}),
          keywords: article.tags.join(', '),
          wordCount: wordCount.value,
        }, {
          '@type': 'BreadcrumbList',
          '@id': `${url}#breadcrumbs`,
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: copy.value.home, item: absoluteUrl(localePath('/')) },
            { '@type': 'ListItem', position: 2, name: copy.value.blog, item: absoluteUrl(localePath('/blog')) },
            { '@type': 'ListItem', position: 3, name: article.title, item: url },
          ],
        }],
      }).replace(/</g, '\\u003c'),
    }],
  };
});
</script>

<template>
  <div v-if="localizedPost" class="ed-public ed-article">
    <article>
      <EditorialPageHeader :title="localizedPost.title" :lead="localizedPost.description" :back-to="contextRoute('/blog')" :back-label="copy.allArticles">
        <template #context><div class="ed-public-tags"><span v-for="tag in localizedPost.tags" :key="tag">{{ tag }}</span></div></template>
        <div class="ed-journal-meta"><span>{{ copy.published }}: <time :datetime="localizedPost.date">{{ formatDate(localizedPost.date) }}</time></span><span v-if="localizedPost.updatedAt && localizedPost.updatedAt !== localizedPost.date">{{ copy.updated }}: <time :datetime="localizedPost.updatedAt">{{ formatDate(localizedPost.updatedAt) }}</time></span><span v-if="localizedPost.checkedAt" :title="copy.checkedNote">{{ copy.checked }}: <time :datetime="localizedPost.checkedAt">{{ formatDate(localizedPost.checkedAt) }}</time></span><span>≈ {{ readingMinutes }} {{ copy.minutes }}</span><span>{{ copy.author }} <NuxtLink :to="contextRoute('/contacts')" :aria-label="locale === 'kk' ? 'OT Center редакциясының байланыстары' : 'Контакты редакции OT Center'">OT Center</NuxtLink></span></div>
      </EditorialPageHeader>
      <figure v-if="localizedPost.image?.src" class="ed-article-figure"><ResponsiveImage sizes="(max-width: 767px) calc(100vw - 40px), (max-width: 1360px) calc(100vw - 96px), 1264px" :src="localizedPost.image.src" :alt="localizedPost.imageAlt" :width="localizedPost.image.width" :height="localizedPost.image.height" :style="localizedPost.image.fit === 'contain' ? { objectFit: 'contain' } : undefined" fetchpriority="high" loading="eager" decoding="async" /><figcaption>{{ localizedPost.imageCaption }}</figcaption></figure>
      <div class="ed-public-body">
        <div class="ed-public-content ed-legal-body">
          <div class="article-content" v-html="localizedPost.bodyHtml" />
          <section class="ed-public-callout"><h2>{{ copy.helpTitle }}</h2><p>{{ copy.helpText }}</p><div class="ed-public-actions"><NuxtLink :to="articleLeadRoute" class="ed-public-button">{{ copy.contact }}</NuxtLink></div></section>
          <section v-if="relatedTraining.length" class="ed-public-section"><h2>{{ t('blogPost.relatedTitle') }}</h2><div class="ed-public-links"><NuxtLink v-for="course in relatedTraining" :key="course.id" :to="course.to">{{ course.label }}</NuxtLink></div></section>
        </div>
        <nav v-if="localizedPost.toc.length" class="ed-public-toc" :aria-label="copy.contents"><h2>{{ copy.contents }}</h2><ol><li v-for="item in localizedPost.toc" :key="item.id"><a :href="`#${item.id}`">{{ item.title }}</a></li></ol></nav>
      </div>
    </article>
    <section v-if="relatedPosts.length" class="ed-article-related"><h2>{{ copy.related }}</h2><div class="ed-article-related-list"><article v-for="relatedPost in relatedPosts" :key="relatedPost.slug"><NuxtLink v-if="relatedPost.image?.src" :to="contextRoute(relatedPost._path)" tabindex="-1" aria-hidden="true"><ResponsiveImage sizes="(max-width: 767px) calc(100vw - 40px), (max-width: 1360px) 30vw, 400px" :src="relatedPost.image.src" alt="" :width="relatedPost.image.width" :height="relatedPost.image.height" loading="lazy" decoding="async" /></NuxtLink><h3><NuxtLink :to="contextRoute(relatedPost._path)">{{ relatedPost.title }}</NuxtLink></h3><p>{{ relatedPost.description }}</p></article></div><NuxtLink :to="contextRoute('/blog')" class="ed-public-link">{{ copy.allArticles }}</NuxtLink></section>
  </div>
  <p v-else>{{ t('blogPost.notFound') }}</p>
</template>

<style scoped>
.ed-article :deep(.ed-page-heading h1) { overflow-wrap: anywhere; hyphens: auto; }
.article-content { color: var(--ed-ink); font-size: 1.0625rem; line-height: 1.85; overflow-wrap: anywhere; }
.article-content :deep(> :first-child) { margin-top: 0; }
.article-content :deep(h2), .article-content :deep(h3) { color: var(--ed-ink); font-family: var(--ed-display); font-weight: 500; line-height: 1.35; scroll-margin-top: 2rem; }
.article-content :deep(h2) { margin: 2.5rem 0 1rem; font-size: 2rem; }
.article-content :deep(h3) { margin: 1.75rem 0 .75rem; font-size: 1.45rem; }
.article-content :deep(p) { margin: 1rem 0; }
.article-content :deep(strong) { color: var(--ed-ink); font-weight: 700; }
.article-content :deep(ul), .article-content :deep(ol) { margin: 1rem 0; padding-left: 1.5rem; }
.article-content :deep(ul) { list-style: disc; }
.article-content :deep(ol) { list-style: decimal; }
.article-content :deep(li) { margin: .5rem 0; padding-left: .2rem; }
.article-content :deep(li::marker) { color: var(--ed-ink); }
.article-content :deep(a) { color: var(--ed-ink); font-weight: 500; text-decoration: underline; text-decoration-color: var(--ed-rule); text-underline-offset: 3px; }
.article-content :deep(a:hover) { color: var(--ed-ink); text-decoration-color: currentColor; }
.article-content :deep(a:focus-visible) { outline: 2px solid var(--ed-ink); outline-offset: 4px; border-radius: 2px; }
.article-content :deep(blockquote), .article-content :deep(.callout) { margin: 1.5rem 0; border-left: 3px solid var(--ed-ink); border-radius: 0 var(--ed-radius) var(--ed-radius) 0; background: var(--ed-soft); padding: 1rem 1.25rem; }
.article-content :deep(blockquote p:first-child), .article-content :deep(.callout p:first-child) { margin-top: 0; }
.article-content :deep(blockquote p:last-child), .article-content :deep(.callout p:last-child) { margin-bottom: 0; }
.article-content :deep(.table-wrap), .article-content :deep(.table-scroll) { max-width: 100%; overflow-x: auto; }
.article-content :deep(table) { display: block; width: 100%; max-width: 100%; overflow-x: auto; margin: 1.5rem 0; border-collapse: collapse; border: 1px solid var(--ed-rule); font-size: .875rem; line-height: 1.65; }
.article-content :deep(th), .article-content :deep(td) { min-width: 10rem; border: 1px solid var(--ed-rule); padding: .85rem 1rem; text-align: left; vertical-align: top; }
.article-content :deep(th) { background: var(--ed-soft); color: var(--ed-ink); font-weight: 700; }
.article-content :deep(tbody tr:nth-child(even)) { background: var(--ed-paper); }
.article-content :deep(caption) { padding: .75rem; text-align: left; font-weight: 600; color: var(--ed-ink); }
.article-content :deep(hr) { margin: 2rem 0; border-color: var(--ed-rule); }
.article-content :deep(.sources) { font-size: .875rem; }
@media (max-width: 639px) {
  .ed-article :deep(.ed-page-heading h1) { font-size: clamp(30px, 8vw, 34px); }
  .article-content { font-size: 1rem; line-height: 1.8; }
  .article-content :deep(h2) { font-size: 1.375rem; }
  .article-content :deep(h3) { font-size: 1.125rem; }
  .article-content :deep(th), .article-content :deep(td) { min-width: 9rem; padding: .7rem; }
}
</style>
