import { computed, unref } from 'vue';
import { useI18n } from '#imports';
import { cities, type CityContent, type LocalizedList, type LocalizedText } from '~/content/cities';
import { courses, type CourseContent } from '~/content/courses';
import { cityCourseOverrides } from '~/content/cityCourseOverrides';

type TextPiece = {
  text: string;
  source: 'city' | 'course' | 'mixed';
};

type SeoHero = {
  title: string;
  h1: string;
  description: string;
  tags: string[];
};

type SeoModule = {
  title: string;
  bullets?: string[];
  items?: { title: string; text: string }[];
  steps?: { title: string; text: string }[];
  notes?: string[];
  faqs?: { q: string; a: string }[];
  links?: { label: string; to: string }[];
};

export type SeoContent = {
  hero: SeoHero;
  modules: {
    whoNeeds: SeoModule;
    scenarios: SeoModule;
    process: SeoModule;
    faq: SeoModule;
    related: SeoModule;
  };
  meta: {
    title: string;
    description: string;
  };
  composition: {
    wordCount: number;
    cityRatio: number;
    courseRatio: number;
  };
};

const copy = {
  ru: {
    baseTopic: 'Обучение по охране труда',
    whoNeedsTitle: (city: string) => `Кому актуально в городе ${city}`,
    scenariosTitle: 'Сценарии и риски',
    processTitle: (city: string) => `Как проходит в городе ${city}`,
    faqTitle: 'Частые вопросы',
    relatedCityTitle: 'Популярные программы в городе',
    relatedCourseTitle: 'Полезные ссылки по направлению',
    mistakeLabel: 'Ошибка',
    riskLabel: 'Риск',
  },
  kk: {
    baseTopic: 'Еңбекті қорғау бойынша оқыту',
    whoNeedsTitle: (city: string) => `${city} қаласында кімге қажет`,
    scenariosTitle: 'Сценарийлер мен тәуекелдер',
    processTitle: (city: string) => `${city} қаласында қалай өтеді`,
    faqTitle: 'Жиі қойылатын сұрақтар',
    relatedCityTitle: 'Қала бойынша негізгі бағдарламалар',
    relatedCourseTitle: 'Бағыт бойынша пайдалы сілтемелер',
    mistakeLabel: 'Қате',
    riskLabel: 'Тәуекел',
  },
};

const sortedCourses = [...courses].sort((a, b) => a.slug.localeCompare(b.slug));
const sortedCities = [...cities].sort((a, b) => a.slug.localeCompare(b.slug));

const fallback = {
  industry: ['производство', 'строительство', 'логистика'],
  logistics: ['гибкий график обучения', 'доставка документов'],
  formats: ['онлайн без отрыва', 'очно или выездом'],
  painPoints: ['нехватка времени', 'разрозненные команды', 'риски проверок', 'сезонные пики'],
  whoNeeds: ['руководители', 'специалисты', 'мастера', 'ответственные лица'],
  mistakes: ['формальный инструктаж', 'отсутствие протоколов', 'неактуальные программы', 'необученные сотрудники'],
  documents: ['удостоверение', 'протокол', 'журнал', 'программа'],
  faqCity: ['Какие форматы доступны?', 'Как быстро оформить документы?', 'Можно ли учесть график?'],
  faqCourse: ['Как проходит обучение?', 'Нужна ли проверка знаний?', 'Какие документы выдаются?'],
};

const getText = (value: LocalizedText, locale: string) => value[locale] || value.ru || value.kk;
const getList = (value: LocalizedList, locale: string) => value[locale] || value.ru || value.kk;

