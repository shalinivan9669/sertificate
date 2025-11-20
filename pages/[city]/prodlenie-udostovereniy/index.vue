<script setup>
import FormatLanding from '~/components/FormatLanding.vue';
import useCity from '~/composables/useCity';

const { city } = useCity();
</script>

<template>
  <FormatLanding type="prodlenie" :city="city" />
</template>
