<script setup lang="ts">
import { courseDirections, legacyCourseDirections, getCoursePublicPath } from "~/shared/course-registry";
import { getCourseSearchContent } from "~/shared/course-search-content";
import { sourceProductCardSummaries } from "~/shared/source-products";
import { getPublicCourseValue } from "~/shared/public-course-value";
import { leadContextQuery } from "~/shared/lead-context";
import { cities } from "~/config/cities";
import { seoExpansionMetadata } from '~/content/seo-expansion-metadata';

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
    "upravlenie-stressom",
    "seminar-dekretirovannoy-gruppy-sez",
  ].includes(id)
    ? "people"
    : id.includes("ekolog") || id === "iso-14001"
      ? "environment"
      : ["soglasitelnaya-komissiya", "protivodeystvie-korruptsii", "iso-9001", "menedzhment-ohrany-zdorovya"].includes(id)
        ? "management"
      : "safety";
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
const serviceLinks = computed(() => legacyCourseDirections.map((course) => ({
  id: course.id,
  label: getCourseSearchContent(course.id, lang.value)?.heading,
  to: link(getCoursePublicPath(course.id)!),
})));
const filters = computed(() => [
  { id: "all", label: tr("Все направления", "Барлық бағыттар") },
  { id: "safety", label: tr("Охрана труда и безопасность", "Еңбекті қорғау және қауіпсіздік") },
  { id: "people", label: tr("Первая помощь и защита людей", "Алғашқы көмек және адамдарды қорғау") },
  { id: "environment", label: tr("Экология", "Экология") },
  { id: "management", label: tr("Управление и трудовые отношения", "Басқару және еңбек қатынастары") },
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
    action: tr("Подобрать обучение", "Оқуды таңдау"),
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
    title: tr("Согласуйте условия", "Шарттарды келісіңіз"),
    text: tr(
      "Уточните формат, сроки и стоимость для вашей задачи.",
      "Міндетіңізге сай форматты, мерзімді және бағаны нақтылаңыз.",
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
          ? ['Еңбекті қорғау', 'және қауіпсіздік', 'бойынша оқыту.']
          : [seoExpansionMetadata.home.h1]
      "
      :description="
        tr(
          'Охрана труда, промышленная и пожарная безопасность. Выберите программу для себя или организуйте обучение сотрудников.',
          'Еңбекті қорғау, өнеркәсіптік және өрт қауіпсіздігі. Өзіңізге бағдарлама таңдаңыз немесе қызметкерлерді оқытуды ұйымдастырыңыз.',
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
          <EditorialButton :to="link('/courses')">{{
            tr("Каталог программ", "Бағдарламалар каталогы")
          }}</EditorialButton
          ><EditorialButton :to="link('/program-selection')" variant="text">{{
            tr("Подобрать обучение", "Оқуды таңдау")
          }}</EditorialButton>
        </div>
        <p class="ed-cover-note">
          {{ tr("На русском и казахском языке", "Орыс және қазақ тілдерінде") }}
        </p>
      </template>
    </EditorialCover>

    <div class="ed-assurance ed-wrap">
      <NuxtLink :to="link('/licenses')">
        <CivicIcon name="document" />
        <span>{{ tr('Документы и аккредитация центра', 'Орталық құжаттары және аккредиттеу') }}</span>
        <CivicIcon name="arrow" />
      </NuxtLink>
      <a href="#formats"><CivicIcon name="screen" /><span>{{ tr('Онлайн, очно и в вашей организации', 'Онлайн, күндізгі және ұйымыңызда') }}</span></a>
      <a href="#learning-path"><CivicIcon name="book" /><span>{{ tr('От выбора программы до документа', 'Бағдарлама таңдаудан құжат алуға дейін') }}</span></a>
    </div>

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
        :label="tr('Программы OT Center', 'OT Center бағдарламалары')"
        :title="
          tr(
            'Выберите направление обучения',
            'Оқу бағытын таңдаңыз',
          )
        "
        ><NuxtLink :to="link('/courses')" class="ed-text-link"
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
        <EditorialProgramCard
          v-for="course in visibleCourses"
          :key="course.id"
          :title="course.title[lang]"
          :description="description(course.id)"
          :purpose="course.value?.purpose[lang]"
          :to="link('/courses/' + course.id)"
          :request-to="priceRequest(course.id)"
        />
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
      <div class="ed-public-section">
        <h3>{{ tr('Обучение по направлениям безопасности в Казахстане', 'Қазақстанда қауіпсіздік бағыттары бойынша оқыту') }}</h3>
        <p>{{ tr('Сравните задачи подготовки и требования к участникам. На страницах направлений — выбор программы, документы и материалы по теме.', 'Даярлық міндеттері мен қатысушыларға талаптарды салыстырыңыз. Бағыт беттерінде бағдарлама таңдау, құжаттар және тақырыптық материалдар берілген.') }}</p>
        <div class="ed-public-links"><NuxtLink v-for="service in serviceLinks" :key="service.id" :to="service.to">{{ service.label }}</NuxtLink></div>
      </div>
    </section>

    <section id="learning-path" class="ed-story">
      <div class="ed-wrap">
        <EditorialChapter
          number=""
          :label="tr('От программы к результату', 'Бағдарламадан нәтижеге')"
          :title="
            tr(
              'Как проходит обучение',
              'Оқу қалай өтеді',
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
          tr('Выберите удобный формат', 'Ыңғайлы форматты таңдаңыз')
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
            {{ tr("Обучение в вашем городе", "Қалаңыздағы оқу") }}
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

    <section class="ed-faq ed-section ed-wrap">
      <div>
        <p class="ed-kicker">{{ tr("Ответы на вопросы", "Сұрақтарға жауаптар") }}</p>
        <h2>
          {{
            tr("Что нужно знать\nперед обучением", "Оқу алдында\nнені білу керек")
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
              "Поможем выбрать\nнужную программу.",
              "Қажетті бағдарламаны\nтаңдауға көмектесеміз.",
            )
          }}
        </h2>
        <EditorialButton :to="link('/program-selection')">{{
          tr("Подобрать обучение", "Оқуды таңдау")
        }}</EditorialButton>
      </div>
    </section>
  </div>
</template>
