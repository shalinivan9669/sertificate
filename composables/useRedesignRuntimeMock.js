import { getProgramFixture } from '~/composables/useProgramFlowMock';

const LEARNING_SCHEMATIC_IMAGE =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuCPJeD-HS0KqyD-PhXZQemI1XipkmJsE0f28p3tKbgxA_fIJ_s1IH2nl1IVXytmYE3ikpdBNnHOot0Mo-3VmJVWZpgebUyDdwUMa2kKF0S15KBUToFqqAxCNQbsQKnJCQ9dHuGbenJIBh2NMVwxX7fdecOAIW5woTCLSBVc3tlQ6ME4pp7AM8_uahwwyY0FXD2VAfHUpBvNRonVCyxEzXrF4u58xf-tIGAd1QKXS-kjVP4O2w2e7uouv-R0mB5mUaOm3R6nCnKuDAYz';
const PRETEST_IMAGE =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuAXFbnrbqfa_e5s6hHoBSOjxIChwQVGVzhU4pZH8PKFAUFUUJM8RjwHBquvTfJpSQJML12SN1-Ofr9QCeBk8x49iOJISl32afLDwj8B3TxSZ3jjrM69cm_axwEoXAyXJbbnU4x47JLYUA_t0MRCsoOGJZCSzOnlvXupNyTWdCrOTlsS87ZClZePnL8yft6aafWHuEm4IQBT3cciimuQlTXRovMH-Pfh9BPq6r5s1WJuNKl4jd3wI_4FTWc_FyWOohg0633-bVJBah_p';
const EXAM_BLUEPRINT_IMAGE =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuB4QzeO-g4NZocvHKCJToLiO0WP0BXEF_6rOJitsKVLh76OyaEv7nNBiFUUg6pbI1rIt-Isn_z5GOVY0NEIXmFcXLZpa2LiaETPju-15Imjk3xWDnTQdqO3o8j_zJ2hxSstgHc1Qj8ZcclOCqL4c6j7u1hTOhBsh6uQw0RTz_nDtuxoGAqpwxEv9vJoz2xk8JHIgATwu_UoynQEyvMKrfE07jIVofpPYFpvTrKjk5-oNhoT8r-_XdFGr0w_sZGAlkL-daIbBklECudi';
const FAILED_BANNER_IMAGE =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuAHTwkjpS2syGC5yFVfQ3A5lbAaASELgS80ggV6hz9G-AMpnRM3Z4DMb4IqT637iIvLtJ1FiNmnQA_1Ujs3oplirgF8pEJ-xekLu2uL_Jq5pHoYcoB7cI9KbAlLQSENHeS6eoEbt5dlewNOEad4oja69KDgKSRJU03t2IgBwaFy7dkFpxK57g-PSXm9gZWSdxxBB3oZ8WWNhMyjVO44s0RTIWjRwfXRevDpBX-lc_C18XDGsIF3_fsXAqaBOmd7y1WRvZktR-llShOp';
const SUCCESS_NEXT_STEP_IMAGE =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuBzdJCqta7slUeHe1XWUjJWY2wKAEpVnkXLtCuZTF2Ym5uBnyWqSej4g_Dd6iGIBhvj_TK1F1XZemHLlCpzxP1dnB9TMTlI3uDoMcRjBX_EijZDDcZaEnIXE5VgVrOVEOJjwC5_fKLc_d4HlwszYNB3jEjWYW9RoiaOe3l7lQEPxuAj-vO5eD_0q18pXmAVbwtq8Vq20iixKWxq5YpiIRR5P2lrcaaMj4OZHQy4HdCMx9OUcyxfIY0euKTQvNKer460aYO-6OZQyBRx';
const VISA_LOGO =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuAQro8kp5nYjIH5Jzl6QJCAYj2VBDakRpoFYTEabZhaoMaN7-5S3LQNzv2bdf5l7Rzaxs3sxEuqfgNixAAQqgD517ULHuRsZbu-SyEH2yGs2A72RnluoDcWPUozhWVgSMkD2A5Fl_pOBWYC_psm70EBqvolfcwumGLIRlV-OsBERU-3rmGF6Req8UsRjHqLO8HTBtUrScTueX6yJS8SyYVtEfvqMxmElVWM0p4cMkBKIqLKhXsXo3xp8Axnd1FbqHHVlyk_EuNk6u9z';
const MASTERCARD_LOGO =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuBBrK6ni3BdBfCb3USu4XMpQdJoZFXz0SscXQrGsvbjM0zMkSSIkIVLxWvBNn_lD3MLMvZ4hqW4KvKbP5GDNxmNW_QV35zBjjteQzKn1PKTMz_oBLK7g1sQ6edAIm2G0OWMsOdyYvV3fbY8uBSL4hWaeIO1sH0pCceCW54Lv_5HjacLH40mysLkB81SMTVC3e-GLahEg9OKw1Sv8KoAbdFVf-mMkb-EX9CMHV0Rouno8rQJSLuLnbcH19_jrhSNR1aawI2T3-wuKAJ2';
const CHECKOUT_VISA_LOGO =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuAkST7X-yRmlrXBaL9QplDRjQmc05kK7jYSGEv0dTYB2FFHcRc5nym4dtfjvY8gGIE6iE_qVOD3W3oFEYT7tkdkjRSJhPqf2qDnFZDqSoAfhihGY-NnobzOdnfBwCP8QRjZNXlTT4YPoG4TCYn2cwvkEQFvP3Ti37l7Rja7HxyuQHWXBhEkgfwMppQKnEOq8UBkKpNPWog9WPK2f-66c3p1vpLDO86zp9QS9Fc12Z5clp1uktTm1TsW2p_aY8rMX9y_5Cu6kEIpwXnc';
const CHECKOUT_MASTERCARD_LOGO =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuDhlOcMzxomGCH-Y4s_l0MNh_1K_uVDeHvEasVALZuUs5VbPp1kEr5w1cy-PzTOi8eW0EsemdWY8cDDh0LUvS9MMXInSUa9rWqD9LfDHNRqI_wiEv2a37_O3RadcTRONZHIyaZphlXBNA15-u2ZfkU-hY83rBGUcCNtOndM31m9PabqftleOUvoF0nNKy-v0BCnsbuoC0KeDAPxzosewWv2tkBxWE9QLOqq7jzFOvQpfLTfqLcdFDjTfT-3sTk0WI-0qYC4-GDJF4dj';
const PCI_DSS_LOGO =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuAWT_4JyeeCNZ_2JeJgPRSbrI95zk25I30ImZwqZ0Pi-Ty0JEpXQ1M22Hr3MpJ14mhQpRD4Snn-ktqaeqKc1NaeQW07Y4bojoBJ2iLThuLKdPuY_hdb1U1X8Wz80uQ6vycgXwagV-XRd6SAqQnjVCcUL6oIpDV_t-WAQY4mmaWFwW0TPMouUQ3G4GU0vWA8nS-q9BL8vCBQoK3P5dzC2aiQMMKTbaVyLsl41tyd7g2qPdB9OEcrbWtDLcODBRkCpEH2FR1-hKpN6cWr';

