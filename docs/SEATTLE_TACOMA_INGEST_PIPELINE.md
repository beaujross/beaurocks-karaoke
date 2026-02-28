# Seattle/Tacoma Directory Seed Pipeline

Last updated: 2026-02-28

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

That artifact contains:

- Per-source success/failure summary
- Dedupe + region counts
- Final normalized seed records used for region docs

## How it plugs into existing ingestion

1. This script upserts `directory_regions/{token}` docs with `seedListings`.
2. Existing backend (`nightlyDirectorySync`) reads enabled region docs.
3. Existing ingestion (`executeDirectoryIngestion`) hydrates those seeds, runs provider lookups, and writes `directory_submissions` + `external_source_links`.
4. Moderation resolves submissions into canonical `venues` / `karaoke_events`.

## Operational notes

- Requires Firebase CLI login (`firebase login`) on the machine for apply mode.
- If a source starts failing, keep it in dry-run output for visibility and either:
  - update parsing rules in script, or
  - disable/remove it in registry JSON.
- Keep `maxPerRegion` at or below 20 to align with current backend region hydration limits.
