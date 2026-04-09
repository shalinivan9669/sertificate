<script setup>
import { computed } from 'vue';
import PendingInfoSidebar from '~/components/redesign-flow/pending/PendingInfoSidebar.vue';
import PendingStatusCard from '~/components/redesign-flow/pending/PendingStatusCard.vue';
import MarketingFooter from '~/components/redesign-flow/shared/MarketingFooter.vue';
import MarketingHeader from '~/components/redesign-flow/shared/MarketingHeader.vue';
import { getRuntimeFlowFixture } from '~/composables/useRedesignRuntimeMock';

definePageMeta({ layout: 'fullwidth' });

const { paths, flow, syncCourseId } = useRedesignRoutes();

const courseId = computed(() => flow.flow.value.courseId);
const runtime = computed(() => getRuntimeFlowFixture(courseId.value));
const paymentState = computed(() => flow.flow.value.payment || {});

syncCourseId();

const estimate = computed(() => runtime.value.pending.estimateByMethod[paymentState.value.methodId] || '1-2 рабочих дня');

flow.patchFlow({
  stage: 'pending',
  branch: 'pass',
  overview: {
    ...(flow.flow.value.overview || {}),
    currentStep: 'pending',
    progress: 100,
  },
});

const goToCabinet = () => navigateTo(paths.value.cabinet);
const contactSupport = () => navigateTo(paths.value.contacts);
</script>

<template>
  <div class="flex min-h-screen flex-col bg-surface font-body text-on-surface">
    <MarketingHeader active="certificate" />

    <main class="flex flex-grow items-center justify-center p-6 md:p-12">
      <div class="grid w-full max-w-4xl grid-cols-1 items-start gap-8 lg:grid-cols-12">
        <div class="lg:col-span-7">
          <PendingStatusCard
            :description="runtime.pending.description"
            :steps="runtime.pending.steps"
            :title="runtime.pending.title"
            @cabinet="goToCabinet"
            @later="goToCabinet"
          />
        </div>

        <div class="lg:col-span-5">
          <PendingInfoSidebar
            :course-name="runtime.pending.details.courseName"
            :estimate="estimate"
            :next-items="runtime.pending.nextItems"
            :order-number="runtime.pending.details.orderNumber"
            @support="contactSupport"
          />
        </div>
      </div>
    </main>

    <MarketingFooter description="The official portal for industrial safety certification in the Republic of Kazakhstan. Ensuring operational excellence through rigorous technical assessment." />
  </div>
</template>
