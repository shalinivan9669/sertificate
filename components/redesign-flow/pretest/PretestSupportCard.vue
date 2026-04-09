<script setup>
defineProps({
  image: {
    type: String,
    required: true,
  },
  links: {
    type: Array,
    required: true,
  },
});
</script>

<template>
  <div class="sticky top-28 rounded-xl bg-surface-container-highest p-6">
    <div class="relative mb-6 aspect-video overflow-hidden rounded-lg bg-primary-container">
      <img :src="image" alt="Official Certification" class="absolute inset-0 h-full w-full object-cover opacity-60">
      <div class="relative z-10 px-4 text-center">
        <span class="material-symbols-outlined mb-2 text-5xl text-white">verified</span>
        <p class="text-xs font-bold uppercase tracking-widest text-white">Official Certification</p>
      </div>
    </div>

    <div class="mt-8 border-t border-outline-variant/30 pt-6">
      <p class="mb-4 text-xs font-medium uppercase tracking-tighter text-on-surface-variant">Support &amp; Help</p>
      <div class="space-y-3">
        <NuxtLink
          v-for="link in links"
          :key="link.label"
          :to="link.to"
          class="flex items-center space-x-3 text-sm text-primary transition-colors hover:text-secondary"
        >
          <span class="material-symbols-outlined text-lg">{{ link.icon }}</span>
          <span>{{ link.label }}</span>
        </NuxtLink>
      </div>
    </div>
  </div>
</template>