const stableHash = (input: string) => {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const mulberry32 = (seed: number) => {
  let t = seed;
  return () => {
    t += 0x6d2b79f5;
    let result = Math.imul(t ^ (t >>> 15), t | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
};

const shuffleWithSeed = <T,>(items: T[], seed: string) => {
  const rng = mulberry32(stableHash(seed));
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
};

const pickK = <T,>(items: T[], count: number, seed: string) =>
  shuffleWithSeed(items, seed).slice(0, Math.min(count, items.length));

const ensureMin = (items: string[], min: number, seed: string, backup: string[]) => {
  if (items.length >= min) return items;
  const missing = min - items.length;
  const extras = pickK(
    backup.filter((item) => !items.includes(item)),
    missing,
    seed,
  );
  return [...items, ...extras];
};

const replaceCity = (text: string, cityName: string) => text.replace('{city}', cityName);

const countWords = (text: string) => {
  const matches = text.match(/[A-Za-zА-Яа-яЁёӘәӨөҮүҚқҒғІі0-9]+/g);
  return matches ? matches.length : 0;
};

const buildComposition = (pieces: TextPiece[]) => {
  let total = 0;
  let city = 0;
  let course = 0;
  let mixed = 0;

  pieces.forEach((piece) => {
    const words = countWords(piece.text);
    total += words;
    if (piece.source === 'city') city += words;
    if (piece.source === 'course') course += words;
    if (piece.source === 'mixed') mixed += words;
  });

  const cityRatio = total ? (city + mixed * 0.5) / total : 0;
  const courseRatio = total ? (course + mixed * 0.5) / total : 0;

  return {
    wordCount: total,
    cityRatio,
    courseRatio,
  };
};

const firstSentence = (text: string) => {
  const idx = text.indexOf('.');
  if (idx === -1) return text;
  return text.slice(0, idx + 1);
};

const ensureSentence = (text: string) => (text.trim().endsWith('.') ? text.trim() : `${text.trim()}.`);

export const buildSeoContent = (
  city: CityContent | null | undefined,
  course: CourseContent | null | undefined,
  locale: string,
): SeoContent | null => {
  if (!city) return null;

  const isCoursePage = Boolean(course);
  const seedBase = `${city.slug}|${course?.slug || ''}`;
  const localeCopy = copy[locale as 'ru' | 'kk'] || copy.ru;

  const cityName = getText(city.name, locale);
  const region = getText(city.region, locale);
  const cityLabel = locale === 'kk' ? `${cityName} қаласында` : `в городе ${cityName}`;
  const cityPrefix = locale === 'kk' ? `${cityName} қаласында` : `В городе ${cityName}`;

  const industryTags = ensureMin(
    getList(city.industryTags, locale),
    3,
    `${seedBase}|industry`,
    fallback.industry,
  );
  const logisticsNotes = ensureMin(
    getList(city.logisticsNotes, locale),
    2,
    `${seedBase}|logistics`,
    fallback.logistics,
  );
  const formatPriority = ensureMin(
    getList(city.formatPriority, locale),
    2,
    `${seedBase}|formats`,
    fallback.formats,
  );
  const localPainPoints = ensureMin(
    getList(city.localPainPoints, locale),
    4,
    `${seedBase}|pain`,
    fallback.painPoints,
  );
  const faqCity = ensureMin(
    getList(city.faqCity, locale),
    3,
    `${seedBase}|faqCity`,
    fallback.faqCity,
  );

  const focusCourse = course || pickK(sortedCourses, 1, `${seedBase}|focus`)[0];
  const courseName = getText(focusCourse.name, locale);
  const courseGoal = getText(focusCourse.goal, locale);
  const whoNeeds = ensureMin(
    getList(focusCourse.whoNeeds, locale),
    4,
    `${seedBase}|who`,
    fallback.whoNeeds,
  );
  const commonMistakes = ensureMin(
    getList(focusCourse.commonMistakes, locale),
    4,
    `${seedBase}|mistakes`,
    fallback.mistakes,
  );
  const documents = ensureMin(
    getList(focusCourse.documents, locale),
    4,
    `${seedBase}|documents`,
    fallback.documents,
  );
  const faqCourse = ensureMin(
    getList(focusCourse.faqCourse, locale),
    3,
    `${seedBase}|faqCourse`,
    fallback.faqCourse,
  );

  const industriesPick = pickK(industryTags, 2, `${seedBase}|hero-industries`);
  const formatsPick = pickK(formatPriority, 2, `${seedBase}|hero-formats`);

  const baseTopic = isCoursePage ? courseName : localeCopy.baseTopic;
  const fallbackHeroTitle = `${baseTopic} ${cityLabel} - ${industriesPick[0]}, ${formatsPick[0]}`;
  const overrideTitle =
    course && cityCourseOverrides[`${city.slug}|${course.slug}`]?.heroTitle
      ? getText(cityCourseOverrides[`${city.slug}|${course.slug}`]!.heroTitle!, locale)
      : '';
  const heroTitle = overrideTitle ? `${overrideTitle}. ${fallbackHeroTitle}` : fallbackHeroTitle;

  const heroH1 = isCoursePage
    ? `${courseName} ${cityLabel}: ${industriesPick[0]} и ${industriesPick[1]}`
    : `${localeCopy.baseTopic} ${cityLabel}: ${industriesPick[0]} и ${industriesPick[1]}`;

  const fallbackHeroDescription = [
    `Регион: ${region}.`,
    `Ключевые отрасли - ${industriesPick.join(', ')}.`,
    `Приоритетные форматы: ${formatsPick.join(' и ')}.`,
  ].join(' ');

  const overrideDescription =
    course && cityCourseOverrides[`${city.slug}|${course.slug}`]?.heroDescription
      ? getText(cityCourseOverrides[`${city.slug}|${course.slug}`]!.heroDescription!, locale)
      : '';

  const heroDescription = [overrideDescription, fallbackHeroDescription].filter(Boolean).join(' ');

  const heroTags = [region, ...industriesPick, ...formatsPick];

  const whoNeedsPick = pickK(whoNeeds, 3, `${seedBase}|whoNeeds`);
  const industryPick = pickK(industryTags, 3, `${seedBase}|industryNeeds`);
  const whoNeedsTemplates = [
    (who: string, industry: string) => `Для ${who} в секторе "${industry}".`,
    (who: string, industry: string) =>
      `Для команд ${industry}, где ответственность за безопасность несет ${who}.`,
    (who: string, industry: string) =>
      `Для ${who}, которые работают в связке с подрядчиками ${industry}.`,
    (who: string, industry: string) => `Для ${industry}: актуально для роли "${who}".`,
    (who: string, industry: string) =>
      `Для ${who} в ${industry}, где важен быстрый допуск сотрудников.`,
    (who: string, industry: string) =>
      `Для ${who} в ${industry} с распределенными сменами.`,
  ];

  const whoNeedsBullets = whoNeedsTemplates.map((template, index) =>
    template(whoNeedsPick[index % whoNeedsPick.length], industryPick[index % industryPick.length]),
  );

  const mistakesPick = pickK(commonMistakes, 2, `${seedBase}|mistake`);
  const painPick = pickK(localPainPoints, 2, `${seedBase}|painPick`);
  const scenarioItems = [
    {
      title: `${localeCopy.mistakeLabel}: ${mistakesPick[0]}`,
      text: `${cityPrefix} это особенно заметно на объектах ${industriesPick[0]}. Формат "${formatsPick[0]}" помогает убрать риск через регулярную проверку знаний.`,
    },
    {
      title: `${localeCopy.mistakeLabel}: ${mistakesPick[1]}`,
      text: `Для команд ${industriesPick[1]} ${cityLabel} важно закрыть эту зону до допуска к работам и зафиксировать протоколы.`,
    },
    {
      title: `${localeCopy.riskLabel}: ${painPick[0]}`,
      text: `В регионе ${region} этот риск усиливается, когда ${logisticsNotes[0]}. Мы планируем занятия так, чтобы документы были готовы к проверкам.`,
    },
    {
      title: `${localeCopy.riskLabel}: ${painPick[1]}`,
      text: `Если ${logisticsNotes[1]}, важно закрепить порядок в журналах и контрольных листах сразу после обучения.`,
    },
  ];

  const stepItems = [
    {
      title: 'Карта задач и ролей',
      text: `Фиксируем цель: ${ensureSentence(courseGoal)} Уточняем роли для команд ${industriesPick.join(
        ' и ',
      )}.`,
    },
    {
      title: `Выбор формата для ${cityName}`,
      text: `Опираемся на приоритеты ${formatsPick.join(' и ')} и учитываем ${logisticsNotes[0]}.`,
    },
    {
      title: 'Подготовка материалов',
      text: `Примеры и кейсы подстраиваем под ${industriesPick.join(' и ')} и устраняем типовые ошибки.`,
    },
    {
      title: 'Проведение и контроль',
      text: `Сессии строим так, чтобы ${logisticsNotes[1]}, а результаты фиксировались в реестрах.`,
    },
    {
      title: 'Проверка знаний и документы',
      text: `Итог - ${documents[0]}, ${documents[1]} и протокол проверки знаний.`,
    },
  ];

  const cityFaqItems = faqCity.map((question, index) => {
    const normalizedQuestion = replaceCity(question, cityName);
    const answerParts = [
      `${cityPrefix} (${region}) чаще всего обучаем команды из ${industriesPick.join(' и ')}.`,
      `Форматы ${formatsPick.join(' и ')} закрывают спрос без простоя сотрудников.`,
      `С учетом ${localPainPoints[index % localPainPoints.length]} мы рекомендуем планировать обучение заранее.`,
    ];
    return {
      q: normalizedQuestion,
      a: answerParts.slice(0, 2 + (index % 2)).join(' '),
    };
  });

  const courseFaqItems = faqCourse.map((question, index) => {
    const answerParts = [
      `Цель программы - ${courseGoal}`,
      `По итогам оформляем ${documents.slice(0, 2).join(' и ')}.`,
      `Типовые ошибки вроде "${commonMistakes[index % commonMistakes.length]}" закрываем практикой и проверкой знаний.`,
    ];
    return {
      q: question,
      a: answerParts.slice(0, 2 + ((index + 1) % 2)).join(' '),
    };
  });

  const faqItems = [...cityFaqItems, ...courseFaqItems];

  const courseLinks = pickK(
    sortedCourses.filter((item) => item.slug !== focusCourse.slug),
    3,
    `${seedBase}|related`,
  );
  const relatedLinks = isCoursePage
    ? [
        { label: `${cityName}: все программы`, to: `/${city.slug}` },
        ...courseLinks.map((item) => ({
          label: getText(item.name, locale),
          to: `/${city.slug}/${item.slug}`,
        })),
      ]
    : pickK(sortedCourses, 4, `${seedBase}|city-links`).map((item) => ({
        label: getText(item.name, locale),
        to: `/${city.slug}/${item.slug}`,
      }));

  const extraNotes =
    course && cityCourseOverrides[`${city.slug}|${course.slug}`]?.extraNotes
      ? getList(cityCourseOverrides[`${city.slug}|${course.slug}`]!.extraNotes!, locale)
      : [];

  const textPieces: TextPiece[] = [
    { text: heroH1, source: 'mixed' },
    { text: heroDescription, source: 'mixed' },
    ...whoNeedsBullets.map((text) => ({ text, source: 'mixed' })),
    ...scenarioItems.map((item) => ({ text: item.text, source: 'mixed' })),
    { text: stepItems[0].text, source: 'mixed' },
    { text: stepItems[1].text, source: 'city' },
    { text: stepItems[2].text, source: 'mixed' },
    { text: stepItems[3].text, source: 'city' },
    { text: stepItems[4].text, source: 'course' },
    ...cityFaqItems.map((item) => ({ text: item.a, source: 'city' })),
    ...courseFaqItems.map((item) => ({ text: item.a, source: 'course' })),
    ...extraNotes.map((text) => ({ text, source: 'city' })),
  ];

  let composition = buildComposition(textPieces);
  const extraParagraphs: string[] = [];

  const cityFiller = `${cityPrefix} (${region}) ключевую роль играют ${industryTags
    .slice(0, 2)
    .join(' и ')}. Форматы ${formatPriority.slice(0, 2).join(' и ')} позволяют работать без простоя.`;
  const courseFiller = `${courseName}: итог фиксируется через ${documents
    .slice(0, 3)
    .join(', ')}. Программа закрывает риски и приводит к контролируемой проверке знаний.`;
  const mixedFiller = `Комбинация ${formatsPick.join(' и ')} подходит для ${industriesPick.join(
    ' и ',
  )} и помогает устранить "${commonMistakes[0]}" на старте.`;

  if (isCoursePage && composition.cityRatio < 0.4) {
    extraParagraphs.push(cityFiller);
    textPieces.push({ text: cityFiller, source: 'city' });
  }
  if (isCoursePage && composition.courseRatio < 0.4) {
    extraParagraphs.push(courseFiller);
    textPieces.push({ text: courseFiller, source: 'course' });
  }
  if (isCoursePage && composition.wordCount < 350) {
    extraParagraphs.push(mixedFiller);
    textPieces.push({ text: mixedFiller, source: 'mixed' });
  }

  composition = buildComposition(textPieces);

  let safety = 0;
  while (
    isCoursePage &&
    (composition.cityRatio < 0.4 || composition.courseRatio < 0.4 || composition.wordCount < 350) &&
    safety < 2
  ) {
    if (composition.cityRatio < 0.4) {
      extraParagraphs.push(cityFiller);
      textPieces.push({ text: cityFiller, source: 'city' });
    }
    if (composition.courseRatio < 0.4) {
      extraParagraphs.push(courseFiller);
      textPieces.push({ text: courseFiller, source: 'course' });
    }
    if (composition.wordCount < 350) {
      extraParagraphs.push(mixedFiller);
      textPieces.push({ text: mixedFiller, source: 'mixed' });
    }
    composition = buildComposition(textPieces);
    safety += 1;
  }

  let finalFaqItems = faqItems;
  let finalScenarioItems = scenarioItems;
  let finalStepItems = stepItems;

  if (isCoursePage && composition.wordCount > 500) {
    finalScenarioItems = scenarioItems.map((item) => ({
      ...item,
      text: firstSentence(item.text),
    }));
    finalFaqItems = faqItems.map((item) => ({
      ...item,
      a: firstSentence(item.a),
    }));
    finalStepItems = stepItems.map((item, index) =>
      index < 2 ? item : { ...item, text: firstSentence(item.text) },
    );

    const trimmedPieces: TextPiece[] = [
      { text: heroH1, source: 'mixed' },
      { text: heroDescription, source: 'mixed' },
      ...whoNeedsBullets.map((text) => ({ text, source: 'mixed' })),
      ...finalScenarioItems.map((item) => ({ text: item.text, source: 'mixed' })),
      { text: finalStepItems[0].text, source: 'mixed' },
      { text: finalStepItems[1].text, source: 'city' },
      { text: finalStepItems[2].text, source: 'mixed' },
      { text: finalStepItems[3].text, source: 'city' },
      { text: finalStepItems[4].text, source: 'course' },
      ...finalFaqItems.slice(0, 3).map((item) => ({ text: item.a, source: 'city' })),
      ...finalFaqItems.slice(3).map((item) => ({ text: item.a, source: 'course' })),
      ...extraParagraphs.map((text) => ({ text, source: 'mixed' })),
    ];
    composition = buildComposition(trimmedPieces);
  }

  return {
    hero: {
      title: heroTitle,
      h1: heroH1,
      description: heroDescription,
      tags: heroTags,
    },
    modules: {
      whoNeeds: {
        title: localeCopy.whoNeedsTitle(cityName),
        bullets: whoNeedsBullets,
      },
      scenarios: {
        title: localeCopy.scenariosTitle,
        items: finalScenarioItems,
      },
      process: {
        title: localeCopy.processTitle(cityName),
        steps: finalStepItems,
        notes: extraParagraphs,
      },
      faq: {
        title: localeCopy.faqTitle,
        faqs: finalFaqItems,
      },
      related: {
        title: isCoursePage ? localeCopy.relatedCourseTitle : localeCopy.relatedCityTitle,
        links: relatedLinks,
      },
    },
    meta: {
      title: fallbackHeroTitle,
      description: heroDescription,
    },
    composition,
  };
};

export const useSeoContent = (
  cityInput: CityContent | null | undefined,
  courseInput?: CourseContent | null,
) => {
  const { locale } = useI18n();
  return computed(() => buildSeoContent(unref(cityInput), unref(courseInput), locale.value));
};

export const getCityContentBySlug = (slug: string) =>
  sortedCities.find((item) => item.slug === slug);
export const getCourseContentBySlug = (slug: string) =>
  sortedCourses.find((item) => item.slug === slug);
