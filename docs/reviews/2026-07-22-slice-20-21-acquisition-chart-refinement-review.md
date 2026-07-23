# Slices 20-21: Acquisition and Chart Refinement Review

Date: 2026-07-22

Status: deployed to production and browser-smoke accepted

## Outcome

This bounded release advances private-party acquisition and the public activity growth loop without claiming that paid Host checkout, unrestricted Host access, BeauBucks checkout, or offline hosting are publicly available.

## Host workload

- Quick Room creation now says `Choose tonight's rewards` and explains that Points run live participation.
- The unreachable `Points + BeauBucks` launch compiler branch is repaired for backward compatibility.
- Quick creation no longer presents BeauBucks as a normal launch-economy choice. Eligible Rooms receive the existing single `BeauBucks cosmetics` switch after server-authorized Room creation.
- Ticket perks, fundraiser support, custom Points rules, grants, refills, and the existing advanced controls remain available.
- The Host is told that BeauBucks cosmetics never change Points or performance scoring.

## Public vocabulary and persona paths

- Public copy uses Room, Host Dashboard, Audience App, Public TV, Points, BeauBucks, Fame, Song Crown, Singer Momentum, and Active Nights.
- `Canonical song` remains internal. Public copy explains the behavior as `Different versions. One record` and `One song, one leaderboard`.
- The home page leads with self-hosted karaoke for home and private parties.
- The Host page leads with at-home and private-party control while retaining reviewed-access truth.
- Charts route Song Crowns to private-party Hosts, Singer Momentum to singers and guests, and Active Nights to venue and recurring-night operators.
- Venue, event, Host, and performer detail pages now use one visible `h1` for their primary entity title.

## Programmatic chart improvement

- Every real public song projection can now carry a maximum of three sanitized performance leaders inside its existing bounded public document.
- The projection exposes no user ID, Room code, or raw performance document. Anonymous identity remains anonymous and loses avatar data.
- New qualified performances update the challenger ladder in the same transaction as the Song Crown.
- Result moderation rebuilds the top three from remaining qualified performances.
- The public page renders a focused `King of the hill` ladder for the leading real song without adding per-song listeners.
- Opening scores remain presentation-only and are excluded from the real challenger ladder and structured search data.
- Evidence-backed real Song Crown leaders generate `ItemList` JSON-LD for search and answer engines.

## Adversarial review

### CEO

The release sharpens the primary commercial story—run karaoke yourself at home or at a private event—while keeping venues and performers as separate acquisition paths. It does not turn the directory into the product's primary identity.

### CTO

The ladder adds no new public collection, query, index, or unbounded listener. It is capped at three entries, transactionally updated, moderation-repairable, and covered by emulator integration. Paid and offline claims remain fail-closed.

### Chief Product Officer

The Host sees one fewer false choice during Room creation. BeauBucks remains available where the server authorizes it, but it is no longer presented as a competing live score currency. Chart measures now state what they reward.

### Chief Marketing Officer

Each chart has an explicit audience and conversion path. Search language includes karaoke high scores, karaoke leaderboards, song crowns, singer activity, venue activity, at-home karaoke, and private-party hosting without exposing internal identity vocabulary.

## Verification gate

- Focused Host and chart unit tests.
- Full unit suite.
- Directory callable Firestore-emulator suite, including public projection and moderation repair.
- Focused lint and full lint.
- Production build.
- Functions and Hosting release together because the public ladder depends on the new projection field.

## Production review

1. Open `/charts` and confirm Song Crowns is the default.
2. Switch among Song Crowns, Singer Momentum, and Active Nights; confirm each explanation and CTA changes.
3. Confirm opening scores are labeled as non-performance challenges.
4. If a real song result is present, confirm its top-three ladder shows only qualified public identity and offers Report links.
5. Follow each chart CTA to the Host, Discover, and Venue persona paths.
6. Open the home, Host, performer, venue, and event pages; confirm private-party positioning and one visible primary page heading.
7. In Host Room creation, confirm Points, ticket perks, fundraiser support, and custom rules remain available; BeauBucks appears only after entering an eligible Room.

## Release evidence

- Source commit: `bebd29f` on `main`.
- Functions: `logPerformance-00141-huh` and `moderatePublicChartResult-00007-jeg`, both serving 100% traffic.
- Hosting release: `1784770832827000` at `https://beaurocks-karaoke-v2.web.app` and `https://beaurocks.app`.
- Live metadata returned 200 for `/`, `/charts`, and `/for-hosts` with the new intent titles.
- Production browser smoke passed Charts and Discover handoff at 1440x960 and 390x844 with no page errors, warning state, or horizontal overflow.
