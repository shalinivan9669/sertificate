<script setup>
import { computed } from 'vue';
import { useAsyncData, useHead, useRoute } from '#imports';

const route = useRoute();
const pageSize = 10;
const page = computed(() => Number(route.query.page) || 1);

const { data } = await useAsyncData(
  () => `blog-page-${page.value}`,
  async () => {
    const res = await $fetch('/api/_content/query', {
      method: 'POST',
      body: {
        where: { _path: { $regex: '^/blog' } },
        sort: [{ date: -1 }],
      },
    });
    const posts = res?.data || [];
    const total = posts.length;
    const start = (page.value - 1) * pageSize;
    return {
      items: posts.slice(start, start + pageSize),
      total,
    };
  },
  { watch: [page] },
);

const totalPages = computed(() => Math.max(1, Math.ceil((data.value?.total || 0) / pageSize)));

useHead({
  title: 'Блог об охране труда и промышленной безопасности',
  meta: [
    {
      name: 'description',
      content: 'Разъяснения по охране труда, промышленной безопасности, ПТМ, продлению удостоверений и требованиям проверок.',
    },
  ],
});
</script>

<template>
  <main class="blog-index">
    <header class="section__header">
      <h1>Блог</h1>
      <p>Полезные материалы и разъяснения для специалистов по охране труда и безопасности.</p>
    </header>

    <section class="blog-list">
      <article
        v-for="post in data?.items || []"
        :key="post._path"
        class="blog-card"
      >
        <header>
          <h2>
            <NuxtLink :to="post._path">{{ post.title }}</NuxtLink>
          </h2>
          <time :datetime="post.date">{{ post.date }}</time>
        </header>
        <p>{{ post.description }}</p>
      </article>
      <p v-if="!data?.items?.length">Статей пока нет, скоро появится свежий контент.</p>
    </section>

    <nav class="pagination" aria-label="Страницы блога">
      <NuxtLink
        v-if="page > 1"
        :to="`/blog?page=${page - 1}`"
        class="page-link"
      >
        Предыдущая
      </NuxtLink>
      <span>Страница {{ page }} из {{ totalPages }}</span>
      <NuxtLink
        v-if="page < totalPages"
        :to="`/blog?page=${page + 1}`"
        class="page-link"
      >
        Следующая
      </NuxtLink>
    </nav>
  </main>
</template>
