<script setup lang="ts">
const props = defineProps<{
  open: boolean;
  title: string;
  closeLabel: string;
}>();
const emit = defineEmits<{ close: [] }>();
const dialog = ref<HTMLDialogElement>();
const titleId = useId();
watch(
  () => props.open,
  async (value) => {
    await nextTick();
    if (value && !dialog.value?.open) dialog.value?.showModal();
    else if (!value && dialog.value?.open) dialog.value?.close();
  },
);
onMounted(() => {
  if (props.open) dialog.value?.showModal();
});
</script>
<template>
  <dialog
    ref="dialog"
    class="ed-dialog"
    :aria-labelledby="titleId"
    @cancel.prevent="emit('close')"
    @close="emit('close')"
  >
    <div class="ed-dialog-top">
      <h2 :id="titleId">{{ title }}</h2>
      <button type="button" :aria-label="closeLabel" @click="emit('close')">
        <CivicIcon name="close" />
      </button>
    </div>
    <slot />
  </dialog>
</template>