const LEARNING_MODULE_PROGRESS_START = 45;
const RETRY_PAYMENT_AMOUNT = 5000;
const FORCE_OPTION_A_AS_CORRECT = true;

const createQuestion = (id, question, options, answerIndex, explanation) => ({
  id,
  question,
  options,
  // Temporary demo override: force option A to pass the full flow.
  answerIndex: FORCE_OPTION_A_AS_CORRECT ? 0 : answerIndex,
  explanation,
});

export const RUNTIME_EXAM_QUESTIONS = [
  createQuestion(
    'q1',
    'Какой документ фиксирует первичный допуск работника к опасным работам?',
    ['Устное согласование', 'Наряд-допуск', 'Памятка по смене', 'Служебная записка'],
    1,
    'Для опасных работ нужен формализованный допуск и фиксация ответственных.',
  ),
  createQuestion(
    'q2',
    'Что нужно сделать перед началом работ в замкнутом объёме?',
    ['Открыть все двери', 'Оценить атмосферу и обеспечить контроль среды', 'Сразу включить оборудование', 'Остановить журналирование'],
    1,
    'Контроль среды и порядок допуска обязательны для работ в замкнутом пространстве.',
  ),
  createQuestion(
    'q3',
    'Кто должен подтверждать обучение и ознакомление с материалами?',
    ['Только HR', 'Сам сотрудник и ответственное лицо', 'Только подрядчик', 'Поставщик оборудования'],
    1,
    'Для допуска фиксируются обе стороны: обучаемый и ответственное лицо.',
  ),
  createQuestion(
    'q4',
    'Какой шаг снижает риск ошибок перед экзаменом?',
    ['Пропустить инструкции', 'Проверить модули и пройти подтверждение', 'Сразу перейти к оплате', 'Отключить историю'],
    1,
    'Сначала обучение и подтверждение, затем тестирование.',
  ),
  createQuestion(
    'q5',
    'Что обычно входит в обязательный пакет документов?',
    ['Наряд-допуск, протокол, журнал инструктажа', 'Только паспорт', 'Письмо от коллеги', 'Скриншот оплаты'],
    0,
    'Базовый пакет включает подтверждение допуска и фиксированные записи обучения.',
  ),
  createQuestion(
    'q6',
    'Как лучше действовать при смене отрасли или объекта?',
    ['Оставить старые настройки', 'Подобрать новую связку отрасль + профиль риска', 'Отключить тест', 'Удалить кабинет'],
    1,
    'Новый объект или отрасль меняют контекст рисков и программу обучения.',
  ),
  createQuestion(
    'q7',
    'Что показывает экран подтверждения перед тестом?',
    ['Только цену', 'Завершённые модули, предупреждение и чекбокс готовности', 'Только логотип', 'Только отзывы'],
    1,
    'Перед тестом пользователь должен увидеть, что именно завершено и что он подтверждает.',
  ),
  createQuestion(
    'q8',
    'Какой вариант подходит для ИТР и ответственных специалистов?',
    ['Вариант без подтверждения', 'Программы с управленческим и нормативным контекстом', 'Только рабочие инструкции', 'Только визуальные инструкции'],
    1,
    'ИТР нужен более широкий нормативный и управленческий контекст.',
  ),
  createQuestion(
    'q9',
    'Что делает mock payment в fail-ветке?',
    ['Ничего не меняет', 'Разблокирует повторный проход экзамена', 'Удаляет сертификат', 'Переводит сразу в pending'],
    1,
    'После успешной mock-оплаты пользователь должен вернуться в retry-flow.',
  ),
  createQuestion(
    'q10',
    'Что делает mock payment в success-ветке?',
    ['Останавливает процесс', 'Переводит пользователя к статусу оформления документа', 'Возвращает к обучению', 'Сбрасывает кабинет'],
    1,
    'После оплаты сертификат уходит в обработку и пользователь видит pending-экран.',
  ),
  createQuestion(
    'q11',
    'Что должно быть видно на pending-экране?',
    ['Только кнопку выхода', 'Статус, идентификатор, этап и ожидаемое время', 'Только картинку', 'Только список курсов'],
    1,
    'Pending-экран должен объяснять, что происходит с документом прямо сейчас.',
  ),
  createQuestion(
    'q12',
    'Какой минимальный порог прохождения используется в этом демо-flow?',
    ['60%', '70%', '80%', '90%'],
    2,
    'В pre-test и exam flow используется одинаковый порог 80%.',
  ),
  createQuestion(
    'q13',
    'Что происходит с неотвеченными вопросами после submit?',
    ['Считаются правильными', 'Игнорируются и не дают баллов', 'Автоматически заполняются системой', 'Переносятся на следующий экзамен'],
    1,
    'Неотвеченные вопросы не добавляют баллы к итоговому результату.',
  ),
  createQuestion(
    'q14',
    'Какой блок обязателен на экране fail-результата?',
    ['Темы для повторения', 'Каталог курсов', 'Отзывы клиентов', 'SEO-текст'],
    0,
    'Fail-экран должен объяснять, что именно стоит повторить перед новой попыткой.',
  ),
  createQuestion(
    'q15',
    'Что должен сделать пользователь на экране 07_pre-test-confirm?',
    ['Сразу открыть оплату', 'Подтвердить готовность через чекбокс', 'Скачать сертификат', 'Выбрать новый курс'],
    1,
    'Кнопка перехода к тестированию активируется только после подтверждения.',
  ),
  createQuestion(
    'q16',
    'Какая механика завершения модулей допустима для learning-экрана?',
    ['Пустая страница без действий', 'Переход по секциям и фиксация завершения материала', 'Телепорт сразу к экзамену', 'Автозавершение без чтения'],
    1,
    'Learning-доступ должен быть честно проходимым, а не декоративным.',
  ),
  createQuestion(
    'q17',
    'Что отображает таблица Knowledge Breakdown на success-экране?',
    ['Случайные числа', 'Результаты по тематическим разделам и статус освоения', 'Только общую цену', 'Только дату'],
    1,
    'Разбивка нужна, чтобы показать результат не только одним числом.',
  ),
  createQuestion(
    'q18',
    'Какой путь является корректным happy-path после успешного экзамена?',
    ['success -> pending -> exam', 'success -> certificate -> pending', 'success -> learning -> payment', 'success -> failed -> payment'],
    1,
    'После успеха пользователь идёт к оплате оформления документа и затем в pending.',
  ),
  createQuestion(
    'q19',
    'Что должен содержать invoice на экране 13_certificate?',
    ['Только название компании', 'Курс, участника, номер инвойса, строки услуг и сумму', 'Только кнопку оплаты', 'Только дату'],
    1,
    'Invoice-блок должен быть заполнен правдоподобными данными для завершённого экрана.',
  ),
  createQuestion(
    'q20',
    'Какой итог требуется от demo-runtime 06–14?',
    ['Только статичная верстка', 'Проходимый путь без тупиков и с рабочими mocks', 'Только отдельные скрины', 'Только обновлённые стили'],
    1,
    'Главная цель этой интеграции — честно пройти путь до конца без backend.',
  ),
];

