# Карта маршрутов, шаблонов и контрактов — 14 сентября 2026

Аудит выполнен по текущим исходникам и read-only HTTP-запросам к `http://127.0.0.1:3102`. Пояснения предыдущего дизайна до этого аудита не читались. Это исходная карта покрытия; столбцы реализации и проверки не означают оценку старой реализации как завершённого редизайна. Визуальное качество требует отдельных снимков и браузерной проверки.

Рабочая копия уже содержала многочисленные изменённые и новые файлы дизайна. В ходе инвентаризации они не изменялись. Применимых `AGENTS.md` в корне и проверенных родительских каталогах не обнаружено.

## 1. Масштаб и источники истины

- `pages/`: **62 Vue-файла**. Среди них есть оболочка вложенных страниц и перенаправления; это не 62 независимых визуальных шаблона.
- `buildPublicRoutes()` из `config/public-route-policy.js`: **558 индексируемых адресов**, 279 RU + 279 KK. Язык KK имеет префикс `/kk`, RU — без префикса.
- 15 городов; 9 базовых направлений; 6 страниц условий/форматов; 11 дополнительных направлений; 5 статей.
- 279 национальных и местных адресов на язык = 8 общих публичных страниц + 11 дополнительных направлений + 9 национальных базовых направлений + 6 национальных форматов + 5 статей + 15 × (1 город + 9 направлений + 6 форматов).
- Динамические страницы `/courses/:id`, кабинет, заказы, назначения, попытки и документы не имеют фиксированного числа URL. Нельзя считать их покрытыми проверкой одного адреса из sitemap.
- `nuxt-redesign/pages/*/index.html` — прежние автономные шаблоны, не маршруты работающего Nuxt-приложения. `HomePageClassic` используется `/second`; `HomePageCivic` сейчас не является главной. Живая главная использует `HomePageEditorial`.
- `layouts/default.vue` — общая оболочка; `components/lms/LmsShell.vue` — вложенная рабочая оболочка. `layouts/fullwidth.vue` существует, но в найденных рабочих страницах отдельный активный потребитель не обнаружен. `app.vue` выводит `NuxtLayout` / `NuxtPage`.
- Универсального пользовательского `error.vue` нет. Неизвестный адрес сейчас отдаёт Nuxt-ошибку 404; это отдельная поверхность редизайна.

**Свежий HTTP-срез 3102:** `/`, `/courses`, `/licenses` — 200; неизвестный `/no-such-route-redesign-audit` — 404. `/api/v1/catalog/programs` — 200, `storageAvailable: true`, **20 программ и 0 программ с опубликованными версиями**. `/api/v1/auth/config` — 200, `available: true`, `emailDeliveryConfigured: false`. Это ограничения локального состояния, а не доказательство дефекта API. Учебные экраны с данными и оплату нужно проверять на изолированных fixtures; реальных учеников и рассылки использовать нельзя.

## 2. Полная карта страниц и уникальных форм

Все маршруты ниже имеют локализованный эквивалент `/kk/...`, если не оговорён технический endpoint. Статусы: И — изучена по исходникам; П — спроектирована в текущем редизайне; Р — реализована; В — визуально проверена; Ф — функционально проверена. `—` означает «ещё не подтверждено этим аудитом».

