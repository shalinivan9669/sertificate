<script setup lang="ts">
const route = useRoute();
const path = useLocalePath();
const router = useRouter();
const { api, tr, errorText } = useLmsApi();
const { track } = useLmsAnalytics();
let viewedLesson = '';
const id = String(route.params.id);
const { data, pending, error, refresh } = await useAsyncData(
  "lms-enrollment-" + id,
  () => api<any>("/enrollments/" + encodeURIComponent(id)),
);
const enrollment = computed<LmsEnrollment | undefined>(
  () => data.value?.enrollment || data.value,
);
const selected = ref(
  typeof route.query.lesson === "string" ? route.query.lesson : "",
);
const lessonData = ref<any>(null);
const loadingLesson = ref(false);
const lessonError = ref<any>(null);
const saving = ref(false);
const saveError = ref("");
const saveMessage = ref("");
const lessons = computed(
  () => enrollment.value?.modules?.flatMap((m) => m.lessons) || [],
);
const current = computed(() =>
  lessons.value.find((l) => l.id === selected.value),
);
const currentIndex = computed(() => lessons.value.findIndex(l => l.id === selected.value));
const nextLesson = computed(() => currentIndex.value >= 0 ? lessons.value[currentIndex.value + 1] : undefined);
watch(() => route.query.lesson, value => {
  if (typeof value === 'string' && value !== selected.value && lessons.value.some(l => l.id === value)) void openLesson(value, true);
});
const lessonArticle = ref<HTMLElement | null>(null);
const contentsHeading = ref<HTMLElement | null>(null);
let lessonRequest = 0;
let requestedFocus = 0;
function focusContent(element: HTMLElement | null | undefined) {
  element?.focus({ preventScroll: true });
  element?.scrollIntoView({ block: "start", behavior: "instant" });
}
function returnToContents() {
  requestedFocus = 0;
  focusContent(contentsHeading.value);
}
async function openLesson(lessonId: string, focusAfterLoad = false) {
  const request = ++lessonRequest;
  requestedFocus = focusAfterLoad ? request : 0;
  selected.value = lessonId;
  if (import.meta.client && focusAfterLoad && route.query.lesson !== lessonId) {
    void router.push({ path: route.path, query: { ...route.query, lesson: lessonId }, hash: route.hash });
  }
  loadingLesson.value = true;
  lessonError.value = null;
  lessonData.value = null;
  saveError.value = "";
  saveMessage.value = "";
  try {
    const result = await api<any>(
      "/enrollments/" +
        encodeURIComponent(id) +
        "/lessons/" +
        encodeURIComponent(lessonId),
    );
    if (request === lessonRequest) {
      // A read begun before a save committed must not undo its acknowledged progress.
      const saved = lessons.value.find((lesson) => lesson.id === lessonId);
      if (saved && (saved.revision || 0) > result.progress.revision)
        result.progress = { completed: Boolean(saved.completed), revision: saved.revision };
      lessonData.value = result;
    }
  } catch (e) {
    if (request === lessonRequest) lessonError.value = e;
  } finally {
    if (request === lessonRequest) loadingLesson.value = false;
  }
  if (request === lessonRequest && requestedFocus === request && !lessonError.value) {
    await nextTick();
    // A newer choice, return to contents or unmount cancels the pending focus move.
    if (request === lessonRequest && requestedFocus === request) {
      requestedFocus = 0;
      focusContent(lessonArticle.value?.querySelector<HTMLElement>("h2"));
    }
  }
}
onBeforeUnmount(() => { lessonRequest++; });
onMounted(() => {
  watch(() => [lessonData.value?.lesson?.id, loadingLesson.value], () => {
    const lessonId = lessonData.value?.lesson?.id;
    if (lessonId && !loadingLesson.value && viewedLesson !== lessonId) {
      viewedLesson = lessonId;
      track('lesson_open', { programId: enrollment.value?.programId });
    }
  }, { immediate: true });
});
watch(
  lessons,
  (items) => {
    if (items.length && !lessonData.value && !loadingLesson.value)
      void openLesson(
        items.find((l) => l.id === selected.value)?.id ||
          items.find((l) => !l.completed)?.id ||
          items[0]!.id,
      );
  },
  { immediate: true },
);
async function complete() {
  if (!current.value || saving.value || loadingLesson.value ||
      lessonData.value?.lesson.id !== current.value.id) return;
  const lessonId = current.value.id;
  const request = lessonRequest;
  const revision = lessonData.value.progress.revision;
  saving.value = true;
  saveError.value = "";
  saveMessage.value = "";
  try {
    const updated = await api<any>(
      "/enrollments/" +
        encodeURIComponent(id) +
        "/progress/" +
        encodeURIComponent(lessonId),
      {
        method: "PUT",
        body: { revision, completed: true },
      },
    );
    // Completion already returns the authoritative enrollment, including revisions.
    data.value = updated;
    const saved = lessons.value.find((lesson) => lesson.id === lessonId);
    if (saved && lessonData.value?.lesson.id === lessonId)
      lessonData.value.progress = { completed: Boolean(saved.completed), revision: saved.revision || 0 };
    if (request === lessonRequest)
      saveMessage.value = tr(
        "Завершение урока сохранено.",
        "Сабақты аяқтау сақталды.",
      );
  } catch (e) {
    if (request === lessonRequest) saveError.value = errorText(e);
  } finally {
    saving.value = false;
  }
}
useHead(() => ({
  title: (enrollment.value?.title || tr("Обучение", "Оқу")) + " — OT Center",
  meta: [{ name: "robots", content: "noindex, nofollow" }],
}));
</script>
<template>
  <LmsShell :title="enrollment?.title || tr('Обучение', 'Оқу')" back="/cabinet"
    ><LmsState :pending="pending" :error="error" @retry="refresh"
      ><template v-if="enrollment">
        <div class="ed-learning-progress">
          <EditorialProgress :value="enrollment.progress.percent" :label="tr('Ваш прогресс', 'Сіздің оқу барысыңыз')" />
          <span
            >{{ tr("Изучено уроков", "Оқылған сабақтар") }}:
            {{ enrollment.progress.completed }} /
            {{ enrollment.progress.total }} ·
            {{ enrollment.progress.percent }}%</span
          ><NuxtLink :to="path('/learn/' + id + '/pre-test')"
            >{{
              tr("Условия проверки знаний", "Білімді тексеру шарттары")
            }}
            →</NuxtLink
          >
        </div>
        <div class="ed-learning-layout">
          <aside class="lms-card ed-learning-contents space-y-5" aria-labelledby="lesson-contents">
            <h2 id="lesson-contents" ref="contentsHeading" tabindex="-1" class="scroll-mt-4 font-bold">{{ tr("Содержание", "Мазмұны") }}</h2>
            <section
              v-for="m in enrollment.modules"
              :key="m.id"
              class="space-y-2"
            >
              <h3 class="text-sm font-semibold text-slate-700">
                {{ m.title }}
              </h3>
              <button
                v-for="l in m.lessons"
                :key="l.id"
                class="flex min-h-[44px] w-full items-start gap-2 rounded-lg px-3 py-3 text-left text-sm"
                :class="
                  selected === l.id
                    ? 'bg-brand-soft text-brand-accent font-semibold'
                    : 'hover:bg-slate-50'
                "
                :aria-current="selected === l.id ? 'true' : undefined"
                @click="openLesson(l.id, true)"
              >
                <span aria-hidden="true">{{ l.completed ? "✓" : "○" }}</span
                ><span
                  >{{ l.title
                  }}<small class="block text-slate-500">{{
                    l.completed
                      ? tr("Сохранено", "Сақталды")
                      : l.required
                        ? tr("Обязательный урок", "Міндетті сабақ")
                        : tr("Дополнительный материал", "Қосымша материал")
                  }}</small></span
                >
              </button>
            </section>
          </aside>
          <article ref="lessonArticle" class="lms-card ed-learning-article min-w-0 space-y-6">
            <p class="ed-lesson-position">{{ tr('Урок', 'Сабақ') }} {{ currentIndex + 1 }} {{ tr('из', '/') }} {{ lessons.length }}</p>
            <a href="#lesson-contents" class="lms-button secondary" @click.prevent="returnToContents">
              {{ tr("К содержанию", "Мазмұнға") }}
            </a>
            <LmsState
              :pending="loadingLesson"
              :error="lessonError"
              :empty="!lessons.length"
              :empty-text="
                tr(
                  'Материалы назначения пока недоступны. Свяжитесь с учебным центром.',
                  'Тағайындалған оқу материалдары әзірге қолжетімсіз. Оқу орталығына хабарласыңыз.',
                )
              "
              @retry="openLesson(selected)"
              ><template v-if="lessonData">
                <LmsLessonContent :lesson="lessonData.lesson" :heading-tabindex="-1" />
                <div
                  v-if="lessonData.lesson.kind === 'practice'"
                  class="lms-note"
                >
                  {{
                    tr(
                      "Практическую часть подтверждает уполномоченный сотрудник после выполнения.",
                      "Практикалық бөлім орындалғаннан кейін уәкілетті қызметкер растайды.",
                    )
                  }}
                </div>
                <p
                  v-else-if="lessonData.progress.completed"
                  class="lms-success"
                >
                  {{
                    tr(
                      "Урок завершён. Ваш прогресс сохранён.",
                      "Сабақ аяқталды. Оқу барысыңыз сақталды.",
                    )
                  }}
                </p>
                <button
                  v-else
                  class="lms-button"
                  :disabled="saving"
                  @click="complete"
                >
                  {{
                    saving
                      ? tr("Сохраняем…", "Сақталуда…")
                      : tr(
                          "Материал изучен — завершить урок",
                          "Материал оқылды — сабақты аяқтау",
                        )
                  }}
                </button>
                <nav class="ed-lesson-next" :aria-label="tr('Продолжить обучение', 'Оқуды жалғастыру')">
                  <button v-if="nextLesson" class="lms-button secondary" :disabled="saving" @click="openLesson(nextLesson.id, true)"><span>{{ tr('Следующий урок', 'Келесі сабақ') }}<small>{{ nextLesson.title }}</small></span><CivicIcon name="arrow" /></button>
                  <NuxtLink v-else :to="path('/learn/' + id + '/pre-test')" class="lms-button secondary">{{ tr('Перейти к условиям проверки', 'Тексеру шарттарына өту') }}<CivicIcon name="arrow" /></NuxtLink>
                  <p>{{ tr('Переход дальше не отмечает урок завершённым.', 'Келесі сабаққа өту бұл сабақты аяқталған деп белгілемейді.') }}</p>
                </nav>
                <p v-if="saveMessage" class="lms-success" role="status">
                  {{ saveMessage }}
                </p>
                <div v-if="saveError" class="lms-error space-y-3" role="alert">
                  <p>
                    {{ saveError }}
                    {{
                      tr("Завершение не подтверждено.", "Аяқтау расталмады.")
                    }}
                  </p>
                  <button
                    class="lms-button secondary"
                    :disabled="saving"
                    @click="openLesson(selected)"
                  >
                    {{
                      tr(
                        "Загрузить актуальный прогресс",
                        "Ағымдағы оқу барысын жүктеу",
                      )
                    }}
                  </button>
                </div></template
              ></LmsState
            >
          </article>
        </div>
      </template></LmsState
    ></LmsShell
  >
</template>