const buildCourseCode = (courseId) => courseId.replace(/[^a-z]/gi, '').slice(0, 6).toUpperCase() || 'IND';

const formatCurrency = (value) =>
  `${Math.round(value)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} ₸`;

const parseCurrency = (value) => Number.parseInt(String(value || '').replace(/[^\d]/g, ''), 10) || 0;

const buildRuntimeTitles = (courseId, fallback) =>
  ({
    'industrial-safety': 'Advanced Industrial Safety & Regulatory Compliance',
    'labor-safety': 'Occupational Health & Site Safety Control',
    'fire-safety': 'Fire Safety Command & Response Standards',
  }[courseId] || fallback);

const createLearningSection = ({
  id,
  navTitle,
  articleTitle,
  intro,
  alertTitle,
  alertText,
  requirements,
  bodyHeading,
  bodyText,
  footnote,
  outro,
}) => ({
  id,
  navTitle,
  articleTitle,
  intro,
  image: {
    src: LEARNING_SCHEMATIC_IMAGE,
    title: 'Technical Schematic 01-A',
    caption: 'High-pressure containment vessel highlighting critical inspection points (Red Zones).',
  },
  alert: {
    title: alertTitle,
    text: alertText,
  },
  requirements: {
    title: 'Key Requirement',
    items: requirements,
  },
  bodyHeading,
  bodyText,
  footnote: {
    title: 'Regulatory Footnote',
    text: footnote,
  },
  outro,
});

