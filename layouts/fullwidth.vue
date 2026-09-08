<script setup>
import { usePublicLocaleHead } from '~/composables/usePublicLocaleHead';
usePublicLocaleHead();
</script>

<template>
  <div class="min-h-screen bg-surface text-on-surface">
    <slot />
  </div>
</template>
