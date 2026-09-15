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
const nextEnrollment = computed(() => data.value?.enrollments.find((item) =>
  item.status === 'active' && item.progress.percent < 100,
));
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
        class="ed-cabinet-profile"
      >
        <div>
          <h2 class="text-xl font-semibold">{{ me.user.name }}</h2>
          <p class="text-sm text-slate-600">{{ me.user.email }}</p>
        </div>
        <div class="flex flex-wrap gap-3">
          <NuxtLink
            class="ed-cabinet-profile-link"
            :to="path('/cabinet/security')"
            >{{ tr("Безопасность", "Қауіпсіздік") }}</NuxtLink
          ><NuxtLink
            class="ed-cabinet-profile-link"
            :to="path('/cabinet/organization')"
            >{{ tr("Моя организация", "Менің ұйымым") }}</NuxtLink
          ><NuxtLink
            class="ed-cabinet-profile-link"
            :to="path('/cabinet/reminders')"
            >{{ tr("Напоминания", "Еске салулар") }}</NuxtLink
          ><NuxtLink
            v-if="me.user.role !== 'learner'"
            class="ed-cabinet-profile-link"
            :to="path('/admin')"
            >{{ tr("Управление", "Басқару") }}</NuxtLink
          ><button
            class="ed-cabinet-profile-link"
            :disabled="signingOut"
            @click="logout"
          >
            {{ tr("Выйти", "Шығу") }}
          </button>
        </div>
        <p v-if="failure" role="alert" class="lms-error">{{ failure }}</p>
      </div></LmsState
    >
    <nav v-if="me?.user" class="ed-cabinet-sections" :aria-label="tr('Разделы кабинета', 'Кабинет бөлімдері')">
      <a href="#learning">{{ tr('Моё обучение', 'Менің оқуым') }}</a>
      <a href="#assessments">{{ tr('Проверка знаний', 'Білімді тексеру') }}</a>
      <a href="#documents">{{ tr('Документы', 'Құжаттар') }}</a>
      <a href="#orders">{{ tr('Заказы', 'Тапсырыстар') }}</a>
    </nav>
    <section v-if="me?.user && nextEnrollment && !error" class="ed-cabinet-next" :aria-label="tr('Продолжить обучение', 'Оқуды жалғастыру')">
      <div>
        <p class="ed-kicker">{{ tr('Продолжить обучение', 'Оқуды жалғастыру') }}</p>
        <h2>{{ nextEnrollment.title }}</h2>
        <p v-if="nextEnrollment.accessUntil">{{ tr('Доступ до', 'Қолжетімділік мерзімі') }} {{ date(nextEnrollment.accessUntil) }}</p>
      </div>
      <div>
        <EditorialProgress :value="nextEnrollment.progress.percent" :label="`${tr('Изучено уроков', 'Оқылған сабақтар')}: ${nextEnrollment.progress.completed} / ${nextEnrollment.progress.total}`" />
        <NuxtLink class="lms-button" :to="path('/learn/' + nextEnrollment.id)">{{ tr('Вернуться к урокам', 'Сабақтарға оралу') }} <CivicIcon name="arrow" /></NuxtLink>
      </div>
    </section>
    <section v-if="me?.user" id="learning" class="space-y-4 ed-menu-destination" tabindex="-1">
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
            class="lms-card ed-learning-card"
          >
            <p class="text-sm text-brand-accent">{{ statusLabel(e.status) }}</p>
            <h3 class="text-xl font-semibold">{{ e.title }}</h3>
            <EditorialProgress :value="e.progress.percent" :label="`${tr('Завершено уроков', 'Аяқталған сабақтар')}: ${e.progress.completed} / ${e.progress.total}`" />
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
    <section v-if="me?.user" id="assessments" class="space-y-4 ed-menu-destination" tabindex="-1">
      <h2 class="text-2xl font-bold">{{ tr('Проверка знаний', 'Білімді тексеру') }}</h2>
      <p class="text-sm text-slate-600">{{ tr('Выберите назначенный курс. На следующей странице — условия допуска, число попыток и время проверки. Открытие условий не запускает таймер.', 'Тағайындалған курсты таңдаңыз. Келесі бетте рұқсат шарттары, әрекеттер саны және тексеру уақыты көрсетілген. Шарттарды ашу таймерді іске қоспайды.') }}</p>
      <LmsState :pending="pending" :error="error" :empty="!data?.enrollments.length" :empty-text="tr('Проверка станет доступна в назначенной программе. Сначала выберите обучение или уточните назначение у ответственного.', 'Тексеру тағайындалған бағдарламада қолжетімді болады. Алдымен оқуды таңдаңыз немесе тағайындауды жауапты адамнан нақтылаңыз.')" @retry="refresh">
        <div class="ed-assessment-links"><NuxtLink v-for="item in data?.enrollments" :key="item.id" :to="path('/learn/' + item.id + '/pre-test')"><span>{{ item.title }}</span><span>{{ tr('Условия проверки', 'Тексеру шарттары') }} <span aria-hidden="true">↗</span></span></NuxtLink></div>
      </LmsState>
    </section>
    <section v-if="me?.user" class="space-y-4">
      <h2 class="text-2xl font-bold">
        {{ tr("Документы и заказы", "Құжаттар мен тапсырыстар") }}
      </h2>
      <LmsState :error="commerceError" @retry="refreshCommerce"
        ><div class="grid gap-5 md:grid-cols-2">
          <div id="documents" class="lms-card space-y-4 ed-menu-destination" tabindex="-1">
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
          <div id="orders" class="lms-card space-y-4 ed-menu-destination" tabindex="-1">
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
    <LmsAnalyticsConsent v-if="me?.user" />
    <LmsNotifications v-if="me?.user" />
  </LmsShell>
</template>
