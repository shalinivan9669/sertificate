<script setup>
import { computed, ref } from 'vue';
import RetryPaymentMethods from '~/components/redesign-flow/payment/RetryPaymentMethods.vue';
import RetryPaymentSummary from '~/components/redesign-flow/payment/RetryPaymentSummary.vue';
import { getRuntimeFlowFixture } from '~/composables/useRedesignRuntimeMock';

definePageMeta({ layout: 'fullwidth' });

const route = useRoute();
const { paths, flow, syncCourseId } = useRedesignRoutes();

const courseId = computed(() => {
  const param = route.params.courseId || route.params.id;
  return Array.isArray(param) ? param[0] : param || flow.flow.value.courseId;
});

const runtime = computed(() => getRuntimeFlowFixture(courseId.value));
const paymentState = computed(() => flow.flow.value.payment || {});
const selectedMethodId = ref(paymentState.value.methodId || runtime.value.retryPayment.methods[0].id);

syncCourseId();

flow.patchFlow({
  stage: 'payment',
  branch: 'fail',
  overview: {
    ...(flow.flow.value.overview || {}),
    currentStep: 'payment',
    progress: 100,
  },
});

const attemptLabel = computed(() => `#${(paymentState.value.retryCount || 0) + 2}`);
const payLabel = computed(() => `Оплатить ${runtime.value.retryPayment.amount}`);

const pay = () => {
  flow.patchFlow({
    stage: 'pretest',
    branch: 'browse',
    payment: {
      ...paymentState.value,
      methodId: selectedMethodId.value,
      status: 'retry-paid',
      transactionId: `RET-${courseId.value.toUpperCase()}-${Date.now()}`,
      retryCount: (paymentState.value.retryCount || 0) + 1,
      lastPaidAt: new Date().toISOString(),
    },
    test: {
      currentQuestionIndex: 0,
      answers: {},
      score: 0,
      correctCount: 0,
      passed: false,
      submitted: false,
      submittedAt: '',
    },
    overview: {
      ...(flow.flow.value.overview || {}),
      currentStep: 'pretest',
      progress: 100,
    },
  });

  navigateTo(paths.value.pretest);
};

const cancel = () => navigateTo(paths.value.failed);
</script>

<template>
  <div class="flex min-h-screen flex-col bg-surface text-on-surface">
    <header class="bg-[#0A192F] text-white">
      <div class="mx-auto flex max-w-screen-2xl items-center justify-between px-8 py-4">
        <div class="text-2xl font-extrabold tracking-tighter text-white">Sertificat.kz</div>
        <div class="flex items-center gap-4">
          <span class="text-sm font-medium text-slate-400">Step 2 of 2</span>
          <button class="text-slate-400 transition-colors duration-200 hover:text-white" type="button" @click="cancel">
            <span class="material-symbols-outlined">close</span>
          </button>
        </div>
      </div>
    </header>

    <main class="flex flex-grow items-center justify-center px-4 py-12">
      <div class="grid w-full max-w-4xl grid-cols-1 gap-8 lg:grid-cols-5">
        <div class="lg:col-span-2">
          <RetryPaymentSummary
            :amount="runtime.retryPayment.amount"
            :attempt-label="attemptLabel"
            :course-name="runtime.title"
            :description="runtime.retryPayment.description"
            :title="runtime.retryPayment.title"
            :trust-badges="runtime.retryPayment.trustBadges"
          />
        </div>

        <div class="lg:col-span-3">
          <RetryPaymentMethods
            :info-text="runtime.retryPayment.infoText"
            :methods="runtime.retryPayment.methods"
            :pay-label="payLabel"
            :selected-method-id="selectedMethodId"
            @cancel="cancel"
            @pay="pay"
            @select="selectedMethodId = $event"
          />
        </div>
      </div>
    </main>

    <footer class="w-full border-t border-white/5 bg-[#0A192F] px-8 py-8">
      <div class="mx-auto flex max-w-screen-2xl flex-col items-center justify-between gap-6 md:flex-row">
        <div class="flex flex-col gap-2">
          <div class="text-xl font-black text-white">Sertificat.kz</div>
          <p class="text-xs text-slate-400">© 2026 Industrial Safety Certification Center Kazakhstan. All rights reserved.</p>
        </div>
        <div class="flex gap-6">
          <NuxtLink class="text-xs text-slate-400 transition-colors hover:text-[#4A90E2] hover:underline" :to="paths.privacy">Privacy Policy</NuxtLink>
          <NuxtLink class="text-xs text-slate-400 transition-colors hover:text-[#4A90E2] hover:underline" :to="paths.terms">Terms of Service</NuxtLink>
          <NuxtLink class="text-xs text-slate-400 transition-colors hover:text-[#4A90E2] hover:underline" :to="paths.contacts">Contact Support</NuxtLink>
        </div>
      </div>
    </footer>
  </div>
</template>
