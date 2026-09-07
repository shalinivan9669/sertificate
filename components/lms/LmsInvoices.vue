<script setup lang="ts">
const props = defineProps<{
  organizationId?: string;
  organizationName?: string;
  members?: any[];
  finance?: boolean;
}>();
const { api, tr, money, date, statusLabel, errorText } = useLmsApi();
const endpoint = computed(() =>
  props.finance
    ? "/admin/invoices"
    : "/organizations/" +
      encodeURIComponent(props.organizationId || "") +
      "/invoices",
);
const { data, pending, error, refresh } = await useAsyncData(
  "lms-invoices-" + (props.organizationId || "finance"),
  () => api<any>(endpoint.value),
);
const { data: catalog } = await useAsyncData("lms-catalog", () =>
  api<{ programs: LmsProgram[] }>("/catalog/programs"),
);
const versions = computed(
  () =>
    catalog.value?.programs
      .flatMap((p) => p.versions)
      .filter((v) => v.accessModel === "paid") || [],
);
const invoices = computed(() => data.value?.invoices || []);
const userIds = ref<string[]>([]);
const versionId = ref("");
const buyer = reactive({
  name: props.organizationName || "",
  bin: "",
  address: "",
});
const busy = ref(false);
const failure = ref("");
const message = ref("");
const confirmed = ref(false);
const selected = ref<any>(null);
const cancelling = ref<any>(null);
const cancelReason = ref("");
const cancelConfirmed = ref(false);
const amount = ref<number>(0);
const reference = ref("");
const reason = ref("");
const reconciled = ref(false);
let key = "";
watch(
  [userIds, versionId, buyer],
  () => {
    key = "";
    confirmed.value = false;
  },
  { deep: true },
);
const version = computed(() =>
  versions.value.find((v) => v.id === versionId.value),
);
async function create() {
  if (!props.organizationId || !confirmed.value) return;
  busy.value = true;
  failure.value = "";
  message.value = "";
  try {
    key ||= crypto.randomUUID();
    await api(endpoint.value, {
      method: "POST",
      headers: { "Idempotency-Key": key },
      body: { versionId: versionId.value, userIds: userIds.value, buyer },
    });
    message.value = tr(
      "Счёт сформирован. Реквизиты и итоговая сумма зафиксированы в документе.",
      "Шот жасалды. Деректемелер мен қорытынды сома құжатта бекітілді.",
    );
    confirmed.value = false;
    await refresh();
  } catch (e) {
    failure.value =
      lmsErrorStatus(e) === 503
        ? tr(
            "Выставление счетов ещё не настроено. Учебному центру нужно добавить утверждённые банковские реквизиты.",
            "Шоттарды ұсыну әлі бапталмаған. Оқу орталығы бекітілген банк деректемелерін қосуы керек.",
          )
        : errorText(e);
  } finally {
    busy.value = false;
  }
}
function choose(invoice: any) {
  selected.value = invoice;
  amount.value = (invoice.amountMinor ?? invoice.totalMinor ?? 0) / 100;
  reference.value = "";
  reason.value = "";
  reconciled.value = false;
}
async function confirmPayment() {
  if (!selected.value || !reconciled.value) return;
  busy.value = true;
  failure.value = "";
  message.value = "";
  try {
    await api(
      "/admin/invoices/" + encodeURIComponent(selected.value.id) + "/confirm",
      {
        method: "POST",
        body: {
          amountMinor: Math.round(amount.value * 100),
          currency: "KZT",
          reference: reference.value,
          reason: reason.value,
        },
      },
    );
    message.value = tr(
      "Поступление по счёту подтверждено с основанием. Доступ обновлён согласно условиям назначения.",
      "Шот бойынша қаражаттың түсуі негіздемемен расталды. Қолжетімділік тағайындау шарттарына сәйкес жаңартылды.",
    );
    selected.value = null;
    await refresh();
  } catch (e) {
    failure.value = errorText(e);
  } finally {
    busy.value = false;
  }
}
async function cancelInvoice() {
  if (!cancelling.value || !cancelConfirmed.value) return;
  busy.value = true;
  failure.value = "";
  message.value = "";
  try {
    await api(
      "/invoices/" + encodeURIComponent(cancelling.value.id) + "/cancel",
      { method: "POST", body: { reason: cancelReason.value } },
    );
    cancelling.value = null;
    message.value = tr(
      "Счёт отменён. Не оплачивайте его; при необходимости сформируйте новый.",
      "Шот жойылды. Оны төлемеңіз; қажет болса жаңасын жасаңыз.",
    );
    await refresh();
  } catch (e) {
    failure.value = errorText(e);
  } finally {
    busy.value = false;
  }
}
const invoiceStatus = (status: string) =>
  status === "issued"
    ? tr("Ожидает оплаты", "Төлемді күтуде")
    : status === "confirmed"
      ? tr("Поступление подтверждено", "Қаражаттың түсуі расталды")
      : status === "cancelled"
        ? tr("Счёт отменён", "Шот жойылды")
        : statusLabel(status);
