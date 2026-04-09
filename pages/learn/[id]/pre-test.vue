<script setup>
import { computed } from 'vue';
import MarketingFooter from '~/components/redesign-flow/shared/MarketingFooter.vue';
import MarketingHeader from '~/components/redesign-flow/shared/MarketingHeader.vue';
import PretestMetricsGrid from '~/components/redesign-flow/pretest/PretestMetricsGrid.vue';
import PretestSupportCard from '~/components/redesign-flow/pretest/PretestSupportCard.vue';
import { logRedesignFlow, summarizeLearningState } from '~/composables/useRedesignFlowDebug';
import { getRuntimeFlowFixture } from '~/composables/useRedesignRuntimeMock';

definePageMeta({ layout: 'fullwidth' });

const route = useRoute();
const { paths, flow, syncCourseId } = useRedesignRoutes();

const courseId = computed(() => (Array.isArray(route.params.id) ? route.params.id[0] : route.params.id));
const runtime = computed(() => getRuntimeFlowFixture(courseId.value));

syncCourseId();

logRedesignFlow('pretest-page', 'enter', {
  path: route.fullPath,
  stageBeforePatch: flow.flow.value.stage,
  learning: summarizeLearningState(flow.flow.value.learning || {}),
});

flow.patchFlow({
  stage: 'pretest',
  overview: {
    ...(flow.flow.value.overview || {}),
    currentStep: 'pretest',
    progress: 100,
  },
});

logRedesignFlow('pretest-page', 'patched-flow', {
  path: route.fullPath,
  stageAfterPatch: flow.flow.value.stage,
});

const supportLinks = computed(() =>
  runtime.value.pretest.supportLinks.map((item) => ({
    icon: item.icon,
    label: item.label,
    to: paths.value[item.routeKey],
  })),
);

const goToExam = () => navigateTo(paths.value.exam);
const backToLearning = () => navigateTo(paths.value.learning);
</script>

<template>
  <div class="flex min-h-screen flex-col bg-surface font-body text-on-surface">
    <MarketingHeader active="catalog" />

    <main class="mx-auto grid min-h-screen max-w-7xl grid-cols-1 gap-8 px-6 pb-20 pt-24 lg:grid-cols-12">
      <div class="mb-4 lg:col-span-12">
        <nav class="mb-4 flex items-center space-x-2 text-sm text-on-primary-container">
          <span class="cursor-pointer transition-colors hover:text-secondary">{{ runtime.pretest.breadcrumbs[0] }}</span>
          <span class="material-symbols-outlined text-xs">chevron_right</span>
          <span class="cursor-pointer transition-colors hover:text-secondary">{{ runtime.pretest.breadcrumbs[1] }}</span>
          <span class="material-symbols-outlined text-xs">chevron_right</span>
          <span class="font-semibold text-primary">{{ runtime.pretest.breadcrumbs[2] }}</span>
        </nav>
        <h1 class="font-headline text-4xl font-extrabold tracking-tight text-primary md:text-5xl">{{ runtime.pretest.title }}</h1>
        <p class="mt-4 max-w-2xl leading-relaxed text-on-surface-variant">
          {{ runtime.pretest.description }}
        </p>
      </div>

      <div class="space-y-6 lg:col-span-8">
        <PretestMetricsGrid :metrics="runtime.pretest.metrics" />

        <div class="rounded-xl bg-[#2D3436] p-8 text-white shadow-xl">
          <h3 class="mb-6 flex items-center text-xl font-bold font-headline">
            <span class="material-symbols-outlined mr-3 text-secondary" style="font-variation-settings: 'FILL' 1;">gavel</span>
            Регламент прохождения
          </h3>
          <ul class="space-y-4">
            <li v-for="rule in runtime.pretest.rules" :key="rule" class="flex items-start">
              <span class="material-symbols-outlined mr-3 mt-1 text-sm text-secondary">check_circle</span>
              <p class="text-sm leading-relaxed text-slate-300">{{ rule }}</p>
            </li>
          </ul>
        </div>

        <div class="rounded-r-xl border-l-4 border-error bg-error-container/30 p-6">
          <div class="mb-2 flex items-center">
            <span class="material-symbols-outlined mr-2 text-error" style="font-variation-settings: 'FILL' 1;">warning</span>
            <span class="text-xs font-bold uppercase tracking-wide text-error">Внимание</span>
          </div>
          <p class="text-sm font-medium text-on-error-container">
            {{ runtime.pretest.warning }}
          </p>
        </div>
      </div>

      <div class="space-y-6 lg:col-span-4">
        <PretestSupportCard :image="runtime.pretest.image" :links="supportLinks" />

        <div class="space-y-4 rounded-xl border border-outline-variant/20 bg-white p-6">
          <button class="flex w-full items-center justify-center space-x-2 rounded-md bg-[#0A192F] px-6 py-4 font-bold text-white shadow-[0_4px_12px_rgba(10,25,47,0.2)] transition-all duration-200 hover:bg-[#162a4a]" type="button" @click="goToExam">
            <span>Start Test</span>
            <span class="material-symbols-outlined">play_arrow</span>
          </button>
          <button class="flex w-full items-center justify-center space-x-2 rounded-md border border-outline-variant px-6 py-4 font-semibold text-primary transition-all duration-200 hover:bg-surface-container-high" type="button" @click="backToLearning">
            <span class="material-symbols-outlined">menu_book</span>
            <span>Back to material</span>
          </button>
        </div>
      </div>
    </main>

    <MarketingFooter description="The official portal for industrial safety certification in the Republic of Kazakhstan. Ensuring operational excellence through rigorous technical assessment." />
  </div>
</template>
