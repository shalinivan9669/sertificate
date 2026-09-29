<script setup lang="ts">
import { courseDirections } from "~/shared/course-registry";
import { sourceProductCardSummaries } from "~/shared/source-products";
import { getPublicCourseValue } from "~/shared/public-course-value";
import { leadContextQuery } from "~/shared/lead-context";
import { cities } from "~/config/cities";

const { locale } = useI18n();
const path = useLocalePath();
const { link, localLink } = useEditorialMenu();
const lang = computed(() => (locale.value === "kk" ? "kk" : "ru"));
const tr = (ru: string, kk: string) => (lang.value === "kk" ? kk : ru);
const filter = ref("all");
const expanded = ref(false);
const group = (id: string) =>
  [
    "pervaya-pomoshch",
    "inklyuzivnaya-kultura",
    "antiterroristicheskaya-podgotovka",
  ].includes(id)
    ? "people"
    : id.includes("ekolog")
      ? "environment"
      : "safety";
const iconFor = (id: string) =>
  id === "pervaya-pomoshch"
    ? "heart"
    : id.includes("elektro")
      ? "bolt"
      : id.includes("ekolog")
        ? "leaf"
        : id === "ohrana-truda"
          ? "shield"
          : id === "promyshlennaya-bezopasnost"
            ? "building"
            : "book";
const priority = [
  "ohrana-truda",
  "pervaya-pomoshch",
  "promyshlennaya-bezopasnost",
  "ptm",
  "elektrobezopasnost",
  "ekologicheskaya-bezopasnost",
];
const allCourses = computed(() =>
  [...courseDirections]
    .sort((a, b) => {
      const ai = priority.indexOf(a.id),
        bi = priority.indexOf(b.id);
      return (ai < 0 ? 100 : ai) - (bi < 0 ? 100 : bi);
    })
    .map((course) => ({
      ...course,
      value: getPublicCourseValue(course.id),
      icon: iconFor(course.id),
    })),
);
const filteredCourses = computed(() =>
  allCourses.value.filter(
    (course) => filter.value === "all" || group(course.id) === filter.value,
  ),
);
const visibleCourses = computed(() =>
  expanded.value ? filteredCourses.value : filteredCourses.value.slice(0, 6),
);
const filters = computed(() => [
  { id: "all", label: tr("Все направления", "Барлық бағыттар") },
  { id: "safety", label: tr("Безопасная работа", "Қауіпсіз жұмыс") },
  { id: "people", label: tr("Забота о людях", "Адамдарға қамқорлық") },
  { id: "environment", label: tr("Окружающая среда", "Қоршаған орта") },
]);
const descriptions: Record<string, { ru: string; kk: string }> = {
  "ohrana-truda": {
    ru: "Понятные правила для безопасной работы сотрудников и руководителей.",
    kk: "Қызметкерлер мен басшылардың қауіпсіз жұмысына арналған түсінікті ережелер.",
  },
  "pervaya-pomoshch": {
    ru: "Знания и навыки, которые помогают позаботиться о человеке рядом.",
    kk: "Жаныңыздағы адамға көмектесуге арналған білім мен дағдылар.",
  },
  "promyshlennaya-bezopasnost": {
    ru: "Подготовка для ответственной работы на производственных объектах.",
    kk: "Өндірістік нысандарда жауапты жұмыс істеуге дайындық.",
  },
  ptm: {
    ru: "Профилактика пожаров и порядок действий для работников и организаций.",
    kk: "Қызметкерлер мен ұйымдар үшін өрттің алдын алу және әрекет ету тәртібі.",
  },
  elektrobezopasnost: {
    ru: "Основы безопасной работы с электрооборудованием и электроустановками.",
    kk: "Электр жабдықтарымен және қондырғыларымен қауіпсіз жұмыс істеу негіздері.",
  },
  "ekologicheskaya-bezopasnost": {
    ru: "Ответственный подход к окружающей среде в ежедневной работе.",
    kk: "Күнделікті жұмыста қоршаған ортаға жауапкершілікпен қарау.",
  },
};
const description = (id: string) =>
  getPublicCourseValue(id)?.description[lang.value] ||
  descriptions[id]?.[lang.value] ||
  sourceProductCardSummaries[id]?.[lang.value] ||
  tr(
    "Содержание, аудитория и условия обучения — на странице программы.",
    "Бағдарлама бетінде оқу мазмұны, аудиториясы және шарттары берілген.",
  );
