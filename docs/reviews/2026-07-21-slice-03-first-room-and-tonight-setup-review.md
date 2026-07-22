# Slice 03 Review - First Room and Tonight Setup

Date: 2026-07-21

Status: Accepted after owner production pass; follow-up fixes released

Slice queue: `docs/reviews/2026-07-21-host-commercial-implementation-slices.md`

## Outcome

The first-Room path now makes the private-party decisions explicit, sends the Host through Room Readiness, and gives Tonight Setup one launch action.

- Room name is required.
- Room control uses the existing Host-Led, Assisted Host, and Crowd-Driven vocabulary.
- Guest access is explicit: open to guests, BeauRocks accounts only, or a private passcode.
- Room privacy is explicit and defaults to Private; Discover is an affirmative choice.
- The backing-media plan explains the content-agnostic model without claiming a BeauRocks catalog or provider connection.
- Creating a Room continues into Room Readiness instead of bypassing Tonight Setup.
- Launch Room applies Tonight Setup, opens Public TV, and copies the Audience App link.
- If either browser handoff fails, Host Dashboard records the actual result and gives a specific recovery instruction.

A Hosting-only production canary was deployed. Backend and access expansion remain unchanged.

## Owner production pass

The owner completed a live core-karaoke playtest. Room creation, the Host surface, Audience App, Public TV, queue, and performance progression were usable through the night. The pass surfaced five concrete follow-ups: longer existing-Room names and newest-first ordering; clearer controls for transition moments and Auto DJ; the advertised 5,000-credit VIP email reward; shorter, larger microphone-vote copy with tie behavior matching the displayed result; and simpler explanations of which Room controls each preset changes.

Those follow-ups were implemented and released in commit `602b325` (`Stabilize host controls VIP rewards and mic voting`). They preserve the successful private-party core while making Room behavior more legible. The fixes have automated coverage and production deployment evidence; they have not yet received a second owner playtest covering every non-core capability.

## Production canary deployment

Hosting-only deployment completed on 2026-07-21 Pacific time.

- Firebase project: `beaurocks-karaoke-v2`
- Hosting release: `1784684251898000`
- Hosting version: `8bcc1892ad3cdd00`
- Local source commit: `9f7d69a` (`Prepare controlled Host production canary`)
- Live entry asset: `/assets/index-BlqFJg7Q.js`
- Live Host asset: `/assets/HostApp-DIOl-5KN.js`
- Live Room-launch asset: `/assets/HostRoomLaunchPad-BW8iRB9D.js`
- Firebase URL: `https://beaurocks-karaoke-v2.web.app`
- Custom domains verified: `https://beaurocks.app` and `https://host.beaurocks.app`

Deployment scope was Firebase Hosting only. Functions, Firestore rules, indexes, Storage rules, secrets, Stripe configuration, and Host cohort access were not deployed or widened.

The release commit is local and clean for deployed source. A direct push of the broad mixed-worktree commit to remote `main` was safety-blocked pending separate explicit owner approval, so remote source alignment remains a follow-up.

## Customer path

1. In Create Room, name the Room.
2. Choose Host-Led, Assisted Host, or Crowd-Driven.
3. Choose guest access.
4. Keep the Room Private by default or affirmatively list it in Discover.
5. Review the backing-media plan; playable backing is confirmed per request from Room search, a direct link, or Host uploads.
6. Continue to Room Readiness.
7. Review Tonight Setup and select Launch Room.
8. BeauRocks applies setup, opens Public TV, and copies the Audience App link.
9. If a popup or clipboard action is blocked, use the named Host Dashboard recovery action.

## Launch result contract

| Setup | Public TV | Audience App link | Host result |
| --- | --- | --- | --- |
| Applied | Opened | Copied | Room launched; no recovery needed |
| Applied | Blocked or unavailable | Copied | Use Launch TV in Host Dashboard |
| Applied | Opened | Blocked or unavailable | Use Copy Join Link in Host Dashboard |
| Applied | Blocked | Blocked | Room remains ready; recover both actions in Host Dashboard |
| Not applied | Any | Not attempted | Review Tonight Setup and retry |

