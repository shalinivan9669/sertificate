export const LEGACY_COURSE_TO_PROGRAM_ID = {
  'promyshlennaya-bezopasnost': 'industrial-safety',
  'ohrana-truda': 'labor-safety',
  ptm: 'fire-safety',
  'ekologicheskaya-bezopasnost': 'industrial-safety',
  'gazoopasnye-raboty': 'industrial-safety',
  'raboty-na-vysote': 'labor-safety',
  'gpm-stropalschiki': 'industrial-safety',
  'pervaya-pomoshch': 'labor-safety',
};

export const PROGRAM_SELECTION_STEPS = {
  directions: [
    {
      id: 'prombez',
      title: 'Промбез',
      subtitle: 'Промышленная безопасность',
      description: 'Для опасных производственных объектов, технических специалистов и руководителей работ.',
      estimatedPrograms: '18-26',
      docs: ['приказ о назначении', 'удостоверение', 'проект/объект'],
      restrictions: 'Часто нужен отраслевой профиль и подтверждение допуска.',
      fit: 'ИТР, ответственные лица, техруководители',
    },
    {
      id: 'biot',
      title: 'БиОТ',
      subtitle: 'Безопасность и охрана труда',
      description: 'Для рабочих мест, производственных площадок и линейных руководителей.',
      estimatedPrograms: '14-20',
      docs: ['приказ', 'штатная должность', 'журнал инструктажа'],
      restrictions: 'Нужно учитывать специфику работ и формат обучения.',
      fit: 'Рабочие, мастера, специалисты по ОТ',
    },
    {
      id: 'ptm',
      title: 'ПТМ',
      subtitle: 'Пожарно-технический минимум',
      description: 'Для тех, кто отвечает за пожарную безопасность, эвакуацию и порядок действий при ЧС.',
      estimatedPrograms: '10-16',
      docs: ['назначение ответственного', 'журнал инструктажа', 'план эвакуации'],
      restrictions: 'Нужно сверять обязанности с объектом и сменностью.',
      fit: 'Руководители, ответственные специалисты',
    },
    {
      id: 'qualification',
      title: 'Повышение квалификации',
      subtitle: 'Обновление компетенций',
      description: 'Для специалистов, которым важно актуализировать допуск или расширить профиль.',
      estimatedPrograms: '12-18',
      docs: ['должностная инструкция', 'предыдущий протокол', 'удостоверение'],
      restrictions: 'Обычно зависит от базовой квалификации и предыдущего опыта.',
      fit: 'ИТР, руководители, профильные специалисты',
    },
  ],
  industries: [
    {
      id: 'oil',
      title: 'Нефть',
      description: 'Промыслы, добыча, технологические установки и промплощадки.',
      example: 'ОПО, резервуарные парки, НПЗ',
      estimatedPrograms: '8-12',
      hazards: ['взрывные работы', 'газоопасные зоны', 'сосуды под давлением'],
    },
    {
      id: 'gas',
      title: 'Газ',
      description: 'Транспорт, распределение, компрессорные и газоопасные работы.',
      example: 'ГРП, магистрали, газораспределение',
      estimatedPrograms: '6-10',
      hazards: ['газоопасные работы', 'изоляция', 'контроль среды'],
    },
    {
      id: 'electricity',
      title: 'Электро',
      description: 'Электроустановки, сети, обслуживание и оперативное управление.',
      example: 'Электроцех, подстанции, сети',
      estimatedPrograms: '7-11',
      hazards: ['электроустановки', 'группы допуска', 'наряд-допуск'],
    },
    {
      id: 'heat',
      title: 'Тепло',
      description: 'Котельные, тепловые пункты, трубопроводы и теплоэнергетика.',
      example: 'ТЭЦ, теплосети, котельные',
      estimatedPrograms: '5-8',
      hazards: ['сосуды под давлением', 'температурные риски', 'обходы'],
    },
    {
      id: 'mining',
      title: 'Шахты',
      description: 'Подземные и открытые работы, крепление, вентиляция и безопасность.',
      example: 'Уголь, руда, карьеры',
      estimatedPrograms: '8-14',
      hazards: ['шахты', 'взрывные работы', 'подъёмные сооружения'],
    },
    {
      id: 'construction',
      title: 'Строительство',
      description: 'Площадки, генподряд, высотные работы и общеплощадочная безопасность.',
      example: 'Стройплощадки, монтаж, внешка',
      estimatedPrograms: '9-13',
      hazards: ['наружные объекты', 'работы на высоте', 'грузоподъёмные механизмы'],
    },
  ],
  audiences: [
    {
      id: 'itr',
      title: 'ИТР',
      description: 'Инженеры, техруководители, мастера и специалисты по безопасности.',
      responsibilities: ['допуск к работам', 'контроль документов', 'маршрутизация обучения'],
      estimatedPrograms: '10-16',
    },
    {
      id: 'worker',
      title: 'Рабочий',
      description: 'Производственный персонал, подрядчики, линейные исполнители.',
      responsibilities: ['первичный инструктаж', 'контроль навыков', 'работа по наряду'],
      estimatedPrograms: '8-12',
    },
    {
      id: 'manager',
      title: 'Руководитель',
      description: 'Руководители подразделений, цехов и участков.',
      responsibilities: ['ответственность за людей', 'планирование', 'подтверждение допуска'],
      estimatedPrograms: '7-10',
    },
    {
      id: 'responsible',
      title: 'Ответственный специалист',
      description: 'Специалисты, закреплённые приказом за конкретный участок риска.',
      responsibilities: ['журналы', 'сроки', 'протоколы и реестр'],
      estimatedPrograms: '9-14',
    },
  ],
  profiles: [
    {
      id: 'vzrivnye-raboty',
      title: 'Взрывные работы',
      description: 'Добыча, демонтаж, буровзрывные процессы и сопутствующие допуски.',
      documents: ['наряд-допуск', 'журнал инструктажа', 'проверка знаний'],
    },
    {
      id: 'podemnye-sooruzheniya',
      title: 'Подъёмные сооружения',
      description: 'Краны, строповка, такелаж, подъёмные механизмы и грузовые зоны.',
      documents: ['схема строповки', 'протокол проверки', 'журнал осмотра'],
    },
    {
      id: 'sosudy-pod-davleniem',
      title: 'Сосуды под давлением',
      description: 'Котлы, резервуары, трубопроводы, давление и техконтроль.',
      documents: ['паспорт оборудования', 'акты осмотра', 'протокол знаний'],
    },
    {
      id: 'elektroustanovki',
      title: 'Электроустановки',
      description: 'Группы допуска, оперативные переключения и техническое обслуживание.',
      documents: ['группа допуска', 'наряд-допуск', 'журнал инструктажа'],
    },
    {
      id: 'shahty',
      title: 'Шахты',
      description: 'Подземные риски, вентиляция, крепление и аварийная готовность.',
      documents: ['план ликвидации аварий', 'протокол знаний', 'журнал смен'],
    },
    {
      id: 'naruzhnye-obekty',
      title: 'Наружные объекты',
      description: 'Открытые площадки, высота, погода и логистика допуска.',
      documents: ['акт допуска', 'инструктаж', 'план работ'],
    },
  ],
};

