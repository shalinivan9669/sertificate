<script setup>
import { computed } from 'vue';
import FailedResultHero from '~/components/redesign-flow/failed/FailedResultHero.vue';
import FailedSidebar from '~/components/redesign-flow/failed/FailedSidebar.vue';
import MarketingFooter from '~/components/redesign-flow/shared/MarketingFooter.vue';
import MarketingHeader from '~/components/redesign-flow/shared/MarketingHeader.vue';
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
  stage: 'failed',
  branch: 'fail',
  overview: {
    ...(flow.flow.value.overview || {}),
    currentStep: 'failed',
    progress: 100,
  },
});

const goToPayment = () => navigateTo(paths.value.payment);
const goToLearning = () => navigateTo(paths.value.learning);
const contactSupport = () => navigateTo(paths.value.contacts);
</script>

<template>
  <div class="flex min-h-screen flex-col bg-surface font-body text-on-background">
    <MarketingHeader active="accreditation" />

    <main class="relative flex flex-grow flex-col items-center justify-center overflow-hidden px-4 py-12">
      <div class="pointer-events-none absolute inset-0 z-0 opacity-5">
        <div class="absolute left-1/2 top-1/2 h-[800px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-secondary blur-[120px]"></div>
      </div>

      <div class="z-10 w-full max-w-4xl">
        <div class="grid grid-cols-1 gap-6 md:grid-cols-12">
          <div class="md:col-span-7">
            <FailedResultHero
              :correct-count="correctCount"
              :message="runtime.failed.message"
              :pass-score="runtime.exam.passScore"
              :score="score"
              :subtitle="runtime.failed.subtitle"
              :title="runtime.failed.title"
              :total-questions="runtime.exam.questions.length"
              @payment="goToPayment"
            />
          </div>

          <div class="md:col-span-5">
            <FailedSidebar
              :banner="runtime.failed.banner"
              :review-topics="runtime.failed.reviewTopics"
              @learning="goToLearning"
              @support="contactSupport"
            />
          </div>
        </div>
      </div>
    </main>

    <MarketingFooter description="The official portal for industrial safety certification in the Republic of Kazakhstan. Ensuring operational excellence through rigorous technical assessment." />
  </div>
</template>
