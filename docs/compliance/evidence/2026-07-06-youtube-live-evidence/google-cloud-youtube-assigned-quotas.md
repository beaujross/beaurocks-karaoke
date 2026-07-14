# Google Cloud YouTube Assigned Quotas

Captured: 2026-07-13
Project: `beaurocks-karaoke-v2` (`426849563936`)
Service: `youtube.googleapis.com`
Source: authenticated Google Cloud Quotas API via `gcloud beta quotas`

## Assigned daily limits

| Metric | Quota ID | Assigned limit | Increase eligible |
| --- | --- | ---: | --- |
| Search Queries | `defaultSearchListPerDayPerProject` | 100 calls/day | Yes |
| Queries | `defaultPerDayPerProject` | 10,000 units/day | Yes |
| Video Uploads | `defaultVideoInsertPerDayPerProject` | 100 calls/day | Yes |

`gcloud beta quotas preferences list --project=beaurocks-karaoke-v2` returned an empty preference set. No approved project-level override is currently recorded, so the product should continue using the official default values until Google Cloud shows an approved change.

## Audit interpretation

- This is authoritative assigned-limit data from Google Cloud, not the BeauRocks browser request counter.
- The live Search Queries assignment is 100 calls/day, matching the product's current `official_default` configuration.
- The project is eligible to request an increase through the YouTube API audit/quota form.
- A Google Cloud Console screenshot is still required for the presentation packet even though the assigned values are now independently captured as structured API evidence.

The machine-readable capture is `google-cloud-youtube-assigned-quotas.json` in this directory.
