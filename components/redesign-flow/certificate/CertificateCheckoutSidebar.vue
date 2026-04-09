<script setup>
defineProps({
  total: { type: String, required: true },
  methods: { type: Array, required: true },
  selectedMethodId: { type: String, required: true },
  consentText: { type: String, required: true },
  securityLogos: { type: Array, required: true },
});

defineEmits(['select', 'confirm']);
</script>

<template>
  <div class="sticky top-28 space-y-6">
    <div class="industrial-gradient relative overflow-hidden rounded-xl p-8 text-white shadow-xl">
      <div class="pointer-events-none absolute right-0 top-0 p-4 opacity-10">
        <span class="material-symbols-outlined text-8xl">receipt_long</span>
      </div>
      <div class="relative z-10">
        <p class="mb-1 text-sm font-medium opacity-80">Итого к оплате</p>
        <h2 class="mb-4 text-5xl font-black tracking-tighter">{{ total }}</h2>
        <div class="flex w-fit items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-widest">
          <span class="material-symbols-outlined text-sm" style="font-variation-settings: 'FILL' 1;">verified_user</span>
          Безопасный платеж
        </div>
      </div>
    </div>

    <div class="space-y-6 rounded-xl bg-white p-8 shadow-sm">
      <h3 class="text-lg font-bold text-primary">Метод оплаты</h3>
      <div class="space-y-3">
        <button
          v-for="method in methods"
          :key="method.id"
          class="group relative flex w-full items-center rounded-xl border-2 p-4 text-left transition-all"
          :class="selectedMethodId === method.id ? 'border-secondary bg-secondary/5' : 'border-surface-container-high hover:border-secondary'"
          type="button"
          @click="$emit('select', method.id)"
        >
          <span class="material-symbols-outlined mr-4 text-secondary">{{ method.icon }}</span>
          <div class="flex-grow">
            <p class="text-sm font-bold">{{ method.title }}</p>
            <p class="text-xs text-outline">{{ method.description }}</p>
          </div>
          <span class="material-symbols-outlined text-secondary transition-opacity" :class="selectedMethodId === method.id ? 'opacity-100' : 'opacity-0'" style="font-variation-settings: 'FILL' 1;">check_circle</span>
        </button>
      </div>

      <button class="flex w-full items-center justify-center gap-3 rounded-lg bg-[#0A192F] py-5 text-lg font-extrabold uppercase tracking-widest text-white shadow-lg transition-all hover:-translate-y-1 hover:shadow-secondary/20 active:scale-95" type="button" @click="$emit('confirm')">
        Confirm Payment
        <span class="material-symbols-outlined">arrow_forward</span>
      </button>

      <p class="px-6 text-center text-[10px] text-outline">{{ consentText }}</p>
    </div>

    <div class="flex items-center justify-center gap-6 opacity-40 grayscale contrast-125">
      <img v-for="logo in securityLogos" :key="logo.alt" :src="logo.src" :alt="logo.alt" :class="logo.className">
    </div>
  </div>
</template>
