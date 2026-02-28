# Marketing Operating Playbook

Last updated: 2026-02-28

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
- `/for-hosts`: primary = host product conversion (`Start Hosting` / `Open Host Panel` path).
- `/for-venues`: primary = venue ownership + recurring cadence conversion.
- `/for-performers`: primary = quality room discovery + performer account conversion.
- `/for-fans`: primary = premium night discovery + guest account conversion.
- `/demo`: product trust/validation layer supporting the above conversions.

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

## Current Conversion Narrative
- Home page emphasizes two outcomes:
  - capture qualified host launch intent
  - route active testers quickly to host controls
- Persona pages convert by role clarity, not one-size-fits-all messaging.

## Technical Debt To Track
- Build warning: large chunks after minification (notably `HostApp` and firebase vendor chunk).
- Action: prioritize code-splitting/manual chunking in a dedicated performance pass.

