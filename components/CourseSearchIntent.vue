<script setup lang="ts">
import { getCourseSearchIntent } from '~/shared/course-search-intent';
const props = defineProps<{ directionId?: string }>();
const { locale } = useI18n();
const path = useLocalePath();
const content = computed(() => getCourseSearchIntent(props.directionId, locale.value));
</script>

<template>
  <section v-if="content" id="training-documents" class="ed-public-section ed-program-section">
    <h2>{{ content.title }}</h2>
    <p>{{ content.preparation }}</p>
    <h3>{{ locale === 'kk' ? 'Оқу нәтижесі мен құжат' : 'Результат обучения и документы' }}</h3>
    <p>{{ content.document }}</p>
    <h3>{{ locale === 'kk' ? 'Оқу бағасын қалай білуге болады?' : 'Как узнать стоимость обучения' }}</h3>
    <p>{{ content.price }}</p>
    <NuxtLink class="ed-commerce-text-link" :to="path('/blog/obuchenie-udostoverenie-sertifikat-professiya')">{{ locale === 'kk' ? 'Куәлік, сертификат және кәсіптік даярлық туралы' : 'Удостоверение, сертификат и обучение рабочей профессии: как выбрать' }} <span aria-hidden="true">↗</span></NuxtLink>
  </section>
</template>
