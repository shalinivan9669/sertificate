<script setup lang="ts">
import { leadCities, leadCityLabel, leadCityValue, leadFormats, leadProgramsComment, readLeadContext, readLeadPrograms } from '~/shared/lead-context';
const { tr, locale, request, errorText } = useLmsApi();
const path = useLocalePath();
const route = useRoute();
const { snapshot: attributionSnapshot } = useLeadAttribution();
const busy = ref(false);
const failure = ref("");
const success = ref(false);
const consent = ref(false);
const commentEdited = ref(false);
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
const nuxtApp = useNuxtApp();
const router = useRouter();
let stopContextPrefill = () => {};
let stopCitySync = () => {};
let appliedCity = '';
let appliedProgram = '';
let appliedFormat = '';
let lastGeneratedComment = '';
onMounted(() => {
  const applyContext = () => {
    const query = router.currentRoute.value.query;
    const programs = readLeadPrograms(query);
    const initial = { ...readLeadContext(query), programId: programs[0] || '' };
    const values = { ...initial, city: leadCityLabel(initial.city, locale.value) };
    // Query and language changes may refresh automatic values, never a field
    // the user has since changed or intentionally cleared.
    if (form.programId === appliedProgram) {
      form.programId = values.programId;
      appliedProgram = values.programId;
    }
    if (form.format === appliedFormat) {
      form.format = values.format;
      appliedFormat = values.format;
    }
    // Follow a changed page city only while this field still has its automatic value.
    if (!form.city || leadCityValue(form.city) === appliedCity) form.city = values.city;
    appliedCity = initial.city;
    if (!commentEdited.value && (!form.comment.trim() || form.comment === lastGeneratedComment)) {
      lastGeneratedComment = leadProgramsComment(query, locale.value);
      form.comment = lastGeneratedComment;
    }
  };
  // Prerendered routes restore their query after suspense resolves.
  if (nuxtApp.isHydrating) stopContextPrefill = nuxtApp.hooks.hookOnce('app:suspense:resolve', applyContext);
  else applyContext();
  stopCitySync = watch([
    () => router.currentRoute.value.query.city,
    () => router.currentRoute.value.query.program,
    () => router.currentRoute.value.query.programs,
    () => router.currentRoute.value.query.format,
    locale,
  ], applyContext);
});
onBeforeUnmount(() => { stopContextPrefill(); stopCitySync(); });
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
    const attribution = await attributionSnapshot();
    await request("/api/amo-lead", {
      method: "POST",
      headers: { "Idempotency-Key": leadKey },
      body: { ...payload, ...(attribution ? { attribution } : {}) },
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
    "Промбезопасность и охрана труда: обучение для компаний",
    "Компанияларға өнеркәсіптік қауіпсіздік және еңбекті қорғау оқуы",
  ),
  meta: [
    {
      name: "description",
      content: tr(
        "Обучение сотрудников по промышленной безопасности и охране труда в Казахстане. Подбор программ для ИТР и рабочих, график, формат и расчёт стоимости группы.",
        "Қазақстанда қызметкерлерді өнеркәсіптік қауіпсіздік пен еңбекті қорғауға оқыту. ИТЖ мен жұмысшыларға бағдарлама, кесте, формат және топ құнын келісу.",
      ),
    },
  ],
}));
</script>
<template>
  <div class="ed-public">
    <EditorialPageHeader :title="tr('Обучение для вашей команды', 'Командаңызды оқыту')" :lead="tr('Поможем подобрать программы по должностям и рабочим задачам, согласовать график и организовать обучение сотрудников.', 'Лауазымдар мен жұмыс міндеттері бойынша бағдарламаларды таңдап, кестені келісуге және қызметкерлерді оқытуды ұйымдастыруға көмектесеміз.')">
      <div class="ed-public-actions"><a href="#team-request" class="ed-public-button">{{ tr('Обсудить обучение команды', 'Команданы оқытуды талқылау') }}</a><NuxtLink :to="path('/cabinet/organization')" class="ed-public-link">{{ tr('Кабинет организации', 'Ұйым кабинеті') }}</NuxtLink></div>
    </EditorialPageHeader>
    <div class="ed-public-steps">
      <article >
        <h2 class="text-lg font-bold">
          {{ tr("Согласуем программу", "Бағдарламаны келісеміз") }}
        </h2>
        <p >
          {{
            tr(
              "Определим аудиторию, направления, языки, формат и необходимую практику.",
              "Аудиторияны, бағыттарды, тілдерді, форматты және қажетті практиканы анықтаймыз.",
            )
          }}
        </p>
      </article>
      <article >
        <h2 class="text-lg font-bold">
          {{ tr("Организуем обучение", "Оқытуды ұйымдастырамыз") }}
        </h2>
        <p >
          {{
            tr(
              "После согласования условий ответственный приглашает сотрудников и назначает программы в кабинете организации.",
              "Шарттар келісілгеннен кейін жауапты адам ұйым кабинетінде қызметкерлерді шақырып, бағдарламаларды тағайындайды.",
            )
          }}
        </p>
      </article>
      <article >
        <h2 class="text-lg font-bold">
          {{
            tr("Покажем реальные результаты", "Нақты нәтижелерді көрсетеміз")
          }}
        </h2>
        <p >
          {{
            tr(
              "Прогресс, результаты проверки знаний и статусы документов доступны по правам организации.",
              "Оқу барысы, білімді тексеру нәтижелері және құжаттар күйі ұйым құқықтарына сәйкес қолжетімді.",
            )
          }}
        </p>
      </article>
    </div>
    <section class="ed-public-section">
      <h2>{{ tr('Промышленная безопасность: обучение ИТР и рабочих в Казахстане', 'Қазақстанда ИТЖ мен жұмысшыларды өнеркәсіптік қауіпсіздікке оқыту') }}</h2>
      <p>{{ tr('Для персонала, входящего в сферу правил подготовки по промышленной безопасности, программу подбирают по функциям на опасном производственном объекте. Работники, выполняющие работы на ОПО, проходят ежегодную подготовку от 10 часов; руководители, специалисты и ИТР — от 40 часов с проверкой знаний раз в три года. Отдельно учитываются новые назначения и основания переподготовки.', 'Өнеркәсіптік қауіпсіздік даярлау қағидаларына кіретін персонал үшін бағдарлама қауіпті өндірістік объектідегі функциясына қарай таңдалады. ҚӨО-да жұмыс орындайтын жұмыскерлер жыл сайын кемінде 10 сағат даярланады; басшылар, мамандар және ИТЖ кемінде 40 сағаттық бағдарлама бойынша үш жылда бір рет білімін тексертеді. Жаңа тағайындау мен қайта даярлау негіздері бөлек ескеріледі.') }}</p>
      <p>{{ tr('Правила №332 предусматривают очный и дистанционный форматы. Для руководителей, специалистов и ИТР также предусмотрена самостоятельная подготовка по типовой программе; проверка знаний сохраняется. До начала согласуем применимую процедуру, состав группы, язык и график.', '№332 қағидалар күндізгі және қашықтан форматтарды көздейді. Басшылар, мамандар және ИТЖ үшін үлгілік бағдарлама бойынша өздігінен даярлану да қарастырылған; білімді тексеру сақталады. Оқу алдында қолданылатын рәсім, топ құрамы, тіл және кесте келісіледі.') }}</p>
      <p><a :href="locale === 'kk' ? 'https://adilet.zan.kz/kaz/docs/V2100023461' : 'https://adilet.zan.kz/rus/docs/V2100023461'" target="_blank" rel="noopener noreferrer">{{ tr('Основание: правила №332, пункты 7–10', 'Негіз: №332 қағидалардың 7–10-тармақтары') }}</a></p>
      <h3>{{ tr('Что нужно для расчёта стоимости обучения группы', 'Топтық оқу құнын есептеу үшін не қажет') }}</h3>
      <p>{{ tr('Укажите количество ИТР и рабочих отдельно, отрасль и виды работ, город или площадку, желаемый формат и крайний срок. В предложении важно согласовать программу, проверку знаний, состав итоговых документов и организационные условия. Стоимость рассчитывается под подтверждённый состав группы; объём в часах не равен обещанию выдать документы за фиксированное число дней.', 'ИТЖ мен жұмысшылар санын бөлек, саланы және жұмыс түрлерін, қаланы не алаңды, форматты және соңғы мерзімді көрсетіңіз. Ұсыныста бағдарлама, білімді тексеру, қорытынды құжаттар және ұйымдастыру шарттары келісіледі. Құн расталған топ құрамына қарай есептеледі; сағат көлемі құжатты белгіленген күнде беруге уәде емес.') }}</p>
      <div class="ed-public-links">
        <NuxtLink :to="path('/promyshlennaya-bezopasnost')">{{ tr('Программа по промышленной безопасности', 'Өнеркәсіптік қауіпсіздік бағдарламасы') }}</NuxtLink>
        <NuxtLink :to="path('/blog/prombezopasnost-itr-periodichnost-obucheniya')">{{ tr('Сроки обучения ИТР и рабочих', 'ИТЖ мен жұмысшыларды оқыту мерзімдері') }}</NuxtLink>
        <NuxtLink :to="path('/blog/plan-obucheniya-personala-2027')">{{ tr('Матрица обучения на 2027 год', '2027 жылға оқу матрицасы') }}</NuxtLink>
      </div>
    </section>
    <div class="ed-request-layout">
      <section id="team-request" class="ed-request-panel">
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
        <form class="ed-request-form" :aria-busy="busy" @submit.prevent="submit">
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
          </label><label class="ed-request-wide space-y-2"
            ><span>{{
              tr("Задача и удобный формат", "Міндет және ыңғайлы формат")
            }}</span
            ><textarea
              v-model="form.comment"
              @input="commentEdited = true"
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
          /></div><label class="ed-request-wide ed-request-consent"
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
          <p v-if="failure" class="lms-error ed-request-wide" role="alert">
            {{ failure }}
          </p>
          <p v-if="success" class="lms-success ed-request-wide" role="status">
            {{
              tr(
                "Заявка принята и сохранена. Учебный центр свяжется с вами для уточнения условий.",
                "Өтініш қабылданып, сақталды. Оқу орталығы шарттарды нақтылау үшін сізбен байланысады.",
              )
            }}
          </p>
          <button class="ed-public-button ed-request-wide" :disabled="busy || !consent">
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
      <aside class="ed-contact-details">
        <h2 class="text-xl font-bold">
          {{
            tr(
              "Уже работаете с OT Center?",
              "OT Center-мен жұмыс істеп жүрсіз бе?",
            )
          }}
        </h2>
        <p >
          {{
            tr(
              "Откройте кабинет своей организации. Доступ предоставляется по подтверждённому приглашению.",
              "Ұйымыңыздың кабинетін ашыңыз. Қолжетімділік расталған шақыру бойынша беріледі.",
            )
          }}
        </p>
        <NuxtLink
          class="ed-public-button ed-public-button--quiet"
          :to="path('/cabinet/organization')"
          >{{ tr("Кабинет организации", "Ұйым кабинеті") }}</NuxtLink
        >
      </aside>
    </div>
  </div>
</template>
