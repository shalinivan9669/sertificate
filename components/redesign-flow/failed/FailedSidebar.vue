<script setup>
defineProps({
  reviewTopics: { type: Array, required: true },
  banner: { type: Object, required: true },
});

defineEmits(['learning', 'support']);
</script>

<template>
  <div class="space-y-6">
    <div class="rounded-xl border-l-4 border-error bg-surface-container-lowest p-6 shadow-sm">
      <h2 class="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-on-surface-variant">
        <span class="material-symbols-outlined text-lg">list_alt</span>
        Темы для повторения
      </h2>
      <ul class="space-y-4">
        <li v-for="topic in reviewTopics" :key="topic" class="flex gap-3">
          <span class="mt-2 h-1.5 w-1.5 rounded-full bg-error"></span>
          <p class="text-sm font-medium leading-tight text-on-surface">{{ topic }}</p>
        </li>
      </ul>
    </div>

    <div class="space-y-3 rounded-xl bg-surface-container-low p-4">
      <button
        class="group flex w-full items-center justify-between rounded border border-outline-variant/20 bg-white p-3 text-left transition-colors hover:border-secondary"
        type="button"
        @click="$emit('learning')"
      >
        <div class="flex items-center gap-3">
          <span class="material-symbols-outlined text-slate-500 transition-colors group-hover:text-secondary">menu_book</span>
          <span class="text-sm font-semibold">Учебные материалы</span>
        </div>
        <span class="material-symbols-outlined text-slate-400">chevron_right</span>
      </button>

      <button
        class="group flex w-full items-center justify-between rounded border border-outline-variant/20 bg-white p-3 text-left transition-colors hover:border-secondary"
        type="button"
        @click="$emit('support')"
      >
        <div class="flex items-center gap-3">
          <span class="material-symbols-outlined text-slate-500 transition-colors group-hover:text-secondary">support_agent</span>
          <span class="text-sm font-semibold">Консультация менеджера</span>
        </div>
        <span class="material-symbols-outlined text-slate-400">chevron_right</span>
      </button>
    </div>

    <div class="relative aspect-video overflow-hidden rounded-xl bg-primary">
      <img :src="banner.image" :alt="banner.title" class="h-full w-full object-cover opacity-40 mix-blend-luminosity">
      <div class="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-[#0A192F] to-transparent p-6">
        <p class="font-headline text-lg font-bold leading-tight text-white">{{ banner.title }}</p>
        <p class="mt-1 text-xs text-slate-300">{{ banner.subtitle }}</p>
      </div>
    </div>
  </div>
</template>
