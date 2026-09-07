# OT Center — статус реализации

Обновлено: 2026-09-07. Реализация запушена в GitHub, удалённый Quality прошёл, Vercel preview готов. Production ожидает настройки постоянного хранилища и почты. Владелец отдельно разрешил production-деплой после обновлений и проверок. Реальные платежи и массовые уведомления отдельно не разрешены.

## Исходное состояние и поручение

- Репозиторий: https://github.com/shalinivan9669/sertificate; рабочая ветка `codex/ot-center-learning` от `main`.
- Исходный HEAD: `413ad4a34e53203f39df3946962903f51caf16a0`. Повторный `git fetch origin main` 2026-09-07 подтвердил тот же origin/main. Более новые изменения не откатывались.
- До работы были только untracked `.serena/`; эта папка сохранена без изменений.
- Handoff распакован отдельно, без замены приложения: `C:/Users/Admin/Documents/ot-center-handoff-20260907-20260907-164505/OT_CENTER_CODEX_HANDOFF_2026-09-07`.
- Прочитаны стартовый файл, мастер-промпт, spec/01–10, backlog и acceptance cases. Документы применяются в рамках поручения; поздние указания владельца имеют приоритет.
- По указанию владельца юридическое лицо и наличие разрешений повторно не проверялись. Это не блокер разработки.
- Главная `pages/index.vue → components/HomePageClassic.vue` сохранена. Diff HomePageClassic относительно origin/main пустой; лендинг из nuxt-redesign не подставлялся.

План пакетов: baseline → public/SEO → БД/идентичность/версии → обучение/серверный экзамен → B2B/документы/CRM → интерфейсы/проверки/эксплуатация → проверяемый выпуск после подключения хранилища.

## Выполненная реализация

Полный перечень путей: [CHANGED_FILES.md](docs/CHANGED_FILES.md). Матрицы сохраняют все исходные требования: [58 задач backlog](docs/BACKLOG_STATUS.csv), [84 сценария](docs/ACCEPTANCE_STATUS.csv), [методика статусов](docs/STATUS_MATRIX_METHOD.md). Локальный passed не означает проверенную production-интеграцию.

- Public: прежние RU/KK адреса, единый resolver, настоящие 404, canonical/hreflang, sitemap 550 URL, no-store/noindex для закрытых разделов и исключение их из prerender. Сохранены бренд и композиция OT Center; исправлены сжатие mobile logo, контраст и фокус.
- Каталог: 9 исторических + 11 новых направлений, всего 20. Сведения о 16 услугах PDF, аудитории и подборе; стоимость **по запросу** по прямому ответу владельца.
- Identity: Better Auth, verified email/reset, серверные HttpOnly sessions, TOTP/MFA, текущие роли и отзыв доступа; транзакционная очередь писем с ограниченной попыткой доставки при настроенном транспорте.
- Learning: редактор программ/модулей/уроков/вопросов, отдельное согласование, immutable publication, закрепление версии, реальные назначения/прогресс и подтверждение практики инструктором. Миграции не создают фиктивных утверждённых курсов.
- Assessment: серверный допуск, фиксированные вопросы/deadline, autosave/revision, конфликт двух вкладок, неизменяемая серверная оценка и пересдачи; правильные ответы не выдаются учащемуся.
- B2B: организации/роли, одноразовые приглашения на verified email, CSV preview/commit, назначения, tenant-scoped отчёты и защищённая выгрузка с защитой от spreadsheet formulas.
- Invoices: immutable реквизиты/состав, серверная цена за слушателя или одна цена за организацию, до 100 участников, точное распределение суммы, печатная форма/отмена/ручная фиксация проверенного финансовым сотрудником поступления. Проверка банка и кассовый чек не симулируются. Без настоящих настроек счета отключены.
- Payments: серверные заказы/история и изолированный HMAC sandbox с signature/amount/currency/merchant/replay checks. Боевого адаптера нет, default disabled; sandbox запрещён в Vercel production и не возвращает manually confirmed invoice payment.
- Credentials: загрузка реального PDF AcroForm/шрифта, независимое утверждение, eligibility, уникальный номер, protected download, opaque verification без публичных ФИО/контактов, revoke/reissue. Failed pending render можно перепривязать к новому approved шаблону с прежним номером/ссылкой; stale parallel render отвергается. Печати/подписи не рисуются.
- CRM/operations: durable lead до ответа 202, idempotency, совместимый `/api/amo-lead`, leased outbox/backoff/retry, сохранение amoCRM ID до notes, общий deadline доставки, inbox/согласия. Внешние delivery flags соблюдаются. Контактная форма RU/KK сохраняет данные и ключ повтора после сетевого сбоя.
- Security/operations: streamed body limits, origin/JSON/rate limits, audit, scoped admin, health/ready, encrypted backup/restore, CI, migrations 001–005 с checksum; LF закреплён в .gitattributes для Windows/Linux.

