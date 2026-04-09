<script setup>
defineProps({
  methods: { type: Array, required: true },
  selectedMethodId: { type: String, required: true },
  infoText: { type: String, required: true },
  payLabel: { type: String, required: true },
});

defineEmits(['select', 'pay', 'cancel']);
</script>

<template>
  <div class="rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-8 shadow-[0_40px_40px_rgba(10,25,47,0.06)]">
    <h2 class="mb-6 text-xl font-bold text-primary-container">Выберите способ оплаты</h2>

    <div class="mb-8 space-y-3">
      <button
        v-for="method in methods"
        :key="method.id"
        class="group relative flex w-full items-center rounded-lg border p-4 text-left transition-all duration-200"
        :class="selectedMethodId === method.id ? 'border-secondary bg-surface-container-low' : 'border-outline-variant hover:bg-surface-container-low'"
        type="button"
        @click="$emit('select', method.id)"
      >
        <div class="flex h-5 w-5 items-center justify-center rounded-full border-2 border-outline-variant transition-colors" :class="selectedMethodId === method.id ? 'border-secondary' : ''">
          <div class="h-2.5 w-2.5 rounded-full bg-secondary transition-transform" :class="selectedMethodId === method.id ? 'scale-100' : 'scale-0'"></div>
        </div>

        <div class="ml-4 flex items-center gap-3">
          <span class="material-symbols-outlined text-on-surface-variant">{{ method.icon }}</span>
          <div>
            <div class="font-semibold text-on-surface">{{ method.title }}</div>
            <p class="text-xs text-on-surface-variant">{{ method.description }}</p>
          </div>
        </div>

        <div v-if="method.logos?.length" class="ml-auto flex gap-1">
          <div v-for="logo in method.logos" :key="logo.label" class="flex h-5 w-8 items-center justify-center overflow-hidden rounded-sm bg-surface-container">
            <img :src="logo.src" :alt="logo.label" :class="logo.className">
          </div>
        </div>

        <div v-else-if="method.badge" class="ml-auto rounded bg-[#F14635] px-2 py-0.5 text-[10px] font-bold text-white">
          {{ method.badge }}
        </div>
      </button>
    </div>

    <div class="mb-8 flex items-start gap-3 rounded-lg bg-surface-container-low p-4">
      <span class="material-symbols-outlined text-[#4A90E2]">info</span>
      <p class="text-xs text-on-surface-variant">{{ infoText }}</p>
    </div>

    <button class="group relative flex w-full items-center justify-center gap-3 overflow-hidden rounded-lg bg-[#0A192F] px-6 py-4 font-bold text-white shadow-lg transition-all hover:bg-[#162a4a]" type="button" @click="$emit('pay')">
      <span class="relative z-10">{{ payLabel }}</span>
      <span class="material-symbols-outlined relative z-10 transition-transform group-hover:translate-x-1">arrow_forward</span>
      <div class="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/5 to-transparent transition-transform duration-700 group-hover:translate-x-full"></div>
    </button>

    <button class="mt-4 w-full px-6 py-3 text-sm font-medium text-on-surface-variant transition-colors hover:text-primary" type="button" @click="$emit('cancel')">
      Отмена и выход
    </button>
  </div>
</template>
