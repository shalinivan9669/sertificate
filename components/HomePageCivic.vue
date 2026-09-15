<script setup lang="ts">
import { courseDirections } from '~/shared/course-registry';
import { sourceProductCardSummaries } from '~/shared/source-products';
import { getPublicCourseValue } from '~/shared/public-course-value';
import { cities } from '~/config/cities';

const { locale } = useI18n();
const path = useLocalePath();
const lang = computed(() => locale.value === 'kk' ? 'kk' : 'ru');
const tr = (ru: string, kk: string) => lang.value === 'kk' ? kk : ru;
const filter = ref('all');
const expanded = ref(false);
const group = (id: string) => ['pervaya-pomoshch', 'inklyuzivnaya-kultura', 'antiterroristicheskaya-podgotovka'].includes(id) ? 'people' : id.includes('ekolog') ? 'environment' : 'safety';
const iconFor = (id: string) => id === 'pervaya-pomoshch' ? 'heart' : id.includes('elektro') ? 'bolt' : id.includes('ekolog') ? 'leaf' : id === 'ohrana-truda' ? 'shield' : id === 'promyshlennaya-bezopasnost' ? 'building' : 'book';
const priority = ['ohrana-truda', 'pervaya-pomoshch', 'promyshlennaya-bezopasnost', 'ptm', 'elektrobezopasnost', 'ekologicheskaya-bezopasnost'];
const allCourses = computed(() => [...courseDirections].sort((a, b) => {
  const ai = priority.indexOf(a.id), bi = priority.indexOf(b.id);
  return (ai < 0 ? 100 : ai) - (bi < 0 ? 100 : bi);
}).map(course => ({ ...course, value: getPublicCourseValue(course.id), icon: iconFor(course.id) })));
const filteredCourses = computed(() => allCourses.value.filter(course => filter.value === 'all' || group(course.id) === filter.value));
const visibleCourses = computed(() => expanded.value ? filteredCourses.value : filteredCourses.value.slice(0, 6));
const filters = computed(() => [
  { id: 'all', label: tr('Все направления', 'Барлық бағыттар') },
  { id: 'safety', label: tr('Безопасная работа', 'Қауіпсіз жұмыс') },
  { id: 'people', label: tr('Забота о людях', 'Адамдарға қамқорлық') },
  { id: 'environment', label: tr('Окружающая среда', 'Қоршаған орта') },
]);
const descriptions: Record<string, { ru: string; kk: string }> = {
  'ohrana-truda': { ru: 'Понятные правила для безопасной работы сотрудников и руководителей.', kk: 'Қызметкерлер мен басшылардың қауіпсіз жұмысына арналған түсінікті ережелер.' },
  'pervaya-pomoshch': { ru: 'Знания и навыки, которые помогают позаботиться о человеке рядом.', kk: 'Жаныңыздағы адамға көмектесуге арналған білім мен дағдылар.' },
  'promyshlennaya-bezopasnost': { ru: 'Подготовка для ответственной работы на производственных объектах.', kk: 'Өндірістік нысандарда жауапты жұмыс істеуге дайындық.' },
  ptm: { ru: 'Профилактика пожаров и порядок действий для работников и организаций.', kk: 'Қызметкерлер мен ұйымдар үшін өрттің алдын алу және әрекет ету тәртібі.' },
  'elektrobezopasnost': { ru: 'Основы безопасной работы с электрооборудованием и электроустановками.', kk: 'Электр жабдықтарымен және қондырғыларымен қауіпсіз жұмыс істеу негіздері.' },
  'ekologicheskaya-bezopasnost': { ru: 'Ответственный подход к окружающей среде в ежедневной работе.', kk: 'Күнделікті жұмыста қоршаған ортаға жауапкершілікпен қарау.' },
};
const description = (id: string) => descriptions[id]?.[lang.value] || sourceProductCardSummaries[id]?.[lang.value] || tr('Содержание, аудитория и условия обучения — на странице программы.', 'Бағдарлама бетінде оқу мазмұны, аудиториясы және шарттары берілген.');
const entryCards = computed(() => [
  { n: '01', icon: 'book', title: tr('Выбираю обучение', 'Оқуды таңдаймын'), text: tr('Найдём программу под вашу работу и задачу.', 'Жұмысыңыз бен міндетіңізге сай бағдарлама табамыз.'), action: tr('Подобрать программу', 'Бағдарлама таңдау'), to: '/program-selection', tone: 'sage' },
  { n: '02', icon: 'people', title: tr('Обучаю команду', 'Команданы оқытамын'), text: tr('Обсудим формат и обучение сотрудников.', 'Қызметкерлерді оқыту мен форматын талқылаймыз.'), action: tr('Для компаний', 'Компанияларға'), to: '/b2b', tone: 'sand' },
  { n: '03', icon: 'user', title: tr('Продолжаю учиться', 'Оқуды жалғастырамын'), text: tr('Мои программы, прогресс и документы.', 'Бағдарламаларым, үлгерімім және құжаттарым.'), action: tr('Личный кабинет', 'Жеке кабинет'), to: '/cabinet', tone: 'blue' },
]);
const steps = computed(() => [
  { title: tr('Выберите программу', 'Бағдарламаны таңдаңыз'), text: tr('Изучите содержание, аудиторию и условия.', 'Мазмұнымен, аудиториясымен және шарттарымен танысыңыз.') },
  { title: tr('Пройдите обучение', 'Оқудан өтіңіз'), text: tr('Изучайте материалы выбранной программы.', 'Таңдаған бағдарламаңыздың материалдарын оқыңыз.') },
  { title: tr('Проверьте знания', 'Біліміңізді тексеріңіз'), text: tr('Пройдите проверку по условиям курса.', 'Курс шарттарына сәйкес білім тексеруден өтіңіз.') },
  { title: tr('Получите документ', 'Құжатты алыңыз'), text: tr('После выполнения условий он появится в кабинете.', 'Шарттар орындалғаннан кейін жеке кабинетте пайда болады.') },
]);
const formats = computed(() => [
  { icon: 'screen', title: tr('Онлайн', 'Онлайн'), text: tr('Учебные материалы в вашем личном кабинете.', 'Оқу материалдары жеке кабинетіңізде.'), to: '/online-obuchenie', label: tr('Где вам удобно', 'Сізге ыңғайлы жерде') },
  { icon: 'building', title: tr('В учебном центре', 'Оқу орталығында'), text: tr('Очные занятия и живое общение с преподавателем.', 'Күндізгі сабақтар және оқытушымен тікелей қарым-қатынас.'), to: '/ochnoe-obuchenie', label: tr('Вместе с преподавателем', 'Оқытушымен бірге') },
  { icon: 'people', title: tr('В вашей организации', 'Ұйымыңызда'), text: tr('Выездное обучение под задачи вашей команды.', 'Командаңыздың міндеттеріне сай көшпелі оқыту.'), to: '/vyezdnoe-obuchenie', label: tr('Для всей команды', 'Бүкіл команда үшін') },
]);
const faqs = computed(() => [
  { q: tr('Как понять, какая программа мне нужна?', 'Маған қандай бағдарлама қажет екенін қалай білемін?'), a: tr('Начните с подбора программы: укажите направление, свою роль и формат обучения. Затем изучите содержание и условия в карточке курса. Если нужна помощь, свяжитесь с учебным центром.', 'Бағдарлама таңдаудан бастаңыз: бағытты, рөліңізді және оқу форматын көрсетіңіз. Содан кейін курс мазмұны мен шарттарын оқыңыз. Көмек қажет болса, оқу орталығына хабарласыңыз.') },
  { q: tr('Можно ли обучить сотрудников организации?', 'Ұйым қызметкерлерін оқытуға бола ма?'), a: tr('Да. На странице «Для компаний» можно указать направление, число участников, город и удобный формат. Центр уточнит условия и возможность организации обучения.', 'Иә. «Компанияларға» бетінде бағытты, қатысушылар санын, қаланы және ыңғайлы форматты көрсете аласыз. Орталық оқыту шарттары мен мүмкіндігін нақтылайды.') },
  { q: tr('Где будут мои материалы и документы?', 'Материалдарым мен құжаттарым қайда болады?'), a: tr('В личном кабинете: там доступны ваши записи на обучение, прогресс, заказы и выданные документы. Доступ и выдача зависят от условий выбранной программы.', 'Жеке кабинетте: оқуға тіркелу, үлгерім, тапсырыстар және берілген құжаттар сонда қолжетімді. Қолжетімділік пен құжат беру таңдалған бағдарламаның шарттарына байланысты.') },
]);
</script>