| Группа / маршруты | Файлы и форма | Аудитория и задача | Значимые реальные состояния | И | П | Р | В | Ф |
|---|---|---|---|---|---|---|---|---|
| Оболочка всех страниц | `layouts/default.vue`, `CitySwitcher.vue`, `editorial/EditorialNavigation.vue`, `useEditorialMenu.ts`, `LmsShell.vue` | Все: задача, язык, город, помощь, возврат | Закрытое/открытое меню; поиск направлений, пустой поиск; язык RU/KK; город в URL/query/cookie; keyboard, mobile | ✓ | — | — | — | — |
| `/` | `pages/index.vue`, `HomePageEditorial.vue`; редакционная обложка с продолжением | Новый посетитель: понять предложение и выбрать путь | Обложка/изображение, направления, форматы, города, доверие, CTA; RU/KK | ✓ | — | — | — | HTTP 200 |
| `/courses` | `pages/courses/index.vue`; список программ с фильтрами | Найти конкретное направление и сравнить условия | Loading/error/retry; 20 консультационных направлений; опубликованные варианты; поиск/фильтр; пустой результат | ✓ | — | — | — | HTTP + API |
| `/program-selection` | `pages/program-selection.vue`; четыре шага | Подобрать тему, роль, отрасль, формат | Направление → работа → формат → результат; пустой выбор; match/unmatched; API loading/error; возвращение к шагу; cookie | ✓ | — | — | — | — |
| `/categories`, `/wizard` | Одноимённые файлы; redirects | Сохранить старые входы подбора | 301 → локализованный `/program-selection` с исходным query | ✓ | — | — | — | — |
| `/courses/:id` | `pages/courses/[id].vue`; паспорт конкретной программы | Изучить содержание, язык, версию, цену, действие | Нет версии → консультация; версия published; intake closed; free/manual/paid; learner/organization; отсутствующий id → 404; несовпадение формата | ✓ | — | — | — | API без published |
| `/:course` для 9 базовых направлений | `pages/[course].vue`, `CoursePage.vue` | SEO-посетитель: понять направление и перейти к подбору/версии | Национальное содержание; метаданные; источники; консультация; цены/условия | ✓ | — | — | — | — |
| `/:city` для 15 городов | `pages/[course].vue`, `SeoUniqueBlocks.vue`, `useSeoContent.ts` | Уточнить условия обучения из своего города | Городская вводная, планирование, направления, локальные ссылки, подбор | ✓ | — | — | — | — |
| `/:city/:course` | `pages/[city]/[slug].vue`, `pages/[city]/ohrana-truda.vue`, `CoursePage.vue` | Выбрать направление в городе | Валидный город + направление; местная вводная; неверный город/slug → 404 | ✓ | — | — | — | — |
| Национальные форматы и условия | `pages/online-obuchenie.vue`, `ochnoe-obuchenie.vue`, `vyezdnoe-obuchenie.vue`, `srochnoe-obuchenie.vue`, `obuchenie-dlya-tendera.vue`, `prodlenie-udostovereniy.vue`; `FormatLanding.vue` | Выбрать способ обучения или обсудить особую задачу | Шесть содержательных вариантов; CTA в подбор; online/classroom/onsite имеют код формата; срочное/тендер/продление — задачи, не код формата | ✓ | — | — | — | — |
| Городские форматы и условия | `pages/[city]/online-obuchenie.vue`, `ochnoe-obuchenie.vue`, `vyezdnoe-obuchenie.vue`, `srochnoe-obuchenie/index.vue`, `obuchenie-dlya-tendera/index.vue`, `prodlenie-udostovereniy/index.vue`; общий fallback `[slug].vue` | Уточнить те же условия для города | 15 × 6; тип + местный заголовок; подбор с городом; неверный city → 404 | ✓ | — | — | — | — |
| `/b2b` | `pages/b2b.vue`; содержание для компании и форма | Руководитель/HR: оставить корпоративную заявку | Контекст программы/города/формата; поля команды; согласие; pending/failure/success; защита повтора; anti-bot поле | ✓ | — | — | — | — |
| `/contacts` | `pages/contacts.vue`; реквизиты/каналы/форма | Получить помощь и оставить обращение | Prefill query; телефон или email; согласие; error/rate limit; подтверждённый приём; данные сохраняются при ошибке | ✓ | — | — | — | — |
| `/blog` | `pages/blog/index.vue`; редакционный список | Найти полезный материал | 5 статей; pagination `?page=` (размер 10); даты/время чтения; следующий переход | ✓ | — | — | — | — |
| `/blog/:slug` | `pages/blog/[slug].vue`; длинное чтение | Изучить вопрос и найти связанное обучение | Заголовок/обложка/даты/время чтения; article body; related courses/posts; неизвестный slug → 404 | ✓ | — | — | — | — |
| `/licenses` | `pages/licenses.vue`; сейчас заголовок и один абзац | Проверить основание доверия и документы центра | Публичный PDF существует в `config/licenses-files.js`, но эта страница его не выводит | ✓ | — | — | — | HTTP 200 |
| `/privacy`, `/public-offer` | Одноимённые файлы; юридическое чтение | Прочитать обязательные условия | Секции длинного текста; два языка; ссылки с согласий форм и заказа | ✓ | — | — | — | — |
| `/auth/login`, `/auth/signup`, `/auth/forgot`, `/auth/reset`, `/auth/verify`, `/auth/mfa` | 6 route wrappers + `LmsAuthForm.vue`; общая форма с режимами | Войти, создать аккаунт, восстановить/подтвердить доступ | Service unavailable; email unavailable; invalid/expired/missing token; wrong credentials; pending/success; TOTP; safe returnTo | ✓ | — | — | — | config API |
| `/payment/:courseId` | `pages/payment/[courseId].vue`; оформление заказа | Подтвердить конкретную версию и цену | versionId отсутствует; intake closed; organization billing; null price; согласие; pending/error; 401 → login | ✓ | — | — | — | — |
| `/payment/pending?order=:id` | `pages/payment/pending.vue`; статус заказа | Понять статус, следующий шаг, обновить запись | Нет order; forbidden/missing; created/pending/paid/failed/refunded/partially_refunded; disabled/sandbox provider; refresh | ✓ | — | — | — | — |
| `/cabinet` | `pages/cabinet/index.vue`; персональный обзор | Найти назначение, проверку, документы, заказы | 401; назначения пустые/с прогрессом/доступ ограничен; `#learning`, `#assessments`, `#documents`, `#orders`; notifications; logout | ✓ | — | — | — | — |
| `/cabinet/organization` | `pages/cabinet/organization.vue`, `LmsInvoices.vue`, `LmsLearningReminders.vue`; составная рабочая область | Owner/manager/member: сотрудники, назначение, счета, отчёт | Нет организации/одна/несколько; invitation token; import preview/commit; assignment confirmation; access revoke; pagination; CSV report; invoices/reminders | ✓ | — | — | — | — |
| `/cabinet/security` | `pages/cabinet/security.vue`, `LmsPreferences.vue`; настройка доступа | Настроить/подтвердить/выключить MFA, согласия | Password/TOTP/setup URI/recovery codes; подтверждение сохранения кодов; errors; marketing + analytics consent | ✓ | — | — | — | — |
| `/cabinet/reminders` | `pages/cabinet/reminders.vue`, `LmsLearningReminders.vue` | Настроить напоминания | Preferences; список/пустое; создать/изменить/отменить; server validation, pagination | ✓ | — | — | — | — |
| `/learn/:id` | `pages/learn/[id].vue` — только NuxtPage; `pages/learn/[id]/index.vue`, `LmsLessonContent.vue`; оглавление + чтение | Назначенный ученик: изучить материал и сохранить завершение | Access pending/expired/denied; text/practice; image/video/transcript/attachment; required/optional/completed; loading/error/conflict; focus to chapter | ✓ | — | — | — | — |
| `/learn/:id/pre-test` | `pages/learn/[id]/pre-test.vue`; условия допуска | Ученик: увидеть время/попытки/условия и начать | eligibility/reasons; согласие; создание idempotent attempt; activeAttemptId → продолжение; pending/error | ✓ | — | — | — | — |
| `/learn/:id/confirm` | `pages/learn/[id]/confirm.vue`; redirect | Сохранить старую ссылку | replace → локализованный pre-test, query сохраняется; таймер не запускается | ✓ | — | — | — | — |
| `/learn/:id/exam` | `pages/learn/[id]/exam.vue`, `LmsExamPage.vue`; вопрос/ответ/таймер | Ученик: пройти разрешённую попытку | Нет попытки; current/latest; saving/dirty/conflict; offline retry; timer/expired; confirmation; server result | ✓ | — | — | — | — |
| `/learn/:id/success`, `/learn/:id/failed` | Оба wrapper используют `LmsExamPage result-only` | Ученик: понять итог и продолжение | Результат определяется сервером, не словом success/failed в URL; незавершённая попытка → link back; pass/fail/topics/retake | ✓ | — | — | — | — |
| `/certificates/:id` | `pages/certificates/[id].vue`; личный документ | Владелец: проверить статус и скачать | pending/issued/downloadAvailable; revoked/superseded; файл ещё готовится; 401/404; refresh | ✓ | — | — | — | — |
| `/verify/:token` | `pages/verify/[token].vue`; публичная проверка записи | Получатель документа: проверить действительность | Valid/revoked/superseded; bad token/not found; no-referrer; без выдачи полного PDF | ✓ | — | — | — | — |
| `/admin` | `pages/admin/index.vue`; операционный обзор и формы действий | Staff по роли: обучение, доступ, финансы, документы | Role/MFA; intake; outbox/tick; leads; refunds; credential issue/reissue/repair/revoke; assignment/practice; organization create | ✓ | — | — | — | — |
| `/admin/programs` | `pages/admin/programs/index.vue`, `LmsProgramEditor.vue`, `LmsAuthoringGuide.vue`, lesson preview | Editor/reviewer: создать, проверить, опубликовать версию | List/empty; create/edit; modules/lessons/media/questions; review/publish; revisions/conflict; independent reviewer | ✓ | — | — | — | — |
| `/admin/documents` | `pages/admin/documents.vue`; PDF-шаблоны и поля | Issuer/reviewer: подготовить и согласовать бланк | Upload PDF/base64; field mapping; template/program; preview; approve by other reviewer; validation | ✓ | — | — | — | — |
| `/admin/document-batches` | `pages/admin/document-batches.vue`; пакетный preview и история | Issuer: подготовить/отозвать группу документов | Target selection; preview; eligibility per record; expired/changed preview; confirm/processing/completed; pagination | ✓ | — | — | — | — |
| `/admin/users` | `pages/admin/users.vue`; поиск и управление ролями | Admin: найти пользователя и изменить роль | Search/results/empty; role choice; reason + confirmation; MFA; failure/success | ✓ | — | — | — | — |
| `/admin/support` | `pages/admin/support.vue`; поиск и история заметок | Admin: зафиксировать помощь ученику | Search; selected user; notes pagination; append/supersede without deleting history; failure/success | ✓ | — | — | — | — |
| `/admin/leads` | `pages/admin/leads.vue`, `LmsLeadWorkspace.vue`; список и детали заявки | Admin: квалификация и связь с операционными записями | Stage filters/paging; details; target search; qualification; links/revoke; proposal/withdraw; explicit confirmation | ✓ | — | — | — | — |
| `/admin/analytics` | `pages/admin/analytics.vue`, `LmsLeadCohort.vue`, `LmsSalesFunnel.vue`; отчёт/таблицы | Admin: измеренные действия и состояние работы | Period 7/14/30 days; loading/error; consent cohorts; source absent; unavailable metrics distinct from zero | ✓ | — | — | — | — |
| `/admin/incidents` | `pages/admin/incidents.vue`; инциденты и действия | Finance/issuer/admin: разобрать сбой операции | active/resolved/all; paging; severity; acknowledge/resolve; reason; source still active | ✓ | — | — | — | — |
| `/ui-kit` | `pages/ui-kit.vue`; демонстрация настоящих компонентов | Команда: проверить токены/элементы/состояния | Button/link/input/select/dialog/progress/notice/navigation/lesson; RU/KK | ✓ | — | — | — | — |
| `/second` | `pages/second.vue`, `HomePageClassic.vue`; старая главная | Старый служебный вход | noindex; всё ещё отдельная визуальная поверхность | ✓ | — | — | — | — |
| `/src`, `/src/:path(.*)` | `pages/src/index.vue`, `[...path].vue`; redirects | Сохранить старые технические ссылки | Сейчас redirect на `/` без языка/query | ✓ | — | — | — | — |
| 404 и общие ошибки | Нет custom error.vue; `LmsState.vue` внутри рабочих страниц | Любой пользователь: восстановить путь | Nuxt 404; API 401/403/404/409/429/offline; loading/empty/retry | ✓ | — | — | — | HTTP 404 |

