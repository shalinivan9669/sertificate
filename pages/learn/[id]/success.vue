<script setup>
import { computed } from 'vue';
import MarketingFooter from '~/components/redesign-flow/shared/MarketingFooter.vue';
import MarketingHeader from '~/components/redesign-flow/shared/MarketingHeader.vue';
import SuccessBreakdownTable from '~/components/redesign-flow/success/SuccessBreakdownTable.vue';
import SuccessMainCard from '~/components/redesign-flow/success/SuccessMainCard.vue';
import SuccessScoreSidebar from '~/components/redesign-flow/success/SuccessScoreSidebar.vue';
import { getRuntimeFlowFixture } from '~/composables/useRedesignRuntimeMock';

definePageMeta({ layout: 'fullwidth' });

const route = useRoute();
const { paths, flow, syncCourseId } = useRedesignRoutes();

const courseId = computed(() => (Array.isArray(route.params.id) ? route.params.id[0] : route.params.id));
const runtime = computed(() => getRuntimeFlowFixture(courseId.value));
const testState = computed(() => flow.flow.value.test || {});

syncCourseId();

const score = computed(() => Number(testState.value.score || 0));
const correctCount = computed(() => Number(testState.value.correctCount || 0));

flow.patchFlow({
  stage: 'success',
  branch: 'pass',
  certificate: {
    ...(flow.flow.value.certificate || runtime.value.certificate),
    status: 'ready',
  },
  overview: {
    ...(flow.flow.value.overview || {}),
    currentStep: 'success',
    progress: 100,
  },
});

const goToCertificate = () => navigateTo(paths.value.certificate);
const goToCabinet = () => navigateTo(paths.value.cabinet);

const downloadReport = () => {
  if (!import.meta.client) {
    return;
  }

  const content = [
    'Sertificat.kz',
    `Course: ${runtime.value.title}`,
    `Score: ${score.value}%`,
    `Correct answers: ${correctCount.value} / ${runtime.value.exam.questions.length}`,
    `Completed: ${runtime.value.success.completedAt}`,
  ].join('\n');

  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${courseId.value}-detailed-report.txt`;
  link.click();
  URL.revokeObjectURL(url);
};
</script>

<template>
  <div class="flex min-h-screen flex-col bg-surface font-body text-on-surface">
    <MarketingHeader active="catalog" />

    <main class="mx-auto max-w-screen-xl px-6 py-12 md:py-20">
      <div class="grid grid-cols-1 gap-6 md:grid-cols-12">
        <div class="md:col-span-8">
          <SuccessMainCard
            :completed-at="runtime.success.completedAt"
            :description="runtime.success.description"
            :title="runtime.success.title"
            @cabinet="goToCabinet"
            @download="downloadReport"
            @proceed="goToCertificate"
          />
        </div>

        <div class="md:col-span-4">
          <SuccessScoreSidebar
            :correct-count="correctCount"
            :integrity-note="runtime.success.integrityNote"
            :next-step="runtime.success.nextStep"
            :score="score"
            :total-questions="runtime.exam.questions.length"
          />
        </div>
      </div>

      <SuccessBreakdownTable :rows="runtime.success.knowledgeBreakdown" />
    </main>

    <MarketingFooter description="The official portal for industrial safety certification in the Republic of Kazakhstan. Ensuring operational excellence through rigorous technical assessment." />
  </div>
</template>
