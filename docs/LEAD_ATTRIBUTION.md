# Необязательный публичный путь и контекст принятой заявки

Реализация B48 от 8 сентября 2026 года дополняет восемь самостоятельных клиентских событий и одиннадцать серверных событий. Она не меняет их единицы и не превращает отношение двух популяций в конверсию. Новый путь — последовательность реально полученных сервером публичных шагов одной согласившейся вкладки. Связанный отчёт и явные служебные связи заявки с заказами/назначениями реализуются отдельным пакетом sales; этот документ не объявляет его проверенным.

Согласие обновлено до `analytics-v2` с явным объяснением sessionStorage, псевдонимного идентификатора, первого/последнего источника и CRM-примечания. Старое `analytics-v1` недостаточно. По умолчанию сбор выключен; необходимы `OT_ANALYTICS_ENABLED=1`, целое `OT_ANALYTICS_RETENTION_DAYS` в диапазоне 1–90 и действующий cookie отдельного согласия. Галочка согласия на обработку самой заявки не разрешает аналитику. Production-включение и политика обработки остаются отдельным решением владельца.

## Путь и контракт

`shared/lead-attribution.ts` содержит закрытые схемы. Новый `POST /api/v1/analytics/journey` принимает только `id`, `journeyId` (UUIDv4), `sequence` 1–64, `step` и `context`. Тип шага должен соответствовать типу маршрута. Контекст допускает только:

- `routeId`: home, catalog, program, city, city_program, contacts, b2b, selection, auth_login, auth_signup;
- `locale`: ru/kk; направление из реестра 20 программ; город из 15 существующих; формат online/classroom/onsite;
- `source`: direct/internal/search/social/email/other.

Реальные переходы на существующие публичные маршруты наблюдает `plugins/lead-attribution.client.ts`. Главная/каталог/город дают landing, карточка программы — program, контакты/B2B — consultation. Приватные, неизвестные адреса, privacy и сам выбор согласия не становятся выдуманным landing. Query программы не может подменить программу открытой карточки. Из UTM/referrer выводится только разрешённая категория; произвольные кампании, запросы поиска, адреса, query, фрагменты и тексты не сохраняются. Это ограниченная классификация источника, не измерение рекламных кампаний или поисковых запросов.

Последнее ограниченное дополнение того же неопубликованного v2-пакета добавляет action-only шаги `selection_start`, `selection_matched`, `selection_unmatched`, `auth_start`, не меняя восемь прежних client event names. Начало подбора связано с реальным изменением/переходом; matched/unmatched — с фактическим ответом API опубликованных версий, фильтром языка/формата/открытого набора. Ошибка API не создаёт unmatched. Просто открытый URL выбора не считается результатом. Вход/регистрация отмечают auth_start только при submit; auth context содержит исключительно фиксированный routeId, locale и source=internal. ReturnTo, email, password и прочие поля формы отсутствуют в этом контракте.

`POST /api/v1/analytics/journey/authenticated` принимает только `{ journeyId }`. После schema/feature/v2-consent gate он вызывает реальную проверку verified session; при включённой MFA требует актуальное подтверждение. Только затем записывает первый `public_journeys.auth_confirmed_at`, если уже существует принятый auth_start. Повтор сохраняет первое время. Обычный endpoint шагов не принимает auth_confirmed. В путь не записывается account ID; это проверка факта успешной серверной аутентификации, не автоматическое связывание человека со всеми вкладками. Регистрация с неподтверждённой почтой не даёт auth confirmation. UI вызывает optional confirmation после действительного SDK success/последнего MFA; навигация не ждёт аналитики. Браузерная очередь старается сначала доставить auth_start; пропущенная отправка может дать неполное наблюдение. Метрики «начат без подтверждения на момент отчёта» не устанавливают уход, причину отказа или UX-ошибку.

