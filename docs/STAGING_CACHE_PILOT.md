# T017: изолированная проверка приватных ответов Vercel Preview

Этот инструмент готовит синтетическую учебную цепочку локально и переносит её одним проверяемым действием в заранее выбранную пустую Preview-БД. Он не запускается приложением, не применяет удалённые миграции, не создаёт производственных пользователей и не отправляет внешние уведомления. Синтетический PDF помечен `SYNTHETIC STAGING TEST PDF - NO VALIDITY`.

## Зафиксированная цель

| Поле | Значение |
| --- | --- |
| Vercel deployment | `563KVkpwkXquxLvZpSN8JDdv2pW9` |
| Стабильный Preview origin | `https://sertificate-git-codex-ot-center-54086f-shalinivan9669s-projects.vercel.app` |
| Git commit размещённого приложения | `ca56882e15272833cd049d9a982e9e595931ef11` |
| Изолированный Turso hostname | `dpl-563kvkpwkxquxlvzpsn8jd-vercel-icfg-sdl6ytmx76nmke0zqmjmkyct.aws-us-east-1.turso.io` |

Эти значения связаны одной константой `deploymentBinding`. Перед импортом и HTTP-проверкой оператор сверяет их в Vercel/Turso и подтверждает переменными окружения ниже. Код не извлекает токены из браузерного состояния и не утверждает, что сам проверил Git-привязку через Vercel API. Стабильный адрес может переместиться после следующего push: если это произошло, остановиться и отдельно проверить новую цель; не подставлять произвольный адрес в существующий запуск.

`migrationGitSourceSha` обозначает только точный Git-источник SQL-миграций 001–013. Локальная подготовка исполняет текущие helper-файлы и доменные сервисы. Их фактические SHA-256, а также `package.json`, `package-lock.json`, локальный HEAD и признак изменённого рабочего дерева сохраняются в `preparation-source.json`, приватном fixture и manifest. Общий `preparationFingerprint` вычисляется по отсортированным путям и SHA-256 файлов. Это свидетельство локальной подготовки, а не утверждение, что изменённые helper-файлы входили в размещённый commit. Хэш входов сверяется до и после подготовки.

## Подготовка без удалённых секретов

Миграции читаются из локального Git HEAD: исторический hosted commit не требуется в shallow checkout CI. Отдельное поле `hostedSourceSha` сохраняет привязку размещённого приложения. Совместимость SQL с удалённой базой проверяется полным совпадением checksum и схемы до любой записи.

Из корня репозитория, в процессе без переменных Turso/Vercel и без `--env-file`:

```powershell
node --import tsx scripts/staging-cache-fixture.ts prepare https://sertificate-git-codex-ot-center-54086f-shalinivan9669s-projects.vercel.app
```

Команда возвращает новый каталог `.data/staging-cache-<UUID>`. Существующий каталог не перезаписывается. Внутри создаются локальная SQLite-БД, приватный snapshot с двумя случайными паролями и manifest. Пароли, fixture, локальный PDF и `.env` не публиковать и не коммитить. Технические редактор/рецензент/эмитент не получают логинов; реальные сессии не подставляются в таблицу `session`.

Проверить manifest, `deploymentBinding`, 13 хэшей миграций, 5 синтетических пользователей, 2 credential-аккаунта, 0 подготовленных сессий и 1 TEST-документ. Не использовать fixture, подготовленный другим или неизвестным набором helper-файлов.

## Единственный импорт

Подготовить отдельный игнорируемый файл `.data/<private-access>/database.env`, содержащий только уже разрешённый краткоживущий Read & Write токен конкретной Preview-БД и её URL под именами:

```text
OT_STAGING_CACHE_DATABASE_URL=libsql://dpl-563kvkpwkxquxlvzpsn8jd-vercel-icfg-sdl6ytmx76nmke0zqmjmkyct.aws-us-east-1.turso.io
OT_STAGING_CACHE_DATABASE_TOKEN=<секрет только в локальном файле>
```

