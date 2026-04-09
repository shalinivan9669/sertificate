<script setup>
defineProps({
  title: { type: String, required: true },
  description: { type: String, required: true },
  courseName: { type: String, required: true },
  attemptLabel: { type: String, required: true },
  amount: { type: String, required: true },
  trustBadges: { type: Array, required: true },
});
</script>

<template>
  <div class="space-y-6">
    <div class="relative overflow-hidden rounded-xl bg-surface-container-low p-8">
      <div class="pointer-events-none absolute right-0 top-0 p-4 opacity-10">
        <span class="material-symbols-outlined text-6xl">history_edu</span>
      </div>

      <h1 class="mb-4 text-3xl font-extrabold leading-tight text-primary-container">{{ title }}</h1>
      <p class="mb-8 leading-relaxed text-on-surface-variant">{{ description }}</p>

      <div class="space-y-4 border-t border-outline-variant/30 pt-6">
        <div class="flex flex-col">
          <span class="text-xs font-semibold uppercase tracking-wider text-on-primary-container">Course Name</span>
          <span class="text-lg font-bold text-primary-container">{{ courseName }}</span>
        </div>

        <div class="flex items-end justify-between">
          <div class="flex flex-col">
            <span class="text-xs font-semibold uppercase tracking-wider text-on-primary-container">Attempt</span>
            <span class="text-lg font-bold text-primary-container">{{ attemptLabel }}</span>
          </div>

          <div class="flex flex-col items-end">
            <span class="text-xs font-semibold uppercase tracking-wider text-on-primary-container">Price</span>
            <span class="text-2xl font-black text-secondary">{{ amount }}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="flex items-center justify-between px-4 opacity-60">
      <div v-for="badge in trustBadges" :key="badge.label" class="flex flex-col items-center gap-1">
        <span class="material-symbols-outlined">{{ badge.icon }}</span>
        <span class="text-[10px] font-bold uppercase tracking-tighter">{{ badge.label }}</span>
      </div>
    </div>
  </div>
</template>
