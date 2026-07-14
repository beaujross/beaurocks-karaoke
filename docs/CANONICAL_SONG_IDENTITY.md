# Canonical Song Identity

The canonical song is the durable identity used for performances and worldwide or weekly rankings. Playback media is a separate rendition attached to that song.

## Collections

- `songs/{canonicalSongId}` stores canonical title, artist, provider identifiers, aliases, and optional merge metadata.
- `tracks/{trackId}` stores reusable Apple, YouTube, upload, or custom playback tracks linked to the canonical song.
- `songs/{canonicalSongId}/backing_candidates/{candidateId}` stores ranked backing renditions and quality telemetry.
- `song_identity_aliases/{aliasKey}` maps deterministic spelling or title variants to a canonical song.
- `performances/{performanceId}` stores both `canonicalSongId` and the exact backing identity used.
- `song_hall_of_fame/{canonicalSongId}` and `song_hall_of_fame_weeks/{weekKey}__{canonicalSongId}` aggregate rankings independently of backing choice.

## Merge and Alias Rules

- Duplicate song documents can point to the winning identity with `mergedIntoSongId`.
- Resolution follows at most six redirects and rejects cycles.
- Alias claims are transactional. An existing alias cannot be silently reassigned to another canonical song.
- Conflicting claims are recorded on the attempted song as `aliasConflicts` for moderator review.
- Provider matches, including Apple Music identity, pass through canonical redirect resolution.

## Historical Boundary

New performances resolve to the winning canonical song immediately after a redirect is established. Historical performance and ranking documents are not rewritten automatically. Historical consolidation requires a separate audited, idempotent rollup operation with a dry run and rollback record.