export const TEST_BANK = [
  {
    id: 'q1',
    question: 'Какой документ фиксирует первичный допуск работника к опасным работам?',
    options: ['Устное согласование', 'Наряд-допуск', 'Памятка по смене', 'Служебная записка'],
    answerIndex: 1,
    explanation: 'Для опасных работ нужен формализованный допуск и фиксация ответственных.',
  },
  {
    id: 'q2',
    question: 'Что нужно сделать перед началом работ в закрытом объёме?',
    options: ['Открыть все двери', 'Оценить атмосферу и обеспечить контроль среды', 'Сразу включить оборудование', 'Остановить журналирование'],
    answerIndex: 1,
    explanation: 'Для замкнутых пространств критичны контроль среды и понятный порядок допуска.',
  },
  {
    id: 'q3',
    question: 'Кто должен подтверждать обучение и ознакомление с материалами?',
    options: ['Только HR', 'Сам сотрудник и ответственное лицо', 'Только подрядчик', 'Поставщик оборудования'],
    answerIndex: 1,
    explanation: 'Моковый flow фиксирует двустороннее подтверждение ознакомления.',
  },
  {
    id: 'q4',
    question: 'Какой шаг снижает риск ошибок перед экзаменом?',
    options: ['Пропустить инструкции', 'Проверить модули и пройти подтверждение', 'Сразу перейти к оплате', 'Отключить историю'],
    answerIndex: 1,
    explanation: 'Сначала обучение и подтверждение, потом тест.',
  },
  {
    id: 'q5',
    question: 'Что обычно входит в обязательный пакет документов?',
    options: ['Наряд-допуск, протокол, журнал инструктажа', 'Только паспорт', 'Письмо от коллеги', 'Скриншот оплаты'],
    answerIndex: 0,
    explanation: 'Обязательный пакет для допуска и проверки знаний обычно включает формальные записи.',
  },
  {
    id: 'q6',
    question: 'Как лучше действовать при смене отрасли или объекта?',
    options: ['Оставить старые настройки', 'Подобрать новую связку отрасль + профиль риска', 'Отключить тест', 'Удалить кабинет'],
    answerIndex: 1,
    explanation: 'Сценарий подбирается заново, потому что отрасль и опасности меняют требования.',
  },
  {
    id: 'q7',
    question: 'Что показывает review-экран перед стартом обучения?',
    options: ['Только цену', 'Выбор, количество программ, документы и следующий шаг', 'Только логотип', 'Только отзывы'],
    answerIndex: 1,
    explanation: 'Review должен объяснять, что уже выбрано и что пользователь получит дальше.',
  },
  {
    id: 'q8',
    question: 'Какой вариант подходит для ИТР и ответственных специалистов?',
    options: ['Вариант без подтверждения', 'Программы с управленческим и нормативным контекстом', 'Только рабочие инструкции', 'Только визуальные инструкции'],
    answerIndex: 1,
    explanation: 'ИТР нужен более широкий контекст, чем только рабочие инструкции.',
  },
  {
    id: 'q9',
    question: 'Что делает mock payment в новом flow?',
    options: ['Ничего не меняет', 'Переводит в success или pending без эквайринга', 'Останавливает процесс', 'Удаляет сертификат'],
    answerIndex: 1,
    explanation: 'Платеж моковый и должен завершать сценарий без реального банка.',
  },
  {
    id: 'q10',
    question: 'Что нужно, чтобы кабинет был полезным?',
    options: ['Пустая таблица', 'Статус, история, прогресс и документ', 'Только banner', 'Только кнопка выхода'],
    answerIndex: 1,
    explanation: 'Overview должен показывать прогресс, историю и текущий документ.',
  },
];

