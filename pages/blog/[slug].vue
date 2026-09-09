<script setup>
import { computed } from 'vue';
import { useHead, useRoute, createError, useLocalePath, useI18n, useRuntimeConfig } from '#imports';
import { findBlogPost, formatBlogDate, getSortedBlogPosts } from '~/config/blog';
import { courses } from '~/config/courses';

const route = useRoute();
const localePath = useLocalePath();
const { locale, t } = useI18n();
const runtimeConfig = useRuntimeConfig();
const localize = (value) => value?.[locale.value] || value?.ru || value;
const absoluteUrl = (path) => new URL(path, runtimeConfig.public.siteUrl).toString();
const formatDate = (date) => formatBlogDate(date, locale.value);
const copy = computed(() => locale.value === 'kk' ? {
  home: 'Басты бет', blog: 'Блог', breadcrumbs: 'Навигация жолы',
  published: 'Жарияланды', updated: 'Жаңартылды', minutes: 'мин оқу',
  author: 'Материалды дайындаған', contents: 'Мақала мазмұны',
  imageNote: 'Тақырыптық иллюстрация жасанды интеллект көмегімен жасалды.',
  helpTitle: 'Қандай оқу қажет екенін анықтауға көмектесеміз',
  helpText: 'Лауазымдарды, жұмыс түрлерін және соңғы білім тексеру күндерін дайындаңыз. Бағдарламаны таңдау және оқуды ұйымдастыру үшін OT Center-ге хабарласыңыз.',
  contact: 'Оқу бойынша кеңес алу', related: 'Тақырып бойынша тағы', allArticles: 'Барлық мақалалар',
} : {
  home: 'Главная', blog: 'Блог', breadcrumbs: 'Хлебные крошки',
  published: 'Опубликовано', updated: 'Обновлено', minutes: 'мин чтения',
  author: 'Материал подготовлен', contents: 'В этой статье',
  imageNote: 'Тематическая иллюстрация создана с помощью искусственного интеллекта.',
  helpTitle: 'Поможем определить, какое обучение нужно',
  helpText: 'Подготовьте должности сотрудников, виды работ и даты последней проверки знаний. Обратитесь в OT Center, чтобы подобрать программы и организовать обучение.',
  contact: 'Обсудить обучение', related: 'Ещё по теме', allArticles: 'Все статьи',
});

const post = computed(() => {
  const slug = Array.isArray(route.params.slug) ? route.params.slug[0] : route.params.slug;
  return findBlogPost(slug);
});
if (!post.value) throw createError({ statusCode: 404, statusMessage: 'Post not found' });

const localizedPost = computed(() => post.value ? {
  ...post.value,
  title: localize(post.value.title),
  seoTitle: localize(post.value.seoTitle) || localize(post.value.title),
  description: localize(post.value.description),
  tags: localize(post.value.tags) || [],
  toc: localize(post.value.toc) || [],
  imageAlt: localize(post.value.image?.alt),
  bodyHtml: localize(post.value.bodyHtml) || '',
  relatedCourses: post.value.relatedCourses || [],
} : null);
const wordCount = computed(() => String(localizedPost.value?.bodyHtml || '').replace(/<[^>]*>/g, ' ').trim().split(/\s+/).filter(Boolean).length);
const readingMinutes = computed(() => Math.max(1, Math.ceil(wordCount.value / 180)));
const relatedPosts = computed(() => getSortedBlogPosts()
  .filter((item) => item.slug !== post.value?.slug)
  .map((item) => ({
    ...item,
    title: localize(item.title),
    description: localize(item.description),
    relevance: (item.relatedCourses || []).filter((course) => post.value?.relatedCourses?.includes(course)).length,
  }))
  .sort((a, b) => b.relevance - a.relevance)
  .slice(0, 3));
