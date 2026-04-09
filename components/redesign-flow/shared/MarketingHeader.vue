<script setup>
const props = defineProps({
  active: {
    type: String,
    default: '',
  },
});

const { paths } = useRedesignRoutes();

const links = computed(() => [
  { key: 'catalog', label: 'Catalog', to: paths.value.courses },
  { key: 'accreditation', label: 'Accreditation', to: paths.value.licenses },
  { key: 'certificate', label: 'Check Certificate', to: paths.value.pending },
  { key: 'about', label: 'About', to: paths.value.contacts },
]);
</script>

<template>
  <header class="sticky top-0 z-50 bg-[#0A192F] shadow-[0_40px_40px_rgba(10,25,47,0.06)]">
    <nav class="mx-auto flex max-w-screen-2xl items-center justify-between px-8 py-4">
      <div class="text-2xl font-extrabold tracking-tighter text-white">Sertificat.kz</div>

      <div class="hidden items-center gap-8 md:flex">
        <NuxtLink
          v-for="link in links"
          :key="link.key"
          :to="link.to"
          class="border-b-2 pb-1 font-medium transition-colors duration-200"
          :class="active === link.key ? 'border-[#4A90E2] text-white' : 'border-transparent text-slate-400 hover:text-[#4A90E2]'"
        >
          {{ link.label }}
        </NuxtLink>
      </div>

      <div class="flex items-center gap-4">
        <button class="text-slate-400 transition-colors duration-200 hover:text-white" type="button">
          <span class="material-symbols-outlined">account_circle</span>
        </button>
        <button class="rounded-lg bg-[#4A90E2] px-6 py-2 text-sm font-semibold text-white transition-all hover:bg-opacity-90" type="button">
          Login
        </button>
      </div>
    </nav>
  </header>
</template>
