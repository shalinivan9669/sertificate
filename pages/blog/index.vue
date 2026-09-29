<script setup>
import { leadContextQuery } from '~/shared/lead-context';
import { computed } from 'vue';
import { useHead, useRoute, useLocalePath, useI18n, useRuntimeConfig } from '#imports';
import { formatBlogDate, getSortedBlogPosts } from '~/config/blog';

const route = useRoute();
const localePath = useLocalePath();
const { locale, t } = useI18n();
const runtimeConfig = useRuntimeConfig();
const localize = (value) => value?.[locale.value] || value?.ru || value;
const readingMinutes = (html) => Math.max(1, Math.ceil(String(html || '').replace(/<[^>]*>/g, ' ').trim().split(/\s+/).filter(Boolean).length / 180));
const contextRoute = (path) => ({ path: localePath(path), query: leadContextQuery(route.query) });
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
  <div class="ed-public ed-journal">
    <EditorialPageHeader :title="locale === 'kk' ? 'Қауіпсіз жұмыс туралы' : 'О безопасной работе'" :lead="copy.introduction" />
    <section class="ed-journal-list" :aria-label="t('blog.title')">
      <article v-for="(post, index) in allPosts" :key="post._path" class="ed-journal-entry" :class="{ 'ed-journal-entry--feature': index === 0 }">
        <NuxtLink v-if="post.image?.src" :to="contextRoute(post._path)" tabindex="-1" aria-hidden="true"><img :src="post.image.src" alt="" :width="post.image.width" :height="post.image.height" :loading="index === 0 ? 'eager' : 'lazy'" :fetchpriority="index === 0 ? 'high' : 'auto'" decoding="async" /></NuxtLink>
        <div>
          <div v-if="post.tags.length" class="ed-public-tags"><span v-for="tag in post.tags.slice(0, 2)" :key="tag">{{ tag }}</span></div>
          <h2><NuxtLink :to="contextRoute(post._path)">{{ post.title }}</NuxtLink></h2>
          <p>{{ post.description }}</p>
          <div class="ed-journal-meta"><span><span v-if="post.updatedAt && post.updatedAt !== post.date">{{ copy.updated }}: </span><time :datetime="post.updatedAt || post.date">{{ formatDate(post.updatedAt || post.date) }}</time></span><span>≈ {{ post.readingMinutes }} {{ copy.minutes }}</span></div>
          <NuxtLink :to="contextRoute(post._path)" class="ed-public-link">{{ copy.read }}</NuxtLink>
        </div>
      </article>
      <p v-if="!allPosts.length" class="ed-public-note">{{ t('blog.empty') }}</p>
    </section>
    <section class="ed-public-callout"><h2>{{ copy.helpTitle }}</h2><p>{{ copy.helpText }}</p><div class="ed-public-actions"><NuxtLink :to="contextRoute('/contacts')" class="ed-public-button">{{ copy.contact }}</NuxtLink></div></section>
  </div>
</template>