## PDF и реальные материалы

`КБПК все обучения 306 нов.pdf` — 2 страницы, 16 услуг и коммерческие ставки; не содержит 306 уроков, лекций, часов, банка вопросов/ответов. Пять услуг соответствуют прежним направлениям, 11 расширяют каталог. Неоднозначное обозначение стандарта последней строки не заменялось выдуманным ISO 45001. Бренд/реквизиты PDF не подменяют OT Center.

Оригинал, ставки, реквизиты и подпись не включены в публичный GitHub или сайт. Приватные ставки находятся в ignored `.data/source-product-rates.json`, исследования в ignored `artifacts/materials/`. Подробнее: [PDF-CONTENT-AUDIT.md](docs/PDF-CONTENT-AUDIT.md).

## Фактически запущенные проверки

| Проверка | Статус | Фактический результат |
|---|---|---|
| Baseline install/build | passed | Node24.16/npm11.13, исходный npm ci947 packages и SSR/prerender build |
| Baseline visual | passed | 36/36 HTTP200, 9 страниц ×4 ширины на отдельно сохранённом исходном artifact; 8 RU/KK снимков главной |
| Чистый финальный lock install | passed | Новая отдельная папка, npm ci1056 packages, без force/legacy-peer-deps |
| npm audit --json | passed | Последний повтор exit0, 0 vulnerabilities; dependency-audit-final.json |
| npm run lint | passed | Полный запуск exit0; implementation-lint.log |
| npm run typecheck | passed | Полный повтор exit0; strict app/server/shared/tests. Только artifacts/generated/local folders исключены из source scope |
| npm test | passed | Последний полный запуск **93/93, 0 failed, 0 skipped**, exit 0; implementation-noindex-checker-tests.log. Добавлены 2 regression проверки index/noindex; предыдущие 91/91 также пройдены |
| Cold build:vercel | passed | VERCEL=1/VERCEL_ENV=preview без DB secrets: 550 public HTML+GSC,15770 asset references,0missing, один buildId34a99837-1e71-4025-83a9-2414427497cf |
| Vercel function artifact | passed | Node24,maxDuration60s;18.1MB/4.57MBgzip; remote path без native SQLite |
| Отдельная noindex Vercel сборка | passed | OT_NOINDEX=true, VERCEL=1, preview/staging, новая scratch-копия: 550 HTML, sitemap 550, 15770 asset refs, 0 missing, build 84765834-4535-434d-a2f3-42766754a0eb; meta noindex/nofollow и robots Disallow:/ подтверждены. Default production проверка осталась строгой |
| Node build + SEO/asset gates | passed | 550 public HTML+GSC,15770 refs,0missing, buildId6aa9fbb6-2c27-4ec9-bb12-8eb4f4fd60f9; сервер3101 |
| Полные HTTP contracts | passed | 550 публичных страниц, 10 закрытых, 6 настоящих 404, sitemap 550; artifacts/seo/http-contract-all-report-6aa9fbb6.json, exit 0 |
| Последние visual/a11y | passed | 52responsive,8home comparisons,6CSS zoom200%,2keyboard/form,0fail; artifacts/visual/design-after-6aa9fbb6/report.json. Screen reader not_run |
| Auth browser latest | passed | 6checkpoints: signup/queued verification/actual TOTP/MFA login/reset/390px,0JS errors. SMTP не отправлялся |
| Contact browser latest | passed | 2locales,360px,labels/consent/contact validation,network failure/retry stable key,localized accepted. Ответы перехвачены; реальная заявка не отправлялась |
| Learner browser latest | passed | 11 checkpoints, 0 JS errors: offline/retry/progress, фиксированный deadline, autosave/conflict, server pass/fail, cross-account protection и logout; исправлен тестовый race ожидания dropdown |
| Staff/invoice browser latest | passed | 13 checkpoints, 0 JS errors, обычный запуск без диагностических обходов: editor/reviewer/admin/MFA, публикация, приглашения, CSV, назначения, отчёт, корпоративный счёт, PDF template approval, 360px |
| Credential repair | passed | 6/6 входит в91: настоящий Unicode failure→approvedfont→PDF, unchangedserial/token,ACL/MFA/lease/rollback/stale-render race |
| Backup/restore CLI | passed | 34tables/106rows,schema001–005,read-only snapshot6ms,backup395ms,restore424ms; exactdata/schema/FK/integrity/triggers,wrong-password/tamper/overwriteguards |
| FK readiness CLI | passed | Новая восстановленная localcopy: schema/FK/negative insert сrollback,writesCommitted0; remote not_run |
| Precommit privacy gate | passed | Срез144existing/new candidatesбез.serena, ставок/реквизитов/секретов/сырогоPDFнет; publicDTO/NodeHTML/payloadбезprivatefields/questionkeys |
| Полный аудит client bundles | passed | Node 6aa9fbb6 и Vercel 34a99837: по 84 JS и 5 CSS, path/SHA256 совпадают; maps нет; AST и 1199 публичных текстовых файлов на artifact проверены. Учебные/почтовые/session canaries, реквизиты и точные ценовые фразы не найдены. Staff editor содержит только форму авторинга, не встроенные ответы. Реальные provider secrets отсутствуют для exact comparison; hosted bundle отдельно не проверен |
| GitHub remote CI | passed | Commit 1e23fc58a68af50917f0334b037a356c28de8fc4, PR #2; Quality run 34132591085: Linux npm ci/lint/typecheck/test/audit/Node build/SEO/assets/Vercel build — все success |
| Vercel preview deploy | passed | 8ApeFvY61QTAmTCWS3SqJ4PKzJ4m, Ready за 1m32s. Через авторизованный браузер открыты прежняя главная, каталог 20 направлений и ISO 9001 RU/KK со стоимостью по запросу. Resources подтверждает Node 24/max 60s |
| Полный HTTP smoke hosted preview | not_run | Vercel SSO возвращает внешнему HTTP-клиенту 302 и noindex. Прямой переход браузера на /api/ready блокируется клиентом; readiness не заявлен. Защита не обходилась |

