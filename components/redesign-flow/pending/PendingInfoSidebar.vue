<script setup>
defineProps({
  orderNumber: { type: String, required: true },
  courseName: { type: String, required: true },
  estimate: { type: String, required: true },
  nextItems: { type: Array, required: true },
});

defineEmits(['support']);
</script>

<template>
  <div class="space-y-6">
    <div class="rounded-xl border-l-4 border-[#4A90E2] bg-surface-container-low p-6">
      <h3 class="mb-4 font-headline text-lg font-bold">
        <span class="material-symbols-outlined mr-2 text-[#4A90E2]">info</span>
        Details
      </h3>

      <div class="space-y-4">
        <div class="flex items-start justify-between">
          <span class="text-sm text-on-surface-variant">Order #</span>
          <span class="font-mono font-bold">{{ orderNumber }}</span>
        </div>
        <div class="flex items-start justify-between">
          <span class="text-sm text-on-surface-variant">Course Name</span>
          <span class="max-w-[180px] text-right text-sm font-semibold">{{ courseName }}</span>
        </div>
        <div class="flex items-start justify-between border-t border-outline-variant/20 pt-2">
          <span class="text-sm text-on-surface-variant">Estimated Time</span>
          <span class="font-bold text-[#4A90E2]">{{ estimate }}</span>
        </div>
      </div>
    </div>

    <div class="relative overflow-hidden rounded-xl bg-[#0A192F] p-6 text-white">
      <div class="pointer-events-none absolute right-0 top-0 p-4 opacity-10">
        <span class="material-symbols-outlined text-6xl">mail</span>
      </div>
      <h3 class="mb-4 font-headline text-lg font-bold">What's next?</h3>
      <ul class="space-y-4 text-sm text-slate-300">
        <li v-for="item in nextItems" :key="item" class="flex gap-3">
          <span class="material-symbols-outlined text-[#4A90E2]">notifications</span>
          {{ item }}
        </li>
      </ul>
    </div>

    <div class="group flex items-center justify-between rounded-xl bg-surface-container-highest p-6 transition-colors hover:bg-surface-container-high">
      <div class="flex items-center gap-4">
        <div class="flex h-10 w-10 items-center justify-center rounded-full bg-white text-primary-container">
          <span class="material-symbols-outlined">support_agent</span>
        </div>
        <div>
          <p class="text-sm font-bold">Need Help?</p>
          <p class="text-xs text-on-surface-variant">Our support is available 24/7</p>
        </div>
      </div>
      <button class="flex items-center gap-1 text-sm font-bold text-[#4A90E2]" type="button" @click="$emit('support')">
        Contact Support
        <span class="material-symbols-outlined text-sm">arrow_forward</span>
      </button>
    </div>
  </div>
</template>
