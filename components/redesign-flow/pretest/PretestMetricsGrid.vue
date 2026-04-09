<script setup>
defineProps({
  metrics: {
    type: Object,
    required: true,
  },
});
</script>

<template>
  <div class="relative grid grid-cols-1 gap-6 overflow-hidden rounded-xl bg-surface-container-low p-8 md:grid-cols-2">
    <div class="pointer-events-none absolute right-0 top-0 p-4 opacity-5">
      <span class="material-symbols-outlined text-9xl">verified_user</span>
    </div>

    <div class="flex flex-col space-y-2 border-l-4 border-secondary pl-6">
      <span class="font-label text-xs font-bold uppercase tracking-widest text-on-primary-container">Объем</span>
      <div class="flex items-baseline space-x-2">
        <span class="font-headline text-4xl font-extrabold">{{ metrics.questions }}</span>
        <span class="text-lg font-medium text-on-surface-variant">Вопросов</span>
      </div>
    </div>

    <div class="flex flex-col space-y-2 border-l-4 border-secondary pl-6">
      <span class="font-label text-xs font-bold uppercase tracking-widest text-on-primary-container">Тайминг</span>
      <div class="flex items-baseline space-x-2">
        <span class="font-headline text-4xl font-extrabold">{{ metrics.durationMinutes }}</span>
        <span class="text-lg font-medium text-on-surface-variant">Минут</span>
      </div>
    </div>

    <div class="flex flex-col space-y-2 border-l-4 border-secondary pl-6">
      <span class="font-label text-xs font-bold uppercase tracking-widest text-on-primary-container">Порог</span>
      <div class="flex items-baseline space-x-2">
        <span class="font-headline text-4xl font-extrabold text-secondary">{{ metrics.passScore }}%</span>
        <span class="text-lg font-medium text-on-surface-variant">Минимум</span>
      </div>
    </div>

    <div class="flex flex-col space-y-2 border-l-4 border-secondary pl-6">
      <span class="font-label text-xs font-bold uppercase tracking-widest text-on-primary-container">Попытки</span>
      <div class="flex items-baseline space-x-2">
        <span class="font-headline text-4xl font-extrabold">{{ metrics.attempts }}</span>
        <span class="text-lg font-medium text-on-surface-variant">Доступно</span>
      </div>
    </div>
  </div>
</template>
