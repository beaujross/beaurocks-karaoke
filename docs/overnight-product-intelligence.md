# Overnight Product Intelligence

This runner is meant to spend a long unattended block checking the live product and leave a morning artifact behind.

## What it does

- Repeated Playwright sweeps of the live marketing/product routes:
  - `/`
  - `/discover`
  - `/demo`
  - `/for-fans`
  - `/for-hosts`
  - `/for-venues`
  - a small sample of live event/venue/host/session detail pages from the route manifest
- Screenshot capture for every route on every cycle
- DOM/content heuristics:
  - above-fold word density
  - visual coverage
  - missing map/demo surfaces
  - missing imagery on detail pages
  - host profile image presence on detail pages
- Request/runtime error collection
- One directory-growth dry-run for content/data quality context
- Repeated audience/TV/host smoke runs during the overnight window

## Default run

```bash
npm run ops:overnight:intelligence
```

Default behavior:

- `6` hour duration
- `20` minute route-sweep interval
- live base URL `https://host.beaurocks.app`

## Useful flags

```bash
node scripts/ops/overnight-product-intelligence.mjs --duration-hours 2 --interval-minutes 10
node scripts/ops/overnight-product-intelligence.mjs --skip-smokes
node scripts/ops/overnight-product-intelligence.mjs --skip-directory-audit
node scripts/ops/overnight-product-intelligence.mjs --out-dir artifacts/overnight/manual-test
```

## Outputs

Each run writes to:

```text
artifacts/overnight/product-intelligence/<timestamp>/
```

Main files:

- `overnight-report.json`
- `overnight-summary.md`
- `cycles/cycle-XX.json`
- `screenshots/*.png`
- `steps/*.json`

## Recommended morning review order

1. Open `overnight-summary.md`
2. Review the newest `/demo`, `/discover`, and `/` screenshots
3. Review repeated route issues across cycles
4. Review the overnight smoke results
5. Review the directory dry-run report if content/data issues appeared
