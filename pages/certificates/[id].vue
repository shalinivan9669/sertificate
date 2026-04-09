<script setup>
import { computed, ref } from 'vue';
import CertificateCheckoutSidebar from '~/components/redesign-flow/certificate/CertificateCheckoutSidebar.vue';
import CertificateInvoicePanel from '~/components/redesign-flow/certificate/CertificateInvoicePanel.vue';
import MarketingFooter from '~/components/redesign-flow/shared/MarketingFooter.vue';
import MarketingHeader from '~/components/redesign-flow/shared/MarketingHeader.vue';
import { getRuntimeFlowFixture } from '~/composables/useRedesignRuntimeMock';

definePageMeta({ layout: 'fullwidth' });

const route = useRoute();
const { paths, flow, syncCourseId } = useRedesignRoutes();

const courseId = computed(() => (Array.isArray(route.params.id) ? route.params.id[0] : route.params.id));
const runtime = computed(() => getRuntimeFlowFixture(courseId.value));
const selectedMethodId = ref(runtime.value.certificateCheckout.methods[0].id);

syncCourseId();

flow.patchFlow({
  stage: 'certificate',
  branch: 'pass',
  certificate: {
    ...(flow.flow.value.certificate || runtime.value.certificate),
    status: 'ready',
  },
  overview: {
    ...(flow.flow.value.overview || {}),
    currentStep: 'certificate',
    progress: 100,
  },
});

const confirmPayment = () => {
  flow.patchFlow({
    stage: 'pending',
    branch: 'pass',
    payment: {
      ...(flow.flow.value.payment || {}),
      methodId: selectedMethodId.value,
      status: 'pending',
      transactionId: `ORD-${courseId.value.toUpperCase()}-${Date.now()}`,
      lastPaidAt: new Date().toISOString(),
    },
    certificate: {
      ...(flow.flow.value.certificate || runtime.value.certificate),
      status: 'pending',
    },
    overview: {
      ...(flow.flow.value.overview || {}),
      currentStep: 'pending',
      progress: 100,
    },
  });

  navigateTo(paths.value.pending);
};
</script>

<template>
  <div class="flex min-h-screen flex-col bg-surface text-on-background">
    <MarketingHeader active="certificate" />

    <main class="mx-auto w-full max-w-screen-2xl flex-grow px-8 py-12">
      <div class="grid grid-cols-1 gap-12 lg:grid-cols-12">
        <div class="lg:col-span-7">
          <CertificateInvoicePanel
            :course-name="runtime.title"
            :invoice-date="runtime.certificateCheckout.invoiceDate"
            :invoice-number="runtime.certificateCheckout.invoiceNumber"
            :organization="runtime.certificateCheckout.organization"
            :participant-name="runtime.certificateCheckout.participantName"
            :services="runtime.certificateCheckout.services"
            :title="runtime.certificateCheckout.title"
          />
        </div>

        <div class="lg:col-span-5">
          <CertificateCheckoutSidebar
            :consent-text="runtime.certificateCheckout.consentText"
            :methods="runtime.certificateCheckout.methods"
            :security-logos="runtime.certificateCheckout.securityLogos"
            :selected-method-id="selectedMethodId"
            :total="runtime.certificateCheckout.total"
            @confirm="confirmPayment"
            @select="selectedMethodId = $event"
          />
        </div>
      </div>
    </main>

    <MarketingFooter :show-languages="true" description="© 2026 Industrial Safety Certification Center Kazakhstan. Official accredited center for training specialists in the industrial sector." />
  </div>
</template>
