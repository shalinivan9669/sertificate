<script setup lang="ts">
import type { Lesson } from '~/server/services/catalog';

withDefaults(defineProps<{
  lesson: Pick<Lesson, 'title' | 'body' | 'media'>;
  headingLevel?: 2 | 4;
  headingTabindex?: -1;
  mediaMode?: 'live' | 'text';
}>(), { headingLevel: 2, mediaMode: 'live' });
const { tr } = useLmsApi();
</script>

<template>
  <div class="min-w-0 space-y-6">
    <component :is="headingLevel === 4 ? 'h4' : 'h2'" :tabindex="headingTabindex" class="scroll-mt-4 font-headline text-2xl font-bold">
      {{ lesson.title }}
    </component>
    <p class="whitespace-pre-wrap leading-7 text-slate-700">{{ lesson.body }}</p>
    <div v-for="(media, index) in lesson.media" :key="index" class="space-y-3">
      <template v-if="mediaMode === 'live'">
        <img
          v-if="media.kind === 'image'" :src="media.url" :alt="media.alt"
          class="max-w-full rounded-xl" loading="lazy"
        />
        <video
          v-if="media.kind === 'video'" :src="media.url" controls preload="metadata"
          class="w-full rounded-xl" :aria-label="media.alt"
        />
      </template>
      <p v-else class="rounded-xl border border-dashed p-4 text-slate-700">
        <strong>{{ media.kind === 'image' ? tr('Изображение', 'Сурет') : media.kind === 'video' ? tr('Видео', 'Бейне') : tr('Вложение', 'Тіркеме') }}:</strong>
        {{ media.alt || tr('Описание ещё не задано', 'Сипаттамасы әлі берілмеген') }}
      </p>
      <details v-if="media.transcript" class="rounded-xl border p-4">
        <summary class="cursor-pointer font-semibold">{{ tr('Текстовая расшифровка видео', 'Бейненің мәтіндік нұсқасы') }}</summary>
        <p class="mt-3 whitespace-pre-wrap text-sm leading-6">{{ media.transcript }}</p>
      </details>
      <a
        v-if="mediaMode === 'live' && media.kind === 'attachment'" :href="media.url"
        target="_blank" rel="noopener noreferrer" class="lms-button secondary"
      >{{ media.alt || tr('Открыть вложение', 'Тіркемені ашу') }} ↗</a>
    </div>
  </div>
</template>
