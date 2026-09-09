<script setup>
import { computed } from 'vue';
import { useHead, useRoute, useLocalePath, useI18n, useRuntimeConfig } from '#imports';
import { formatBlogDate, getSortedBlogPosts } from '~/config/blog';

const route = useRoute();
const localePath = useLocalePath();
const { locale, t } = useI18n();
const runtimeConfig = useRuntimeConfig();
const pageSize = 10;
const localize = (value) => value?.[locale.value] || value?.ru || value;
const readingMinutes = (html) => Math.max(1, Math.ceil(String(html || '').replace(/<[^>]*>/g, ' ').trim().split(/\s+/).filter(Boolean).length / 180));
const formatDate = (date) => formatBlogDate(date, locale.value);
const copy = computed(() => locale.value === 'kk' ? {
  title: 'Қазақстандағы еңбек және өнеркәсіптік қауіпсіздік туралы блог',
  description: 'Қазақстандағы еңбекті қорғау, өнеркәсіптік, өрт және электр қауіпсіздігі бойынша практикалық нұсқаулықтар: оқу мерзімдері, білімді тексеру және құжаттар.',
  badge: 'OT Center · Білім қоры',
  heading: 'Қауіпсіз жұмысты ұйымдастыруға көмектесетін мақалалар',
  introduction: 'Кімге қандай оқу қажет, білімді қашан тексеру керек және қандай құжаттарды дайындаған жөн — ресми дереккөздерге сүйеніп түсіндіреміз.',
  read: 'Мақаланы оқу', minutes: 'мин оқу', updated: 'Жаңартылды',
  helpTitle: 'Қызметкерлерге арналған оқу бағдарламасын таңдаңыз',
  helpText: 'Қызметкерлердің лауазымдары мен жұмыс түрлерін жазыңыз. OT Center командасы тиісті бағдарламалар мен оқу форматын таңдауға көмектеседі.',
  contact: 'OT Center-ге хабарласу',
} : {
  title: 'Блог об охране труда и промышленной безопасности в Казахстане',
  description: 'Практические руководства по охране труда, промышленной, пожарной и электробезопасности в Казахстане: сроки обучения, проверка знаний и документы.',
  badge: 'OT Center · База знаний',
  heading: 'Статьи, которые помогают организовать безопасную работу',
  introduction: 'Кому какое обучение нужно, когда проверять знания и какие документы подготовить — разбираем требования с опорой на официальные источники.',
  read: 'Читать статью', minutes: 'мин чтения', updated: 'Обновлено',
  helpTitle: 'Подберите обучение для своей команды',
  helpText: 'Расскажите о должностях сотрудников и видах работ. Команда OT Center поможет подобрать подходящие программы и формат обучения.',
  contact: 'Связаться с OT Center',
});

const allPosts = computed(() => getSortedBlogPosts().map((post) => ({
  ...post,
  title: localize(post.title),
  description: localize(post.description),
  tags: localize(post.tags) || [],
  imageAlt: localize(post.image?.alt),
  readingMinutes: readingMinutes(localize(post.bodyHtml)),
})));
const totalPages = computed(() => Math.max(1, Math.ceil(allPosts.value.length / pageSize)));
const page = computed(() => {
  const requested = Number(route.query.page);
  return Number.isInteger(requested) && requested > 0 ? Math.min(requested, totalPages.value) : 1;
});
const paginatedPosts = computed(() => allPosts.value.slice((page.value - 1) * pageSize, page.value * pageSize));
const absoluteUrl = (path) => new URL(path, runtimeConfig.public.siteUrl).toString();

useHead(() => ({
  title: copy.value.title,
  meta: [
    { name: 'description', content: copy.value.description },
    { property: 'og:title', content: copy.value.title },
    { property: 'og:description', content: copy.value.description },
    { property: 'og:type', content: 'website' },
    { property: 'og:url', content: absoluteUrl(localePath('/blog')) },
    { name: 'twitter:title', content: copy.value.title },
    { name: 'twitter:description', content: copy.value.description },
    ...(allPosts.value[0]?.image?.src ? [
      { property: 'og:image', content: absoluteUrl(allPosts.value[0].image.src) },
      { property: 'og:image:alt', content: allPosts.value[0].imageAlt },
      { name: 'twitter:image', content: absoluteUrl(allPosts.value[0].image.src) },
      { name: 'twitter:image:alt', content: allPosts.value[0].imageAlt },
    ] : []),
  ],
}));
</script>

