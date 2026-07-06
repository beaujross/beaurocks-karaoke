# YouTube Live Evidence Manifest

Date created: 2026-07-06
Deployment checkpoint: 2026-07-06 15:49 UTC (2026-07-06 08:49 America/Los_Angeles)
Production hosting release: Firebase Hosting live channel for `beaurocks-karaoke-v2`
Production app URL: https://beaurocks.app/
Firebase Hosting URL: https://beaurocks-karaoke-v2.web.app/
Production project: beaurocks-karaoke-v2
Captured by:
Room code, if applicable:

## Verified After Deploy

- `https://beaurocks.app/karaoke/terms` returned HTTP 200 after redirect on 2026-07-06.
- `https://beaurocks.app/karaoke/privacy` returned HTTP 200 after redirect on 2026-07-06.
- `https://beaurocks.app/karaoke/data-deletion` returned HTTP 200 after redirect on 2026-07-06.

## Files To Add

- `google-cloud-youtube-quotas.png`: official Google Cloud YouTube Data API quota page for the live project.
- `google-cloud-youtube-search-list-quota.png`: method-specific quota detail, if captured.
- `quota-exhaustion-fallback.png`: live quota-exhaustion or cooldown behavior.
- `room-permanent-delete-confirmation.png`: live test-room permanent delete path.
- `live-host-youtube-surface.png`: optional authenticated live host evidence.

## Notes

- Internal BeauRocks usage counters are operational request counters and are not the official Google quota ledger.
- Public legal evidence is captured in `docs/compliance/evidence/2026-07-06-youtube-audit/`.
- QA product evidence is captured in `docs/compliance/evidence/2026-07-06-youtube-product-audit/`.