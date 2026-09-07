<script setup lang="ts">
const { api, tr, errorText, statusLabel } = useLmsApi();
const { data, pending, error, refresh } = await useAsyncData(
  "lms-document-templates",
  () => api<any>("/admin/credential-templates"),
);
const busy = ref(false);
const failure = ref("");
const message = ref("");
const approved = ref(false);
const selected = ref("");
const reason = ref("");
const pdfName = ref("");
const fontName = ref("");
const form = reactive<any>({
  programId: "",
  name: "",
  issuerName: "",
  pdfBase64: "",
  fontBase64: "",
  fieldMap: {
    learnerName: "",
    programTitle: "",
    serial: "",
    issuedAt: "",
    verificationUrl: "",
    issuerName: "",
  },
  qr: { page: 0, x: 0, y: 0, size: 80 },
});
const addQr = ref(false);
const fields = computed(() => [
  { key: "learnerName", label: tr("ФИО слушателя", "Тыңдаушының аты-жөні") },
  { key: "programTitle", label: tr("Название программы", "Бағдарлама атауы") },
  { key: "serial", label: tr("Номер документа", "Құжат нөмірі") },
  { key: "issuedAt", label: tr("Дата выдачи", "Берілген күні") },
  { key: "verificationUrl", label: tr("Ссылка проверки", "Тексеру сілтемесі") },
  { key: "issuerName", label: tr("Наименование издателя", "Берушінің атауы") },
]);
async function readFile(event: Event, kind: "pdf" | "font") {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  const max = kind === "pdf" ? 1000000 : 2000000;
  if (file.size > max) {
    failure.value =
      tr(
        "Файл превышает допустимый размер: ",
        "Файл рұқсат етілген көлемнен үлкен: ",
      ) +
      max / 1000000 +
      " МБ";
    return;
  }
  try {
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
      reader.onerror = () => reject(new Error("read failed"));
      reader.readAsDataURL(file);
    });
    if (kind === "pdf") {
      form.pdfBase64 = base64;
      pdfName.value = file.name;
    } else {
      form.fontBase64 = base64;
      fontName.value = file.name;
    }
  } catch {
    failure.value = tr(
      "Не удалось прочитать файл.",
      "Файлды оқу мүмкін болмады.",
    );
  }
}
async function create() {
  busy.value = true;
  failure.value = "";
  message.value = "";
  try {
    await api("/admin/credential-templates", {
      method: "POST",
      body: {
        programId: form.programId,
        name: form.name,
        issuerName: form.issuerName,
        pdfBase64: form.pdfBase64,
        ...(form.fontBase64 ? { fontBase64: form.fontBase64 } : {}),
        fieldMap: form.fieldMap,
        ...(addQr.value ? { qr: form.qr } : {}),
      },
    });
    message.value = tr(
      "Шаблон сохранён как черновик. Для выдачи необходимо независимое утверждение.",
      "Үлгі жоба ретінде сақталды. Құжат беру үшін тәуелсіз бекіту қажет.",
    );
    await refresh();
  } catch (e) {
    failure.value = errorText(e);
  } finally {
    busy.value = false;
  }
}
async function approve() {
  busy.value = true;
  failure.value = "";
  message.value = "";
  try {
    await api(
      "/admin/credential-templates/" +
        encodeURIComponent(selected.value) +
        "/approve",
      { method: "POST", body: { reason: reason.value } },
    );
    message.value = tr("Шаблон утверждён.", "Үлгі бекітілді.");
    selected.value = "";
    approved.value = false;
    await refresh();
  } catch (e) {
    failure.value = errorText(e);
  } finally {
    busy.value = false;
  }
}
useHead(() => ({
  title: tr("Шаблоны документов — OT Center", "Құжат үлгілері — OT Center"),
  meta: [{ name: "robots", content: "noindex, nofollow" }],
}));
</script>
<template>
  <LmsShell :title="tr('Шаблоны документов', 'Құжат үлгілері')" back="/admin"
    ><LmsState :pending="pending" :error="error" @retry="refresh"
      ><p class="lms-note">
        {{
          tr(
            "Загрузите действующий бланк OT Center в PDF с текстовыми полями AcroForm. Выпуск использует утверждённый шаблон, подтверждённые результаты обучения и запись выдачи.",
            "AcroForm мәтін өрістері бар қолданыстағы OT Center PDF бланкін жүктеңіз. Құжат беру бекітілген үлгіні, расталған оқу нәтижелерін және беру жазбасын қолданады.",
          )
        }}
      </p>
      <div class="grid gap-4 md:grid-cols-2">
        <article
          v-for="template in data?.templates"
          :key="template.id"
          class="lms-card space-y-3"
        >
          <h2 class="font-semibold">{{ template.name }}</h2>
          <p class="text-sm">
            {{ template.programId }} · {{ statusLabel(template.status) }}
          </p>
          <a
            class="lms-button secondary"
            :href="
              '/api/v1/admin/credential-templates/' +
              encodeURIComponent(template.id) +
              '/preview'
            "
            target="_blank"
            rel="noopener noreferrer"
            >{{ tr("Открыть бланк PDF", "PDF бланкін ашу") }} ↗</a
          ><button
            v-if="template.status === 'draft'"
            class="lms-button secondary"
            @click="
              selected = template.id;
              approved = false;
              reason = '';
            "
          >
            {{ tr("Рассмотреть и утвердить", "Қарау және бекіту") }}
          </button>
        </article>
      </div>
      <p v-if="!data?.templates?.length" class="lms-note">
        {{
          tr(
            "Шаблонов пока нет. Оформление документов станет доступно после загрузки и утверждения подходящего бланка.",
            "Үлгілер әзірге жоқ. Құжаттарды рәсімдеу сәйкес бланк жүктеліп, бекітілгеннен кейін қолжетімді болады.",
          )
        }}
      </p>
      <form
        v-if="selected"
        class="lms-card space-y-4"
        @submit.prevent="approve"
      >
        <h2 class="text-xl font-bold">
          {{ tr("Утверждение шаблона", "Үлгіні бекіту") }}
        </h2>
        <label class="block space-y-2"
          ><span>{{
            tr(
              "Основание и результаты проверки",
              "Негіздеме және тексеру нәтижелері",
            )
          }}</span
          ><textarea
            v-model="reason"
            required
            minlength="10"
            maxlength="2000"
          /></label
        ><label class="flex items-start gap-3"
          ><input
            v-model="approved"
            required
            type="checkbox"
            class="mt-1"
          /><span>{{
            tr(
              "Я проверил(-а) бланк и соответствие полей, подтверждаю использование для указанной программы.",
              "Бланк пен өрістер сәйкестігін тексердім, көрсетілген бағдарлама үшін қолдануды растаймын.",
            )
          }}</span></label
        ><button class="lms-button" :disabled="busy || !approved">
          {{ tr("Утвердить шаблон", "Үлгіні бекіту") }}
        </button>
      </form>
      <details class="lms-card">
        <summary class="cursor-pointer text-xl font-bold">
          {{ tr("Добавить бланк документа", "Құжат бланкін қосу") }}
        </summary>
        <form class="mt-5 space-y-5" @submit.prevent="create">
          <div class="grid gap-5 md:grid-cols-2">
            <label class="space-y-2"
              ><span>{{ tr("Программа", "Бағдарлама") }}</span
              ><select v-model="form.programId" required>
                <option value="" disabled>
                  {{ tr("Выберите направление", "Бағытты таңдаңыз") }}
                </option>
                <option v-for="d in LMS_DIRECTIONS" :key="d.id" :value="d.id">
                  {{ d.ru }}
                </option>
              </select></label
            ><label class="space-y-2"
              ><span>{{ tr("Название шаблона", "Үлгі атауы") }}</span
              ><input v-model="form.name" required maxlength="120" /></label
            ><label class="space-y-2 md:col-span-2"
              ><span>{{
                tr(
                  "Наименование организации, выдающей документ",
                  "Құжат беретін ұйым атауы",
                )
              }}</span
              ><input
                v-model="form.issuerName"
                required
                maxlength="250" /></label
            ><label class="space-y-2"
              ><span>{{
                tr("Бланк PDF до 1 МБ", "PDF бланкі 1 МБ-қа дейін")
              }}</span
              ><input
                type="file"
                accept="application/pdf,.pdf"
                required
                @change="readFile($event, 'pdf')"
              /><small>{{ pdfName }}</small></label
            ><label class="space-y-2"
              ><span>{{
                tr(
                  "Шрифт TTF/OTF с кириллицей, до 2 МБ",
                  "Кириллицасы бар TTF/OTF қарпі, 2 МБ-қа дейін",
                )
              }}</span
              ><input
                type="file"
                accept=".ttf,.otf"
                @change="readFile($event, 'font')"
              /><small>{{ fontName }}</small></label
            >
          </div>
          <h3 class="font-semibold">
            {{
              tr(
                "Имена текстовых полей в PDF",
                "PDF ішіндегі мәтін өрістерінің атаулары",
              )
            }}
          </h3>
          <div class="grid gap-5 md:grid-cols-2">
            <label v-for="f in fields" :key="f.key" class="space-y-2"
              ><span>{{ f.label }}</span
              ><input v-model="form.fieldMap[f.key]" required maxlength="120"
            /></label>
          </div>
          <label class="flex items-center gap-3"
            ><input v-model="addQr" type="checkbox" />{{
              tr(
                "Добавлять QR-код публичной проверки",
                "Жария тексеру QR-кодын қосу",
              )
            }}</label
          >
          <div v-if="addQr" class="grid gap-4 sm:grid-cols-4">
            <label class="space-y-2"
              ><span>{{ tr("Страница (с 0)", "Бет (0-ден)") }}</span
              ><input
                v-model.number="form.qr.page"
                type="number"
                min="0"
                max="3"
                required /></label
            ><label class="space-y-2"
              ><span>X (pt)</span
              ><input
                v-model.number="form.qr.x"
                type="number"
                min="0"
                required /></label
            ><label class="space-y-2"
              ><span>Y (pt)</span
              ><input
                v-model.number="form.qr.y"
                type="number"
                min="0"
                required /></label
            ><label class="space-y-2"
              ><span>{{ tr("Размер, pt", "Өлшемі, pt") }}</span
              ><input
                v-model.number="form.qr.size"
                type="number"
                min="40"
                max="180"
                required
            /></label>
          </div>
          <button class="lms-button" :disabled="busy || !form.pdfBase64">
            {{ tr("Сохранить шаблон на проверку", "Үлгіні тексеруге сақтау") }}
          </button>
        </form>
      </details>
      <p v-if="failure" class="lms-error" role="alert">{{ failure }}</p>
      <p v-if="message" class="lms-success" role="status">
        {{ message }}
      </p></LmsState
    ></LmsShell
  >
</template>
