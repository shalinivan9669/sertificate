# SEO CTR release — 2026-09-30

This release updates the existing OT Center public site. It does not migrate routes, pricing, databases, forms, or CRM contracts.

## Changes

- Unique RU/KK title and description for all 20 course directions, with matching OG/Twitter and reactive client navigation.
- Canonical, alternate and og:url normalization for the three historical course-card aliases. Actual URLs and enquiry context remain available; no redirects or blanket noindex were added.
- Direction-specific guidance, FAQ and existing article links for occupational safety, industrial safety and electrical safety in both languages.
- Conditional duration, document and format wording; revised national/city description for industrial and electrical safety without unsupported fixed-hour promises.
- Safe handling of temporarily absent selection results on the multi-program selection page.
- SEO contracts for 46 course-card routes, exact canonical/locale metadata, duplicate detection and an explicit requirement to check dynamic routes over HTTP.

## Verification before release

- 329 tests passed in the complete sequential run; ESLint and Nuxt typecheck passed.
- Final Node SSR build passed. 578 prerendered pages passed SEO checks.
- Fresh local HTTP audit passed: 602 public pages, 10 private noindex/no-store routes, 6 true 404 routes and 578 unique sitemap URLs.
- Browser checks passed on desktop and mobile: RU/KK metadata updates, historical aliases, enquiry city/format/program context, multi-direction selection and private-to-public head cleanup. No real lead or payment was submitted.

Production is released through the existing Git-to-Vercel integration. The deployment status and live-domain verification must be recorded separately after publishing; local checks alone do not prove deployment, indexation or CTR growth.

## Measurement

Use the recorded pre-release Search Console baseline. Compare query/page pairs over comparable 28-day windows after recrawling, segment by device/country and query intent, and account for position changes. Track clicks and accepted leads alongside CTR. The private analytics baseline and local evidence files are intentionally not part of this Git commit.
