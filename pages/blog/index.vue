<script setup>
import { computed } from 'vue';
import { useHead, useRoute, useLocalePath } from '#imports';
import { getSortedBlogPosts } from '~/config/blog';

const route = useRoute();
const localePath = useLocalePath();
const pageSize = 10;
const page = computed(() => Number(route.query.page) || 1);

const allPosts = computed(() => getSortedBlogPosts());
const totalPages = computed(() => Math.max(1, Math.ceil(allPosts.value.length / pageSize)));
const paginatedPosts = computed(() => {
  const start = (page.value - 1) * pageSize;
  return allPosts.value.slice(start, start + pageSize);
});

useHead({
  title: 'Блог об обучении по охране труда',
  meta: [
    {
      name: 'description',
      content:
        'Статьи об охране труда, промышленной безопасности и обучении: требования, советы, обновления законодательства.',
    },
  ],
});
</script>

<template>
  <main class="space-y-8">
    <header class="space-y-2">
      <p class="text-sm font-semibold text-brand-accent uppercase tracking-wide">Блог</p>
      <h1 class="text-3xl font-bold text-slate-900">Полезные материалы и новости</h1>
      <p class="text-slate-700">
        Свежие статьи об обучении сотрудников, требованиях регуляторов и практических шагах по безопасности.
      </p>
    </header>

    <section class="grid gap-4 md:grid-cols-2">
      <article
        v-for="post in paginatedPosts"
        :key="post._path"
        class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
      >
        <header class="flex items-start justify-between gap-2">
          <h2 class="text-lg font-semibold text-slate-900">
            <NuxtLink :to="localePath(post._path)" class="hover:text-brand">{{ post.title }}</NuxtLink>
          </h2>
          <time :datetime="post.date" class="text-xs text-slate-500">{{ post.date }}</time>
        </header>
        <p class="mt-2 text-sm text-slate-700">{{ post.description }}</p>
      </article>
      <p v-if="!paginatedPosts.length" class="text-slate-600 col-span-full">Статьи пока не добавлены.</p>
    </section>

    <nav class="flex items-center gap-4 text-sm text-slate-700" aria-label="Постраничная навигация блога">
      <NuxtLink
        v-if="page > 1"
        :to="`${localePath('/blog')}?page=${page - 1}`"
        class="px-3 py-2 rounded border border-slate-200 bg-white hover:border-brand"
      >
        Назад
      </NuxtLink>
      <span>Страница {{ page }} из {{ totalPages }}</span>
      <NuxtLink
        v-if="page < totalPages"
        :to="`${localePath('/blog')}?page=${page + 1}`"
        class="px-3 py-2 rounded border border-slate-200 bg-white hover:border-brand"
      >
        Вперед
      </NuxtLink>
    </nav>
  </main>
</template>
