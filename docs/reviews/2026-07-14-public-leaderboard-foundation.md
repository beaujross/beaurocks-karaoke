# Public Leaderboard Foundation

Date: 2026-07-14

## Product contract

No account: enjoy the room. BeauRocks account: make the charts.

- Every participant can use the live room leaderboard.
- A signed-in BeauRocks member automatically qualifies for public song and global charts when the completed performance is recorded by an approved BeauRocks host.
- Guests remain room-only. There is no performance-claim flow.
- Public night pages are limited to rooms the host has explicitly made public. Private rooms remain off Discover and do not publish public recaps.
- Disputed results use a lightweight support-review path backed by the stored room, host, performance, and qualification record.

## Slice 1: trustworthy qualification foundation

This slice establishes the data contract before public chart pages are added:

1. Capture account eligibility when the singer joins, and refresh it automatically when a guest upgrades to an account mid-room.
2. Require approved host workspace access and room-host ownership to record a qualifying performance.
3. Bind the write to the room's latest completed performance.
4. Store an idempotent performance record with qualification version, approved host, and member/guest eligibility.
5. Update song Hall of Fame records only from qualified member performances.
6. Keep raw performance history readable only by the singer who owns it.
7. Prevent private rooms from publishing recap pages and remove recap artifacts when public visibility is removed or the room is permanently deleted.
8. Explain the behavior in the existing room rules, Terms, Privacy, and deletion pages without adding another required interaction.

## Slice 2: public chart projection and website

Completed locally on 2026-07-14; not yet deployed:

- Server-owned, client-read-only projections now cover Global, canonical Songs, and approved Public Rooms.
- Account settings control chart display identity only: a chart name or `BeauRocks Singer`. Eligible scores still count automatically.
- `/charts` exposes Global, Songs, and Public Nights without exposing account IDs or raw performance records.
- Discover contains a compact chart teaser and the site navigation, sitemap, and social-card route model include Charts.
- `Report result` carries the public result ID into the existing email support path. There is no claim workflow.
- Canonical song identity remains the public grouping key; backing-track identity remains private audit metadata.
- Projection writes and their completion marker share one transaction, so a retry cannot double-count and an interrupted projection can safely recover.

## Release boundary: fresh charts and production acceptance

Charts begin with the coordinated production release. Historical performances are not seeded into launch charts.

1. Refuse to publish a room aggregate unless its current directory listing is approved and public.
2. Run authenticated QA for public-name and anonymous chart identities, canonical grouping across two backing tracks, guest exclusion, and public-to-private room removal.
3. Deploy Functions, rules, indexes, and Hosting as one coordinated release only after all automated gates pass.
4. Record the release timestamp as the start of chart era `launch_v1`.

## Release gates

- A non-host cannot record a performance for a room.
- An unapproved host cannot create a qualifying performance.
- A guest performance is retained for room history but cannot update global/song Hall of Fame records.
- A member performance from an approved host is automatically eligible.
- A guest who upgrades to an account becomes eligible without leaving or rejoining the room.
- Replaying the completion call does not create a duplicate performance.
- Private rooms cannot publish public recaps.
- Removing public visibility or permanently deleting a room removes its public recap artifact.
- The room-entry flow adds no new screen, checkbox, or post-performance action.
- Public chart documents never expose an account UID or a guest's room-only result.
- Projection retry and recovery do not increment aggregate counts twice.
- Existing history is explicitly excluded from the `launch_v1` baseline.
