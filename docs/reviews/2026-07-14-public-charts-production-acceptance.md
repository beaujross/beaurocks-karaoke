# Public Charts Production Acceptance

Date: 2026-07-14
Parent contract: `docs/reviews/2026-07-14-public-leaderboard-foundation.md`

## Outcome

Launch one low-friction public chart system that rewards account use without changing how a guest joins or participates.

No account: enjoy the room. BeauRocks account: make the charts.

## Launch boundary

Public charts start fresh with the coordinated production release. Existing performances are not backfilled into `launch_v1`.

- The release timestamp is recorded as the start of chart era `launch_v1`.
- Only new qualifying results recorded through the versioned server contract enter charts.
- Missing or deleted account identity becomes `BeauRocks Singer`; a raw account UID is never published in a chart document.
- A room projection requires a current `approved` and `public` room-session listing. Private, pending, removed, or missing listings remain absent.
- Historical migration remains a later operator project and is not a launch dependency.

## Persona acceptance matrix

| Persona | Scenario | Expected evidence |
| --- | --- | --- |
| Guest | Join and complete a performance without an account | Room leaderboard works; no public member, song, or night projection is created |
| BeauRocks member | Complete a performance for an approved room owner | Result appears once in Global and canonical Song charts |
| Public-name member | Save a chart name | Existing and future public projections show the chart name without exposing account UID |
| Anonymous member | Choose `BeauRocks Singer` | Eligible scores still count; public projections and Hall records use the anonymous label |
| Canonical-song competitor | Perform the same composition using a second backing rendition | One song chart is updated under the canonical song ID; backing metadata remains in the private performance record |
| Public-room visitor | Open Charts and Discover | Approved public room is navigable and shows sanitized aggregate/top-result data |
| Private-room host | Make a listed room private | Discover, public recap, and public-night chart artifact are removed; member and canonical-song achievement remain |
| Support operator | Select `Report result`, then use Admin `Public Chart Operations` | Email carries a stable result ID; Admin previews the exact member/song/room impact before removal |
| Deleted-account support case | Process a singer removal request | Admin removes each reported result and the affected member, song, room, and Hall aggregates are rebuilt before the request is closed |

## Coordinated release order

1. Run unit, lint, production build, Firestore rules, and all affected callable emulator gates.
2. Confirm every reachable host with room activity in the prior 30 days has approved workspace access, a qualifying host entitlement, or super-admin access. Report deleted Auth owners separately; they cannot invoke the qualifying-performance contract.
3. Deploy Functions, Firestore rules, and indexes before Hosting so the UI cannot precede the server contract.
4. Deploy Hosting and record the chart-era start timestamp.
5. Smoke `/charts`, Discover teaser, profile chart identity, one qualifying signed-in performance, one guest performance, and one public-to-private transition.
6. Record release IDs and QA room/result IDs in the deployment evidence note.

## Go/no-go thresholds

Go only when:

- all automated gates are green;
- a retry leaves aggregate performance counts unchanged;
- no public chart document contains `singerUid` or another account identifier;
- guest exclusion and private-night removal pass;
- the mobile `/charts` route and Discover teaser render without horizontal overflow;
- the support report carries the result ID.
- `previewPublicChartLaunch` reports `canLaunch: true` with zero reachable, ineligible hosts in the 30-day compatibility window; orphaned owners are reported separately and do not block.
- Admin result removal is previewed first and rebuilds the affected member, canonical song, public room, all-time Hall, and weekly Hall projections.

No-go if any projection can be client-written, a private night remains public, an account UID appears in a public document, or the seed cannot resume without double-counting.

## Production preflight evidence

Recorded 2026-07-14 PDT / 2026-07-15 UTC:

- The read-only operator scan paginated all `899` production room records rather than stopping at the original `501`-record safety limit.
- `788` legacy room records remain lifecycle-open, but only `74` rooms across `2` hosts had activity in the prior 30 days.
- Both recently active hosts resolved through the same access paths accepted by `logPerformance`: one approved host and one super-admin.
- The final operator result was `canLaunch: true` with zero ineligible, orphaned, or indeterminate recently active hosts.
- Corrected callable revision `previewpublicchartlaunch-00002-vep` is active in `us-west1`; it uses the same 30-day compatibility scope, read-only entitlement resolution, complete room pagination, and separate orphan reporting.
