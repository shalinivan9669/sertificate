<script setup>
defineProps({
  canGoBack: {
    type: Boolean,
    default: true,
  },
  nextLabel: {
    type: String,
    default: 'Next Section',
  },
});

defineEmits(['back', 'save', 'next']);
</script>

<template>
  <footer class="z-50 border-t border-outline-variant/30 bg-surface-container-low px-12 py-6">
    <div class="mx-auto flex max-w-4xl items-center justify-between">
      <button
        class="flex items-center gap-2 px-6 py-2.5 text-sm font-bold text-slate-600 transition-colors hover:text-[#0A192F] disabled:cursor-not-allowed disabled:opacity-50"
        :disabled="!canGoBack"
        type="button"
        @click="$emit('back')"
      >
        <span class="material-symbols-outlined text-sm">arrow_back</span>
        Back
      </button>

      <div class="flex items-center gap-4">
        <button
          class="rounded border border-outline-variant bg-white px-6 py-2.5 text-sm font-bold text-[#0A192F] transition-all hover:bg-surface-container-high"
          type="button"
          @click="$emit('save')"
        >
          Save &amp; Exit
        </button>
        <button
          class="flex items-center gap-2 rounded bg-[#0A192F] px-8 py-2.5 text-sm font-bold text-white shadow-lg transition-all hover:bg-[#162a4a] active:scale-95"
          type="button"
          @click="$emit('next')"
        >
          {{ nextLabel }}
          <span class="material-symbols-outlined text-sm">arrow_forward</span>
        </button>
      </div>
    </div>
  </footer>
</template>
