<script setup>
defineProps({
  modules: {
    type: Array,
    required: true,
  },
});
</script>

<template>
  <div class="space-y-4">
    <h3 class="mb-4 text-sm font-bold uppercase tracking-wider text-on-surface">Пройденные модули:</h3>

    <div
      v-for="module in modules"
      :key="module.id"
      class="flex items-center gap-4 rounded-md bg-surface-container-low p-4 transition-colors hover:bg-surface-container"
    >
      <span class="material-symbols-outlined text-secondary" style="font-variation-settings: 'FILL' 1;">check_circle</span>
      <div>
        <p class="text-sm font-semibold">{{ module.title }}</p>
        <p class="text-xs text-on-surface-variant">Продолжительность: {{ module.duration }}</p>
      </div>
    </div>
  </div>
</template>
