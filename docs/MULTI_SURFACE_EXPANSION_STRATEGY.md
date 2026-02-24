# Multi-Surface Expansion Strategy

Last updated: 2026-02-23

## Objective

Grow participation and retention by extending BeauRocks to additional interaction surfaces without fragmenting core product logic.

Primary expansion surfaces:
- Discord (near-term, social growth + acquisition)
- Apple TV (near-term, premium living-room host experience)
- Apple Vision Pro (later-stage, differentiated premium mode)

## Product Thesis

BeauRocks wins when one live room supports many participant roles at once:
- Host controls the show.
- Singer performs.
- Audience reacts, votes, and competes.
- Spectators join from wherever they already are.

New surfaces should increase:
- Room fill rate
- Reaction velocity
- Session length
- Return rate

They should not require rebuilding game and room logic per platform.

## Surface Roles (Clear Ownership)

1. Core Web Surfaces (existing, source of truth)
- Host Console: show operations and moderation.
- Singer Mobile: queue, reactions, participation.
- Public TV: visual stage and crowd feedback.
- Recap: post-session share and retention.

2. Discord Surface (expansion)
- Role: social lobby, lightweight controls, async hype, distribution channel.
- Best jobs:
  - Start/join room from a server
  - Trigger reactions and polls
  - Share now-playing and recap cards
  - Bring spectators into mobile/TV flow
- Not the first target for:
  - Full host operations
  - Rich media rendering parity with TV

3. Apple TV Surface (expansion)
- Role: premium dedicated in-room stage client.
- Best jobs:
  - Reliable 10-foot display
  - Performance-optimized overlays and reactions
  - Lower setup friction for home/venue hosts

4. Apple Vision Pro (future)
- Role: immersive premium layer, not core dependency.
- Best jobs:
  - Spatial stage overlays
  - Advanced spectator/host presence
  - Premium event mode for standout experiences

## Strategic Principles

1. One room graph, many clients
- Firestore room state remains canonical.
- New clients read/write through shared contracts.

2. Adapter over rewrite
- Add per-surface adapters (Discord bot/webhooks, tvOS client shell, visionOS client shell).
- Keep game state and billing capability logic centralized.

3. Progressive capability exposure
- Surface only the subset of controls each platform can do well.
- Avoid duplicate host-control complexity across surfaces.

4. Entitlement-consistent everywhere
- VIP and host capabilities resolve from one entitlement model.
- Surface-specific perks can exist, but enforcement stays centralized.

5. Measure before deepening
- Ship thin integration first, expand only if retention and conversion targets are met.

## Architecture Approach

### 1) Introduce a Surface Integration Layer

Add a thin backend layer that translates platform events into existing room events.

Core components:
- `surface_event_ingress` (Cloud Functions HTTP/callable handlers)
- `surface_identity_map` (Discord user <-> BeauRocks UID mapping)
- `surface_event_dispatch` (outbound now-playing, recap, leaderboard updates)
- `surface_capability_policy` (what each platform can invoke)

Suggested data model additions:
- `organizations/{orgId}/surface_integrations/discord`
- `organizations/{orgId}/surface_integrations/apple_tv`
- `artifacts/{appId}/public/data/room_surface_events`
- `users/{uid}/linked_accounts/discord`

### 2) Canonical Event Contract

Standardize these event types so all surfaces speak the same vocabulary:
- `room.started`
- `song.queued`
- `song.started`
- `song.completed`
- `reaction.sent`
- `vote.submitted`
- `recap.published`

Each event should include:
- `roomCode`
- `orgId`
- `actor` (`uid`, `surface`, optional external id)
- `timestamp`
- `payload`

### 3) Platform Capability Matrix

Define allowed actions by surface:
- Discord:
  - Allowed: join/start links, reaction send, vote, lightweight queue intents, recap share.
  - Blocked initially: direct billing changes, admin-level moderation, destructive room ops.
- Apple TV:
  - Allowed: read-only stage render + optional host-authenticated quick toggles.
  - Blocked initially: sensitive admin/billing actions.
- Vision Pro (future):
  - Allowed: spectator and performer overlays.
  - Blocked initially: canonical queue ownership and billing operations.

## Execution Roadmap

### Phase 0 (2 weeks): Foundation and guardrails