## 3. Содержательные варианты

Города: `almaty`, `astana`, `shymkent`, `karaganda`, `atyrau`, `aktau`, `pavlodar`, `ust-kamenogorsk`, `kostanay`, `taraz`, `kyzylorda`, `aktobe`, `petropavlovsk`, `semey`, `uralsk`.

Базовые направления: `ohrana-truda`, `promyshlennaya-bezopasnost`, `ptm`, `elektrobezopasnost`, `raboty-na-vysote`, `gpm-stropalschiki`, `gazoopasnye-raboty`, `ekologicheskaya-bezopasnost`, `pervaya-pomoshch`.

Дополнительные направления на `/courses/:id`: `antiterroristicheskaya-podgotovka`, `soglasitelnaya-komissiya`, `protivodeystvie-korruptsii`, `seminar-dekretirovannoy-gruppy-sez`, `rassledovanie-proisshestviy`, `povedencheskiy-audit-bezopasnosti`, `upravlenie-stressom`, `kultura-bezopasnosti`, `iso-9001`, `iso-14001`, `menedzhment-ohrany-zdorovya`.

Статьи: `/blog/ohrana-truda-kazakhstan-2026`, `/blog/promyshlennaya-bezopasnost-kazakhstan-2026`, `/blog/pozharnyj-tekhnicheskiy-minimum`, `/blog/elektrobezopasnost-gruppy-dopuska-kazakhstan-2026`, `/blog/raboty-na-vysote-kazakhstan-2026`.