Промежуточные ошибки: первый одновременный dev/build дал Windows ESM/HTTP500 и невалидные screenshots — заменены корректным baseline. Работающий старый сервер блокировал native binary (EPERM) — остановлен и пересобран. Повтор Vercel смешивал stale HTML/assets — исправлен official Nuxt cleanup с проверкой результата и обязательным asset gate. Typecheck включал скачанные SDK research .ts — исключены artifacts/generated/local, не исходники приложения.

[Локальная performance лаборатория](docs/PERFORMANCE_LOCAL_LAB_2026-09-07.md) завершена на последнем artifact: 13 навигаций HTTP 200 без JS/ресурсных ошибок и переполнения, 100 из 100 GET-запросов успешны; p95 health 76,63 ms, каталога 108,07 ms. Медиана LCP главной desktop 564→552 ms, mobile 2036→2136 ms. Экран завершённого тестового экзамена: LCP 1968 ms, CLS 0,18 — конкретное ограничение качества из-за переноса внутренней навигации. Ускорение, прохождение полевых Core Web Vitals/INP и production capacity не заявляются.

## Бесплатное окружение и выпуск

Nuxt/Nitro Vercel Functions + удалённый libSQL/Turso, native file DB только для разработки/тестов. В Vercel отсутствует fallback на файловую БД. Remote migrations явные; runtime проверяет FK на свежем соединении. Публичный каталог работает без БД, закрытые операции честно сообщают отсутствие конфигурации. Нет постоянного worker/ежесекундного API экзамена/платной поминутной cron: одна daily cron и bounded request jobs.

