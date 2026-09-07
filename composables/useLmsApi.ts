export interface LmsProgram {
  id: string;
  directionId: string;
  slug: string;
  title: { ru: string; kk: string };
  publicPath: string;
  availability: "published" | "consultation";
  sourceProduct?: {
    id: string;
    title: { ru: string; kk: string };
    sourceDocumentId: string;
    sourcePage: number;
    sourceRow: number;
    academicContentStatus: "not_provided";
    guidance?: {
      summary: { ru: string; kk: string };
      audience: { ru: string; kk: string };
      topics: { ru: string[]; kk: string[] };
      kind: "marketing_orientation";
    };
  } | null;
  pricing?: {
    mode: "request";
    amountMinor: null;
    currency: "KZT";
    basis: "organization" | "learner" | null;
    label: { ru: string; kk: string };
    basisLabel: { ru: string; kk: string };
  };
  versions: Array<{
    id: string;
    title: string;
    language: string;
    durationHours: number;
    priceMinor: number | null;
    currency: string;
    modules: LmsModule[];
    audience?: string;
    prerequisites?: string;
    outcomes?: string;
    documentDescription?: string;
    retakePolicy?: string;
    reviewedAt?: string;
    format?: string;
    accessModel?: string;
    intakeOpen?: boolean;
    billingBasis?: "learner" | "organization";
  }>;
}
export interface LmsModule {
  id: string;
  title: string;
  lessons: Array<{
    id: string;
    title: string;
    kind: string;
    required: boolean;
    completed?: boolean;
    revision?: number;
  }>;
}
export interface LmsEnrollment {
  id: string;
  status: string;
  versionId: string;
  programId: string;
  title: string;
  progress: { completed: number; total: number; percent: number };
  accessUntil?: string;
  modules?: LmsModule[];
  assessment?: {
    durationMinutes: number;
    maxAttempts: number;
    passPercent: number;
    questionCount: number;
    retakeDelayMinutes: number;
  };
  eligibility?: { eligible: boolean; reasons: string[] };
}
export interface LmsAttempt {
  id: string;
  enrollmentId: string;
  status: "in_progress" | "graded" | "expired";
  startedAt: string;
  deadlineAt: string;
  serverTime: string;
  revision: number;
  questions: Array<{
    id: string;
    text: string;
    options: Array<{ id: string; text: string }>;
  }>;
  answers: Record<string, string[]>;
  result: null | {
    score: number;
    pass: boolean;
    correct: number;
    total: number;
    gradedAt: string;
    topics: Array<{ topic: string; correct: number; total: number }>;
  };
}
export const lmsErrorStatus = (error: any): number =>
  Number(error?.statusCode || error?.status || error?.response?.status || 0);