`content/public-city-content.ts` действительно содержит отдельный контекст планирования для каждого города: смены, вахты, удалённые объекты, доступ на площадку. Это условия планирования, не обещание существования 15 офисов. `content/cityCourseOverrides.ts` содержит шесть старых override-записей, но `rg` не обнаруживает их импортов в действующие components/composables; нельзя объявлять эти тексты текущим контентом. Проверять как минимум Алматы + Атырау/Актау + один длинный slug/казахское название.

Цена из публичного исходного прайс-листа (`PublicCoursePricing`) и цена опубликованной версии (`priceMinor`, `currency`, `billingBasis`) — разные контексты. Заказ должен показывать и отправлять именно выбранную версию. Если версий нет, маркетинговое направление остаётся доступным для обсуждения, но не превращается в назначенный курс.

## 4. API и права: контракты, которые сохраняет редизайн

Основной роутер: `server/api/v1/[...path].ts` → `server/handlers/core.ts` / `server/handlers/business.ts`. Авторизация Better Auth: `server/api/auth/[...all].ts`. В таблице префикс `/api/v1` опущен.

| Область | Методы и адреса | Существенный контракт |
|---|---|---|
| Публичная конфигурация | GET `/auth/config`, `/catalog/programs`, `/catalog/programs/:programId` | Только опубликованные версии; без БД каталог может вернуть consultation inventory; публичное DTO без ответов теста/текстов уроков |
| Заявки | POST `/api/amo-lead` (отдельный маршрут), POST `/leads` | Имя/телефон/email/организация/участники/context/consent; Idempotency-Key; подтверждение приёма не равно доставке в CRM; не отправлять реальные заявки в QA |
| Сессия | GET `/me`, `/me/enrollments` | Подтверждённая почта; cookie server session; текущая роль/отзыв прав читается на каждом защищённом запросе |
| Auth | POST `/api/auth/sign-in/email`, `/sign-up/email`, `/request-password-reset`, `/reset-password`, `/send-verification-email`, GET `/verify-email`, POST `/two-factor/verify-totp`, `/sign-out` | callbackURL/redirectTo; email config; TOTP; safe returnTo; никакого локального присвоения authenticated |
| Назначения | POST `/enrollments` `{versionId}` + Idempotency-Key; GET `/enrollments/:enrollmentId` | `programId` ≠ `versionId` ≠ `enrollmentId`; только сервер разрешает доступ |
| Уроки | GET `/enrollments/:id/lessons/:lessonId`; PUT `/enrollments/:id/progress/:lessonId` `{revision, completed:true}` | Владелец, доступ, revision; сервер возвращает подтверждённое назначение и прогресс; practice отмечает instructor |
| Проверка | POST `/enrollments/:id/attempts` + Idempotency-Key; GET `/attempts/:attemptId`; PUT `/attempts/:id/answers/:questionId` `{revision,selectedOptionIds}`; POST `/attempts/:id/submit` | Attempt принадлежит enrollment; deadline/serverTime; autosave conflicts; eligibility/limits/retake delay; балл рассчитывается сервером |
| Покупка | GET `/commerce/me`; POST `/orders` `{versionId}` + Idempotency-Key; GET `/orders/:id`; POST `/orders/:id/checkout` | Сервер фиксирует цену и статус. Sandbox/disabled, refund суммы; посещение URL не доказывает платёж |
| Подтверждение оплаты | POST `/payments/webhook` | Подписанный запрос провайдера; не вызывать для живых заказов ради визуальной проверки |
| Документ | GET `/credentials/:id`, `/credentials/:id/download`; публичный GET `/verify/:token` | Владелец скачивает issued + ready PDF; token-проверка без полного документа; revoked/superseded не маскировать |
| Организация | GET `/organizations`, `/organizations/:id`; POST `/:id/invitations`, `/invitations/accept`, `/:id/assignments`, `/:id/import/preview`, `/:id/import/commit`, `/:id/members/:userId/revoke`; GET `/:id/report.csv` | Membership owner/manager/member; explicit selected version/users; preview confirmation; pagination; актуальный CSV |
| Счета | GET/POST `/organizations/:id/invoices`; GET `/invoices/:id`, `/:id/download`; POST `/:id/cancel`; GET `/admin/invoices`; POST `/admin/invoices/:id/confirm` | Платёжные основания, сумма/валюта/референс, подтверждение финансов; disabled/sandbox не изображать как live payment |
| Напоминания | GET/POST `/me/learning-reminders`; GET `/me/learning-reminders/enrollments`; GET/POST `/me/reminder-preferences`; GET/POST `/organizations/:id/learning-reminders`; POST `/learning-reminders/:id/update`, `/:id/cancel` | Owner scope, timezone/date, подтверждение операций; отказ отменяет непрочитанные и будущие напоминания |
| Уведомления/согласия | GET `/me/notifications`; POST `/me/notifications/:id/read`; GET/POST `/me/consents`; analytics config/record/journey | Состояние на сервере; согласие отдельно от услуг; отсутствие аналитики не превращать в ноль |
| Роли и программы | GET `/admin/users`; POST `/admin/users/:id/role`; GET `/admin/program-versions`; POST `/admin/programs`, `/admin/program-versions`; PATCH `/admin/program-versions/:id`; POST `/:id/review`, `/:id/publish`, `/:id/intake`; GET `/admin/programs/:id/authoring-guide` | Роли, MFA, revision; автор не утверждает свою версию; опубликованные назначения остаются на своей версии |
| Staff обучение | POST `/admin/enrollments`, `/:id/activate`, `/:id/practice/:lessonId` | Instructor/admin, reason/evidence, проверка прав и оснований |
| Staff документы | GET/POST `/admin/credential-templates`; GET `/:id/preview`; POST `/:id/approve`; POST `/admin/credentials`, `/:id/repair`, `/:id/revoke`; GET/POST `/admin/credential-batches`, GET `/:id`, POST `/:id/commit` | Issuer/reviewer/admin; независимое утверждение; реальный PDF; preview expiry/change; confirmed batches |
| Staff работа | GET `/admin/operations`; POST `/admin/organizations`, `/admin/outbox/:id/retry`, `/admin/operations/tick`, `/admin/orders/:id/refund`; GET/POST support notes; GET/POST leads; GET analytics/incidents; POST incident transition | Не запускать рассылки/tick и финансовые изменения при UI QA. Причины/подтверждения остаются |

