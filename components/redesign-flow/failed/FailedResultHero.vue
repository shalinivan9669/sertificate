<script setup>
defineProps({
  title: { type: String, required: true },
  subtitle: { type: String, required: true },
  score: { type: Number, required: true },
  correctCount: { type: Number, required: true },
  totalQuestions: { type: Number, required: true },
  passScore: { type: Number, required: true },
  message: { type: String, required: true },
});

defineEmits(['payment']);
</script>

<template>
  <div class="metal-sheen relative flex min-h-[440px] flex-col justify-between overflow-hidden rounded-xl p-8 text-white shadow-2xl">
    <div class="relative z-10">
      <div class="mb-8 flex items-center gap-4">
        <div class="flex h-16 w-16 items-center justify-center rounded-full border border-error/30 bg-error/20">
          <span class="material-symbols-outlined text-4xl text-error">close</span>
        </div>
        <div>
          <h1 class="font-headline text-3xl font-extrabold tracking-tight">{{ title }}</h1>
          <p class="text-sm text-slate-400">{{ subtitle }}</p>
        </div>
      </div>

      <div class="mb-8 grid grid-cols-2 gap-8">
        <div class="space-y-1">
          <p class="text-[10px] font-bold uppercase tracking-widest text-slate-500">Ваш результат</p>
          <p class="font-headline text-5xl font-extrabold text-error">{{ score }}%</p>
          <p class="text-sm text-slate-400">{{ correctCount }} из {{ totalQuestions }} баллов</p>
        </div>
        <div class="space-y-1">
          <p class="text-[10px] font-bold uppercase tracking-widest text-slate-500">Проходной балл</p>
          <p class="font-headline text-5xl font-extrabold text-white">{{ passScore }}%</p>
          <p class="text-sm text-slate-400">Минимум {{ Math.ceil((totalQuestions * passScore) / 100) }} баллов</p>
        </div>
      </div>

      <div class="flex items-start gap-3 rounded-lg border border-white/5 bg-black/20 p-4">
        <span class="material-symbols-outlined text-secondary">info</span>
        <p class="text-sm leading-relaxed text-slate-300">{{ message }}</p>
      </div>
    </div>

    <div class="relative z-10 mt-8">
      <button
        class="flex w-full items-center justify-center gap-2 rounded-lg bg-secondary py-4 font-bold text-white transition-all hover:bg-secondary-container active:scale-95"
        type="button"
        @click="$emit('payment')"
      >
        <span class="material-symbols-outlined">credit_card</span>
        Оплатить дополнительную попытку
      </button>
    </div>

    <div class="pointer-events-none absolute -bottom-10 -right-10 opacity-10">
      <span class="material-symbols-outlined text-[200px]">engineering</span>
    </div>
  </div>
</template>
