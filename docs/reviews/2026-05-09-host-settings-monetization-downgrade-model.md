# Host Settings Monetization And Downgrade Model

Date: 2026-05-09
Status: First implementation wired for promoted saves

## Purpose

This document closes the monetization gap for the first host-settings slice.

The goal is to make shared saved settings behave like a real packaged workspace feature, not an ungoverned admin power.

## Capability contract

The first explicit capability is:

- `workspace.shared_templates`

Meaning:

- `host_default` stays part of normal host workspace access
- `workspace_template` save requires:
  - workspace role: `owner` or `admin`
  - capability: `workspace.shared_templates`

## Downgrade behavior

When the capability is lost:

- existing workspace templates remain readable
- hosts may still load and apply a saved workspace template
- saving changes back to the workspace template becomes blocked
- the UI should treat the workspace template as `read_only_after_downgrade`

This is deliberate.
Downgrade should reduce shared-authoring power without making previously configured rooms impossible to run.

## First implementation

Wired artifacts:

- `functions/index.js`
- `functions/lib/entitlementsUsage.js`
- `src/billing/capabilities.js`
- `src/lib/hostSettingsEntitlementPolicy.js`

## Final recommendation

Use the same pattern for future shared settings domains:

- sponsor kits
- branding kits
- room templates
- run-of-show templates

Shared reusable assets should degrade to read-only before they disappear.
