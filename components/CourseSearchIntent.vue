<script setup lang="ts">
import { getCourseSearchIntent } from '~/shared/course-search-intent';
import { getCoursePublicPath, resolveCourseDirection } from '~/shared/course-registry';
import { getCourseSearchContent } from '~/shared/course-search-content';
import { leadContextQuery } from '~/shared/lead-context';
import { getSortedBlogPosts } from '#build/blog-summaries.mjs';
const props = withDefaults(defineProps<{ directionId?: string; includeArticles?: boolean }>(), { includeArticles: true });
const { locale } = useI18n();
const path = useLocalePath();
const route = useRoute();
const content = computed(() => getCourseSearchIntent(props.directionId, locale.value));
const related = computed(() => (content.value?.related || []).flatMap((id) => {
  const destination = getCoursePublicPath(id);
  const label = getCourseSearchContent(id, locale.value)?.heading;
  return destination && label ? [{ id, label, to: { path: path(destination), query: leadContextQuery({ city: route.query.city, format: route.query.format }) } }] : [];
}));
const articles = computed(() => {
  const direction = resolveCourseDirection(props.directionId);
  return direction ? getSortedBlogPosts()
    .filter((post) => post.relatedCourses?.includes(direction.id))
    .slice(0, 3)
    .map((post) => ({ slug: post.slug, label: post.title[locale.value === 'kk' ? 'kk' : 'ru'], to: path(`/blog/${post.slug}`) })) : [];
});
</script>

<template>
  <section v-if="content" id="training-documents" class="ed-public-section ed-program-section">
    <h2>{{ locale === 'kk' ? 'Оқу бағыты мен міндеттері' : 'Задачи и выбор обучения' }}</h2>
    <p>{{ content.summary }}</p>
    <h3>{{ content.question }}</h3>
    <p>{{ content.answer }}</p>
    <h3>{{ locale === 'kk' ? 'Тіркелуге дейін нені хабарлау керек?' : 'Что сообщить перед записью' }}</h3>
    <p>{{ content.preparation }}</p>
    <h3>{{ locale === 'kk' ? 'Оқу нәтижесі мен құжат' : 'Результат обучения и документы' }}</h3>
    <p>{{ content.document }}</p>
    <h3>{{ locale === 'kk' ? 'Оқу бағасын қалай білуге болады?' : 'Как узнать стоимость обучения' }}</h3>
    <p>{{ content.price }}</p>
    <NuxtLink class="ed-commerce-text-link" :to="path('/blog/obuchenie-udostoverenie-sertifikat-professiya')">{{ locale === 'kk' ? 'Куәлік, сертификат және кәсіптік даярлық туралы' : 'Удостоверение, сертификат и обучение рабочей профессии: как выбрать' }} <span aria-hidden="true">↗</span></NuxtLink>
    <template v-if="includeArticles !== false && articles.length">
      <h3>{{ locale === 'kk' ? 'Оқу таңдауға көмектесетін материалдар' : 'Материалы для выбора обучения' }}</h3>
      <ul class="ed-public-list"><li v-for="article in articles" :key="article.slug"><NuxtLink :to="article.to">{{ article.label }}</NuxtLink></li></ul>
    </template>
    <template v-if="related.length">
      <h3>{{ locale === 'kk' ? 'Міндетіңізге қатысты оқу бағыттары' : 'Связанные направления подготовки' }}</h3>
      <div class="ed-public-links"><NuxtLink v-for="item in related" :key="item.id" :to="item.to">{{ item.label }}</NuxtLink></div>
    </template>
  </section>
</template>
