<script setup>
import { computed } from 'vue';
import { useHead, useRoute, createError, useLocalePath, useI18n } from '#imports';
import { findBlogPost } from '~/config/blog';
import { courses } from '~/config/courses';

const route = useRoute();
const localePath = useLocalePath();
const { locale, t } = useI18n();

const post = computed(() => {
  const slug = Array.isArray(route.params.slug) ? route.params.slug[0] : route.params.slug;
  return findBlogPost(slug);
});

const localizedPost = computed(() => {
  if (!post.value) return null;
  return {
    ...post.value,
    title: post.value.title?.[locale.value] || post.value.title?.ru || post.value.title,
    description:
      post.value.description?.[locale.value] || post.value.description?.ru || post.value.description,
    tags: post.value.tags?.[locale.value] || post.value.tags?.ru || post.value.tags || [],
    bodyHtml: post.value.bodyHtml?.[locale.value] || post.value.bodyHtml?.ru || post.value.bodyHtml,
  };
});

const getCourseName = (slug) => {
  const course = courses.find((item) => item.slug === slug);
  if (!course) return slug;
  return course.name[locale.value] || course.name.ru || slug;
};

if (!post.value) {
  throw createError({ statusCode: 404, statusMessage: 'Post not found' });
}

useHead(() => ({
  title: localizedPost.value?.title,
  meta: [
    { name: 'description', content: localizedPost.value?.description },
    { property: 'og:title', content: localizedPost.value?.title },
    { property: 'og:description', content: localizedPost.value?.description },
  ],
}));
</script>

<template>
  <article v-if="localizedPost" class="space-y-6">
    <header class="space-y-2 mb-4">
      <p class="text-sm font-semibold text-brand-accent uppercase tracking-wide">{{ t('blogPost.badge') }}</p>
      <h1 class="text-3xl font-bold text-slate-900">{{ localizedPost.title }}</h1>
      <p class="text-slate-700">{{ localizedPost.description }}</p>
    </header>

    <div class="prose max-w-none prose-slate" v-html="localizedPost.bodyHtml" />

    <section class="space-y-2">
      <h2 class="text-xl font-semibold text-slate-900">{{ t('blogPost.relatedTitle') }}</h2>
      <div class="flex flex-wrap gap-2">
        <NuxtLink
          v-for="course in localizedPost.relatedCourses"
          :key="course"
          :to="localePath(`/${course}`)"
          class="rounded-full border border-slate-200 bg-white px-3 py-1 text-sm text-slate-700 hover:border-brand hover:text-brand transition"
        >
          {{ getCourseName(course) }}
        </NuxtLink>
      </div>
    </section>
  </article>
  <p v-else class="text-slate-700">{{ t('blogPost.notFound') }}</p>
</template>
