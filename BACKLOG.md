# Backlog

Last updated: 2026-02-11

## P0 - Blocking (Launch/Safety)
- Firebase production safety: deploy and verify updated `storage.rules` + App Check enforcement in production; run auth/upload smoke tests.
- Host create/join reliability: run field playtest to validate new guarded join flow (auth preflight + room existence check) under poor network/re-auth scenarios.
- VIP SMS auth reliability: reCAPTCHA + phone verification must pass for test and real numbers, with setup documented.
- Firestore user writes: run production smoke checks for `/users/{uid}` in onboarding/profile-edit flow and verify no regressions.

## P1 - High Priority
- Turnkey customer onboarding + subscriptions: build a self-serve flow to onboard additional organizations/users with monthly subscription signup, provisioning, and entitlement gating to app features.
- Subscription foundation: implement hosted subscription checkout + webhook entitlement sync + cancellation/renewal handling.
- Organization/workspace model: add org-level ownership, roles, and room-to-org mapping for multi-customer operation.
- Capability gating: enforce feature entitlements in both client UI and cloud functions (single source of truth for plan capabilities).
- Turnkey onboarding wizard: account -> workspace -> plan -> branding -> first room launch.
- Public TV 10-foot UX pass: continue readability polish (sidebar density, chat/activity typography, reduce overlay collision during high-intensity scenes).
- VIP profile onboarding: enforce ToS consent and required fields; allow profile edits from app.
- Public profile viewer: show lobby/leaderboard profiles with VIP badge + fame progress.
- Fame XP UX: clearer "next unlock" and progress feedback in profile surfaces.

## P2 - Medium
- Usage metering + overage billing: per-org usage ledger, included quotas, overage invoicing, and reconciliation against cloud billing.
- Workspace customization pack: theme tokens, reusable templates, and sponsor/branding controls at org scope.
- Admin billing portal: plan management, invoices, usage dashboard, and payment method updates.
- Emoji carousel UX: center selection on load and smooth touch behavior.
- Local media playback reliability: uploaded mp4/cors/permissions and fallback handling.
- VIP alerts (Twilio): host-configurable "notify before stage" timing + user opt-in.
- Points/monetization UX: simplify points + packs, and highlight room-boost crate flow.
- Chat moderation polish: host moderation controls and DM-to-host tooling.

## P3 - Nice-to-have
- Global UI polish: modal consistency, tooltips, and button standards.
- About BROSS refresh: more visual, less text-heavy.
- Expanded VIP cosmetics: unlock visuals and badge system polish.

## Recently Completed
- Invoice draft export foundation: added period-based invoice draft generation (`getMyUsageInvoiceDraft`) with overage line items, totals/tax support, and QuickBooks Self-Employed CSV outputs.
- Org usage metering foundation: added per-org monthly usage ledger + hard limit enforcement for AI generations (`ai_generate_content`) and surfaced usage/overage summary in Host Billing.
- Usage metering expansion: added per-org YouTube Data API and Apple Music API request meters with plan-based quotas/limits and detailed meter rows in Host Billing.
- Host feature guardrails: added selector-based UI feature checklist with one-click verification action and command palette entry to catch missing controls after refactors.
- Host IA foundation pass: added persistent panel layout state, workspace presets (Default/Performance/Crowd/Broadcast), and global Expand/Collapse/Reset controls.
- Host operator acceleration: added quick-action strip and Command Palette (`Ctrl/Cmd+K`) for high-frequency stage/TV/layout commands.
- Firebase rules validation: emulator security suite (`npm run test:rules`) passes for Firestore + Storage including `/users/{uid}` self-write protections (16 checks).
- VIP SMS reliability hardening: fixed duplicate reCAPTCHA container IDs, normalized phone input handling, and added actionable Firebase auth error messaging.
- VIP SMS operations doc: added `docs/VIP_SMS_AUTH_RUNBOOK.md` with setup + QA matrix for test and real numbers.
- Host room join hardening: separated join input state from active room subscriptions and added explicit auth + room existence validation before entering panel.
- Host smoke test expansion: now verifies `/users/{uid}` read and optional write to confirm onboarding/profile permissions in live environments.
- Host logo manager: preset logo library + custom logo upload + room-level logo library persistence.
- Storage support for branding uploads: `room_branding/{roomCode}/...` rules added with security tests.
- Host app modularization continued: QueueTab state/derived/media/song actions extracted into hooks and modal/components split out.
- Host chat popout UX cleanup: chat-only popout without unrelated top audio controls.
- Public TV chat privacy hardening: DM/private chat is filtered out of TV chat feed.
- Public TV branding hardening: stage logo now respects room host logo instead of hardcoded URL.
- Public TV QR hardening: replaced third-party QR service calls with local in-app QR generation.
- Public TV sidebar clarity: increased default upcoming queue count and added estimated wait-time indicator.
- Host TV controls clarity: explicit TV display mode controls (Video / Lyrics / Visualizer) added to both stage and TV dashboard controls.
- Playback precedence fix: media overrides now take priority and proactively stop Apple playback to prevent double/triple audio.
