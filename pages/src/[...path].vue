<script setup>
const route = useRoute();
const path = useLocalePath();
await navigateTo({ path: path('/'), query: route.query, hash: route.hash }, { replace: true });
</script>
