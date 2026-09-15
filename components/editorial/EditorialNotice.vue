<script setup lang="ts">
withDefaults(
  defineProps<{
    state?: "empty" | "error" | "saving" | "conflict" | "success" | "loading";
    title: string;
  }>(),
  { state: "empty" },
);
</script>
<template>
  <div
    class="ed-notice"
    :class="`ed-notice--${state}`"
    :role="state === 'error' || state === 'conflict' ? 'alert' : 'status'"
    :aria-busy="state === 'loading' || state === 'saving' || undefined"
  >
    <span class="ed-notice-symbol" aria-hidden="true">{{
      state === "success"
        ? "✓"
        : state === "error" || state === "conflict"
          ? "!"
          : "—"
    }}</span>
    <div>
      <strong>{{ title }}</strong
      ><slot />
    </div>
  </div>
</template>
