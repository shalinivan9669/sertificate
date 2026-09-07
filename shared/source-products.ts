/** Source-backed service inventory. Never an approved ProgramVersion or checkout price.
 * Numeric quoted rates stay under ignored .data and are deliberately absent from this public repository file.
 * Source PDF was read in full; its full text, bank details and stamp are not published.
 */
export const sourceProductDocument = {
  "id": "kbpk-service-rates-2026-08-14",
  "title": "Расчет курса по продуктам",
  "sourceFilename": "КБПК все обучения 306 нов.pdf",
  "sha256": "db7ddb11a0e0df16cd433bec9d33894c1c5426d44e0f5977b8597e9dc3a80e8f",
  "pages": 2,
  "metadataCreatedAt": "2026-08-14T09:56:59+05:00",
  "language": "ru",
  "scope": "service_rate_inventory",
  "publicDownloadUrl": null
} as const;

export const sourceProducts = [
  {
    "id": "kbpk-01",
    "slug": "antiterroristicheskaya-podgotovka",
    "legacyDirectionId": null,
    "title": {
      "ru": "Антитеррористическая подготовка",
      "kk": "Терроризмге қарсы даярлық"
    },
    "sourceDocumentId": "kbpk-service-rates-2026-08-14",
    "sourcePage": 1,
    "sourceRow": 1,
    "sourceNameRaw": "Учебные мероприятия по\nобеспечению\nантитеррористической",
    "sourceDescriptionRaw": "Проведение обучения\nс выдачей сертификата\nи раздаточного",
    "sourceNoteRaw": "Обучение проводится\nпо установленной\nЦентром форме",
    "standardAsWritten": null,
    "pricingBasis": "organization",
    "vat": "excluded_from_source_rate",
    "priceClassification": "unspecified_source_rate",
    "publicPrice": null,
    "availability": "consultation",
    "academicContentStatus": "not_provided",
    "clarifications": [
      "incomplete_source_title"
    ]
  },
  {
    "id": "kbpk-02",
    "slug": "pervaya-pomoshch",
    "legacyDirectionId": "pervaya-pomoshch",
    "title": {
      "ru": "Первая медицинская помощь",
      "kk": "Алғашқы медициналық көмек"
    },
    "sourceDocumentId": "kbpk-service-rates-2026-08-14",
    "sourcePage": 1,
    "sourceRow": 2,
    "sourceNameRaw": "Обучение :\nПервая медицинская помощь",
    "sourceDescriptionRaw": "Проведение обучения\nс выдачей сертификата\nи раздаточного",
    "sourceNoteRaw": "Обучение проводится\nпо установленной\nЦентром форме",
    "standardAsWritten": null,
    "pricingBasis": "learner",
    "vat": "excluded_from_source_rate",
    "priceClassification": "unspecified_source_rate",
    "publicPrice": null,
    "availability": "consultation",
    "academicContentStatus": "not_provided",
    "clarifications": []
  },
  {
    "id": "kbpk-03",
    "slug": "soglasitelnaya-komissiya",
    "legacyDirectionId": null,
    "title": {
      "ru": "Согласительная комиссия и трудовое законодательство РК",
      "kk": "Келісу комиссиясы және ҚР еңбек заңнамасы"
    },
    "sourceDocumentId": "kbpk-service-rates-2026-08-14",
    "sourcePage": 1,
    "sourceRow": 3,
    "sourceNameRaw": "«Согласительная Комиссия»\nОбучение применению трудового\nзаконодательства РК",
    "sourceDescriptionRaw": "Проведение обучения\nс выдачей\nсертификата(именные)",
    "sourceNoteRaw": "Обучение проводится по\nустановленной Центром\nформе",
    "standardAsWritten": null,
    "pricingBasis": "organization",
    "vat": "excluded_from_source_rate",
    "priceClassification": "unspecified_source_rate",
    "publicPrice": null,
    "availability": "consultation",
    "academicContentStatus": "not_provided",
    "clarifications": []
  },
  {
    "id": "kbpk-04",
    "slug": "protivodeystvie-korruptsii",
    "legacyDirectionId": null,
    "title": {
      "ru": "Противодействие коррупции (комплаенс)",
      "kk": "Сыбайлас жемқорлыққа қарсы іс-қимыл (комплаенс)"
    },
    "sourceDocumentId": "kbpk-service-rates-2026-08-14",
    "sourcePage": 1,
    "sourceRow": 4,
    "sourceNameRaw": "Обучение по противодействию\nкоррупции (комплаенс)",
    "sourceDescriptionRaw": "Проведение обучения с\nвыдачей сертификата на\nорганизацию",
    "sourceNoteRaw": "Обучение проводится\nпо установленной\nЦентром форме",
    "standardAsWritten": null,
    "pricingBasis": "organization",
    "vat": "excluded_from_source_rate",
    "priceClassification": "unspecified_source_rate",
    "publicPrice": null,
    "availability": "consultation",
    "academicContentStatus": "not_provided",
    "clarifications": []
  },
  {
    "id": "kbpk-05",
    "slug": "seminar-dekretirovannoy-gruppy-sez",
    "legacyDirectionId": null,
    "title": {
      "ru": "Семинар для декретированной группы населения (СЭЗ)",
      "kk": "Халықтың декреттелген тобына арналған семинар (СЭЗ)"
    },
    "sourceDocumentId": "kbpk-service-rates-2026-08-14",
    "sourcePage": 1,
    "sourceRow": 5,
    "sourceNameRaw": "Семинар для декретированной\nгруппы населения (СЭЗ)",
    "sourceDescriptionRaw": "Проведение Семинара с\nвыдачей сертификата\nи штампов",
    "sourceNoteRaw": "Обучение проводится\nпо установленной\nЦентром форме",
    "standardAsWritten": null,
    "pricingBasis": "organization",
    "vat": "excluded_from_source_rate",
    "priceClassification": "unspecified_source_rate",
    "publicPrice": null,
    "availability": "consultation",
    "academicContentStatus": "not_provided",
    "clarifications": []
  },
  {
    "id": "kbpk-06",
    "slug": "ptm",
    "legacyDirectionId": "ptm",
    "title": {
      "ru": "Пожарно-технический минимум (ПТМ)",
      "kk": "Өрт-техникалық минимум (ӨТМ)"
    },
    "sourceDocumentId": "kbpk-service-rates-2026-08-14",
    "sourcePage": 1,
    "sourceRow": 6,
    "sourceNameRaw": "Обучение:\nПожарно-технический минимум\n(ПТМ)",
    "sourceDescriptionRaw": "Проведение обучения с\nвыдачей удостоверения\nи раздаточного\nматериала",
    "sourceNoteRaw": "Обучение проводится по\nустановленной Центром\nформе",
    "standardAsWritten": null,
    "pricingBasis": "learner",
    "vat": "excluded_from_source_rate",
    "priceClassification": "unspecified_source_rate",
    "publicPrice": null,
    "availability": "consultation",
    "academicContentStatus": "not_provided",
    "clarifications": []
  },
  {
    "id": "kbpk-07",
    "slug": "ohrana-truda",
    "legacyDirectionId": "ohrana-truda",
    "title": {
      "ru": "Безопасность и охрана труда (БиОТ)",
      "kk": "Еңбек қауіпсіздігі және еңбекті қорғау"
    },
    "sourceDocumentId": "kbpk-service-rates-2026-08-14",
    "sourcePage": 1,
    "sourceRow": 7,
    "sourceNameRaw": "Обучение: Безопасность и\nохрана труда (БиОТ)",
    "sourceDescriptionRaw": "Проведение обучения с\nвыдачей сертификата и\nраздаточного\nматериала",
    "sourceNoteRaw": "Обучение проводится по\nустановленной Центром\nформе",
    "standardAsWritten": null,
    "pricingBasis": "learner",
    "vat": "excluded_from_source_rate",
    "priceClassification": "unspecified_source_rate",
    "publicPrice": null,
    "availability": "consultation",
    "academicContentStatus": "not_provided",
    "clarifications": []
  },
  {
    "id": "kbpk-08",
    "slug": "elektrobezopasnost",
    "legacyDirectionId": "elektrobezopasnost",
    "title": {
      "ru": "Электробезопасность",
      "kk": "Электр қауіпсіздігі"
    },
    "sourceDocumentId": "kbpk-service-rates-2026-08-14",
    "sourcePage": 1,
    "sourceRow": 8,
    "sourceNameRaw": "Обучение по\nЭлектробезопасности",
    "sourceDescriptionRaw": "Проведение обучения с\nвыдачей удостоверения\nи раздаточного\nматериала",
    "sourceNoteRaw": "Обучение проводится по\nустановленной Центром\nформе",
    "standardAsWritten": null,
    "pricingBasis": "learner",
    "vat": "excluded_from_source_rate",
    "priceClassification": "unspecified_source_rate",
    "publicPrice": null,
    "availability": "consultation",
    "academicContentStatus": "not_provided",
    "clarifications": []
  },
  {
    "id": "kbpk-09",
    "slug": "promyshlennaya-bezopasnost",
    "legacyDirectionId": "promyshlennaya-bezopasnost",
    "title": {
      "ru": "Промышленная безопасность",
      "kk": "Өнеркәсіптік қауіпсіздік"
    },
    "sourceDocumentId": "kbpk-service-rates-2026-08-14",
    "sourcePage": 1,
    "sourceRow": 9,
    "sourceNameRaw": "Обучение по Промышленной\nбезопасности",
    "sourceDescriptionRaw": "Проведение обучения с\nвыдачей удостоверения\nи раздаточного\nматериала",
    "sourceNoteRaw": "Обучение проводится по\nустановленной Центром\nформе",
    "standardAsWritten": null,
    "pricingBasis": "learner",
    "vat": "excluded_from_source_rate",
    "priceClassification": "unspecified_source_rate",
    "publicPrice": null,
    "availability": "consultation",
    "academicContentStatus": "not_provided",
    "clarifications": []
  },
  {
    "id": "kbpk-10",
    "slug": "rassledovanie-proisshestviy",
    "legacyDirectionId": null,
    "title": {
      "ru": "Расследование происшествий на предприятии",
      "kk": "Кәсіпорындағы оқиғаларды тергеп-тексеру"
    },
    "sourceDocumentId": "kbpk-service-rates-2026-08-14",
    "sourcePage": 1,
    "sourceRow": 10,
    "sourceNameRaw": "Обучение по «Расследование\nпроисшествий на предприятий»",
    "sourceDescriptionRaw": "Проведение обучения с\nвыдачей сертификата и\nраздаточного материала",
    "sourceNoteRaw": "Обучение проводится по\nустановленной Центром\nформе",
    "standardAsWritten": null,
    "pricingBasis": "learner",
    "vat": "excluded_from_source_rate",
    "priceClassification": "unspecified_source_rate",
    "publicPrice": null,
    "availability": "consultation",
    "academicContentStatus": "not_provided",
    "clarifications": []
  },
  {
    "id": "kbpk-11",
    "slug": "povedencheskiy-audit-bezopasnosti",
    "legacyDirectionId": null,
    "title": {
      "ru": "Поведенческий аудит безопасности (ПАБ)",
      "kk": "Қауіпсіздіктің мінез-құлық аудиті"
    },
    "sourceDocumentId": "kbpk-service-rates-2026-08-14",
    "sourcePage": 1,
    "sourceRow": 11,
    "sourceNameRaw": "Обучение по «Поведенческий\nаудит безопасности» (ПАБ)»",
    "sourceDescriptionRaw": "Проведение обучения с\nвыдачей сертификата и\nраздаточного материала",
    "sourceNoteRaw": "Обучение проводится по\nустановленной Центром\nформе",
    "standardAsWritten": null,
    "pricingBasis": "learner",
    "vat": "excluded_from_source_rate",
    "priceClassification": "unspecified_source_rate",
    "publicPrice": null,
    "availability": "consultation",
    "academicContentStatus": "not_provided",
    "clarifications": []
  },
  {
    "id": "kbpk-12",
    "slug": "upravlenie-stressom",
    "legacyDirectionId": null,
    "title": {
      "ru": "Управление стрессом и здоровая рабочая атмосфера",
      "kk": "Стресті басқару және салауатты жұмыс ортасы"
    },
    "sourceDocumentId": "kbpk-service-rates-2026-08-14",
    "sourcePage": 2,
    "sourceRow": 1,
    "sourceNameRaw": "Обучение по «Управление\nстрессом и создание здоровой\nрабочей атмосферы",
    "sourceDescriptionRaw": "Проведение обучения с\nвыдачей сертификата и\nраздаточного\nматериала",
    "sourceNoteRaw": "Обучение проводится по\nустановленной Центром\nформе",
    "standardAsWritten": null,
    "pricingBasis": "learner",
    "vat": "excluded_from_source_rate",
    "priceClassification": "unspecified_source_rate",
    "publicPrice": null,
    "availability": "consultation",
    "academicContentStatus": "not_provided",
    "clarifications": []
  },
  {
    "id": "kbpk-13",
    "slug": "kultura-bezopasnosti",
    "legacyDirectionId": null,
    "title": {
      "ru": "Культура безопасности на производственном предприятии",
      "kk": "Өндірістік кәсіпорындағы қауіпсіздік мәдениеті"
    },
    "sourceDocumentId": "kbpk-service-rates-2026-08-14",
    "sourcePage": 2,
    "sourceRow": 2,
    "sourceNameRaw": "Обучение по\n«Культура безопасности на\nпроизводственном предприятии",
    "sourceDescriptionRaw": "Проведение обучения с\nвыдачей сертификата и\nраздаточного\nматериала",
    "sourceNoteRaw": "Обучение проводится по\nустановленной Центром\nформе",
    "standardAsWritten": null,
    "pricingBasis": "learner",
    "vat": "excluded_from_source_rate",
    "priceClassification": "unspecified_source_rate",
    "publicPrice": null,
    "availability": "consultation",
    "academicContentStatus": "not_provided",
    "clarifications": []
  },
  {
    "id": "kbpk-14",
    "slug": "iso-9001",
    "legacyDirectionId": null,
    "title": {
      "ru": "ISO 9001: система менеджмента качества",
      "kk": "ISO 9001: сапа менеджменті жүйесі"
    },
    "sourceDocumentId": "kbpk-service-rates-2026-08-14",
    "sourcePage": 2,
    "sourceRow": 3,
    "sourceNameRaw": "Обучение по ISO 9001 —\nСертификат системы\nменеджмента качества",
    "sourceDescriptionRaw": "Проведение обучения\nс выдачей сертификата\nи раздаточного\nматериала",
    "sourceNoteRaw": "Обучение проводится по\nустановленной Центром\nформе",
    "standardAsWritten": "ISO 9001",
    "pricingBasis": "learner",
    "vat": "excluded_from_source_rate",
    "priceClassification": "unspecified_source_rate",
    "publicPrice": null,
    "availability": "consultation",
    "academicContentStatus": "not_provided",
    "clarifications": []
  },
  {
    "id": "kbpk-15",
    "slug": "iso-14001",
    "legacyDirectionId": null,
    "title": {
      "ru": "ISO 14001: система экологического менеджмента",
      "kk": "ISO 14001: экологиялық менеджмент жүйесі"
    },
    "sourceDocumentId": "kbpk-service-rates-2026-08-14",
    "sourcePage": 2,
    "sourceRow": 4,
    "sourceNameRaw": "Обучение ISO 14001 –\nСертификаты системы\nэкологического менеджмента",
    "sourceDescriptionRaw": "Проведение обучения\nс выдачей сертификата\nи раздаточного\nматериала",
    "sourceNoteRaw": "Обучение проводится по\nустановленной Центром\nформе",
    "standardAsWritten": "ISO 14001",
    "pricingBasis": "learner",
    "vat": "excluded_from_source_rate",
    "priceClassification": "unspecified_source_rate",
    "publicPrice": null,
    "availability": "consultation",
    "academicContentStatus": "not_provided",
    "clarifications": []
  },
  {
    "id": "kbpk-16",
    "slug": "menedzhment-ohrany-zdorovya",
    "legacyDirectionId": null,
    "title": {
      "ru": "Менеджмент охраны здоровья и безопасности труда",
      "kk": "Денсаулықты қорғау және еңбек қауіпсіздігі менеджменті"
    },
    "sourceDocumentId": "kbpk-service-rates-2026-08-14",
    "sourcePage": 2,
    "sourceRow": 5,
    "sourceNameRaw": "Обучение ISO 14001 –\nСертификаты Системы\nменеджмента охраны здоровья и\nбезопасности труда",
    "sourceDescriptionRaw": "Проведение обучения\nс выдачей сертификата\nи раздаточного\nматериала",
    "sourceNoteRaw": "Обучение проводится по\nустановленной Центром\nформе",
    "standardAsWritten": "ISO 14001",
    "pricingBasis": "learner",
    "vat": "excluded_from_source_rate",
    "priceClassification": "unspecified_source_rate",
    "publicPrice": null,
    "availability": "consultation",
    "academicContentStatus": "not_provided",
    "clarifications": [
      "source_standard_scope_mismatch"
    ]
  }
] as const;

