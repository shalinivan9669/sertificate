<script setup lang="ts">
const { api, tr, locale, errorText, date, statusLabel } = useLmsApi();
const path = useLocalePath();
const route = useRoute();
const organizationPage = ref(1);
const { data, pending, error, refresh } = await useAsyncData(
  "lms-organizations",
  () => api<any>("/organizations", { query: { page: organizationPage.value } }),
);
const selected = ref("");
const overview = ref<any>(null);
const loading = ref(false);
const failure = ref("");
const message = ref("");
const busy = ref(false);
const inviteEmail = ref("");
const inviteRole = ref("member");
const inviteToken = ref(
  typeof route.query.invitation === "string" ? route.query.invitation : "",
);
const issuedInvitation = ref("");
const csv = ref("");
const preview = ref<any>(null);
const confirmed = ref(false);
const userIds = ref<string[]>([]);
const versionId = ref("");
const accessUntil = ref("");
const assignConfirmed = ref(false);
const revokeId = ref("");
const revokeReason = ref("");
const reportProgramId = ref("");
const pages = reactive({ enrollments: 1, members: 1, invitations: 1 });
const reportUrl = computed(() => "/api/v1/organizations/" + encodeURIComponent(selected.value) + "/report.csv" + (reportProgramId.value ? "?programId=" + encodeURIComponent(reportProgramId.value) : ""));
let assignmentKey = "";
const { data: catalog } = await useAsyncData("lms-catalog", () =>
  api<{ programs: LmsProgram[] }>("/catalog/programs"),
);
const versions = computed(
  () =>
    catalog.value?.programs.flatMap((p) =>
      p.versions.map((v) => ({
        ...v,
        programTitle: p.title[locale.value === "kk" ? "kk" : "ru"],
      })),
    ) || [],
);
watch(
  () => data.value?.organizations,
  (orgs) => {
    if (orgs?.length === 1 && !selected.value) {
      selected.value = orgs[0].id;
      void load();
    }
  },
  { immediate: true },
);
watch(
  [userIds, versionId, accessUntil],
  () => {
    assignmentKey = "";
    assignConfirmed.value = false;
  },
  { deep: true },
);
async function load(resetPages = true) {
  if (!selected.value) return;
  if (resetPages) {
    pages.enrollments = pages.members = pages.invitations = 1;
    preview.value = null;
    issuedInvitation.value = "";
    userIds.value = [];
    revokeId.value = "";
  }
  loading.value = true;
  overview.value = null;
  failure.value = "";
  try {
    overview.value = await api(
      "/organizations/" + encodeURIComponent(selected.value),
      { query: { page: pages.enrollments, memberPage: pages.members, invitationPage: pages.invitations, ...(reportProgramId.value ? { programId: reportProgramId.value } : {}) } },
    );
    for (const key of ["enrollments", "members", "invitations"] as const) pages[key] = overview.value.pagination[key].page;
  } catch (e) {
    failure.value = errorText(e);
  } finally {
    loading.value = false;
  }
}
async function changePage(kind: keyof typeof pages, page: number) {
  if (loading.value || busy.value) return;
  if (kind === "members") { userIds.value = []; revokeId.value = ""; }
  pages[kind] = page;
  await load(false);
}
async function changeOrganizationPage(page: number) {
  if (pending.value || loading.value || busy.value) return;
  organizationPage.value = page;
  selected.value = "";
  overview.value = null;
  reportProgramId.value = "";
  await refresh();
}
function range(paging: any) { return `${paging.from}–${paging.to} ${tr("из", " / ")} ${paging.total}`; }
function reportStatus(value: string) {
  const labels: Record<string, [string, string]> = {
    not_started: ["Не начал", "Әлі бастамаған"], in_progress: ["В процессе", "Оқу жүріп жатыр"],
    ready_for_assessment: ["К проверке", "Тексеруге дайын"], waiting_practice: ["Ожидает практики / комиссии", "Практиканы / комиссияны күтуде"],
    assessment_in_progress: ["Проходит проверку", "Тексеруден өтуде"], assessment_failed: ["Проверка не пройдена", "Тексеруден өтпеді"],
    completed: ["Проверка пройдена", "Тексеруден өтті"], awaiting_grading: ["Ожидает серверного результата", "Сервер нәтижесін күтуде"],
    assessment_voided: ["Попытка аннулирована", "Талпыныс жойылды"], voided: ["Попытка аннулирована", "Талпыныс жойылды"],
    passed: ["Пройдена", "Өтті"], failed: ["Не пройдена", "Өтпеді"],
    document_none: ["Не оформлен", "Рәсімделмеген"], document_pending: ["Документ оформляется", "Құжат рәсімделуде"],
    document_issued: ["Документ выдан", "Құжат берілді"], document_revoked: ["Документ отозван", "Құжат кері қайтарылды"],
    document_superseded: ["Документ заменён", "Құжат ауыстырылды"], active: ["Доступ открыт", "Қолжетімділік ашық"],
    pending_access: ["Назначено · ожидает подтверждения доступа", "Тағайындалды · қолжетімділікті растауды күтуде"],
    organization_access_revoked: ["Доступ к организации отозван", "Ұйымға қолжетімділік жойылды"],
  };
  const label = labels[value]; return label ? tr(label[0], label[1]) : statusLabel(value);
}
async function run(action: () => Promise<any>, success: string) {
  if (busy.value) return;
  busy.value = true;
  failure.value = "";
  message.value = "";
  try {
    const result = await action();
    message.value = success;
    return result;
  } catch (e) {
    failure.value = errorText(e);
  } finally {
    busy.value = false;
  }
}
async function invite() {
  const result = await run(
    () =>
      api("/organizations/" + selected.value + "/invitations", {
        method: "POST",
        body: { email: inviteEmail.value, role: inviteRole.value },
      }),
    tr(
      "Приглашение создано. Передайте персональную ссылку указанному сотруднику.",
      "Шақыру жасалды. Жеке сілтемені көрсетілген қызметкерге беріңіз.",
    ),
  );
  if (result) {
    issuedInvitation.value = result.token
      ? path("/cabinet/organization") +
        "?invitation=" +
        encodeURIComponent(result.token)
      : "";
    inviteEmail.value = "";
    await load();
    if (result.token)
      issuedInvitation.value =
        path("/cabinet/organization") +
        "?invitation=" +
        encodeURIComponent(result.token);
  }
}
async function accept() {
  const result = await run(
    () =>
      api("/invitations/accept", {
        method: "POST",
        body: { token: inviteToken.value },
      }),
    tr("Приглашение принято.", "Шақыру қабылданды."),
  );
  if (result) {
    inviteToken.value = "";
    await refresh();
    selected.value = result.organizationId;
    await load();
  }
}
async function readCsv(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  if (file.size > 150000) {
    failure.value = tr(
      "Файл больше 150 КБ. Разделите список на части.",
      "Файл 150 КБ-тан үлкен. Тізімді бөліктерге бөліңіз.",
    );
    return;
  }
  csv.value = await file.text();
  preview.value = null;
  confirmed.value = false;
}
async function previewCsv() {
  preview.value = await run(
    () =>
      api("/organizations/" + selected.value + "/import/preview", {
        method: "POST",
        body: { csv: csv.value },
      }),
    tr(
      "Предпросмотр готов. Проверьте каждую строку.",
      "Алдын ала қарау дайын. Әр жолды тексеріңіз.",
    ),
  );
  confirmed.value = false;
}
async function commitCsv() {
  const result = await run(
    () =>
      api("/organizations/" + selected.value + "/import/commit", {
        method: "POST",
        body: { previewId: preview.value.previewId },
      }),
    tr(
      "Импорт подтверждён. Приглашения созданы; автоматическая рассылка отдельно управляется учебным центром.",
      "Импорт расталды. Шақырулар жасалды; автоматты таратуды оқу орталығы бөлек басқарады.",
    ),
  );
  if (result) {
    preview.value = null;
    csv.value = "";
    await load();
  }
}
async function assign() {
  assignmentKey ||= crypto.randomUUID();
  const result = await run(
    () =>
      api("/organizations/" + selected.value + "/assignments", {
        method: "POST",
        headers: { "Idempotency-Key": assignmentKey },
        body: {
          versionId: versionId.value,
          userIds: userIds.value,
          accessUntil: accessUntil.value
            ? new Date(accessUntil.value).toISOString()
            : null,
        },
      }),
    tr(
      "Назначения созданы. Учебный центр подтверждает доступ по согласованным условиям.",
      "Тағайындаулар жасалды. Оқу орталығы келісілген шарттар бойынша қолжетімділікті растайды.",
    ),
  );
  if (result) {
    await load();
    assignmentKey = "";
  }
}
async function revoke() {
  const result = await run(
    () =>
      api(
        "/organizations/" +
          selected.value +
          "/members/" +
          encodeURIComponent(revokeId.value) +
          "/revoke",
        { method: "POST", body: { reason: revokeReason.value } },
      ),
    tr(
      "Доступ сотрудника к организации отозван.",
      "Қызметкердің ұйымға қолжетімділігі жойылды.",
    ),
  );
  if (result) {
    revokeId.value = "";
    revokeReason.value = "";
    await load();
  }
}
useHead(() => ({
  title: tr("Кабинет организации — OT Center", "Ұйым кабинеті — OT Center"),
  meta: [{ name: "robots", content: "noindex, nofollow" }],
}));
</script>
<template>
  <LmsShell :title="tr('Кабинет организации', 'Ұйым кабинеті')" back="/cabinet"
    ><LmsState :pending="pending" :error="error" @retry="refresh"
      ><div class="lms-card space-y-5">
        <label
          v-if="data?.organizations?.length"
          class="block max-w-xl space-y-2"
          ><span>{{ tr("Организация", "Ұйым") }}</span
          ><select v-model="selected" :disabled="loading || busy" @change="reportProgramId = ''; load()">
            <option value="" disabled>
              {{ tr("Выберите организацию", "Ұйымды таңдаңыз") }}
            </option>
            <option v-for="o in data.organizations" :key="o.id" :value="o.id">
              {{ o.name }}
            </option>
          </select></label
        >
        <p v-else class="lms-note">
          {{
            tr(
              "У вас пока нет доступа к организации. Получите приглашение от ответственного сотрудника или обратитесь в OT Center.",
              "Ұйымға қолжетімділік әзірге жоқ. Жауапты қызметкерден шақыру алыңыз немесе OT Center-ге хабарласыңыз.",
            )
          }}
        </p>
        <nav v-if="data?.pagination?.totalPages > 1" class="flex flex-wrap items-center gap-3" :aria-label="tr('Страницы организаций', 'Ұйым беттері')">
          <span>{{ tr('Организации', 'Ұйымдар') }}: {{ range(data.pagination) }}</span>
          <button class="lms-button secondary" :disabled="pending || loading || busy || !data.pagination.hasPrevious" @click="changeOrganizationPage(data.pagination.page - 1)">{{ tr('Предыдущие', 'Алдыңғы') }}</button>
          <button class="lms-button secondary" :disabled="pending || loading || busy || !data.pagination.hasMore" @click="changeOrganizationPage(data.pagination.page + 1)">{{ tr('Следующие', 'Келесі') }}</button>
        </nav>
        <details :open="!!inviteToken" class="rounded-xl border p-4">
          <summary class="cursor-pointer font-semibold">
            {{ tr("Принять приглашение", "Шақыруды қабылдау") }}
          </summary>
          <form class="mt-4 space-y-4" @submit.prevent="accept">
            <label class="block space-y-2"
              ><span>{{
                tr("Код из персональной ссылки", "Жеке сілтемедегі код")
              }}</span
              ><input
                v-model="inviteToken"
                required
                maxlength="100"
                autocomplete="off"
            /></label>
            <p class="text-sm text-slate-600">
              {{
                tr(
                  "Приглашение должно быть адресовано подтверждённой почте вашего аккаунта.",
                  "Шақыру аккаунтыңыздың расталған поштасына арналуы керек.",
                )
              }}
            </p>
            <button class="lms-button" :disabled="busy">
              {{ tr("Принять приглашение", "Шақыруды қабылдау") }}
            </button>
          </form>
        </details>
      </div></LmsState
    >
    <p v-if="failure" class="lms-error" role="alert">{{ failure }}</p>
    <p v-if="message" class="lms-success" role="status">{{ message }}</p>
    <p v-if="loading" class="lms-note" role="status">
      {{ tr("Загружаем организацию…", "Ұйым жүктелуде…") }}
    </p>
    <button
      v-if="selected && !overview && !loading"
      class="lms-button secondary"
      @click="load(false)"
    >
      {{ tr("Повторить загрузку", "Жүктеуді қайталау") }}
    </button>
    <template v-if="overview"
      ><div class="flex flex-wrap items-center justify-between gap-4">
        <h2 class="text-2xl font-bold">{{ overview.organization.name }}</h2>
        <a
          v-if="overview.export.available"
          class="lms-button secondary"
          :href="reportUrl"
          >{{ tr("Скачать отчёт CSV", "CSV есебін жүктеу") }}</a
        >
      </div>
      <p class="lms-note">{{ tr('Сотрудников с доступом', 'Қолжетімділігі бар қызметкерлер') }}: {{ overview.totals.activeMembers }} / {{ overview.totals.members }}. {{ tr('Назначений в выбранном отчёте', 'Таңдалған есептегі тағайындаулар') }}: {{ overview.totals.enrollments }}.</p>
      <section class="lms-card space-y-5">
        <h2 class="text-xl font-bold">
          {{ tr("Назначить обучение", "Оқуды тағайындау") }}
        </h2>
        <nav class="flex flex-wrap items-center gap-3" :aria-label="tr('Страницы сотрудников', 'Қызметкер беттері')">
          <span>{{ tr('Сотрудники', 'Қызметкерлер') }}: {{ range(overview.pagination.members) }}</span>
          <button class="lms-button secondary" :disabled="loading || busy || !overview.pagination.members.hasPrevious" @click="changePage('members', pages.members - 1)">{{ tr('Предыдущие сотрудники', 'Алдыңғы қызметкерлер') }}</button>
          <button class="lms-button secondary" :disabled="loading || busy || !overview.pagination.members.hasMore" @click="changePage('members', pages.members + 1)">{{ tr('Следующие сотрудники', 'Келесі қызметкерлер') }}</button>
        </nav>
        <p class="text-sm text-slate-600">{{ tr('Выбор сотрудников для назначения, счёта и отзыва доступа относится к текущей странице. При смене страницы выбор сбрасывается.', 'Оқуға тағайындау, шот және қолжетімділікті жою үшін қызметкерлер осы беттен таңдалады. Бет ауысқанда таңдау тазартылады.') }}</p>
        <p v-if="!overview.members?.length" class="lms-note">
          {{
            tr(
              "Сначала пригласите сотрудников.",
              "Алдымен қызметкерлерді шақырыңыз.",
            )
          }}
        </p>
        <form v-else class="space-y-5" @submit.prevent="assign">
          <fieldset class="space-y-2">
            <legend class="mb-3 font-semibold">
              {{ tr("Сотрудники", "Қызметкерлер") }}
            </legend>
            <label
              v-for="m in overview.members.filter(
                (m: any) => m.status === 'active',
              )"
              :key="m.id"
              class="flex items-start gap-3 rounded-lg border p-3"
              ><input
                v-model="userIds"
                type="checkbox"
                :value="m.id"
                class="mt-1"
              /><span
                >{{ m.name
                }}<small class="block text-slate-500">{{
                  m.email
                }}</small></span
              ></label
            >
          </fieldset>
          <div class="grid gap-5 md:grid-cols-2">
            <label class="space-y-2"
              ><span>{{
                tr("Опубликованная программа", "Жарияланған бағдарлама")
              }}</span
              ><select v-model="versionId" required>
                <option value="" disabled>
                  {{ tr("Выберите программу", "Бағдарламаны таңдаңыз") }}
                </option>
                <option v-for="v in versions" :key="v.id" :value="v.id" :disabled="v.intakeOpen === false">
                  {{ v.title }} · {{ v.language.toUpperCase() }} {{ v.intakeOpen === false ? tr('· Приём остановлен', '· Қабылдау тоқтатылды') : '' }}
                </option>
              </select></label
            ><label class="space-y-2"
              ><span>{{
                tr(
                  "Доступ до (необязательно)",
                  "Қолжетімділік мерзімі (міндетті емес)",
                )
              }}</span
              ><input v-model="accessUntil" type="datetime-local"
            /></label>
          </div>
          <p v-if="!versions.length" class="lms-note">
            {{
              tr(
                "Опубликованных программ для назначения пока нет.",
                "Тағайындауға арналған жарияланған бағдарламалар әзірге жоқ.",
              )
            }}
          </p>
          <label class="flex items-start gap-3"
            ><input
              v-model="assignConfirmed"
              type="checkbox"
              required
              class="mt-1"
            /><span
              >{{
                tr(
                  "Создать назначения выбранным сотрудникам:",
                  "Таңдалған қызметкерлерге тағайындау жасау:",
                )
              }}
              {{ userIds.length }}</span
            ></label
          ><button
            class="lms-button"
            :disabled="
              busy || !assignConfirmed || !userIds.length || !versionId
            "
          >
            {{ tr("Подтвердить назначения", "Тағайындауларды растау") }}
          </button>
        </form>
      </section>
      <section class="lms-card space-y-4">
        <h2 class="text-xl font-bold">
          {{ tr("Прогресс сотрудников", "Қызметкерлердің оқу барысы") }}
        </h2>
        <label class="block max-w-xl space-y-2"><span>{{ tr('Программа в отчёте', 'Есептегі бағдарлама') }}</span>
          <select v-model="reportProgramId" :disabled="loading || busy" @change="load()"><option value="">{{ tr('Все программы', 'Барлық бағдарламалар') }}</option><option v-for="p in catalog?.programs || []" :key="p.id" :value="p.id">{{ p.title[locale === 'kk' ? 'kk' : 'ru'] }}</option></select>
        </label>
        <p class="text-sm text-slate-600">{{ tr('Данные на', 'Деректер уақыты') }} {{ date(overview.snapshotAt) }}. {{ tr('Процент показывает завершение обязательных уроков закреплённой версии программы.', 'Пайыз бекітілген бағдарлама нұсқасындағы міндетті сабақтардың аяқталуын көрсетеді.') }}</p>
        <p v-if="!overview.export.available" class="lms-note" role="status">{{ tr('CSV содержит все строки выбранного отчёта, максимум', 'CSV таңдалған есептің барлық жолдарын қамтиды, ең көбі') }} {{ overview.export.maximumRows }}. {{ tr('В отчёте', 'Есепте') }} {{ overview.export.totalRows }}. {{ tr('Выберите программу, чтобы уменьшить объём экспорта. Частичный файл не создаётся.', 'Экспорт көлемін азайту үшін бағдарламаны таңдаңыз. Толық емес файл жасалмайды.') }}</p>
        <p v-if="!overview.enrollments?.length" class="lms-note">
          {{ tr("Назначений пока нет.", "Тағайындаулар әзірге жоқ.") }}
        </p>
        <article
          v-for="e in overview.enrollments"
          :key="e.id"
          class="rounded-xl border p-4 space-y-2"
          :data-enrollment-id="e.id"
        >
          <h3 class="font-semibold">{{ e.name }}</h3>
          <p class="text-sm">{{ e.programTitle }} · {{ e.language?.toUpperCase() }}</p>
          <p class="font-semibold">{{ reportStatus(e.progressStatus) }}</p>
          <dl class="grid gap-3 text-sm sm:grid-cols-2">
            <div><dt class="font-medium">{{ tr('Доступ', 'Қолжетімділік') }}</dt><dd>{{ reportStatus(e.accessStatus) }}</dd></div>
            <div><dt class="font-medium">{{ tr('Обучение', 'Оқу') }}</dt><dd>{{ reportStatus(e.learning.status) }} · {{ e.learning.requiredCompleted }} / {{ e.learning.requiredTotal }} {{ tr('обязательных уроков', 'міндетті сабақ') }}<span v-if="e.learning.percent !== null"> · {{ e.learning.percent }}%</span><span v-else> · {{ tr('процент не рассчитывается', 'пайыз есептелмейді') }}</span></dd><dd v-if="e.learning.pendingPractice">{{ tr('Практических подтверждений ожидается', 'Күтілетін практика растаулары') }}: {{ e.learning.pendingPractice }}</dd></div>
            <div><dt class="font-medium">{{ tr('Последняя проверка', 'Соңғы тексеру') }}</dt><dd>{{ reportStatus(e.assessment.status) }}<span v-if="e.assessment.score !== null"> · {{ e.assessment.score }}%</span></dd></div>
            <div><dt class="font-medium">{{ tr('Документ', 'Құжат') }}</dt><dd>{{ reportStatus('document_' + e.credential.status) }}<span v-if="e.credential.serial"> · {{ e.credential.serial }}</span></dd><dd v-if="e.credential.issuedAt">{{ tr('Выдан', 'Берілді') }}: {{ date(e.credential.issuedAt) }}</dd><dd v-if="e.credential.revokedAt">{{ tr('Отозван', 'Кері қайтарылды') }}: {{ date(e.credential.revokedAt) }}</dd></div>
          </dl>
          <p v-if="e.accessUntil" class="text-sm text-slate-600">
            {{ tr("Доступ до", "Қолжетімділік мерзімі") }}
            {{ date(e.accessUntil) }}
          </p>
        </article>
        <nav class="flex flex-wrap items-center gap-3" :aria-label="tr('Страницы прогресса', 'Оқу барысының беттері')">
          <span>{{ tr('Назначения', 'Тағайындаулар') }}: {{ range(overview.pagination.enrollments) }}</span>
          <button class="lms-button secondary" :disabled="loading || busy || !overview.pagination.enrollments.hasPrevious" @click="changePage('enrollments', pages.enrollments - 1)">{{ tr('Предыдущие назначения', 'Алдыңғы тағайындаулар') }}</button>
          <button class="lms-button secondary" :disabled="loading || busy || !overview.pagination.enrollments.hasMore" @click="changePage('enrollments', pages.enrollments + 1)">{{ tr('Следующие назначения', 'Келесі тағайындаулар') }}</button>
        </nav>
      </section>
      <div class="grid gap-6 lg:grid-cols-2">
        <section class="lms-card space-y-5">
          <h2 class="text-xl font-bold">
            {{ tr("Пригласить сотрудника", "Қызметкерді шақыру") }}
          </h2>
          <form class="space-y-4" @submit.prevent="invite">
            <label class="block space-y-2"
              ><span>Email</span
              ><input
                v-model="inviteEmail"
                required
                type="email"
                maxlength="254" /></label
            ><label class="block space-y-2"
              ><span>{{ tr("Права", "Құқықтары") }}</span
              ><select v-model="inviteRole">
                <option value="member">
                  {{ tr("Сотрудник", "Қызметкер") }}
                </option>
                <option
                  v-if="overview.organization.role === 'owner'"
                  value="manager"
                >
                  {{ tr("Менеджер организации", "Ұйым менеджері") }}
                </option>
              </select></label
            ><button class="lms-button" :disabled="busy">
              {{ tr("Создать приглашение", "Шақыру жасау") }}
            </button>
          </form>
          <p v-if="issuedInvitation" class="lms-note break-all">
            {{ tr("Персональная ссылка:", "Жеке сілтеме:") }}
            <a :href="issuedInvitation">{{ issuedInvitation }}</a>
          </p>
          <div v-if="overview.invitations?.length" class="space-y-2">
            <h3 class="font-semibold">{{ tr("Приглашения", "Шақырулар") }}</h3>
            <p
              v-for="inv in overview.invitations"
              :key="inv.id"
              class="text-sm"
            >
              {{ inv.email }} · {{ statusLabel(inv.status) }} ·
              {{ date(inv.expiresAt) }}
            </p>
          </div>
          <nav class="flex flex-wrap items-center gap-3" :aria-label="tr('Страницы приглашений', 'Шақыру беттері')">
            <span>{{ tr('Приглашения', 'Шақырулар') }}: {{ range(overview.pagination.invitations) }}</span>
            <button class="lms-button secondary" :disabled="loading || busy || !overview.pagination.invitations.hasPrevious" @click="changePage('invitations', pages.invitations - 1)">{{ tr('Предыдущие приглашения', 'Алдыңғы шақырулар') }}</button>
            <button class="lms-button secondary" :disabled="loading || busy || !overview.pagination.invitations.hasMore" @click="changePage('invitations', pages.invitations + 1)">{{ tr('Следующие приглашения', 'Келесі шақырулар') }}</button>
          </nav>
        </section>
        <section class="lms-card space-y-5">
          <h2 class="text-xl font-bold">
            {{ tr("Импорт приглашений", "Шақыруларды импорттау") }}
          </h2>
          <p class="text-sm text-slate-600">
            {{
              tr(
                "CSV UTF-8, до 500 строк и 150 КБ. Столбцы: email,name,role. Роль member или manager. Сначала проверьте предпросмотр.",
                "UTF-8 CSV, 500 жолға және 150 КБ-қа дейін. Бағандар: email,name,role. Рөл: member немесе manager. Алдымен алдын ала қарауды тексеріңіз.",
              )
            }}
          </p>
          <label class="block space-y-2"
            ><span>{{ tr("Файл CSV", "CSV файлы") }}</span
            ><input
              type="file"
              accept=".csv,text/csv"
              @change="readCsv" /></label
          ><button
            class="lms-button secondary"
            :disabled="busy || !csv"
            @click="previewCsv"
          >
            {{
              tr("Проверить и показать строки", "Тексеру және жолдарды көрсету")
            }}
          </button>
          <div v-if="preview" class="space-y-4">
            <p>{{ tr("Строк", "Жолдар") }}: {{ preview.rows.length }}</p>
            <div class="max-h-80 space-y-2 overflow-auto">
              <article
                v-for="row in preview.rows"
                :key="row.row"
                class="rounded-lg border p-3 text-sm"
                :class="row.errors.length ? 'bg-rose-50' : 'bg-slate-50'"
              >
                <p>{{ row.row }}. {{ row.email }} · {{ row.role }}</p>
                <p v-if="row.errors.length" class="text-rose-800">
                  {{
                    tr(
                      "Ошибка: проверьте адрес, дубликаты, роль и формулы.",
                      "Қате: мекенжайды, қайталануларды, рөлді және формулаларды тексеріңіз.",
                    )
                  }}
                  {{ row.errors.join(", ") }}
                </p>
              </article>
            </div>
            <label class="flex items-start gap-3"
              ><input
                v-model="confirmed"
                type="checkbox"
                class="mt-1"
              /><span>{{
                tr(
                  "Я проверил(-а) список и подтверждаю создание приглашений.",
                  "Тізімді тексердім және шақыруларды жасауды растаймын.",
                )
              }}</span></label
            ><button
              class="lms-button"
              :disabled="busy || !preview.valid || !confirmed"
              @click="commitCsv"
            >
              {{ tr("Подтвердить импорт", "Импортты растау") }}
            </button>
          </div>
        </section>
      </div>
      <LmsLearningReminders :organization-id="selected" :enrollments="overview.enrollments" />
      <LmsInvoices
        :organization-id="selected"
        :organization-name="overview.organization.name"
        :members="overview.members"
      />
      <details v-if="overview.organization.role === 'owner'" class="lms-card">
        <summary class="cursor-pointer font-semibold">
          {{
            tr("Отозвать доступ сотрудника", "Қызметкердің қолжетімділігін жою")
          }}
        </summary>
        <form class="mt-5 space-y-4" @submit.prevent="revoke">
          <label class="block space-y-2"
            ><span>{{ tr("Сотрудник", "Қызметкер") }}</span
            ><select v-model="revokeId" required>
              <option value="" disabled>
                {{ tr("Выберите сотрудника", "Қызметкерді таңдаңыз") }}
              </option>
              <option
                v-for="m in overview.members.filter(
                  (m: any) => m.role !== 'owner' && m.status === 'active',
                )"
                :key="m.id"
                :value="m.id"
              >
                {{ m.name }} · {{ m.email }}
              </option>
            </select></label
          ><label class="block space-y-2"
            ><span>{{
              tr(
                "Основание (не менее 10 символов)",
                "Негіздеме (кемінде 10 таңба)",
              )
            }}</span
            ><textarea
              v-model="revokeReason"
              required
              minlength="10"
              maxlength="2000"
            />
          </label>
          <p class="text-sm text-slate-600">
            {{
              tr(
                "Сотрудник потеряет доступ к данным организации. История обучения сохраняется.",
                "Қызметкер ұйым деректеріне қолжетімділігін жоғалтады. Оқу тарихы сақталады.",
              )
            }}
          </p>
          <button class="lms-button danger" :disabled="busy">
            {{
              tr("Отозвать доступ к организации", "Ұйымға қолжетімділікті жою")
            }}
          </button>
        </form>
      </details>
    </template></LmsShell
  >
</template>
