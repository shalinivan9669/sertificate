<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router';

withDefaults(defineProps<{
  title: string;
  description: string;
  purpose?: string;
  to: RouteLocationRaw;
  requestTo: RouteLocationRaw;
  status?: string;
  languages?: string;
  heading?: 'h2' | 'h3';
}>(), { purpose: '', status: '', languages: '', heading: 'h3' });

const { locale } = useI18n();
const tr = (ru: string, kk: string) => locale.value === 'kk' ? kk : ru;
</script>

<template>
  <article class="ed-program-card">
    <div class="ed-program-card-body">
      <p v-if="status" class="ed-program-card-status">{{ status }}</p>
      <component :is="heading" class="ed-program-card-title">
        <NuxtLink :to="to">{{ title }}</NuxtLink>
      </component>
      <p v-if="description" class="ed-program-card-description">{{ description }}</p>
      <p v-if="purpose" class="ed-program-card-purpose">{{ purpose }}</p>
      <p v-if="languages" class="ed-program-card-languages">
        {{ tr('Языки обучения:', 'Оқу тілдері:') }} {{ languages }}
      </p>
    </div>
    <div class="ed-program-card-actions">
      <NuxtLink
        class="ed-program-card-details"
        :to="to"
        :aria-label="tr('Содержание и условия: ', 'Мазмұны мен шарттары: ') + title"
      >
        <span>{{ tr('Содержание и условия', 'Мазмұны мен шарттары') }}</span>
        <CivicIcon name="arrow" aria-hidden="true" />
      </NuxtLink>
      <NuxtLink
        class="ed-program-card-request"
        :to="requestTo"
        :aria-label="tr('Запросить стоимость: ', 'Бағасын сұрау: ') + title"
      >{{ tr('Запросить стоимость', 'Бағасын сұрау') }}</NuxtLink>
    </div>
  </article>
</template>

<style scoped>
.ed-program-card {
  display: flex;
  flex-direction: column;
  min-width: 0;
  height: 100%;
  padding: clamp(20px, 2.2vw, 30px);
  border: 1px solid var(--ed-rule, #ccd3cd);
  border-radius: var(--ed-radius, 4px);
  background: var(--ed-white, #fff);
  color: var(--ed-ink, #10262a);
}
.ed-program-card-body { flex: 1; }
.ed-program-card .ed-program-card-status {
  margin: 0 0 14px;
  color: var(--ed-muted, #526365);
  font: 500 12px/1.5 var(--ed-sans, Arial, sans-serif);
}
.ed-program-card .ed-program-card-title {
  margin: 0;
  font: 500 clamp(26px, 2.1vw, 28px)/1.2 var(--ed-display, Georgia, serif);
  letter-spacing: -.025em;
  overflow-wrap: anywhere;
  text-wrap: balance;
}
.ed-program-card-title a { color: inherit; text-decoration: none; }
.ed-program-card-title a:hover { text-decoration: underline; text-decoration-thickness: 1px; text-underline-offset: 4px; }
.ed-program-card .ed-program-card-description {
  margin: 16px 0 0;
  color: var(--ed-muted, #526365);
  font: 400 15px/1.7 var(--ed-sans, Arial, sans-serif);
}
.ed-program-card .ed-program-card-purpose {
  margin: 18px 0 0;
  color: var(--ed-ink, #10262a);
  font: 500 14px/1.6 var(--ed-sans, Arial, sans-serif);
}
.ed-program-card .ed-program-card-languages {
  margin: 12px 0 0;
  color: var(--ed-muted, #526365);
  font: 400 13px/1.6 var(--ed-sans, Arial, sans-serif);
}
.ed-program-card-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0 20px;
  margin-top: 24px;
  padding-top: 12px;
  border-top: 1px solid var(--ed-rule, #ccd3cd);
}
.ed-program-card-actions a {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  min-height: 44px;
  max-width: 100%;
  color: var(--ed-ink, #10262a);
  font: 500 14px/1.5 var(--ed-sans, Arial, sans-serif);
  text-decoration: none;
  text-underline-offset: 4px;
}
.ed-program-card-actions .ed-program-card-request { color: var(--ed-muted, #526365); font-size: 13px; font-weight: 400; }
.ed-program-card-actions a:hover { color: var(--ed-ink, #10262a); text-decoration: underline; }
.ed-program-card-details .civic-icon { width: 18px; height: 18px; flex-shrink: 0; }
.ed-program-card a:focus-visible { outline: 3px solid var(--ed-focus, #986118); outline-offset: 4px; border-radius: 2px; }
</style>
