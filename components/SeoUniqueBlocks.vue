<script setup>
import { computed } from 'vue';
import { useLocalePath } from '#imports';
const props = defineProps({
  content: {
    type: Object,
    required: true,
  },
});

const localePath = useLocalePath();
const relatedLinks = computed(() =>
  (props.content.modules.related.links || []).map((link) => ({
    ...link,
    to: localePath(link.to),
  })),
);
</script>

<template>
  <article class="space-y-10">
    <header class="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm space-y-4">
      <p class="text-sm font-semibold text-brand-accent uppercase tracking-wide">
        {{ content.hero.title }}
      </p>
      <h1 class="text-3xl md:text-4xl font-bold text-slate-900 leading-tight">
        {{ content.hero.h1 }}
      </h1>
      <p class="text-lg text-slate-700">
        {{ content.hero.description }}
      </p>
      <div class="flex flex-wrap gap-2 text-xs text-slate-600">
        <span
          v-for="tag in content.hero.tags"
          :key="tag"
          class="rounded-full border border-slate-200 bg-white px-3 py-1"
        >
          {{ tag }}
        </span>
      </div>
    </header>

    <section class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-3">
      <h2 class="text-xl font-semibold text-slate-900">{{ content.modules.whoNeeds.title }}</h2>
      <ul class="grid gap-2 text-slate-700 list-disc ml-4">
        <li v-for="item in content.modules.whoNeeds.bullets" :key="item">{{ item }}</li>
      </ul>
    </section>

    <section class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
      <h2 class="text-xl font-semibold text-slate-900">{{ content.modules.scenarios.title }}</h2>
      <div class="grid gap-4 md:grid-cols-2">
        <div
          v-for="item in content.modules.scenarios.items"
          :key="item.title"
          class="rounded-xl border border-slate-200 bg-slate-50 p-4"
        >
          <h3 class="font-semibold text-slate-900">{{ item.title }}</h3>
          <p class="mt-2 text-slate-700">{{ item.text }}</p>
        </div>
      </div>
    </section>

    <section class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
      <h2 class="text-xl font-semibold text-slate-900">{{ content.modules.process.title }}</h2>
      <ol class="grid gap-3 text-slate-700 list-decimal ml-5">
        <li v-for="step in content.modules.process.steps" :key="step.title">
          <strong class="text-slate-900">{{ step.title }}:</strong> {{ step.text }}
        </li>
      </ol>
      <div v-if="content.modules.process.notes?.length" class="space-y-2 text-slate-700">
        <p v-for="note in content.modules.process.notes" :key="note">{{ note }}</p>
      </div>
    </section>

    <section class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-3">
      <h2 class="text-xl font-semibold text-slate-900">{{ content.modules.faq.title }}</h2>
      <div class="divide-y divide-slate-200">
        <details v-for="item in content.modules.faq.faqs" :key="item.q" class="py-3">
          <summary class="cursor-pointer font-semibold text-slate-900">{{ item.q }}</summary>
          <p class="mt-2 text-slate-700">{{ item.a }}</p>
        </details>
      </div>
    </section>

    <section class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-3">
      <h2 class="text-xl font-semibold text-slate-900">{{ content.modules.related.title }}</h2>
      <div class="flex flex-wrap gap-2">
        <NuxtLink
          v-for="link in relatedLinks"
          :key="link.to"
          :to="link.to"
          class="rounded-full border border-slate-200 bg-white px-3 py-1 text-sm text-slate-700 hover:border-brand hover:text-brand transition"
        >
          {{ link.label }}
        </NuxtLink>
      </div>
    </section>
  </article>
</template>
