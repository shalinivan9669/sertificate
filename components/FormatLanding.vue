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
  <article v-if="format" class="space-y-8">
    <header class="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm space-y-3">
      <p class="text-sm font-semibold text-brand-accent uppercase tracking-wide">Формат обучения</p>
      <h1 class="text-3xl font-bold text-slate-900">{{ metaTitle }}</h1>
      <p class="text-lg text-slate-700">{{ metaDescription }}</p>
    </header>

    <section
      v-for="section in format.sections"
      :key="section.id"
      class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-3"
    >
      <h2 class="text-xl font-semibold text-slate-900">{{ section.title }}</h2>
      <p class="text-slate-700">{{ section.subtitle }}</p>
      <ul class="grid gap-2 text-slate-700 list-disc pl-5">
        <li v-for="item in section.bullets" :key="item">{{ item }}</li>
      </ul>
    </section>

    <section class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm text-center space-y-3">
      <h2 class="text-xl font-semibold text-slate-900">Оставить заявку</h2>
      <p class="text-slate-700">Подберем график и формат под вашу задачу.</p>
      <div class="flex justify-center gap-3">
        <a class="inline-flex items-center justify-center px-5 py-3 rounded-lg bg-brand-accent text-white font-semibold hover:bg-emerald-700 transition" href="/contacts">Оставить заявку</a>
        <a class="inline-flex items-center justify-center px-5 py-3 rounded-lg border border-slate-200 text-brand font-semibold hover:border-brand hover:text-brand transition" href="tel:+77000000000">Позвонить</a>
      </div>
    </section>
  </article>
  <p v-else>Формат не найден.</p>
</template>
