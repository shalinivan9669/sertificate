<script setup lang="ts">
defineProps<{ resultOnly?: boolean }>();
const route = useRoute();
const path = useLocalePath();
const { api, tr, errorText, date } = useLmsApi();
const enrollmentId = String(route.params.id);
const {
  data: initial,
  pending,
  error,
  refresh,
} = await useAsyncData(
  "lms-attempt-" +
    enrollmentId +
    "-" +
    String(route.query.attempt || "current"),
  async () => {
    let attemptId =
      typeof route.query.attempt === "string" ? route.query.attempt : "";
    if (!attemptId) {
      const res = await api<any>(
        "/enrollments/" + encodeURIComponent(enrollmentId),
      );
      const e = res.enrollment || res;
      attemptId = e.activeAttemptId || e.latestAttemptId || "";
    }
    if (!attemptId) return null;
    const a = await api<LmsAttempt>(
      "/attempts/" + encodeURIComponent(attemptId),
    );
    if (a.enrollmentId !== enrollmentId)
      throw createError({
        statusCode: 404,
        statusMessage: "Попытка не найдена",
      });
    return a;
  },
);
const attempt = ref<LmsAttempt | null>(null);
const draft = ref<Record<string, string[]>>({});
const dirty = ref<Record<string, string[]>>({});
const saving = ref(false);
const failure = ref("");
const conflict = ref(false);
const confirmed = ref(false);
const submitting = ref(false);
const active = ref(0);
const now = ref(Date.now());
const offset = ref(0);
let debounce: ReturnType<typeof setTimeout> | undefined;
let timer: ReturnType<typeof setInterval> | undefined;
let finalRefresh = false;
function install(a: LmsAttempt | null) {
  attempt.value = a;
  if (a) {
    draft.value = structuredClone(toRaw(a.answers));
    offset.value = Date.parse(a.serverTime) - Date.now();
    now.value = Date.now() + offset.value;
  }
  dirty.value = {};
  conflict.value = false;
  failure.value = "";
}
watch(initial, (a) => install(a || null), { immediate: true });
const remaining = computed(() =>
  attempt.value
    ? Math.max(
        0,
        Math.ceil((Date.parse(attempt.value.deadlineAt) - now.value) / 1000),
      )
    : 0,
);
const timeLabel = computed(
  () =>
    Math.floor(remaining.value / 60)
      .toString()
      .padStart(2, "0") +
    ":" +
    (remaining.value % 60).toString().padStart(2, "0"),
);
const question = computed(() => attempt.value?.questions[active.value]);
const unsaved = computed(() => Object.keys(dirty.value).length > 0);
const answered = computed(
  () =>
    attempt.value?.questions.filter((q) => draft.value[q.id]?.length).length ||
    0,
);
const terminal = computed(
  () => attempt.value && attempt.value.status !== "in_progress",
);
function choose(qid: string, optionId: string, checked: boolean) {
  if (!attempt.value || terminal.value || !remaining.value) return;
  const options = draft.value[qid] || [];
  const value = checked
    ? [...options.filter((id) => id !== optionId), optionId]
    : options.filter((id) => id !== optionId);
  draft.value = { ...draft.value, [qid]: value };
  dirty.value = { ...dirty.value, [qid]: value };
  failure.value = "";
  if (debounce) clearTimeout(debounce);
  debounce = setTimeout(() => void flush(), 650);
}
async function flush() {
  if (saving.value || conflict.value || !attempt.value || terminal.value)
    return false;
  saving.value = true;
  try {
    while (Object.keys(dirty.value).length) {
      const qid = Object.keys(dirty.value)[0];
      const currentAttempt = attempt.value;
      if (!qid || !currentAttempt) break;
      const selected = [...(dirty.value[qid] || [])];
      const updated: LmsAttempt = await api<LmsAttempt>(
        "/attempts/" +
          encodeURIComponent(currentAttempt.id) +
          "/answers/" +
          encodeURIComponent(qid),
        {
          method: "PUT",
          body: {
            revision: currentAttempt.revision,
            selectedOptionIds: selected,
          },
        },
      );
      attempt.value = updated;
      if (JSON.stringify(dirty.value[qid]) === JSON.stringify(selected)) {
        const next = { ...dirty.value };
        delete next[qid];
        dirty.value = next;
      }
      if (updated.status !== "in_progress") {
        dirty.value = {};
        break;
      }
    }
    failure.value = "";
    return true;
  } catch (e) {
    failure.value = errorText(e);
    conflict.value = lmsErrorStatus(e) === 409;
    return false;
  } finally {
    saving.value = false;
  }
}
async function resolveConflict(keepMine: boolean) {
  if (!attempt.value) return;
  const local = structuredClone(toRaw(dirty.value));
  try {
    const fresh = await api<LmsAttempt>(
      "/attempts/" + encodeURIComponent(attempt.value.id),
    );
    install(fresh);
    if (keepMine && fresh.status === "in_progress") {
      draft.value = { ...draft.value, ...local };
      dirty.value = local;
      await flush();
    }
  } catch (e) {
    failure.value = errorText(e);
  }
}
async function submit() {
  if (!attempt.value || submitting.value || saving.value || conflict.value)
    return;
  submitting.value = true;
  try {
    if (unsaved.value && !(await flush())) return;
    const result = await api<LmsAttempt>(
      "/attempts/" + encodeURIComponent(attempt.value.id) + "/submit",
      { method: "POST", body: {} },
    );
    install(result);
    confirmed.value = false;
  } catch (e) {
    failure.value = errorText(e);
  } finally {
    submitting.value = false;
  }
}
async function checkDeadline() {
  if (finalRefresh || !attempt.value || terminal.value) return;
  finalRefresh = true;
  try {
    const a = await api<LmsAttempt>(
      "/attempts/" + encodeURIComponent(attempt.value.id),
    );
    install(a);
  } catch (e) {
    failure.value = errorText(e);
  }
}
function unload(event: BeforeUnloadEvent) {
  if (unsaved.value || saving.value) {
    event.preventDefault();
    event.returnValue = "";
  }
}
onMounted(() => {
  timer = setInterval(() => {
    now.value = Date.now() + offset.value;
    if (remaining.value === 0) void checkDeadline();
  }, 1000);
  window.addEventListener("beforeunload", unload);
});
onBeforeUnmount(() => {
  if (timer) clearInterval(timer);
  if (debounce) clearTimeout(debounce);
  window.removeEventListener("beforeunload", unload);
});
onBeforeRouteLeave(() => {
  if (unsaved.value || saving.value)
    return window.confirm(
      tr(
        "Есть несохранённые ответы. Покинуть страницу?",
        "Сақталмаған жауаптар бар. Беттен шығасыз ба?",
      ),
    );
});
useHead(() => ({
  title: tr("Проверка знаний — OT Center", "Білімді тексеру — OT Center"),
  meta: [{ name: "robots", content: "noindex, nofollow" }],
}));
</script>
<template>
  <LmsShell
    :title="tr('Проверка знаний', 'Білімді тексеру')"
    :back="'/learn/' + enrollmentId"
    ><LmsState :pending="pending" :error="error" @retry="refresh">
      <div v-if="!attempt" class="lms-card space-y-4">
        <p>
          {{
            tr(
              "У этого назначения пока нет попыток.",
              "Бұл тағайындауда әлі әрекеттер жоқ.",
            )
          }}
        </p>
        <NuxtLink
          class="lms-button"
          :to="path('/learn/' + enrollmentId + '/pre-test')"
          >{{
            tr("Посмотреть условия и начать", "Шарттарды қарап, бастау")
          }}</NuxtLink
        >
      </div>
      <template v-else-if="terminal"
        ><div class="lms-card max-w-3xl space-y-5">
          <p class="text-sm text-slate-500">
            {{ date(attempt.result?.gradedAt || attempt.deadlineAt) }}
          </p>
          <h2 class="text-2xl font-bold">
            {{
              attempt.result?.pass
                ? tr("Проверка знаний пройдена", "Білімді тексеруден өттіңіз")
                : tr(
                    "Проверка знаний не пройдена",
                    "Білімді тексеруден өтпедіңіз",
                  )
            }}
          </h2>
          <p v-if="attempt.result" class="text-lg">
            {{ tr("Результат", "Нәтиже") }}: {{ attempt.result.score }}% ·
            {{ attempt.result.correct }} / {{ attempt.result.total }}
          </p>
          <p v-if="attempt.status === 'expired'" class="lms-note">
            {{
              tr(
                "Время попытки истекло. Учтены ответы, принятые сервером до окончания.",
                "Әрекет уақыты аяқталды. Мерзім аяқталғанша сервер қабылдаған жауаптар есептелді.",
              )
            }}
          </p>
          <div v-if="attempt.result?.topics?.length" class="space-y-3">
            <h3 class="font-semibold">
              {{ tr("Результаты по темам", "Тақырыптар бойынша нәтижелер") }}
            </h3>
            <div
              v-for="topic in attempt.result.topics"
              :key="topic.topic"
              class="flex justify-between gap-3 rounded-lg border p-3"
            >
              <span>{{ topic.topic }}</span
              ><span>{{ topic.correct }} / {{ topic.total }}</span>
            </div>
          </div>
          <p v-if="attempt.result?.pass" class="lms-success">
            {{
              tr(
                "Результат сохранён. Статус оформления документов доступен в личном кабинете.",
                "Нәтиже сақталды. Құжаттарды рәсімдеу күйі жеке кабинетте қолжетімді.",
              )
            }}
          </p>
          <div class="flex flex-wrap gap-3">
            <NuxtLink class="lms-button" :to="path('/cabinet')">{{
              tr("Открыть личный кабинет", "Жеке кабинетті ашу")
            }}</NuxtLink
            ><NuxtLink
              v-if="!attempt.result?.pass"
              class="lms-button secondary"
              :to="path('/learn/' + enrollmentId)"
              >{{
                tr("Повторить материалы", "Материалдарды қайталау")
              }}</NuxtLink
            ><NuxtLink
              v-if="!attempt.result?.pass"
              :to="path('/learn/' + enrollmentId + '/pre-test')"
              class="lms-button secondary"
              >{{
                tr("Условия следующей попытки", "Келесі әрекет шарттары")
              }}</NuxtLink
            >
          </div>
        </div></template
      >
      <div v-else-if="resultOnly" class="lms-note space-y-4">
        <p>
          {{
            tr(
              "Попытка ещё не завершена. Итог появится после её отправки или окончания времени.",
              "Әрекет әлі аяқталмады. Нәтиже жіберілгеннен немесе уақыт аяқталғаннан кейін пайда болады.",
            )
          }}
        </p>
        <NuxtLink
          class="lms-button"
          :to="{
            path: path('/learn/' + enrollmentId + '/exam'),
            query: { attempt: attempt.id },
          }"
          >{{ tr("Вернуться к попытке", "Әрекетке оралу") }}</NuxtLink
        >
      </div>
      <template v-else
        ><div
          class="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white px-4 py-3 shadow-sm"
        >
          <span
            class="font-mono text-xl font-bold"
            :class="remaining < 60 ? 'text-rose-800' : 'text-brand'"
            role="timer"
            aria-live="off"
            >{{ timeLabel }}</span
          ><span class="text-sm"
            >{{ tr("Отвечено", "Жауап берілді") }} {{ answered }} /
            {{ attempt.questions.length }}</span
          ><span class="text-sm" role="status" aria-live="polite">{{
            saving
              ? tr("Сохраняем ответы…", "Жауаптар сақталуда…")
              : unsaved
                ? tr("Есть несохранённые ответы", "Сақталмаған жауаптар бар")
                : tr("Все ответы сохранены", "Барлық жауаптар сақталды")
          }}</span>
        </div>
        <div v-if="failure" class="lms-error space-y-3" role="alert">
          <p>{{ failure }}</p>
          <p v-if="conflict">
            {{
              tr(
                "Другой сеанс изменил попытку. Выберите, какие ответы оставить. Ваши несохранённые ответы пока остаются в этой вкладке.",
                "Басқа сеанс әрекетті өзгертті. Қай жауаптарды сақтау керегін таңдаңыз. Сақталмаған жауаптарыңыз осы қойындыда қалды.",
              )
            }}
          </p>
          <div class="flex flex-wrap gap-3">
            <template v-if="conflict"
              ><button
                class="lms-button secondary"
                @click="resolveConflict(false)"
              >
                {{
                  tr(
                    "Принять ответы с сервера",
                    "Сервердегі жауаптарды қабылдау",
                  )
                }}</button
              ><button class="lms-button" @click="resolveConflict(true)">
                {{
                  tr(
                    "Заменить изменённые ответы моими",
                    "Өзгерген жауаптарды менің жауаптарыммен ауыстыру",
                  )
                }}
              </button></template
            ><button
              v-else
              class="lms-button secondary"
              :disabled="saving"
              @click="remaining ? flush() : refresh()"
            >
              {{ tr("Повторить запрос", "Сұрауды қайталау") }}
            </button>
          </div>
        </div>
        <div v-if="!remaining" class="lms-note" role="status">
          {{
            tr(
              "Время закончилось. Запрашиваем итог попытки…",
              "Уақыт аяқталды. Әрекет нәтижесі сұралуда…",
            )
          }}
        </div>
        <nav
          class="flex flex-wrap gap-2"
          :aria-label="tr('Вопросы экзамена', 'Емтихан сұрақтары')"
        >
          <button
            v-for="(q, index) in attempt.questions"
            :key="q.id"
            class="h-11 min-w-[44px] rounded-lg border px-3 text-sm"
            :class="
              active === index
                ? 'border-brand-accent bg-brand-accent text-white'
                : draft[q.id]?.length
                  ? 'border-brand-accent bg-brand-soft'
                  : 'bg-white border-slate-300'
            "
            :aria-current="active === index ? 'step' : undefined"
            :aria-label="
              tr('Вопрос ', 'Сұрақ ') +
              (index + 1) +
              (draft[q.id]?.length ? tr(', есть ответ', ', жауап бар') : '')
            "
            @click="active = index"
          >
            {{ index + 1 }}
          </button>
        </nav>
        <section v-if="question" class="lms-card space-y-5">
          <h2 class="text-xl font-semibold">
            {{ active + 1 }}. {{ question.text }}
          </h2>
          <p class="text-sm text-slate-600">
            {{
              tr(
                "Отметьте все подходящие варианты ответа.",
                "Барлық сәйкес жауап нұсқаларын белгілеңіз.",
              )
            }}
          </p>
          <fieldset
            class="space-y-3"
            :disabled="!remaining || submitting || !!terminal"
          >
            <legend class="sr-only">{{ question.text }}</legend>
            <label
              v-for="option in question.options"
              :key="option.id"
              class="flex cursor-pointer items-start gap-3 rounded-xl border p-4"
              :class="
                draft[question.id]?.includes(option.id)
                  ? 'border-brand-accent bg-brand-soft'
                  : 'border-slate-200'
              "
              ><input
                type="checkbox"
                class="mt-1"
                :checked="draft[question.id]?.includes(option.id) || false"
                @change="
                  choose(
                    question.id,
                    option.id,
                    ($event.target as HTMLInputElement).checked,
                  )
                "
              /><span>{{ option.text }}</span></label
            >
          </fieldset>
          <div class="flex flex-wrap justify-between gap-3 pt-3">
            <button
              class="lms-button secondary"
              :disabled="active === 0"
              @click="active--"
            >
              {{ tr("Предыдущий вопрос", "Алдыңғы сұрақ") }}</button
            ><button
              class="lms-button secondary"
              :disabled="active === attempt.questions.length - 1"
              @click="active++"
            >
              {{ tr("Следующий вопрос", "Келесі сұрақ") }}
            </button>
          </div>
        </section>
        <div class="lms-card space-y-4">
          <h2 class="font-semibold">
            {{ tr("Завершение попытки", "Әрекетті аяқтау") }}
          </h2>
          <p
            v-if="answered < attempt.questions.length"
            class="text-sm text-slate-600"
          >
            {{ tr("Без ответа осталось:", "Жауапсыз қалды:") }}
            {{ attempt.questions.length - answered }}
          </p>
          <label class="flex items-start gap-3"
            ><input v-model="confirmed" type="checkbox" class="mt-1" /><span>{{
              tr(
                "Завершить попытку сейчас. После отправки ответы изменить нельзя.",
                "Әрекетті қазір аяқтау. Жібергеннен кейін жауаптарды өзгерту мүмкін емес.",
              )
            }}</span></label
          ><button
            class="lms-button"
            :disabled="
              !confirmed || submitting || saving || conflict || !remaining
            "
            @click="submit"
          >
            {{
              submitting
                ? tr("Отправляем попытку…", "Әрекет жіберілуде…")
                : tr(
                    "Отправить ответы и завершить попытку",
                    "Жауаптарды жіберіп, әрекетті аяқтау",
                  )
            }}
          </button>
        </div>
      </template></LmsState
    ></LmsShell
  >
</template>
