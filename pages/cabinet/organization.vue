<script setup lang="ts">
const { api, tr, locale, errorText, date, statusLabel } = useLmsApi();
const path = useLocalePath();
const route = useRoute();
const { data, pending, error, refresh } = await useAsyncData(
  "lms-organizations",
  () => api<any>("/organizations"),
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
async function load() {
  if (!selected.value) return;
  loading.value = true;
  overview.value = null;
  failure.value = "";
  preview.value = null;
  issuedInvitation.value = "";
  userIds.value = [];
  try {
    overview.value = await api(
      "/organizations/" + encodeURIComponent(selected.value),
    );
  } catch (e) {
    failure.value = errorText(e);
  } finally {
    loading.value = false;
  }
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
          ><select v-model="selected" @change="load">
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
      @click="load"
    >
      {{ tr("Повторить загрузку", "Жүктеуді қайталау") }}
    </button>
    <template v-if="overview"
      ><div class="flex flex-wrap items-center justify-between gap-4">
        <h2 class="text-2xl font-bold">{{ overview.organization.name }}</h2>
        <a
          class="lms-button secondary"
          :href="
            '/api/v1/organizations/' +
            encodeURIComponent(selected) +
            '/report.csv'
          "
          >{{ tr("Скачать отчёт CSV", "CSV есебін жүктеу") }}</a
        >
      </div>
      <section class="lms-card space-y-5">
        <h2 class="text-xl font-bold">
          {{ tr("Назначить обучение", "Оқуды тағайындау") }}
        </h2>
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
                <option v-for="v in versions" :key="v.id" :value="v.id">
                  {{ v.title }} · {{ v.language.toUpperCase() }}
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
        <p v-if="!overview.enrollments?.length" class="lms-note">
          {{ tr("Назначений пока нет.", "Тағайындаулар әзірге жоқ.") }}
        </p>
        <article
          v-for="e in overview.enrollments"
          :key="e.id"
          class="rounded-xl border p-4"
        >
          <h3 class="font-semibold">{{ e.name }}</h3>
          <p class="text-sm">{{ e.programId }} · {{ statusLabel(e.status) }}</p>
          <p class="mt-2 text-sm text-slate-600">
            {{ tr("Завершено уроков", "Аяқталған сабақтар") }}:
            {{ e.completedLessons }} · {{ tr("Документов", "Құжаттар") }}:
            {{ e.documents }}
          </p>
          <p v-if="e.accessUntil" class="text-sm text-slate-600">
            {{ tr("Доступ до", "Қолжетімділік мерзімі") }}
            {{ date(e.accessUntil) }}
          </p>
        </article>
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