export const PAYMENT_METHODS = [
  {
    id: 'card',
    title: 'Банковская карта',
    description: 'Мгновенный mock-success для демонстрации полного happy path.',
    routeStatus: 'success',
  },
  {
    id: 'bank-transfer',
    title: 'Банковский перевод',
    description: 'Mock pending для сценариев с отсроченной обработкой.',
    routeStatus: 'pending',
  },
  {
    id: 'invoice',
    title: 'Счёт для компании',
    description: 'Pending статус с фиксацией в кабинете и истории.',
    routeStatus: 'pending',
  },
];

const PROGRAM_FIXTURES = {
  'industrial-safety': {
    title: 'Промышленная безопасность',
    subtitle: 'ОПО, опасные работы, допуск и контроль рисков',
    direction: 'prombez',
    industry: 'oil',
    audience: 'itr',
    specialization: 'vzrivnye-raboty',
    estimatedPrograms: 24,
    durationHours: 40,
    price: '125 000 ₸',
    docs: ['приказ о назначении', 'удостоверение', 'журнал инструктажа', 'наряд-допуск'],
    limitations: ['Для объектов с повышенным риском нужен действующий профиль допуска.'],
    nextStep: 'Подтверждение материалов и экзамен',
    progress: 62,
  },
  'labor-safety': {
    title: 'Охрана труда',
    subtitle: 'Рабочие места, инструктажи и планирование допусков',
    direction: 'biot',
    industry: 'construction',
    audience: 'worker',
    specialization: 'naruzhnye-obekty',
    estimatedPrograms: 19,
    durationHours: 72,
    price: '85 000 ₸',
    docs: ['приказ', 'журнал инструктажа', 'протокол проверки знаний', 'должностная инструкция'],
    limitations: ['Нужен учёт сменности и фактических условий площадки.'],
    nextStep: 'Сверка модулей и тест',
    progress: 48,
  },
  'fire-safety': {
    title: 'Пожарно-технический минимум',
    subtitle: 'Ответственные лица, эвакуация и ЧС',
    direction: 'ptm',
    industry: 'heat',
    audience: 'manager',
    specialization: 'shahty',
    estimatedPrograms: 15,
    durationHours: 24,
    price: '55 000 ₸',
    docs: ['назначение ответственного', 'журнал инструктажа', 'план эвакуации', 'протокол знаний'],
    limitations: ['Для руководителей и ответственных специалистов требования обычно строже.'],
    nextStep: 'Проверка ознакомления и оплата',
    progress: 85,
  },
};