Роли приложения: `learner`, `editor`, `reviewer`, `instructor`, `issuer`, `finance`, `admin`. `assertRole` требует включённую MFA и подтверждение не старше 12 часов даже для admin. `requireUser` требует подтверждённую почту и текущую серверную сессию. Город, язык и формат — контекст интерфейса и заявки; они не меняют права, назначение или результаты.

## 5. Подтверждённые разрывы до правок

Ниже — наблюдения по текущему исходнику; пользовательская частота и конверсия не измерялись. Функциональные последствия, следующие из кода, помечены отдельно от визуальной оценки.

1. **Выбранная бесплатная версия теряется на входе.** `pages/courses/[id].vue`: select записывает только `selected` ref. `enroll()` при 401 передаёт `returnTo: route.fullPath`; выбранного versionId в URL может не быть. После возвращения selector снова вычисляет default. Исправление: синхронизировать явный выбор версии с query и формировать точный returnTo без гонки двух навигаций.
2. **Восстановление/верификация разрывает returnTo.** `LmsAuthForm.vue`: ссылки forgot и verify передают только path, а request-password-reset использует `redirectTo: path('/auth/reset')`. Вход/signup/MFA между собой destination сохраняют. Исправление: сохранить безопасный destination во всех ветках и callback.
3. **Возврат из оплаты теряет версию и условия.** `pages/payment/[courseId].vue`: `:back="'/courses/' + id"`; `LmsShell` получает только строку. После Back отсутствуют versionId/city/format. Контактные CTA оплаты также передают program без city/format или вообще только contacts.
4. **Прямой переход с SEO-страницы направления в программу теряет город/формат.** `CoursePage.vue` ссылка около строки 661 использует только `localePath('/courses/' + ...)`; соседние CTA подбора/консультации уже несут context. Исправление: один согласованный query для этого перехода.
5. **Выбор компании теряет выбранную версию.** `pages/courses/[id].vue` и payment organization CTA направляют в `/cabinet/organization` без versionId; сама корпоративная страница инициализирует `versionId = ref('')` и читает из query только invitation. Нужна синхронная правка отправителя и получателя.
6. **Национальный FormatLanding не учитывает query города.** CTA берёт только `resolvedCity?.slug`, а не query; для срочного/тендерного/продления формат записывается пустой строкой. Поскольку `fromQuery` не очищает cookie на пустых значениях, ранее выбранный формат может незаметно сохраниться. Нужно различить новую предпочтительную настройку и отсутствие изменения.
7. **Шапка города уводит из незаполненных contacts.** `CitySwitcher.vue` сохраняет страницу для courses/program-selection/learn/cabinet/payment/auth/b2b, но `contacts` не включён в список: переключение города на форме контактов уводит на `/:city`. Введённые поля не сохранены. На b2b query меняется без remount, но prefill применяется только при mount, поэтому видимый город формы не обновляется автоматически; правка не должна перетирать ручной ввод.
8. **Глава и следующее действие в уроке.** `pages/learn/[id]/index.vue` читает query.lesson один раз, но `openLesson` URL не обновляет. После полного ухода/возвращения открывается первый незавершённый урок, а не обязательно последний выбранный. После complete нет явной кнопки перехода к следующему уроку. Серверное завершение само по себе сохраняется корректно.
9. **Фильтры каталога теряются при возврате.** `pages/courses/index.vue`: search/direction — локальные ref с пустым default; не восстанавливаются из URL. Направление сравнивается с `p.id`, хотя справочник задаёт directionId. Пустое состояние предлагает другой запрос, но не содержит явного сброса. Нужны URL state, сопоставление с directionId и восстановление результата.
10. **Статус каталога может обещать запись при закрытом intake.** `availability === 'published'` выводит «Открыта запись», но catalog service определяет published по наличию версий, в том числе intakeOpen=false. Учитывать реальные открытые версии; не менять данные ради надписи.
11. **Обещание страницы аккредитации не соответствует содержимому.** `pages/licenses.vue` состоит только из h1 и description. В конфигурации есть реальный PDF `/documents/licenses/KZ07VEK00018551_ru.pdf` и preview, но страница их не выводит. HTTP title общий «OT Center». Не создавать выдуманные документы для двух null slots.
12. **Непрофильные экраны получают подпись каталога.** `LmsShell` сопоставляет surface по learn/cabinet/auth/payment/course; admin, verify, certificates, b2b, ui-kit получают fallback catalog и `EditorialContext` с городом/предпочтением. Это подтверждённое отсутствие отдельного режима оболочки; художественная оценка требует снимка.
13. **404 живёт вне системы.** Нет `error.vue`; HTTP неизвестного маршрута 404 без `__nuxt` обычной страницы. Создать спокойный доступный экран возврата, сохраняя статус 404 и локализацию.