const priceRequest = (id: string) => ({
  ...link('/contacts', { hash: '#request-form' }),
  query: { ...leadContextQuery({ city: link('/contacts').query.city, format: link('/contacts').query.format, programId: id }), request: 'price' },
});
const entryCards = computed(() => [
  {
    n: "01",
    icon: "book",
    title: tr("Выбираю обучение", "Оқуды таңдаймын"),
    text: tr(
      "Найдём программу под вашу работу и задачу.",
      "Жұмысыңыз бен міндетіңізге сай бағдарлама табамыз.",
    ),
    action: tr("Подобрать программу", "Бағдарлама таңдау"),
    to: "/program-selection",
    tone: "sage",
  },
  {
    n: "02",
    icon: "people",
    title: tr("Обучаю команду", "Команданы оқытамын"),
    text: tr(
      "Обсудим формат и обучение сотрудников.",
      "Қызметкерлерді оқыту мен форматын талқылаймыз.",
    ),
    action: tr("Для компаний", "Компанияларға"),
    to: "/b2b",
    tone: "sand",
  },
  {
    n: "03",
    icon: "user",
    title: tr("Продолжаю учиться", "Оқуды жалғастырамын"),
    text: tr(
      "Мои программы, прогресс и документы.",
      "Бағдарламаларым, үлгерімім және құжаттарым.",
    ),
    action: tr("Личный кабинет", "Жеке кабинет"),
    to: "/cabinet",
    tone: "blue",
  },
]);
const steps = computed(() => [
  {
    title: tr("Выберите программу", "Бағдарламаны таңдаңыз"),
    text: tr(
      "Изучите содержание, аудиторию и условия.",
      "Мазмұнымен, аудиториясымен және шарттарымен танысыңыз.",
    ),
  },
  {
    title: tr("Пройдите обучение", "Оқудан өтіңіз"),
    text: tr(
      "Изучайте материалы выбранной программы.",
      "Таңдаған бағдарламаңыздың материалдарын оқыңыз.",
    ),
  },
  {
    title: tr("Проверьте знания", "Біліміңізді тексеріңіз"),
    text: tr(
      "Пройдите проверку по условиям курса.",
      "Курс шарттарына сәйкес білім тексеруден өтіңіз.",
    ),
  },
  {
    title: tr("Получите документ", "Құжатты алыңыз"),
    text: tr(
      "После выполнения условий он появится в кабинете.",
      "Шарттар орындалғаннан кейін жеке кабинетте пайда болады.",
    ),
  },
]);
const formats = computed(() => [
  {
    icon: "screen",
    title: tr("Онлайн", "Онлайн"),
    text: tr(
      "Учебные материалы в вашем личном кабинете.",
      "Оқу материалдары жеке кабинетіңізде.",
    ),
    to: "/online-obuchenie",
    format: "online",
    label: tr("Где вам удобно", "Сізге ыңғайлы жерде"),
  },
  {
    icon: "building",
    title: tr("В учебном центре", "Оқу орталығында"),
    text: tr(
      "Очные занятия и живое общение с преподавателем.",
      "Күндізгі сабақтар және оқытушымен тікелей қарым-қатынас.",
    ),
    to: "/ochnoe-obuchenie",
    format: "classroom",
    label: tr("Вместе с преподавателем", "Оқытушымен бірге"),
  },
  {
    icon: "people",
    title: tr("В вашей организации", "Ұйымыңызда"),
    text: tr(
      "Выездное обучение под задачи вашей команды.",
      "Командаңыздың міндеттеріне сай көшпелі оқыту.",
    ),
    to: "/vyezdnoe-obuchenie",
    format: "onsite",
    label: tr("Для всей команды", "Бүкіл команда үшін"),
  },
]);
const faqs = computed(() => [
  {
    q: tr(
      "Как понять, какая программа мне нужна?",
      "Маған қандай бағдарлама қажет екенін қалай білемін?",
    ),
    a: tr(
      "Начните с подбора программы: укажите направление, свою роль и формат обучения. Затем изучите содержание и условия в карточке курса. Если нужна помощь, свяжитесь с учебным центром.",
      "Бағдарлама таңдаудан бастаңыз: бағытты, рөліңізді және оқу форматын көрсетіңіз. Содан кейін курс мазмұны мен шарттарын оқыңыз. Көмек қажет болса, оқу орталығына хабарласыңыз.",
    ),
  },
  {
    q: tr(
      "Можно ли обучить сотрудников организации?",
      "Ұйым қызметкерлерін оқытуға бола ма?",
    ),
    a: tr(
      "Да. На странице «Для компаний» можно указать направление, число участников, город и удобный формат. Центр уточнит условия и возможность организации обучения.",
      "Иә. «Компанияларға» бетінде бағытты, қатысушылар санын, қаланы және ыңғайлы форматты көрсете аласыз. Орталық оқыту шарттары мен мүмкіндігін нақтылайды.",
    ),
  },
  {
    q: tr(
      "Где будут мои материалы и документы?",
      "Материалдарым мен құжаттарым қайда болады?",
    ),
    a: tr(
      "В личном кабинете: там доступны ваши записи на обучение, прогресс, заказы и выданные документы. Доступ и выдача зависят от условий выбранной программы.",
      "Жеке кабинетте: оқуға тіркелу, үлгерім, тапсырыстар және берілген құжаттар сонда қолжетімді. Қолжетімділік пен құжат беру таңдалған бағдарламаның шарттарына байланысты.",
    ),
  },
]);
</script>
<template>
  <div class="ed-home">
    <EditorialCover
      :eyebrow="tr('Профессиональное обучение в Казахстане', 'Қазақстандағы кәсіби оқыту')"
      :lines="
        lang === 'kk'
          ? ['Үлкен істің', 'негізі —', 'білім.']
          : ['Знания,', 'на которых', 'держится дело.']
      "
      :description="
        tr(
          'Охрана труда, безопасность и профессиональная подготовка. Для специалистов и команд.',
          'Еңбекті қорғау, қауіпсіздік және кәсіби даярлық. Мамандар мен командалар үшін.',
        )
      "
      :image-alt="
        tr(
          'Художественная иллюстрация: наставник и специалист изучают чертёж в светлом производственном цехе.',
          'Көркем иллюстрация: тәлімгер мен маман жарық өндірістік цехта сызбаны зерттеуде.',
        )
      "
      :caption="
        tr(
          'За каждым большим делом — подготовленные люди.',
          'Әр үлкен істің артында — дайын мамандар.',
        )
      "
    >
      <template #actions
        ><div class="ed-cover-actions">
          <EditorialButton :to="link('/program-selection')">{{
            tr("Подобрать обучение", "Оқуды таңдау")
          }}</EditorialButton
          ><EditorialButton :to="path('/cabinet')" variant="text">{{
            tr("Продолжить обучение", "Оқуды жалғастыру")
          }}</EditorialButton>
        </div>
        <p class="ed-cover-note">
          {{ tr("На русском и казахском языке", "Орыс және қазақ тілдерінде") }}
        </p>
        <EditorialMobileContents
      /></template>
      <template #contents
        ><nav
          class="ed-cover-contents"
          :aria-label="tr('В этом разделе', 'Осы бөлімде')"
        >
          <span>{{ tr("СОДЕРЖАНИЕ", "МАЗМҰНЫ") }}</span
          ><a href="#directions"
            ><i aria-hidden="true" />{{ tr("Направления", "Бағыттар") }}</a
          ><a href="#learning-path"
            ><i aria-hidden="true" />{{ tr("Путь обучения", "Оқу жолы") }}</a
          ><a href="#formats"
            ><i aria-hidden="true" />{{ tr("Форматы", "Форматтар") }}</a
          ><a href="#cities"
            ><i aria-hidden="true" />{{ tr("Ваш город", "Сіздің қалаңыз") }}</a
          >
        </nav></template
      >
    </EditorialCover>

    <section class="ed-opening">
      <div class="ed-wrap ed-opening-grid">
        <p class="ed-opening-thought">
          <span>{{ tr("З", "Б") }}</span
          >{{
            tr(
              "нания становятся силой, когда за ними — человек.",
              "ілім адам арқылы үлкен күшке айналады.",
            )
          }}
        </p>
        <a href="#directions" class="ed-next-chapter"
          ><span class="ed-kicker"
            >01 / {{ tr("НАПРАВЛЕНИЯ", "БАҒЫТТАР") }}</span
          ><strong>{{
            tr("Дело начинается с вас", "Іс сізден басталады")
          }}</strong
          ><CivicIcon name="arrow" /></a
        ><span class="ed-opening-side"
          >{{ tr("УЧИТЬСЯ.", "ҮЙРЕНУ.") }}<br />{{ tr("ПОНИМАТЬ.", "ТҮСІНУ.")
          }}<br />{{ tr("ДЕЙСТВОВАТЬ.", "ӘРЕКЕТ ЕТУ.") }}</span
        >
      </div>
    </section>

    <section
      class="ed-entry ed-wrap"
      :aria-label="tr('Ваш следующий шаг', 'Келесі қадамыңыз')"
    >
      <NuxtLink v-for="card in entryCards" :key="card.n" :to="link(card.to)"
        ><CivicIcon :name="card.icon" />
        <div>
          <h2>{{ card.title }}</h2>
          <p>{{ card.text }}</p>
          <span class="ed-entry-action"
            >{{ card.action }}<CivicIcon name="arrow"
          /></span></div
      ></NuxtLink>
    </section>

    <section id="directions" class="ed-section ed-wrap">
      <EditorialChapter
        number=""
        :label="tr('Направления подготовки', 'Даярлық бағыттары')"
        :title="
          tr(
            'Какие знания нужны\nвашему делу?',
            'Ісіңізге қандай\nбілім қажет?',
          )
        "
        ><NuxtLink :to="path('/courses')" class="ed-text-link"
          >{{ tr("Весь каталог", "Толық каталог")
          }}<CivicIcon name="arrow" /></NuxtLink
      ></EditorialChapter>
      <div
        class="ed-filters"
        :aria-label="tr('Направления обучения', 'Оқу бағыттары')"
      >
        <button
          v-for="item in filters"
          :key="item.id"
          type="button"
          :aria-pressed="filter === item.id"
          @click="
            filter = item.id;
            expanded = false;
          "
        >
          {{ item.label }}
        </button>
      </div>
      <p class="sr-only" role="status">
        {{ tr("Найдено направлений:", "Табылған бағыттар:") }}
        {{ filteredCourses.length }}
      </p>
      <div class="ed-program-list">
        <article
          v-for="(course, index) in visibleCourses"
          :key="course.id"
          class="ed-program-row"
        >
          <span class="ed-program-number">{{
            String(index + 1).padStart(2, "0")
          }}</span>
          <div class="ed-program-name">
            <h3>
              <NuxtLink :to="link('/courses/' + course.id)">{{
                course.title[lang]
              }}</NuxtLink>
            </h3>
            <p>{{ description(course.id) }}</p>
          </div>
          <div class="ed-program-value">
            <strong v-if="course.value">{{ course.value.purpose[lang] }}</strong>
            <NuxtLink :to="priceRequest(course.id)" class="ed-price-request" :aria-label="tr('Запросить стоимость: ', 'Бағасын сұрау: ') + course.title[lang]">{{ tr('Запросить стоимость', 'Бағасын сұрау') }} <span aria-hidden="true">↗</span></NuxtLink>
          </div>
          <NuxtLink
            :to="link('/courses/' + course.id)"
            class="ed-round-link"
            :aria-label="tr('Программа: ', 'Бағдарлама: ') + course.title[lang]"
            ><CivicIcon name="northeast"
          /></NuxtLink>
        </article>
      </div>
      <button
        v-if="filteredCourses.length > 6"
        type="button"
        class="ed-show-more"
        :aria-expanded="expanded"
        @click="expanded = !expanded"
      >
        {{
          expanded
            ? tr("Свернуть список", "Тізімді жию")
            : tr("Все направления", "Барлық бағыттар")
        }}<span>{{ filteredCourses.length }}</span
        ><CivicIcon name="arrow" />
      </button>
    </section>

    <section id="learning-path" class="ed-story">
      <div class="ed-wrap">
        <EditorialChapter
          number=""
          :label="tr('От программы к результату', 'Бағдарламадан нәтижеге')"
          :title="
            tr(
              'Уверенность\nприходит с подготовкой.',
              'Сенімділік\nдайындықтан басталады.',
            )
          "
          dark
        />
        <div class="ed-story-layout">
          <div class="ed-story-photo">
            <ResponsiveImage
              src="/images/editorial/knowledge-city-960.webp"
              width="960"
              height="549"
              sizes="(max-width: 767px) 580px, (max-width: 1200px) 50vw, 640px"
              loading="lazy"
              :alt="
                tr(
                  'Совместная работа наставника и специалистов у оборудования.',
                  'Тәлімгер мен мамандардың жабдық жанындағы бірлескен жұмысы.',
                )
              "
            />
            <p>
              {{
                tr(
                  "Большой результат начинается с внимательного отношения к своей работе.",
                  "Үлкен нәтиже өз жұмысыңа мұқият қараудан басталады.",
                )
              }}
            </p>
          </div>
          <ol class="ed-steps">
            <li v-for="(step, index) in steps" :key="step.title">
              <span>0{{ index + 1 }}</span>
              <div>
                <h3>{{ step.title }}</h3>
                <p>{{ step.text }}</p>
              </div>
            </li>
          </ol>
        </div>
        <p class="ed-story-footnote">
          {{
            tr(
              "Формат проверки знаний и выдаваемый документ зависят от условий конкретной программы.",
              "Білім тексеру форматы мен берілетін құжат нақты бағдарламаның шарттарына байланысты.",
            )
          }}
        </p>
      </div>
    </section>

    <section id="formats" class="ed-section ed-wrap">
      <EditorialChapter
        number=""
        :label="tr('Форматы обучения', 'Оқу форматтары')"
        :title="
          tr('Учиться там,\nгде нужно вам.', 'Өзіңізге қолайлы\nжерде оқыңыз.')
        "
      />
      <div class="ed-formats">
        <NuxtLink
          v-for="(format, index) in formats"
          :key="format.to"
          :to="localLink(format.to.slice(1), format.format)"
          ><span class="ed-format-top"
            ><CivicIcon :name="format.icon" /><span
              >0{{ index + 1 }}</span
            ></span
          >
          <p class="ed-kicker">{{ format.label }}</p>
          <h3>{{ format.title }}</h3>
          <p>{{ format.text }}</p>
          <span class="ed-text-link"
            >{{ tr("Об этом формате", "Осы формат туралы")
            }}<CivicIcon name="northeast" /></span
        ></NuxtLink>
      </div>
    </section>

    <section id="cities" class="ed-geography">
      <div class="ed-wrap ed-geography-grid">
        <div>
          <p class="ed-kicker">{{ tr("Обучение рядом", "Жақын жердегі оқу") }}</p>
          <h2>
            {{ tr("Общее дело.\nВаш город.", "Ортақ іс.\nСіздің қалаңыз.") }}
          </h2>
          <p>
            {{
              tr(
                "Направления, форматы и условия обучения в вашем городе.",
                "Қалаңыздағы оқу бағыттары, форматтары мен шарттары.",
              )
            }}
          </p>
        </div>
        <div class="ed-city-list">
          <NuxtLink
            v-for="city in cities"
            :key="city.slug"
            :to="path('/' + city.slug)"
            >{{ lang === "kk" ? city.nameKk : city.nameRu
            }}<CivicIcon name="northeast"
          /></NuxtLink>
        </div>
      </div>
    </section>

    <section class="ed-documents ed-wrap">
      <span class="ed-document-mark" aria-hidden="true"
        ><CivicIcon name="document"
      /></span>
      <div>
        <p class="ed-kicker">
          {{ tr("ОТКРЫТО И ПО СУЩЕСТВУ", "АШЫҚ ӘРІ НАҚТЫ") }}
        </p>
        <h2>{{ tr("Основание для доверия", "Сенімнің негізі") }}</h2>
        <p>
          {{
            tr(
              "Сведения об учебном центре, аккредитации и документах доступны для ознакомления.",
              "Оқу орталығы, аккредиттеу және құжаттар туралы ақпаратпен танысуға болады.",
            )
          }}
        </p>
      </div>
      <EditorialButton :to="path('/licenses')" variant="secondary">{{
        tr("Документы центра", "Орталық құжаттары")
      }}</EditorialButton>
    </section>

    <section class="ed-faq ed-section ed-wrap">
      <div>
        <p class="ed-kicker">{{ tr("Ответы на вопросы", "Сұрақтарға жауаптар") }}</p>
        <h2>
          {{
            tr("Хороший вопрос —\nуже начало.", "Жақсы сұрақ —\nістің басы.")
          }}
        </h2>
        <NuxtLink :to="path('/contacts')" class="ed-text-link"
          >{{ tr("Связаться с нами", "Бізге хабарласу")
          }}<CivicIcon name="arrow"
        /></NuxtLink>
      </div>
      <div>
        <details v-for="faq in faqs" :key="faq.q">
          <summary>{{ faq.q }}<span aria-hidden="true">+</span></summary>
          <p>{{ faq.a }}</p>
        </details>
      </div>
    </section>
    <section class="ed-final">
      <div class="ed-wrap">
        <p class="ed-kicker">
          {{ tr("Начните с вашей задачи", "Міндетіңізден бастаңыз") }}
        </p>
        <h2>
          {{
            tr(
              "К большому делу\nнужно быть готовым.",
              "Үлкен іске\nдайын болыңыз.",
            )
          }}
        </h2>
        <EditorialButton :to="path('/program-selection')">{{
          tr("Найти своё обучение", "Өз оқуыңызды табу")
        }}</EditorialButton>
      </div>
    </section>
  </div>
</template>
