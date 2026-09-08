# Публичные URL и индексация OT Center

Источник истины для public inventory и sitemap — `config/public-route-policy.js`. Он использует и повторно экспортирует лёгкие функции `config/public-route-runtime.js`: локализацию, классификацию закрытых маршрутов и resolver городских страниц. Browser/SSR компоненты и финальный response plugin импортируют runtime-модуль напрямую.

Разделение сохраняет общий контракт и убирает build-only source registry из SSR-графа SEO. В установленном Nuxt 4.5.2 `shared/` объявлен external в Vite SSR; относительный TypeScript-импорт из config, попавший в SSR chunk как side effect, был переписан в несуществующий относительный путь при Vercel prerender. Исправление находится в исходниках и не зависит от глубины `.nuxt/dist/server/_nuxt`, Windows drive или Linux path. Сгенерированные chunks не исправляются вручную.

## Сохранённые адреса

- Главная продолжает использовать `pages/index.vue → HomePageClassic`. Нового лендинга нет.
- Все девять национальных направлений, 15 городов и шесть форматов, включая городские комбинации, сохраняются в RU и KK.
- Один одноуровневый resolver `pages/[course].vue` распознаёт национальное направление или город; один двухуровневый `pages/[city]/[slug].vue` распознаёт город + направление/формат.
- Статические адреса `/courses`, `/blog`, `/contacts`, `/licenses` и существующие специальные городские страницы сохраняются. Неизвестная сущность возвращает HTTP 404, а не переводит посетителя на Караганду или промышленную безопасность.
- Существующие `/courses/{id}` и aliases сохраняются без новых redirects. Для девяти legacy направлений маркетинговые национальные адреса остаются в sitemap; карточки их учебных версий автоматически не добавляются. После чтения PDF в inventory явно включены 11 новых содержательных предложений `/courses/{newSlug}` в RU/KK, с self canonical и ценой по запросу.

## Public / private

Whitelist содержит 550 публичных адресов: 528 сохранённых плюс 22 новые RU/KK карточки из source inventory. Nitro prerender получает только whitelist, `crawlLinks:false` исключает обнаружение закрытых страниц через ссылки. Sitemap использует тот же whitelist с `excludeAppSources:true`; серверные маршруты, файлы и каталог автоматически не добавляются.

`/auth`, `/cabinet`, `/account`, `/organizations`, `/learn`, `/exam`, `/payment`, `/orders`, `/certificates`, `/verify`, `/admin`, `/api`, `/preview`, `/src`, `/second`, `/program-selection`, `/wizard`, `/categories`, их дочерние и KK-варианты имеют `prerender:false`, `cache:false`, `swr:false`, `sitemap:false`, `robots:false` и заголовки `Cache-Control: private, no-store, max-age=0`, `X-Robots-Tag: noindex, nofollow, noarchive`. Финальный Nitro `beforeResponse` повторно устанавливает границу, включая ошибки закрытых URL. Это не заменяет авторизацию и ownership на API.

Robots закрывает API и разрешает получение `/_nuxt` CSS/JS. Технические HTML доступны для чтения noindex; robots.txt не используется как защита персональных данных. Публичные фильтры каталога имеют canonical без query-параметров; состояния подбора не индексируются.

## Head и sitemap

`usePublicLocaleHead` обслуживает default/fullwidth layouts через API i18n 10: `useLocaleHead({dir:true, lang:true, seo:{canonicalQueries:[]}})`. Используются `locales[].language=ru-KZ/kk-KZ`; KK имеет self canonical и взаимные ссылки на RU. Ручной второй canonical удалён. Бренд не добавляется повторно, если уже присутствует в title.

Сгенерированным sitemap владеет модуль. Старый `public/sitemap.xml` удалён, чтобы не перекрывать серверный результат. `npm run sitemap` создаёт только проверочный `.output/seo/sitemap-preview.xml`. Дата сборки не выдаётся за `lastmod` содержимого.

JSON-LD описывает одну EducationalOrganization и `areaServed`. Не создаются LocalBusiness/адреса филиалов по списку городов. OG использует существующий локальный `logo.png`, без генератора изображений и внешних demo-assets.

## Домен и окружения

2026-09-07, 11:57 UTC, фактический `curl.exe -I`: `https://otcenter.kz/` ответил **307 Temporary Redirect** с Location `https://www.otcenter.kz/`; www ответил **200**. Это наблюдение, не утверждение о 301. Конфигурация прежнего репозитория была non-www; домен не мигрирован без отдельного решения владельца. Перед выпуском необходимо согласовать один origin и одинаково настроить `NUXT_PUBLIC_SITE_URL`, платформенные redirects и GSC. Реальные разрешения организации повторно не проверяются: владелец подтвердил их наличие.

Для закрытого preview/staging задаётся `OT_NOINDEX=true`; canonical origin задаётся отдельно и не выводится из входящего Host. Сам noindex не заменяет ограничение доступа к staging.

Подготовка под Vercel задаётся окружением `NITRO_PRESET=vercel`; файл не запускает деплой. Серверные данные требуют внешнего постоянного хранилища; публичный prerender не должен зависеть от данных конкретной сессии. Платёжные операции, production и массовые уведомления остаются отдельными разрешёнными действиями владельца.

