# Интеграционная проверка бизнес-логики — 2026-09-07

`tests/business-integration.test.ts` выполняет настоящие операции сервисов на отдельной временной libSQL БД с применением всех миграций. Фикстуры не загружаются в приложение: имена, программа и PDF явно помечены `ISOLATED TEST`, `NOT TRAINING CONTENT`, `NO VALIDITY`. Для получения завершённого учебного состояния тест вызывает публикацию с независимым reviewer, зачисление, завершение обязательного материала и серверный экзамен. PDF действительно формируется и повторно читается через pdf-lib.

HTTP-транспорт CRM заменён управляемой тестовой функцией. Сетевые запросы в настоящую CRM, реальные платежи и внешние уведомления эта проверка не выполняет. Подписанные события относятся только к sandbox-провайдеру. Тест запускается отдельно от dev/build и не использует production-БД.

## Фактически запущено

```powershell
node --import tsx --test --test-reporter=tap --test-timeout=30000 tests/business-integration.test.ts tests/public-content.test.ts
```

Итог после исправлений: **24 tests, 24 pass, 0 fail, 0 skipped, exit 0** — 22 business-сценария + 2 public-content теста, длительность 13,5 секунды в Windows. Проверка дубликатов включает 100 доставок одного webhook: первые две одновременно, ещё 98 — повторно; это не измерение нагрузки из 100 одновременных запросов.

ESLint всех изменённых в этой части публичных компонентов, маршрутов, SEO-скриптов, приватного response plugin и `tests/business-integration.test.ts` завершился с exit 0. `npm run typecheck` после исправления явного сужения union ответа заявки и проверок существования элементов массивов завершился с exit 0; строгие проверки TypeScript не отключались.

## Покрытие и границы доказательства

| Acceptance из handoff | Подтверждено сервисными тестами | Что этим не подтверждается |
|---|---|---|
| T048–T050 | Цена/валюта берутся из опубликованной версии; поддельные поля отклоняются; заказ привязан к владельцу и телу idempotency key | Контракт реального платёжного провайдера |
| T051–T055 | Checkout оставляет pending без фиктивного URL оплаты; HMAC, timestamp, merchant, amount, event identity проверяются; 100 доставок создают одно зачисление/уведомление; поздние pending/failed не откатывают succeeded | Работа реального checkout UI, сверка с банком и production webhook |
| T057 | Повтор sandbox refund идемпотентен, академическая запись сохраняется | Реальный возврат средств |
| T058–T064 | Оплата без обучения не разрешает документ; одновременная выдача резервирует один номер; pending не скачивается/не проверяется публично; реальный тестовый PDF доступен владельцу; unicode/font ошибка сохраняет pending; отзыв блокирует поздний render; перевыпуск меняет номер, исходный становится superseded; public DTO не содержит имени/email | Человеческая приёмка шаблона и реального учебного содержимого; HTTP rate limit; размещение production-хранилища; успешное восстановление PDF после каждой возможной ошибки worker |
| T065–T068 | Заявка и согласия сохраняются до CRM; повтор не дублирует; organizationName не honeypot; note failure сохраняет внешний lead ID; потерянный create response восстанавливается по correlation marker | Авторизованная доставка в настоящую amoCRM и её права/API-настройки |
| T070–T073 | Preview без отправки/массовых эффектов; дубли, формулы, невалидный email, malformed quote и лимит 500 строк; commit идемпотентен; cross-org доступ закрыт; bulk assignment атомарен; CSV экранирует формулы | Ручная приёмка интерфейса пустой организации и доступность для screen reader |
| T075, T077 | Lease предотвращает двойной обработчик; delivered job нельзя повторить; failure остаётся retryable; отзыв marketing consent отменяет очередь marketing; browser analytics не может принять purchase/grade/PII | Внешнее оповещение владельца и production monitoring |

Дополнительно проверены: verified email при принятии приглашения; одноразовый токен; запрет назначения manager другим manager; отзыв доступа; запрет самоустранения владельца; повторное приглашение отозванного manager как member не восстанавливает прежние права; sandbox заблокирован при production Node/Vercel; UTF-8 секрет не вызывает исключение при сравнении.

Последние регрессии: даже при `processOutbox({allowExternal:true})` нулевые `OT_CRM_DELIVERY_ENABLED` / `OT_EMAIL_DELIVERY_ENABLED` не вызывают ни `fetch`, ни создание SMTP transport (spy call count 0, заявки остаются accepted). Operations overview отклоняет learner и staff без session MFA; finance получает только orders, instructor — enrollments, issuer — credentials/templates/enrollments, reviewer — templates, editor не получает операционные массивы; admin получает полную сводку. Это сервисное ACL-доказательство, отдельно от HTTP сессий.