const createLearningModules = (program) => [
  {
    id: 'module-1',
    title: `${program.title}: нормативная база`,
    duration: '35 мин',
    shortDescription: 'Что регулирует допуск, кто отвечает и какие документы нужно держать актуальными.',
    body: `Модуль 1 для направления ${program.title}. Здесь показываем, как читается нормативная база, какие роли участвуют в допуске и почему важно фиксировать каждый шаг в журнале.`,
    completed: true,
  },
  {
    id: 'module-2',
    title: 'Риски, ограничения и контроль среды',
    duration: '42 мин',
    shortDescription: 'Сценарии риска, опасные зоны и практический контроль условий до начала работ.',
    body: `Модуль 2 помогает отработать типовые риски для профиля ${program.subtitle}. Пользователь видит ограничения, примеры опасных зон и чеклист перед стартом работ.`,
    completed: false,
  },
  {
    id: 'module-3',
    title: 'Документы, журналирование и финальная готовность',
    duration: '28 мин',
    shortDescription: 'Что нужно подтвердить перед тестом и как не потерять след в документах.',
    body: `Модуль 3 закрывает обязательные документы: ${program.docs.join(', ')}. После завершения модулей пользователь готов к подтверждению ознакомления и переходу к тесту.`,
    completed: false,
  },
];

const createCertificate = (programId, program) => ({
  number: `KZ-${programId.toUpperCase().slice(0, 2)}-2026-01842`,
  status: 'draft',
  issuedAt: '2026-04-07',
  validUntil: '2029-04-07',
  course: program.title,
  history: [
    { date: '2026-04-05', title: 'Выбран новый flow', detail: 'Пользователь перешёл из SEO-страницы в мастер подбора.' },
    { date: '2026-04-06', title: 'Обучение завершено', detail: 'Все модули отмечены как завершённые.' },
    { date: '2026-04-07', title: 'Тест пройден', detail: 'Сформирован mock certificate и доступна оплата.' },
  ],
});

export const getProgramFixture = (courseId) => {
  const normalizedId = PROGRAM_FIXTURES[courseId] ? courseId : 'industrial-safety';
  const program = PROGRAM_FIXTURES[normalizedId];

  return {
    courseId: normalizedId,
    ...program,
    modules: createLearningModules(program),
    test: {
      passScore: 80,
      totalQuestions: TEST_BANK.length,
      questions: TEST_BANK,
    },
    payment: {
      amount: program.price,
      methods: PAYMENT_METHODS,
    },
    certificate: createCertificate(normalizedId, program),
  };
};

export const getSelectionPresetFromCourse = (legacySlug, citySlug = '') => {
  const courseId = LEGACY_COURSE_TO_PROGRAM_ID[legacySlug] || 'industrial-safety';
  const program = getProgramFixture(courseId);

  return {
    courseId,
    direction: program.direction,
    industry: program.industry,
    audience: program.audience,
    specialization: program.specialization,
    source: 'seo-course',
    slug: legacySlug,
    city: citySlug,
  };
};