## 6. Уже работающие контракты, которые следует удержать

- У старых `/categories` и `/wizard` сохраняется query; город валидируется middleware; `safeLmsReturnTo` ограничивает внутренние рабочие маршруты и отклоняет внешние/опасные значения.
- `preferredProgramVersion` учитывает явный ID, язык и формат. Несовпадение предпочтительного формата уже показывается notice. Нужна работа с сохранением выбора, а не замена серверной версии на направление.
- `LmsState` при 401 предлагает вход с полным returnTo. Ошибки имеют локализованное объяснение, retry; формы заявок не очищаются при ошибке.
- Урок использует optimistic revision и защищает подтверждённый save от устаревшего read; переносит фокус после явного выбора главы.
- Экзамен проверяет принадлежность attempt к enrollment; autosave сериализован; при revision conflict человек выбирает, какие ответы оставить; есть beforeunload/route leave для dirty; таймер учитывает serverTime; результат и expiry приходят с сервера.
- Результат success/failed в URL не подделывает итог; платежный статус зависит от записи заказа; документ скачивается только при issued и downloadAvailable.
- Staff формы сохраняют reason/evidence/confirmation, independent reviewer, preview до commit, отдельный warning sandbox; эти операционные условия не должны исчезнуть при упрощении дизайна.