<template>
  <div class="civic-home">
    <section class="civic-hero" aria-labelledby="civic-hero-title">
      <div class="civic-hero-copy">
        <p class="civic-eyebrow"><span class="civic-status-dot" />{{ tr('ОБУЧЕНИЕ С ЗАБОТОЙ О ЛЮДЯХ', 'АДАМДАРҒА ҚАМҚОРЛЫҚПЕН ОҚЫТУ') }}</p>
        <h1 id="civic-hero-title">{{ tr('Знания, с которыми', 'Біліммен бірге') }}<br><span>{{ tr('спокойнее', 'сенімдірек') }}</span><br>{{ tr('работать и жить.', 'жұмыс пен өмір.') }}</h1>
        <p class="civic-hero-description">{{ tr('Охрана труда, безопасность и профессиональное обучение. Понятно, последовательно и с вниманием к каждому человеку.', 'Еңбекті қорғау, қауіпсіздік және кәсіби оқыту. Түсінікті, жүйелі және әр адамға көңіл бөле отырып.') }}</p>
        <div class="civic-hero-buttons"><NuxtLink :to="path('/program-selection')" class="civic-button">{{ tr('Подобрать обучение', 'Оқуды таңдау') }}<CivicIcon name="arrow" /></NuxtLink><NuxtLink :to="path('/courses')" class="civic-text-link">{{ tr('Посмотреть курсы', 'Курстарды қарау') }}<CivicIcon name="northeast" /></NuxtLink></div>
        <p class="civic-hero-note"><CivicIcon name="check" />{{ tr('На русском и казахском', 'Орысша және қазақша') }}<span aria-hidden="true">·</span>{{ tr('Для себя и команды', 'Өзіңіз бен командаңыз үшін') }}</p>
      </div>
      <div class="civic-hero-art">
        <div class="civic-art-label"><span class="civic-status-dot" />{{ tr('Среда, в которой хорошо', 'Жайлы орта') }}</div>
        <img src="/images/civic-city.png" width="1536" height="1024" fetchpriority="high" :alt="tr('Светлый зелёный город: учебный центр, больница, общественный транспорт и пешеходные дорожки.', 'Жарық жасыл қала: оқу орталығы, аурухана, қоғамдық көлік және жаяу жүргінші жолдары.')">
        <div class="civic-art-caption"><span class="civic-caption-icon"><CivicIcon name="shield" /></span><div><strong>{{ tr('Безопасность начинается', 'Қауіпсіздік') }}<br>{{ tr('со знаний', 'білімнен басталады') }}</strong><span>{{ tr('В работе. В городе. В жизни.', 'Жұмыста. Қалада. Өмірде.') }}</span></div></div>
        <span class="civic-art-index" aria-hidden="true">OT / {{ new Date().getFullYear() }}</span>
      </div>
    </section>

    <section class="civic-entry-grid" :aria-label="tr('С чего начнём', 'Неден бастаймыз')">
      <NuxtLink v-for="card in entryCards" :key="card.n" :to="path(card.to)" class="civic-entry" :class="'tone-' + card.tone"><span class="civic-entry-top"><span class="civic-icon-tile"><CivicIcon :name="card.icon" /></span><span class="civic-entry-number">{{ card.n }}</span></span><h2>{{ card.title }}</h2><p>{{ card.text }}</p><span class="civic-entry-action">{{ card.action }}<CivicIcon name="arrow" /></span></NuxtLink>
    </section>

    <section id="courses" class="civic-section" aria-labelledby="civic-courses-title">
      <div class="civic-section-heading"><div><p class="civic-eyebrow">{{ tr('ПОЛЕЗНО В ВАШЕЙ РАБОТЕ', 'ЖҰМЫСЫҢЫЗҒА ПАЙДАЛЫ') }}</p><h2 id="civic-courses-title">{{ tr('Знания для важных дел', 'Маңызды істерге арналған білім') }}<span class="civic-count">{{ allCourses.length }}</span></h2></div><NuxtLink :to="path('/courses')" class="civic-text-link">{{ tr('Весь каталог', 'Толық каталог') }}<CivicIcon name="arrow" /></NuxtLink></div>
      <div class="civic-filters" :aria-label="tr('Направления обучения', 'Оқу бағыттары')"><button v-for="item in filters" :key="item.id" type="button" :aria-pressed="filter === item.id" :class="{ active: filter === item.id }" @click="filter = item.id; expanded = false">{{ item.label }}</button></div>
      <p class="sr-only" role="status">{{ tr('Найдено направлений:', 'Табылған бағыттар:') }} {{ filteredCourses.length }}</p>
      <div class="civic-course-grid">
        <article v-for="course in visibleCourses" :key="course.id" class="civic-course-card"><div class="civic-course-top"><span class="civic-icon-tile" :class="'tile-' + course.icon"><CivicIcon :name="course.icon" /></span><span class="civic-course-kind">{{ tr('ПРОГРАММА ОБУЧЕНИЯ', 'ОҚУ БАҒДАРЛАМАСЫ') }}</span></div><h3>{{ course.title[lang] }}</h3><p>{{ description(course.id) }}</p><div class="civic-course-bottom"><div><strong v-if="course.value">{{ course.value.purpose[lang] }}</strong><span>{{ tr('Стоимость по запросу', 'Бағасы сұрау бойынша') }}</span></div><NuxtLink :to="path('/courses/' + course.id)" class="civic-course-link" :aria-label="tr('Содержание и условия: ', 'Мазмұны мен шарттары: ') + course.title[lang]"><CivicIcon name="northeast" /></NuxtLink></div></article>
      </div>
      <button v-if="filteredCourses.length > 6" type="button" class="civic-show-more" :aria-expanded="expanded" @click="expanded = !expanded">{{ expanded ? tr('Показать меньше', 'Азырақ көрсету') : tr('Показать все направления', 'Барлық бағыттарды көрсету') }}<span>{{ filteredCourses.length }}</span></button>
    </section>

    <section class="civic-journey civic-section" aria-labelledby="civic-journey-title"><div class="civic-section-heading"><div><p class="civic-eyebrow">{{ tr('ВСЁ ПОНЯТНО С ПЕРВОГО ШАГА', 'БІРІНШІ ҚАДАМНАН ТҮСІНІКТІ') }}</p><h2 id="civic-journey-title">{{ tr('От интереса — к знаниям', 'Қызығушылықтан — білімге') }}</h2></div><p>{{ tr('Вы понимаете, где находитесь', 'Қай кезеңде екеніңіз және') }}<br>{{ tr('и что будет дальше.', 'келесі қадам қандай екені түсінікті.') }}</p></div><ol class="civic-journey-steps"><li v-for="(step, index) in steps" :key="step.title"><span class="civic-step-number">0{{ index + 1 }}</span><h3>{{ step.title }}</h3><p>{{ step.text }}</p></li></ol><p class="civic-journey-note"><CivicIcon name="document" />{{ tr('Формат проверки и выдаваемый документ указаны в условиях конкретной программы.', 'Білім тексеру форматы мен берілетін құжат нақты бағдарламаның шарттарында көрсетілген.') }}</p></section>

    <section id="formats" class="civic-section" aria-labelledby="civic-formats-title"><div class="civic-section-heading"><div><p class="civic-eyebrow">{{ tr('ОБУЧЕНИЕ ВПИСЫВАЕТСЯ В ЖИЗНЬ', 'ОҚУ ӨМІРІҢІЗГЕ САЙ') }}</p><h2 id="civic-formats-title">{{ tr('Ваш удобный формат', 'Сізге ыңғайлы формат') }}</h2></div></div><div class="civic-format-grid"><NuxtLink v-for="(format, index) in formats" :key="format.to" :to="path(format.to)" class="civic-format-card"><div class="civic-format-visual" :class="'format-' + index"><CivicIcon :name="format.icon" /><span>{{ format.label }}</span><span class="civic-format-orbit" aria-hidden="true" /></div><div class="civic-format-content"><h3>{{ format.title }}<CivicIcon name="northeast" /></h3><p>{{ format.text }}</p></div></NuxtLink></div></section>

    <section class="civic-city-section civic-section" aria-labelledby="civic-city-title"><div class="civic-city-intro"><span class="civic-icon-tile"><CivicIcon name="pin" /></span><p class="civic-eyebrow">{{ tr('РЯДОМ С ВАМИ', 'СІЗГЕ ЖАҚЫН') }}</p><h2 id="civic-city-title">{{ tr('Ваш город.', 'Сіздің қалаңыз.') }}<br>{{ tr('Ваши возможности.', 'Сіздің мүмкіндіктеріңіз.') }}</h2><p>{{ tr('Узнайте об обучении в своём городе: направления, форматы и информация для вашей работы.', 'Өз қалаңыздағы оқу туралы біліңіз: бағыттар, форматтар және жұмысыңызға қажетті ақпарат.') }}</p></div><div class="civic-city-links"><NuxtLink v-for="city in cities" :key="city.slug" :to="path('/' + city.slug)">{{ lang === 'kk' ? city.nameKk : city.nameRu }}<CivicIcon name="northeast" /></NuxtLink></div></section>

    <section class="civic-trust-row"><div class="civic-icon-tile"><CivicIcon name="shield" /></div><div><h2>{{ tr('Доверие начинается с открытости', 'Сенім ашықтықтан басталады') }}</h2><p>{{ tr('Информация об учебном центре, аккредитации и документах — в открытом доступе.', 'Оқу орталығы, аккредиттеу және құжаттар туралы ақпарат ашық қолжетімді.') }}</p></div><NuxtLink :to="path('/licenses')" class="civic-text-link">{{ tr('Документы центра', 'Орталық құжаттары') }}<CivicIcon name="arrow" /></NuxtLink></section>

    <section class="civic-faq civic-section" aria-labelledby="civic-faq-title"><div><p class="civic-eyebrow">{{ tr('ПОМОГАЕМ РАЗОБРАТЬСЯ', 'ТҮСІНУГЕ КӨМЕКТЕСЕМІЗ') }}</p><h2 id="civic-faq-title">{{ tr('Можно просто', 'Жай ғана') }}<br>{{ tr('спросить', 'сұрауға болады') }}</h2><NuxtLink :to="path('/contacts')" class="civic-text-link">{{ tr('Связаться с нами', 'Бізге хабарласу') }}<CivicIcon name="arrow" /></NuxtLink></div><div class="civic-faq-list"><details v-for="faq in faqs" :key="faq.q"><summary>{{ faq.q }}<span aria-hidden="true">+</span></summary><p>{{ faq.a }}</p></details></div></section>
    <section class="civic-final-cta"><div><CivicIcon name="sun" /><h2>{{ tr('Хороший день, чтобы узнать больше.', 'Көбірек білуге жақсы күн.') }}</h2></div><NuxtLink :to="path('/program-selection')" class="civic-button">{{ tr('Найти своё обучение', 'Өз оқуыңызды табу') }}<CivicIcon name="arrow" /></NuxtLink></section>
  </div>
</template>
