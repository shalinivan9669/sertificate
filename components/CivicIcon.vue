<script setup lang="ts">
withDefaults(defineProps<{ name?: string }>(), { name: 'arrow' });
const paths: Record<string, string> = {
  arrow: 'M5 12h14m-6-6 6 6-6 6', northeast: 'M6 18 18 6M6 6h12v12',
  search: 'M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14m5 12 6 6',
  book: 'M12 6v15M3 4h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5v15h-5a4 4 0 0 0-4 2 4 4 0 0 0-4-2H3Z',
  shield: 'm12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6Zm-4 9 3 3 5-6',
  people: 'M16 21v-3a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v3m20 0v-3a4 4 0 0 0-3-4M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8m8 0a4 4 0 0 1 0 8',
  user: 'M20 21v-2a7 7 0 0 0-14 0v2M13 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8',
  pin: 'M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0ZM12 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6',
  heart: 'M20.8 4.6a5.5 5.5 0 0 0-7.8 0l-1 1-1-1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z',
  leaf: 'M20 3C8 1 2 9 6 16s16 5 14-13ZM4 21 16 9M8 17v-5m0 5h5', bolt: 'm13 2-9 12h7l-1 8 10-13h-8Z',
  building: 'M3 21h18M5 21V5h10v16m0-12h4v12M8 8h4m-4 4h4m-4 4h4',
  screen: 'M3 4h18v13H3Zm5 17h8m-4-4v4', check: 'm5 12 4 4L19 6',
  document: 'M14 2H5v20h14V7Zm0 0v5h5M8 12h8m-8 4h6',
  sun: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8m0-6v2m0 16v2M2 12h2m16 0h2M5 5l1.4 1.4m11.2 11.2L19 19M5 19l1.4-1.4M17.6 6.4 19 5',
  menu: 'M4 6h16M4 12h16M4 18h16', close: 'm6 6 12 12M6 18 18 6',
  phone: 'm5 3 4 1 1 5-3 2a15 15 0 0 0 6 6l2-3 5 1 1 4c-1 5-9 2-14-3S0 4 5 3Z',
};
</script>
<template>
  <svg class="civic-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path :d="paths[name] || paths.arrow" /></svg>
</template>