const createLearningModules = (program) => [
  {
    id: 'module-1',
    navTitle: '01. Fundamentals of Safety',
    title: 'Fundamentals of Safety',
    sections: [
      createLearningSection({
        id: 'module-1-section-1',
        navTitle: '1.1 Safety baseline',
        articleTitle: 'Fundamentals of Safety: Operational Baseline',
        intro: `This opening section defines the minimum safety baseline for ${program.title.toLowerCase()}. It explains how admission, supervision and record keeping should align before work starts on site.`,
        alertTitle: 'Control Reminder',
        alertText: 'Any deviation from baseline supervision procedures must be documented before a shift is approved.',
        requirements: ['Daily pre-shift briefing', 'Signed supervisor acknowledgment'],
        bodyHeading: 'Mandatory Inspection Protocols',
        bodyText:
          'Before field work begins, the operator confirms conditions, verifies access restrictions and checks the current set of instructions. The module is considered complete only after the user reads the section and advances to the next step.',
        footnote:
          '"Operational readiness is not valid without a recorded briefing and a signed acknowledgment from the responsible specialist."',
        outro:
          'This baseline becomes the reference point for the rest of the course and is kept marked as completed when the user enters the runtime demo.',
      }),
    ],
  },
  {
    id: 'module-2',
    navTitle: '02. Industrial Regulatory Framework',
    title: 'Industrial Regulatory Framework',
    sections: [
      createLearningSection({
        id: 'module-2-section-1',
        navTitle: '2.1 State Regulations Law 412',
        articleTitle: 'State Regulations Law 412: Industrial Equipment Standards',
        intro:
          'The legislative framework for industrial safety in the Republic of Kazakhstan is centered around Law No. 412-IV. This section details the critical requirements for the technical certification of high-pressure vessels and automated drilling systems.',
        alertTitle: 'Compliance Alert',
        alertText:
          'Unauthorized pressure adjustments exceeding 15% of the nominal threshold result in immediate certification revocation.',
        requirements: ['Bi-annual ultrasonic testing', 'Digital logging of seismic shifts'],
        bodyHeading: 'Mandatory Inspection Protocols',
        bodyText:
          'According to Article 14, inspectors must utilize the following hierarchy of checks when evaluating the structural integrity of steel reinforcements in mining shafts. Note the shift from manual observation to AI-driven thermal imaging.',
        footnote:
          '"The transition to digital twin monitoring is mandatory for all Category 1 industrial sites starting Q3 2024. Manual logs are no longer accepted as primary evidence during state audits."',
        outro:
          'The integration of automated safety valves has reduced incident rates by 34% across the Karaganda coal basin. However, the certification of these valves requires a specific specialized accreditation from the National Center for Accreditation.',
      }),
      createLearningSection({
        id: 'module-2-section-2',
        navTitle: '2.2 Technical Inspection Standards',
        articleTitle: 'Technical Inspection Standards for Category 1 Sites',
        intro:
          'Inspection standards define how recurring checks, maintenance windows and technical evidence must be recorded for high-risk facilities. This section focuses on documented control rather than verbal confirmation.',
        alertTitle: 'Inspection Threshold',
        alertText:
          'If inspection records are missing or incomplete, the facility must be classified as non-compliant until the gap is closed.',
        requirements: ['Quarterly structural review', 'Equipment passport verification'],
        bodyHeading: 'Inspection Sequence',
        bodyText:
          'The technical inspection sequence starts with passport validation, continues with journal review and ends with physical confirmation on the site. Missing evidence at any stage blocks the final readiness sign-off.',
        footnote:
          '"An inspection sequence is valid only when every step is recorded in the same reporting window and can be traced to a named specialist."',
        outro:
          'Once this section is completed, the next module becomes available in the left-side navigation and the runtime progress bar moves forward.',
      }),
    ],
  },
  {
    id: 'module-3',
    navTitle: '03. Emergency Response Protocols',
    title: 'Emergency Response Protocols',
    sections: [
      createLearningSection({
        id: 'module-3-section-1',
        navTitle: '3.1 Emergency escalation chain',
        articleTitle: 'Emergency Response Protocols for High-Risk Facilities',
        intro:
          'Emergency response materials explain escalation, isolation and communication steps when an industrial event happens on site. The participant must review the escalation chain before moving on.',
        alertTitle: 'Escalation Rule',
        alertText:
          'A delayed escalation or skipped notification breaks protocol even if the incident is localized quickly.',
        requirements: ['Named escalation owner', 'Documented shutdown sequence'],
        bodyHeading: 'Response Priorities',
        bodyText:
          'The first response priorities are preserving life, isolating the risk source and recording who authorized the intervention. These three checks must appear in the protocol for every emergency action.',
        footnote:
          '"Any emergency response without a recorded handoff is considered incomplete for certification review."',
        outro:
          'After this section, the runtime unlocks the equipment integrity module and keeps a completed state in the sidebar.',
      }),
    ],
  },
  {
    id: 'module-4',
    navTitle: '04. Equipment Integrity Analysis',
    title: 'Equipment Integrity Analysis',
    sections: [
      createLearningSection({
        id: 'module-4-section-1',
        navTitle: '4.1 Integrity review and closing checks',
        articleTitle: 'Equipment Integrity Analysis and Closing Readiness',
        intro:
          'The final learning module checks whether the participant understands how inspection evidence, maintenance windows and final authorization are tied together before an exam attempt.',
        alertTitle: 'Final Readiness Alert',
        alertText:
          'Equipment with unresolved integrity findings must never be treated as cleared, even when other documents are complete.',
        requirements: ['Integrity checklist signed', 'Outstanding risks documented'],
        bodyHeading: 'Closing Controls',
        bodyText:
          'Closing controls combine evidence from previous modules: technical inspection results, emergency readiness, and the document trail for responsible personnel. All three are required before the learning flow can be closed.',
        footnote:
          '"The closing readiness review is a blocking control. If any evidence is missing, the participant returns to the material instead of moving to the test."',
        outro:
          'Completing this final module unlocks the confirm screen and removes the legacy learning runtime from the path.',
      }),
    ],
  },
  {
    id: 'module-5',
    navTitle: '05. Final Certification Exam',
    title: 'Final Certification Exam',
    examEntry: true,
    sections: [],
  },
];

