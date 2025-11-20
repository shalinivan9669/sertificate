<script setup>
import { computed } from 'vue';
import { useAsyncData, useHead, useRoute, queryContent } from '#imports';

const route = useRoute();
const pageSize = 10;
const page = computed(() => Number(route.query.page) || 1);

const { data } = await useAsyncData(
  () => `blog-page-${page.value}`,
  async () => {
    if (!process.server) {
      return { items: [], total: 0 };
    }
    const posts = await queryContent('blog').sort({ date: -1 }).find();
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
  title: 'Блог об охране труда и безопасности',
  meta: [
    {
      name: 'description',
      content:
        'Статьи об охране труда, промышленной и пожарной безопасности, ПТМ, электробезопасности, подготовке персонала.',
    },
  ],
});
</script>

<template>
  <main class="space-y-8">
    <header class="space-y-2">
      <p class="text-sm font-semibold text-brand-accent uppercase tracking-wide">Блог</p>
      <h1 class="text-3xl font-bold text-slate-900">Полезные материалы</h1>
      <p class="text-slate-700">Свежие публикации по охране труда и промышленной безопасности.</p>
    </header>

    <section class="grid gap-4 md:grid-cols-2">
      <article
        v-for="post in data?.items || []"
        :key="post._path"
        class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
      >
        <header class="flex items-start justify-between gap-2">
          <h2 class="text-lg font-semibold text-slate-900">
            <NuxtLink :to="post._path" class="hover:text-brand">{{ post.title }}</NuxtLink>
          </h2>
          <time :datetime="post.date" class="text-xs text-slate-500">{{ post.date }}</time>
        </header>
        <p class="mt-2 text-sm text-slate-700">{{ post.description }}</p>
      </article>
      <p v-if="!data?.items?.length" class="text-slate-600 col-span-full">Публикации скоро появятся.</p>
    </section>

    <nav class="flex items-center gap-4 text-sm text-slate-700" aria-label="Постраничная навигация">
      <NuxtLink
        v-if="page > 1"
        :to="`/blog?page=${page - 1}`"
        class="px-3 py-2 rounded border border-slate-200 bg-white hover:border-brand"
      >
        Назад
      </NuxtLink>
      <span>Страница {{ page }} из {{ totalPages }}</span>
      <NuxtLink
        v-if="page < totalPages"
        :to="`/blog?page=${page + 1}`"
        class="px-3 py-2 rounded border border-slate-200 bg-white hover:border-brand"
      >
        Вперёд
      </NuxtLink>
    </nav>
  </main>
</template>