## 7. Матрица последующей проверки

Публичные поверхности: `/`, menu open/search/empty, `/courses` normal/filtered/empty, `/program-selection` все четыре шага и unmatched, `/courses/ohrana-truda` consultation + isolated published variants, `/ohrana-truda`, `/almaty`, `/atyrau/promyshlennaya-bezopasnost`, `/aktau/vyezdnoe-obuchenie`, `/b2b`, `/contacts`, `/blog`, одна статья, `/licenses`, оба legal, `/ui-kit`, 404.

Закрытые поверхности: login/signup/forgot/reset missing-token/verify/MFA; checkout/pending без заказа + isolated order; cabinet empty/assigned; organization empty/member/manager и preview import; security/reminders; lesson text/media/practice/completed/save conflict; pre-test blocked/eligible/active; exam autosave/conflict/expired/pass/fail; document pending/issued/revoked; verification invalid/valid. Все девять административных route templates проверять отдельно, включая формы внутри index и program editor.

Для основных типов: 1440×900, 1280×720, 820×1180, 390×844, 360×800, RU и KK; размеры и состояние фиксировать рядом со снимком. Functional browser regression отдельно от visual review. Проверки по исходникам и HTTP в этом документе не являются пользовательским исследованием.

### Назначенное продолжение

После карты этому исполнителю поручены правки подтверждённых context-разрывов в `LmsAuthForm.vue`, `pages/payment/*`, `pages/courses/[id].vue`, `pages/courses/index.vue`. Общая оболочка и прочие поверхности изменяются главным исполнителем. Итог правок и проверки должны быть записаны отдельно от исходного аудита выше, чтобы не выдавать уже исправленные проблемы за текущие.
