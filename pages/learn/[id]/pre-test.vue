<script setup lang="ts">
const route = useRoute();
const path = useLocalePath();
const { api, tr, errorText } = useLmsApi();
const id = String(route.params.id);
const { data, pending, error, refresh } = await useAsyncData(
  "lms-exam-eligibility-" + id,
  () => api<any>("/enrollments/" + encodeURIComponent(id)),
);
const enrollment = computed(() => data.value?.enrollment || data.value);
const agree = ref(false);
const busy = ref(false);
const failure = ref("");
let attemptKey = "";
async function start() {
  busy.value = true;
  failure.value = "";
  try {
    attemptKey ||= crypto.randomUUID();
    const a = await api<LmsAttempt>(
      "/enrollments/" + encodeURIComponent(id) + "/attempts",
      { method: "POST", headers: { "Idempotency-Key": attemptKey }, body: {} },
    );
    await navigateTo({
      path: path("/learn/" + id + "/exam"),
      query: { attempt: a.id },
    });
  } catch (e) {
    failure.value = errorText(e);
  } finally {
    busy.value = false;
  }
}
useHead(() => ({
  title: tr(
    "Перед проверкой знаний — OT Center",
    "Білімді тексеру алдында — OT Center",
  ),
  meta: [{ name: "robots", content: "noindex, nofollow" }],
}));
</script>
<template>
  <LmsShell
    :title="tr('Перед проверкой знаний', 'Білімді тексеру алдында')"
    :back="'/learn/' + id"
    ><LmsState :pending="pending" :error="error" @retry="refresh"
      ><div v-if="enrollment" class="lms-card max-w-3xl space-y-6">
        <h2 class="text-xl font-semibold">{{ enrollment.title }}</h2>
        <dl v-if="enrollment.assessment" class="grid gap-4 sm:grid-cols-2">
          <div>
            <dt class="text-sm text-slate-500">
              {{ tr("Время на попытку", "Әрекетке берілетін уақыт") }}
            </dt>
            <dd class="font-semibold">
              {{ enrollment.assessment.durationMinutes }}
              {{ tr("минут", "минут") }}
            </dd>
          </div>
          <div>
            <dt class="text-sm text-slate-500">
              {{ tr("Количество вопросов", "Сұрақ саны") }}
            </dt>
            <dd class="font-semibold">
              {{ enrollment.assessment.questionCount }}
            </dd>
          </div>
          <div>
            <dt class="text-sm text-slate-500">
              {{ tr("Порог успешного результата", "Сәтті нәтиже шегі") }}
            </dt>
            <dd class="font-semibold">
              {{ enrollment.assessment.passPercent }}%
            </dd>
          </div>
          <div>
            <dt class="text-sm text-slate-500">
              {{ tr("Лимит попыток", "Әрекеттер шегі") }}
            </dt>
            <dd class="font-semibold">
              {{ enrollment.assessment.maxAttempts }}
            </dd>
          </div>
        </dl>
        <p class="lms-note">
          {{
            tr(
              "Время начинается после запуска попытки и продолжает идти при закрытии вкладки. Ответы сохраняются при выборе. После отправки изменить их нельзя.",
              "Уақыт әрекетті бастағаннан кейін есептеледі және қойынды жабылғанда да жалғасады. Жауаптар таңдау кезінде сақталады. Жібергеннен кейін оларды өзгерту мүмкін емес.",
            )
          }}
        </p>
        <div v-if="!enrollment.eligibility?.eligible" class="lms-note">
          <p class="font-semibold">
            {{
              tr(
                "Для начала нужно выполнить условия:",
                "Бастау үшін шарттарды орындаңыз:",
              )
            }}
          </p>
          <ul class="mt-2 list-inside list-disc">
            <li v-for="reason in enrollment.eligibility?.reasons" :key="reason">
              {{ reason }}
            </li>
          </ul>
          <NuxtLink class="mt-3 inline-block" :to="path('/learn/' + id)">{{
            tr("Вернуться к материалам", "Материалдарға оралу")
          }}</NuxtLink>
        </div>
        <label v-else class="flex items-start gap-3"
          ><input v-model="agree" type="checkbox" class="mt-1" /><span>{{
            tr(
              "Я ознакомился(-ась) с условиями и готов(-а) начать проверку знаний.",
              "Шарттармен таныстым және білімімді тексеруге дайынмын.",
            )
          }}</span></label
        >
        <p v-if="failure" class="lms-error" role="alert">{{ failure }}</p>
        <button
          class="lms-button"
          :disabled="busy || !agree || !enrollment.eligibility?.eligible"
          @click="start"
        >
          {{
            busy
              ? tr("Создаём попытку…", "Әрекет құрылуда…")
              : tr(
                  "Начать попытку — запустить таймер",
                  "Әрекетті бастау — таймерді іске қосу",
                )
          }}</button
        ><NuxtLink
          v-if="enrollment.activeAttemptId"
          class="lms-button secondary ml-2"
          :to="{
            path: path('/learn/' + id + '/exam'),
            query: { attempt: enrollment.activeAttemptId },
          }"
          >{{
            tr("Продолжить текущую попытку", "Ағымдағы әрекетті жалғастыру")
          }}</NuxtLink
        >
      </div></LmsState
    ></LmsShell
  >
</template>
