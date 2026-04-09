<script setup>
defineProps({
  score: { type: Number, required: true },
  correctCount: { type: Number, required: true },
  totalQuestions: { type: Number, required: true },
  integrityNote: { type: String, required: true },
  nextStep: { type: Object, required: true },
});
</script>

<template>
  <div class="flex flex-col gap-6">
    <div class="bg-industrial-gradient flex flex-col items-center justify-center rounded-xl p-8 text-center text-white shadow-xl">
      <div class="relative mb-4 flex h-32 w-32 items-center justify-center">
        <svg class="h-full w-full -rotate-90">
          <circle class="text-white/10" cx="64" cy="64" r="58" fill="transparent" stroke="currentColor" stroke-width="8"></circle>
          <circle class="text-secondary" cx="64" cy="64" r="58" fill="transparent" stroke="currentColor" stroke-width="8" stroke-dasharray="364.4" :stroke-dashoffset="364.4 - ((364.4 * score) / 100)"></circle>
        </svg>
        <div class="absolute inset-0 flex flex-col items-center justify-center">
          <span class="font-headline text-3xl font-black">{{ score }}%</span>
        </div>
      </div>
      <h3 class="mb-1 text-xl font-bold">Final Score</h3>
      <p class="text-sm font-medium text-on-primary-container">{{ correctCount }} out of {{ totalQuestions }} Correct Answers</p>
    </div>

    <div class="rounded-xl border-l-4 border-secondary bg-surface-container-low p-6">
      <div class="flex items-start gap-4">
        <span class="material-symbols-outlined text-secondary" style="font-variation-settings: 'FILL' 1;">workspace_premium</span>
        <div>
          <h4 class="mb-2 font-bold text-primary-container">Industrial Integrity</h4>
          <p class="text-xs leading-relaxed text-on-surface-variant">{{ integrityNote }}</p>
        </div>
      </div>
    </div>

    <div class="group relative h-48 overflow-hidden rounded-xl">
      <img :src="nextStep.image" :alt="nextStep.title" class="absolute inset-0 h-full w-full object-cover grayscale opacity-40 transition-all duration-500 group-hover:scale-105 group-hover:grayscale-0">
      <div class="absolute inset-0 flex flex-col justify-end bg-primary-container/60 p-6 backdrop-blur-[2px]">
        <p class="mb-1 text-xs font-bold uppercase tracking-tighter text-white/70">Next Step</p>
        <h4 class="font-headline text-lg font-extrabold text-white">{{ nextStep.title }}</h4>
      </div>
    </div>
  </div>
</template>
