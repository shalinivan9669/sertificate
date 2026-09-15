<script setup lang="ts">
import { leadContextQuery } from '~/shared/lead-context';
const route = useRoute();
const path = useLocalePath();
const { api, tr, money, date, statusLabel, errorText } = useLmsApi();
const id = computed(() => typeof route.query.order === "string" ? route.query.order : "");
const contextQuery = computed(() => leadContextQuery({ city: route.query.city, format: route.query.format }));
const busy = ref(false);
const failure = ref("");
const checkout = ref<any>(null);
const { data, pending, error, refresh } = await useAsyncData(
  computed(() => "lms-order-" + id.value),
  () =>
    id.value ? api<any>("/orders/" + encodeURIComponent(id.value)) : Promise.resolve(null),
);
const { data: commerce } = await useAsyncData("lms-commerce", () =>
  api<any>("/commerce/me"),
);
const order = computed(() => data.value?.order);
async function startCheckout() {
  if (!id.value || busy.value) return;
  busy.value = true;
  failure.value = "";
  try {
    checkout.value = await api(
      "/orders/" + encodeURIComponent(id.value) + "/checkout",
      { method: "POST", body: {} },
    );
    await refresh();
  } catch (e) {
    failure.value = errorText(e);
  } finally {
    busy.value = false;
  }
}
useHead(() => ({
  title: tr("Статус заказа — OT Center", "Тапсырыс күйі — OT Center"),
  meta: [{ name: "robots", content: "noindex, nofollow" }],
}));
</script>
<template>
  <LmsShell :title="tr('Статус заказа', 'Тапсырыс күйі')" back="/cabinet" :back-query="contextQuery"
    ><LmsState
      :pending="pending"
      :error="error"
      :empty="!id"
      :empty-text="
        tr(
          'Выберите заказ в личном кабинете.',
          'Жеке кабинеттен тапсырысты таңдаңыз.',
        )
      "
      @retry="refresh"
      ><div v-if="order" class="lms-card ed-order-sheet max-w-2xl space-y-5">
        <p class="ed-commerce-kicker">{{ tr('Состояние заказа', 'Тапсырыс күйі') }}</p>
        <h2 class="text-xl font-semibold">{{ statusLabel(order.status) }}</h2>
        <p class="ed-program-price">
          {{ money(order.amountMinor, order.currency) }}
        </p>
        <p class="text-sm text-slate-600">{{ date(order.createdAt) }}</p>
        <LmsOrderAmounts :order="order" />
        <p v-if="['partially_refunded', 'refunded'].includes(order.status)" class="lms-note">
          {{ tr("Суммы и состояние возврата получены из финансовой записи на сервере. История обучения сохраняется; по условиям дальнейшего доступа обратитесь в учебный центр.", "Қайтару сомалары мен күйі сервердегі қаржылық жазбадан алынды. Оқу тарихы сақталады; кейінгі қолжетімділік шарттарын оқу орталығынан нақтылаңыз.") }}
        </p>
        <p v-if="commerce?.paymentProvider === 'disabled'" class="lms-note">
          {{
            tr(
              "Онлайн-оплата сейчас недоступна. Свяжитесь с учебным центром для согласования способа оплаты.",
              "Онлайн төлем әзірге қолжетімсіз. Төлем тәсілін келісу үшін оқу орталығына хабарласыңыз.",
            )
          }}
        </p>
        <template v-if="commerce?.paymentProvider === 'sandbox'"
          ><p class="lms-note">
            {{
              tr(
                "Тестовый режим оплаты. Реальные деньги не списываются. Тестовый платёж не подтверждает реальную оплату.",
                "Төлемнің тестілік режимі. Нақты ақша алынбайды. Тестілік төлем нақты төлемді растамайды.",
              )
            }}
          </p>
          <button
            v-if="!['paid', 'succeeded', 'partially_refunded', 'refunded'].includes(order.status)"
            class="lms-button"
            :disabled="busy"
            @click="startCheckout"
          >
            {{
              tr(
                "Создать тестовую платёжную сессию",
                "Тестілік төлем сеансын жасау",
              )
            }}
          </button></template
        >
        <p v-if="checkout" class="lms-note" role="status">
          {{
            tr(
              "Тестовая сессия создана. Ожидается подтверждение провайдера; переход по страницам не меняет статус оплаты.",
              "Тестілік сеанс құрылды. Провайдердің растауы күтілуде; беттерге өту төлем күйін өзгертпейді.",
            )
          }}
        </p>
        <p v-if="failure" class="lms-error" role="alert">{{ failure }}</p>
        <div class="flex flex-wrap gap-3">
          <NuxtLink v-if="['paid', 'succeeded'].includes(order.status)" class="lms-button" :to="{ path: path('/cabinet'), hash: '#learning' }">{{ tr('Перейти к моему обучению', 'Менің оқуыма өту') }}</NuxtLink>
          <button
            class="lms-button secondary"
            :disabled="pending"
            @click="refresh()"
          >
            {{ tr("Обновить статус", "Күйін жаңарту") }}</button
          ><NuxtLink class="lms-button secondary" :to="{ path: path('/contacts'), query: contextQuery }">{{
            tr("Связаться с учебным центром", "Оқу орталығына хабарласу")
          }}</NuxtLink>
        </div>
      </div></LmsState
    ></LmsShell
  >
</template>
