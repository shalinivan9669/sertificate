<script setup>
defineProps({
  title: { type: String, required: true },
  description: { type: String, required: true },
  steps: { type: Array, required: true },
});

defineEmits(['cabinet', 'later']);
</script>

<template>
  <div class="flex flex-col items-center rounded-xl bg-surface-container-lowest p-8 text-center shadow-[0_40px_40px_rgba(10,25,47,0.06)]">
    <div class="relative mb-8 h-32 w-32">
      <div class="absolute inset-0 rounded-full border-4 border-surface-container-high"></div>
      <div class="absolute inset-0 animate-spin rounded-full border-4 border-[#4A90E2] border-t-transparent"></div>
      <div class="absolute inset-0 flex items-center justify-center">
        <span class="material-symbols-outlined text-5xl text-[#4A90E2]">description</span>
      </div>
    </div>

    <h1 class="mb-4 font-headline text-3xl font-extrabold tracking-tight text-primary-container">{{ title }}</h1>
    <p class="mb-8 max-w-md text-on-surface-variant">{{ description }}</p>

    <div class="mb-12 w-full">
      <div class="relative flex items-center justify-between">
        <div class="absolute left-0 top-1/2 h-1 w-full -translate-y-1/2 bg-surface-container-high"></div>
        <div class="absolute left-0 top-1/2 h-1 w-1/2 -translate-y-1/2 bg-active"></div>

        <div v-for="step in steps" :key="step.id" class="relative z-10 flex flex-col items-center gap-2">
          <div
            class="flex items-center justify-center rounded-full border-4 border-surface-container-lowest shadow-lg"
            :class="{
              'h-10 w-10 bg-active text-white': step.state === 'done',
              'h-12 w-12 scale-110 bg-active text-white shadow-xl': step.state === 'active',
              'h-10 w-10 bg-surface-container-high text-outline-variant': step.state === 'pending',
            }"
          >
            <span class="material-symbols-outlined" :class="step.state === 'active' ? 'text-2xl' : 'text-xl'">{{ step.icon }}</span>
          </div>
          <span class="text-xs font-bold uppercase tracking-wider" :class="step.state === 'active' ? 'text-[#4A90E2]' : step.state === 'pending' ? 'text-outline-variant' : 'text-on-surface-variant'">
            {{ step.title }}
          </span>
        </div>
      </div>
    </div>

    <div class="flex w-full flex-col gap-4 sm:flex-row">
      <button class="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary-container px-6 py-4 font-bold text-white transition-all hover:bg-opacity-90" type="button" @click="$emit('cabinet')">
        <span class="material-symbols-outlined">dashboard</span>
        Go to Cabinet
      </button>
      <button class="flex-1 rounded-lg bg-surface-container-low px-6 py-4 font-bold text-on-surface-variant transition-all hover:bg-surface-container-high" type="button" @click="$emit('later')">
        Check status later
      </button>
    </div>
  </div>
</template>