const getCourseName = (slug) => localize(courses.find((item) => item.slug === slug)?.name) || slug;

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
  <div v-if="localizedPost" class="mx-auto max-w-6xl">
    <nav :aria-label="copy.breadcrumbs" class="mb-8 text-sm leading-relaxed text-slate-500">
      <ol class="flex flex-wrap gap-x-2 gap-y-1">
        <li><NuxtLink :to="localePath('/')" class="hover:text-brand-accent hover:underline">{{ copy.home }}</NuxtLink></li>
        <li aria-hidden="true">/</li>
        <li><NuxtLink :to="localePath('/blog')" class="hover:text-brand-accent hover:underline">{{ copy.blog }}</NuxtLink></li>
        <li aria-hidden="true">/</li>
        <li aria-current="page" class="text-slate-700">{{ localizedPost.title }}</li>
      </ol>
    </nav>

    <article>
      <header class="max-w-4xl space-y-5">
        <div class="flex flex-wrap gap-2">
          <span v-for="tag in localizedPost.tags" :key="tag" class="rounded-full bg-brand-soft px-3 py-1 text-xs font-semibold text-brand-accent">{{ tag }}</span>
        </div>
        <h1 class="font-headline text-3xl font-extrabold leading-tight text-slate-900 sm:text-4xl lg:text-5xl">{{ localizedPost.title }}</h1>
        <p class="text-base leading-relaxed text-slate-600 sm:text-xl">{{ localizedPost.description }}</p>
        <div class="flex flex-wrap gap-x-5 gap-y-2 text-xs leading-relaxed text-slate-500 sm:text-sm">
          <span>{{ copy.published }}: <time :datetime="localizedPost.date">{{ formatDate(localizedPost.date) }}</time></span>
          <span v-if="localizedPost.updatedAt && localizedPost.updatedAt !== localizedPost.date">{{ copy.updated }}: <time :datetime="localizedPost.updatedAt">{{ formatDate(localizedPost.updatedAt) }}</time></span>
          <span>≈ {{ readingMinutes }} {{ copy.minutes }}</span>
        </div>
        <p class="text-sm text-slate-600">{{ copy.author }} <NuxtLink :to="localePath('/contacts')" class="font-semibold text-brand-accent hover:underline">OT Center</NuxtLink></p>
      </header>

      <figure v-if="localizedPost.image?.src" class="mt-8 mb-10">
        <img :src="localizedPost.image.src" :alt="localizedPost.imageAlt" :width="localizedPost.image.width" :height="localizedPost.image.height" fetchpriority="high" loading="eager" decoding="async" class="aspect-[3/2] max-h-[540px] w-full rounded-2xl bg-slate-100 object-cover" />
        <figcaption class="mt-2 text-xs leading-relaxed text-slate-500">{{ copy.imageNote }}</figcaption>
      </figure>

      <div class="mt-10 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_16rem] lg:gap-12">
        <aside v-if="localizedPost.toc.length" class="rounded-xl border border-slate-200 bg-white p-5 lg:sticky lg:top-6 lg:col-start-2 lg:row-start-1">
          <nav :aria-label="copy.contents">
            <p class="mb-4 text-sm font-bold text-slate-900">{{ copy.contents }}</p>
            <ol class="space-y-3">
              <li v-for="item in localizedPost.toc" :key="item.id" class="text-sm leading-relaxed">
                <a :href="`#${item.id}`" class="text-slate-600 underline decoration-slate-200 underline-offset-4 hover:text-brand-accent hover:decoration-brand-accent">{{ item.title }}</a>
              </li>
            </ol>
          </nav>
        </aside>

        <div class="min-w-0 max-w-3xl lg:col-start-1 lg:row-start-1">
          <div class="article-content" v-html="localizedPost.bodyHtml" />

          <section class="mt-10 rounded-2xl bg-brand p-6 text-white sm:p-8">
            <h2 class="font-headline text-xl font-bold sm:text-2xl">{{ copy.helpTitle }}</h2>
            <p class="mt-3 text-sm leading-relaxed text-slate-300 sm:text-base">{{ copy.helpText }}</p>
            <NuxtLink :to="localePath('/contacts')" class="mt-5 inline-flex rounded-lg bg-white px-5 py-3 text-sm font-semibold text-brand hover:bg-slate-100">{{ copy.contact }}</NuxtLink>
          </section>

          <section v-if="localizedPost.relatedCourses.length" class="mt-8 space-y-4">
            <h2 class="text-lg font-bold text-slate-900">{{ t('blogPost.relatedTitle') }}</h2>
            <div class="flex flex-wrap gap-3">
              <NuxtLink v-for="course in localizedPost.relatedCourses" :key="course" :to="localePath(`/${course}`)" class="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-brand-accent hover:text-brand-accent">{{ getCourseName(course) }} <span aria-hidden="true">→</span></NuxtLink>
            </div>
          </section>
        </div>
      </div>
    </article>

    <section v-if="relatedPosts.length" class="mt-14 border-t border-slate-200 pt-10">
      <div class="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h2 class="font-headline text-2xl font-bold text-slate-900">{{ copy.related }}</h2>
        <NuxtLink :to="localePath('/blog')" class="text-sm font-semibold text-brand-accent hover:underline">{{ copy.allArticles }} <span aria-hidden="true">→</span></NuxtLink>
      </div>
      <div class="grid gap-6 md:grid-cols-3">
        <article v-for="relatedPost in relatedPosts" :key="relatedPost.slug" class="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <NuxtLink v-if="relatedPost.image?.src" :to="localePath(relatedPost._path)" tabindex="-1" aria-hidden="true">
            <img :src="relatedPost.image.src" alt="" :width="relatedPost.image.width" :height="relatedPost.image.height" loading="lazy" decoding="async" class="aspect-[3/2] w-full bg-slate-100 object-cover" />
          </NuxtLink>
          <div class="p-5">
            <h3 class="text-base font-bold leading-snug text-slate-900"><NuxtLink :to="localePath(relatedPost._path)" class="hover:text-brand-accent hover:underline">{{ relatedPost.title }}</NuxtLink></h3>
            <p class="mt-3 text-sm leading-relaxed text-slate-600">{{ relatedPost.description }}</p>
          </div>
        </article>
      </div>
    </section>
  </div>
  <p v-else class="text-slate-700">{{ t('blogPost.notFound') }}</p>
