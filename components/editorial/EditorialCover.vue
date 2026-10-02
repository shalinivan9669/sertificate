<script setup lang="ts">
defineProps<{
  eyebrow: string;
  lines: string[];
  description: string;
  imageAlt: string;
  caption: string;
}>();
const failed = ref(false);
</script>
<template>
  <section
    class="ed-cover"
    :class="{ 'ed-cover--fallback': failed }"
    aria-labelledby="ed-cover-title"
  >
    <ResponsiveImage
        v-if="!failed"
        picture-class="ed-cover-art"
        src="/images/editorial/workshop-mentor-v2.png"
        width="1672"
        height="941"
        sizes="(max-width: 639px) 490px, 100vw"
        loading="eager"
        fetchpriority="high"
        :alt="imageAlt"
        @error="failed = true"
    />
    <div class="ed-cover-shade" aria-hidden="true" />
    <div class="ed-cover-inner">
      <div class="ed-cover-copy">
        <p class="ed-kicker">{{ eyebrow }}</p>
        <h1 id="ed-cover-title" :aria-label="lines.join(' ')">
          <span v-for="line in lines" :key="line">{{ line }}{{ ' ' }}</span>
        </h1>
        <div class="ed-cover-rule" />
        <p class="ed-cover-description">{{ description }}</p>
        <slot name="actions" />
      </div>
      <slot name="contents" />
      <p class="ed-cover-caption">
        <span aria-hidden="true">01 /</span>{{ caption }}
      </p>
    </div>
  </section>
</template>
