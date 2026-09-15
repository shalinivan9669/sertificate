<script setup lang="ts">
const { tr } = useLmsApi();
const details = ref<HTMLDetailsElement>();
const close = () => {
  if (details.value) details.value.open = false;
};
</script>
<template>
  <details ref="details" class="ed-mobile-contents">
    <summary>{{ tr("Содержание страницы", "Бет мазмұны") }}</summary>
    <nav :aria-label="tr('Разделы страницы', 'Бет бөлімдері')">
      <a href="#directions" @click="close"
        >01. {{ tr("Направления", "Бағыттар") }}</a
      ><a href="#learning-path" @click="close"
        >02. {{ tr("Путь обучения", "Оқу жолы") }}</a
      ><a href="#formats" @click="close">03. {{ tr("Форматы", "Форматтар") }}</a
      ><a href="#cities" @click="close">04. {{ tr("Города", "Қалалар") }}</a>
    </nav>
  </details>
</template>
