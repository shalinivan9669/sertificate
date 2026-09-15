<script setup>
defineProps({
  title: { type: String, required: true },
  lead: { type: String, default: '' },
  backTo: { type: [String, Object], default: '' },
  backLabel: { type: String, default: '' },
});
const { locale } = useI18n();
const localePath = useLocalePath();
</script>

<template>
  <header class="ed-page-header">
    <nav class="ed-page-back" :aria-label="locale === 'kk' ? 'Бөлімдер арасында өту' : 'Навигация по разделам'">
      <NuxtLink :to="backTo || localePath('/')">{{ backLabel || (locale === 'kk' ? 'Басты бет' : 'Главная') }}</NuxtLink>
      <slot name="context" />
    </nav>
    <div class="ed-page-heading">
      <h1>{{ title }}</h1>
      <p v-if="lead" class="ed-page-lead">{{ lead }}</p>
    </div>
    <div v-if="$slots.default" class="ed-page-header-bottom"><slot /></div>
  </header>
</template>
