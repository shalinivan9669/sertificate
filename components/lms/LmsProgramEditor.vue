<script setup lang="ts">
const props = defineProps<{
  version?: any;
  actorRole?: string;
  actorId?: string;
}>();
const emit = defineEmits(["saved"]);
const { api, tr, locale, errorText } = useLmsApi();
const busy = ref(false);
const failure = ref("");
const message = ref("");
const evidence = ref("");
const approved = ref(false);
const programId = ref("");
const current = ref<any>(null);
const sources = ref("");
const price = ref<number | null>(null);
const blank = () => ({
  title: "",
  language: "ru",
  audience: "",
  prerequisites: "",
  outcomes: "",
  limitations: "",
  format: "",
  durationHours: 1,
  priceMinor: null,
  currency: "KZT",
  accessModel: "manual",
  billingBasis: "learner",
  documentDescription: "",
  support: "",
  sourceRefs: [],
  reviewedAt: "",
  modules: [] as any[],
  assessment: {
    durationMinutes: 1,
    maxAttempts: 1,
    passPercent: 100,
    questionCount: 1,
    retakeDelayMinutes: 0,
  },
  questions: [] as any[],
});
const form = ref<any>(blank());
function load(version: any) {
  current.value = version || null;
  form.value = version ? structuredClone(toRaw(version.data)) : blank();
  form.value.billingBasis ||= "learner";
  programId.value = version?.programId || "";
  sources.value = form.value.sourceRefs.join("\n");
  price.value =
    form.value.priceMinor == null ? null : form.value.priceMinor / 100;
  failure.value = "";
  message.value = "";
  approved.value = false;
}
watch(
  () => props.version,
  (version) => {
    if (
      version &&
      current.value &&
      version.id === current.value.id &&
      version.revision === current.value.revision
    )
      return;
    load(version);
  },
  { immediate: true },
);
const readOnly = computed(() => current.value?.status === "published");
const canEdit = computed(() =>
  ["editor", "admin"].includes(props.actorRole || ""),
);
const canPublish = computed(
  () =>
    ["reviewer", "admin"].includes(props.actorRole || "") &&
    current.value?.createdBy !== props.actorId,
);
const payload = computed(() => ({
  ...form.value,
  priceMinor:
    price.value == null || String(price.value) === ""
      ? null
      : Math.round(Number(price.value) * 100),
  sourceRefs: sources.value
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean),
}));
const unsaved = computed(
  () =>
    !current.value ||
    JSON.stringify(payload.value) !==
      JSON.stringify({
        ...current.value.data,
        billingBasis: current.value.data.billingBasis || "learner",
      }),
);
const fields = computed(() => [
  { key: "audience", label: tr("Аудитория", "Аудитория") },
  {
    key: "prerequisites",
    label: tr("Предварительные требования", "Алдын ала талаптар"),
  },
  { key: "outcomes", label: tr("Результаты обучения", "Оқу нәтижелері") },
  {
    key: "limitations",
    label: tr("Ограничения результата", "Нәтиже шектеулері"),
  },
  {
    key: "documentDescription",
    label: tr(
      "Порядок оформления и вид документа",
      "Рәсімдеу тәртібі және құжат түрі",
    ),
  },
  { key: "support", label: tr("Поддержка и контакты", "Қолдау және байланыс") },
]);
const assessmentFields = computed(() => [
  {
    key: "durationMinutes",
    label: tr("Длительность попытки, мин", "Әрекет ұзақтығы, мин"),
    min: 1,
  },
  {
    key: "maxAttempts",
    label: tr("Максимум попыток", "Әрекеттер саны"),
    min: 1,
  },
  { key: "passPercent", label: tr("Порог, %", "Шек, %"), min: 1, max: 100 },
  {
    key: "questionCount",
    label: tr("Вопросов в попытке", "Әрекеттегі сұрақтар"),
    min: 1,
  },
  {
    key: "retakeDelayMinutes",
    label: tr(
      "Пауза перед пересдачей, мин",
      "Қайта тапсыру алдындағы үзіліс, мин",
    ),
    min: 0,
  },
]);
function addModule() {
  form.value.modules.push({ id: crypto.randomUUID(), title: "", lessons: [] });
}
function addLesson(module: any) {
  module.lessons.push({
    id: crypto.randomUUID(),
    title: "",
    kind: "text",
    required: true,
    body: "",
    media: [],
  });
}
function addOption(question: any) {
  question.options.push({ id: crypto.randomUUID(), text: "" });
}
function addQuestion() {
  form.value.questions.push({
    id: crypto.randomUUID(),
    text: "",
    topic: "",
    options: [
      { id: crypto.randomUUID(), text: "" },
      { id: crypto.randomUUID(), text: "" },
    ],
    correctOptionIds: [],
  });
}
function copyVersion() {
  current.value = null;
  message.value = tr(
    "Создаётся новая версия на основе выбранной. Существующие назначения не изменятся.",
    "Таңдалған нұсқа негізінде жаңа нұсқа жасалады. Қолданыстағы тағайындаулар өзгермейді.",
  );
}
async function save() {
  if (busy.value) return;
  busy.value = true;
  failure.value = "";
  message.value = "";
  try {
    const data = payload.value;
    const result = await api<any>(
      "/admin/program-versions" + (current.value ? "/" + current.value.id : ""),
      {
        method: current.value ? "PATCH" : "POST",
        body: current.value
          ? { revision: current.value.revision, data }
          : { programId: programId.value, data },
      },
    );
    load(result.version);
    message.value = tr("Черновик сохранён.", "Жоба сақталды.");
    emit("saved", result.version);
  } catch (e) {
    failure.value = errorText(e);
  } finally {
    busy.value = false;
  }
}
async function workflow(action: "review" | "publish") {
  if (!current.value || unsaved.value) return;
  busy.value = true;
  failure.value = "";
  message.value = "";
  try {
    const result = await api<any>(
      "/admin/program-versions/" + current.value.id + "/" + action,
      {
        method: "POST",
        body:
          action === "publish"
            ? { revision: current.value.revision, evidence: evidence.value }
            : { revision: current.value.revision },
      },
    );
    current.value = result.version;
    message.value =
      action === "publish"
        ? tr(
            "Версия опубликована для новых назначений.",
            "Нұсқа жаңа тағайындаулар үшін жарияланды.",
          )
        : tr("Версия передана на проверку.", "Нұсқа тексеруге берілді.");
    emit("saved", result.version);
  } catch (e) {
    failure.value = errorText(e);
  } finally {
    busy.value = false;
  }
}
</script>
<template>
  <section class="lms-card space-y-6">
    <div class="flex flex-wrap items-start justify-between gap-4">
      <h2 class="text-2xl font-bold">
        {{
          current
            ? tr("Редактор версии", "Нұсқа редакторы")
            : tr("Новая версия программы", "Бағдарламаның жаңа нұсқасы")
        }}
      </h2>
      <button
        v-if="current && canEdit"
        class="lms-button secondary"
        :disabled="busy"
        @click="copyVersion"
      >
        {{ tr("Создать новую редакцию", "Жаңа редакция жасау") }}
      </button>
    </div>
    <p v-if="readOnly" class="lms-note">
      {{
        tr(
          "Опубликованная версия неизменяема. Для обновления создайте новую редакцию.",
          "Жарияланған нұсқа өзгермейді. Жаңарту үшін жаңа редакция жасаңыз.",
        )
      }}
    </p>
    <form class="space-y-6" @submit.prevent="save">
      <fieldset class="space-y-6" :disabled="readOnly || busy || !canEdit">
        <div class="grid gap-5 md:grid-cols-2">
          <label class="space-y-2"
            ><span>{{ tr("Направление", "Бағыт") }}</span
            ><select v-model="programId" required :disabled="!!current">
              <option value="" disabled>
                {{ tr("Выберите направление", "Бағытты таңдаңыз") }}
              </option>
              <option v-for="d in LMS_DIRECTIONS" :key="d.id" :value="d.id">
                {{ locale === "kk" ? d.kk : d.ru }}
              </option>
            </select></label
          ><label class="space-y-2"
            ><span>{{ tr("Название программы", "Бағдарлама атауы") }}</span
            ><input v-model="form.title" required maxlength="300" /></label
          ><label class="space-y-2"
            ><span>{{ tr("Язык версии", "Нұсқа тілі") }}</span
            ><select v-model="form.language">
              <option value="ru">Русский</option>
              <option value="kk">Қазақша</option>
            </select></label
          ><label class="space-y-2"
            ><span>{{ tr("Формат и практика", "Формат және практика") }}</span
            ><input v-model="form.format" maxlength="300" /></label
          ><label class="space-y-2"
            ><span>{{
              tr("Утверждённый объём, часы", "Бекітілген көлем, сағат")
            }}</span
            ><input
              v-model.number="form.durationHours"
              type="number"
              min="1"
              max="5000"
              required /></label
          ><label class="space-y-2"
            ><span>{{
              tr("Дата проверки содержания", "Мазмұнды тексеру күні")
            }}</span
            ><input v-model="form.reviewedAt" type="date" /></label
          ><label class="space-y-2"
            ><span>{{ tr("Модель доступа", "Қолжетімділік моделі") }}</span
            ><select v-model="form.accessModel">
              <option value="manual">
                {{
                  tr(
                    "Подтверждает сотрудник центра",
                    "Орталық қызметкері растайды",
                  )
                }}
              </option>
              <option value="free">
                {{ tr("Бесплатная запись", "Тегін тіркелу") }}
              </option>
              <option value="paid">
                {{
                  tr("После подтверждённой оплаты", "Расталған төлемнен кейін")
                }}
              </option>
            </select></label
          ><label class="space-y-2"
            ><span>{{
              tr(
                "Стоимость, ₸ (пусто — по запросу)",
                "Бағасы, ₸ (бос — сұрау бойынша)",
              )
            }}</span
            ><input
              v-model.number="price"
              type="number"
              min="0"
              max="10000000"
              step="0.01"
          /></label>
        </div>
        <label class="block space-y-2">
          <span>{{ tr("Единица расчёта", "Есептеу бірлігі") }}</span>
          <select v-model="form.billingBasis" required>
            <option value="learner">
              {{ tr("На одного слушателя", "Бір тыңдаушыға") }}
            </option>
            <option value="organization">
              {{
                tr(
                  "На организацию: общая стоимость для выбранной команды",
                  "Ұйымға: таңдалған команда үшін жалпы құн",
                )
              }}
            </option>
          </select>
        </label>
        <LmsAuthoringGuide
          v-if="programId"
          :key="programId"
          :program-id="programId"
        />
        <div class="grid gap-5 md:grid-cols-2">
          <label v-for="f in fields" :key="f.key" class="space-y-2"
            ><span>{{ f.label }}</span
            ><textarea v-model="form[f.key]" rows="3" maxlength="10000" />
          </label>
        </div>
        <label class="block space-y-2"
          ><span>{{
            tr("Источники — один на строку", "Дереккөздер — әр жолға біреу")
          }}</span
          ><textarea v-model="sources" rows="3" />
        </label>
        <section class="space-y-5">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <h3 class="text-xl font-bold">
              {{ tr("Модули и уроки", "Модульдер мен сабақтар") }}
            </h3>
            <button
              class="lms-button secondary"
              type="button"
              @click="addModule"
            >
              {{ tr("Добавить модуль", "Модуль қосу") }}
            </button>
          </div>
          <p v-if="!form.modules.length" class="lms-note">
            {{
              tr(
                "Добавьте утверждённые учебные материалы. Черновик без модулей нельзя опубликовать.",
                "Бекітілген оқу материалдарын қосыңыз. Модульсіз жобаны жариялау мүмкін емес.",
              )
            }}
          </p>
          <details
            v-for="(m, mi) in form.modules"
            :key="m.id"
            open
            class="rounded-xl border p-4"
          >
            <summary class="cursor-pointer font-semibold">
              {{ Number(mi) + 1 }}.
              {{ m.title || tr("Новый модуль", "Жаңа модуль") }}
            </summary>
            <div class="mt-4 space-y-5">
              <label class="block space-y-2"
                ><span>{{ tr("Название модуля", "Модуль атауы") }}</span
                ><input v-model="m.title" required maxlength="300"
              /></label>
              <article
                v-for="(l, li) in m.lessons"
                :key="l.id"
                class="space-y-4 rounded-lg border bg-slate-50 p-4"
              >
                <label class="block space-y-2"
                  ><span>{{ tr("Название урока", "Сабақ атауы") }}</span
                  ><input v-model="l.title" required maxlength="300"
                /></label>
                <div class="flex flex-wrap gap-5">
                  <label
                    ><span class="mb-2 block">{{ tr("Тип", "Түрі") }}</span
                    ><select v-model="l.kind">
                      <option value="text">
                        {{ tr("Учебный материал", "Оқу материалы") }}
                      </option>
                      <option value="practice">
                        {{
                          tr(
                            "Практика — подтверждает сотрудник",
                            "Практика — қызметкер растайды",
                          )
                        }}
                      </option>
                    </select></label
                  ><label class="flex items-center gap-3"
                    ><input v-model="l.required" type="checkbox" />{{
                      tr("Обязательный", "Міндетті")
                    }}</label
                  >
                </div>
                <label class="block space-y-2"
                  ><span>{{
                    tr(
                      "Текст урока / задание на практику",
                      "Сабақ мәтіні / практикалық тапсырма",
                    )
                  }}</span
                  ><textarea v-model="l.body" rows="8" maxlength="100000" />
                </label>
                <div
                  v-for="(media, mediaIndex) in l.media"
                  :key="mediaIndex"
                  class="space-y-3 rounded-lg border p-3"
                >
                  <label class="block space-y-2"
                    ><span>{{ tr("Тип медиа", "Медиа түрі") }}</span
                    ><select v-model="media.kind">
                      <option value="image">
                        {{ tr("Изображение", "Сурет") }}
                      </option>
                      <option value="video">{{ tr("Видео", "Бейне") }}</option>
                      <option value="attachment">
                        {{ tr("Вложение", "Тіркеме") }}
                      </option>
                    </select></label
                  ><label class="block space-y-2"
                    ><span>HTTPS URL</span
                    ><input v-model="media.url" type="url" required /></label
                  ><label class="block space-y-2"
                    ><span>{{
                      tr(
                        "Описание / название вложения",
                        "Сипаттама / тіркеме атауы",
                      )
                    }}</span
                    ><input v-model="media.alt" /></label
                  ><label v-if="media.kind === 'video'" class="block space-y-2"
                    ><span>{{
                      tr(
                        "Текстовая расшифровка видео",
                        "Бейненің мәтіндік нұсқасы",
                      )
                    }}</span
                    ><textarea v-model="media.transcript" rows="4" /></label
                  ><button
                    class="text-sm text-rose-800 underline"
                    type="button"
                    @click="l.media.splice(mediaIndex, 1)"
                  >
                    {{ tr("Удалить медиа", "Медианы жою") }}
                  </button>
                </div>
                <div class="flex flex-wrap gap-4">
                  <button
                    class="lms-button secondary"
                    type="button"
                    @click="
                      l.media.push({
                        kind: 'image',
                        url: '',
                        alt: '',
                        transcript: '',
                      })
                    "
                  >
                    {{ tr("Добавить медиа", "Медиа қосу") }}</button
                  ><button
                    class="text-sm text-rose-800 underline"
                    type="button"
                    @click="m.lessons.splice(li, 1)"
                  >
                    {{ tr("Удалить урок из черновика", "Сабақты жобадан жою") }}
                  </button>
                </div>
              </article>
              <div class="flex flex-wrap gap-4">
                <button
                  class="lms-button secondary"
                  type="button"
                  @click="addLesson(m)"
                >
                  {{ tr("Добавить урок", "Сабақ қосу") }}</button
                ><button
                  class="text-sm text-rose-800 underline"
                  type="button"
                  @click="form.modules.splice(mi, 1)"
                >
                  {{
                    tr("Удалить модуль из черновика", "Модульді жобадан жою")
                  }}
                </button>
              </div>
            </div>
          </details>
        </section>
        <section class="space-y-5">
          <h3 class="text-xl font-bold">
            {{ tr("Правила проверки знаний", "Білімді тексеру ережелері") }}
          </h3>
          <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <label v-for="f in assessmentFields" :key="f.key" class="space-y-2"
              ><span>{{ f.label }}</span
              ><input
                v-model.number="form.assessment[f.key]"
                required
                type="number"
                :min="f.min"
                :max="f.max || 10000"
            /></label>
          </div>
          <div class="flex flex-wrap items-center justify-between gap-3">
            <h3 class="text-xl font-bold">
              {{ tr("Защищённый банк вопросов", "Қорғалған сұрақтар банкі") }}
            </h3>
            <button
              class="lms-button secondary"
              type="button"
              @click="addQuestion"
            >
              {{ tr("Добавить вопрос", "Сұрақ қосу") }}
            </button>
          </div>
          <details
            v-for="(q, qi) in form.questions"
            :key="q.id"
            class="rounded-xl border p-4"
          >
            <summary class="cursor-pointer font-semibold">
              {{ Number(qi) + 1 }}.
              {{ q.text || tr("Новый вопрос", "Жаңа сұрақ") }}
            </summary>
            <div class="mt-4 space-y-4">
              <label class="block space-y-2"
                ><span>{{ tr("Формулировка", "Сұрақ мәтіні") }}</span
                ><textarea v-model="q.text" required rows="3" /></label
              ><label class="block space-y-2"
                ><span>{{ tr("Тема", "Тақырып") }}</span
                ><input v-model="q.topic" required
              /></label>
              <p class="text-sm text-slate-600">
                {{
                  tr(
                    "Отметьте правильные варианты. Ключи доступны только уполномоченным сотрудникам.",
                    "Дұрыс нұсқаларды белгілеңіз. Жауап кілттері тек уәкілетті қызметкерлерге қолжетімді.",
                  )
                }}
              </p>
              <div
                v-for="(o, oi) in q.options"
                :key="o.id"
                class="flex items-start gap-3"
              >
                <input
                  v-model="q.correctOptionIds"
                  type="checkbox"
                  :value="o.id"
                  class="mt-3"
                  :aria-label="
                    tr('Правильный вариант ', 'Дұрыс нұсқа ') + (Number(oi) + 1)
                  "
                /><input
                  v-model="o.text"
                  required
                  :aria-label="
                    tr('Вариант ответа ', 'Жауап нұсқасы ') + (Number(oi) + 1)
                  "
                /><button
                  class="min-h-[44px] px-2 text-rose-800"
                  type="button"
                  :disabled="q.options.length <= 2"
                  :aria-label="tr('Удалить вариант', 'Нұсқаны жою')"
                  @click="
                    q.correctOptionIds = q.correctOptionIds.filter(
                      (id: string) => id !== o.id,
                    );
                    q.options.splice(oi, 1);
                  "
                >
                  ×
                </button>
              </div>
              <div class="flex flex-wrap gap-4">
                <button
                  class="lms-button secondary"
                  type="button"
                  @click="addOption(q)"
                >
                  {{ tr("Добавить вариант", "Нұсқа қосу") }}</button
                ><button
                  class="text-sm text-rose-800 underline"
                  type="button"
                  @click="form.questions.splice(qi, 1)"
                >
                  {{ tr("Удалить вопрос", "Сұрақты жою") }}
                </button>
              </div>
            </div>
          </details>
        </section>
        <button v-if="canEdit" class="lms-button" type="submit">
          {{
            busy
              ? tr("Сохраняем…", "Сақталуда…")
              : tr("Сохранить черновик", "Жобаны сақтау")
          }}
        </button>
      </fieldset>
    </form>
    <div v-if="current && !readOnly" class="space-y-4 border-t pt-5">
      <p v-if="unsaved" class="lms-note">
        {{
          tr(
            "Есть несохранённые изменения. Сохраните черновик перед проверкой или публикацией.",
            "Сақталмаған өзгерістер бар. Тексеру немесе жариялау алдында жобаны сақтаңыз.",
          )
        }}
      </p>
      <button
        v-if="current.status === 'draft' && canEdit"
        class="lms-button secondary"
        :disabled="busy || unsaved"
        @click="workflow('review')"
      >
        {{
          tr(
            "Проверить полноту и передать на рецензию",
            "Толықтығын тексеріп, рецензияға жіберу",
          )
        }}</button
      ><template v-if="current.status === 'review' && canPublish"
        ><p class="lms-note">
          {{
            tr(
              "Публикацию подтверждает другой уполномоченный рецензент. Все изменения черновика требуют повторной проверки.",
              "Жариялауды басқа уәкілетті рецензент растайды. Жобадағы барлық өзгерістер қайта тексеруді қажет етеді.",
            )
          }}
        </p>
        <label class="block space-y-2"
          ><span>{{
            tr(
              "Основание утверждения / ссылка на решение",
              "Бекіту негізі / шешімге сілтеме",
            )
          }}</span
          ><textarea v-model="evidence" rows="3" maxlength="4000" /></label
        ><label class="flex items-start gap-3"
          ><input v-model="approved" type="checkbox" class="mt-1" /><span>{{
            tr(
              "Я проверил(-а) эту версию и подтверждаю открытие записи по ней.",
              "Осы нұсқаны тексердім және оған тіркелуді ашуды растаймын.",
            )
          }}</span></label
        ><button
          class="lms-button"
          :disabled="busy || unsaved || !approved || !evidence.trim()"
          @click="workflow('publish')"
        >
          {{ tr("Утвердить и опубликовать", "Бекіту және жариялау") }}
        </button></template
      >
    </div>
    <p v-if="failure" class="lms-error" role="alert">{{ failure }}</p>
    <p v-if="message" class="lms-success" role="status">{{ message }}</p>
  </section>
</template>