const createConfirmModules = () => [
  { id: 'confirm-1', title: 'Модуль 1: Основы промышленной безопасности', duration: '45 минут' },
  { id: 'confirm-2', title: 'Модуль 2: Регламенты и стандарты РК', duration: '60 минут' },
  { id: 'confirm-3', title: 'Модуль 3: Техника безопасности при высотных работах', duration: '30 минут' },
];

const createKnowledgeBreakdown = () => [
  { title: 'General Safety Protocols', questions: 8, score: 100, status: 'Mastered', tone: 'mastered' },
  { title: 'Emergency Response (ER)', questions: 6, score: 83, status: 'Qualified', tone: 'qualified' },
  { title: 'Chemical Hazards Management', questions: 6, score: 100, status: 'Mastered', tone: 'mastered' },
];

const createRetryPaymentMethods = () => [
  {
    id: 'card',
    title: 'Банковская карта (Visa/Mastercard)',
    description: 'Мгновенная mock-оплата с немедленным возвратом в retry-flow.',
    icon: 'credit_card',
    logos: [
      { label: 'Visa', src: VISA_LOGO, className: 'h-2 w-auto' },
      { label: 'Mastercard', src: MASTERCARD_LOGO, className: 'h-3 w-auto' },
    ],
  },
  {
    id: 'kaspi',
    title: 'Kaspi.kz QR',
    description: 'Быстрый сценарий оплаты через QR для демонстрации альтернативного выбора.',
    icon: 'qr_code_2',
    badge: 'KASPI',
  },
  {
    id: 'apple-pay',
    title: 'Apple Pay',
    description: 'Контактная оплата с тем же результатом: попытка разблокируется сразу.',
    icon: 'contactless',
  },
  {
    id: 'bank-transfer',
    title: 'Bank Transfer (Invoices)',
    description: 'Безналичный вариант для демонстрации того же retry-flow.',
    icon: 'account_balance',
  },
];

