<script setup>
import { computed } from 'vue';
import { useHead, useRoute, createError } from '#imports';
import { courses } from '~/config/courses';
import { defaultCitySlug } from '~/config/cities';
import { findBlogPost } from '~/config/blog';

const route = useRoute();
const slug = computed(() =>
  Array.isArray(route.params.slug) ? route.params.slug[0] : route.params.slug,
);

const post = computed(() => findBlogPost(slug.value) || null);

if (!post.value) {
  throw createError({ statusCode: 404, statusMessage: 'Post not found' });
}

const cityParam = computed(() =>
  Array.isArray(route.params.city) ? route.params.city[0] : route.params.city,
);

const relatedCourses = computed(() => {
  if (!post.value?.relatedCourses?.length) return [];
  return courses.filter((course) => post.value.relatedCourses.includes(course.slug));
});

const courseLink = (courseSlug) => {
  if (cityParam.value) {
    return `/${cityParam.value}/${courseSlug}`;
  }
  return `/${defaultCitySlug}/${courseSlug}`;
};

useHead(() => ({
  title: post.value?.title,
  meta: [
    { name: 'description', content: post.value?.description },
    { property: 'og:title', content: post.value?.title },
    { property: 'og:description', content: post.value?.description },
  ],
  link: [{ rel: 'canonical', href: `${'https://example.kz'}${post.value?._path || ''}` }],
}));
</script>

<template>
  <main v-if="post" class="space-y-8">
    <article class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <header class="space-y-2 mb-4">
        <p class="text-sm font-semibold text-brand-accent uppercase tracking-wide">�'�>�?�?</p>
        <h1 class="text-3xl font-bold text-slate-900">{{ post.title }}</h1>
        <time :datetime="post.date" class="text-sm text-slate-500">{{ post.date }}</time>
        <p class="text-slate-700">{{ post.description }}</p>
      </header>

      <div class="prose max-w-none prose-slate" v-html="post.bodyHtml" />

      <footer class="mt-8 border-t border-slate-200 pt-4">
        <section v-if="relatedCourses.length" class="space-y-2">
          <h2 class="text-xl font-semibold text-slate-900">���?�?�����?�?�<�� ��?�?�?�<</h2>
          <ul class="grid gap-2 md:grid-cols-2">
            <li v-for="course in relatedCourses" :key="course.slug">
              <NuxtLink :to="courseLink(course.slug)" class="text-brand hover:underline">
                {{ course.name.ru }}
              </NuxtLink>
            </li>
          </ul>
        </section>
      </footer>
    </article>
  </main>
  <p v-else class="text-slate-700">�?���'��?����> �?�� �?�����?��?.</p>
</template>
