<script setup>
defineProps({
  questions: {
    type: Array,
    required: true,
  },
  currentIndex: {
    type: Number,
    required: true,
  },
  answers: {
    type: Object,
    required: true,
  },
  technicalWarning: {
    type: String,
    required: true,
  },
});

defineEmits(['jump']);
</script>

<template>
  <aside class="space-y-6">
    <div class="rounded-xl border border-outline-variant/15 bg-surface-container-low p-6">
      <h3 class="mb-6 flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-on-surface-variant">
        <span class="material-symbols-outlined text-sm">grid_view</span>
        Exam Navigation
      </h3>

      <div class="grid grid-cols-5 gap-3">
        <button
          v-for="(question, index) in questions"
          :key="question.id"
          class="flex aspect-square w-full items-center justify-center rounded-md text-sm font-bold transition-all"
          :class="{
            'bg-primary text-white ring-4 ring-secondary/30': index === currentIndex,
            'bg-secondary-container text-on-secondary-container shadow-sm': index !== currentIndex && answers[question.id] !== undefined,
            'border border-outline-variant bg-white font-medium text-outline': index !== currentIndex && answers[question.id] === undefined,
          }"
          type="button"
          @click="$emit('jump', index)"
        >
          {{ index + 1 }}
        </button>
      </div>

      <div class="mt-10 space-y-4 border-t border-outline-variant/20 pt-6">
        <div class="flex items-center gap-3">
          <div class="h-3 w-3 rounded-sm bg-secondary-container"></div>
          <span class="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">Answered</span>
        </div>
        <div class="flex items-center gap-3">
          <div class="h-3 w-3 rounded-sm bg-primary"></div>
          <span class="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">Current</span>
        </div>
        <div class="flex items-center gap-3">
          <div class="h-3 w-3 rounded-sm border border-outline-variant bg-white"></div>
          <span class="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">Remaining</span>
        </div>
      </div>
    </div>

    <div class="flex items-start gap-4 rounded-xl bg-error-container p-6">
      <span class="material-symbols-outlined text-error">report</span>
      <div>
        <h4 class="text-sm font-bold uppercase text-on-error-container">Technical Warning</h4>
        <p class="mt-1 text-xs leading-relaxed text-on-error-container">
          {{ technicalWarning }}
        </p>
      </div>
    </div>
  </aside>
</template>
