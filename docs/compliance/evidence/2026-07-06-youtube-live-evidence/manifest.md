# YouTube Live Evidence Manifest

Date created: 2026-07-06
Deployment checkpoint: 2026-07-06 15:49 UTC (2026-07-06 08:49 America/Los_Angeles)
Production hosting release: `3098b4aa26e1003d` on the Firebase Hosting live channel for `beaurocks-karaoke-v2`
Current behavior revalidated against Hosting release `1784078708909000` (version `5bc48c15cd873eac`) on 2026-07-14; original artifact provenance remains unchanged.
Production app URL: https://beaurocks.app/
Firebase Hosting URL: https://beaurocks-karaoke-v2.web.app/
Production project: beaurocks-karaoke-v2
Captured by:
Room code, if applicable:

## Verified After Deploy

- `https://beaurocks.app/karaoke/terms` returned HTTP 200 after redirect on 2026-07-06.
- `https://beaurocks.app/karaoke/privacy` returned HTTP 200 after redirect on 2026-07-06.
- `https://beaurocks.app/karaoke/data-deletion` returned HTTP 200 after redirect on 2026-07-06.

## Captured

- `google-cloud-youtube-assigned-quotas.json`: sanitized Google Cloud Quotas API response for the live project.
- `google-cloud-youtube-assigned-quotas.md`: human-readable assigned-limit interpretation and submission caveat.
- `quota-exhaustion-fallback.png`: authenticated production UI in an isolated controlled 15-minute cooldown state.
- `quota-exhaustion-fallback.md`: capture method, SHA-256, assertions, and the explicit no-live-quota-consumption caveat.
- `room-permanent-delete-confirmation.png`: production archived-room confirmation state for disposable QA room `26V3`.
- `room-permanent-delete-success.png`: production success state after the server-authorized purge completed.
- `room-permanent-delete-evidence.md`: hashes, safety contract, release, and independent Firestore absence verification.

## Files To Add

- `google-cloud-youtube-quotas.png`: official Google Cloud YouTube Data API quota page for the live project.
- `google-cloud-youtube-search-list-quota.png`: method-specific quota detail, if captured.
- `live-host-youtube-surface.png`: optional authenticated live host evidence.

## Notes

- Internal BeauRocks usage counters are operational request counters and are not the official Google quota ledger.
- Public legal evidence is captured in `docs/compliance/evidence/2026-07-06-youtube-audit/`.
- QA product evidence is captured in `docs/compliance/evidence/2026-07-06-youtube-product-audit/`.