Идентификатор случайный, создаётся после согласия и не использует аккаунт, email, IP или fingerprint для сопоставления. До согласия нет чтения/записи состояния пути и запросов конфигурации со стороны обычной публичной навигации; очистка собственного ключа при отказе допустима. SessionStorage хранит лишь проверенный контекст и ограниченную очередь. До 20 запросов ожидают отправки, до 64 шагов входят в один путь; после 24 часов путь недействителен и следующее взаимодействие создаёт новый. Неудачная отправка повторяется ровно один раз с тем же event ID/sequence, затем может быть потеряна: отчёт учитывает только серверный приём.

При обычной перезагрузке вкладка восстанавливает свой путь. BroadcastChannel после согласия проверяет активную копию идентификатора при открытии вкладки со скопированным sessionStorage: копия начинает новый путь. Если локальный канал недоступен, восстановленная копия сбрасывается, чтобы не объединять вкладки. Это best-effort разделение активных вкладок, не постоянный идентификатор человека или межустройственное отслеживание. При недоступном storage остаётся только память страницы. Отзыв прерывает текущий запрос, удаляет очередь/состояние, прекращает новые отправки; предыдущие посещения до согласия не восстанавливаются.

## SQL и принятие заявки

Миграция `011-lead-attribution.sql` добавляет только новые таблицы:

| Таблица | Назначение |
| --- | --- |
| public_journeys | UUID, версия согласия, время первого/последнего серверного приёма, фиксированный срок хранения и nullable server-only auth_confirmed_at |
| public_journey_steps | UUID события, FK пути, sequence, тип, закрытый context JSON, серверное время; UNIQUE(journey_id, sequence) |
| lead_attributions | FK заявки, nullable FK пути, last_sequence, first/last context JSON, версия согласия, время принятия заявки и expires_at |

Приём шага и дедупликация выполняются транзакционно. Клиент не задаёт timestamp. Конфликт содержимого с существующим событием/sequence отклоняется; malformed поля отклоняются даже при выключенном сборе. При выключенной функции или отсутствии v2 согласия limiter и запись SQL не выполняются.

Обе формы передают необязательный `attribution: { journeyId }` после вычисления прежнего business fingerprint. `/api/amo-lead` и `/api/v1/leads` передают серверному сервису cookie; boolean из формы не является основанием. Основная транзакция сначала фиксирует заявку, service consent, обязательный audit и CRM outbox. Только при первом успешном принятии отдельная транзакция пытается записать sidecar. Она читает уже принятые шаги с `created_at <= lead_submissions.created_at`; `last_sequence` и время sidecar фиксируют этот срез. Ошибка записи выдаёт только безопасный `telemetry_write_failed`, не отменяя принятие заявки. Возможна заявка без attribution, что не скрывается как успешная запись аналитики.

Неизменённый business payload с тем же ключом возвращает прежнюю заявку даже после удаления/изменения attribution. Повтор не перезаписывает sidecar и не делает backfill после первоначального отказа, отсутствия consent, неизвестного пути или ошибки SQL. Для связанной воронки нужно использовать последовательность landing < program < consultation и одновременно ограничивать шаги `sequence <= last_sequence` и временем принятия; более поздние шаги не могут завершить предшествующую цепочку задним числом.

В существующее идемпотентное CRM-примечание добавляются только повторно проверенные first/last context JSON. Journey UUID и произвольные данные туда не копируются. Ранее подтверждённое примечание не переписывается. Ошибка чтения optional sidecar не ломает доставку основного обращения. Реальная внешняя CRM не вызывалась. Привязка к заявке псевдонимна, не анонимна; последующая явная служебная связь заявки может связать путь с исполнением обращения.

Sidecar следует после business commit. При отказе его записи или если независимый worker успевает создать примечание раньше, CRM-примечание может остаться без optional контекста. Это сознательная best-effort граница: доставка обращения не удерживается из-за аналитики, уже подтверждённое примечание не дублируется и не переписывается. Нельзя считать отсутствие optional контекста доказательством другого источника.

## Срок хранения и границы