## Сопоставление backlog — области этого исполнителя

Это не полная release-матрица и не объявление всей строки backlog завершённой. Основной исполнитель ведёт объединённый `IMPLEMENTATION_STATUS.md`.

| Backlog | Изменение / проверка | Acceptance и состояние |
|---|---|---|
| B04, B07, B08 | `config/public-route-policy.js`, единый `pages/[city]/[slug].vue`, удалены competing dynamic routes; неизвестные сущности не перенаправляются | T005–T007: whitelist/resolver unit pass; собранный HTTP проверяет национальные, городские, format URL и 6 настоящих 404 |
| B05 | Один inventory для prerender/sitemap; закрытые roots в обеих локалях не кешируются; `server/plugins/private-response.ts` ставит заголовки после final error response | T011: 528 HTML build pass, закрытых index.html нет; T012: sitemap 528 URLs pass; T016: 10 private HTTP no-store/noindex pass. T017 CDN с двумя аккаунтами этим не проверен |
| B10, B11 | API установленной SEO/i18n версии, один locale head, очищенный sitemap, статический OG, сохранён исходный host; исследование security dependencies | T013–T015: 36 public SSR head и robots pass; T019: фактический production non-www→www 307 записан, согласование конечного canonical origin остаётся отдельным решением |
| B09, B12, B22 | `CoursePage`, `FormatLanding`, `SeoUniqueBlocks`, default/fullwidth; публичные CTA через registry/localePath, локализован footer, сохранены shell и HomePageClassic | Developer-copy удалён, все 9 направлений сохраняются; T008/T031 полный browser flow подтверждается отдельным UI отчётом, не unit-тестом ссылок |
| B45, B46 | `content/public-city-content.ts`, `content/direction-details.js`, `config/formats.js`; полезные RU/KK темы/аудитории, city planning, конкретные FAQ; нет random keyword filler или выдуманных LocalBusiness | T018: content unit 2/2 и HTML assertion pass; содержимое публичной карточки не превращено в утверждённые учебные материалы. SME/KK human review B47 не выдаётся за автоматическую проверку |
| B03, B49 | Точечная поправка default header на 360px: несжимаемый логотип и перенос контролов; светлые footer links с focus outline | UI выявил дефект на реальном Chrome screenshot. Поправка сделана после первого успешного production-like build; финальная пересборка/визуальная проверка отмечаются основным исполнителем отдельно |
| B17, B40 | Тесты ownership, tenant boundaries, invitation verification/replay/revocation, восстановление роли; operations arrays по staff role/MFA | T023/T024 в пределах order/PDF/org service pass; invitation и operations negative ACL pass; HTTP/auth часть в отдельных тестах |
| B19, B20, B21 | Тесты durable заявки, idempotency, CRM correlation/note retry, organizationName, явные external delivery gates | T065–T068 service pass; входные HTTP size/proxy/rate-limit T069 не покрыты этой suite |
| B32, B33, B34 | Тесты snapshot/strict schema/idempotency, signed sandbox event/races/replay100, поздние события и sandbox refund | T048–T055/T057 service pass; B34 provider reconciliation/invoice и T056 остаются отдельной provider-интеграцией |
| B36, B37, B38 | Тесты eligibility, pending reservation, настоящий test PDF, compressed active PDF rejection, owner-only download, minimal verification, revoke/supersede | T058/T059/T061/T064 service pass; T060 частично (ошибка/pending/запрет выдачи после отзыва); T062 minimal DTO и private headers pass, реальный approved QR/PDF требует шаблона; T063 HTTP limiter отдельно |
| B41, B42 | Тесты CSV preview/commit, row validation/formula, dedupe/atomic assignment, tenant report | T070/T071/T073 service pass; T072 и human export/UI приёмка отдельно |
| B43, B44, B48 | Тесты outbox lease/retry, запрет delivered replay, staff ACL, consent withdrawal, browser event schema/PII rejection | T075/T077 service pass в пределах перечисленного; T076 production log sampling и T081 внешний alert не заявлены |

Проверки SEO на собранном сервере `http://127.0.0.1:3101`:

