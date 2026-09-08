# Выбор исправлений зависимостей — 2026-09-07

Это анализ конкретного lockfile и опубликованных версий, а не слепой переход на `latest`. Владение изменениями `package.json` / lockfile и окончательными проверками — основной исполнитель. Ни установка, ни этот документ не означают production approval.

## Исходное состояние и выбранные версии

| Область | До | Рекомендовано | Основание |
|---|---|---|---|
| Nuxt | 4.2.1 | 4.5.2 | npm audit предлагает конкретную исправленную версию; диапазоны опубликованных Nuxt advisories включают 4.2.1 и не включают 4.5.2 |
| i18n | 10.2.1 | 10.6.0 | Опубликованные зависимости 10.6.0 явно соответствуют kit 4.5.1+, Unhead 3.2.3+, vue-router 5.2+ |
| SEO umbrella | @nuxtjs/seo 3.2.2 | удалить | Включает неиспользуемые OG, schema, link-checker и seo-utils; старые Unhead peer dependencies несовместимы с новой линейкой Nuxt |
| Robots | транзитивный 5.5.6 | прямой @nuxtjs/robots 6.2.0 | kit 4.5.2+, общая site-config 4.2.3+; используемый API проверен в npm tarball |
| Sitemap | транзитивный 7.4.7 | прямой @nuxtjs/sitemap 8.5.0 | kit 4.5.2+, общая site-config 4.2.3+; whitelist/locale API сохранён |
| PostCSS | 8.5.6 | 8.5.28 | Конкретная версия исправления из текущего audit; старый lock содержит несколько уязвимых диапазонов |

Nuxt 4.5.2 требует Node `^22.19.0 || ^24.11.0 || >=26.0.0`; выбранная основным исполнителем Node 24.15+ соответствует этому условию. Из `npm view nuxt@4.5.2 dependencies`: Unhead/@unhead/vue `^3.3.1`, Vue `^3.5.40`, vue-router `^5.2.0`, devtools `^3.4.1`, devalue `^5.9.0`.

Старый `nuxt-schema-org@5.0.9` требует Unhead/@unhead/vue `^2.0.7`; `nuxt-og-image@5.1.12` требует @unhead/vue `^2.0.5`. Поэтому повышение только Nuxt при сохранении старого SEO umbrella не выбрано. Версия 4.4.8 остаётся на Unhead 2, но попадает в часть новых Nuxt island advisory ranges `<4.5.1`; её нельзя выбирать как достаточное security исправление этого audit.

## Почему удаляется генератор OG

В коде приложения не используются `defineOgImage*` или специальные OG-шаблоны. Публичные OG-метаданные используют существующий `logo.png`. Старый генератор приносил `playwright-core`, Satori, resvg native/WASM, UnoCSS и вспомогательные зависимости. Удаление всего umbrella вместо простого `ogImage.enabled:false` исключает их из dependency tree, если иных потребителей нет; фактическую экономию deployment bundle требуется измерить после сборки.

Генератор 5.1.12 также входит в опубликованные диапазоны SSRF/XSS/DoS `<6.2.5`. Не выполняется тест атаки на production. [Первичный advisory SSRF](https://github.com/nuxt-modules/og-image/security/advisories/GHSA-pqhr-mp3f-hrpp), [XSS advisory](https://github.com/nuxt-modules/og-image/security/advisories/GHSA-mg36-wvcr-m75h).

JSON-LD уже реализован существующими компонентами и `nuxt.config.js`, canonical/hreflang — i18n. Для них не нужен runtime `nuxt-schema-org` или `nuxt-seo-utils`. После удаления umbrella остаются только i18n, robots, sitemap и Tailwind.

## Проверка API до установки

Пакеты `@nuxtjs/robots@6.2.0`, `@nuxtjs/sitemap@8.5.0`, `@nuxtjs/i18n@10.6.0` загружены командой `npm pack` и распакованы отдельно от исходников: `C:/Users/Admin/Documents/ot-center-seo-dependency-review-20260907`. Lockfile и node_modules приложения этой исследовательской операцией не менялись.

Проверены непосредственно `dist/module.d.mts` / `dist/runtime/types.d.ts`: sitemap сохраняет `excludeAppSources`, `autoI18n`, `autoLastmod`, `discoverImages`, `discoverVideos`, `urls[].alternatives`, `cacheMaxAgeSeconds`; robots сохраняет `sitemap`, `disallow`, `disallowNonIndexableRoutes`, `mergeWithRobotsTxtPath`. i18n сохраняет `useLocaleHead({dir,lang,seo})`, `strictSeo` по умолчанию false. [API useLocaleHead](https://i18n.nuxtjs.org/docs/composables/use-locale-head).

Первичные источники Nuxt: [релиз 4.5.2](https://github.com/nuxt/nuxt/releases/tag/v4.5.2), [список security advisories](https://github.com/nuxt/nuxt/security/advisories), [Nuxt island runtime template injection](https://github.com/nuxt/nuxt/security/advisories/GHSA-9473-5f9j-94wq). Дополнительно audit ссылается на [GitHub advisory database: Nuxt DevTools RPC](https://github.com/advisories/GHSA-279x-mwfv-vcqv).

## Что необходимо подтвердить после установки

1. Чистое разрешение peer dependencies и новый lock без `--force` / `--legacy-peer-deps`; удалить временный Svelte6 override, если новая Nuxt/Vite линейка его больше не требует.
2. Повторить npm audit по новому lock, разделить prod и dev воздействие; не считать прежние 49 автоматически исправленными.
3. Build, типы и тесты auth/learning/платежей; смена Unhead/router затрагивает приложение даже при сохранении major Nuxt.
4. HTTP SSR contracts и визуальные снимки после перезапуска: runtime canonical, hreflang, sitemap, реальные 404, private/no-store, сохраняемый дизайн.
5. Проверить deploy artifact Vercel на размеры и отсутствие удалённых OG runtime routes. Деплой не выполнять без отдельного разрешения владельца.
# Runtime Vercel после проверки артефакта

В первом успешном `build:vercel` обнаружена разница: локальный build/`engines.node` используют Node 24, а Nitro создал `.vc-config.json` с `nodejs22.x`. Установленный preset `nitropack/dist/presets/vercel/utils.mjs` содержит список `[18, 20, 22]` и при build на Node 24 выбирает последний элемент. Поэтому в исходном `nuxt.config.js` явно указан поддерживаемый `nitro.vercel.functions.runtime: 'nodejs24.x'`; `.vc-config.json` вручную не меняется. Чистая Vercel-пересборка `34a99837` фактически подтвердила runtime 24 и maxDuration 60; SEO и полная проверка локальных asset/payload references прошли.

Vercel официально поддерживает Node 24 для builds и functions; выбирается major version, минорные и patch обновления управляются платформой. Источники, проверенные 2026-09-07: [Supported Node.js versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions), [Node.js 24 LTS generally available](https://vercel.com/changelog/node-js-24-lts-is-now-generally-available-for-builds-and-functions).
