<script setup>
import { computed } from 'vue';
import { getProgramFixture } from '~/composables/useProgramFlowMock';

definePageMeta({ layout: 'fullwidth' });

useHead({
  title: 'Личный кабинет — Sertificat.kz',
  meta: [
    {
      name: 'description',
      content: 'Mock overview кабинета: прогресс, сертификат, pending status и история действий.',
    },
  ],
});

const { paths, flow, syncCourseId } = useRedesignRoutes();

syncCourseId();

const program = computed(() => getProgramFixture(flow.flow.value.courseId || 'industrial-safety'));
const learningState = computed(() => flow.flow.value.learning || {});
const testState = computed(() => flow.flow.value.test || {});
const paymentState = computed(() => flow.flow.value.payment || {});
const certificateState = computed(() => flow.flow.value.certificate || program.value.certificate);
const overviewState = computed(() => flow.flow.value.overview || {});

const progress = computed(() => overviewState.value.progress ?? program.value.progress);
const completedModules = computed(() => learningState.value.completedModuleIds || []);
const history = computed(() => certificateState.value.history || program.value.certificate.history);

const openLearning = () => navigateTo(paths.value.learning);
const openCertificate = () => navigateTo(paths.value.certificate);
const openPending = () => navigateTo(paths.value.pending);
const openSelection = () => navigateTo(paths.value.programSelection);
</script>

<template>
  <div class="min-h-screen bg-[#06101d] text-white">
    <header class="border-b border-white/5 bg-[#081527]/95">
      <div class="mx-auto flex max-w-screen-2xl items-center justify-between gap-4 px-6 py-4 md:px-8">
        <div>
          <div class="text-2xl font-extrabold tracking-tighter">Sertificat.kz</div>
          <div class="text-[10px] uppercase tracking-[0.24em] text-slate-400">Overview cabinet</div>
        </div>
        <div class="flex flex-wrap gap-3">
          <button class="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200" @click="openSelection">Новый подбор</button>
          <button class="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200" @click="openLearning">Learning</button>
          <button class="rounded-xl bg-[#4A90E2] px-4 py-2 text-sm font-bold text-white" @click="openCertificate">Сертификат</button>
        </div>
      </div>
    </header>

    <main class="mx-auto grid max-w-screen-2xl grid-cols-1 gap-8 px-6 py-8 lg:grid-cols-[1.2fr_0.8fr] md:px-8">
      <section class="space-y-6">
        <div class="rounded-[28px] border border-white/10 bg-[linear-gradient(135deg,#0a192f_0%,#102544_50%,#17345a_100%)] p-6 md:p-8">
          <div class="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
            <div>
              <div class="text-[10px] uppercase tracking-[0.24em] text-slate-400">Current program</div>
              <h1 class="mt-2 text-3xl font-extrabold md:text-4xl">{{ program.title }}</h1>
              <p class="mt-3 max-w-2xl text-sm leading-relaxed text-slate-300">
                Кабинет показывает текущий прогресс, историю и состояние mock payment / certificate без реального backend.
              </p>
            </div>
            <div class="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-right">
              <div class="text-[10px] uppercase tracking-[0.24em] text-slate-500">Progress</div>
              <div class="mt-2 text-3xl font-black">{{ progress }}%</div>
            </div>
          </div>
        </div>

        <div class="grid gap-4 md:grid-cols-3">
          <div class="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div class="text-[10px] uppercase tracking-[0.24em] text-slate-500">Modules done</div>
            <div class="mt-2 text-3xl font-black">{{ completedModules.length }}</div>
          </div>
          <div class="rounded-2xl border border-white/10 bg-white/5 p-5">
          <div class="text-[10px] uppercase tracking-[0.24em] text-slate-500">Test score</div>
            <div class="mt-2 text-3xl font-black">{{ testState.score ?? '—' }}%</div>
          </div>
          <div class="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div class="text-[10px] uppercase tracking-[0.24em] text-slate-500">Payment</div>
            <div class="mt-2 text-3xl font-black">{{ paymentState.status || 'idle' }}</div>
          </div>
        </div>

        <div class="rounded-[28px] border border-white/10 bg-white/5 p-6 md:p-8">
          <div class="flex items-center justify-between gap-4">
            <div>
              <div class="text-[10px] uppercase tracking-[0.24em] text-slate-500">History</div>
              <h2 class="mt-2 text-2xl font-extrabold">История документа</h2>
            </div>
            <div class="text-sm text-slate-400">{{ certificateState.number }}</div>
          </div>

          <div class="mt-5 space-y-3">
            <div
              v-for="item in history"
              :key="item.date + item.title"
              class="rounded-2xl border border-white/10 bg-black/20 p-4"
            >
              <div class="text-[10px] uppercase tracking-[0.22em] text-slate-500">{{ item.date }}</div>
              <div class="mt-1 text-sm font-bold text-white">{{ item.title }}</div>
              <p class="mt-1 text-sm leading-relaxed text-slate-300">{{ item.detail }}</p>
            </div>
          </div>
        </div>
      </section>

      <aside class="space-y-6 rounded-[28px] border border-white/10 bg-white/5 p-6 md:p-7">
        <div class="rounded-2xl border border-[#4A90E2]/30 bg-[#0f2240] p-5">
          <div class="text-[10px] uppercase tracking-[0.24em] text-slate-400">Certificate</div>
          <div class="mt-2 text-xl font-bold">{{ certificateState.number }}</div>
          <p class="mt-2 text-sm text-slate-300">Статус: {{ certificateState.status }}</p>
          <p class="mt-1 text-sm text-slate-300">Дата: {{ certificateState.issuedAt || program.certificate.issuedAt }}</p>
        </div>

        <div class="rounded-2xl border border-white/10 bg-black/20 p-5">
          <div class="text-[10px] uppercase tracking-[0.24em] text-slate-500">Current route</div>
          <ul class="mt-4 space-y-2 text-sm text-slate-300">
            <li>learning → confirm → pre-test → exam</li>
            <li>fail → payment → retry</li>
            <li>success → certificate → pending → overview</li>
          </ul>
        </div>

        <div class="space-y-3 border-t border-white/10 pt-4">
          <button class="w-full rounded-xl bg-[#4A90E2] px-4 py-3 text-sm font-bold text-white transition-all hover:brightness-110" @click="openLearning">
            Продолжить learning
          </button>
          <button class="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-200 transition-colors hover:border-white/20 hover:bg-white/10" @click="openPending">
            Открыть pending
          </button>
        </div>
      </aside>
    </main>
  </div>
</template>