<template>
  <div class="space-y-10 md:space-y-14">
    <header class="max-w-4xl space-y-4">
      <p class="text-xs font-semibold text-brand-accent uppercase tracking-widest">{{ copy.badge }}</p>
      <h1 class="font-headline text-3xl font-extrabold leading-tight text-slate-900 sm:text-4xl lg:text-5xl">{{ copy.heading }}</h1>
      <p class="max-w-3xl text-base leading-relaxed text-slate-600 sm:text-lg">{{ copy.introduction }}</p>
    </header>

    <section class="grid gap-6 md:grid-cols-2" :aria-label="t('blog.title')">
      <article
        v-for="(post, index) in paginatedPosts"
        :key="post._path"
        class="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md"
        :class="{ 'md:col-span-2 md:grid md:grid-cols-2': index === 0 }"
      >
        <NuxtLink v-if="post.image?.src" :to="localePath(post._path)" class="block overflow-hidden bg-slate-100" tabindex="-1" aria-hidden="true">
          <img
            :src="post.image.src"
            alt=""
            :width="post.image.width"
            :height="post.image.height"
            :loading="index === 0 ? 'eager' : 'lazy'"
            :fetchpriority="index === 0 ? 'high' : 'auto'"
            decoding="async"
            class="aspect-[3/2] h-full w-full object-cover"
          />
        </NuxtLink>
        <div class="flex flex-col p-6 sm:p-8" :class="{ 'justify-center': index === 0 }">
          <div v-if="post.tags.length" class="mb-4 flex flex-wrap gap-2">
            <span v-for="tag in post.tags.slice(0, 2)" :key="tag" class="rounded-full bg-brand-soft px-3 py-1 text-xs font-medium text-brand-accent">{{ tag }}</span>
          </div>
          <h2 class="font-headline text-xl font-bold leading-snug text-slate-900" :class="{ 'sm:text-2xl': index === 0 }">
            <NuxtLink :to="localePath(post._path)" class="rounded-sm hover:text-brand-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-accent">{{ post.title }}</NuxtLink>
          </h2>
          <p class="mt-3 text-sm leading-relaxed text-slate-600 sm:text-base">{{ post.description }}</p>
          <div class="mt-5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs leading-relaxed text-slate-500">
            <span>
              <span v-if="post.updatedAt && post.updatedAt !== post.date">{{ copy.updated }}: </span>
              <time :datetime="post.updatedAt || post.date">{{ formatDate(post.updatedAt || post.date) }}</time>
            </span>
            <span>≈ {{ post.readingMinutes }} {{ copy.minutes }}</span>
          </div>
          <NuxtLink :to="localePath(post._path)" class="mt-6 inline-flex items-center gap-2 self-start text-sm font-semibold text-brand-accent hover:underline">
            {{ copy.read }} <span aria-hidden="true">→</span>
          </NuxtLink>
        </div>
      </article>
      <p v-if="!paginatedPosts.length" class="col-span-full text-slate-600">{{ t('blog.empty') }}</p>
    </section>

    <nav v-if="totalPages > 1" class="flex items-center gap-4 text-sm text-slate-700" :aria-label="t('blog.paginationLabel')">
      <NuxtLink v-if="page > 1" :to="`${localePath('/blog')}?page=${page - 1}`" class="rounded border border-slate-200 bg-white px-3 py-2 hover:border-brand">{{ t('blog.prev') }}</NuxtLink>
      <span>{{ t('blog.pageOf', { page, total: totalPages }) }}</span>
      <NuxtLink v-if="page < totalPages" :to="`${localePath('/blog')}?page=${page + 1}`" class="rounded border border-slate-200 bg-white px-3 py-2 hover:border-brand">{{ t('blog.next') }}</NuxtLink>
    </nav>

    <section class="rounded-2xl bg-brand p-6 text-white sm:p-8 md:flex md:items-center md:justify-between md:gap-8">
      <div class="max-w-2xl">
        <h2 class="font-headline text-xl font-bold sm:text-2xl">{{ copy.helpTitle }}</h2>
        <p class="mt-3 text-sm leading-relaxed text-slate-300 sm:text-base">{{ copy.helpText }}</p>
      </div>
      <NuxtLink :to="localePath('/contacts')" class="mt-6 inline-flex shrink-0 justify-center rounded-lg bg-white px-5 py-3 text-sm font-semibold text-brand hover:bg-slate-100 md:mt-0">{{ copy.contact }}</NuxtLink>
    </section>
  </div>
</template>