Deliverables:
- Surface strategy alignment and capability matrix finalized.
- Event contract document finalized.
- Identity-link design for Discord account linking.
- Security/rules review for surface-scoped writes.

Exit criteria:
- No platform can perform actions outside its capability policy.
- Instrumentation plan exists for all new surface events.

### Phase 1 (4-6 weeks): Discord Companion MVP

Deliverables:
- Discord app setup and interaction webhook endpoint.
- Slash commands:
  - `/karaoke start`
  - `/karaoke join`
  - `/karaoke react`
  - `/karaoke vote`
- Server postbacks:
  - now-playing updates
  - recap card after room end
- Linked identity for optional VIP/status sync.

Success targets:
- >= 20% of active rooms receive at least one Discord interaction.
- +10% lift in average reactions per song for Discord-linked rooms.
- No Sev1 incidents from Discord event ingestion path.

### Phase 2 (4-8 weeks): Apple TV First-Class Client

Deliverables:
- tvOS client that renders existing TV state cleanly at 10-foot UX quality.
- Pairing flow from Host mobile/web to Apple TV device.
- Performance pass for overlays/animations and reconnect behavior.
- App Store distribution prep and release checklist.

Success targets:
- Startup-to-live-stage under 60 seconds median.
- Crash-free session rate >= 99.5%.
- +15% increase in average session duration for Apple TV-enabled rooms.

### Phase 3 (2-3 months): Cross-surface growth loops

Deliverables:
- Automated Discord clip/recap posting flows.
- Invite funnel optimization from Discord -> mobile join.
- VIP perks that are social and visible (badges, premium reaction packs, themes).

Success targets:
- +15% return rate (D30) for rooms using at least two surfaces.
- Positive conversion delta for VIP in multi-surface cohorts.

### Phase 4 (Exploratory, optional): Vision Pro Pilot

Deliverables:
- Internal prototype for immersive spectator mode.
- Small beta (design partners only).
- ROI checkpoint before production roadmap commitment.

Go/no-go metrics:
- Distinct retention or premium ARPU lift vs Apple TV-only cohort.
- Acceptable build/support cost per active Vision Pro room.

## Team and Effort Model

Minimum staffing for Phases 0-2:
- 1 product engineer (surface backend + contracts)
- 1 frontend/platform engineer (Discord UX + tvOS client)
- 0.5 design support (interaction and 10-foot UX polish)
- 0.5 QA/release support

Estimated effort:
- Discord MVP: medium effort
- Apple TV first-class: medium-high effort
- Vision Pro: high uncertainty effort

## KPI Framework

North-star:
- Weekly active rooms with cross-surface participation

Activation:
- % rooms launched from Discord
- Apple TV paired-room rate

Engagement:
- Reactions per song
- Votes per song
- Session duration

Retention:
- Host D30 retention
- Participant D30 retention

Monetization:
- VIP conversion rate for cross-surface rooms
- ARPU lift in rooms using Discord + TV vs web-only

Reliability:
- Event delivery success rate by surface
- P95 action-to-render latency on TV and Discord acknowledgement latency

## Risks and Mitigations

1. Surface fragmentation
- Mitigation: capability matrix + central contracts + no platform-specific business logic forks.

2. Abuse/moderation risk from Discord ingress
- Mitigation: rate limits, signature verification, role checks, and host-only sensitive commands.

3. Operational complexity explosion
- Mitigation: phase gates, instrumentation before scale, and explicit kill criteria per phase.

4. Monetization inconsistency
- Mitigation: single entitlement source and shared capability enforcement in backend.

## Decision Gates

Proceed to next phase only if:
- Reliability SLOs are met for current phase.
- Engagement lift is measurable and statistically meaningful.
- Added support burden is below predefined weekly ops threshold.

Pause or roll back if:
- New surface increases Sev1/Sev2 incidents materially.
- No measurable retention or conversion lift after two full iteration cycles.

## First 30-Day Action Plan

1. Finalize capability matrix and canonical event schema.
2. Build Discord webhook ingress with strict auth + rate limits.
3. Implement `/karaoke join` and `/karaoke react` as first commands.
4. Add end-to-end telemetry dashboards for surface event flows.
5. Draft Apple TV technical spike plan (pairing, render loop, reconnect tests).