export type SourceProduct = (typeof sourceProducts)[number];

type LocalizedText = { ru: string; kk: string };
type ProductGuidance = { summary: LocalizedText; audience: LocalizedText; topics: { ru: string[]; kk: string[] }; kind: 'marketing_orientation' };
const learnerAudience = { ru: 'Для слушателей, которым требуется подготовка по выбранной теме; состав группы и требования к участию уточняются при подборе.', kk: 'Таңдалған тақырып бойынша даярлық қажет тыңдаушыларға; топ құрамы мен қатысу талаптары таңдау кезінде нақтыланады.' };
const organizationAudience = { ru: 'Для организации, которая планирует обучение своей команды; участников и условия согласуют до начала.', kk: 'Өз командасын оқытуды жоспарлайтын ұйымға; қатысушылар мен шарттар басталғанға дейін келісіледі.' };
const guidance = (summary: LocalizedText, topics: { ru: string[]; kk: string[] }, organization = false): ProductGuidance => ({ summary, topics, audience: organization ? organizationAudience : learnerAudience, kind: 'marketing_orientation' });

/** Editorial orientation derived from service titles, never an approved lesson plan. */
export const sourceProductGuidance: Record<SourceProduct['id'], ProductGuidance> = {
  'kbpk-01': { ...guidance(
    { ru: 'Корпоративная антитеррористическая подготовка. Услуга предусматривает участие всего персонала организации; порядок проведения и состав программы согласуют для команды.', kk: 'Корпоративтік терроризмге қарсы даярлық. Қызмет ұйымның барлық қызметкерінің қатысуын көздейді; өткізу тәртібі мен бағдарлама құрамы команда үшін келісіледі.' },
    { ru: ['Антитеррористическая подготовка', 'Охват персонала организации', 'Условия корпоративного обучения'], kk: ['Терроризмге қарсы даярлық', 'Ұйым қызметкерлерін қамту', 'Корпоративтік оқыту шарттары'] }, true),
    audience: { ru: 'Для всего персонала организации.', kk: 'Ұйымның барлық қызметкеріне арналған.' } },
  'kbpk-02': guidance(
    { ru: 'Подготовка по первой медицинской помощи. При подборе уточняют назначение обучения, формат занятий и документ по его итогам.', kk: 'Алғашқы медициналық көмек бойынша даярлық. Таңдау кезінде оқыту мақсаты, сабақ форматы және қорытынды құжат нақтыланады.' },
    { ru: ['Первая медицинская помощь', 'Цели подготовки слушателя', 'Формат занятий и итоговый документ'], kk: ['Алғашқы медициналық көмек', 'Тыңдаушыны даярлау мақсаттары', 'Сабақ форматы мен қорытынды құжат'] }),
  'kbpk-03': guidance(
    { ru: 'Обучение применению трудового законодательства Республики Казахстан в рамках работы согласительной комиссии. Участников и условия подготовки согласуют с организацией.', kk: 'Келісу комиссиясының жұмысы аясында Қазақстан Республикасының еңбек заңнамасын қолдануды оқыту. Қатысушылар мен даярлық шарттары ұйыммен келісіледі.' },
    { ru: ['Согласительная комиссия', 'Применение трудового законодательства РК', 'Подготовка участников комиссии'], kk: ['Келісу комиссиясы', 'ҚР еңбек заңнамасын қолдану', 'Комиссия қатысушыларын даярлау'] }, true),
  'kbpk-04': guidance(
    { ru: 'Корпоративное обучение по противодействию коррупции и комплаенсу. Подбор помогает согласовать охват команды, формат участия и организационные условия.', kk: 'Сыбайлас жемқорлыққа қарсы іс-қимыл және комплаенс бойынша корпоративтік оқыту. Таңдау команданы қамтуды, қатысу форматын және ұйымдастыру шарттарын келісуге көмектеседі.' },
    { ru: ['Противодействие коррупции', 'Комплаенс в организации', 'Корпоративная подготовка команды'], kk: ['Сыбайлас жемқорлыққа қарсы іс-қимыл', 'Ұйымдағы комплаенс', 'Команданы корпоративтік даярлау'] }, true),
  'kbpk-05': guidance(
    { ru: 'Семинар для декретированной группы населения (СЭЗ). Состав участников, содержание семинара и оформление результатов уточняют для конкретной организации.', kk: 'Халықтың декреттелген тобына арналған семинар (СЭЗ). Қатысушылар құрамы, семинар мазмұны және нәтижелерді рәсімдеу нақты ұйым үшін нақтыланады.' },
    { ru: ['Декретированная группа населения', 'Семинарский формат', 'Организация участия и оформление результатов'], kk: ['Халықтың декреттелген тобы', 'Семинар форматы', 'Қатысуды ұйымдастыру және нәтижелерді рәсімдеу'] }, true),
  'kbpk-06': guidance(
    { ru: 'Подготовка по пожарно-техническому минимуму. Условия участия, объём занятий и предусмотренный документ согласуют с учётом запроса слушателя.', kk: 'Өрт-техникалық минимум бойынша даярлық. Қатысу шарттары, сабақ көлемі және көзделген құжат тыңдаушының сұранысына қарай келісіледі.' },
    { ru: ['Пожарно-технический минимум', 'Задача подготовки слушателя', 'Условия занятий и итоговый документ'], kk: ['Өрт-техникалық минимум', 'Тыңдаушыны даярлау міндеті', 'Сабақ шарттары мен қорытынды құжат'] }),
  'kbpk-07': guidance(
    { ru: 'Обучение по безопасности и охране труда. При подборе согласуют программу, формат участия и оформление результатов обучения.', kk: 'Еңбек қауіпсіздігі және еңбекті қорғау бойынша оқыту. Таңдау кезінде бағдарлама, қатысу форматы және оқыту нәтижелерін рәсімдеу келісіледі.' },
    { ru: ['Безопасность труда', 'Охрана труда', 'Условия подготовки и оформление результатов'], kk: ['Еңбек қауіпсіздігі', 'Еңбекті қорғау', 'Даярлық шарттары және нәтижелерді рәсімдеу'] }),
  'kbpk-08': guidance(
    { ru: 'Подготовка по электробезопасности. Требуемое содержание, условия участия и документ уточняют до согласования обучения.', kk: 'Электр қауіпсіздігі бойынша даярлық. Қажетті мазмұн, қатысу шарттары және құжат оқытуды келісуге дейін нақтыланады.' },
    { ru: ['Электробезопасность', 'Задача и объём подготовки', 'Условия участия и документ'], kk: ['Электр қауіпсіздігі', 'Даярлық міндеті мен көлемі', 'Қатысу шарттары мен құжат'] }),
  'kbpk-09': guidance(
    { ru: 'Обучение по промышленной безопасности. Область подготовки и организационные условия подбирают под запрос слушателя или предприятия.', kk: 'Өнеркәсіптік қауіпсіздік бойынша оқыту. Даярлық саласы мен ұйымдастыру шарттары тыңдаушының немесе кәсіпорынның сұранысына сай таңдалады.' },
    { ru: ['Промышленная безопасность', 'Выбор области подготовки', 'Организационные условия обучения'], kk: ['Өнеркәсіптік қауіпсіздік', 'Даярлық саласын таңдау', 'Оқытуды ұйымдастыру шарттары'] }),
  'kbpk-10': guidance(
    { ru: 'Подготовка по расследованию происшествий на предприятии. Тематика предназначена для разбора задач расследования; содержание и применяемые материалы согласуют до начала.', kk: 'Кәсіпорындағы оқиғаларды тергеп-тексеру бойынша даярлық. Тақырып тергеп-тексеру міндеттерін қарастыруға арналған; мазмұн мен қолданылатын материалдар басталғанға дейін келісіледі.' },
    { ru: ['Расследование происшествий', 'Задачи предприятия при разборе событий', 'Выбор содержания подготовки'], kk: ['Оқиғаларды тергеп-тексеру', 'Оқиғаларды талдау кезіндегі кәсіпорын міндеттері', 'Даярлық мазмұнын таңдау'] }),
  'kbpk-11': guidance(
    { ru: 'Обучение по поведенческому аудиту безопасности (ПАБ). Подбор программы связывает тему аудита с задачами безопасности конкретной организации.', kk: 'Қауіпсіздіктің мінез-құлық аудиті бойынша оқыту. Бағдарламаны таңдау аудит тақырыбын нақты ұйымның қауіпсіздік міндеттерімен байланыстырады.' },
    { ru: ['Поведенческий аудит безопасности', 'Задачи безопасности организации', 'Согласование формата подготовки'], kk: ['Қауіпсіздіктің мінез-құлық аудиті', 'Ұйымның қауіпсіздік міндеттері', 'Даярлық форматын келісу'] }),
  'kbpk-12': guidance(
    { ru: 'Подготовка по управлению стрессом и созданию здоровой рабочей атмосферы. Состав программы и формат участия подбирают под рабочий контекст команды.', kk: 'Стресті басқару және салауатты жұмыс ортасын құру бойынша даярлық. Бағдарлама құрамы мен қатысу форматы команданың жұмыс жағдайына сай таңдалады.' },
    { ru: ['Управление стрессом', 'Здоровая рабочая атмосфера', 'Контекст и задачи команды'], kk: ['Стресті басқару', 'Салауатты жұмыс ортасы', 'Команданың жағдайы мен міндеттері'] }),
  'kbpk-13': guidance(
    { ru: 'Обучение по культуре безопасности на производственном предприятии. До начала согласуют цели подготовки, круг участников и содержание программы.', kk: 'Өндірістік кәсіпорындағы қауіпсіздік мәдениеті бойынша оқыту. Басталғанға дейін даярлық мақсаттары, қатысушылар құрамы және бағдарлама мазмұны келісіледі.' },
    { ru: ['Культура безопасности', 'Производственный контекст', 'Цели подготовки участников'], kk: ['Қауіпсіздік мәдениеті', 'Өндірістік жағдай', 'Қатысушыларды даярлау мақсаттары'] }),
  'kbpk-14': guidance(
    { ru: 'Подготовка по системе менеджмента качества ISO 9001. Условия обучения и документ слушателя уточняют при подборе программы.', kk: 'ISO 9001 сапа менеджменті жүйесі бойынша даярлық. Оқыту шарттары мен тыңдаушы құжаты бағдарламаны таңдау кезінде нақтыланады.' },
    { ru: ['Система менеджмента качества', 'Тематика ISO 9001', 'Подбор условий обучения'], kk: ['Сапа менеджменті жүйесі', 'ISO 9001 тақырыбы', 'Оқыту шарттарын таңдау'] }),
  'kbpk-15': guidance(
    { ru: 'Подготовка по системе экологического менеджмента ISO 14001. Содержание занятий и порядок участия согласуют для выбранной программы.', kk: 'ISO 14001 экологиялық менеджмент жүйесі бойынша даярлық. Сабақ мазмұны мен қатысу тәртібі таңдалған бағдарлама үшін келісіледі.' },
    { ru: ['Экологический менеджмент', 'Тематика ISO 14001', 'Содержание и условия подготовки'], kk: ['Экологиялық менеджмент', 'ISO 14001 тақырыбы', 'Даярлық мазмұны мен шарттары'] }),
  'kbpk-16': guidance(
    { ru: 'Подготовка по системе менеджмента охраны здоровья и безопасности труда. Обозначение стандарта и версия программы требуют уточнения при подборе.', kk: 'Денсаулықты қорғау және еңбек қауіпсіздігі менеджменті жүйесі бойынша даярлық. Стандарт белгіленімі мен бағдарлама нұсқасы таңдау кезінде нақтылануы қажет.' },
    { ru: ['Менеджмент охраны здоровья', 'Менеджмент безопасности труда', 'Уточнение применяемого стандарта и программы'], kk: ['Денсаулықты қорғау менеджменті', 'Еңбек қауіпсіздігі менеджменті', 'Қолданылатын стандарт пен бағдарламаны нақтылау'] }),
};

/** Eleven additional labels extend, and never replace, the nine stable legacy directions. */
export const additionalSourceDirections = sourceProducts
  .filter(product => product.legacyDirectionId === null)
  .map(product => ({ id: product.slug, alias: null, title: product.title, sourceProductId: product.id }));

export function getSourceProductForDirection(value: unknown) {
  if (typeof value !== 'string') return undefined;
  const product = sourceProducts.find(product => product.slug === value || product.legacyDirectionId === value);
  return product ? { ...product, guidance: sourceProductGuidance[product.id] } : undefined;
}
