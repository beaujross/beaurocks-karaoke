# YouTube Live Evidence Runbook

Date: 2026-07-06
Purpose: capture the remaining live-only evidence for the YouTube API Services audit and quota-extension packet.
Deployment checkpoint: production hosting redeployed on 2026-07-06 15:49 UTC (2026-07-06 08:49 America/Los_Angeles); public legal URLs returned HTTP 200 after the release.

## Current Evidence Already Captured

Public legal evidence:
- `docs/compliance/evidence/2026-07-06-youtube-audit/desktop-terms.png`
- `docs/compliance/evidence/2026-07-06-youtube-audit/desktop-privacy.png`
- `docs/compliance/evidence/2026-07-06-youtube-audit/desktop-data-deletion.png`
- `docs/compliance/evidence/2026-07-06-youtube-audit/mobile-terms.png`
- `docs/compliance/evidence/2026-07-06-youtube-audit/mobile-privacy.png`
- `docs/compliance/evidence/2026-07-06-youtube-audit/mobile-data-deletion.png`
- `docs/compliance/evidence/2026-07-06-youtube-audit/manifest.json`

QA product evidence:
- `docs/compliance/evidence/2026-07-06-youtube-product-audit/host-youtube-add-panel.png`
- `docs/compliance/evidence/2026-07-06-youtube-product-audit/host-room-library-curator.png`
- `docs/compliance/evidence/2026-07-06-youtube-product-audit/audience-youtube-search.png`
- `docs/compliance/evidence/2026-07-06-youtube-product-audit/audience-youtube-url-paste.png`
- `docs/compliance/evidence/2026-07-06-youtube-product-audit/tv-youtube-performance.png`
- `docs/compliance/evidence/2026-07-06-youtube-product-audit/tv-apple-background.png`
- `docs/compliance/evidence/2026-07-06-youtube-product-audit/manifest.json`

## Output Folder For Live Evidence

Create this folder before capturing live-only screenshots:

`docs/compliance/evidence/2026-07-06-youtube-live-evidence/`

Use these filenames so the packet stays easy to audit:

- `google-cloud-youtube-quotas.png`
- `google-cloud-youtube-search-list-quota.png`, if the live project shows a separate `search.list` quota row or detail page
- `quota-exhaustion-fallback.png`
- `room-permanent-delete-confirmation.png`
- `live-host-youtube-surface.png`, optional unless reviewers ask for authenticated live-room evidence
- `manifest.md`

## 1. Google Cloud Quota Evidence

Goal: prove the official YouTube quota state from Google Cloud, and avoid relying on the app's internal operational request counter.

Capture:
- Google Cloud Console project selector showing the correct production project
- YouTube Data API quota page
- visible daily quota or limit rows for the API methods in use
- current usage, limit, and reset/window labels when visible

Acceptance criteria:
- screenshot clearly identifies the live Google Cloud project
- screenshot clearly identifies YouTube Data API quota or quotas
- if separate method rows are visible, capture `search.list`, `videos.list`, and `playlistItems.list`
- do not include unrelated secrets, keys, billing IDs, or personal account details beyond what is unavoidable in the Console chrome

Packet note to use:
- Google Cloud is the authoritative source for official YouTube quota usage.
- BeauRocks' internal meter is an operational request-count meter, not the official Google quota ledger.

## 2. Quota Exhaustion Or Cooldown Evidence

Goal: show what the product does when live YouTube search should not continue spending quota.

Preferred capture:
- use a controlled production test room
- trigger or wait for a real YouTube quota-exhausted/cooldown condition
- capture the host or audience surface showing live YouTube search paused, searches left, or fallback guidance

Fallback capture if quota is not currently exhausted:
- capture the operational YouTube budget/status indicator and the direct URL/indexed-track fallback paths
- annotate the packet that the exact exhausted state is only capturable during an exhausted/cooldown window

Acceptance criteria:
- screenshot shows that the product does not silently keep spending live search calls
- screenshot points the host or audience toward lower-quota paths such as indexed tracks, known backing tracks, or direct YouTube URL paste
- screenshot text does not imply the in-app meter is official Google quota usage

## 3. Room Permanent-Delete Evidence

Goal: prove that room deletion covers the room-level host library and temporary indexed YouTube metadata.

Capture:
- create or use a disposable live test room
- open the host room management or delete flow
- capture the final confirmation step before deletion
- if possible, capture the post-delete success state

Acceptance criteria:
- screenshot clearly shows that the action is permanent or destructive
- screenshot is from a disposable test room, not an active customer/event room
- packet narrative links this to the repo behavior: permanent room deletion removes the associated room host library document

## 4. Optional Live Host Evidence

Goal: provide authenticated live-room proof only if reviewers want evidence beyond deterministic QA screenshots.

Capture:
- host YouTube add/search surface with disclosure and mode controls
- Room Library Curator with YouTube API Services disclosure, Terms, Privacy, and catalog health context
- avoid capturing private guest names, emails, or active event data

Acceptance criteria:
- live screenshot matches the QA product evidence already captured
- screenshot does not add sensitive user data to the packet

## Manifest Template

Create `manifest.md` in the live evidence folder with this structure:

```md
# YouTube Live Evidence Manifest

Date captured: 2026-07-06
Captured by:
Production project:
Production app URL:
Room code, if applicable:

## Files

- `google-cloud-youtube-quotas.png`: official Google Cloud YouTube Data API quota page for the live project.
- `google-cloud-youtube-search-list-quota.png`: method-specific quota detail, if captured.
- `quota-exhaustion-fallback.png`: live quota-exhaustion or cooldown behavior.
- `room-permanent-delete-confirmation.png`: live test-room permanent delete path.
- `live-host-youtube-surface.png`: optional authenticated live host evidence.

## Notes

- Internal BeauRocks usage counters are operational request counters and are not the official Google quota ledger.
- Public legal evidence and QA product evidence are captured in the sibling evidence folders.
```

## Submission Gate

Do not submit the YouTube audit/quota-extension request until:
- the Google Cloud quota screenshot is captured
- quota-exhaustion/cooldown evidence is captured or explicitly marked as unavailable until the next quota event
- room permanent-delete evidence is captured from a disposable test room
- `hello@beaurocks.app` and product/business naming are confirmed as final
- `docs/compliance/YOUTUBE_AUDIT_SUBMISSION_DRAFT.md` is checked one last time against deployed behavior