</template>

<style scoped>
.article-content { color: #334155; font-size: 1.0625rem; line-height: 1.85; overflow-wrap: anywhere; }
.article-content :deep(> :first-child) { margin-top: 0; }
.article-content :deep(h2), .article-content :deep(h3) { color: #0f172a; font-family: 'Manrope', system-ui, sans-serif; font-weight: 800; line-height: 1.35; scroll-margin-top: 1.5rem; }
.article-content :deep(h2) { margin: 2.5rem 0 1rem; font-size: 1.6rem; }
.article-content :deep(h3) { margin: 1.75rem 0 .75rem; font-size: 1.2rem; }
.article-content :deep(p) { margin: 1rem 0; }
.article-content :deep(strong) { color: #0f172a; font-weight: 700; }
.article-content :deep(ul), .article-content :deep(ol) { margin: 1rem 0; padding-left: 1.5rem; }
.article-content :deep(ul) { list-style: disc; }
.article-content :deep(ol) { list-style: decimal; }
.article-content :deep(li) { margin: .5rem 0; padding-left: .2rem; }
.article-content :deep(li::marker) { color: #2b7a78; }
.article-content :deep(a) { color: #236663; font-weight: 500; text-decoration: underline; text-decoration-color: #98bdb8; text-underline-offset: 3px; }
.article-content :deep(a:hover) { color: #0f172a; text-decoration-color: currentColor; }
.article-content :deep(a:focus-visible) { outline: 2px solid #2b7a78; outline-offset: 4px; border-radius: 2px; }
.article-content :deep(blockquote), .article-content :deep(.callout) { margin: 1.5rem 0; border-left: 3px solid #2b7a78; border-radius: 0 .75rem .75rem 0; background: #e9f1f0; padding: 1rem 1.25rem; }
.article-content :deep(blockquote p:first-child), .article-content :deep(.callout p:first-child) { margin-top: 0; }
.article-content :deep(blockquote p:last-child), .article-content :deep(.callout p:last-child) { margin-bottom: 0; }
.article-content :deep(.table-wrap), .article-content :deep(.table-scroll) { max-width: 100%; overflow-x: auto; }
.article-content :deep(table) { display: block; width: 100%; max-width: 100%; overflow-x: auto; margin: 1.5rem 0; border-collapse: collapse; border: 1px solid #cbd5e1; font-size: .875rem; line-height: 1.65; }
.article-content :deep(th), .article-content :deep(td) { min-width: 10rem; border: 1px solid #cbd5e1; padding: .85rem 1rem; text-align: left; vertical-align: top; }
.article-content :deep(th) { background: #e9f1f0; color: #0f172a; font-weight: 700; }
.article-content :deep(tbody tr:nth-child(even)) { background: #f8fafc; }
.article-content :deep(caption) { padding: .75rem; text-align: left; font-weight: 600; color: #0f172a; }
.article-content :deep(hr) { margin: 2rem 0; border-color: #e2e8f0; }
.article-content :deep(.sources) { font-size: .875rem; }
@media (max-width: 639px) {
  .article-content { font-size: 1rem; line-height: 1.8; }
  .article-content :deep(h2) { font-size: 1.375rem; }
  .article-content :deep(h3) { font-size: 1.125rem; }
  .article-content :deep(th), .article-content :deep(td) { min-width: 9rem; padding: .7rem; }
}
</style>
