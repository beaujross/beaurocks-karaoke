# Beaurocks Karaoke (BROSS)

Multi-screen karaoke platform with real-time Host, Singer (mobile), TV, and Recap experiences.

## Architecture and Assessment

- Architecture overview: `docs/ARCHITECTURE_OVERVIEW.md`
- Technical risks and priorities: `docs/TECH_RISKS_PRIORITIES.md`
- Billing notes (web Stripe + iOS IAP foundation): `docs/billing-iap.md`
- VIP SMS auth runbook: `docs/VIP_SMS_AUTH_RUNBOOK.md`
- QuickBooks Self-Employed invoicing flow: `docs/QUICKBOOKS_SELF_EMPLOYED_INVOICE_FLOW.md`
- Project history and lessons learned: `PROJECT_HISTORY_LESSONS_LEARNED.md`

## Development

- Create local env file before running dev:
  - `cp .env.example .env` (or copy manually on Windows)
  - Fill `VITE_FIREBASE_*` and `VITE_RECAPTCHA_V3_SITE_KEY`
  - Alternative runtime injection is supported via `window.__firebase_config`

- `npm run dev` - start local frontend
- `npm run build` - production build
- `npm run preview` - preview built app
- `npm run lint` - ESLint checks
- `npm run test:rules` - Firestore + Storage emulator security checks (requires Java)
- `npm run deploy:hosting` - build + deploy web app to Firebase Hosting
- Optional: set `VITE_BASE_PATH` only if deploying under a subpath (example: `/karaoke/`)

## Build Versioning (Host Launch Screen)

- Host launch now shows an auto-generated release/build string.
- Source values:
  - Release version: `package.json` -> `version`
  - Build metadata: UTC timestamp + short git SHA (generated in `vite.config.js`)
- Display format in Host launch: `v<package.version>+<UTCSTAMP>.<sha>`
- This updates on every build/deploy automatically, even if `package.json` version is unchanged.
- Optional release bump for investor/demo milestones:
  - `npm version patch` (or `minor` / `major`)
  - build + deploy as usual

## Deploy (Firebase Hosting)

One-time local setup:

1. Install Firebase CLI and log in:
   - `npm i -g firebase-tools`
   - `firebase login`
2. Confirm project mapping in `.firebaserc` (`beaurocks-karaoke-v2`).
3. Deploy manually:
   - `npm run deploy:hosting`

Automated deploys (GitHub Actions):

1. Add repo secret `FIREBASE_SERVICE_ACCOUNT_BEAUROCKS_KARAOKE_V2`.
2. Use a service account JSON with Firebase Hosting deploy permissions for project `beaurocks-karaoke-v2`.
3. Push to `main` to auto-deploy via `.github/workflows/firebase-hosting-deploy.yml`.
4. Open/update a PR targeting `main` to get a preview URL via `.github/workflows/firebase-hosting-preview.yml` (channel expires in 7 days).

---

# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
