# Host Settings Support Troubleshooting Map

Date: 2026-05-09
Status: First support packet for the host-settings migration

## Purpose

Support should diagnose the new host-settings model using host intent, not old tab names or raw storage paths.

## Canonical support model

Support should frame the product in three jobs:

1. `Set up tonight`
2. `Run the room live`
3. `Save what worked`

Avoid starting with:

- `room vs host vs organization`
- legacy tab names
- raw field names unless escalation requires them

## Triage table

| Host says | Likely issue | First check | Next action |
| --- | --- | --- | --- |
| `My crowd settings changed too many things` | bundle applied but host wanted one-off exception | ask whether this was setup or live | use undo first, then fine-tune exceptions |
| `I changed it but it did not stick for next time` | tonight-only change not promoted | ask whether host used `Save as my default` or `Save to workspace template` | explain tonight vs saved default and guide to promoted save |
| `Save to workspace template is missing` | role or mode restriction | confirm workspace role and room format | if member/self-serve/run-of-show restriction applies, explain expected limitation |
| `Use my default does nothing` | no saved host bundle for that bundle type or stale expectation | confirm whether host ever saved that bundle | re-save current setup as host default, then retry |
| `Workspace template save says no` | caller is not owner/admin | verify workspace role | escalate only if role is wrong, not if block is expected |
| `Undo did not bring it back` | host changed more than one layer after bundle apply | confirm whether they changed detailed controls after the bundle | restore from saved room value or reapply known source |
| `The room looks wrong after applying a template` | inherited workspace bundle differs from tonight draft | ask which source they used: room, my default, workspace template | reapply the intended source and note provenance gap if summary is unclear |

## Support language map

Use:

- `Tonight only`
- `My default`
- `Workspace template`
- `Use my default`
- `Use workspace template`
- `Restore saved room value`

Avoid:

- `organization defaults doc`
- `hostDefaults document`
- `runtime override`

## Escalation triggers

Escalate to engineering if:

- workspace member can save a workspace template
- owner/admin cannot save a workspace template in supported mode
- saved bundle is returned but settings are malformed
- undo changes the wrong fields
- live apply and setup apply diverge for the same bundle

## Old to new translation

| Old mental model | New support phrasing |
| --- | --- |
| admin tabs | `Tonight`, `Live`, `Library / Workspace` |
| raw toggles first | bundle first, exceptions second |
| room settings save | `Tonight only` save unless promoted |
| org-level shared config | `Workspace template` or shared workspace asset |

## Final rule

Support should always try to identify:

1. which host job the person was doing
2. whether the change was `tonight`, `my default`, or `workspace template`
3. whether undo or restore is the fastest safe recovery
