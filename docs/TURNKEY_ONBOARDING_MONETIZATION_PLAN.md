# Turnkey Onboarding and Monetization Plan

Last updated: 2026-02-11

## Objective

Enable self-serve onboarding for additional paying customers, with clear subscription packaging, entitlement gating, and cost controls so unit economics remain positive as usage scales.

## Current State (What Exists vs. Gaps)

What exists now:
- Product catalog includes points packs and subscription IDs (`vip_monthly`, `host_monthly`) in `src/billing/catalog.js`.
- Web Stripe checkout exists for points and tip crates in `functions/index.js` (`createPointsCheckout`, `createTipCrateCheckout`).
- Stripe webhook idempotency pattern exists for one-time purchases in `functions/index.js` (`stripe_events` dedupe).
- iOS and subscription purchase paths are scaffolded but not implemented:
  - `purchaseSubscription()` throws "not wired yet" in `src/billing/provider.js`.
  - `verifyAppleReceipt` throws "not configured yet" in `functions/index.js`.
- Basic branding customization exists (room logo presets + upload) in `src/apps/Host/components/HostLogoManager.jsx`.
- User subscription shape exists in `src/lib/firebase.js` (`subscription.tier`, `plan`, dates), but entitlement enforcement is still inconsistent.

Main gap:
- The app has monetization primitives, but not a complete SaaS customer lifecycle (signup -> pay -> provision -> enforce entitlements -> meter usage -> invoice/reconcile).

## Recommended Business Model (Fine-Tuned)

Use a two-part model:
- Base platform subscription (predictable recurring revenue).
- Usage-priced add-ons (protect margin on variable cloud and API costs).

Suggested packaging:
1. Core Host Plan (monthly/annual):
- Includes one organization/workspace, host console, singer app, TV app.
- Includes fixed usage allowance (storage, monthly active singers, AI generations, SMS).

2. Add-on Packs:
- Branding Pack: theme tokens, logos, sponsor overlays, custom messages.
- Analytics Pack: exports, cohort/retention reports, leaderboard insights.
- Automation/AI Pack: auto-DJ helpers, AI game content, playlist suggestions.
- Communications Pack: SMS reminders/alerts.

3. Overage Billing:
- For usage beyond included quotas, charge pass-through + markup.

Pricing principles:
- Keep plan count small (2-3 paid plans + add-ons).
- Put high-variable-cost features (AI, SMS, media-heavy storage/egress) behind quotas and overages.
- Avoid unlimited promises unless strict fair-use enforcement exists.

## Turnkey Customer Onboarding Requirements

Self-serve onboarding flow should create, in order:
1. Account identity (owner user).
2. Organization/workspace.
3. Subscription checkout.
4. Entitlement record.
5. Default room/template and branding baseline.
6. First-run checklist (logo, host profile, queue rules, tip settings, moderation settings).

Minimum onboarding UX screens:
1. "Create your karaoke workspace"
2. "Choose plan"
3. "Billing details"
4. "Brand setup"
5. "Launch your first room"

## Customization Features: Needed/Missing

Available now:
- Room logo management and logo library.

Missing for true turnkey:
1. Theme system:
- Brand colors, font presets, overlay style presets, sponsor placements.

2. Workspace branding:
- Organization name, public slug, default assets, reusable templates across rooms.

3. Host controls by package:
- Feature toggles for queue rules, game modes, moderation presets, automation presets.

4. Role-based team access:
- Owner/admin/host/operator roles for organizations.

5. Reusable event templates:
- Save and apply room presets (branding + rules + automation).

6. Customer-facing admin:
- Billing portal, usage dashboard, invoice history, plan change/cancel controls.

## Modularity Plan to Monetize App Pieces

Introduce capability-based architecture.

Core idea:
- Every billable feature maps to a capability key.
- UI and backend both enforce capability checks.

Example capability keys:
- `branding.logo_custom`
- `branding.theme_tokens`
- `automation.auto_dj`
- `analytics.export_csv`
- `games.trivia`
- `games.wyr`
- `communications.sms_alerts`
- `ai.generate_bingo`

Implementation shape:
1. Data model:
- `organizations/{orgId}`
- `organizations/{orgId}/subscription/current`
- `organizations/{orgId}/entitlements/current`
- `organizations/{orgId}/usage/{yyyymm}`
- `rooms/{roomCode}` includes `orgId`.

2. Client:
- Add `useEntitlements(orgId)` hook.
- Add `<FeatureGate capability="...">` wrapper for gated UI.

3. Backend:
- Callable functions validate entitlements before side effects.
- Centralized policy helper in `functions/index.js`.

4. Refactor boundary:
- Move monetizable domains into modules (billing, branding, analytics, communications, AI tools) rather than embedding logic in very large app shells.

## Pass-Through and Markup of Google Cloud Costs

Goal:
- Do not absorb unbounded variable cost.

Recommended billing mechanics:
1. Meter usage per organization:
- Track billable units in app telemetry + function writes:
  - Storage GB-month by org.
  - Egress GB by org.
  - Cloud Function invocations/CPU buckets by billable feature.
  - External API usage (YouTube/Apple/AI/SMS) by org.

2. Allocate shared infra cost:
- Use usage-based allocation where resource-level tagging is not available.
- Keep allocation formula documented and stable.

3. Invoice formula:
- `monthly_charge = base_plan + sum(overage_units * rate_per_unit) + add_ons`.
- Set `rate_per_unit = unit_cost * markup_factor`.
- Start with a target markup factor that covers support, failures, and payment fees.

4. Guardrails:
- Quotas and hard limits per plan.
- Budget alerts per org and global.
- Auto-throttle/disable expensive features when quota exhausted.
- Admin warning banner before overage events.

5. Reconciliation:
- Monthly close process: compare metered usage vs cloud billing export trends.
- Flag anomalies before charging customers.

## Delivery Phases

Phase 0 (1 week): Commercial baseline
- Finalize package matrix and capability keys.
- Decide included quotas + overage policy.
- Write billing terms for overages and fair use.

Phase 1 (2-3 weeks): Subscription and entitlements foundation
- Implement subscription checkout for web.
- Implement webhook-driven entitlement sync.
- Add organization + entitlement documents.
- Gate critical premium features with capability checks.

Phase 2 (2-3 weeks): Turnkey onboarding + customization
- Ship organization onboarding wizard.
- Ship workspace branding defaults and templates.
- Ship billing portal and plan management.

Phase 3 (2-4 weeks): Usage metering + overage billing
- Implement per-org usage ledger.
- Build monthly usage reporting and invoice line-item generation.
- Add quota alerts, throttles, and admin usage dashboard.

## KPIs to Track

Business:
- Trial-to-paid conversion.
- MRR and net revenue retention.
- ARPA by plan.
- Gross margin by plan and by organization cohort.

Product:
- Onboarding completion rate.
- Time-to-first-live-room.
- 30-day host retention.
- Feature adoption per capability.

Financial risk:
- Variable cost as % of revenue.
- Overage capture rate.
- % of organizations exceeding included quotas.

## Definition of Done for "Turnkey Onboarding"

All must be true:
1. New customer can self-serve from signup to first room without manual internal ops.
2. Subscription status automatically grants/revokes entitlements.
3. Premium features are enforced in both UI and backend.
4. Usage is metered per organization and visible in admin UI.
5. Overage policy is active and tested end-to-end.

