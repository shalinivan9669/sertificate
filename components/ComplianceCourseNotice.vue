<script setup>
import { computed } from 'vue';
import { useI18n } from '#imports';
import {
  complianceStateLabels,
  getCourseCompliance,
  publicAuthorities,
} from '~/config/compliance';

const props = defineProps({
  course: {
    type: Object,
    required: true,
  },
});

const { locale } = useI18n();
const lang = computed(() => (locale.value === 'kk' ? 'kk' : 'ru'));
const record = computed(() => getCourseCompliance(props.course?.slug));
const label = computed(
  () =>
    complianceStateLabels[lang.value]?.[record.value.state] ||
    complianceStateLabels.ru[record.value.state] ||
    record.value.state,
);
const summary = computed(
  () => record.value.summary?.[lang.value] || record.value.summary?.ru || '',
);
const authority = computed(() =>
  record.value.authorityId
    ? publicAuthorities.find((item) => item.id === record.value.authorityId)
    : null,
);
</script>

<template>
  <section
    class="mx-auto mt-4 w-full max-w-7xl rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm"
    aria-label="Нормативный статус курса"
  >
    <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
      <div class="space-y-2">
        <div class="flex flex-wrap items-center gap-2">
          <span class="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
            {{ lang === 'kk' ? 'Нормативтік мәртебе' : 'Нормативный статус' }}
          </span>
          <span class="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">
            {{ label }}
          </span>
        </div>
        <p class="max-w-4xl text-sm leading-6 text-slate-700">
          {{ summary }}
        </p>
        <p v-if="authority" class="text-sm text-slate-600">
          <strong>{{ lang === 'kk' ? 'Құжат' : 'Документ' }}:</strong>
          {{ authority.number }} ·
          {{ authority.title[lang] || authority.title.ru }}
        </p>
      </div>

      <NuxtLink
        to="/compliance"
        class="inline-flex shrink-0 items-center justify-center rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-50"
      >
        {{ lang === 'kk' ? 'Дәлелдерді тексеру' : 'Проверить основания' }}
      </NuxtLink>
    </div>
  </section>
</template>
