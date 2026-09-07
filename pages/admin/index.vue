<script setup lang="ts">
const { api, tr, date, money, statusLabel, errorText } = useLmsApi();
const path = useLocalePath();
const { data: me } = await useAsyncData("lms-me", () => api<any>("/me"));
const { data, pending, error, refresh } = await useAsyncData(
  "lms-admin-operations",
  () => api<any>("/admin/operations"),
);
const { data: catalog, refresh: refreshCatalog } = await useAsyncData("lms-catalog", () =>
  api<{ programs: LmsProgram[] }>("/catalog/programs"),
);
const busy = ref(false);
const failure = ref("");
const message = ref("");
const action = ref("");
const target = ref("");
const reason = ref("");
const evidence = ref("");
const confirmed = ref(false);
const organizationName = ref("");
const ownerEmail = ref("");
const enrollmentForm = reactive({
  userId: "",
  versionId: "",
  accessUntil: "",
  reason: "",
  evidence: "",
});
let enrollmentKey = "";
const practiceEnrollment = ref("");
const practiceLesson = ref("");
const practiceReason = ref("");
const practiceEvidence = ref("");
const versions = computed(
  () => catalog.value?.programs.flatMap((p) => p.versions) || [],
);
const practiceLessons = computed(() => {
  const enrollment = data.value?.enrollments?.find(
    (item: any) => item.id === practiceEnrollment.value,
  );
  const version = versions.value.find((item) => item.id === enrollment?.versionId);
  return version?.modules?.flatMap((module: any) => module.lessons || [])
    .filter((lesson: any) => lesson.kind === "practice") || [];
});
watch(practiceEnrollment, () => { practiceLesson.value = ""; });
const can = (...roles: string[]) =>
  me.value?.user?.role === "admin" ||
  roles.includes(me.value?.user?.role || "");
