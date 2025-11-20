<script setup>
import { computed } from 'vue';
import { useHead } from '#imports';
import { getFormatByType } from '~/config/formats';

const props = defineProps({
  type: {
    type: String,
    required: true,
  },
  city: {
    type: [Object, null],
    default: null,
  },
});

const resolvedCity = computed(() =>
  props.city && 'value' in props.city ? props.city.value : props.city,
);

const format = computed(() => getFormatByType(props.type));

const cityPrepositional = computed(
  () => resolvedCity.value?.nameRuPrepositional || 'в Казахстане',
);

const metaTitle = computed(() => {
  if (!format.value) return '';
  return format.value.seo.title.replaceAll('{{cityPrepositional}}', cityPrepositional.value);
});

const metaDescription = computed(() => {
  if (!format.value) return '';
  return format.value.seo.description.replaceAll('{{cityPrepositional}}', cityPrepositional.value);
});

useHead(() => ({
  title: metaTitle.value,
  meta: [
    { name: 'description', content: metaDescription.value },
    { property: 'og:title', content: metaTitle.value },
    { property: 'og:description', content: metaDescription.value },
  ],
}));
</script>

<template>
  <article v-if="format" class="format-landing">
    <header class="format-hero">
      <p class="eyebrow">Формат обучения</p>
      <h1>{{ metaTitle }}</h1>
      <p class="lead">{{ metaDescription }}</p>
    </header>

    <section
      v-for="section in format.sections"
      :key="section.id"
      class="section"
    >
      <h2>{{ section.title }}</h2>
      <p class="section__subtitle">{{ section.subtitle }}</p>
      <ul class="list">
        <li v-for="item in section.bullets" :key="item">{{ item }}</li>
      </ul>
    </section>

    <section class="section cta">
      <h2>Оставить заявку</h2>
      <p>Подберем график и формат под вашу задачу.</p>
      <div class="cta__actions">
        <a class="btn primary" href="#contact">Оставить заявку</a>
        <a class="btn ghost" href="tel:+77000000000">Позвонить</a>
      </div>
    </section>
  </article>
  <p v-else>Формат не найден.</p>
</template>
