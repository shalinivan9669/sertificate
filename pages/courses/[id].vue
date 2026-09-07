<script setup lang="ts">
const route = useRoute();
const path = useLocalePath();
const { api, tr, locale, money, date, errorText } = useLmsApi();
const { data, pending, error, refresh } = await useAsyncData(
  "lms-program-" + route.params.id,
  () =>
    api<any>(
      "/catalog/programs/" + encodeURIComponent(String(route.params.id)),
    ),
);
onMounted(() => {
  void refresh();
});
if (lmsErrorStatus(error.value) === 404)
  throw createError({ statusCode: 404, statusMessage: "Программа не найдена" });
const program = computed<LmsProgram | undefined>(
  () => data.value?.program || data.value,
);
const selected = ref("");
const busy = ref(false);
const failure = ref("");
const version = computed(
  () =>
    program.value?.versions?.find((v) => v.id === selected.value) ||
    program.value?.versions?.find((v) => v.language === locale.value) ||
    program.value?.versions?.[0],
);
const title = computed(
  () =>
    program.value?.title?.[locale.value === "kk" ? "kk" : "ru"] ||
    tr("Программа обучения", "Оқу бағдарламасы"),
);
useHead(() => ({ title: title.value + " — OT Center" }));
async function enroll() {
  if (!version.value) return;
  busy.value = true;
  failure.value = "";
  try {
    const result = await api<any>("/enrollments", {
      method: "POST",
      headers: { "Idempotency-Key": crypto.randomUUID() },
      body: { versionId: version.value.id },
    });
    await navigateTo(path("/learn/" + (result.enrollment?.id || result.id)));
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
</script>
<template>
  <LmsShell :title="title"
    ><LmsState :pending="pending" :error="error" @retry="refresh"
      ><template v-if="program">
        <div class="grid gap-6 lg:grid-cols-[1.7fr_1fr]">
          <section class="lms-card space-y-6">
            <h2 class="text-xl font-bold">
              {{ tr("Содержание программы", "Бағдарлама мазмұны") }}
            </h2>
            <div
              v-if="program.sourceProduct?.guidance"
              class="space-y-3 text-slate-600"
            >
              <p>
                {{
                  program.sourceProduct.guidance.summary[
                    locale === "kk" ? "kk" : "ru"
                  ]
                }}
              </p>
              <p>
                {{ tr("Для кого:", "Кім үшін:") }}
                {{
                  program.sourceProduct.guidance.audience[
                    locale === "kk" ? "kk" : "ru"
                  ]
                }}
              </p>
            </div>
            <template v-if="version"
              ><label v-if="program.versions.length > 1" class="block space-y-2"
                ><span>{{
                  tr("Вариант и язык обучения", "Оқу нұсқасы және тілі")
                }}</span
                ><select v-model="selected">
                  <option value="" disabled>
                    {{ tr("Выберите вариант", "Нұсқаны таңдаңыз") }}
                  </option>
                  <option
                    v-for="v in program.versions"
                    :key="v.id"
                    :value="v.id"
                  >
                    {{ v.title }} · {{ v.language.toUpperCase() }}
                  </option>
                </select></label
              >
              <p v-if="version.audience">
                {{ tr("Для кого:", "Кім үшін:") }} {{ version.audience }}
              </p>
              <p v-if="version.prerequisites">
                {{ tr("Перед началом:", "Бастамас бұрын:") }}
                {{ version.prerequisites }}
              </p>
              <div
                v-for="(m, index) in version.modules"
                :key="m.id"
                class="space-y-2 border-t pt-4"
              >
                <h3 class="font-semibold">{{ index + 1 }}. {{ m.title }}</h3>
                <ul class="space-y-2 text-sm text-slate-600">
                  <li v-for="l in m.lessons" :key="l.id">
                    {{ l.title }}
                    <span v-if="l.kind === 'practice'" class="text-brand-accent"
                      >·
                      {{ tr("Практическая часть", "Практикалық бөлім") }}</span
                    >
                  </li>
                </ul>
              </div>
              <p v-if="version.outcomes">{{ version.outcomes }}</p></template
            >
            <p v-else class="text-slate-600">
              {{
                tr(
                  "Специалист поможет подобрать вариант по вашей должности, отрасли и рабочим задачам и предоставит программу и условия записи.",
                  "Маман лауазымыңызға, салаңызға және жұмыс міндеттеріңізге сәйкес нұсқаны таңдап, бағдарлама мен тіркелу шарттарын береді.",
                )
              }}
            </p>
            <NuxtLink :to="path(program.publicPath)"
              >{{
                tr("Подробнее о направлении", "Бағыт туралы толығырақ")
              }}
              →</NuxtLink
            >
          </section>
          <aside class="lms-card h-fit space-y-5">
            <h2 class="text-xl font-bold">
              {{ tr("Условия обучения", "Оқу шарттары") }}
            </h2>
            <div v-if="!version" class="space-y-2">
              <p class="text-2xl font-bold text-brand">
                {{
                  program.pricing?.label[locale === "kk" ? "kk" : "ru"] ||
                  tr("Стоимость по запросу", "Бағасы сұрау бойынша")
                }}
              </p>
              <p v-if="program.pricing?.basis" class="text-sm text-slate-600">
                {{ program.pricing.basisLabel[locale === "kk" ? "kk" : "ru"] }}
              </p>
            </div>
            <template v-if="version"
              ><p class="text-2xl font-bold text-brand">
                {{ money(version.priceMinor, version.currency) }}
              </p>
              <p class="text-sm text-slate-600">
                {{
                  version.billingBasis === "organization"
                    ? tr(
                        "Общая стоимость для команды организации",
                        "Ұйым командасы үшін жалпы құн",
                      )
                    : tr(
                        "Расчёт на одного слушателя",
                        "Бір тыңдаушы үшін есептеу",
                      )
                }}
              </p>
              <dl class="space-y-3 text-sm">
                <div class="flex justify-between gap-3">
                  <dt>{{ tr("Язык", "Тілі") }}</dt>
                  <dd>{{ version.language.toUpperCase() }}</dd>
                </div>
                <div class="flex justify-between gap-3">
                  <dt>{{ tr("Объём программы", "Бағдарлама көлемі") }}</dt>
                  <dd>
                    {{ version.durationHours }} {{ tr("часов", "сағат") }}
                  </dd>
                </div>
                <div v-if="version.format">
                  <dt>{{ tr("Формат", "Формат") }}</dt>
                  <dd>{{ version.format }}</dd>
                </div>
              </dl>
              <p v-if="version.documentDescription" class="text-sm">
                {{ version.documentDescription }}
              </p>
              <p v-if="version.retakePolicy" class="text-sm">
                {{ version.retakePolicy }}
              </p>
              <p v-if="version.reviewedAt" class="text-xs text-slate-500">
                {{ tr("Проверено", "Тексерілді") }}:
                {{ date(version.reviewedAt) }}
              </p>
              <p v-if="version.intakeOpen === false" class="lms-note">{{ tr("Набор на эту версию программы приостановлен. Уточните следующий набор в учебном центре.", "Бағдарламаның осы нұсқасына қабылдау тоқтатылған. Келесі қабылдауды оқу орталығынан нақтылаңыз.") }}</p>
              <button
                v-else-if="
                  version.accessModel === 'free' &&
                  version.billingBasis !== 'organization'
                "
                class="lms-button w-full"
                :disabled="busy"
                @click="enroll"
              >
                {{ tr("Записаться на обучение", "Оқуға жазылу") }}</button
              ><NuxtLink
                v-else-if="version.billingBasis === 'organization'"
                class="lms-button w-full"
                :to="path('/cabinet/organization')"
                >{{
                  tr("Запись команды организации", "Ұйым командасын тіркеу")
                }}</NuxtLink
              ><NuxtLink
                v-else
                class="lms-button w-full"
                :to="{
                  path: path('/payment/' + program.id),
                  query: {
                    versionId: version.id,
                    city: route.query.city,
                    format: route.query.format,
                  },
                }"
                >{{
                  tr("Условия записи и оплаты", "Тіркелу және төлеу шарттары")
                }}</NuxtLink
              >
              <p v-if="failure" class="lms-error" role="alert">
                {{ failure }}
              </p></template
            ><NuxtLink
              class="lms-button secondary w-full"
              :to="{ path: path('/contacts'), query: { program: program.id } }"
              >{{ tr("Обсудить обучение", "Оқуды талқылау") }}</NuxtLink
            ><NuxtLink class="block text-center text-sm" :to="path('/b2b')">{{
              tr(
                "Обучение сотрудников организации",
                "Ұйым қызметкерлерін оқыту",
              )
            }}</NuxtLink>
          </aside>
        </div>
      </template></LmsState
    ></LmsShell
  >
</template>