`expireLeadAttribution()` удаляет просроченные sidecar и пути по индексам `expires_at`, максимум 250 строк каждого вида за один проход, до 10 проходов с проверкой общего трёхсекундного бюджета между ними. FK удаляет только optional шаги или обнуляет optional ссылку. Заявки, согласия на их обработку, audit, outbox, заказы и учебная история сохраняются. Operational tick вызывает очистку даже после выключения сбора. Задание требуется реально запускать; его local реализация не доказывает production scheduling. Сокращение настройки ограничивает срок новых записей; существующий срок хранится в `expires_at`. Истёкший sidecar не добавляется в CRM даже до очередного cleanup.

Отзыв прекращает новую браузерную передачу, но не заявляет автоматическое удаление принятой заявки или уже переданного CRM-примечания. У внешней CRM собственный срок/процедура удаления; это должно учитываться владельцем при включении функции.

## Фактически выполненные проверки

```text
node --import tsx --test tests/lead-attribution.test.ts tests/public-journey-client.test.ts tests/crm-response-integrity.test.ts
30 tests, 30 passed, 0 failed/cancelled/skipped; exit 0; 19918.4524 ms
artifacts/lead-attribution-focused.log

После уточнения клиентского expiry reference и plugin lifecycle:
node --import tsx --test tests/public-journey-client.test.ts
7 tests, 7 passed, 0 failed/skipped; exit 0; 537.2934 ms

node --check tests/lead-attribution-browser.mjs
exit 0

Focused ESLint: все изменённые attribution/shared/server/client/form/privacy файлы и новые тесты
exit 0
```

Состав: девять новых серверных тестов с настоящей isolated libSQL, семь клиентских тестов очереди/storage и четырнадцать существующих CRM integrity. Проверены v1/нет consent/default-off без limiter/SQL, строгая схема/UUIDv4, конфликт и параллельный retry, server timestamps/cutoff, first-accept/revoke/replay, реальный trigger SQL failure с сохранением заявки/audit/outbox, безопасный note и восстановление потерянного ответа без второго POST, expiry при feature-off без удаления business data, очереди 20/64, восстановление/24h и очистка.

`tests/lead-attribution-browser.mjs` копирует завершённый artifact в собственную `.data/lead-attribution-analytics-browser-UUID`, переиспользует guarded synthetic content fixture, поднимает только свой порт 3111 сначала с collection=0, затем collection=1. Проверяет реальные public UI шаги и форму, один настоящий local accepted lead, snapshot через read-only SQL, HTTP replay, v1/отсутствие consent, opener-copy/BroadcastChannel, отзыв KK360 и canaries. CRM/SMTP/payments отключены; внешние браузерные запросы блокируются. На этапе focused tests compiled прогон ещё не выполнялся; его фактические результаты и исправления описаны ниже. Сборку Nuxt и полный suite координирует основной исполнитель.

Финальный focused run после selection/auth дополнения:

```text
node --import tsx --test tests/lead-attribution.test.ts tests/public-journey-client.test.ts tests/crm-response-integrity.test.ts
33 tests, 33 passed, 0 failed/cancelled/skipped; exit 0; 19644.1872 ms
artifacts/lead-attribution-focused-final.log
```

Это 11 серверных, 8 клиентских и прежние 14 CRM integrity тестов. Добавлено: отдельные selection action outcomes с дедупликацией без потери разных результатов, запрет client auth_confirmed, enabled/consent gate перед resolver/limiter, отсутствие/просроченность MFA, отсутствие auth_start, серверное время подтверждения, неизменный timestamp при повторе и отсутствие account identity в строке пути. Финальный `node --check tests/lead-attribution-browser.mjs` и focused ESLint, включая новый authenticated endpoint, завершились exit 0.

Compiled harness также включает действительный wizard API: RU matched и KK unmatched на synthetic RU-only inventory, затем wrong-password, неподтверждённый запрос нового endpoint и настоящий verified-session sign-in. Он проверяет auth-confirmation SQL без сохранения идентификатора/контакта аккаунта. Предыдущие локальные 20/20 analytics относятся к более ранним артефактам и не подменяют эти отдельные сценарии.

