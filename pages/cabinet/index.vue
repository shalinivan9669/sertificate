<script setup lang="ts">
const { api, tr, request, errorText, date, money, statusLabel } = useLmsApi();
const path = useLocalePath();
const failure = ref("");
const signingOut = ref(false);
const {
  data: me,
  error: meError,
  pending: mePending,
  refresh: refreshMe,
} = await useAsyncData("lms-me", () => api<any>("/me"));
const { data, pending, error, refresh } = await useAsyncData(
  "lms-enrollments",
  () => api<{ enrollments: LmsEnrollment[] }>("/me/enrollments"),
);
const {
  data: commerce,
  error: commerceError,
  refresh: refreshCommerce,
} = await useAsyncData("lms-commerce", () => api<any>("/commerce/me"));
useHead(() => ({
  title: tr("Личный кабинет — OT Center", "Жеке кабинет — OT Center"),
  meta: [{ name: "robots", content: "noindex, nofollow" }],
}));
async function logout() {
  signingOut.value = true;
  failure.value = "";
  try {
    await request("/api/auth/sign-out", { method: "POST", body: {} });
    clearNuxtData((key) => key.startsWith("lms-"));
    await navigateTo(path("/auth/login"));
  } catch (e) {
    failure.value = errorText(e);
  } finally {
    signingOut.value = false;
  }
}
</script>
<template>
  <LmsShell :title="tr('Личный кабинет', 'Жеке кабинет')">
    <LmsState :pending="mePending" :error="meError" @retry="refreshMe"
      ><div
        v-if="me?.user"
        class="lms-card flex flex-wrap items-center justify-between gap-5"
      >
        <div>
          <h2 class="text-xl font-semibold">{{ me.user.name }}</h2>
          <p class="text-sm text-slate-600">{{ me.user.email }}</p>
        </div>
        <div class="flex flex-wrap gap-3">
          <NuxtLink
            class="lms-button secondary"
            :to="path('/cabinet/security')"
            >{{ tr("Безопасность", "Қауіпсіздік") }}</NuxtLink
          ><NuxtLink
            class="lms-button secondary"
            :to="path('/cabinet/organization')"
            >{{ tr("Моя организация", "Менің ұйымым") }}</NuxtLink
          ><NuxtLink
            v-if="me.user.role !== 'learner'"
            class="lms-button secondary"
            :to="path('/admin')"
            >{{ tr("Управление", "Басқару") }}</NuxtLink
          ><button
            class="lms-button secondary"
            :disabled="signingOut"
            @click="logout"
          >
            {{ tr("Выйти", "Шығу") }}
          </button>
        </div>
        <p v-if="failure" role="alert" class="lms-error">{{ failure }}</p>
      </div></LmsState
    >
    <section v-if="me?.user" class="space-y-4">
      <h2 class="text-2xl font-bold">
        {{ tr("Моё обучение", "Менің оқуым") }}
      </h2>
      <LmsState
        :pending="pending"
        :error="error"
        :empty="!data?.enrollments.length"
        :empty-text="
          tr(
            'У вас пока нет назначенных программ. Выберите программу в каталоге или свяжитесь с ответственным за обучение.',
            'Сізге әлі бағдарламалар тағайындалмаған. Каталогтан бағдарламаны таңдаңыз немесе оқуға жауапты адамға хабарласыңыз.',
          )
        "
        @retry="refresh"
        ><div class="grid gap-5 md:grid-cols-2">
          <article
            v-for="e in data?.enrollments"
            :key="e.id"
            class="lms-card space-y-4"
          >
            <p class="text-sm text-brand-accent">{{ statusLabel(e.status) }}</p>
            <h3 class="text-xl font-semibold">{{ e.title }}</h3>
            <div>
              <div class="mb-2 flex justify-between text-sm">
                <span
                  >{{ tr("Завершено уроков", "Аяқталған сабақтар") }}:
                  {{ e.progress.completed }} / {{ e.progress.total }}</span
                ><span>{{ e.progress.percent }}%</span>
              </div>
              <progress
                class="h-2 w-full accent-brand-accent"
                :value="e.progress.percent"
                max="100"
                :aria-label="tr('Прогресс обучения', 'Оқу барысы')"
              />
            </div>
            <p v-if="e.accessUntil" class="text-sm text-slate-600">
              {{ tr("Доступ до", "Қолжетімділік мерзімі") }}
              {{ date(e.accessUntil) }}
            </p>
            <NuxtLink class="lms-button" :to="path('/learn/' + e.id)">{{
              tr("Открыть обучение", "Оқуды ашу")
            }}</NuxtLink>
          </article>
        </div></LmsState
      >
    </section>
    <section v-if="me?.user" class="space-y-4">
      <h2 class="text-2xl font-bold">
        {{ tr("Документы и заказы", "Құжаттар мен тапсырыстар") }}
      </h2>
      <LmsState :error="commerceError" @retry="refreshCommerce"
        ><div class="grid gap-5 md:grid-cols-2">
          <div class="lms-card space-y-4">
            <h3 class="font-semibold">
              {{ tr("Мои документы", "Менің құжаттарым") }}
            </h3>
            <p
              v-if="!commerce?.credentials?.length"
              class="text-sm text-slate-600"
            >
              {{
                tr(
                  "Оформленных документов пока нет. Статус появится после проверки результатов и оформления.",
                  "Әзірге рәсімделген құжаттар жоқ. Нәтижелер тексеріліп, рәсімделгеннен кейін күйі көрсетіледі.",
                )
              }}
            </p>
            <NuxtLink
              v-for="c in commerce?.credentials"
              :key="c.id"
              class="block rounded-lg border p-3"
              :to="path('/certificates/' + c.id)"
              >{{ c.programTitle
              }}<span class="mt-1 block text-sm"
                >{{ c.serial }} · {{ statusLabel(c.status) }}</span
              ></NuxtLink
            >
          </div>
          <div class="lms-card space-y-4">
            <h3 class="font-semibold">
              {{ tr("Мои заказы", "Менің тапсырыстарым") }}
            </h3>
            <p v-if="!commerce?.orders?.length" class="text-sm text-slate-600">
              {{ tr("Заказов пока нет.", "Әзірге тапсырыстар жоқ.") }}
            </p>
            <NuxtLink
              v-for="o in commerce?.orders"
              :key="o.id"
              class="block rounded-lg border p-3"
              :to="{ path: path('/payment/pending'), query: { order: o.id } }"
              >{{ money(o.amountMinor, o.currency) }} ·
              {{ statusLabel(o.status)
              }}<span class="mt-1 block text-sm">{{
                date(o.createdAt)
              }}</span></NuxtLink
            >
          </div>
        </div></LmsState
      >
    </section>
    <LmsNotifications v-if="me?.user" />
  </LmsShell>
</template>
