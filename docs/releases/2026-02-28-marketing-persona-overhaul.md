# Release Note: Marketing Persona Overhaul (2026-02-28)

## Summary
- Shipped a major marketing UX/IA refresh centered on host-first conversion and stronger persona-specific pages.
- Deployed live to Firebase Hosting and pushed to `main`.

## Delivered
- Host page overhaul:
  - clearer orchestration-layer narrative
  - compatibility framing ("works with your stack")
  - stronger CTA hierarchy and proof sections
- Persona page overhauls:
  - `for-venues`
  - `for-performers`
  - `for-fans`
- Conversion pass:
  - standardized CTA reporting on persona pages
  - added `mk_home_conversion_click` usage for key home conversion interactions
  - tightened conversion-oriented home copy
- Demo improvements included in same release:
  - host iframe deep-link to admin workspace context
  - host embed fallback bootstrap for missing demo room

## Files
- `src/apps/Marketing/pages/ForHostsPage.jsx`
- `src/apps/Marketing/pages/ForVenuesPage.jsx`
- `src/apps/Marketing/pages/ForPerformersPage.jsx`
- `src/apps/Marketing/pages/ForFansPage.jsx`
- `src/apps/Marketing/MarketingSite.jsx`
- `src/apps/Marketing/marketing.css`
- `src/apps/Marketing/pages/DemoExperiencePage.jsx`
- `src/apps/Host/HostApp.jsx`

## Deployment
- Hosting URL: `https://beaurocks-karaoke-v2.web.app`
- Commit: `070b677`
- Branch: `main`

## Follow-Ups
- Performance: split oversized chunks (`HostApp`, firebase vendor) to reduce bundle warnings.
- Continue analytics hygiene by enforcing canonical CTA field naming in new marketing components.

