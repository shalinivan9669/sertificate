<script setup>
const route = useRoute();

await navigateTo(
  {
    path: '/program-selection',
    query: route.query,
  },
  { replace: true },
);
</script>
