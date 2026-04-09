<script setup>
defineProps({
  title: { type: String, required: true },
  description: { type: String, required: true },
  completedAt: { type: String, required: true },
});

defineEmits(['proceed', 'download', 'cabinet']);
</script>

<template>
  <div class="relative overflow-hidden rounded-xl bg-surface-container-lowest shadow-[0_20px_50px_rgba(10,25,47,0.04)]">
    <div class="absolute left-0 top-0 h-1.5 w-full bg-[#4A90E2]"></div>

    <div class="p-8 md:p-12">
      <div class="mb-8 flex items-center gap-4">
        <div class="flex h-16 w-16 items-center justify-center rounded-full bg-secondary-container/20">
          <span class="material-symbols-outlined text-4xl text-secondary" style="font-variation-settings: 'FILL' 1;">verified</span>
        </div>
        <div>
          <span class="mb-1 block text-xs font-bold uppercase tracking-widest text-secondary">Examination Result</span>
          <h1 class="font-headline text-3xl font-extrabold leading-tight text-primary-container md:text-4xl">{{ title }}</h1>
        </div>
      </div>

      <p class="mb-10 max-w-2xl text-lg leading-relaxed text-on-surface-variant">{{ description }}</p>

      <div class="flex flex-wrap gap-4">
        <button class="bg-industrial-gradient flex items-center gap-3 rounded-lg px-8 py-4 font-bold text-white shadow-lg transition-all hover:shadow-xl active:scale-95" type="button" @click="$emit('proceed')">
          Proceed to Payment
          <span class="material-symbols-outlined">payments</span>
        </button>
        <button class="flex items-center gap-3 rounded-lg border border-outline-variant/30 bg-surface-container-low px-8 py-4 font-bold text-primary-container transition-all hover:bg-surface-container-high" type="button" @click="$emit('download')">
          Download detailed report
          <span class="material-symbols-outlined">download</span>
        </button>
      </div>
    </div>

    <div class="flex items-center justify-between border-t border-outline-variant/10 bg-surface-container px-8 py-4">
      <div class="flex items-center gap-2 text-sm font-medium text-on-surface-variant">
        <span class="material-symbols-outlined text-sm">schedule</span>
        {{ completedAt }}
      </div>
      <button class="flex items-center gap-1 text-sm font-bold text-secondary hover:underline" type="button" @click="$emit('cabinet')">
        Go to Personal Cabinet
        <span class="material-symbols-outlined text-sm">arrow_forward</span>
      </button>
    </div>
  </div>
</template>
