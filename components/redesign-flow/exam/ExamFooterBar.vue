<script setup>
defineProps({
  canGoPrevious: {
    type: Boolean,
    default: true,
  },
  canGoNext: {
    type: Boolean,
    default: true,
  },
  protocolId: {
    type: String,
    required: true,
  },
});

defineEmits(['previous', 'next', 'submit']);
</script>

<template>
  <footer class="sticky bottom-0 mt-auto border-t border-outline-variant/15 bg-white p-8">
    <div class="mx-auto flex w-full max-w-screen-2xl flex-col items-center justify-between gap-6 md:flex-row">
      <div class="flex w-full gap-4 md:w-auto">
        <button
          class="flex flex-1 items-center justify-center gap-2 rounded border-2 border-primary/10 px-8 py-4 text-sm font-bold uppercase tracking-widest text-primary transition-colors hover:bg-surface-container-low disabled:cursor-not-allowed disabled:opacity-50 md:flex-none"
          :disabled="!canGoPrevious"
          type="button"
          @click="$emit('previous')"
        >
          <span class="material-symbols-outlined text-[20px]">arrow_back</span>
          Previous
        </button>
        <button
          class="flex flex-1 items-center justify-center gap-2 rounded bg-primary px-10 py-4 text-sm font-bold uppercase tracking-widest text-white shadow-lg transition-all hover:bg-primary-container disabled:cursor-not-allowed disabled:opacity-50 md:flex-none"
          :disabled="!canGoNext"
          type="button"
          @click="$emit('next')"
        >
          Next
          <span class="material-symbols-outlined text-[20px]">arrow_forward</span>
        </button>
      </div>

      <div class="flex w-full items-center gap-8 md:w-auto">
        <div class="hidden flex-col items-end lg:flex">
          <span class="text-[10px] font-bold uppercase tracking-widest text-outline">Protocol ID</span>
          <span class="font-mono text-xs text-on-surface-variant">{{ protocolId }}</span>
        </div>
        <button
          class="flex w-full items-center justify-center gap-2 rounded bg-error px-8 py-4 text-sm font-bold uppercase tracking-widest text-white shadow-[0_10px_20px_rgba(186,26,26,0.15)] transition-all hover:opacity-90 md:w-auto"
          type="button"
          @click="$emit('submit')"
        >
          <span class="material-symbols-outlined text-[20px]">send</span>
          Submit Exam
        </button>
      </div>
    </div>
  </footer>
</template>
