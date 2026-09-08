# Проверяемый откат на предыдущий release commit

**Исторический проверенный путь для схемы012. После применения013 версии a304/f074 не являются разрешёнными целями отката.** Для текущей схемы использовать [план восстановления013](PARTIAL_REFUNDS.md), сохраняющий новый журнал возвратов и код его обработки. Результаты ниже не переносятся на013.

Этот сценарий дополняет прежний `docs/ROLLBACK_DRILL.md`. Старый guard для artifact `6aa9fbb6` не изменён: его отказы не превращаются в разрешение на запись. Новый путь проверяет другое, реально существовавшее предыдущее production-состояние:

- previous release: `a304ae5b28b61cb7b2c2a6f5fbef566f4451a7cb`;
- current release: `f07438557a46649a5360ea99cc419d06f764fc5f`;
- обе версии поддерживают одни и те же committed миграции 001–012.

Исходный T083: «Откатить приложение после expand migration»; ожидается «Старый artifact совместим/есть проверенный план; данные не разрушены». Исходный B53: «Actual isolated restore and consistency check; measured recovery recorded». В spec/08 допускается совместимый artifact **или отдельный проверенный путь**. Скачивание точных байтов hosted function не является исходным требованием.

## Область сценария

`scripts/release-rollback-drill.ts` заново собирает точные Git commits в отдельных source directories. Это не скачанные Vercel deployment payloads, не старый локальный artifact с новым названием и не проверка кнопки Vercel Rollback. Проверка выполняется в локальном изолированном staging с настоящими собранными Node-серверами, HTTP и SQLite. Синтетические аккаунты, программы, экзамены, деньги и документы не используются в production и не подтверждают реальное обучение, оплату или выдачу документов.

Git archive выполняется с `core.autocrlf=false`. Все tracked файлы до и после сборки сверяются с Git blob SHA, записываются tree SHA и SHA-256 lockfile. После `npm ci` и сборки сохраняется полный fingerprint `.output`, включая зависимости и бинарные файлы. Внутренние Nitro symlinks учитываются по разрешённому target; ссылки за пределы artifact запрещены. Физические target-файлы включены в manifest.

Новая синтетическая БД сначала получает схему 010 и исторические учебные, документные и финансовые записи. Затем применяются точные LF-байты миграций 011–012; проверяется сохранность каждой исходной строки. Добавляются синтетические записи новых feature tables: attribution, sales links, closed intake, support note, reminder и incident.

Текущий compiled runtime выполняет настоящий вход, завершает урок, начинает попытку и сохраняет первый ответ; принимает заявку в durable очередь. После остановки собственного процесса выполняются зашифрованный backup и восстановление в новый файл. Предыдущий compiled runtime на восстановленной БД должен сохранить session, immutable version, progress, deadline, order/form и answers; выполнить следующий answer write и server-side submission; отклонить закрытый набор, чужую административную роль и stale revision; повторить исходный lead key без второй заявки. Исторический PDF скачивается с тем же SHA-256. Затем запускается текущий compiled runtime и читает результат старого writer.

## Изоляция и инварианты

Скрипт требует `NODE_ENV=test` и отдельный `OT_ALLOW_RELEASE_ROLLBACK_DRILL=1`; отвергает Vercel и Turso окружение. Дочерние процессы получают очищенный environment без inherited production secrets. CRM, email, alerts, реальные платежи и invoices выключены. Все HTTP направлены на собственный `127.0.0.1` origin. Пароли и session cookies не включаются в публичный отчёт.

Существующие файлы БД не принимаются в качестве write-target: только новые эксклюзивно созданные файлы внутри собственного `.data/release-rollback-*`. Общий checkout, `.output`, `.vercel`, реальные БД и прежний legacy artifact не изменяются. Скрипт завершает только собственные дочерние процессы. Исходная synthetic БД и оба собранных artifact повторно сравниваются после эксперимента.

Все таблицы участвуют в проверке. Ни одна бизнес-таблица не исключается целиком. Для каждой существующей строки проверяются неизменяемые колонки; разрешённые изменения ограничены конкретной новой попыткой/назначением и ограничителями запросов. Вставки допускаются только для ожидаемого audit/outbox результата и operational counters. Старые финансовые события, documents, private document bytes, versions, completed attempts, attribution, links и feature controls должны сохраниться точно. Повторные submission и lead acceptance проверяются по фактической единственности строк. Immutable triggers, FK и SQLite integrity остаются включёнными.

## Повторение

Из корня репозитория, без loaded production `.env`:

```powershell
$env:NODE_ENV = 'test'
$env:OT_ALLOW_RELEASE_ROLLBACK_DRILL = '1'
node --import tsx scripts/release-rollback-drill.ts
```

Скрипт создаёт отдельный каталог, последовательно устанавливает зависимости и собирает две версии. Typecheck/build других задач не следует запускать параллельно. Новые compile/install журналы остаются в приватном каталоге; отчёт находится в `artifacts/release-rollback/report-*.json`.

Для повторения HTTP/restore части с уже успешно собранными и fingerprint-проверенными artifacts:

```powershell
node --import tsx scripts/release-rollback-drill.ts --resume '.data/release-rollback-OWNED_DIRECTORY'
```

Resume требует marker собственного прогона с точными release SHA. Source и artifact fingerprints проверяются повторно; новый HTTP/DB эксперимент всегда получает новые файлы. При незавершённой сборке её установка и сборка выполняются заново. Чужие пути или произвольный существующий файл БД не принимаются.

## Что этот путь не обещает