const createCheckoutMethods = () => [
  {
    id: 'card',
    title: 'Банковская карта',
    description: 'Visa, Mastercard, Kaspi',
    icon: 'credit_card',
    pendingEstimate: 'до 15 минут',
  },
  {
    id: 'qr',
    title: 'Оплата по QR-коду',
    description: 'Мгновенное сканирование',
    icon: 'qr_code_2',
    pendingEstimate: 'до 30 минут',
  },
  {
    id: 'invoice',
    title: 'Счёт для компании',
    description: 'Безналичный расчет для юр. лиц',
    icon: 'business',
    pendingEstimate: '1-2 рабочих дня',
  },
];

export const getRuntimeFlowFixture = (courseId) => {
  const program = getProgramFixture(courseId);
  const courseCode = buildCourseCode(program.courseId);
  const totalAmount = parseCurrency(program.price) || 57500;
  const tuitionAmount = Math.round(totalAmount * 0.78 / 500) * 500;
  const documentAmount = totalAmount - tuitionAmount;
  const runtimeCourseTitle = buildRuntimeTitles(program.courseId, program.title);
  const learningModules = createLearningModules(program);
  const confirmModules = createConfirmModules();
  const checkoutMethods = createCheckoutMethods();

  return {
    ...program,
    runtime: {
      participant: {
        profileName: 'Alexander Kuznetsov',
        fullName: 'Александр Владимирович Кузнецов',
        candidateName: 'Kuznetsov A.V.',
        inspectorId: '8821',
      },
      protocolId: `CERT-${courseCode}-7729`,
      examProtocolId: `IS-CERT-KZ-2026-${courseCode}`,
      orderNumber: `KZ-${courseCode}-2026`,
      invoiceNumber: `#INV-2026-${courseCode}`,
      currentCourseTitle: runtimeCourseTitle,
    },
    learningExperience: {
      currentCourseTitle: runtimeCourseTitle,
      progressStart: LEARNING_MODULE_PROGRESS_START,
      supportText:
        'Facing technical issues? Contact our duty officer at 24/7 technical hotline.',
      rootBreadcrumb: 'Course Archive',
      requiredModuleIds: learningModules.filter((module) => !module.examEntry).map((module) => module.id),
      examModuleId: 'module-5',
      initialActiveModuleId: 'module-2',
      initialActiveSectionId: 'module-2-section-1',
      initialCompletedModuleIds: ['module-1'],
      initialCompletedSectionIds: ['module-1-section-1'],
      modules: learningModules,
    },
    confirm: {
      title: 'Изучение материала завершено',
      description:
        'Вы успешно прошли все образовательные модули текущего курса. Для перехода к итоговому тестированию необходимо подтвердить ознакомление с материалами.',
      completedModules: confirmModules,
      legalNotice:
        'Нажимая кнопку «Перейти к тестированию», вы подтверждаете полную ответственность за достоверность предоставленных данных и осознаете последствия нарушения правил промышленной безопасности.',
      protocolId: `CERT-${courseCode}-KZ`,
      systemLabel: 'СИСТЕМА СЕРТИФИКАЦИИ SERTIFICAT.KZ',
    },
    pretest: {
      title: 'Правила тестирования',
      description:
        'Пожалуйста, внимательно ознакомьтесь с регламентом прохождения аттестации. Результаты будут занесены в реестр промышленной безопасности Республики Казахстан.',
      metrics: {
        questions: RUNTIME_EXAM_QUESTIONS.length,
        durationMinutes: 40,
        passScore: 80,
        attempts: 3,
      },
      rules: [
        'Система автоматически завершит тест по истечении 40 минут. Сохранены будут только отвеченные вопросы.',
        'Запрещается использование сторонних ресурсов, справочников и мобильных устройств во время аттестации.',
        'При обнаружении подозрительной активности система может аннулировать результат без права на возврат оплаты.',
        'Результат в 80% является минимально допустимым для получения сертификата.',
      ],
      warning:
        'У вас есть 1 бесплатная попытка. Последующие 2 попытки являются платными согласно тарифу учебного центра. Пожалуйста, убедитесь в стабильности интернет-соединения перед началом.',
      supportLinks: [
        { icon: 'contact_support', label: 'Техническая поддержка', routeKey: 'contacts' },
        { icon: 'description', label: 'Инструкция по системе', routeKey: 'publicOffer' },
      ],
      image: PRETEST_IMAGE,
      breadcrumbs: ['Industrial Portal', 'My Training', 'Rules'],
    },
    exam: {
      durationMinutes: 40,
      passScore: 80,
      questions: RUNTIME_EXAM_QUESTIONS,
      blueprintImage: EXAM_BLUEPRINT_IMAGE,
      technicalWarning:
        'Closing this browser tab will automatically terminate your session and disqualify the attempt.',
    },
    failed: {
      title: 'Тест не пройден',
      subtitle: 'Industrial Safety Protocol 4.2-K',
      message:
        'К сожалению, набранных баллов недостаточно для получения сертификата соответствия. Для повторного прохождения необходимо активировать новую попытку.',
      reviewTopics: [
        'Safety rules for gas equipment in explosive atmospheres',
        'Emergency shutdown procedures (Protocol B-12)',
        'Personal protective equipment for high-voltage zones',
      ],
      banner: {
        image: FAILED_BANNER_IMAGE,
        title: 'Повысьте свои шансы на успех',
        subtitle: 'Индивидуальные курсы подготовки для специалистов',
      },
    },
    retryPayment: {
      title: 'Оплата дополнительной попытки',
      description:
        'Ваш предыдущий тест не был пройден. Для продолжения сертификации требуется оплата дополнительной попытки.',
      amount: formatCurrency(RETRY_PAYMENT_AMOUNT),
      methods: createRetryPaymentMethods(),
      infoText:
        'После завершения платежа новая попытка будет активирована мгновенно. Квитанция об оплате будет отправлена на вашу почту.',
      trustBadges: [
        { icon: 'verified_user', label: 'Secure SSL' },
        { icon: 'shield', label: 'PCI DSS Compliant' },
        { icon: 'lock', label: 'Encrypted' },
      ],
    },
    success: {
      title: 'Тестирование успешно завершено',
      description:
        'Your certificate is being prepared. Proceed to payment to receive the document. All records of your qualification have been securely synchronized with the national registry.',
      completedAt: 'Completed on Apr 07, 2026 • 14:22',
      nextStep: {
        title: 'Physical ID Card Issuance',
        image: SUCCESS_NEXT_STEP_IMAGE,
      },
      integrityNote:
        'This result has been validated against the ISCC Kazakhstan safety standards. Digital fingerprinting has been applied to this session.',
      knowledgeBreakdown: createKnowledgeBreakdown(),
    },
    certificateCheckout: {
      title: 'Оплата обучения и оформления документа',
      organization: 'Industrial Safety Certification Center Kazakhstan',
      invoiceDate: '07 Апреля, 2026',
      invoiceNumber: `#INV-2026-${courseCode}`,
      participantName: 'Александр Владимирович Кузнецов',
      services: [
        {
          title: `Теоретический курс (${program.durationHours} часов)`,
          description: 'Дистанционное обучение с инструктором',
          amount: formatCurrency(tuitionAmount),
        },
        {
          title: 'Оформление государственного сертификата',
          description: 'Внесение в реестр и печать документа',
          amount: formatCurrency(documentAmount),
        },
      ],
      total: formatCurrency(totalAmount),
      methods: checkoutMethods,
      consentText:
        'Нажимая кнопку, вы соглашаетесь с условиями публичной оферты и обработки персональных данных.',
      securityLogos: [
        { alt: 'Visa Logo', src: CHECKOUT_VISA_LOGO, className: 'h-6 object-contain' },
        { alt: 'Mastercard Logo', src: CHECKOUT_MASTERCARD_LOGO, className: 'h-6 object-contain' },
        { alt: 'PCI DSS', src: PCI_DSS_LOGO, className: 'h-8 object-contain' },
      ],
    },
    pending: {
      title: 'Ваш документ в стадии оформления',
      description:
        'Ваш сертификат проходит проверку и государственную регистрацию. Это стандартный процесс подтверждения квалификации.',
      steps: [
        { id: 'payment', title: 'Payment', icon: 'check', state: 'done' },
        { id: 'processing', title: 'Processing', icon: 'settings', state: 'active' },
        { id: 'issuance', title: 'Issuance', icon: 'task', state: 'pending' },
      ],
      details: {
        orderNumber: `KZ-${courseCode}-2026`,
        courseName: runtimeCourseTitle,
      },
      estimateByMethod: Object.fromEntries(checkoutMethods.map((item) => [item.id, item.pendingEstimate])),
      nextItems: [
        'We will notify you by email once processing is complete.',
        'The cert will appear in your cabinet as a verifiable PDF.',
      ],
    },
  };
};