The launch helper returns structured fields for `applied`, `tvReady`, `tvOpened`, `joinLinkReady`, `joinLinkCopied`, and `needsRecovery`. Analytics now records the same result dimensions under `host_room_launched`.

## Privacy and media guarantees

- The shared quick-launch discovery draft already defaults `publicRoom` to `false`; the primary UI now exposes that state instead of hiding it in advanced setup.
- Choosing Discover remains deliberate and reversible.
- Private means the Room is reached through its code or Audience App link rather than a Discover listing.
- A provider connection is not required to create a Room.
- The UI does not claim media is already playable. It tells the Host to confirm backing before calling a singer.
- Paid access, usage metering, media licensing, and offline capability are not implied by this slice.

## Implementation

- Simplified the visible Create Room form around Room name, Room control, Guest access, Room privacy, and backing media plan.
- Preserved the existing preset compiler and hidden advanced configuration contract so Host-Led, Assisted Host, and Crowd-Driven still project onto the current Room settings.
- Routed primary creation through the existing `openNightSetup` session handoff.
- Renamed the setup eyebrow to Room Readiness and consolidated the footer to one Launch Room action.
- Added a pure, injected launch-package helper for deterministic tests and browser recovery behavior.
- Updated the existing Host Room golden-flow QA selectors for the new labels.

## Adversarial gate review

### CEO lens

Pass. The shortest visible path is now aimed at a person running a private karaoke party, not a professional karaoke operator. Venue, fundraiser, economy, and show-planning controls remain available without dominating the first Room.

### CTO lens

Pass with a follow-up boundary. The launch transaction is testable and exposes partial success instead of lying about completion. It does not solve usage cost, database fan-out, or offline runtime behavior; those remain Slices 04-18.

### Chief Product Officer lens

Pass. The flow has one primary progression and one launch action. Existing product vocabulary is used. The backing-media expectation is visible before launch but does not force a provider-specific setup step.

### Chief Marketing Officer lens

Pass. Product copy now supports the private-party and content-agnostic story: Host control, optional automation, private sharing, Public TV, the Audience App, and Host-supplied or selected backing. It avoids a licensed-catalog claim.

## Verification

- Focused Slice 03 tests: 3 files, 33 tests passed.
- Full unit suite: 303 files, 1,102 tests passed.
- Focused ESLint: passed with no errors.
- Production Vite and SEO build: passed; 135 prerendered routes and 132 social cards generated.
- Production marketing release gate: passed against `https://beaurocks.app`; 9 golden-path checks, all desktop/Android/iOS cross-surface checks, and the AAHF Discover-to-Join check succeeded.
- Diff integrity: passed; only the existing HostApp line-ending warning was reported.

The authenticated golden Host Room run was not executed because it provisions and mutates a real backend Room. This production pass is assigned to the owner. Its selectors were updated so it remains available for a later approved automated canary.

The repository-wide client lint command did not report a lint error but exceeded both its two-minute combined timeout and a five-minute isolated timeout while processing the largest JSX files. Focused client lint, Functions lint, scripts lint, the full unit suite, rules suite, full callable suite, Host browser gate, marketing browser gate, and production build all passed.

## Known gaps and follow-up

1. Discover selection can precede venue and schedule enrichment; those details remain editable after Room creation.
2. Media readiness is a truthful plan and reminder, not a guarantee that a specific request already has playable backing.
3. Browser popup and clipboard policies can still block surface handoff; this slice makes those failures recoverable.
4. Cost envelopes, usage ceilings, prepaid capacity, and circuit breakers begin in Slice 04.
5. Offline and LAN operation remain later roadmap slices and are not claimed here.
6. Functions, rules, indexes, secrets, and billing configuration were not deployed.

## Rollback

- Route primary creation directly to the Host panel again by setting `openNightSetup` to false.
- Restore separate Start Room and Open TV plus Copy Link actions.
- Remove the launch helper and use the prior inline setup, popup, and clipboard flow.
- No stored Room, subscription, payment, or balance data requires migration.

## Recommended next action

Deploy a source-traceable Hosting-only release and complete the owner production pass. Do not deploy Functions, rules, indexes, or payment configuration in this canary. After the owner records a pass, accept Gate B2 and begin Slice 04: measure the Room cost envelope and contain database fan-out before opening paid Host access to a broader cohort.
