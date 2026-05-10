# Host Settings Permissions Matrix

Date: 2026-05-09
Status: First canonical permissions matrix for host-settings migration

## Purpose

This matrix defines who can perform which classes of actions as the host-settings system becomes more structured.

It is designed to constrain:

- live bundle controls
- detailed live overrides
- `Save as my default`
- `Save to workspace template`
- workspace kit and template management

## Role model

### Runtime roles

- `host`
- `co_host`
- `stage_manager`
- `media_curator`
- `viewer`

### Workspace roles

- `owner`
- `admin`
- `member`

## Principles

1. Runtime operators may control tonight only unless explicitly granted a broader save surface.
2. Workspace persistence requires workspace authority, not just room authority.
3. `Save as my default` should be narrower than `Save to workspace template`.
4. Co-host and helper roles should preserve live velocity without being able to silently redefine future defaults.

## Action classes

### Live actions

- `live.flow`
- `live.crowd`
- `live.look`
- `live.recover`
- `room.policy.quick`

### Run-of-show actions

- `run_of_show.edit_flow`
- `run_of_show.manage_templates`
- `run_of_show.manage_roles`
- `run_of_show.pause_automation`

### Save actions

- `save.host_default`
- `save.workspace_template`

### Workspace management actions

- `workspace.manage_branding_kits`
- `workspace.manage_sponsor_kits`
- `workspace.manage_room_templates`
- `workspace.manage_members`

## Canonical matrix

| Action | host | co_host | stage_manager | media_curator | viewer | workspace owner | workspace admin | workspace member |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `live.flow` | yes | yes | yes | no | no | inherits runtime | inherits runtime | inherits runtime |
| `live.crowd` | yes | yes | yes | no | no | inherits runtime | inherits runtime | inherits runtime |
| `live.look` | yes | yes | yes | yes | no | inherits runtime | inherits runtime | inherits runtime |
| `live.recover` | yes | yes | yes | yes | no | inherits runtime | inherits runtime | inherits runtime |
| `room.policy.quick` | yes | yes | yes | no | no | inherits runtime | inherits runtime | inherits runtime |
| `run_of_show.edit_flow` | yes | yes | yes | yes | no | inherits runtime | inherits runtime | inherits runtime |
| `run_of_show.manage_templates` | yes | yes | yes | yes | no | inherits runtime | inherits runtime | inherits runtime |
| `run_of_show.manage_roles` | yes | no | no | no | no | inherits runtime | inherits runtime | inherits runtime |
| `run_of_show.pause_automation` | yes | no | no | no | no | inherits runtime | inherits runtime | inherits runtime |
| `save.host_default` | yes | no | no | no | no | n/a | n/a | n/a |
| `save.workspace_template` | if workspace `owner` or `admin` | no | no | no | no | yes | yes | no |
| `workspace.manage_branding_kits` | if workspace `owner` or `admin` | no | no | no | no | yes | yes | no |
| `workspace.manage_sponsor_kits` | if workspace `owner` or `admin` | no | no | no | no | yes | yes | no |
| `workspace.manage_room_templates` | if workspace `owner` or `admin` | no | no | no | no | yes | yes | no |
| `workspace.manage_members` | if workspace `owner` | no | no | no | no | yes | no | no |

## Interpretation notes

### Runtime bundles

Bundle controls like `Crowd mode` and `Operating style` should inherit the permission level of the underlying live surfaces:

- `Crowd mode` -> `live.crowd`
- `Operating style` in live room menu -> `room.policy.quick` plus `live.flow`

### Setup bundles

Setup bundles inside `Tonight` are host-owned unless a dedicated co-host setup experience is added later.

For now:

- only `host` should change setup bundles that affect persisted room defaults before launch

### Save actions

`Save as my default`:

- should only be available to the room host acting on their own account

`Save to workspace template`:

- should only be available when the actor also has workspace role `owner` or `admin`

### Asset management

Reusable assets are not room powers.

Even if a co-host can activate a sponsor scene or launch a live look, they should not be able to mutate the reusable kit source unless they hold the correct workspace role.

## Implementation rules

1. Never infer workspace persistence rights from runtime control rights.
2. Never infer host-default save rights from co-host live-operate rights.
3. If a bundle spans multiple underlying fields, the bundle permission should be the intersection of all required permissions, not the union.
4. If permissions are mixed, the UI should expose only the allowed subset or disable the bundle with a clear reason.

## UI requirements

### Disabled state copy

Examples:

- `Only the host can save room defaults`
- `Workspace admin or owner required to save templates`
- `Only the host can pause show automation`

### Source cues

When a user can view but not edit:

- show source badges
- show owner badges
- hide destructive save actions

## Needed follow-up

1. wire this matrix into a code-side helper
2. align run-of-show permission helpers with the same vocabulary
3. add UI gating for future save actions using the helper instead of inline checks
