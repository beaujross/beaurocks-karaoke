# Marketing Operating Playbook

Last updated: 2026-03-01

## Purpose
- Keep marketing positioning, IA, CTA hierarchy, and analytics naming consistent as pages evolve.

## Positioning (Canonical)
- BeauRocks is a host orchestration layer, not a licensed karaoke catalog provider.
- Product value: unify host workflow across queue, audience engagement, moderation, overlays, and recap.
- Content model: hosts bring their own media sources and connected providers.
- Responsibility model: hosts remain responsible for music-rights compliance.

## Compliance Guardrails
- Approved language:
  - "Content-agnostic by design."
  - "Bring your own tracks and connected sources."
  - "Hosts remain responsible for music-rights compliance."
- Prohibited messaging:
  - Any claim implying licensing bypass, exemption, or legal coverage by default.

## IA + Primary Conversion Intent
- Primary nav/canonical flow is now discovery-first:
  - `/discover`: map + listing discovery first, then convert to join/host actions
  - `/join`: direct room entry by code
  - `/host-access`: authentication gate before host controls
- Persona pages (`/for-hosts`, `/for-venues`, `/for-performers`, `/for-fans`) remain available but are secondary.
- `/demo`: product trust/validation layer supporting conversion.

## CTA Hierarchy Standard
- `Primary`: highest-intent conversion for page persona.
- `Secondary`: adjacent action that preserves momentum.
- `Tertiary`: exploratory or alternate-path action.
- Rule: each persona page should make the primary CTA visually and semantically unambiguous.

## Analytics Event Contract
- `mk_persona_cta_click`
  - Scope: persona pages.
  - Required fields: `persona`, `page`, `cta`.
- `mk_home_launch_cta_click`
  - Scope: campaign-aware home launch CTA.
  - Required fields: `cta`, `source`, `campaign_variant`, UTM fields.
- `mk_home_conversion_click`
  - Scope: high-intent home conversion clicks.
  - Required fields: `cta`, `surface`, `campaign_variant`.
- `mk_nav_host_dashboard_click`
  - Scope: host dashboard navigation entry points.
  - Required fields: `source`, `authed`.
- `mk_discover_join_room`
  - Scope: discover card CTA for room sessions.
  - Required fields: `source`, `roomCode`.

## Discover Visibility Defaults
- `Bounds-only list` defaults to OFF so virtual/no-coordinate public sessions are visible by default.
- Change reference: commit `4d79612`.
- Operational note:
  - when `Bounds-only list` is ON, sessions without coordinates can be filtered out from rail view.

## Current Conversion Narrative
- Lead with map discovery and lightweight join path.
- Route host intent through account-first `/host-access` before host controls.
- Keep copy minimal; discovery data and room/session actions should carry the page.

## Technical Debt To Track
- Build warning: large chunks after minification (notably `HostApp` and firebase vendor chunk).
- Action: prioritize code-splitting/manual chunking in a dedicated performance pass.
