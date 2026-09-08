<script setup>
const route = useRoute();
const path = useLocalePath();
await navigateTo(
  { path: path("/learn/" + route.params.id + "/pre-test"), query: route.query },
  { replace: true },
);
</script>