Не оставлять в процессе `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `VERCEL` или `VERCEL_ENV`: защитные проверки отвергнут такой контекст. Подставить фактический UUID каталога и приватный путь:

```powershell
$env:OT_APP_ENV = 'staging'
$env:OT_ALLOW_STAGING_CACHE_SEED = '1'
$env:OT_STAGING_CACHE_DEPLOYMENT_ID = '563KVkpwkXquxLvZpSN8JDdv2pW9'
$env:OT_STAGING_CACHE_HOSTED_SOURCE_SHA = 'ca56882e15272833cd049d9a982e9e595931ef11'
node --env-file=.data/<private-access>/database.env --import tsx scripts/staging-cache-fixture.ts import .data/staging-cache-<UUID> dpl-563kvkpwkxquxlvzpsn8jd-vercel-icfg-sdl6ytmx76nmke0zqmjmkyct.aws-us-east-1.turso.io
```

Перед записью сверяются точная схема всех 49 таблиц, миграционные checksum, 20 записей реестра и отсутствие любых остальных строк. Проверка сначала считывает количества; она не выгружает чужие бизнес-данные для диагностики. Только после совпадения выполняется одна транзакция с whitelist таблиц и записью аудита `staging.cache_fixture_imported`; `foreign_key_check` должен быть пустым. Существующие строки не обновляются и не удаляются.

`import-report.json` создаётся эксклюзивно до сетевой попытки. Повторный запуск не перезаписывает его и не повторяет импорт. При неизвестном результате commit нельзя удалять marker или повторять запись: сначала требуется отдельная проверка фактического состояния именно этой Preview-БД. Скрипт не пытается автоматически очищать доменные строки.

## Проверка HTTPS

Если Vercel Deployment Protection требует авторизацию, использовать отдельно разрешённый временный bypass secret из `.data/<private-access>/probe.env` под именем `OT_STAGING_CACHE_VERCEL_BYPASS`. Передавать его только заголовком на зафиксированный origin. Не отключать защиту проекта и не использовать URL query с секретом. Сам bypass не заменяет прикладную сессию Better Auth.

```powershell
$env:OT_APP_ENV = 'staging'
$env:OT_ALLOW_STAGING_CACHE_CHECK = '1'
$env:OT_STAGING_CACHE_DEPLOYMENT_ID = '563KVkpwkXquxLvZpSN8JDdv2pW9'
$env:OT_STAGING_CACHE_HOSTED_SOURCE_SHA = 'ca56882e15272833cd049d9a982e9e595931ef11'
node --env-file=.data/<private-access>/probe.env --import tsx scripts/staging-cache-check.mjs .data/staging-cache-<UUID> https://sertificate-git-codex-ot-center-54086f-shalinivan9669s-projects.vercel.app
```

Проверка ограничена 40 HTTP-запросами, 8 минутами, таймаутом 15 секунд на запрос и 2 MiB на ответ. Она выполняет два настоящих входа по паролю, проверяет Secure/HttpOnly/SameSite=Lax host-only cookie и использует одинаковые приватные HTML/JSON/PDF URL для владельца, другого учащегося и анонимного клиента, затем меняет порядок. В запросах нет cache-busting, `Cache-Control`, `Pragma` или условных cache-заголовков. Redirect не выполняется, cookies и bypass на другой origin не отправляются. Разрешены только ограниченные чтения и auth sign-in/sign-out; CRM, операции cron, оплаты и уведомления недоступны через transport.

Для приватных ответов обязательны `private, no-store`, `noindex`, реальные Vercel headers, отсутствие shared-cache HIT/STALE и положительного Age. Проверяются собственная идентичность и отсутствие canary другого пользователя, права на запись обучения и SHA-256 TEST PDF. Завершение отзывает обе сессии обычным sign-out; старые cookies должны получать 401. При ошибке выполняется ограниченная попытка sign-out уже открытых сессий.

Публичный технический отчёт записывается в `artifacts/staging-cache/<UUID>/report.json`; он содержит статусы, хэши и наблюдаемый edge, а не тела ответов, пароли, cookies или PDF. Подробная ошибка остаётся в приватном каталоге fixture. `deploymentProtectionBypassUsed` явно показывает использование bypass. Результат относится только к этим запросам, выбранному deployment и наблюдаемому edge; он не доказывает поведение запросов без bypass или всей глобальной CDN. Даже успешный probe не подтверждает качество учебной программы или действительность документа.

Временный bypass и scoped DB token после завершения отозвать через штатный интерфейс их создания. Скрипт не удаляет удалённые БД и не отзывает чужие credentials. Удаление изолированной БД выполняется отдельным действием только по её точному проверенному идентификатору.

## Локальные проверки инструментов

```powershell
node --import tsx --test tests/staging-cache-fixture.test.ts tests/staging-cache-check.test.ts
npx eslint scripts/staging-cache-fixture.ts scripts/staging-cache-local-worker.ts scripts/staging-cache-check.mjs tests/staging-cache-fixture.test.ts tests/staging-cache-check.test.ts
npm run typecheck
```

Эти тесты создают только новые локальные каталоги и SQLite-файлы. Тестовый URL/токен используется только для проверки аргументов; fetch подменён синтетическим transport. Результаты реального HTTPS-прогона фиксировать отдельно после фактического выполнения.
