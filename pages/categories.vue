<script setup>
const route = useRoute();
const path = useLocalePath();
await navigateTo(
  { path: path("/program-selection"), query: route.query },
  { replace: true, redirectCode: 301 },
);
</script>