## Первый compiled прогон: обнаружена ошибка plugin context

Артефакт Node `f7dac4e1-3aef-47f8-80fb-a0e0728369ff` был скопирован в собственную `.data/lead-attribution-analytics-browser-5cd342a4-8135-4a69-9a00-8390e46bc62f/.output`; использовались только новая synthetic DB и порт 3111. Прогон завершился с **exit 1**, `2026-09-08T04:33:09.708Z`. Отчёт: `artifacts/lead-attribution-browser/5cd342a4-8135-4a69-9a00-8390e46bc62f/report.json`; лог: `implementation-b48-attribution-browser.log`. Единственный PNG `failure.png` просмотрен в исходном разрешении: экран Nuxt 500, Internal Server Error, код 26. Ошибок `pageerror` не было: это обработанный глобальный экран Nuxt, который один этот счётчик не обнаруживает.

Установленный `vue-i18n/dist/vue-i18n.mjs` определяет код 26 как `MUST_BE_CALL_SETUP_TOP`. Новый Nuxt plugin вызывал `useLmsAnalytics`, а тот — Vue `useI18n` без component setup instance. Три предварительных проверки нулевого сбора в JSON не принимаются как доказательство здорового приложения: отсутствие запросов могло сопровождать неработающую инициализацию. В browser helper добавлены обязательные проверки шапки, отсутствия error h1 404/500 и текста Internal Server Error после обнаружения Vue app.

После уведомления основного исполнителя Vercel-сборка остановлена. Узкое исправление сохраняет `useI18n().locale` в component setup, а в plugin использует реактивный `computed(() => unref(app.$i18n.locale))`; plugin явно зависит от настоящего имени `i18n:plugin`. Установленный Nuxt i18n экспортирует глобальный composer через `$i18n`, а generated type определяет его как `Composer`. Проверены эти локальные источники, focused ESLint двух runtime-файлов и browser harness, а также `node --check` — exit 0. Nuxt build/typecheck не запускались этим исполнителем. Исправление ещё ожидает общей пересборки и полного повторного actual3111 прогона; успешный runtime результат этому артефакту не приписывается.

## Второй compiled прогон: повтор одинакового landing-контекста

Node `ca44595e-5d1e-4dce-93c9-ddffe8f20579`, собственная копия/DB `.data/lead-attribution-analytics-browser-cf3bd869-0cfc-44e8-bec8-f33d57c5ddce`, порт 3111: exit 1, завершён `2026-09-08T04:42:28.166Z`. Отчёт `artifacts/lead-attribution-browser/cf3bd869-0cfc-44e8-bec8-f33d57c5ddce/report.json`, лог `implementation-b48-attribution-browser-ca44595e.log`. Строгие healthy-page проверки прошли, первые три сценария default-off/no-consent/v1 прошли, `pageerror` — 0. Единственный `failure.png` просмотрен в исходном разрешении: корректная мобильная страница контактов, прежнего Nuxt 500 нет.

Настоящий путь создал четыре SQL-записи: home/direct, home/internal спустя 65 мс, program/internal, contacts/internal. Повторная реакция маршрута меняла только source, поэтому прежняя дедупликация всего JSON ошибочно добавляла шаг. Проверка требуемых трёх стадий не ослаблена. После согласования исправлен только client tracker: сравниваются типизированные step, routeId, locale, programId, city и format, сохраняется первый source одинакового контекста. Настоящий переход/возврат и разные явные action steps остаются различимыми.

Новый focused regression проверяет source-only повтор, сохранение direct, переход к программе и возврат домой; все **9/9** client tests прошли, exit 0, лог `artifacts/lead-attribution-client-dedupe.log`. Focused ESLint tracker/test — exit 0. Полный compiled пилот после исправления ожидает новой сборки; этому промежуточному артефакту успешное завершение всего пути не приписывается.