const supersedesId = ref("");
const repairTemplateId = ref("");
const tickConfirmed = ref(false);
const intakeVersionId = ref("");
const intakeOpen = ref(false);
const intakeReason = ref("");
const intakeConfirmed = ref(false);
async function changeIntake() {
  const result = await run(
    () => api("/admin/program-versions/" + encodeURIComponent(intakeVersionId.value) + "/intake", { method: "POST", body: { open: intakeOpen.value, reason: intakeReason.value } }),
    tr("Настройка набора сохранена. Уже назначенное обучение и документы сохранены.", "Қабылдау баптауы сақталды. Бұрын тағайындалған оқу мен құжаттар сақталды."),
  );
  if (result) { intakeConfirmed.value = false; await refreshCatalog(); }
}
async function tick() {
  await run(
    () => api("/admin/operations/tick", { method: "POST", body: {} }),
    tr(
      "Пакет очереди обработан. Проверьте статусы задач.",
      "Кезек топтамасы өңделді. Тапсырма күйлерін тексеріңіз.",
    ),
  );
  tickConfirmed.value = false;
}
const actionTitle = computed(
  () =>
    ({
      retry: tr("Повторить обработку очереди", "Кезекті өңдеуді қайталау"),
      reissue: tr(
        "Переоформить отозванный документ",
        "Күші жойылған құжатты қайта рәсімдеу",
      ),
      issue: tr(
        "Оформить документ по результатам обучения",
        "Оқу нәтижелері бойынша құжат рәсімдеу",
      ),
      repair: tr(
        "Восстановить подготовку PDF",
        "PDF дайындауды қалпына келтіру",
      ),
      revoke: tr("Отозвать документ", "Құжаттың күшін жою"),
      refund: tr("Зарегистрировать возврат", "Қайтаруды тіркеу"),
      activate: tr(
        "Подтвердить доступ к обучению",
        "Оқуға қолжетімділікті растау",
      ),
    })[action.value] || "",
);
function choose(kind: string, id = "") {
  action.value = kind;
  target.value = id;
  reason.value = "";
  evidence.value = "";
  confirmed.value = false;
  failure.value = "";
  message.value = "";
  repairTemplateId.value = "";
}
async function run(fn: () => Promise<any>, label: string) {
  busy.value = true;
  failure.value = "";
  message.value = "";
  try {
    const result = await fn();
    message.value = label;
    await refresh();
    return result;
  } catch (e) {
    failure.value = errorText(e);
  } finally {
    busy.value = false;
  }
}
async function executeAction() {
  const endpoints: Record<string, string> = {
    retry: "/admin/outbox/" + target.value + "/retry",
    issue: "/admin/credentials",
    reissue: "/admin/credentials",
    revoke: "/admin/credentials/" + target.value + "/revoke",
    refund: "/admin/orders/" + target.value + "/refund",
    activate: "/admin/enrollments/" + target.value + "/activate",
    repair: "/admin/credentials/" + target.value + "/repair",
  };
  const result = await run(
    () =>
      api(endpoints[action.value]!, {
        method: "POST",
        body: ["issue", "reissue"].includes(action.value)
          ? {
              enrollmentId: target.value,
              reason: reason.value,
              ...(action.value === "reissue"
                ? { supersedesId: supersedesId.value }
                : {}),
            }
          : action.value === "repair"
            ? { templateId: repairTemplateId.value, reason: reason.value }
            : { reason: reason.value },
      }),
    action.value === "repair"
      ? tr(
          "Подготовка PDF снова поставлена в очередь. Номер документа и ссылка проверки сохранены; файл появится после успешной обработки.",
          "PDF дайындау қайта кезекке қойылды. Құжат нөмірі мен тексеру сілтемесі сақталды; файл сәтті өңдеуден кейін пайда болады.",
        )
      : tr(
          "Операция сохранена. Обновлённый статус показан ниже.",
          "Әрекет сақталды. Жаңартылған күй төменде көрсетілген.",
        ),
  );
  if (result) action.value = "";
}
async function createOrganization() {
  const result = await run(
    () =>
      api("/admin/organizations", {
        method: "POST",
        body: {
          name: organizationName.value,
          ...(ownerEmail.value ? { ownerEmail: ownerEmail.value } : {}),
        },
      }),
    tr("Организация создана.", "Ұйым құрылды."),
  );
  if (result) {
    organizationName.value = "";
    ownerEmail.value = "";
  }
}
async function assignEnrollment() {
  enrollmentKey ||= crypto.randomUUID();
  const result = await run(
    () =>
      api("/admin/enrollments", {
        method: "POST",
        headers: { "Idempotency-Key": enrollmentKey },
        body: {
          ...enrollmentForm,
          accessUntil: enrollmentForm.accessUntil
            ? new Date(enrollmentForm.accessUntil).toISOString()
            : null,
        },
      }),
    tr("Назначение сохранено.", "Тағайындау сақталды."),
  );
  if (result) enrollmentKey = "";
}
watch(
  enrollmentForm,
  () => {
    enrollmentKey = "";
  },
  { deep: true },
);
async function confirmPractice() {
  await run(
    () =>
      api(
        "/admin/enrollments/" +
          encodeURIComponent(practiceEnrollment.value) +
          "/practice/" +
          encodeURIComponent(practiceLesson.value),
        {
          method: "POST",
          body: {
            reason: practiceReason.value,
            evidence: practiceEvidence.value,
          },
        },
      ),
    tr(
      "Практическая часть подтверждена и записана в журнал.",
      "Практикалық бөлім расталып, журналға жазылды.",
    ),
  );
}
useHead(() => ({
  title: tr("Управление OT Center", "OT Center басқару"),
  meta: [{ name: "robots", content: "noindex, nofollow" }],
}));
</script>
<template>
  <LmsShell :title="tr('Управление обучением', 'Оқуды басқару')" back="/cabinet"
    ><nav class="flex flex-wrap gap-3">
      <NuxtLink
        v-if="can('admin')"
        class="lms-button secondary"
        :to="path('/admin/users')"
        >{{
          tr("Пользователи и права", "Пайдаланушылар мен құқықтар")
        }}</NuxtLink
      ><NuxtLink
        v-if="can('editor', 'reviewer')"
        class="lms-button secondary"
        :to="path('/admin/programs')"
        >{{
          tr("Программы и редактор", "Бағдарламалар және редактор")
        }}</NuxtLink
      ><NuxtLink
        v-if="can('issuer', 'reviewer')"
        class="lms-button secondary"
        :to="path('/admin/documents')"
        >{{ tr("Шаблоны документов", "Құжат үлгілері") }}</NuxtLink
      ><NuxtLink
        v-if="can('finance', 'issuer')"
        class="lms-button secondary"
        :to="path('/admin/incidents')"
        >{{ tr("Операционные инциденты", "Операциялық оқиғалар") }}</NuxtLink
      ><NuxtLink v-if="can('issuer')" class="lms-button secondary" :to="path('/admin/document-batches')">{{ tr("Пакетное оформление документов", "Құжаттарды топтамамен рәсімдеу") }}</NuxtLink
      ><NuxtLink v-if="can('admin')" class="lms-button secondary" :to="path('/admin/support')">{{ tr("Обращения и заметки поддержки", "Қолдау өтініштері мен жазбалары") }}</NuxtLink
      ><NuxtLink class="lms-button secondary" :to="path('/cabinet/security')">{{
        tr("Подтвердить безопасность входа", "Кіру қауіпсіздігін растау")
      }}</NuxtLink>
    </nav>
    <p v-if="me?.user && !me.user.mfaVerified" class="lms-note">
      {{
        tr(
          "Управление требует подтверждённого второго фактора. Откройте раздел безопасности, затем подтвердите код приложения.",
          "Басқару үшін екінші факторды растау қажет. Қауіпсіздік бөлімін ашып, қолданба кодын растаңыз.",
        )
      }}
    </p>
    <LmsState :pending="pending" :error="error" @retry="refresh"
      ><p v-if="failure" class="lms-error" role="alert">{{ failure }}</p>
      <p v-if="message" class="lms-success" role="status">{{ message }}</p>
      <datalist id="lms-enrollment-options">
        <option
          v-for="enrollment in data?.enrollments"
          :key="enrollment.id"
          :value="enrollment.id"
        >
          {{ enrollment.learnerName }} · {{ enrollment.programId }} ·
          {{ statusLabel(enrollment.status) }}
        </option></datalist
      ><datalist id="lms-learner-options">
        <option
          v-for="enrollment in data?.enrollments"
          :key="enrollment.id"
          :value="enrollment.userId"
        >
          {{ enrollment.learnerName }}
        </option>
      </datalist>
      <section v-if="action" class="lms-card space-y-5">
        <h2 class="text-xl font-bold">{{ actionTitle }}</h2>
        <form class="space-y-4" @submit.prevent="executeAction">
          <label class="block space-y-2"
            ><span>{{
              ["issue", "reissue", "activate"].includes(action)
                ? tr("ID назначения ученика", "Оқушы тағайындауының ID")
                : tr("ID записи", "Жазба ID")
            }}</span
            ><input
              v-model="target"
              :list="
                ['issue', 'reissue', 'activate'].includes(action)
                  ? 'lms-enrollment-options'
                  : undefined
              "
              required
              maxlength="100" /></label
          ><label v-if="action === 'reissue'" class="block space-y-2"
            ><span>{{
              tr("ID отозванного документа", "Күші жойылған құжат ID")
            }}</span
            ><input v-model="supersedesId" required maxlength="100" /></label
          ><label v-if="action === 'repair'" class="block space-y-2">
            <span>{{
              tr(
                "Утверждённый бланк для повторной подготовки",
                "Қайта дайындауға арналған бекітілген бланк",
              )
            }}</span>
            <select v-model="repairTemplateId" required>
              <option value="" disabled>
                {{
                  tr(
                    "Выберите бланк этой программы",
                    "Осы бағдарламаның бланкін таңдаңыз",
                  )
                }}
              </option>
              <option
                v-for="template in data?.templates?.filter(
                  (item: any) => item.status === 'approved',
                )"
                :key="template.id"
                :value="template.id"
              >
                {{ template.name }} · {{ template.programId }}
              </option>
            </select>
          </label>
          <p v-if="action === 'repair'" class="lms-note">
            {{
              tr(
                "Повторная подготовка доступна после ошибки создания PDF. Выберите исправленный и независимо утверждённый бланк той же программы и издателя. При активной обработке дождитесь её завершения.",
                "Қайта дайындау PDF жасау қатесінен кейін қолжетімді. Сол бағдарлама мен баспагердің түзетілген және тәуелсіз бекітілген бланкін таңдаңыз. Белсенді өңдеу аяқталғанша күтіңіз.",
              )
            }}
          </p>
          <label class="block space-y-2"
            ><span>{{
              tr(
                "Основание и сведения для проверки (не менее 10 символов)",
                "Негіздеме және тексеру мәліметтері (кемінде 10 таңба)",
              )
            }}</span
            ><textarea
              v-model="reason"
              required
              minlength="10"
              maxlength="2000"
              rows="4"
            />
          </label>
          <p v-if="action === 'refund'" class="lms-note">
            {{
              tr(
                "Возврат меняет финансовую запись. Академическая история не удаляется. Фактическое возвращение денег сверяется отдельно.",
                "Қайтару қаржылық жазбаны өзгертеді. Академиялық тарих жойылмайды. Ақшаның нақты қайтарылуы бөлек салыстырылады.",
              )
            }}
          </p>
          <p v-if="action === 'revoke'" class="lms-note">
            {{
              tr(
                "Документ потеряет действующий статус в публичной проверке. История выдачи сохранится.",
                "Құжат жария тексеруде жарамды күйін жоғалтады. Берілу тарихы сақталады.",
              )
            }}
          </p>
          <label class="flex items-start gap-3"
            ><input
              v-model="confirmed"
              required
              type="checkbox"
              class="mt-1"
            /><span>{{
              tr(
                "Подтверждаю действие и указанное основание.",
                "Әрекетті және көрсетілген негіздемені растаймын.",
              )
            }}</span></label
          >
          <div class="flex flex-wrap gap-3">
            <button class="lms-button" :disabled="busy || !confirmed">
              {{ actionTitle }}</button
            ><button
              type="button"
              class="lms-button secondary"
              @click="action = ''"
            >
              {{ tr("Отмена", "Болдырмау") }}
            </button>
          </div>
        </form>
      </section>
      <div class="grid gap-5 lg:grid-cols-2">
        <section v-if="can('admin')" class="lms-card space-y-4">
          <h2 class="text-xl font-bold">{{ tr("Набор на программы", "Бағдарламаларға қабылдау") }}</h2>
          <p class="lms-note">{{ tr("Приостановка запрещает новые записи, назначения, заказы и счета. Действующее обучение и ранее оформленные обязательства продолжаются.", "Тоқтату жаңа тіркелулерді, тағайындауларды, тапсырыстар мен шоттарды шектейді. Қолданыстағы оқу мен бұрын рәсімделген міндеттемелер жалғасады.") }}</p>
          <form class="space-y-4" @submit.prevent="changeIntake">
            <label class="block space-y-2"><span>{{ tr("Версия для настройки набора", "Қабылдауды баптау нұсқасы") }}</span><select v-model="intakeVersionId" required><option value="" disabled>{{ tr("Выберите опубликованную версию", "Жарияланған нұсқаны таңдаңыз") }}</option><option v-for="version in versions" :key="version.id" :value="version.id">{{ version.title }} · {{ version.language.toUpperCase() }} · {{ version.intakeOpen === false ? tr("Набор приостановлен", "Қабылдау тоқтатылған") : tr("Набор открыт", "Қабылдау ашық") }}</option></select></label>
            <label class="block space-y-2"><span>{{ tr("Новое состояние набора", "Қабылдаудың жаңа күйі") }}</span><select v-model="intakeOpen"><option :value="false">{{ tr("Приостановить новый набор", "Жаңа қабылдауды тоқтату") }}</option><option :value="true">{{ tr("Открыть новый набор", "Жаңа қабылдауды ашу") }}</option></select></label>
            <label class="block space-y-2"><span>{{ tr("Основание изменения набора", "Қабылдауды өзгерту негізі") }}</span><textarea v-model="intakeReason" required minlength="10" maxlength="2000" /></label>
            <label class="flex items-start gap-3"><input v-model="intakeConfirmed" type="checkbox" required /><span>{{ tr("Подтверждаю изменение набора для выбранной версии.", "Таңдалған нұсқа үшін қабылдауды өзгертуді растаймын.") }}</span></label>
            <button class="lms-button" :disabled="busy || !intakeConfirmed">{{ tr("Сохранить состояние набора", "Қабылдау күйін сақтау") }}</button>
          </form>
        </section>
        <section v-if="can('admin')" class="lms-card space-y-4">
          <h2 class="text-xl font-bold">
            {{ tr("Очередь обработки", "Өңдеу кезегі") }}
          </h2>
          <form class="space-y-3 rounded-lg border p-3" @submit.prevent="tick">
            <label class="flex items-start gap-3 text-sm"
              ><input
                v-model="tickConfirmed"
                type="checkbox"
                required
                class="mt-1"
              /><span>{{
                tr(
                  "Обработать пакет очереди. Настроенные интеграции могут отправить письма и передать заявки.",
                  "Кезек топтамасын өңдеу. Бапталған интеграциялар хаттарды жіберіп, өтініштерді жеткізуі мүмкін.",
                )
              }}</span></label
            ><button
              class="lms-button secondary"
              :disabled="busy || !tickConfirmed"
            >
              {{ tr("Обработать очередь сейчас", "Кезекті қазір өңдеу") }}
            </button>
          </form>
          <p v-if="!data?.outbox?.length" class="text-sm text-slate-600">
            {{ tr("В очереди нет записей.", "Кезекте жазбалар жоқ.") }}
          </p>
          <article
            v-for="job in data?.outbox"
            :key="job.id"
            class="rounded-lg border p-4"
          >
            <p class="font-semibold">
              {{
                job.topic ||
                job.type ||
                tr("Задача обработки", "Өңдеу тапсырмасы")
              }}
            </p>
            <p class="text-sm">
              {{ statusLabel(job.status) }} · {{ tr("Попыток", "Әрекеттер") }}:
              {{ job.attempts || 0 }}
            </p>
            <p
              v-if="job.lastError || job.lastErrorCode || job.last_error_code"
              class="mt-2 text-sm text-rose-800"
            >
              {{ job.lastError || job.lastErrorCode || job.last_error_code }}
            </p>
            <button
              v-if="
                ['pending', 'failed', 'dead', 'dead_letter'].includes(
                  job.status,
                )
              "
              class="lms-button secondary mt-3"
              @click="choose('retry', job.id)"
            >
              {{ tr("Повторить с основанием", "Негіздемемен қайталау") }}
            </button>
          </article>
        </section>
        <section v-if="can('admin')" class="lms-card space-y-4">
          <h2 class="text-xl font-bold">{{ tr("Обращения", "Өтініштер") }}</h2>
          <p v-if="!data?.leads?.length" class="text-sm text-slate-600">
            {{ tr("Обращений пока нет.", "Өтініштер әзірге жоқ.") }}
          </p>
          <article
            v-for="lead in data?.leads"
            :key="lead.id"
            class="rounded-lg border p-4"
          >
            <p class="font-semibold">
              {{ tr("Заявка", "Өтініш") }} {{ lead.id }}
            </p>
            <p class="text-sm">
              {{ statusLabel(lead.status) }} ·
              {{ date(lead.createdAt || lead.created_at) }}
            </p>
            <p v-if="lead.crmLeadId || lead.crm_lead_id" class="text-sm">
              amoCRM: {{ lead.crmLeadId || lead.crm_lead_id }}
            </p>
          </article>
        </section>
        <section v-if="can('finance')" class="lms-card space-y-4">
          <h2 class="text-xl font-bold">{{ tr("Заказы", "Тапсырыстар") }}</h2>
          <p v-if="!data?.orders?.length" class="text-sm text-slate-600">
            {{ tr("Заказов пока нет.", "Тапсырыстар әзірге жоқ.") }}
          </p>
          <article
            v-for="o in data?.orders"
            :key="o.id"
            class="rounded-lg border p-4"
          >
            <p class="font-semibold">
              {{ money(o.amountMinor ?? o.amount_minor, o.currency) }}
            </p>
            <p class="text-sm">{{ statusLabel(o.status) }} · {{ o.id }}</p>
            <button
              v-if="o.status === 'succeeded'"
              class="lms-button secondary mt-3"
              @click="choose('refund', o.id)"
            >
              {{ tr("Возврат с основанием", "Негіздемемен қайтару") }}
            </button>
          </article>
        </section>
        <section v-if="can('issuer')" class="lms-card space-y-4">
          <div class="flex flex-wrap justify-between gap-3">
            <h2 class="text-xl font-bold">{{ tr("Документы", "Құжаттар") }}</h2>
            <button class="lms-button secondary" @click="choose('issue')">
              {{ tr("Оформить документ", "Құжат рәсімдеу") }}
            </button>
          </div>
          <p v-if="!data?.credentials?.length" class="text-sm text-slate-600">
            {{ tr("Документов пока нет.", "Құжаттар әзірге жоқ.") }}
          </p>
          <article
            v-for="c in data?.credentials"
            :key="c.id"
            class="rounded-lg border p-4"
          >
            <p class="font-semibold">{{ c.serial }}</p>
            <p class="text-sm">
              {{ statusLabel(c.status) }} ·
              {{ c.programTitle || c.program_title }}
            </p>
            <button
              v-if="c.status === 'pending'"
              class="lms-button secondary mt-3"
              @click="choose('repair', c.id)"
            >
              {{
                tr(
                  "Исправить бланк и повторить подготовку PDF",
                  "Бланкті түзету және PDF дайындауды қайталау",
                )
              }}</button
            ><button
              v-if="c.status === 'issued'"
              class="lms-button secondary mt-3"
              @click="choose('revoke', c.id)"
            >
              {{
                tr("Отозвать с основанием", "Негіздемемен күшін жою")
              }}</button
            ><button
              v-if="c.status === 'revoked'"
              class="lms-button secondary mt-3"
              @click="
                choose('reissue', c.enrollmentId || '');
                supersedesId = c.id;
              "
            >
              {{ tr("Оформить замену", "Ауыстыру құжатын рәсімдеу") }}
            </button>
          </article>
        </section>
      </div>
      <details v-if="can('instructor')" class="lms-card">
        <summary class="cursor-pointer text-xl font-bold">
          {{
            tr(
              "Назначения и практическая часть",
              "Тағайындаулар және практикалық бөлім",
            )
          }}
        </summary>
        <div class="mt-5 space-y-7">
          <form class="space-y-4" @submit.prevent="assignEnrollment">
            <h3 class="font-semibold">
              {{
                tr(
                  "Назначить опубликованную программу",
                  "Жарияланған бағдарламаны тағайындау",
                )
              }}
            </h3>
            <div class="grid gap-4 md:grid-cols-2">
              <label class="space-y-2"
                ><span>{{ tr("ID ученика", "Оқушы ID") }}</span
                ><input
                  v-model="enrollmentForm.userId"
                  list="lms-learner-options"
                  required /></label
              ><label class="space-y-2"
                ><span>{{ tr("Версия программы", "Бағдарлама нұсқасы") }}</span
                ><select v-model="enrollmentForm.versionId" required>
                  <option value="" disabled>
                    {{ tr("Выберите программу", "Бағдарламаны таңдаңыз") }}
                  </option>
                  <option v-for="v in versions" :key="v.id" :value="v.id" :disabled="v.intakeOpen === false">
                    {{ v.title }} · {{ v.language.toUpperCase() }}{{ v.intakeOpen === false ? ' · ' + tr('Набор приостановлен', 'Қабылдау тоқтатылған') : '' }}
                  </option>
                </select></label
              ><label class="space-y-2"
                ><span>{{ tr("Доступ до", "Қолжетімділік мерзімі") }}</span
                ><input
                  v-model="enrollmentForm.accessUntil"
                  type="datetime-local" /></label
              ><label class="space-y-2"
                ><span>{{ tr("Основание", "Негіздеме") }}</span
                ><input
                  v-model="enrollmentForm.reason"
                  required
                  minlength="10"
                  maxlength="2000" /></label
              ><label class="space-y-2 md:col-span-2"
                ><span>{{
                  tr("Подтверждающие сведения", "Растайтын мәліметтер")
                }}</span
                ><textarea
                  v-model="enrollmentForm.evidence"
                  required
                  maxlength="4000"
                />
              </label>
            </div>
            <button class="lms-button" :disabled="busy">
              {{ tr("Создать назначение", "Тағайындау жасау") }}</button
            ><button
              class="lms-button secondary ml-2"
              type="button"
              @click="choose('activate')"
            >
              {{
                tr(
                  "Активировать согласованный доступ",
                  "Келісілген қолжетімділікті іске қосу",
                )
              }}
            </button>
          </form>
          <form
            class="space-y-4 border-t pt-5"
            @submit.prevent="confirmPractice"
          >
            <h3 class="font-semibold">
              {{
                tr(
                  "Подтвердить выполненную практику",
                  "Орындалған практиканы растау",
                )
              }}
            </h3>
            <div class="grid gap-4 md:grid-cols-2">
              <label class="space-y-2"
                ><span>{{ tr("Назначение слушателя", "Тыңдаушы тағайындауы") }}</span
                ><select
                  v-model="practiceEnrollment"
                  required
                >
                  <option value="" disabled>{{ tr("Выберите слушателя и программу", "Тыңдаушы мен бағдарламаны таңдаңыз") }}</option>
                  <option v-for="enrollment in data?.enrollments" :key="enrollment.id" :value="enrollment.id">
                    {{ enrollment.learnerName }} · {{ versions.find((version) => version.id === enrollment.versionId)?.title || enrollment.programId }} · {{ statusLabel(enrollment.status) }}
                  </option>
                </select></label
              ><label class="space-y-2"
                ><span>{{
                  tr("Практический урок", "Практикалық сабақ")
                }}</span
                ><select v-model="practiceLesson" required :disabled="!practiceEnrollment || !practiceLessons.length">
                  <option value="" disabled>{{ tr("Выберите практическое занятие", "Практикалық сабақты таңдаңыз") }}</option>
                  <option v-for="lesson in practiceLessons" :key="lesson.id" :value="lesson.id">{{ lesson.title }}</option>
                </select>
                <small v-if="practiceEnrollment && !practiceLessons.length" class="block text-slate-600">{{ tr("В назначенной опубликованной версии нет доступных практических занятий. Проверьте выбранную программу.", "Тағайындалған жарияланған нұсқада қолжетімді практикалық сабақтар жоқ. Таңдалған бағдарламаны тексеріңіз.") }}</small>
              </label
              ><label class="space-y-2"
                ><span>{{
                  tr("Основание подтверждения", "Растау негізі")
                }}</span
                ><textarea
                  v-model="practiceReason"
                  required
                  minlength="10"
                  maxlength="2000"
                /></label
              ><label class="space-y-2"
                ><span>{{
                  tr(
                    "Сведения о выполненной практике",
                    "Орындалған практика туралы мәліметтер",
                  )
                }}</span
                ><textarea
                  v-model="practiceEvidence"
                  required
                  minlength="10"
                  maxlength="4000"
                />
              </label>
            </div>
            <button class="lms-button" :disabled="busy">
              {{
                tr(
                  "Подтвердить практику и сохранить основание",
                  "Практиканы растап, негіздемені сақтау",
                )
              }}
            </button>
          </form>
        </div>
      </details>
      <details v-if="can('admin')" class="lms-card">
        <summary class="cursor-pointer text-xl font-bold">
          {{ tr("Создать организацию", "Ұйым құру") }}
        </summary>
        <form class="mt-5 space-y-4" @submit.prevent="createOrganization">
          <label class="block space-y-2"
            ><span>{{ tr("Название организации", "Ұйым атауы") }}</span
            ><input
              v-model="organizationName"
              required
              minlength="2"
              maxlength="200" /></label
          ><label class="block space-y-2"
            ><span>{{
              tr(
                "Подтверждённый email владельца (пусто — текущий администратор)",
                "Иесінің расталған поштасы (бос — ағымдағы әкімші)",
              )
            }}</span
            ><input v-model="ownerEmail" type="email" maxlength="254" /></label
          ><button class="lms-button" :disabled="busy">
            {{ tr("Создать организацию", "Ұйым құру") }}
          </button>
        </form>
      </details>
      <LmsInvoices v-if="can('finance')" finance /> </LmsState
  ></LmsShell>
</template>
