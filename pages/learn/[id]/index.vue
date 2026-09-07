<script setup lang="ts">
const route = useRoute();
const path = useLocalePath();
const { api, tr, errorText } = useLmsApi();
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
async function openLesson(lessonId: string) {
  selected.value = lessonId;
  loadingLesson.value = true;
  lessonError.value = null;
  lessonData.value = null;
  saveError.value = "";
  saveMessage.value = "";
  try {
    const result = await api(
      "/enrollments/" +
        encodeURIComponent(id) +
        "/lessons/" +
        encodeURIComponent(lessonId),
    );
    if (selected.value === lessonId) lessonData.value = result;
  } catch (e) {
    if (selected.value === lessonId) lessonError.value = e;
  } finally {
    if (selected.value === lessonId) loadingLesson.value = false;
  }
}
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
  if (!current.value || saving.value) return;
  saving.value = true;
  saveError.value = "";
  try {
    await api(
      "/enrollments/" +
        encodeURIComponent(id) +
        "/progress/" +
        encodeURIComponent(current.value.id),
      {
        method: "PUT",
        body: { revision: lessonData.value.progress.revision, completed: true },
      },
    );
    await refresh();
    await openLesson(selected.value);
    saveMessage.value = tr(
      "Завершение урока сохранено.",
      "Сабақты аяқтау сақталды.",
    );
  } catch (e) {
    saveError.value = errorText(e);
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
        <div class="lms-note flex flex-wrap justify-between gap-3">
          <span
            >{{ tr("Подтверждённый прогресс", "Расталған оқу барысы") }}:
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
        <div class="grid items-start gap-6 lg:grid-cols-[290px_1fr]">
          <aside class="lms-card space-y-5">
            <h2 class="font-bold">{{ tr("Содержание", "Мазмұны") }}</h2>
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
                @click="openLesson(l.id)"
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
          <article class="lms-card min-w-0 space-y-6">
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
              ><template v-if="lessonData"
                ><h2 class="font-headline text-2xl font-bold">
                  {{ lessonData.lesson.title }}
                </h2>
                <p class="whitespace-pre-wrap leading-7 text-slate-700">
                  {{ lessonData.lesson.body }}
                </p>
                <div
                  v-for="(media, index) in lessonData.lesson.media"
                  :key="index"
                  class="space-y-3"
                >
                  <img
                    v-if="media.kind === 'image'"
                    :src="media.url"
                    :alt="media.alt"
                    class="max-w-full rounded-xl"
                    loading="lazy"
                  /><video
                    v-if="media.kind === 'video'"
                    :src="media.url"
                    controls
                    preload="metadata"
                    class="w-full rounded-xl"
                    :aria-label="media.alt"
                  />
                  <details
                    v-if="media.transcript"
                    class="rounded-xl border p-4"
                  >
                    <summary class="cursor-pointer font-semibold">
                      {{
                        tr(
                          "Текстовая расшифровка видео",
                          "Бейненің мәтіндік нұсқасы",
                        )
                      }}
                    </summary>
                    <p class="mt-3 whitespace-pre-wrap text-sm leading-6">
                      {{ media.transcript }}
                    </p>
                  </details>
                  <a
                    v-if="media.kind === 'attachment'"
                    :href="media.url"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="lms-button secondary"
                    >{{
                      media.alt || tr("Открыть вложение", "Тіркемені ашу")
                    }}
                    ↗</a
                  >
                </div>
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
                      "Урок завершён. Прогресс сохранён на сервере.",
                      "Сабақ аяқталды. Оқу барысы серверде сақталды.",
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