export function useLmsApi() {
  const request = useRequestFetch();
  const { locale } = useI18n();
  const tr = (ru: string, kk: string) => (locale.value === "kk" ? kk : ru);
  const api = <T = any>(path: string, options: any = {}) =>
    request<T>(`/api/v1${path}`, { ...options, credentials: "same-origin" });
  const errorText = (error: any): string => {
    const status = lmsErrorStatus(error);
    const code =
      error?.data?.data?.code ||
      error?.data?.code ||
      error?.data?.statusMessage;
    const known: Record<string, string> = {
      BATCH_PREVIEW_EXPIRED: tr('Предварительный просмотр устарел. Создайте новый и проверьте состав.', 'Алдын ала қарау ескірген. Жаңасын жасап, құрамын тексеріңіз.'),
      BATCH_PREVIEW_CHANGED: tr('После просмотра изменились сведения или утверждённый бланк. Создайте новый просмотр для этой записи.', 'Қараудан кейін мәліметтер немесе бекітілген бланк өзгерді. Осы жазба үшін жаңа қарау жасаңыз.'),
      BATCH_IN_PROGRESS: tr('Эта группа уже обрабатывается. Обновите состояние через некоторое время.', 'Бұл топ өңделіп жатыр. Біраз уақыттан кейін күйін жаңартыңыз.'),
      INCIDENT_SOURCE_NOT_RECOVERED: tr('Причина события ещё активна. Сначала завершите обработку заявки, задания или документа; после отклонённого события интеграции требуется не менее пяти минут без новых ошибок.', 'Оқиғаның себебі әлі белсенді. Алдымен өтінімді, тапсырманы немесе құжатты өңдеуді аяқтаңыз; қабылданбаған интеграция оқиғасынан кейін жаңа қатесіз кемінде бес минут қажет.'),
      INCIDENT_ALREADY_RESOLVED: tr('Событие уже закрыто. Обновите список.', 'Оқиға жабылған. Тізімді жаңартыңыз.'),
      ONLY_PENDING_CREDENTIAL_REPAIRABLE: tr(
        "Восстановить подготовку можно только для ещё не выданного PDF.",
        "Дайындауды әлі берілмеген PDF үшін ғана қалпына келтіруге болады.",
      ),
      CREDENTIAL_RENDER_IN_PROGRESS: tr(
        "PDF уже обрабатывается. Дождитесь завершения и обновите состояние.",
        "PDF өңделіп жатыр. Аяқталуын күтіп, күйді жаңартыңыз.",
      ),
      FAILED_RENDER_REQUIRED: tr(
        "Ошибка подготовки PDF не зарегистрирована. Повторное назначение бланка сейчас не требуется.",
        "PDF дайындау қатесі тіркелмеген. Бланкті қайта тағайындау қазір қажет емес.",
      ),
      TEMPLATE_PROGRAM_MISMATCH: tr(
        "Выберите бланк той же учебной программы.",
        "Сол оқу бағдарламасының бланкін таңдаңыз.",
      ),
      TEMPLATE_ISSUER_MISMATCH: tr(
        "Издатель нового бланка должен совпадать с издателем документа.",
        "Жаңа бланктің баспагері құжат баспагерімен сәйкес келуі керек.",
      ),
      DIFFERENT_TEMPLATE_REQUIRED: tr(
        "Выберите исправленный и утверждённый бланк, отличный от предыдущего.",
        "Алдыңғысынан өзгеше түзетілген және бекітілген бланкті таңдаңыз.",
      ),
      INVOICE_AMOUNT_MISMATCH: tr(
        "Поступившая сумма не совпадает с итогом счёта. Проверьте выписку и выбранный счёт.",
        "Түскен сома шоттың қорытындысымен сәйкес келмейді. Үзінді көшірмені және таңдалған шотты тексеріңіз.",
      ),
      PAYMENT_REFERENCE_ALREADY_USED: tr(
        "Этот банковский документ уже использован для другого счёта.",
        "Бұл банк құжаты басқа шот үшін қолданылған.",
      ),
      MFA_REQUIRED: tr(
        "Для этого действия подтвердите вход кодом приложения в разделе безопасности.",
        "Бұл әрекет үшін қауіпсіздік бөлімінде қолданба кодымен кіруді растаңыз.",
      ),
      PROGRAM_INTAKE_CLOSED: tr(
        "Набор на эту версию программы приостановлен. Выберите другую программу или свяжитесь с учебным центром.",
        "Бағдарламаның осы нұсқасына қабылдау тоқтатылған. Басқа бағдарламаны таңдаңыз немесе оқу орталығына хабарласыңыз.",
      ),
      APPROVED_DOCUMENT_TEMPLATE_REQUIRED: tr(
        "Для этой программы ещё не утверждён шаблон документа. Добавьте и согласуйте шаблон в управлении документами.",
        "Бұл бағдарлама үшін құжат үлгісі әлі бекітілмеген. Құжаттарды басқару бөлімінде үлгіні қосып, келісіңіз.",
      ),
      PAYMENT_PROVIDER_DISABLED: tr(
        "Онлайн-оплата отключена. Согласуйте способ оплаты с учебным центром.",
        "Онлайн төлем өшірілген. Төлем тәсілін оқу орталығымен келісіңіз.",
      ),
      PUBLICATION_INCOMPLETE: tr(
        "Программа пока не готова к публикации. Проверьте материалы, обязательные поля, источники, расшифровки видео и банк вопросов.",
        "Бағдарлама жариялауға әзірге дайын емес. Материалдарды, міндетті өрістерді, дереккөздерді, бейне мәтіндерін және сұрақтар банкін тексеріңіз.",
      ),
      SEPARATE_REVIEWER_REQUIRED: tr(
        "Автор версии не может утвердить её. Требуется другой уполномоченный рецензент.",
        "Нұсқа авторы оны бекіте алмайды. Басқа уәкілетті рецензент қажет.",
      ),
      INDEPENDENT_REVIEW_REQUIRED: tr(
        "Шаблон должен утвердить другой уполномоченный сотрудник.",
        "Үлгіні басқа уәкілетті қызметкер бекітуі керек.",
      ),
      TEMPLATE_FIELDS_MISSING: tr(
        "В PDF отсутствуют указанные текстовые поля. Проверьте имена полей шаблона.",
        "PDF ішінде көрсетілген мәтін өрістері жоқ. Үлгі өрістерінің атауларын тексеріңіз.",
      ),
      REQUIRED_LEARNING_INCOMPLETE: tr(
        "Сначала нужно завершить обязательные уроки и подтвердить практику.",
        "Алдымен міндетті сабақтарды аяқтап, практиканы растау қажет.",
      ),
      ASSESSMENT_NOT_PASSED: tr(
        "Нет успешного результата проверки знаний для оформления документа.",
        "Құжатты рәсімдеу үшін білімді тексерудің сәтті нәтижесі жоқ.",
      ),
      CONTRACTUAL_CONDITIONS_INCOMPLETE: tr(
        "Договорные условия доступа ещё не подтверждены.",
        "Қолжетімділіктің шарттық талаптары әлі расталмаған.",
      ),
      VERIFIED_OWNER_REQUIRED: tr(
        "Владелец организации должен иметь аккаунт с подтверждённой почтой.",
        "Ұйым иесінің поштасы расталған аккаунты болуы керек.",
      ),
      VALIDATION_ERROR: tr(
        "Проверьте заполненные поля и допустимые значения.",
        "Толтырылған өрістерді және рұқсат етілген мәндерді тексеріңіз.",
      ),
      INVALID_CONTENT: tr(
        "Проверьте содержание, цену и адреса медиа. Вложения должны находиться на разрешённом HTTPS-хосте.",
        "Мазмұнды, бағаны және медиа мекенжайларын тексеріңіз. Тіркемелер рұқсат етілген HTTPS хостында болуы керек.",
      ),
    };
    if (known[code]) return known[code];
    if (status === 401)
      return tr(
        "Войдите в аккаунт, чтобы продолжить.",
        "Жалғастыру үшін аккаунтқа кіріңіз.",
      );
    if (status === 403)
      return tr(
        "Для этого действия недостаточно прав или требуется подтверждение входа.",
        "Бұл әрекетке рұқсат жеткіліксіз немесе кіруді растау қажет.",
      );
    if (status === 404)
      return tr(
        "Запись не найдена или недоступна этому аккаунту.",
        "Жазба табылмады немесе бұл аккаунтқа қолжетімсіз.",
      );
    if (status === 409)
      return tr(
        "Данные изменились. Обновите состояние перед повтором.",
        "Деректер өзгерді. Қайталау алдында күйді жаңартыңыз.",
      );
    if (status === 429)
      return tr(
        "Слишком много запросов. Повторите немного позже.",
        "Сұраулар тым көп. Біраз уақыттан кейін қайталаңыз.",
      );
    return tr(
      "Не удалось выполнить запрос. Проверьте соединение и повторите.",
      "Сұрау орындалмады. Қосылымды тексеріп, қайталаңыз.",
    );
  };
  // Explicit currency placement avoids server/browser ICU differences for kk-KZ.
  const money = (minor: number | null | undefined, currency = "KZT") =>
    minor == null
      ? tr("Стоимость по запросу", "Бағасы сұрау бойынша")
      : new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 })
          .format(minor / 100)
          .replace(/\s/g, "\u00a0") +
        "\u00a0" +
        (currency === "KZT" ? "₸" : currency);
  const date = (value?: string) => {
    if (!value || !Number.isFinite(Date.parse(value))) return "—";
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Qyzylorda",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date(value));
    const part = (type: string) =>
      parts.find((p) => p.type === type)?.value || "";
    return `${part("day")}.${part("month")}.${part("year")} ${part("hour")}:${part("minute")}`;
  };
  const statusLabel = (status: string) =>
    ({
      pending_access: tr(
        "Ожидает подтверждения доступа",
        "Қолжетімділікті растауды күтуде",
      ),
      accepted: tr("Принято", "Қабылданды"),
      delivered: tr("Доставлено", "Жеткізілді"),
      dead: tr("Нужна обработка сотрудником", "Қызметкердің өңдеуі қажет"),
      processing: tr("В обработке", "Өңделуде"),
      active: tr("Обучение доступно", "Оқу қолжетімді"),
      assigned: tr("Назначено", "Тағайындалды"),
      completed: tr("Завершено", "Аяқталды"),
      in_progress: tr("В процессе", "Орындалуда"),
      pending: tr("Ожидает обработки", "Өңдеуді күтуде"),
      pending_payment: tr("Ожидает оплаты", "Төлемді күтуде"),
      paid: tr("Оплачено", "Төленді"),
      succeeded: tr("Оплачено", "Төленді"),
      failed: tr("Не выполнено", "Орындалмады"),
      refunded: tr("Возвращено", "Қайтарылды"),
      issued: tr("Выдан", "Берілді"),
      revoked: tr("Отозван", "Күші жойылды"),
      superseded: tr("Заменён", "Ауыстырылды"),
      expired: tr("Срок истёк", "Мерзімі аяқталды"),
      draft: tr("Черновик", "Жоба"),
      review: tr("На проверке", "Тексерілуде"),
      published: tr("Опубликовано", "Жарияланды"),
      approved: tr("Утверждено", "Бекітілді"),
    })[status] || tr("Статус уточняется", "Күйі нақтылануда");
  return { api, request, tr, locale, errorText, money, date, statusLabel };
}

export function safeLmsReturnTo(value: unknown, fallback = "/cabinet"): string {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    /[\\\u0000-\u0020]/.test(value)
  )
    return fallback;
  const path = value.split(/[?#]/)[0] || "";
  if (
    !/^\/(?:kk\/)?(?:cabinet(?:\/(?:organization|security|reminders))?|courses(?:\/[a-z0-9-]+)?|learn\/[a-zA-Z0-9_-]+(?:\/(?:exam|pre-test|confirm|success|failed))?|payment(?:\/[a-zA-Z0-9_-]+)?|certificates\/[a-zA-Z0-9_-]+|admin(?:\/(?:users|documents|incidents|support|document-batches|programs(?:\/[a-zA-Z0-9_-]+)?))?)\/?$/.test(
      path,
    )
  )
    return fallback;
  return value;
}
