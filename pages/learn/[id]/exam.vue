<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import ExamFooterBar from '~/components/redesign-flow/exam/ExamFooterBar.vue';
import ExamNavigationPanel from '~/components/redesign-flow/exam/ExamNavigationPanel.vue';
import ExamQuestionPanel from '~/components/redesign-flow/exam/ExamQuestionPanel.vue';
import ExamStatusHeader from '~/components/redesign-flow/exam/ExamStatusHeader.vue';
import { getRuntimeFlowFixture } from '~/composables/useRedesignRuntimeMock';

definePageMeta({ layout: 'fullwidth' });

const route = useRoute();
const { paths, flow, syncCourseId } = useRedesignRoutes();

const courseId = computed(() => (Array.isArray(route.params.id) ? route.params.id[0] : route.params.id));
const runtime = computed(() => getRuntimeFlowFixture(courseId.value));

syncCourseId();

const savedTest = computed(() => flow.flow.value.test || {});
const activeIndex = ref(Number(savedTest.value.currentQuestionIndex || 0));
const answers = ref({ ...(savedTest.value.answers || {}) });
const remainingSeconds = ref(runtime.value.exam.durationMinutes * 60);

let timerId;

const questions = computed(() => runtime.value.exam.questions);
const currentQuestion = computed(() => questions.value[activeIndex.value] || questions.value[0]);
const progressWidth = computed(() => `${Math.round(((activeIndex.value + 1) / questions.value.length) * 100)}%`);
const timeRemaining = computed(() => {
  const minutes = Math.floor(remainingSeconds.value / 60)
    .toString()
    .padStart(2, '0');
  const seconds = (remainingSeconds.value % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
});

const syncExamState = (extra = {}) => {
  flow.patchFlow({
    stage: 'exam',
    test: {
      ...savedTest.value,
      currentQuestionIndex: activeIndex.value,
      answers: answers.value,
      ...extra,
    },
    overview: {
      ...(flow.flow.value.overview || {}),
      currentStep: 'exam',
      progress: 100,
    },
  });
};

flow.patchFlow({
  stage: 'exam',
  overview: {
    ...(flow.flow.value.overview || {}),
    currentStep: 'exam',
    progress: 100,
  },
});

const selectAnswer = (index) => {
  answers.value = {
    ...answers.value,
    [currentQuestion.value.id]: index,
  };

  syncExamState();
};

const jumpToQuestion = (index) => {
  activeIndex.value = index;
  syncExamState();
};

const goPrevious = () => {
  if (activeIndex.value === 0) {
    return;
  }

  activeIndex.value -= 1;
  syncExamState();
};

const goNext = () => {
  if (activeIndex.value >= questions.value.length - 1) {
    return;
  }

  activeIndex.value += 1;
  syncExamState();
};

const submitExam = () => {
  const correctCount = questions.value.reduce((total, question) => {
    return total + ((answers.value[question.id] ?? -1) === question.answerIndex ? 1 : 0);
  }, 0);
  const score = Math.round((correctCount / questions.value.length) * 100);
  const passed = score >= runtime.value.exam.passScore;

  flow.patchFlow({
    stage: 'exam',
    branch: passed ? 'pass' : 'fail',
    test: {
      currentQuestionIndex: activeIndex.value,
      answers: answers.value,
      score,
      correctCount,
      passed,
      submitted: true,
      submittedAt: new Date().toISOString(),
    },
    overview: {
      ...(flow.flow.value.overview || {}),
      currentStep: passed ? 'success' : 'failed',
      progress: 100,
    },
  });

  navigateTo(passed ? paths.value.success : paths.value.failed);
};

onMounted(() => {
  timerId = window.setInterval(() => {
    if (remainingSeconds.value > 0) {
      remainingSeconds.value -= 1;
    }
  }, 1000);
});

onBeforeUnmount(() => {
  if (timerId) {
    window.clearInterval(timerId);
  }
});
</script>

<template>
  <div class="flex min-h-screen flex-col bg-surface text-on-surface">
    <ExamStatusHeader
      :candidate-name="runtime.runtime.participant.candidateName"
      :current-question="activeIndex + 1"
      :progress-width="progressWidth"
      :time-remaining="timeRemaining"
      :total-questions="questions.length"
    />

    <main class="mx-auto grid w-full max-w-screen-2xl flex-grow grid-cols-1 gap-8 px-8 py-10 lg:grid-cols-12">
      <div class="space-y-8 lg:col-span-8">
        <ExamQuestionPanel
          :blueprint-image="runtime.exam.blueprintImage"
          :question="currentQuestion"
          :question-label="'Safety Protocol Verification'"
          :selected-answer="answers[currentQuestion.id]"
          @select="selectAnswer"
        />
      </div>

      <div class="lg:col-span-4">
        <ExamNavigationPanel
          :answers="answers"
          :current-index="activeIndex"
          :questions="questions"
          :technical-warning="runtime.exam.technicalWarning"
          @jump="jumpToQuestion"
        />
      </div>
    </main>

    <ExamFooterBar
      :can-go-next="activeIndex < questions.length - 1"
      :can-go-previous="activeIndex > 0"
      :protocol-id="runtime.runtime.examProtocolId"
      @next="goNext"
      @previous="goPrevious"
      @submit="submitExam"
    />
  </div>
</template>