export const getSelectionPresetFromQuery = (query = {}) => {
  const direction = typeof query.direction === 'string' ? query.direction : '';
  const slug = typeof query.slug === 'string' ? query.slug : '';
  const source = typeof query.source === 'string' ? query.source : '';
  const city = typeof query.city === 'string' ? query.city : '';
  const industry = typeof query.industry === 'string' ? query.industry : '';
  const audience = typeof query.audience === 'string' ? query.audience : '';
  const specialization = typeof query.specialization === 'string' ? query.specialization : '';
  const courseIdFromQuery = typeof query.courseId === 'string' ? query.courseId : '';

  const directionMatch = Object.entries(PROGRAM_FIXTURES).find(([, item]) => item.direction === direction);
  const courseId =
    PROGRAM_FIXTURES[courseIdFromQuery]
      ? courseIdFromQuery
      : LEGACY_COURSE_TO_PROGRAM_ID[slug] ||
        directionMatch?.[0] ||
        'industrial-safety';

  const program = getProgramFixture(courseId);

  return {
    courseId,
    direction: direction || program.direction,
    industry: industry || program.industry,
    audience: audience || program.audience,
    specialization: specialization || program.specialization,
    source: source || 'direct',
    slug: slug || courseId,
    city,
  };
};

export const buildProgramSelectionQuery = (selection = {}) => ({
  courseId: selection.courseId,
  direction: selection.direction,
  industry: selection.industry,
  audience: selection.audience,
  specialization: selection.specialization,
  source: selection.source || 'direct',
  slug: selection.slug || selection.courseId,
  city: selection.city || '',
});

export const estimatePrograms = (selection = {}) => {
  const direction = PROGRAM_SELECTION_STEPS.directions.find((item) => item.id === selection.direction);
  const industry = PROGRAM_SELECTION_STEPS.industries.find((item) => item.id === selection.industry);
  const audience = PROGRAM_SELECTION_STEPS.audiences.find((item) => item.id === selection.audience);
  const profile = PROGRAM_SELECTION_STEPS.profiles.find((item) => item.id === selection.specialization);

  const counts = [
    direction?.estimatedPrograms,
    industry?.estimatedPrograms,
    audience?.estimatedPrograms,
  ]
    .filter(Boolean)
    .map((value) => {
      const [start, end] = value.split('-').map((part) => Number.parseInt(part, 10));
      return Number.isFinite(end) ? Math.round((start + end) / 2) : start;
    });

  const base = counts.length ? Math.round(counts.reduce((sum, item) => sum + item, 0) / counts.length) : 12;
  const profileBonus = profile ? 2 : 0;

  return `${Math.max(4, base - profileBonus)}-${base + profileBonus + 4}`;
};

export const getSelectionReview = (selection = {}) => {
  const program = getProgramFixture(selection.courseId || 'industrial-safety');
  const direction = PROGRAM_SELECTION_STEPS.directions.find((item) => item.id === selection.direction) || PROGRAM_SELECTION_STEPS.directions[0];
  const industry = PROGRAM_SELECTION_STEPS.industries.find((item) => item.id === selection.industry) || PROGRAM_SELECTION_STEPS.industries[0];
  const audience = PROGRAM_SELECTION_STEPS.audiences.find((item) => item.id === selection.audience) || PROGRAM_SELECTION_STEPS.audiences[0];
  const profile = PROGRAM_SELECTION_STEPS.profiles.find((item) => item.id === selection.specialization) || PROGRAM_SELECTION_STEPS.profiles[0];

  return {
    courseId: program.courseId,
    title: program.title,
    subtitle: program.subtitle,
    estimatedPrograms: estimatePrograms(selection),
    docs: [...new Set([...(direction.docs || []), ...(industry.hazards || []), ...(profile.documents || []), ...program.docs])].slice(0, 6),
    limitations: [
      direction.restrictions,
      `Отрасль: ${industry.example}`,
      `Аудитория: ${audience.description}`,
      profile.description,
    ],
    nextStep: program.nextStep,
    progress: program.progress,
  };
};
