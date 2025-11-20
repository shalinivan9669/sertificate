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
  <main class="space-y-8">
    <header class="space-y-2">
      <p class="text-sm font-semibold text-brand-accent uppercase tracking-wide">Блог</p>
      <h1 class="text-3xl font-bold text-slate-900">Полезные материалы</h1>
      <p class="text-slate-700">Разъяснения для специалистов по охране труда и безопасности.</p>
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
      <p v-if="!data?.items?.length" class="text-slate-600 col-span-full">Статей пока нет, скоро появится свежий контент.</p>
    </section>

    <nav class="flex items-center gap-4 text-sm text-slate-700" aria-label="Страницы блога">
      <NuxtLink
        v-if="page > 1"
        :to="`/blog?page=${page - 1}`"
        class="px-3 py-2 rounded border border-slate-200 bg-white hover:border-brand"
      >
        Предыдущая
      </NuxtLink>
      <span>Страница {{ page }} из {{ totalPages }}</span>
      <NuxtLink
        v-if="page < totalPages"
        :to="`/blog?page=${page + 1}`"
        class="px-3 py-2 rounded border border-slate-200 bg-white hover:border-brand"
      >
        Следующая
      </NuxtLink>
    </nav>
  </main>
</template>
