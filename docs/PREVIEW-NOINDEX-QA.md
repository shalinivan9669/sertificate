# Explicit noindex preview verification — 2026-09-07

`build:vercel` invokes `seo-build-check.mjs`, which imports the shared HTML inspection function from `seo-http-check.mjs`. Previously that function always rejected `noindex`, although `nuxt.config.js` deliberately sets `site.indexable=false` when `OT_NOINDEX=true`. A preview using that explicit setting therefore conflicted with its own build gate.

The shared checker now accepts an explicit `indexable` option. Its default remains strict: public HTML must not contain `noindex`. With `indexable:false`, public HTML must contain `noindex`; it is not merely exempt from the assertion. The build checker and HTTP CLI derive this option only from the exact environment value `OT_NOINDEX=true`. All canonical, title, description, SSR H1, language, hreflang, private-route and sitemap inventory assertions remain active. In the HTTP checker, a non-indexable site's robots file must contain `Disallow: /`; an indexable site's robots file must advertise its sitemap and must not block the entire site.

## Actual isolated cold build

- Source: `git archive HEAD`, commit `1e23fc58a68af50917f0334b037a356c28de8fc4`, plus the two checker changes and regression test.
- Scratch directory: `C:\Users\Admin\Documents\ot-noindex-check-20260907-192814`; the application's running `.output` and `.vercel` artifacts were not modified.
- Commands: `npm ci`, then `OT_NOINDEX=true VERCEL=1 VERCEL_ENV=preview OT_APP_ENV=staging npm run build:vercel` (environment set using PowerShell).
- `npm ci`: 1056 packages installed, 1058 audited, zero reported vulnerabilities, exit 0.
- Cold Vercel build: **exit 0**, 1105 prerender routes including payloads, **550/550 public HTML SEO checks**.
- Asset check: **551 HTML files**, **15,770 references**, **zero missing assets**, one Nuxt build ID `84765834-4535-434d-a2f3-42766754a0eb`.
- Actual generated homepage: `<meta name="robots" content="noindex, nofollow">`.
- Actual generated `robots.txt`: `User-agent: *` and `Disallow: /`; no Sitemap line, matching the installed robots module's non-indexable mode.
- Actual generated `sitemap.xml`: present and contains **exactly all 550 expected public URLs**. No sitemap exception or reduced inventory was necessary.

The generated files were read directly. An HTTP suite was not run against a second server for this check; existing application servers were left intact. This is local deployment-artifact evidence, not proof of a remote database, mail delivery, CRM delivery, or production promotion. The scratch logs are `noindex-npm-ci.log` and `noindex-build.log`; the asset report is preserved in the application as `artifacts/seo/vercel-assets-noindex-84765834.json`.

## Regression checks

- `node --test tests/seo-indexability.test.mjs`: **2/2 passed**, covering rejection of noindex by default and rejection of indexable HTML in explicit non-indexable mode.
- `npm test`: **93/93 passed**, zero failures or skips, exit 0; `implementation-noindex-checker-tests.log`.
- `npx eslint scripts/seo-http-check.mjs scripts/seo-build-check.mjs tests/seo-indexability.test.mjs`: exit 0.
- `git diff --check`: exit 0 (only existing line-ending notices).

## Environment boundary checked in source

An AMO-only Vercel environment can build and serve public static pages. The new durable contact submission, authentication and account workflows additionally require a configured remote libSQL/Turso database and all five migrations. Vercel deliberately has no writable-local-database fallback. `/api/ready` returns 503 without that database/schema; a 200 only establishes schema readiness, not authentication or external integrations.

Authentication also needs a secret of at least 32 characters and `BETTER_AUTH_URL` set to the actual HTTPS origin. Verification/reset delivery needs SMTP configuration plus its explicit delivery flag. CRM processing needs its delivery flag in addition to AMO credentials; scheduled outbox processing needs `CRON_SECRET`. Mail and CRM flags remain separate from deployment authorization. Approved learning versions and credential templates are still required for their corresponding workflows; static service inventory does not create them. Live payment processing is not implemented and must not be represented as enabled.

No account settings were changed in this check. No Linux runtime was executed here. Source inspection found no relative-import case mismatch in the inspected application/server/script directories, and the lockfile contains Linux libSQL packages. The repository CI uses Ubuntu and Node 24; browser scripts' Windows Chrome default is outside that workflow. A future Linux browser job must set its browser path, and credential tests require an available Unicode font. These are environment requirements, not observed failures in this noindex build.