</script>
<template>
  <section class="lms-card space-y-5">
    <h2 class="text-xl font-bold">
      {{ tr("Счета на обучение", "Оқу шоттары") }}
    </h2>
    <LmsState :pending="pending" :error="error" @retry="refresh"
      ><p v-if="!invoices.length" class="lms-note">
        {{
          tr("Выставленных счетов пока нет.", "Әзірге ұсынылған шоттар жоқ.")
        }}
      </p>
      <div class="grid gap-4 md:grid-cols-2">
        <article
          v-for="invoice in invoices"
          :key="invoice.id"
          class="space-y-3 rounded-xl border p-4"
        >
          <h3 class="font-semibold">
            {{ tr("Счёт", "Шот") }}
            {{ invoice.number || invoice.invoiceNumber || invoice.id }}
          </h3>
          <p>
            {{
              money(invoice.amountMinor ?? invoice.totalMinor, invoice.currency)
            }}
            · {{ invoiceStatus(invoice.status) }}
          </p>
          <p v-if="invoice.createdAt" class="text-sm text-slate-500">
            {{ date(invoice.createdAt) }}
          </p>
          <a
            class="lms-button secondary"
            :href="
              '/api/v1/invoices/' + encodeURIComponent(invoice.id) + '/download'
            "
            target="_blank"
            rel="noopener noreferrer"
            >{{
              tr("Открыть / распечатать счёт", "Шотты ашу / басып шығару")
            }}
            ↗</a
          ><button
            v-if="
              finance &&
              !['paid', 'cancelled', 'confirmed'].includes(invoice.status)
            "
            class="lms-button"
            @click="choose(invoice)"
          >
            {{ tr("Сверить поступление", "Қаражаттың түсуін салыстыру") }}
          </button>
          <button
            v-if="!finance && invoice.status === 'issued'"
            class="lms-button secondary"
            @click="
              cancelling = invoice;
              cancelReason = '';
              cancelConfirmed = false;
            "
          >
            {{ tr("Отменить счёт", "Шотты жою") }}
          </button>
        </article>
      </div></LmsState
    >
    <p v-if="data?.enabled === false" class="lms-note">
      {{
        tr(
          "Выставление счетов пока отключено: учебному центру нужно настроить утверждённые реквизиты. Ранее созданные документы доступны в списке.",
          "Шоттарды ұсыну әзірге өшірілген: оқу орталығы бекітілген деректемелерді баптауы керек. Бұрын жасалған құжаттар тізімде қолжетімді.",
        )
      }}
    </p>
    <form
      v-if="cancelling"
      class="space-y-4 rounded-xl border p-4"
      @submit.prevent="cancelInvoice"
    >
      <h3 class="font-semibold">
        {{ tr("Отмена счёта", "Шотты жою") }} {{ cancelling.number }}
      </h3>
      <label class="block space-y-2"
        ><span>{{ tr("Основание отмены", "Жою негізі") }}</span
        ><textarea
          v-model="cancelReason"
          required
          minlength="10"
          maxlength="2000"
        /></label
      ><label class="flex items-start gap-3"
        ><input
          v-model="cancelConfirmed"
          required
          type="checkbox"
          class="mt-1"
        /><span>{{
          tr(
            "Подтверждаю отмену неоплаченного счёта. Оплачивать его после отмены нельзя.",
            "Төленбеген шотты жоюды растаймын. Жойылғаннан кейін оны төлеуге болмайды.",
          )
        }}</span></label
      ><button class="lms-button danger" :disabled="busy || !cancelConfirmed">
        {{ tr("Отменить счёт с основанием", "Шотты негіздемемен жою") }}
      </button>
    </form>
    <details v-if="!finance && data?.enabled !== false">
      <summary class="cursor-pointer font-semibold">
        {{
          tr("Сформировать счёт для сотрудников", "Қызметкерлер үшін шот жасау")
        }}
      </summary>
      <form class="mt-5 space-y-5" @submit.prevent="create">
        <label class="block space-y-2"
          ><span>{{ tr("Платная программа", "Ақылы бағдарлама") }}</span
          ><select v-model="versionId" required>
            <option value="" disabled>
              {{ tr("Выберите программу", "Бағдарламаны таңдаңыз") }}
            </option>
            <option v-for="v in versions" :key="v.id" :value="v.id" :disabled="v.intakeOpen === false">
              {{ v.title }} · {{ v.language.toUpperCase() }} ·
              {{ money(v.priceMinor, v.currency) }}{{ v.intakeOpen === false ? ' · ' + tr('Набор приостановлен', 'Қабылдау тоқтатылған') : '' }}
              {{
                v.billingBasis === "organization"
                  ? tr("на организацию", "ұйымға")
                  : tr("на слушателя", "тыңдаушыға")
              }}
            </option>
          </select></label
        >
        <p v-if="!versions.length" class="lms-note">
          {{
            tr(
              "Опубликованных платных программ пока нет.",
              "Жарияланған ақылы бағдарламалар әзірге жоқ.",
            )
          }}
        </p>
        <fieldset class="space-y-2">
          <legend class="mb-3 font-semibold">
            {{ tr("Сотрудники для обучения", "Оқытылатын қызметкерлер") }}
          </legend>
          <label
            v-for="member in members?.filter((m) => m.status === 'active')"
            :key="member.id"
            class="flex items-start gap-3 rounded-lg border p-3"
            ><input
              v-model="userIds"
              type="checkbox"
              :value="member.id"
              class="mt-1"
            /><span
              >{{ member.name
              }}<small class="block">{{ member.email }}</small></span
            ></label
          >
        </fieldset>
        <div class="grid gap-4 md:grid-cols-2">
          <label class="space-y-2"
            ><span>{{
              tr("Наименование плательщика", "Төлеушінің атауы")
            }}</span
            ><input v-model="buyer.name" required maxlength="200" /></label
          ><label class="space-y-2"
            ><span>{{ tr("БИН плательщика", "Төлеушінің БСН") }}</span
            ><input
              v-model="buyer.bin"
              required
              inputmode="numeric"
              pattern="[0-9]{12}"
              maxlength="12" /></label
          ><label class="space-y-2 md:col-span-2"
            ><span>{{ tr("Адрес плательщика", "Төлеушінің мекенжайы") }}</span
            ><textarea
              v-model="buyer.address"
              required
              minlength="5"
              maxlength="500"
            />
          </label>
        </div>
        <p v-if="version" class="lms-note">
          {{ tr("Выбрано сотрудников", "Таңдалған қызметкерлер") }}:
          {{ userIds.length }} · {{ tr("Расчётная сумма", "Есептік сома") }}:
          {{
            money(
              (version.priceMinor || 0) *
                (version.billingBasis === "organization"
                  ? userIds.length
                    ? 1
                    : 0
                  : userIds.length),
              version.currency,
            )
          }}
        </p>
        <label class="flex items-start gap-3"
          ><input
            v-model="confirmed"
            type="checkbox"
            required
            class="mt-1"
          /><span>{{
            tr(
              "Проверил(-а) программу, список сотрудников и реквизиты плательщика.",
              "Бағдарламаны, қызметкерлер тізімін және төлеуші деректемелерін тексердім.",
            )
          }}</span></label
        ><button
          class="lms-button"
          :disabled="busy || !versionId || !userIds.length || !confirmed"
        >
          {{ tr("Сформировать счёт", "Шот жасау") }}
        </button>
      </form>
    </details>
    <form
      v-if="finance && selected"
      class="space-y-5 rounded-xl border bg-slate-50 p-4"
      @submit.prevent="confirmPayment"
    >
      <h3 class="font-semibold">
        {{
          tr(
            "Подтверждение банковского поступления",
            "Банкке қаражат түсуін растау",
          )
        }}
      </h3>
      <p class="lms-note">
        {{
          tr(
            "Подтверждайте только после сверки фактического поступления по выписке. Действие фиксирует доказательство и открывает доступ; банковский перевод эта форма не выполняет.",
            "Тек үзінді көшірме бойынша қаражаттың нақты түсуін салыстырғаннан кейін растаңыз. Әрекет дәлелді тіркеп, қолжетімділікті ашады; бұл нысан банк аударымын орындамайды.",
          )
        }}
      </p>
      <label class="block space-y-2"
        ><span>{{
          tr("Фактически поступившая сумма, ₸", "Нақты түскен сома, ₸")
        }}</span
        ><input
          v-model.number="amount"
          required
          type="number"
          min="0.01"
          step="0.01" /></label
      ><label class="block space-y-2"
        ><span>{{
          tr(
            "Номер банковского документа / платежа",
            "Банк құжатының / төлемнің нөмірі",
          )
        }}</span
        ><input
          v-model="reference"
          required
          minlength="3"
          maxlength="120" /></label
      ><label class="block space-y-2"
        ><span>{{
          tr(
            "Основание и результаты сверки",
            "Негіздеме және салыстыру нәтижелері",
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
          v-model="reconciled"
          required
          type="checkbox"
          class="mt-1"
        /><span>{{
          tr(
            "Я проверил(-а) поступление на согласованный счёт и подтверждаю соответствие суммы и плательщика.",
            "Келісілген шотқа қаражаттың түсуін тексердім және сома мен төлеушінің сәйкестігін растаймын.",
          )
        }}</span></label
      ><button class="lms-button" :disabled="busy || !reconciled">
        {{
          tr(
            "Подтвердить поступление с основанием",
            "Қаражаттың түсуін негіздемемен растау",
          )
        }}</button
      ><button
        class="lms-button secondary ml-2"
        type="button"
        @click="selected = null"
      >
        {{ tr("Отмена", "Болдырмау") }}
      </button>
    </form>
    <p v-if="failure" class="lms-error" role="alert">{{ failure }}</p>
    <p v-if="message" class="lms-success" role="status">{{ message }}</p>
  </section>
</template>
