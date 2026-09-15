<script setup lang="ts">
import { leadContextQuery } from '~/shared/lead-context';
const route = useRoute();
const path = useLocalePath();
const { api, tr, locale, money, errorText } = useLmsApi();
const id = String(route.params.courseId);
const busy = ref(false);
const failure = ref("");
const accepted = ref(false);
let orderKey = "";
const { data, pending, error, refresh } = await useAsyncData(
  "lms-order-program-" + id,
  () => api<any>("/catalog/programs/" + encodeURIComponent(id)),
);
const program = computed(() => data.value?.program || data.value);
const version = computed(() =>
  program.value?.versions?.find((v: any) => v.id === route.query.versionId),
);
const contextQuery = computed(() => leadContextQuery({ city: route.query.city, format: route.query.format }));
const backQuery = computed(() => ({
  ...contextQuery.value,
  ...(typeof route.query.versionId === 'string' ? { versionId: route.query.versionId } : {}),
  ...(typeof route.query.q === 'string' ? { q: route.query.q } : {}),
  ...(typeof route.query.direction === 'string' ? { direction: route.query.direction } : {}),
}));
const consultationQuery = computed(() => leadContextQuery({ programId: program.value?.id || id, ...contextQuery.value }));
watch(() => version.value?.id, () => { orderKey = ''; accepted.value = false; });
const { track } = useLmsAnalytics();
onMounted(() => {
  watch(() => version.value?.id, value => { if (value && program.value?.id) track('checkout_view', { programId: program.value.id, audience: version.value?.billingBasis === 'organization' ? 'b2b' : 'b2c' }); }, { immediate: true });
});
async function createOrder() {
  if (busy.value || !accepted.value || !version.value || version.value.intakeOpen === false || version.value.priceMinor == null || version.value.billingBasis === "organization") return;
  busy.value = true;
  failure.value = "";
  try {
    orderKey ||= crypto.randomUUID();
    const result = await api<any>("/orders", {
      method: "POST",
      headers: { "Idempotency-Key": orderKey },
      body: { versionId: version.value.id },
    });
    await navigateTo({
      path: path("/payment/pending"),
      query: { order: result.order.id, ...contextQuery.value },
    });
  } catch (e) {
    if (lmsErrorStatus(e) === 401)
      await navigateTo({
        path: path("/auth/login"),
        query: { returnTo: route.fullPath },
      });
    else failure.value = errorText(e);
  } finally {
    busy.value = false;
  }
}
useHead(() => ({
  title: tr("Запись на обучение — OT Center", "Оқуға жазылу — OT Center"),
  meta: [{ name: "robots", content: "noindex, nofollow" }],
}));
</script>
<template>
  <LmsShell
    :title="tr('Запись на обучение', 'Оқуға жазылу')"
    :back="'/courses/' + id"
    :back-query="backQuery"
    ><LmsState :pending="pending" :error="error" @retry="refresh"
      ><div class="lms-card ed-order-sheet max-w-2xl space-y-5">
        <p class="ed-commerce-kicker">{{ tr('Проверьте выбранную программу', 'Таңдалған бағдарламаны тексеріңіз') }}</p>
        <h2 class="text-xl font-semibold">
          {{ program?.title?.[locale === "kk" ? "kk" : "ru"] }}
        </h2>
        <div v-if="version?.intakeOpen === false" class="space-y-4">
          <p class="lms-note">{{ tr("Набор на эту версию программы приостановлен. Новый заказ сейчас недоступен.", "Бағдарламаның осы нұсқасына қабылдау тоқтатылған. Жаңа тапсырыс қазір қолжетімсіз.") }}</p>
          <NuxtLink class="lms-button secondary" :to="{ path: path('/contacts'), query: consultationQuery }">{{ tr("Обсудить обучение", "Оқуды талқылау") }}</NuxtLink>
        </div>
        <div v-else-if="version?.billingBasis === 'organization'" class="space-y-4">
          <p class="lms-note">
            {{
              tr(
                "Эта программа оформляется для организации. Выберите сотрудников и согласуйте счёт в корпоративном кабинете.",
                "Бұл бағдарлама ұйым үшін рәсімделеді. Қызметкерлерді таңдап, корпоративтік кабинетте шотты келісіңіз.",
              )
            }}
          </p>
          <NuxtLink class="lms-button" :to="{ path: path('/cabinet/organization'), query: backQuery }">{{
            tr("Кабинет организации", "Ұйым кабинеті")
          }}</NuxtLink>
        </div>
        <template v-else-if="version"
          ><p>{{ version.title }} · {{ version.language.toUpperCase() }}</p>
          <p class="ed-program-price">
            {{ money(version.priceMinor, version.currency) }}
          </p>
          <p class="lms-note">
            {{
              tr(
                "Заказ фиксирует выбранную программу и стоимость. Доступ к обучению и оформление документа зависят от условий назначения и результата проверки знаний.",
                "Тапсырыс таңдалған бағдарлама мен құнын бекітеді. Оқуға қолжетімділік және құжатты рәсімдеу тағайындау шарттары мен білімді тексеру нәтижесіне байланысты.",
              )
            }}
          </p>
          <label class="flex items-start gap-3"
            ><input v-model="accepted" type="checkbox" class="mt-1" /><span
              >{{
                tr(
                  "Я ознакомился(-ась) с содержанием программы и",
                  "Бағдарлама мазмұнымен және",
                )
              }}
              <NuxtLink :to="path('/public-offer')">{{
                tr("условиями оферты", "оферта шарттарымен")
              }}</NuxtLink
              >.</span
            ></label
          ><button
            class="lms-button"
            :disabled="busy || !accepted || version.priceMinor == null"
            @click="createOrder"
          >
            {{
              busy
                ? tr("Создаём заказ…", "Тапсырыс құрылуда…")
                : tr("Создать заказ", "Тапсырыс жасау")
            }}
          </button>
          <p v-if="version.priceMinor == null" class="text-sm text-slate-600">
            {{
              tr(
                "Стоимость нужно согласовать с учебным центром.",
                "Бағаны оқу орталығымен келісу қажет.",
              )
            }}
          </p></template
        >
        <p v-else class="lms-note">
          {{
            tr(
              "Для записи выберите доступный вариант программы в каталоге или обратитесь в учебный центр.",
              "Тіркелу үшін каталогтан қолжетімді бағдарлама нұсқасын таңдаңыз немесе оқу орталығына хабарласыңыз.",
            )
          }}
        </p>
        <p v-if="failure" class="lms-error" role="alert">{{ failure }}</p>
        <NuxtLink class="ed-commerce-text-link" :to="{ path: path('/contacts'), query: consultationQuery }">{{
          tr("Согласовать условия", "Шарттарды келісу")
        }}</NuxtLink>
      </div></LmsState
    ></LmsShell
  >
</template>
