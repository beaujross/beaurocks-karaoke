# Seattle/Tacoma Directory Seed Pipeline

Last updated: 2026-03-07

## Goal

Expand finder coverage into Western Washington by scraping public karaoke source pages, normalizing records into `directory_regions.seedListings`, and letting existing ingestion jobs enrich and queue moderation submissions.

## Sources in registry

Configured in:

- `scripts/ingest/seattle-tacoma-source-registry.json`

Current source set:

- `https://www.karaokelistings.com/venues.php?state=WA` (city-page crawl filtered to Western WA)
- `https://karaokenear.me/karaoke/countries/united-states/cities/seattle`
- `https://karaokenear.me/karaoke/countries/united-states/cities/shoreline`
- `https://do206.com/karaoke-nights-seattle`
- `https://www.theluckysilver.com/calendar`
- `https://www.burleskaraoke.com/events`

## Commands

Dry run (default behavior):

```bash
npm run seed:directory:seattle-tacoma:scrape
```

Apply `directory_regions` updates:

```bash
npm run seed:directory:seattle-tacoma:apply
```

Seed curated official host profiles:

```bash
npm run seed:directory:hosts:official
```

Apply curated official host profiles:

```bash
npm run seed:directory:hosts:official:apply
```

Run the unattended overnight directory-growth bundle:

```bash
npm run ops:overnight:directory-growth -- --apply
```

Optional flags:

- `--sources do206_karaoke_nights,karaokenear_seattle`
- `--regions wa_seattle,wa_tacoma`
- `--max-per-region 20`
- `--output artifacts/ingest/custom_seed_records.json`

Example:

```bash
node scripts/ingest/scrape-seattle-tacoma-sources.mjs --dry-run --regions wa_tacoma --verbose
```

## Artifacts

Dry-run and apply both write a JSON artifact to:

- `artifacts/ingest/seattle_tacoma_seed_records.json`
- `artifacts/ingest/official_host_profile_seed_report.json`
- `artifacts/ops/overnight_directory_growth_report.json`

That artifact contains:

- Per-source success/failure summary
- Dedupe + region counts
- Final normalized seed records used for region docs

## Curated Host Profiles

Configured in:

- `scripts/ingest/official-host-profiles.json`
- `scripts/ingest/seed-official-host-profiles.mjs`

Current curated host seed:

- `dj_beaurocks`
  - uid: `12scDWBbxVb6cYostveztDKMsji2`
  - profile target: `directory_profiles/12scDWBbxVb6cYostveztDKMsji2`

Operational behavior:

- The seed script merges into existing profile docs instead of blind replacement.
- Preserve-list fields can keep live account metadata such as `roles`, `hostRoomCodes`, `vipLevel`, and `createdAt`.
- This is the preferred path for "official" host profiles that should have stronger copy, gallery images, and canonical links without hand-editing Firestore.

## How it plugs into existing ingestion

1. This script upserts `directory_regions/{token}` docs with `seedListings`.
2. Existing backend (`nightlyDirectorySync`) reads enabled region docs.
3. Existing ingestion (`executeDirectoryIngestion`) hydrates those seeds, runs provider lookups, and writes `directory_submissions` + `external_source_links`.
4. Moderation resolves submissions into canonical `venues` / `karaoke_events`.
5. Curated host-profile seeds are independent of venue/event ingestion and can be run safely before or after region seeding.

## Current Snapshot (2026-03-07)

Latest verified scrape/apply result:

- `sources`: 6
- `sourceFailures`: 0
- `rawRecords`: 193
- `dedupedRecords`: 117
- `regions`: 31
- `seedListings`: 67

Important nuance:

- The registry name says "Seattle/Tacoma", but the `karaokelistings_western_wa` source currently expands into a broader Western Washington footprint.
- Recent apply output included region docs such as:
  - `wa_seattle`
  - `wa_tacoma`
  - `wa_shoreline`
  - `wa_renton`
  - `wa_white_center`
  - `wa_kirkland`
  - `wa_lynnwood`
- If you want a Seattle-only overnight pass, use `--regions wa_seattle`.

Current verified region highlights:

- `wa_seattle`
  - `totalCandidates`: 70
  - `selectedSeeds`: 20
  - currently all selected seeds are `venue` records
- `wa_tacoma`
  - `totalCandidates`: 10
  - `selectedSeeds`: 10
  - mix includes 9 venue seeds and 1 event seed

## Operational notes

- Requires Firebase CLI login (`firebase login`) on the machine for apply mode.
- If a source starts failing, keep it in dry-run output for visibility and either:
  - update parsing rules in script, or
  - disable/remove it in registry JSON.
- Keep `maxPerRegion` at or below 20 to align with current backend region hydration limits.
- Venue image backfill is a separate step:
  - script: `scripts/ingest/backfill-venue-featured-images.mjs`
  - dry-run command: `node scripts/ingest/backfill-venue-featured-images.mjs --dry-run --limit 25 --max-photos 4`
  - recent verification showed the first 25 approved venues already had images, so no updates were queued in that sample
- The overnight runner currently chains:
  - `scripts/qa/overnight-audience-tv-host-smoke.mjs`
  - curated host-profile seeding
  - Seattle/Tacoma region seeding
  - venue featured-image backfill
