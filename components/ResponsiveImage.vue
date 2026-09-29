<script setup lang="ts">
import manifest from '~/config/responsive-images.json';

defineOptions({ inheritAttrs: false });
const props = withDefaults(defineProps<{
  src: string;
  alt: string;
  width?: number | string;
  height?: number | string;
  sizes: string;
  loading?: 'eager' | 'lazy';
  fetchpriority?: 'high' | 'low' | 'auto';
  pictureClass?: string;
}>(), { loading: 'lazy', fetchpriority: 'auto', width: undefined, height: undefined, pictureClass: undefined });
const emit = defineEmits<{ error: [event?: Event] }>();
type Variant = { src: string; width: number };
type ImageSet = { src: string; width: number; height: number; avif: Variant[]; webp: Variant[] };
const images = manifest as Record<string, ImageSet>;
const imageSet = computed(() => images[props.src]);
const srcset = (variants?: Variant[]) => variants?.map(image => `${image.src} ${image.width}w`).join(', ');
const element = ref<HTMLImageElement>();
onMounted(() => {
  if (element.value?.complete && element.value.naturalWidth === 0) emit('error');
});
</script>

<template>
  <picture :class="pictureClass">
    <source v-if="imageSet" type="image/avif" :srcset="srcset(imageSet.avif)" :sizes="sizes" />
    <source v-if="imageSet" type="image/webp" :srcset="srcset(imageSet.webp)" :sizes="sizes" />
    <img
      ref="element"
      v-bind="$attrs"
      :src="imageSet?.src || src"
      :alt="alt"
      :width="imageSet?.width || width"
      :height="imageSet?.height || height"
      :sizes="sizes"
      :loading="loading"
      :fetchpriority="fetchpriority"
      decoding="async"
      @error="emit('error', $event)"
    />
  </picture>
</template>
