export const complianceStateLabels = {
  ru: {
    researching: 'Исследование',
    needs_documents: 'Нужны документы',
    legal_review: 'Юридическая проверка',
    academic_review: 'Академическая проверка',
    approved: 'Одобрено',
    published: 'Проверено для публикации',
    suspended: 'Приостановлено',
    expired: 'Истёк срок',
  },
  kk: {
    researching: 'Зерттеу',
    needs_documents: 'Құжаттар қажет',
    legal_review: 'Құқықтық тексеру',
    academic_review: 'Академиялық тексеру',
    approved: 'Мақұлданды',
    published: 'Жариялауға тексерілді',
    suspended: 'Тоқтатылды',
    expired: 'Мерзімі аяқталды',
  },
};

export const publicAuthorities = [
  {
    id: 'authority-industrial-safety-kz07vek00018551',
    number: 'KZ07VEK00018551',
    title: {
      ru: 'Аттестат на право проведения работ в области промышленной безопасности',
      kk: 'Өнеркәсіптік қауіпсіздік саласында жұмыстар жүргізу құқығына аттестат',
    },
    legalEntity: 'ТОО «Аттестационный центр Стандарт»',
    bin: '160440010815',
    issuer: {
      ru: 'Комитет промышленной безопасности МЧС Республики Казахстан',
      kk: 'Қазақстан Республикасы ТЖМ Өнеркәсіптік қауіпсіздік комитеті',
    },
    issuedAt: '2026-02-09',
    validity: {
      ru: 'В документе указан срок действия 5 лет. Точную конечную дату следует сверять в eLicense.',
      kk: 'Құжатта 5 жылдық қолданылу мерзімі көрсетілген. Нақты аяқталу күнін eLicense жүйесінде тексеру қажет.',
    },
    scope: {
      ru: 'Подготовка и переподготовка руководителей, специалистов и работников в области промышленной безопасности.',
      kk: 'Өнеркәсіптік қауіпсіздік саласындағы басшыларды, мамандарды және қызметкерлерді даярлау және қайта даярлау.',
    },
    documentUrl: '/documents/licenses/KZ07VEK00018551_ru.pdf',
    verificationUrl: 'https://www.elicense.kz/',
    relationshipStatus: 'pending_verification',
  },
];

export const laborSafetyTransition = {
  state: 'legal_review',
  effectiveDateClaim: '2026-07-12',
  announcedPostponementTo: '2027-01-01',
  title: {
    ru: 'Переходная редакция правил по охране труда',
    kk: 'Еңбекті қорғау қағидаларының өтпелі редакциясы',
  },
  text: {
    ru: 'Приказ №223 содержит дату введения 12.07.2026, однако Минтруда официально сообщило об инициированном переносе на 01.01.2027. Пока окончательный изменяющий НПА не подтверждён, сайт не должен выдавать требования новой редакции как безусловно действующие.',
    kk: '№223 бұйрықта 12.07.2026 енгізу күні көрсетілген, алайда Еңбек министрлігі мерзімді 01.01.2027-ге ауыстыру бастамасы туралы ресми хабарлады. Соңғы өзгерту НҚА-сы расталғанға дейін сайт жаңа редакция талаптарын сөзсіз қолданыста деп көрсетпеуі тиіс.',
  },
  sources: [
    'https://adilet.zan.kz/rus/docs/V2600038850',
    'https://www.gov.kz/memleket/entities/enbek/press/news/details/1256107?lang=ru',
  ],
};

export const courseCompliance = {
  'ohrana-truda': {
    state: 'legal_review',
    evidenceLevel: 'regulatory_transition',
    summary: {
      ru: 'Нормативная редакция и точный вид итогового документа требуют финальной юридической сверки.',
      kk: 'Нормативтік редакция мен қорытынды құжаттың нақты түрі соңғы құқықтық тексеруді қажет етеді.',
    },
  },
  'promyshlennaya-bezopasnost': {
    state: 'legal_review',
    evidenceLevel: 'provider_document_reviewed_relationship_pending',
    summary: {
      ru: 'Подтверждён публичный аттестат на промышленную безопасность; связь бренда OT Center с юридическим владельцем аттестата и внутренняя программа ещё требуют документального подтверждения.',
      kk: 'Өнеркәсіптік қауіпсіздік бойынша жария аттестат расталды; OT Center бренді мен аттестаттың заңды иесі арасындағы байланыс және ішкі оқу бағдарламасы әлі құжатпен расталуы тиіс.',
    },
    authorityId: 'authority-industrial-safety-kz07vek00018551',
  },
  ptm: {
    state: 'needs_documents',
    evidenceLevel: 'regulation_reviewed_provider_basis_missing',
    summary: {
      ru: 'Правила пожарной безопасности изучены, но полномочие провайдера, программа и точный итоговый документ для этой услуги пока не подтверждены.',
      kk: 'Өрт қауіпсіздігі қағидалары зерттелді, бірақ провайдердің өкілеттігі, бағдарлама және нақты қорытынды құжат әзірге расталмаған.',
    },
  },
  elektrobezopasnost: {
    state: 'researching',
    evidenceLevel: 'insufficient_data',
    summary: {
      ru: 'Курс требует отдельной нормативной и документальной проверки.',
      kk: 'Курс жеке нормативтік және құжаттық тексеруді қажет етеді.',
    },
  },
  'raboty-na-vysote': {
    state: 'researching',
    evidenceLevel: 'insufficient_data',
    summary: { ru: 'Курс требует отдельной нормативной и документальной проверки.', kk: 'Курс жеке нормативтік және құжаттық тексеруді қажет етеді.' },
  },
  'gpm-stropalschiki': {
    state: 'researching',
    evidenceLevel: 'insufficient_data',
    summary: { ru: 'Не завершено сопоставление профессии, программы и области промышленной безопасности.', kk: 'Кәсіп, бағдарлама және өнеркәсіптік қауіпсіздік саласы арасындағы сәйкестік аяқталмаған.' },
  },
  'gazoopasnye-raboty': {
    state: 'researching',
    evidenceLevel: 'insufficient_data',
    summary: { ru: 'Курс требует отдельной нормативной и документальной проверки.', kk: 'Курс жеке нормативтік және құжаттық тексеруді қажет етеді.' },
  },
  'ekologicheskaya-bezopasnost': {
    state: 'researching',
    evidenceLevel: 'insufficient_data',
    summary: { ru: 'Правовое основание и модель итогового документа ещё не установлены.', kk: 'Құқықтық негіз және қорытынды құжат моделі әлі белгіленбеген.' },
  },
  'pervaya-pomoshch': {
    state: 'researching',
    evidenceLevel: 'insufficient_data',
    summary: { ru: 'Правовое основание, программа и итоговый документ ещё не установлены.', kk: 'Құқықтық негіз, бағдарлама және қорытынды құжат әлі белгіленбеген.' },
  },
};

export const getCourseCompliance = (slug) =>
  courseCompliance[slug] || {
    state: 'researching',
    evidenceLevel: 'insufficient_data',
    summary: {
      ru: 'Нормативная карточка курса ещё не собрана.',
      kk: 'Курстың нормативтік картасы әлі жиналмаған.',
    },
  };