```powershell
node scripts/seo-http-check.mjs http://127.0.0.1:3101
# exit 0: 58 public, 10 private, 6 real 404 routes; 550 sitemap URLs
node scripts/seo-build-check.mjs
# exit 0: 550 public HTML pages; 550 generated index files, no private route
node --import tsx --test tests/source-products.test.ts tests/public-route-policy.test.mjs tests/public-content.test.ts
# exit 0: 12/12
```

Последний HTTP report от 13:29 UTC сохранён в `artifacts/seo/http-contract-report-6fba2fcb.json`; актуальный путь скрипта — `artifacts/seo/http-contract-report.json`, вне очищаемой `.output`. Эти SEO проверки не изменяли БД и выполнялись одновременно с отдельной UI проверкой на изолированных пользователях. Публичный inventory расширен на 22 RU/KK карточки после анализа 16 предложений PDF; исходные 528 адресов сохранены. Источник и границы содержания — `docs/PDF-CONTENT-AUDIT.md`.

Промежуточная visual/a11y проверка Node build `6fba2fcb` прошла 52 responsive страницы, 8 сравнений HomePageClassic, 6 CSS zoom и 2 keyboard/name/error сценария, без ошибок. Отдельный asset gate выявил смешанные build ID и отсутствующие ресурсы первой Vercel-сборки: head-only pass не является готовностью к публикации. Подробные результаты и статус повторного cold build — `docs/SEO-POLICY.md` и `docs/VISUAL-ACCESSIBILITY-QA.md`.

После исправления очистки generated outputs чистый Vercel `34a99837` прошёл 550 SEO страниц и все 15 770 asset/payload ссылок, с одним build ID и отсутствующих 0. Финальный Node `6aa9fbb6` повторно прошёл HTTP **58/10/6, sitemap 550**, ту же asset-проверку и visual/a11y **52/8/6/2, failures 0**. Отдельные snapshot reports содержат соответствующий короткий build ID в имени файла/папки; предыдущая ошибочная Vercel-сборка к публикации не принимается.

Полный T005 дополнительно подтверждён последующим `seo-http-check --all`: **550/550 HTTP public страниц, 10 private, 6 true 404, sitemap 550**, exit 0 на `6aa9fbb6`; `artifacts/seo/http-contract-all-report-6aa9fbb6.json`. Локальный performance report обновлён исключительно финальными цифрами: полевая INP не измерялась; terminal exam view имеет известное ограничение CLS 0.18 и не объявлен прошедшим CWV-порог (`docs/PERFORMANCE_LOCAL_LAB_2026-09-07.md`).

## Найденные и исправленные регрессии

1. **Неоднозначный API route.** Два catch-all файла на одном `/api/v1/**` заменены единым dispatcher и отдельными core/business handlers. Исправление основного исполнителя; HTTP-подтверждение относится к отдельной проверке собранного приложения.
2. **Активный PDF в сжатом объекте страницы.** Проверка сырого PDF-текста пропускала `AA` с JavaScript внутри compressed object stream. Теперь обходятся декодированные словари/массивы/stream dictionaries. Отрицательная фикстура с безвредным `void(0)` отвергается. Исправление основного исполнителя.
3. **Неявное production окружение.** Sandbox мог разрешаться при `NODE_ENV=production` без `OT_APP_ENV`. Добавлен production default и безусловный запрет при `VERCEL_ENV=production`. Исправление основного исполнителя.
4. **Сравнение UTF-8 секрета.** Равная длина JS строк не означает равную длину Buffer; проверка Buffer length исключает RangeError. Исправление основного исполнителя.
5. **Восстановление отозванной роли.** Повторное member-приглашение отозванного manager прежде возвращало старую manager роль. Теперь применяется разрешённая роль нового приглашения с отдельной защитой владельца. Исправление основного исполнителя.
6. **libSQL 0.18 local pool.** После параллельного чтения commerce/organization overview следующая запись завершалась `SQLITE_BUSY: cannot commit transaction - SQL statements in progress` либо `database is locked`. DB-исполнитель ограничил локальный клиент поддерживаемым `concurrency:1` и повтором только получения транзакции при `TRANSACTION_ACTIVE`. Удалённая конфигурация не ограничена этой настройкой; callback/неопределённый COMMIT не переигрываются. Регрессия сохранена: после overview выполняется новая транзакция, также проходит последующая запись после org report.

Полный тест до исправления local pool падал каскадом; такие результаты не считались успешными. Итоговая зелёная проверка не заменяет HTTP/auth, build, визуальную приёмку, backup/restore drill и отдельные release gates. Подтверждённые владельцем разрешения организации повторно не исследовались.
