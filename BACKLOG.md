# Backlog

Last updated: 2026-02-13

## Overnight Queue (Target: 2026-02-12 Morning)
- [x] WS1 Fame XP UX: add next-unlock and points-to-next-level clarity across singer profile surfaces.
- [x] WS2 Shared user-meta component: unify VIP badge + fame progress rendering in lobby, leaderboard, and public profile.
- [x] WS3 Room-user data consistency: ensure `isVip`, `vipLevel`, `fameLevel`, and `totalFamePoints` are kept in sync for active room users.
- [x] WS4 Turnkey onboarding foundation: ship account -> org/workspace -> plan -> branding baseline -> first room launch skeleton.
- [x] WS5 Capability gating foundation: centralize entitlement keys and enforce them in both client feature gates and callable backend paths.
- [x] WS6 Pass-through/markup invoicing: extend overage invoice logic and QBSE export mapping to prevent absorbing variable cloud/API costs.
- Runbook: `docs/OVERNIGHT_EXECUTION_QUEUE_2026-02-11.md`

## P0 - Blocking (Launch/Safety)
- VIP SMS auth live sign-off: execute final manual browser reCAPTCHA + phone verification with both a Firebase test number and a real number, then append evidence to `docs/qa/P0_VERIFICATION_2026-02-12.md`.

## P1 - High Priority
- Turnkey customer onboarding + subscriptions: build a self-serve flow to onboard additional organizations/users with monthly subscription signup, provisioning, and entitlement gating to app features.
- Subscription foundation: implement hosted subscription checkout + webhook entitlement sync + cancellation/renewal handling.
- Organization/workspace model: add org-level ownership, roles, and room-to-org mapping for multi-customer operation.
- Capability gating: enforce feature entitlements in both client UI and cloud functions (single source of truth for plan capabilities).
- Turnkey onboarding wizard: account -> workspace -> plan -> branding -> first room launch.
- Public TV 10-foot UX pass: continue readability polish (sidebar density, chat/activity typography, reduce overlay collision during high-intensity scenes).
- VIP profile onboarding: enforce ToS consent and required fields; allow profile edits from app.
- Fame XP UX: clearer "next unlock" and progress feedback in profile surfaces.

## P2 - Medium
- Usage metering + overage billing: per-org usage ledger, included quotas, overage invoicing, and reconciliation against cloud billing.
- Workspace customization pack: theme tokens, reusable templates, and sponsor/branding controls at org scope.
- Admin billing portal: plan management, invoices, usage dashboard, and payment method updates.
- Host auth hardening (deferred): add robust account/role-based host login and host session management without breaking today's fast "jump in and host" flow (keep low-friction quick-start as primary path).
- Host mobile UX pass (deferred): optimize host controls for phone/tablet with mobile section drawer, sticky live command rail, one-thumb quick actions, queue swipe gestures, and unified moderation inbox.
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
- P0 verification report (2026-02-12): production deploy + App Check enforcement + auth/upload smoke completed and documented in `docs/qa/P0_VERIFICATION_2026-02-12.md`.
- Host create/join reliability playtest: guarded join flow validated for create/join/missing-room/re-auth/poor-network scenarios via `scripts/qa/host-join-playtest.mjs`.
- Firestore `/users/{uid}` production smoke: own create/update/read passed and cross-user write denied via `scripts/qa/users-profile-smoke.mjs`.
- VIP SMS auth readiness verification: runbook/env/code checks completed via `scripts/qa/vip-sms-readiness.mjs` (manual live SMS handshake remains as explicit P0 sign-off).
- Overnight WS1 ship: added fame unlock snapshot helper + "Next Unlock" blocks in singer profile and public profile.
- Overnight WS2 ship: added shared `UserMetaCard` component and migrated lobby/leaderboard/public-profile surfaces to use it.
- Overnight WS3 ship: introduced normalized room-user projection writes for join/profile/VIP/fame sync paths.
- Overnight WS4 ship: added `bootstrapOnboardingWorkspace` callable and wired Host onboarding wizard workspace provisioning to callable bootstrap.
- Overnight WS5 ship: added central capability keys, Host feature gating, and backend capability enforcement for YouTube + invoice draft callables.
- Overnight WS6 ship: added pass-through + markup rate-card metadata to usage summaries/invoice drafts, expanded QBSE CSV columns, and persisted rate-card snapshots with invoice records.
- Public profile viewer polish: aligned lobby/leaderboard/public-profile presentation with consistent VIP badge treatment and fame level/progress display.
- VIP profile onboarding enforcement: required VIP profile fields (location + birthday + ToS), automatic onboarding prompt for incomplete VIP accounts, and explicit in-app VIP profile edit path from Singer Social/Profile.
- Invoice draft export foundation: added period-based invoice draft generation (`getMyUsageInvoiceDraft`) with overage line items, totals/tax support, and QuickBooks Self-Employed CSV outputs.
- Invoice lifecycle persistence: added org-scoped invoice snapshot save/list callables (`saveMyUsageInvoiceDraft`, `listMyUsageInvoices`) and Host Billing invoice history/status/notes workflow.
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
