<script setup>
import { computed } from 'vue';
import { useI18n, useLocalePath } from '#imports';
import { getFormatGuidance } from '~/content/format-guidance';

const props = defineProps({
  type: { type: String, required: true },
});
const { locale } = useI18n();
const localePath = useLocalePath();
const content = computed(() => getFormatGuidance(props.type, locale.value));
</script>

<template>
  <section v-if="content" id="format-preparation" class="ed-public-section">
    <h2>{{ content.title }}</h2>
    <p>{{ content.introduction }}</p>
    <h3>{{ content.labels.choice }}</h3>
    <p>{{ content.choice }}</p>
    <h3>{{ content.labels.checklist }}</h3>
    <ul class="ed-public-list">
      <li v-for="item in content.checklist" :key="item">{{ item }}</li>
    </ul>
    <h3>{{ content.labels.constraint }}</h3>
    <p>{{ content.constraint }}</p>
    <h3>{{ content.labels.directions }}</h3>
    <p>{{ content.labels.directionsLead }}</p>
    <div class="ed-public-links">
      <NuxtLink v-for="link in content.directions" :key="link.to" :to="localePath(link.to)">{{ link.label }}</NuxtLink>
    </div>
    <h3>{{ content.labels.cities }}</h3>
    <p>{{ content.labels.citiesLead }}</p>
    <div class="ed-public-links">
      <NuxtLink v-for="link in content.cities" :key="link.to" :to="localePath(link.to)">{{ link.label }}</NuxtLink>
    </div>
  </section>
</template>