Backup, restore, запуск старого сервера до authenticated readiness и возврат к текущему измеряются отдельно. Эти значения относятся к конкретному локальному набору synthetic данных; они не называются production RTO/RPO.

Возврат к `a304ae5` также возвращает известную проблему расходования попыток очереди на выключенные email/alert channels. В данном проверочном пути scheduler и внешняя доставка не запускаются; успешная сохранность данных не означает операционную эквивалентность исправленной очереди. Это ограничение должно учитываться при выборе настоящего recovery path. Автоматическое production-переключение скрипт не выполняет.

## Фактический результат 2026-09-08

Окончательный прогон завершился **08:23:09.590 UTC**, начался **08:22:56.001 UTC**: **9/9 checkpoints, 26 настоящих HTTP requests, exit 0**. Отчёт — `artifacts/release-rollback/report-45be5968-f04d-4bd3-9f6a-7207759ea494.json`; вывод команды — `artifacts/release-rollback-final.log`. Это повтор на двух уже завершённых, заново сверенных exact-release сборках; новые fixture DB/backup/restore и все HTTP операции выполнялись заново.

| Измерение конкретного локального прогона | Результат |
| --- | --- |
| Backup: согласованный export, шифрование и запись нового файла | **42 ms** |
| Restore: чтение/дешифрование архива, новый файл, schema/data/indices/triggers, FK/integrity | **61 ms** |
| Запуск старого compiled runtime до schema readiness | **1 385 ms** |
| От начала backup до authenticated ответа старого runtime, включая restore и сравнение | **1 579 ms** |
| Возврат текущего compiled runtime до подтверждённых HTTP чтений | **1 908 ms** |
| Архив | **63 463 bytes**, SHA-256 `84557ed10dd9bdc3a34f98dced3c9e2d7c2392710b0dac541433754fcf34d941` |

Восстановлены **49 таблиц / 78 строк** с точным совпадением всех схем и значений. Исторические order, payment, payment event, refund, private PDF, опубликованная версия, завершённая попытка, закрытый набор, support note, reminder, incident, attribution и sales link сохранены. Подтверждены те же реальные session IDs, progress, версия, форма, deadline и первый ответ. Старое приложение выполнило следующий answer write и серверный результат; повтор submission не создаёт второй результат, replay lead key не создаёт вторую заявку. Исторические order и PDF прочитаны всеми тремя фазами compiled runtime.

После старого writer — **82 строки**: только ожидаемые новая audit-запись, outbox результата и два operational counters. Изменились конкретная активная попытка/назначение и значения request limiters. Во всех таблицах проверено отсутствие удаления исходных строк и изменения остальных колонок; financial/document/feature rows не исключались из сравнения. После возврата current результат и старые данные прочитаны снова, разрешены только ограниченные изменения счётчиков запросов. Immutable program/terminal attempt/audit/sales link triggers, FK и physical integrity проверены. Исходная synthetic БД и fingerprints обоих artifacts после пилота совпали с исходными.

| Происхождение сборки | Previous | Current |
| --- | --- | --- |
| Точный commit | `a304ae5b28b61cb7b2c2a6f5fbef566f4451a7cb` | `f07438557a46649a5360ea99cc419d06f764fc5f` |
| Git tree | `56c2937a0ef23b64020a0290bf762004f3d666d2` | `d19cf8385d6ca18152a62f4e5e3600f0d71e3247` |
| Побайтно проверено tracked файлов | 338 | 339 |
| Новый Node build ID | `176bac13-4564-48c5-b073-f782a26ae40d` | `5378f88a-3afc-4d2b-bff8-f5c832c30ae5` |
| Полный artifact manifest SHA-256 | `3624e22960a042434671cbd0fa254376c0729089f67cd211a2a73b6426ff7aa5` | `d1b9c56881c55d1119b691f977502ad3cfe7c5e4ec96df55ae1c695da81e25ab` |
| Число manifest entries, включая внутренние dependency links | 3 768 | 3 768 |
| `npm ci` / `npm run build` elapsed | 20 449 / 134 702 ms | 19 504 / 145 711 ms |

Общий SHA-256 lockfile: `7d2d5eda6597d2e58bde94cf4b4a0814c04b99e385f3f27878da0a583cac9b82`. Сборки прошли в отдельных папках `.data/release-rollback-H1M1P1/old` и `current`; source/lockfile проверены до и после сборок. Окончательный отчёт содержит также SHA-256 harness и fixture, фактически участвовавших в проверке. Подробные command logs и приватные synthetic DB остаются в этом принадлежащем сценарию каталоге.

Первый полный пилот `report-e76741db-2e23-45e2-884a-47ad8c1e3226.json` прошёл 9 checkpoints / 23 HTTP. Затем были добавлены три HTTP чтения денежной записи, более строгие ограничения counter deltas и hashes harness/fixture; окончательный повтор выше прошёл 26 HTTP. Более ранние незавершённые запуски сохранены: `report-c30b3b12-b3f5-44a0-bdfc-c6b47c1facd8.json` остановился на Windows CRLF-преобразовании Git archive до сборки, `report-d21bb88e-77e7-4264-a59f-46787e885ed2.json` — на первоначальном чрезмерном запрете внутренних Nitro symlinks после завершившейся сборки. Они не считаются завершёнными rollback-проверками.

Фактически выполненный scoped ESLint `scripts/release-rollback-drill.ts tests/release-rollback-fixture.ts` завершился с кодом **0**; журнал `artifacts/release-rollback-lint-final.log`. Полный совместный typecheck/test gate выполняется root отдельно после общего source freeze и не приписывается этому scoped прогону.
