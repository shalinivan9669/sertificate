# T076: проверка локальных runtime logs и ошибочных HTTP ответов

Сценарий исходного handoff T076 требует просмотреть analytics/log samples и проверить отсутствие ФИО/контактов, ответов, verification tokens и session secrets. Это отдельная проверка фактического runtime; unit-тест сериализатора или поиск текста в bundle её не заменяют.

## Статус

**Локальный compiled-runtime прогон завершился 28/28, exit 0**, 2026-09-07 17:03:09 UTC, за 36,841 секунды. Проверен Node artifact `c4d9bf39-890d-4f44-8562-0075ce696d08`, миграции `001`–`010`, отдельная копия приложения и новая синтетическая БД. Итоговый отчёт: `artifacts/privacy-runtime/6d6e3e21-a4e0-492b-a73e-d3157667271b/report.json` (ignored). Собственные процессы приложения и Chrome завершены.

| Фактическая проверка | Результат |
| --- | --- |
| Выбранные ошибочные HTTP-ответы | 15; каждый имеет безопасный request ID и соответствующую JSON-запись runtime |
| Счётчики | `api_error=15`, `autosave_failure=2` |
| Все собранные runtime logs | 17 JSON records: `api_failure`, `outbox_delivered`, `outbox_failed`; 11 полей закрытой схемы; 0 неожиданных неструктурированных строк; stderr пуст |
| Контрольные данные | 14 категорий; 0 совпадений в stdout/stderr и выбранных отрицательных HTTP-ответах |
| Корреляция | Сгенерированные сервером UUID; подложные headers игнорируются; два параллельных ошибочных запроса изолированы; HTTP → audit/outbox → worker связан с исходным запросом |
| Analytics disabled | Корректный запрос даже с consent-cookie не создаёт событие; PII dimensions отклоняются 400 и при выключенной функции; реальные domain transitions при disabled не создают analytics rows |
| Browser consent | Обычные страницы до opt-in не отправляют клиентские events; реальный `program_view` после opt-in принят; повтор того же UUID хранится один раз; после отзыва согласия отправка прекращается |
| Server analytics | Реально принятая синтетическая заявка даёт одно `lead_accepted`; повтор idempotency key не дублирует событие; контакты, комментарий и неизвестный city не входят в dimensions |

Первый прогон на `cb3895e4-c572-4c0d-8891-2345381742f4` завершился 25 passed / 1 failure (`artifacts/privacy-runtime/cf3ddcba-3580-4245-b423-a982952ebf88/report.json`). Он выявил настоящий пробел: неверный пароль возвращал HTTP 401, но не попадал в `api_failure`/`api_error`, поскольку H3 наблюдал статус event до разворачивания SDK Web Response. Исправление в `runWithRequestObservation` переносит фактический `Response.status` в event и сохраняет исходный Response, cookies и body. Строгая проверка 401 сохранена и прошла на итоговой сборке. В итоговый сценарий также добавлен отдельный PII-rejection при выключенной аналитике.

`node --check` и focused ESLint скрипта прошли. Отдельный положительный браузерный прогон UI-исполнителя проверил восемь клиентских analytics events: `artifacts/analytics-browser/2bd3d1af-f545-4e05-bfa5-550b22aafd59/report.json`, 16/16, тот же build ID. Он не заменяет проверку ошибочных ответов и runtime logs.

## Границы и повторение

```powershell
$env:NODE_ENV = 'test'
$env:OT_ALLOW_PRIVACY_AUDIT = '1'
$env:BROWSER_PATH = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
node scripts/runtime-privacy-audit.mjs 'C:/path/to/completed/app-output'
```

Для Linux CI с уже установленным Playwright Chromium: `NODE_ENV=test OT_ALLOW_PRIVACY_AUDIT=1 node scripts/runtime-privacy-audit.mjs .output`. `BROWSER_PATH` необязателен; по умолчанию используется `chromium.executablePath()`. Локальный полный прогон занял менее минуты; CI всё равно должен задавать собственный timeout и загружать только redacted report из `artifacts/privacy-runtime/**/report.json`, а не `.data`.

Скрипт принимает только каталог готового Node artifact. Он создаёт новую директорию `.data/privacy-runtime-*`, копирует artifact без изменения источника, резервирует новый `e2e.sqlite`, копирует миграции и запускает собственный процесс на `127.0.0.1:3108`. Если порт занят, запуск прекращается. Ни `.data/e2e.sqlite`, ни общие `.output`/`.vercel`, ни production/remote БД не используются. Nuxt build/prepare не запускается.

Фикстура содержит только синтетические записи. Новый пароль, session secret, CRON secret и контрольные строки создаются для одного прогона. Email/CRM/operational delivery и платежи отключены. SMTP, AMO, Turso и Vercel окружения не переносятся. Старые процессы не останавливаются. Сырые stdout/stderr, ошибочные сетевые ответы и диагностика остаются внутри ignored `.data`; публичный отчёт содержит только статусы, категории, безопасные UUID и хэши.

Проверки включают ошибочные dynamic URL/query, подложные request/correlation headers, неверный пароль, обычный и streamed body limit, cross-origin POST, ошибочный autosave и неизвестное поле JSON. Настоящий 5xx вызывает временный SQLite trigger только в новой QA БД; он удаляется в `finally`. Успешно принятая синтетическая заявка даёт проверяемую цепочку HTTP request → audit/outbox; её собственная job затем преобразуется в неизвестный синтетический handler для проверки настоящего worker failure без провайдера.

Успешный auth и чтение собственного attempt закономерно содержат данные владельца. Эти ответы исключены из negative-response scan и остаются в памяти. Их контрольные secrets дополнительно ищутся во **всех** собранных stdout/stderr. Эхо значения, которое клиент сам прислал в ошибочном запросе, фиксируется отдельно от утечки серверных данных другого пользователя; отсутствие таких эхо требуется для чистого error-sample contract, но само по себе не доказывает межпользовательскую утечку.

Analytics-проверка различает три вещи: feature disabled и отсутствие сбора; feature enabled при отсутствии отдельного client opt-in и отсутствие клиентских событий; отказ строгой схемы принимать произвольные PII dimensions. Внешняя отправка аналитики этим сценарием не включается. Server operational truth и client opt-in population не объединяются в неподтверждённую конверсию.

## Что подтверждено и что остаётся вне выборки

Отчёт указывает точный build ID, миграции, реальный набор запросов, log event/schema keys, соответствие request/correlation UUID, контрольные категории и найденные совпадения. Проверка маршрутов принимает только фиксированные шаблоны, а ошибок — фиксированные коды; произвольная строка в верхнем регистре не считается безопасным кодом. Категории: имя, email, телефон, пароль, ответ экзамена, verification token, неизвестное поле, SQL diagnostic, job type, подложный request ID, auth secret, cron secret, фактические session token и cookie нормального HTTP-входа. Проверяются прямые и URL-encoded значения; это не универсальный классификатор всех способов кодирования или PII.

Один локальный прогон не проверяет все пути ошибок, provider responses, CDN, Vercel log drains, production logs, реальные секреты/пользователей или полноту всех analytics funnels. Успешные собственные auth/learning responses не обязаны быть лишены данных их владельца и исключены из negative-response scan; публичное представление attempt отдельно проверено на отсутствие `correctOptionIds`. Browser networking ограничен своим origin, внешние запросы блокируются. Отсутствие совпадений по контрольным строкам не является универсальным доказательством отсутствия персональных данных. T076 имеет фактическое локальное evidence; hosted/production samples и B52 delivery/alert gates остаются отдельными до их проверки.
