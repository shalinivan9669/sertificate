<script setup>
import { computed } from 'vue';
import { useAsyncData, useHead, useRoute } from '#imports';
import { courses } from '~/config/courses';
import { defaultCitySlug } from '~/config/cities';

const route = useRoute();
const slug = computed(() => route.params.slug);

const { data: post } = await useAsyncData(
  () => `blog-post-${slug.value}`,
  async () => {
    const res = await $fetch('/api/_content/query', {
      method: 'POST',
      body: {
        where: { slug: slug.value, _path: { $regex: '^/blog' } },
        limit: 1,
      },
    });
    return res?.data?.[0] || null;
  },
);

const cityParam = computed(() =>
  Array.isArray(route.params.city) ? route.params.city[0] : route.params.city,
);

const relatedCourses = computed(() => {
  if (!post.value?.relatedCourses?.length) return [];
  return courses.filter((c) => post.value.relatedCourses.includes(c.slug));
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
  <main v-if="post" class="blog-post">
    <article>
      <header>
        <p class="eyebrow">Блог</p>
        <h1>{{ post.title }}</h1>
        <time :datetime="post.date">{{ post.date }}</time>
        <p class="lead">{{ post.description }}</p>
      </header>

      <ContentRenderer :value="post" />

      <footer class="section">
        <section v-if="relatedCourses.length" class="related-courses">
          <h2>Связанные курсы</h2>
          <ul>
            <li v-for="course in relatedCourses" :key="course.slug">
              <NuxtLink :to="courseLink(course.slug)">{{ course.name.ru }}</NuxtLink>
            </li>
          </ul>
        </section>
      </footer>
    </article>
  </main>
  <p v-else>Статья не найдена.</p>
</template>