Доступен существующий Vercel `shalinivan9669s-projects/sertificate`, ID`prj_e5yFcuJHsGCwJguqx3dRVe04ZPHr`, production branch main, домены www.otcenter.kz и sertificate.vercel.app. Видны только Production AMO_* env, без DB/Auth/SMTP. Секреты не раскрывались. CLIlogin отменён: Allow Access оставался disabled; Git authentication работает.

**Production разрешён владельцем.** Новая интеграция Turso пока не создана: принятие условий нового сервиса ожидает отдельного ответа; это не повторное разрешение на деплой. SMTP/служебный адрес также ожидают ответа. Платные тарифы, реальные платежи и массовые уведомления не подключались. Ограничение Hobby для личного некоммерческого использования было сообщено ранее; тариф автоматически не меняется.

Результат публикации: [PR #2](https://github.com/shalinivan9669/sertificate/pull/2), [успешный Quality](https://github.com/shalinivan9669/sertificate/actions/runs/34132591085), [Vercel deployment](https://vercel.com/shalinivan9669s-projects/sertificate/8ApeFvY61QTAmTCWS3SqJ4PKzJ4m), [preview сайта](https://sertificate-qtcfln6fa-shalinivan9669s-projects.vercel.app/). Preview требует аккаунт Vercel. Ветка main и production остаются на исходном commit; PR draft до устранения зависимостей выпуска.

В hosted preview `/kk/cabinet` отображает локализованную ошибку запроса и кнопку повтора; работа кабинета без подключённой БД не заявляется. Read-only проверка существующего production подтвердила прежний `otcenter.kz → 307 → www.otcenter.kz → 200`. Реальные заявки, письма, платежи и документы при этом не создавались.

## Конкретные оставшиеся зависимости

1. Подключить постоянную бесплатную БД после ответа по Turso, применить001–005, выполнить remote readiness/negativeFKprobe, сохранить Auth URL/secret/CRON_SECRET. Новый backend без БД нарушил бы приём заявок; production сейчас не изменён.
2. Настроить transactional почту для подтверждения регистрации и восстановления доступа. Outbox не означает доставленное письмо.
3. Загрузить/согласовать настоящие учебные материалы, вопросы и PDF-шаблон. PDF-прайс не заменяет программу; production migrations не создают фиктивных пользователей/результатов/сертификатов.
4. Для реальных денег нужны выбранный provider/условия/credentials/отдельное разрешение. Officialsandbox/reconciliation/refund adapter отсутствуют. Счетам нужны фактические issuer реквизиты; TEST ONLY не являются defaults.
5. Не выполнены человеческая KK/методическая приёмка, правила продления, внешний alert канал, remote load/rollback и post-release проверки. Подробные ограничения и статусы — в матрицах.

Документы: [RUNBOOK](docs/RUNBOOK.md), [CORE_BACKEND](docs/CORE_BACKEND.md), [CORE_INVOICES](docs/CORE_INVOICES.md), [ARCHITECTURE-DECISIONS](docs/ARCHITECTURE-DECISIONS.md), [LMS-BROWSER-QA](docs/LMS-BROWSER-QA.md), [SEO-POLICY](docs/SEO-POLICY.md).
