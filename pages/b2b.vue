<script setup lang="ts">
import { leadCities, leadCityLabel, leadCityValue, leadFormats, readLeadContext } from '~/shared/lead-context';
const { tr, locale, request, errorText } = useLmsApi();
const path = useLocalePath();
const route = useRoute();
const busy = ref(false);
const failure = ref("");
const success = ref(false);
const consent = ref(false);
let leadKey = "";
let submittedPayload = "";
const form = reactive({
  name: "",
  email: "",
  phone: "",
  organizationName: "",
  participants: 1,
  programId: "",
  city: "",
  format: "",
  comment: "",
  website: "",
});
const initialContext = readLeadContext(route.query);
onMounted(() => Object.assign(form, initialContext, { city: leadCityLabel(initialContext.city, locale.value) }));
async function submit() {
  if (busy.value) return;
  busy.value = true;
  failure.value = "";
  success.value = false;
  try {
    const context = readLeadContext(form);
    const payload = {
      ...form,
      programId: context.programId,
      format: context.format,
      city: leadCityValue(form.city),
      locale: locale.value === 'kk' ? 'kk' : 'ru',
      sourcePath: route.path,
      consentVersion: 'service-v1',
      marketingConsent: false,
    };
    const fingerprint = JSON.stringify(payload);
    if (!leadKey || fingerprint !== submittedPayload) {
      leadKey = crypto.randomUUID();
      submittedPayload = fingerprint;
    }
    await request("/api/amo-lead", {
      method: "POST",
      headers: { "Idempotency-Key": leadKey },
      body: payload,
    });
    success.value = true;
    leadKey = "";
    submittedPayload = "";
  } catch (e) {
    failure.value = errorText(e);
  } finally {
    busy.value = false;
  }
}
useHead(() => ({
  title: tr(
    "Обучение сотрудников организаций — OT Center",
    "Ұйым қызметкерлерін оқыту — OT Center",
  ),
  meta: [
    {
      name: "description",
      content: tr(
        "Организация обучения сотрудников: подбор программ, назначение, контроль учебного прогресса и оформление результатов в OT Center.",
        "Қызметкерлерді оқытуды ұйымдастыру: бағдарламаларды таңдау, тағайындау, оқу барысын бақылау және OT Center-де нәтижелерді рәсімдеу.",
      ),
    },
  ],
}));
</script>
<template>
  <LmsShell
    :title="tr('Обучение для вашей команды', 'Командаңызды оқыту')"
    :subtitle="
      tr(
        'Поможем подобрать программы по должностям и рабочим задачам, согласовать график и организовать обучение сотрудников.',
        'Лауазымдар мен жұмыс міндеттері бойынша бағдарламаларды таңдап, кестені келісуге және қызметкерлерді оқытуды ұйымдастыруға көмектесеміз.',
      )
    "
  >
    <div class="grid gap-5 md:grid-cols-3">
      <article class="lms-card space-y-3">
        <p class="font-semibold text-brand-accent">01</p>
        <h2 class="text-lg font-bold">
          {{ tr("Согласуем программу", "Бағдарламаны келісеміз") }}
        </h2>
        <p class="text-sm leading-6 text-slate-600">
          {{
            tr(
              "Определим аудиторию, направления, языки, формат и необходимую практику.",
              "Аудиторияны, бағыттарды, тілдерді, форматты және қажетті практиканы анықтаймыз.",
            )
          }}
        </p>
      </article>
      <article class="lms-card space-y-3">
        <p class="font-semibold text-brand-accent">02</p>
        <h2 class="text-lg font-bold">
          {{ tr("Организуем обучение", "Оқытуды ұйымдастырамыз") }}
        </h2>
        <p class="text-sm leading-6 text-slate-600">
          {{
            tr(
              "После согласования условий ответственный приглашает сотрудников и назначает программы в кабинете организации.",
              "Шарттар келісілгеннен кейін жауапты адам ұйым кабинетінде қызметкерлерді шақырып, бағдарламаларды тағайындайды.",
            )
          }}
        </p>
      </article>
      <article class="lms-card space-y-3">
        <p class="font-semibold text-brand-accent">03</p>
        <h2 class="text-lg font-bold">
          {{
            tr("Покажем реальные результаты", "Нақты нәтижелерді көрсетеміз")
          }}
        </h2>
        <p class="text-sm leading-6 text-slate-600">
          {{
            tr(
              "Прогресс, результаты проверки знаний и статусы документов доступны по правам организации.",
              "Оқу барысы, білімді тексеру нәтижелері және құжаттар күйі ұйым құқықтарына сәйкес қолжетімді.",
            )
          }}
        </p>
      </article>
    </div>
    <div class="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
      <section class="lms-card space-y-5">
        <h2 class="text-2xl font-bold">
          {{
            tr(
              "Обсудить обучение сотрудников",
              "Қызметкерлерді оқытуды талқылау",
            )
          }}
        </h2>
        <p class="text-sm text-slate-600">
          {{
            tr(
              "Для первого обращения достаточно общей численности и задач. Списки сотрудников сейчас не нужны.",
              "Алғашқы өтініш үшін жалпы адам саны мен міндеттер жеткілікті. Қызметкерлер тізімі қазір қажет емес.",
            )
          }}
        </p>
        <form class="grid gap-5 sm:grid-cols-2" @submit.prevent="submit">
          <label class="space-y-2"
            ><span>{{ tr("Ваше имя", "Атыңыз") }}</span
            ><input
              v-model="form.name"
              required
              autocomplete="name"
              maxlength="120" /></label
          ><label class="space-y-2"
            ><span>{{ tr("Организация", "Ұйым") }}</span
            ><input
              v-model="form.organizationName"
              required
              autocomplete="organization"
              maxlength="200" /></label
          ><label class="space-y-2"
            ><span>Email</span
            ><input
              v-model="form.email"
              required
              type="email"
              autocomplete="email"
              maxlength="254" /></label
          ><label class="space-y-2"
            ><span>{{ tr("Телефон", "Телефон") }}</span
            ><input
              v-model="form.phone"
              type="tel"
              autocomplete="tel"
              maxlength="30" /></label
          ><label class="space-y-2"
            ><span>{{ tr("Количество участников", "Қатысушылар саны") }}</span
            ><input
              v-model.number="form.participants"
              type="number"
              min="1"
              max="10000"
              required /></label
          ><label class="space-y-2"
            ><span>{{ tr("Направление", "Бағыт") }}</span
            ><select v-model="form.programId">
              <option value="">
                {{ tr("Нужна помощь с выбором", "Таңдауға көмек керек") }}
              </option>
              <option v-for="d in LMS_DIRECTIONS" :key="d.id" :value="d.id">
                {{ locale === "kk" ? d.kk : d.ru }}
              </option>
            </select></label
          ><label class="space-y-2">
            <span>{{ tr('Город', 'Қала') }}</span>
            <input v-model="form.city" list="b2b-cities" maxlength="80" autocomplete="address-level2" />
            <datalist id="b2b-cities"><option v-for="city in leadCities" :key="city.id" :value="city.title[locale === 'kk' ? 'kk' : 'ru']" /></datalist>
          </label><label class="space-y-2">
            <span>{{ tr('Предпочтительный формат', 'Қалаулы формат') }}</span>
            <select v-model="form.format">
              <option value="">{{ tr('Обсудить со специалистом', 'Маманмен талқылау') }}</option>
              <option v-for="format in leadFormats" :key="format.id" :value="format.id">{{ format.title[locale === 'kk' ? 'kk' : 'ru'] }}</option>
            </select>
          </label><label class="sm:col-span-2 space-y-2"
            ><span>{{
              tr("Задача и удобный формат", "Міндет және ыңғайлы формат")
            }}</span
            ><textarea
              v-model="form.comment"
              rows="4"
              maxlength="3000"
            /></label
          ><div class="hidden" aria-hidden="true"><input
            v-model="form.website"
            type="text"
            tabindex="-1"
            autocomplete="off"
            class="hidden"
            aria-hidden="true"
          /></div><label class="sm:col-span-2 flex items-start gap-3 text-sm"
            ><input
              v-model="consent"
              required
              type="checkbox"
              class="mt-1"
            /><span
              >{{
                tr(
                  "Согласен(-на) на обработку данных для ответа на обращение согласно",
                  "Өтінішке жауап беру үшін деректерді өңдеуге келісемін:",
                )
              }}
              <NuxtLink :to="path('/privacy')">{{
                tr("политике конфиденциальности", "құпиялылық саясаты")
              }}</NuxtLink
              >.</span
            ></label
          >
          <p v-if="failure" class="lms-error sm:col-span-2" role="alert">
            {{ failure }}
          </p>
          <p v-if="success" class="lms-success sm:col-span-2" role="status">
            {{
              tr(
                "Заявка принята и сохранена. Учебный центр свяжется с вами для уточнения условий.",
                "Өтініш қабылданып, сақталды. Оқу орталығы шарттарды нақтылау үшін сізбен байланысады.",
              )
            }}
          </p>
          <button class="lms-button sm:col-span-2" :disabled="busy || !consent">
            {{
              busy
                ? tr("Сохраняем заявку…", "Өтініш сақталуда…")
                : tr(
                    "Отправить заявку на обучение команды",
                    "Команданы оқытуға өтініш жіберу",
                  )
            }}
          </button>
        </form>
      </section>
      <aside class="lms-card h-fit space-y-5">
        <h2 class="text-xl font-bold">
          {{
            tr(
              "Уже работаете с OT Center?",
              "OT Center-мен жұмыс істеп жүрсіз бе?",
            )
          }}
        </h2>
        <p class="text-sm leading-6 text-slate-600">
          {{
            tr(
              "Откройте кабинет своей организации. Доступ предоставляется по подтверждённому приглашению.",
              "Ұйымыңыздың кабинетін ашыңыз. Қолжетімділік расталған шақыру бойынша беріледі.",
            )
          }}
        </p>
        <NuxtLink
          class="lms-button w-full"
          :to="path('/cabinet/organization')"
          >{{ tr("Кабинет организации", "Ұйым кабинеті") }}</NuxtLink
        >
      </aside>
    </div>
  </LmsShell>
</template>
