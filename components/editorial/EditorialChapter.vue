<script setup lang="ts">
defineProps<{
  number: string;
  label: string;
  title: string;
  id?: string;
  dark?: boolean;
}>();
</script>
<template>
  <header class="ed-chapter" :class="{ 'ed-chapter--dark': dark }">
    <p class="ed-kicker">
      <template v-if="number"><span>{{ number }}</span><span aria-hidden="true">/</span></template>{{ label }}
    </p>
    <div class="ed-chapter-line">
      <h2 :id="id">{{ title }}</h2>
      <slot />
    </div>
  </header>
</template>
