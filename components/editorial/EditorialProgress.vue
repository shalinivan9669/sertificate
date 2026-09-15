<script setup lang="ts">
const props = defineProps<{ value: number; max?: number; label: string }>();
const percent = computed(() =>
  Math.max(0, Math.min(100, (props.value / (props.max || 100)) * 100)),
);
</script>
<template>
  <div class="ed-progress">
    <div>
      <span>{{ label }}</span
      ><strong>{{ Math.round(percent) }}%</strong>
    </div>
    <progress :value="value" :max="max || 100" :aria-label="label" />
  </div>
</template>
