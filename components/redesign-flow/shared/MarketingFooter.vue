<script setup>
const props = defineProps({
  description: {
    type: String,
    default: '',
  },
  showLanguages: {
    type: Boolean,
    default: false,
  },
});

const { paths } = useRedesignRoutes();
</script>

<template>
  <footer class="mt-auto border-t border-white/5 bg-[#0A192F] text-white">
    <div class="mx-auto grid max-w-screen-2xl grid-cols-1 gap-8 px-8 py-12 md:grid-cols-2">
      <div class="space-y-4">
        <div class="text-xl font-black text-white">Sertificat.kz</div>
        <p class="max-w-md text-xs leading-relaxed text-slate-400">
          {{ description }}
        </p>
        <p class="text-[10px] font-bold uppercase tracking-widest text-slate-500">
          © 2026 Industrial Safety Certification Center Kazakhstan. All rights reserved.
        </p>
      </div>

      <div class="flex flex-col gap-4 md:items-end">
        <div class="flex flex-wrap gap-x-8 gap-y-4 md:justify-end">
          <NuxtLink class="text-xs text-slate-400 transition-all hover:text-[#4A90E2] hover:underline" :to="paths.privacy">
            Privacy Policy
          </NuxtLink>
          <NuxtLink class="text-xs text-slate-400 transition-all hover:text-[#4A90E2] hover:underline" :to="paths.terms">
            Terms of Service
          </NuxtLink>
          <NuxtLink class="text-xs text-slate-400 transition-all hover:text-[#4A90E2] hover:underline" :to="paths.licenses">
            Accreditation Details
          </NuxtLink>
          <NuxtLink class="text-xs text-slate-400 transition-all hover:text-[#4A90E2] hover:underline" :to="paths.contacts">
            Contact Support
          </NuxtLink>
        </div>

        <div v-if="showLanguages" class="flex items-center gap-4 text-slate-400">
          <span class="material-symbols-outlined text-sm">language</span>
          <span class="text-[10px] font-bold uppercase tracking-widest">KAZ | RUS | ENG</span>
        </div>
      </div>
    </div>
  </footer>
</template>
