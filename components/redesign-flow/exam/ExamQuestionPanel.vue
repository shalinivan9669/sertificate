<script setup>
defineProps({
  questionLabel: {
    type: String,
    required: true,
  },
  question: {
    type: Object,
    required: true,
  },
  selectedAnswer: {
    type: Number,
    default: null,
  },
  blueprintImage: {
    type: String,
    required: true,
  },
});

defineEmits(['select']);
</script>

<template>
  <div class="space-y-8">
    <div class="rounded-xl border-l-4 border-secondary bg-surface-container-lowest p-10 shadow-sm">
      <span class="mb-4 block text-sm font-bold uppercase tracking-tighter text-secondary">{{ questionLabel }}</span>
      <h2 class="text-3xl font-extrabold leading-tight text-primary-container">
        {{ question.question }}
      </h2>
    </div>

    <div class="grid grid-cols-1 gap-4">
      <button
        v-for="(option, index) in question.options"
        :key="option"
        class="group flex items-center rounded-lg border-2 p-6 text-left transition-all duration-200"
        :class="selectedAnswer === index ? 'border-secondary bg-white shadow-md' : 'border-transparent bg-surface-container-low hover:bg-surface-container-high'"
        type="button"
        @click="$emit('select', index)"
      >
        <div
          class="mr-6 flex h-10 w-10 items-center justify-center rounded font-bold transition-colors"
          :class="selectedAnswer === index ? 'bg-secondary text-white' : 'bg-white text-primary group-hover:bg-secondary group-hover:text-white'"
        >
          {{ String.fromCharCode(65 + index) }}
        </div>
        <span class="text-lg" :class="selectedAnswer === index ? 'font-bold text-primary' : 'font-medium text-on-surface'">{{ option }}</span>
      </button>
    </div>

    <div class="opacity-40 transition-all hover:grayscale-0">
      <img :src="blueprintImage" alt="Industrial blueprint" class="h-32 w-full rounded-xl object-cover grayscale">
    </div>
  </div>
</template>
