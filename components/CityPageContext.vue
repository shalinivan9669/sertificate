<script setup>
import { useI18n, useLocalePath } from '#imports';
defineProps({ content: { type: Object, required: true } });
const { locale } = useI18n();
const localePath = useLocalePath();
</script>

<template>
  <div class="ed-city-context">
    <section v-for="section in content.sections" :id="section.id" :key="section.id" class="ed-public-section">
      <h2>{{ section.title }}</h2><p>{{ section.text }}</p>
      <ul v-if="section.bullets?.length" class="ed-public-list"><li v-for="item in section.bullets" :key="item">{{ item }}</li></ul>
    </section>
    <section class="ed-public-section">
      <h2>{{ locale === 'kk' ? 'Осы қаладағы оқу нұсқалары' : 'Варианты обучения в этом городе' }}</h2>
      <div class="ed-public-links"><NuxtLink v-for="link in content.links" :key="link.to" :to="localePath(link.to)">{{ link.label }}</NuxtLink></div>
    </section>
  </div>
</template>
