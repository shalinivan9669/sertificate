# Проверки реальной preview-базы Turso

8 сентября 2026 использована существующая ветка Vercel preview `dpl-fmq8ahhfwsnw8zfrdlgej6`, отдельная от production `database-sky-village`. Для неё через интерфейс Turso создан отдельный токен Read & Write со сроком **1 Day**. Это доступ только к выбранной preview-базе; production token не расширялся, другие токены не отзывались. Значение сохранено в закрытом `.data` и не выводилось в журнал. Однократный локальный HTTP-приёмник завершился после сохранения.

Предыдущая попытка обратиться к этой ветке с production token получила 401. Это исторический отказ другого credential, а не текущий блокер readiness: новый scoped token прошёл проверки. Статус одной ветки не переносится на все последующие ветки автоматически.

## Обновление выбранных preview и production до013

Миграция013 из exact34fb14404f92c826e68ee16cd6ef07c3277d5504 имеет SHA25655d778fd91070bda0a16e8df9879c8e90c074039e743d82dcc6ae3d2127d3d05. Preview завершена09:08:35.153UTC; production09:10:06.384UTC. Перед каждой применены encrypted backup/independent restore и local-copy upgrade. Восстановленные plaintext-файлы удалены после выхода собственного child до remote mutation. Проверены все49таблиц/32исторические строки и вся несвязанная схема; добавлена одна строка ledger миграций,0business rows. Каждая цель прошла FK/integrity и затем три свежих13readiness/negative probes,0committed probe writes. Логи artifacts/schema-013-preview-rollout.log, schema-013-production-rollout.log и schema-013-{preview,production}-fresh-readiness.log. Production pre-migration archive49430bytes, SHA2567bb6146e5b77e554efc962f9b520c8d332decb9ebdba0e0fc1a117fdb3595de8; export8454ms/restore529ms/cleanup3ms. Эти маленькие live DB не содержали учеников или документов. После миграции публичный GET smoke4/4 прошёл09:11:59.188UTC, без POST или внешней доставки.

Старый четырёхклиентский transaction drill ниже действительно выполнен на012; он не переименован в прогон013. Текущий CLI использует актуальный requiredMigrations и теперь требует013. Все будущие preview branches нуждаются в собственных migration/readiness checks.

## Историческая готовность и внешние ключи012

Штатная команда `scripts/db-readiness.ts --remote --probe-foreign-keys` выполнена с отдельным preview env file. Три свежих HTTP-клиента подтвердили schema 001–012, `foreign_keys=1` по умолчанию, отсутствие существующих нарушений и отклонение заведомо неверной ссылки. Каждая проба откатила транзакцию; **writesCommitted=0**. Лог: `artifacts/preview-fmq-scoped-readiness.log`.

## Конкурентные транзакции

`scripts/remote-transaction-drill.ts` проверяет реальные удалённые libSQL clients вместе с используемым приложением `withTransaction`. Он требует `OT_APP_ENV=staging`, отдельный `OT_ALLOW_REMOTE_DRILL=1`, явный ожидаемый preview hostname и совпадающий URL. Production hostname, Vercel process, неверные URL components, отсутствие flag/credential отклоняются до файлов/сети. Никакой источник БД из рабочего приложения не выбирается по умолчанию.

Сценарий создаёт две новые таблицы с уникальным именем текущего запуска, выполняет записи только в них и удаляет только их. Таблицы приложения читаются для инвентаризации; ученики, сессии, заявки, задания, экзамены, платежи и документы не создаются. Миграции не выполняются, CRM/SMTP/провайдеры не вызываются. Неопределённый ответ CREATE COMMIT остаётся ошибкой; cleanup всё равно проверяет точные собственные имена. Успешная очистка не превращает такую ошибку в passed.

Окончательный реальный запуск: **08:19:53.429–08:20:20.301 UTC**, **26 871 ms**, **7/7 checks**, exit 0:

- четыре свежих удалённых клиента с включёнными foreign keys;
- создание собственных scratch tables одной транзакцией;
- 16 конкурирующих транзакций с повторяющимися четырьмя ключами: ровно четыре уникальных эффекта, 16 вызовов callback, без replay;
- четыре записи с одной ожидаемой revision: ровно одна успешная, три отклонены как stale;
- ошибка callback откатывает обе его записи, без повторного выполнения callback;
- неверный внешний ключ не оставляет сохранённой команды;
- итоговая remote foreign-key integrity без нарушений.

Обе временные таблицы удалены. Schema, migration ledger и counts всех таблиц приложения до/после совпали; проверка исключает только два имени текущего запуска. Отчёт: `.data/remote-preview-transactions-20260908-2/report.json`, безопасный лог: `artifacts/remote-preview-transactions-20260908-2.log`. Предыдущий успешный запуск 27 440 ms сохранён отдельно; повтор потребовался после усиления cleanup и точности inventory. Четыре локальных preflight tests дополнительно проверяют отказ без обращения к сети и безопасный вывод CLI при malformed URL.

Это проверка транзакционного контракта реального production-типа БД, не нагрузочный профиль для тысяч учеников и не полный hosted экзаменационный/платёжный сценарий. Ограниченные времена этой проверки не являются production SLO, p95 или RTO.

## Повторение

Сначала подтвердить конкретную preview-ветку, её отдельный токен и отсутствие production environment. Использовать новый каталог отчёта; существующий каталог не перезаписывается:

```powershell
$env:OT_APP_ENV = 'staging'
$env:OT_ALLOW_REMOTE_DRILL = '1'
node --env-file=private-preview.env --import tsx scripts/db-readiness.ts --remote --probe-foreign-keys
node --env-file=private-preview.env --import tsx scripts/remote-transaction-drill.ts '<exact-preview-host>' '.data/new-remote-drill-report'
```

Проверить `passed`, `cleanup.removedScratchTables` и `cleanup.applicationInventoryUnchanged` в отчёте. При ошибке не расширять доступ на production и не повторять потенциально исполненные domain callbacks; исследовать безопасный код ошибки и наличие собственных scratch tables. После истечения scoped token новый запуск требует нового разрешённого доступа именно к preview. Не отзывать все токены базы ради завершения одного теста.
