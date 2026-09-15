<script setup lang="ts">
import type { RouteLocationRaw } from "vue-router";
withDefaults(
  defineProps<{
    to?: RouteLocationRaw;
    variant?: "primary" | "secondary" | "text";
    loading?: boolean;
    disabled?: boolean;
    type?: "button" | "submit";
  }>(),
  { variant: "primary", type: "button" },
);
</script>
<template>
  <NuxtLink
    v-if="to && !disabled && !loading"
    :to="to"
    class="ed-button"
    :class="`ed-button--${variant}`"
    ><slot /><CivicIcon name="arrow"
  /></NuxtLink>
  <button
    v-else
    :type="type"
    :disabled="disabled || loading"
    :aria-busy="loading || undefined"
    class="ed-button"
    :class="`ed-button--${variant}`"
  >
    <span
      v-if="loading"
      class="ed-spinner"
      aria-hidden="true"
    /><slot /><CivicIcon v-if="!loading" name="arrow" />
  </button>
</template>