Дальнейшее чтение установленного Nuxt router подтвердило особенность prerender hydration: настоящий URL с query временно заменяется `payload.path`, затем восстанавливается через `app:suspense:resolve`. Поэтому optional plugin запускает watcher через официальный `onNuxtReady`, который ждёт окончания hydration и idle callback, чтобы первый touch уже содержал разрешённую source category настоящего URL. В harness усилен hard-navigation сценарий: `utm_medium=email` обязан дать `source=email`, а произвольные query/campaign canaries по-прежнему не попадают в события. Scoped ESLint plugin/harness и `node --check` после этой узкой правки — exit 0. Промежуточный Node `6b422cf2` не использовался для нового QA из-за известного риска timing до этой правки; успешного результата ему не приписано.

## Успешный actual3111 на исправленной сборке

Node **`daf1207c-adcc-4623-85da-2271911d6fe4`**, отдельная копия и synthetic DB `.data/lead-attribution-analytics-browser-4182ecdc-8665-486c-bb41-85dcd201c529`: **10/10 PASS, exit 0**, завершён **2026-09-08T05:00:35.846Z**. Отчёт `artifacts/lead-attribution-browser/4182ecdc-8665-486c-bb41-85dcd201c529/report.json`, лог `implementation-b48-attribution-browser-daf1207c-retry.log`. `pageerror` — 0; за весь сценарий получено 9 journey POST. Заблокировано 36 внешних браузерных запросов; реальных CRM, SMTP, платёжных обращений и production данных не было. Собственный процесс 3111 завершён harness.

Проверены все десять заявленных checkpoints: отсутствие collection/storage/SQL при default-off, без согласия и при v1; фактический RU opt-in; hard URL `utm_medium=email` → first source=email → программа → консультация ровно тремя последовательными шагами; настоящая отправка формы контактов с единственной принятой заявкой и first/last sidecar; HTTP replay того же business key без optional metadata без изменения sidecar; opener-copy/BroadcastChannel с двумя разными путями вкладок; реальный KK withdrawal с очисткой и остановкой последующих запросов; действительные RU matched/KK unmatched результаты API подбора на synthetic RU-only каталоге; wrong-password и unauthenticated подтверждение без auth timestamp, затем настоящий verified-session вход с серверным timestamp без account identity; отсутствие private form/query canaries в journey контексте и ошибок JS.

Оба PNG этого успешного прогона просмотрены в исходном разрешении: `ru-accepted-360.png` показывает локализованное сообщение о принятии заявки и очищенную форму, `kk-withdraw-360.png` — выключенную статистику, действия повторного согласия/отказа и описание v2 на казахском. В исходных разделах privacy сохранён ранее существовавший русский текст; этот прогон подтверждает локализацию нового consent блока, а не полный перевод всей политики. Проверка screen reader не выполнялась.

Первый запуск этого же Node (`c6c029d1-5673-48ac-8cbf-0e1e91963983`) остановился после 5 PASS из-за ошибки самого poll: ожидание пыталось прочитать `journeyId` из null в нормальном окне очистки унаследованного sessionStorage. Runtime не менялся. Harness теперь ждёт одновременно наличие state, положительную sequence и отличный journey ID; строгая проверка двух SQL journeys сохранена. Оба PNG промежуточного запуска также просмотрены. Исправленный poll дал приведённый выше полный PASS.

Это локальное доказательство compiled интерфейса, собственных API и SQLite/libSQL на синтетических данных. Оно не доказывает реальные CRM credentials/delivery, scheduling retention, production браузерную телеметрию, field CWV, CPA или конверсию уникальных людей. Сбор по умолчанию выключен; внешний режим требует настроенной политики владельца.

Дополнительный уже запущенный повтор на том же неизменном Node, с явным ожиданием `$nuxt.isHydrating === false` в helper, также завершился **10/10 PASS, exit 0**, JS errors 0: `artifacts/lead-attribution-browser/c08f1780-1043-4b07-8d78-58393bdd446e/report.json`, лог `implementation-b48-attribution-browser-daf1207c-hydrated.log`. Его RU accepted и KK withdrawal PNG также просмотрены; содержание и результат совпадают. Новые серверы или сценарии после этого не запускались этим исполнителем.
