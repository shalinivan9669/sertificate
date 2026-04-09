<script setup>
defineProps({
  currentQuestion: {
    type: Number,
    required: true,
  },
  totalQuestions: {
    type: Number,
    required: true,
  },
  timeRemaining: {
    type: String,
    required: true,
  },
  progressWidth: {
    type: String,
    required: true,
  },
  candidateName: {
    type: String,
    required: true,
  },
});
</script>

<template>
  <header class="sticky top-0 z-50 flex flex-col gap-4 bg-primary-container px-8 py-6 text-white shadow-[0_40px_40px_rgba(10,25,47,0.06)]">
    <div class="mx-auto flex w-full max-w-screen-2xl items-center justify-between">
      <div class="flex items-center gap-6">
        <div class="flex flex-col">
          <span class="text-xs font-bold uppercase tracking-widest text-on-primary-container">Question</span>
          <span class="text-2xl font-extrabold tracking-tight">{{ currentQuestion }} of {{ totalQuestions }}</span>
        </div>
        <div class="hidden h-10 w-px bg-white/10 md:block"></div>
        <div class="flex flex-col">
          <span class="text-xs font-bold uppercase tracking-widest text-on-primary-container">Time Remaining</span>
          <span class="font-mono text-2xl font-extrabold tracking-tight text-secondary-container">{{ timeRemaining }}</span>
        </div>
      </div>

      <div class="flex items-center gap-4">
        <div class="hidden text-right sm:block">
          <span class="block text-xs font-bold uppercase tracking-widest text-on-primary-container">Candidate</span>
          <span class="text-sm font-semibold">{{ candidateName }}</span>
        </div>
        <div class="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
          <span class="material-symbols-outlined text-white">account_circle</span>
        </div>
      </div>
    </div>

    <div class="mx-auto w-full max-w-screen-2xl">
      <div class="h-1 w-full overflow-hidden rounded-full bg-white/10">
        <div class="h-full bg-secondary-container transition-all duration-500 ease-out" :style="{ width: progressWidth }"></div>
      </div>
    </div>
  </header>
</template>