## Проверка

```powershell
node --import tsx --test tests/public-route-policy.test.mjs
node --import tsx --test tests/public-content.test.ts
node scripts/generate-sitemap.mjs
node scripts/seo-http-check.mjs http://127.0.0.1:3000
node scripts/seo-http-check.mjs http://127.0.0.1:3000 --all
$env:SEO_BASE_URL = 'http://127.0.0.1:3000'
npm run seo:check
```

HTTP-тест проверяет SSR, один title/description/H1/canonical, язык/alternates, шесть отрицательных URL, no-store/noindex технических страниц, robots и полный sitemap inventory. Для production-подобной проверки следует запустить собранный сервер и выполнить те же HTTP-контракты, а не считать dev-ответы проверкой deployment artifact. Shingle similarity остаётся сигналом для редактора; metadata/canonical продолжают быть строгими условиями.

На Node build ID `6fba2fcb-2f90-40d4-9017-5fea953a7359`, `http://127.0.0.1:3101`, фактически пройдены **58 публичных, 10 закрытых, 6 настоящих 404 адресов и 550 sitemap URL**, exit 0. Отчёт запуска 13:29 UTC сохранён в `artifacts/seo/http-contract-report-6fba2fcb.json`; следующая проверка обновляет `artifacts/seo/http-contract-report.json`. Это промежуточный результат перед последними исправлениями формы контактов и учебного администрирования.

Финальный повтор на Node `6aa9fbb6-2c27-4ec9-bb12-8eb4f4fd60f9` после всех указанных исправлений также прошёл **58/10/6 и sitemap 550**, exit 0; сохранён `artifacts/seo/http-contract-report-6aa9fbb6.json`. Проверка assets этой сборки: **551 HTML, 15 770 ссылок, один build ID, отсутствующих 0** (`artifacts/seo/node-assets-6aa9fbb6.json`). Данные checks относятся к локальному собранному серверу, не к Vercel CDN/удалённой БД.

Для полного T005 добавлен необязательный флаг `--all`: вместо выборки проверяется весь `buildPublicRoutes()`; noindex/private, реальные 404, robots и sitemap остаются теми же. Финальный запуск `node scripts/seo-http-check.mjs http://127.0.0.1:3101 --all` на `6aa9fbb6` фактически прошёл **все 550 public HTTP/SSR/head контрактов, 10 private, 6 true 404 и 550 sitemap URL, exit 0**. Запросы последовательные. Отдельный отчёт: `artifacts/seo/http-contract-all-report-6aa9fbb6.json`; текущий путь `http-contract-all-report.json` не перезаписывает sample или performance evidence.

Дополнительный `node scripts/build-asset-check.mjs OUTPUT_DIR` проверяет локальные `src`, Nuxt `data-src`/`_payload.json`, stylesheet/preload/prefetch/icon links, CSS `url()` и статические relative JS imports. Все ссылки должны вести на существующий файл выбранного артефакта; build ID всех prerendered HTML должен быть один. В Node-артефакте проверено 551 HTML (550 страниц плюс GSC verification), 17 396 ссылок, отсутствующих 0, один build ID — pass. Отчёт: `artifacts/seo/node-assets-6fba2fcb.json`.

Эта проверка выявила дефект первой Vercel-сборки, который head-only тест не обнаруживал: смешанные старые/новые HTML, два build ID и 2 942 отсутствующие ссылки на assets/payloads. Неуспешный отчёт сохранён в `artifacts/seo/vercel-assets-mixed-build-failed.json`; такая сборка к публикации не принимается. В установленном Nitro временный `nitro-prerender` использует `serveStatic:true`; существовавший `.output/public` мог вернуть HTML предыдущей Node-сборки при сборке Vercel.

`build:vercel` теперь сначала вызывает официальный `nuxt cleanup` и проверяет фактическое удаление каждого стандартного каталога generated output/cache, затем запускает build, head gate и asset gate. Перед cleanup абсолютные и реальные пути проверяются на принадлежность рабочему репозиторию. Проверка после cleanup необходима: текущий CLI проглатывает filesystem errors, в частности при заблокированных файлах Windows. Локальные серверы, использующие `.output`, должны быть остановлены до команды. Исходники и локальные `.data`/`artifacts` cleanup не затрагивает.

Исправление фактически проверено чистой Vercel-сборкой с `VERCEL=1`, `VERCEL_ENV=preview`: **1105 prerender routes (включая payloads), 550/550 SEO pages, 551 HTML с GSC verification, 15 770 asset references, один build ID `34a99837-1e71-4025-83a9-2414427497cf`, отсутствующих файлов 0, exit 0**. Отчёт сохранён отдельно: `artifacts/seo/vercel-assets-34a99837.json`. Сгенерированный runtime — `nodejs24.x`, maxDuration 60. Этот артефакт заменяет смешанную неуспешную сборку; проверка является локальной подготовкой, а не доказательством выполненного production deployment или работы удалённой БД.

Публичные тексты направления помогают выбрать программу, но не создают утверждённый учебный материал или право выдачи документа. Казахские тексты подготовлены в реализации; лингвистическая и методическая приёмка человеком не подменяется автоматическими тестами.
