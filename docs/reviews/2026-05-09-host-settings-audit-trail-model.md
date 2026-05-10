# Host Settings Audit Trail Model

Date: 2026-05-09
Status: First implementation wired for promoted saves

## Purpose

This document closes the audit-trail gap for the first bundle slice.

The goal is to make promoted saves traceable across a workspace so support, product, and operators can answer:

- who changed this
- what target they changed
- which bundle changed
- what fields were affected

## First implementation scope

Current audit coverage is attached to promoted saves through `manageHostSettingsDefaults`.

Recorded fields:

- action
- target
- bundle key
- actor uid
- actor role
- workspace role
- room code
- source type
- source id
- changed keys
- changed-at timestamp

## Visibility

Current visibility levels:

- `workspace_visible`
  - workspace-template saves
- `host_private`
  - host-default saves that still matter for trust/debugging, but are not shared workspace assets

## Storage

Current workspace audit path:

- `organizations/{orgId}/settings_audit/{entryId}`

This is intentionally independent from the template document itself so audit history survives later template edits.

Current read seam:

- `listHostSettingsAuditEntries`

Read visibility rules:

- workspace-visible entries are readable across the workspace
- host-private entries are readable by the actor and workspace admins/owners

## Final recommendation

The next expansion should add:

- callable read/query access for the audit trail
- actor display-name hydration
- save-denied and downgrade events
- sponsor kit / branding kit / room template coverage
