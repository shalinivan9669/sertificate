<script setup>
defineProps({
  rootBreadcrumb: {
    type: String,
    required: true,
  },
  moduleTitle: {
    type: String,
    required: true,
  },
  sectionTitle: {
    type: String,
    required: true,
  },
  section: {
    type: Object,
    required: true,
  },
});
</script>

<template>
  <main class="flex-1 overflow-y-auto bg-white">
    <div class="mx-auto max-w-4xl px-12 py-16">
      <nav class="mb-6 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-secondary">
        <span>{{ rootBreadcrumb }}</span>
        <span class="material-symbols-outlined text-xs">chevron_right</span>
        <span>{{ moduleTitle }}</span>
        <span class="material-symbols-outlined text-xs">chevron_right</span>
        <span class="text-on-surface-variant">{{ sectionTitle }}</span>
      </nav>

      <article class="prose prose-slate max-w-none">
        <h2 class="mb-8 text-4xl font-extrabold leading-tight tracking-tight text-[#0A192F]">
          {{ section.articleTitle }}
        </h2>
        <p class="mb-10 text-lg leading-relaxed text-on-surface-variant">
          {{ section.intro }}
        </p>

        <div class="my-12 grid grid-cols-12 gap-6">
          <div class="col-span-7 overflow-hidden rounded-2xl border border-outline-variant/20 bg-surface-container-low shadow-sm">
            <img :src="section.image.src" :alt="section.image.title" class="h-64 w-full object-cover grayscale transition-all duration-700 hover:grayscale-0">
            <div class="p-6">
              <h4 class="mb-2 text-sm font-bold uppercase tracking-wider text-[#0A192F]">{{ section.image.title }}</h4>
              <p class="text-xs italic text-on-surface-variant">{{ section.image.caption }}</p>
            </div>
          </div>

          <div class="col-span-5 flex flex-col gap-6">
            <div class="flex flex-1 flex-col justify-center rounded-2xl bg-[#0A192F] p-6 text-white">
              <span class="material-symbols-outlined mb-4 text-3xl text-[#4A90E2]" style="font-variation-settings: 'FILL' 1;">warning</span>
              <h4 class="mb-2 text-base font-bold">{{ section.alert.title }}</h4>
              <p class="text-xs leading-normal text-slate-400">{{ section.alert.text }}</p>
            </div>

            <div class="flex-1 rounded-2xl border-2 border-dashed border-secondary/30 bg-secondary-container/10 p-6">
              <h4 class="mb-3 text-xs font-bold uppercase text-secondary">{{ section.requirements.title }}</h4>
              <ul class="space-y-2">
                <li v-for="item in section.requirements.items" :key="item" class="flex items-start gap-2 text-xs font-medium text-on-secondary-container">
                  <span class="material-symbols-outlined mt-0.5 text-xs">verified</span>
                  {{ item }}
                </li>
              </ul>
            </div>
          </div>
        </div>

        <h3 class="mb-4 text-2xl font-bold text-[#0A192F]">{{ section.bodyHeading }}</h3>
        <p class="mb-6 leading-relaxed text-on-surface-variant">
          {{ section.bodyText }}
        </p>

        <div class="my-8 rounded-xl border-l-4 border-[#4A90E2] bg-surface-container-highest p-8">
          <div class="mb-4 flex items-center gap-3">
            <span class="material-symbols-outlined text-[#0A192F]">menu_book</span>
            <h4 class="font-bold text-[#0A192F]">{{ section.footnote.title }}</h4>
          </div>
          <p class="text-sm font-medium leading-relaxed text-on-surface-variant">
            {{ section.footnote.text }}
          </p>
        </div>

        <p class="mb-8 leading-relaxed text-on-surface-variant">
          {{ section.outro }}
        </p>
      </article>
    </div>
  </main>
</template>
