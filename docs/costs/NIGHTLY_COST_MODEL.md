# Nightly Cost Model (Hosting + AI)

Last updated: 2026-02-12
Owner: Product/Finance

## Purpose

This file estimates cost to run one karaoke night and gives pricing guardrails for business model planning.

It is intentionally split into:

1. Infra COGS (Firebase/GCP only)
2. Infra + AI/API reserve (using current app meter pass-through assumptions)

Why both:
- Infra COGS tells us true platform burn.
- Reserve model tells us what to charge so variable feature usage does not destroy margin.

## Source Inputs

### A) App-specific metering and rate assumptions (in repo)

- Meter definitions and pass-through defaults:
  - `functions/lib/entitlementsUsage.js`
  - `ai_generate_content.passThroughUnitCostCentsByPlan.host_monthly = 2`
  - `youtube_data_request.passThroughUnitCostCentsByPlan.host_monthly = 1`
  - `apple_music_request.passThroughUnitCostCentsByPlan.host_monthly = 1`

### B) Baseline cloud unit prices used in this model

These are planning defaults and should be refreshed monthly from provider pages.

- Firestore reads: `$0.06 / 100k`
- Firestore writes: `$0.18 / 100k`
- Firestore deletes: `$0.02 / 100k`
- Cloud Functions invocation: `$0.40 / 1M`
- Hosting egress: `$0.15 / GB`
- Storage at rest: `$0.026 / GB-month`
- Storage egress: `$0.12 / GB`

References to refresh prices:
- Firebase pricing: https://firebase.google.com/pricing
- Firestore pricing: https://firebase.google.com/docs/firestore/pricing
- Cloud Storage pricing: https://cloud.google.com/storage/pricing
- Cloud Functions pricing: https://cloud.google.com/functions/pricing
- Google AI pricing (Gemini): https://ai.google.dev/pricing
- OpenAI pricing: https://openai.com/api/pricing/

## Scenario Assumptions (Per Night)

Three operating profiles:

- `Casual`: neighborhood bar / low throughput
- `Busy`: typical Friday/Saturday live room
- `Tournament`: high-energy event with heavy game and audience interaction

Assumption snapshot:

| Scenario | Hours | Avg active users | Page loads | Chat msgs | Raw reactions | Songs | Selfies | Game writes | Hosting egress (GB) | Storage new (GB) | AI req | YouTube req | Apple req |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Casual | 3 | 25 | 45 | 120 | 1,800 | 30 | 10 | 150 | 2.5 | 0.25 | 25 | 120 | 80 |
| Busy | 4 | 75 | 140 | 450 | 10,000 | 80 | 40 | 600 | 8.0 | 1.0 | 120 | 600 | 400 |
| Tournament | 6 | 180 | 320 | 1,400 | 36,000 | 180 | 120 | 2,200 | 22.0 | 3.5 | 400 | 1,800 | 1,200 |

Notes on write/read estimation:
- Reaction writes use batching/compression (`raw reactions / compression factor`) from current app behavior.
- Read model includes join burst + ongoing listener churn (reduced by recent chat/hall gating work).

## Estimated Cost Per Night

### 1) Infra COGS (Firebase/GCP only)

| Scenario | Firestore reads | Firestore writes | Infra COGS/night |
|---|---:|---:|---:|
| Casual | 12,200 | 700 | **$0.42** |
| Busy | 45,100 | 2,640 | **$1.38** |
| Tournament | 149,700 | 8,250 | **$3.89** |

### 2) Infra + Current Feature Reserve (from meter pass-through defaults)

Reserve adders used:
- AI generation: `$0.02 / request`
- YouTube metadata request: `$0.01 / request`
- Apple Music request: `$0.01 / request`

| Scenario | Infra COGS/night | AI/API reserve/night | Total variable/night |
|---|---:|---:|---:|
| Casual | $0.42 | $2.50 | **$2.92** |
| Busy | $1.38 | $12.40 | **$13.78** |
| Tournament | $3.89 | $38.00 | **$41.89** |

### 3) Alternative "closer-to-provider" AI-only view (Gemini request-cost planning)

For planning sensitivity only, we also modeled AI at ~`$0.003/request`.

| Scenario | Infra COGS/night | Gemini-only AI/night | Infra + Gemini/night |
|---|---:|---:|---:|
| Casual | $0.42 | $0.08 | **$0.50** |
| Busy | $1.38 | $0.36 | **$1.74** |
| Tournament | $3.89 | $1.20 | **$5.09** |

## Monthly Rollups (8 / 12 / 20 nights)

### Infra COGS only

| Scenario | 8 nights | 12 nights | 20 nights |
|---|---:|---:|---:|
| Casual | $3.36 | $5.05 | $8.41 |
| Busy | $11.03 | $16.55 | $27.58 |
| Tournament | $31.15 | $46.72 | $77.87 |

### Infra + current feature reserve

| Scenario | 8 nights | 12 nights | 20 nights |
|---|---:|---:|---:|
| Casual | $23.36 | $35.05 | $58.41 |
| Busy | $110.23 | $165.35 | $275.58 |
| Tournament | $335.15 | $502.72 | $837.87 |

## What Is Driving Cost (Busy Scenario)

Infra-only contribution:
- Hosting egress: ~87%
- Storage egress: ~10%
- Firestore reads: ~2%
- Everything else: <1%

With current AI/API reserve included:
- YouTube request reserve: ~43.5%
- Apple request reserve: ~29.0%
- AI generation reserve: ~17.4%
- Hosting egress: ~8.7%

Interpretation:
- True infra burn is mostly media/network egress.
- Current meter reserve values dominate "chargeable variable cost"; this is useful for pricing defense but may overstate direct provider cost.

## Pricing Guardrails (Business Model)

Recommended minimum nightly charge floor:

- Casual: at least `$10/night`
- Busy: at least `$25/night`
- Tournament: at least `$60/night`

Rationale:
- Covers variable cost under both optimistic and conservative assumptions.
- Leaves room for support, failed requests, refunds, and payment fees.

If selling monthly host plans, tie to expected nights/month:
- Example target: 12 busy nights/month implies reserve-aware variable envelope around `$165/month`.
- If plan price is lower, enforce quotas and hard limits aggressively or reduce metered feature costs.

## Recommended Next Steps (to tighten this model)

1. Instrument actual nightly usage export per room:
- Firestore reads/writes/deletes by collection
- Function invocation counts
- Hosting and Storage egress by room/night

2. Add `docs/costs/nightly-cost-model-inputs.json` and regenerate this file automatically monthly.

3. Re-price `youtube_data_request` and `apple_music_request` meter pass-through values if they are materially above true provider cost.

4. Add a host-facing "Night Cost Preview" panel in Billing using the same formulas.

## Change Log

- 2026-02-12: Initial per-night model added for business modeling.
