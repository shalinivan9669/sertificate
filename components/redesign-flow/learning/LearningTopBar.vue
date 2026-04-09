<script setup>
defineProps({
  courseTitle: {
    type: String,
    required: true,
  },
  progressText: {
    type: String,
    required: true,
  },
  participantName: {
    type: String,
    required: true,
  },
  participantMeta: {
    type: String,
    required: true,
  },
});
</script>

<template>
  <header class="z-50 flex w-full items-center justify-between bg-[#0A192F] px-8 py-4 text-white shadow-[0_40px_40px_rgba(10,25,47,0.06)]">
    <div class="flex items-center gap-6">
      <span class="text-2xl font-extrabold tracking-tighter text-white">Sertificat.kz</span>
      <div class="h-6 w-px bg-white/20"></div>
      <div class="flex flex-col">
        <span class="text-xs font-semibold uppercase tracking-widest text-slate-400">Current Course</span>
        <h1 class="text-lg font-bold leading-tight">{{ courseTitle }}</h1>
      </div>
    </div>

    <div class="mx-12 flex max-w-md flex-1 flex-col gap-1">
      <div class="flex justify-between text-xs font-medium">
        <span class="text-[#4A90E2]">Course Progress</span>
        <span class="text-white">{{ progressText }}</span>
      </div>
      <div class="h-1.5 w-full overflow-hidden rounded-full bg-slate-700">
        <div class="h-full bg-[#4A90E2] transition-all duration-300" :style="{ width: progressText }"></div>
      </div>
    </div>

    <div class="flex items-center gap-4">
      <div class="text-right">
        <p class="text-sm font-bold">{{ participantName }}</p>
        <p class="text-[10px] uppercase tracking-tighter text-slate-400">{{ participantMeta }}</p>
      </div>
      <div class="flex h-10 w-10 items-center justify-center rounded-lg border border-[#4A90E2]/30 bg-[#4A90E2]/20">
        <span class="material-symbols-outlined text-[#4A90E2]">account_circle</span>
      </div>
    </div>
  </header>
</template>
