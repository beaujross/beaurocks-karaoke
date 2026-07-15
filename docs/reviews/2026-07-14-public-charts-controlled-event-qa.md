# Public Charts Controlled-Event QA

Date: 2026-07-14
Chart era: `launch_v1`
Production boundary: `2026-07-15T01:25:08.909Z`

## Purpose

Close the three remaining persona checks with real event behavior. Do not create a synthetic score merely to populate public charts.

## Preconditions

- Use an approved BeauRocks host and a real public room listing.
- Use one singer signed into their BeauRocks account before the performance begins.
- Use one guest who remains unsigned-in.
- Record the room code, room-session ID, result IDs, canonical song IDs, and UTC timestamps.
- Capture public chart state before the first qualifying performance.

## Check 1: Signed-In Member Qualifies

1. The signed-in singer completes a real scored performance.
2. Confirm the room result exists once.
3. Confirm Global and canonical Song charts show the selected public chart name or `BeauRocks Singer`.
4. Confirm the backing track identity remains private while the canonical song owns the public ranking.
5. Retry or refresh once and confirm aggregate performance counts do not increase.

Pass: one member and canonical-song projection appears, no raw UID is public, and retry is idempotent.

## Check 2: Guest Remains Room-Only

1. The unsigned-in guest completes a real scored performance.
2. Confirm the room leaderboard includes the performance.
3. Confirm no new Global member or canonical Song projection is created for that guest.
4. Confirm joining and participating did not require an account.

Pass: the guest has the complete room experience without entering public identity charts.

## Check 3: Public-To-Private Cleanup

1. Capture the public room card and Public Rooms chart state.
2. Change the room-session listing from approved/public to private.
3. Confirm Discover, public recap, and public-night chart artifacts disappear.
4. Confirm the signed-in singer's Global and canonical Song achievement remains.
5. Restore public visibility only if that matches the real event's intended discoverability.

Pass: night-level public artifacts are removed without deleting durable member/song achievement.

## Stop Conditions

Stop and preserve evidence if:

- a raw account UID appears publicly;
- a guest creates a public member/song projection;
- retry increments aggregate counts;
- a private night remains in Discover or Public Rooms;
- cleanup removes the member or canonical-song achievement.

## Evidence Record

- Host UID:
- Room code:
- Room-session ID:
- Signed-in result ID:
- Guest result ID:
- Canonical song ID:
- Public-before screenshot:
- Member/song-after screenshot:
- Private-after screenshot:
- UTC completion time:
- Notes:
