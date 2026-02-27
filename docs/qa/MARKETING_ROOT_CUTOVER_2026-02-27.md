# Marketing Root Cutover Verification (2026-02-27)

Scope:
- Permanent redirect policy for legacy marketing URLs.
- SEO manifest/sitemap completeness for detail pages.
- Cross-surface link validation from marketing to app/host/tv.
- Marketing conversion analytics + attribution verification.

## 1) Redirect Policy (Enforced)

Canonical marketing routes are path-based:
- `/for-fans`
- `/discover`
- `/for-hosts`
- `/for-venues`
- `/for-performers`
- `/demo`
- `/host-access`
- detail routes such as `/venues/:id`, `/events/:id`, `/hosts/:id`, `/sessions/:id`, `/performers/:id`

Legacy compatibility:
- `/marketing` and `/marketing/**` now return `301` redirects to canonical path routes via Firebase Hosting.
- `?mode=marketing&page=...` is canonicalized client-side to canonical paths (query removed, UTM preserved).

Verification:
```powershell
curl -I https://beaurocks.app/marketing
curl -I https://beaurocks.app/marketing/for-hosts
```
Expected:
- HTTP status `301`
- `Location` header points to canonical path route.

## 2) SEO Completeness (Detail Routes)

`scripts/generate-sitemap.mjs` now supports dynamic Firestore manifest generation with explicit credential wiring.

Supported env wiring for Firestore source:
- `SITEMAP_FIREBASE_SERVICE_ACCOUNT_JSON`
- `SITEMAP_FIREBASE_SERVICE_ACCOUNT_FILE`
- `SITEMAP_FIREBASE_PROJECT_ID`

Strict gates:
- `SITEMAP_STRICT_FIRESTORE=true` -> fail build if Firestore source is unavailable.
- `SITEMAP_REQUIRE_DETAIL_ROUTES=true` -> fail build if Firestore source returns empty `detailRoutes`.

Verification:
```powershell
$env:SITEMAP_STRICT_FIRESTORE="true"
$env:SITEMAP_REQUIRE_DETAIL_ROUTES="true"
npm run seo:sitemap
```
Expected:
- `public/marketing-route-manifest.json` has non-empty `detailRoutes`.
- `public/sitemap.xml` contains detail URLs for indexed entities.

## 3) Cross-Surface QA (Desktop + Android + iOS Safari-like)

Automated:
```powershell
npm run qa:marketing:cross-surface
```

Script validates:
- legacy redirect convergence (`/marketing`, `?mode=marketing&page=...`) to canonical routes
- marketing demo launch links for Audience/App, Public TV, Host Deck
- route/query correctness (`room`, `mode=tv`, `mode=host`)
- loadability of target links across desktop Chromium, Android emulation, and iOS WebKit emulation

## 4) Analytics + Attribution Validation

Automated (same command as above):
```powershell
npm run qa:marketing:cross-surface
```

Checks include:
- root-domain conversion CTA from `/for-fans` to `/host-access`
- UTM propagation (`utm_source`, `utm_medium`, `utm_campaign`, `utm_content`)
- conversion event recorded: `mk_home_launch_cta_click`
- page-view event recorded: `mk_page_view_host_access`
- telemetry queue entry includes session context for attribution continuity
