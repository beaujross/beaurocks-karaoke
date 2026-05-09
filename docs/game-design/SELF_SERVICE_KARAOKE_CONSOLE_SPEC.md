# Self-Service Karaoke Console Spec

Last updated: 2026-05-08
Status: Draft
Owner: Product / Game Design / Live Systems

Companion docs:

- `docs/game-design/GUARDRAILS.md`
- `docs/game-design/MODE_PROFILES.md`
- `docs/ARCHITECTURE_OVERVIEW.md`
- `docs/RUN_OF_SHOW_LOW_INTERACTION_SPEC.md`
- `docs/TURNKEY_ONBOARDING_MONETIZATION_PLAN.md`

Implementation anchors:

- `src/games/PromptVote/Game.jsx`
- `src/games/KaraokeBracket/Game.jsx`
- `src/apps/TV/PublicTV.jsx`
- `src/apps/Mobile/SingerApp.jsx`
- `src/apps/Host/components/HostQueueTab.jsx`
- `src/lib/runOfShowDirector.js`
- `src/lib/roomMonetization.js`
- `functions/index.js`

## Objective

Define a standalone self-service karaoke framework that can run without live host input while still feeling premium, social, and unmistakably BeauRocks.

This is not `audience controls the host panel`.

This is a new product family: a self-service live console that can run several distinct kinds of karaoke nights with different rules for:

- queue entry
- queue ordering
- crowd voting
- money influence
- competition integrity
- TV presentation

## Product Thesis

The product should not be one giant `100 percent crowd guided` mode.

It should be one `Self-Service Karaoke Console` framework with several rule presets:

- `Open Mic Self-Serve`
- `Crowd Control Party`
- `Fundraiser Auction`
- `Ranked Showcase`
- `Karaoke Bracket`

Each preset should feel like a coherent night format, not a bag of toggles.

The rule clarity matters more than maximum freedom. The room should understand the format quickly:

- how to join
- how to sing
- how the next singer is chosen
- when the crowd gets a vote
- whether money can affect order or outcomes

Host setup should also be legible quickly. A host should not need to think in terms like `queueOrderingPolicy` or `slotMonetizationPolicy` during a live setup flow.

## Core Principles

1. Self-service does not mean uncontrolled.
2. Crowd participation should be high, but bounded and legible.
3. Money can unlock access, fund the room, and affect fundraiser-specific priority.
4. Money should not casually buy a winner in ranked or prestige formats.
5. TV is the hero surface. Mobile should feel like a controller, not a form.
6. The system should operate on explicit policies, not one-off logic per mode.
7. The premium bar is a live console experience, not an admin dashboard with fewer buttons.
8. Hosts should choose branded event formats, not configure governance systems.
9. Every live money mechanic must have a plain-English explanation before activation.

## Primary Experience Loop

Every self-service preset should be a variation of the same loop:

1. `Join`
2. `Become eligible`
3. `Enter the queue or candidate pool`
4. `Resolve next-up decision`
5. `Perform`
6. `React, score, or support`
7. `Advance to next moment`

The room should always know what state it is in and what the next action is.

## Policy Framework

Each self-service night should be defined by a small rules object instead of scattered feature flags.

This rules object is an internal product and engineering abstraction. It should not be exposed directly as a normal host setup surface.

Required policy axes:

- `queueEntryPolicy`
- `queueOrderingPolicy`
- `voteCadencePolicy`
- `voteWeightPolicy`
- `moneyInfluencePolicy`
- `slotMonetizationPolicy`
- `eligibilityPolicy`
- `fallbackPolicy`
- `repeatProtectionPolicy`
- `visualPresentationProfile`

### Queue Entry Policy

Examples:

- `open_join`
- `joined_audience_only`
- `paid_entry_required`
- `sponsored_slot_claim`
- `invited_showcase`

### Queue Ordering Policy

Examples:

- `round_robin`
- `round_robin_with_crowd_song_pick`
- `crowd_pick_top_n`
- `donation_auction`
- `showcase_rounds`
- `bracket`

### Vote Cadence Policy

Examples:

- `none`
- `song_choice_only`
- `between_every_slot`
- `between_rounds`
- `top_n_tiebreak_only`

### Vote Weight Policy

Examples:

- `free_one_person_one_vote`
- `free_vote_plus_points_boost`
- `audience_plus_judges`
- `judges_only_with_crowd_reactions`
- `donation_weighted`

### Money Influence Policy

Examples:

- `none`
- `entry_only`
- `support_only`
- `priority_only`
- `fundraiser_priority`
- `cosmetic_only`

### Slot Monetization Policy

Examples:

- `off`
- `entry_fee_only`
- `buy_slot_credit`
- `sponsor_slot_pack`
- `priority_upgrade`
- `room_sponsor_block`
- `donation_auction`

### Fallback Policy

Examples:

- `auto_lock_single_candidate`
- `fallback_to_round_robin`
- `fallback_to_host_observer_override`
- `pause_until_more_candidates`

## Mode Family

## Host-Facing Packaging

The launcher should present branded formats, not raw system names.

Recommended host-facing launch names:

- `BeauRocks Open Stage`
- `BeauRocks Spotlight Auction`
- `BeauRocks Showcase`

Internal preset names may still map to:

- `Open Mic Self-Serve`
- `Fundraiser Auction`
- `Ranked Showcase`

Do not lead with five equal-weight options in the launcher. The default launch surface should expose at most three top-level formats.

## `Open Mic Self-Serve`

Intent:

- Preserve fairness
- Minimize operator needs
- Keep the room moving

Recommended rules:

- queue entry: `open_join`
- queue ordering: `round_robin_with_crowd_song_pick`
- vote cadence: `song_choice_only` or `between_breaks`
- vote weight: `free_one_person_one_vote`
- money influence: `entry_only` or `support_only`
- slot monetization: `off` or `buy_slot_credit`

What the crowd controls:

- which ready song a singer performs
- optional keep-singing vs short-break decisions

What the crowd does not control:

- full queue reordering every turn
- ranked outcomes

## `Crowd Control Party`

Intent:

- Maximize participation and energy
- Let the room steer the mood without becoming chaotic

Recommended rules:

- queue entry: `joined_audience_only`
- queue ordering: `crowd_pick_top_n`
- vote cadence: `between_every_slot`
- vote weight: `free_one_person_one_vote` or `free_vote_plus_points_boost`
- money influence: `support_only`
- slot monetization: `buy_slot_credit` or mild `priority_upgrade`

What the crowd controls:

- which of the top ready candidates goes next
- room mood prompts
- break vs keep-moving prompts

Guardrail:

- crowd votes from a bounded candidate pool, not the full raw queue

## `Fundraiser Auction`

Intent:

- Maximize donations without making the whole room feel extractive

Recommended rules:

- queue entry: `open_join` or `paid_entry_required`
- queue ordering: `donation_auction` for a named auction window
- vote cadence: optional `top_n_tiebreak_only` or optional top-2/top-3 crowd vote
- vote weight: `free_one_person_one_vote` for the crowd layer
- money influence: `fundraiser_priority`
- slot monetization: `donation_auction`, `sponsor_slot_pack`, `room_sponsor_block`

Recommended product expressions:

- `Bid For The Opening Showcase`
- `Sponsor The Next Hour`
- `Fund 10 Singing Slots`
- `Buy A Featured Slot`

Guardrail:

- auction ordering should apply only to a named window such as `first_10_slots`, `next_60_min`, or `featured_block`

## `Ranked Showcase`

Intent:

- Create a credible talent-show style format

Recommended rules:

- queue entry: `invited_showcase` or structured signup
- queue ordering: `showcase_rounds`
- vote cadence: `between_rounds`
- vote weight: `audience_plus_judges` or `judges_only_with_crowd_reactions`
- money influence: `none` or `cosmetic_only`
- slot monetization: `entry_fee_only`

Hard rule:

- money must not alter winners, advancement, or judging integrity

## `Karaoke Bracket`

Intent:

- Deliver elimination-style competition

Recommended rules:

- queue entry: structured signup
- queue ordering: `bracket`
- vote cadence: match-by-match
- vote weight: `free_one_person_one_vote` or audience-plus-judges
- money influence: `cosmetic_only`
- slot monetization: `entry_fee_only` or sponsor-funded prize support only

Launcher note:

- `Karaoke Bracket` should remain a deeper or advanced format, not a primary day-one launcher tile for normal hosts

## Queue Strategy

Do not build one global queue system that behaves the same way in every mode.

The queue should support several strategies under one interface.

### Strategy 1: `round_robin`

- best for fairness
- lowest room confusion
- default for non-competitive casual nights

### Strategy 2: `round_robin_with_crowd_song_pick`

- preserves singer fairness
- adds audience ownership
- strongest casual default

### Strategy 3: `crowd_pick_top_n`

- system maintains a fair candidate pool
- crowd decides from top `2` or top `3`
- delivers drama without queue thrash

### Strategy 4: `donation_auction`

- verified donors or buyers establish priority within a named scope
- strongest fit for fundraiser openings or sponsored blocks
- should not become the permanent all-night queue default

### Strategy 5: `showcase_rounds`

- queue is secondary
- scheduled round or wave structure is primary

### Strategy 6: `bracket`

- elimination flow
- not compatible with open casual queueing

## Voting Constitution

The system should treat these as separate mechanics:

- `governance votes`: decide what happens next
- `support spending`: applause, boosts, sponsor moments, cosmetics
- `competitive scoring`: determines ranking or winners

These should not be conflated by default.

### Governance Votes

Use for:

- next singer from top `N`
- next song from a singer's ready set
- keep singing vs room break
- special round or mood prompt

Recommended technical substrate:

- PromptVote-style callable vote writes
- dedicated vote collection
- public projection doc for TV and audience reads

### Support Spending

Use for:

- applause boosts
- spotlight moments
- sponsor callouts
- premium reactions

Support spending can influence energy and ceremony without deciding winners by default.

### Competitive Scoring

Use for:

- ranked showcase outcomes
- bracket match outcomes

Competitive scoring should have the strictest integrity rules.

## Slot Monetization

Slot monetization is a separate policy layer, not an accidental side effect of queueing.

Supported monetization types:

- `entry_fee_only`
- `buy_slot_credit`
- `sponsor_slot_pack`
- `priority_upgrade`
- `room_sponsor_block`
- `donation_auction`

### Recommended Product Principles

- Money can unlock participation.
- Money can sponsor the room.
- Money can create bounded fundraiser priority.
- Money should not casually buy a winner.

### Strong Monetization Products

#### `Sponsor The Next Hour`

- buyer funds the next `N` participation credits or `T` minutes
- room enters a sponsored block
- sponsor gets visible recognition
- queue still follows the mode's fairness policy

#### `Fund 10 Singing Slots`

- buyer funds a pool of claimable sing credits
- strongest social/fundraiser mechanic

#### `Buy A Featured Slot`

- one fixed-price featured performance slot
- easier to explain than a full auction

#### `Bid For The Opening Showcase`

- highest verified bids claim the opening block
- ideal for fundraiser nights, galas, and special events

## Donation Auction Queue

If the product supports `top bidders sing first`, this must be an explicit mode policy, not a vague room behavior.

### Recommended Policy Name

- `queueOrderingPolicy = donation_auction`

### Recommended Auction Variants

1. `opening_auction_queue`
2. `fundraiser_priority_window`
3. `priority_boost`
4. `buy_it_now_featured_slot`

### Recommended MVP

- `opening_auction_queue`

Meaning:

- top verified bidders win the first `N` slots
- after that block, queue reverts to the preset's normal fairness policy

### Required Guardrails

- auction scope must be explicit
- bid only counts after verified settlement
- one singer has a max win cap
- no automatic back-to-back wins unless the room is undersupplied
- tie-breaker is verified bid time
- crowd vote among top `2` or top `3` may be enabled for added drama
- ranked modes should not use donation auction ordering

### Payment Integrity Rule

Never sort the live queue directly from raw Givebutter or Stripe events.

Required model:

1. payment clears
2. system writes a verified support or bid record
3. queue engine consumes the verified ledger

This prevents replay, webhook-ordering, and partial-settlement problems.

## Economy Boundaries

The economy stance should be explicit per preset.

### `Party`

- support and boosts can influence room flavor
- avoid major pay-to-win mechanics

### `Fundraiser`

- donations can influence priority within bounded windows
- donations can unlock sponsor blocks, credits, and premium room moments

### `Ranked`

- money cannot alter winners
- acceptable uses are entry fee, sponsor-funded prize support, and cosmetic celebration

## Host Launch Model

Self-service modes should launch like event formats, not workflow builders.

### Launch Flow

1. Pick a format.
2. Read a one-screen rules summary.
3. Confirm fallback and recovery behavior.
4. Preview on TV.
5. Go live.

### Required Rules Summary

Every launchable format must state in plain English:

- who can join
- how next-up is chosen
- whether the crowd votes and when
- whether money affects order or outcomes
- whether the host can step in or return to normal karaoke

### Example Host Summaries

#### `BeauRocks Open Stage`

- Singers rotate fairly.
- The crowd can pick from a singer's ready songs.
- Money does not change who wins the night.

#### `BeauRocks Spotlight Auction`

- Top verified donors claim the opening showcase slots.
- After the auction block, the room returns to fair queueing.
- The crowd may vote between top candidates if this option is enabled.

#### `BeauRocks Showcase`

- Performers compete in structured rounds.
- Audience and judges decide winners based on the selected scoring model.
- Money does not affect advancement.

## Support And Recovery Requirements

Customer support burden will spike if this mode behaves like a second product with hidden rules.

The live system must make recovery obvious.

### Required Recovery Controls

- `Preview Before Go Live`
- `Return To Normal Karaoke`
- `Pause New Entries`
- `Disable Paid Priority`
- `End Sponsored Block`

### Required Why-Did-This-Happen Explanations

The host surface should always be able to answer:

- why a singer is next
- why a vote opened
- why a paid priority or auction result happened
- why the room auto-advanced

Example status lines:

- `Next singer chosen by round robin`
- `Opening slot awarded by highest verified bid`
- `Song chosen by crowd vote`
- `Only one ready singer; auto-locked`

### Required Fallbacks

- if no one votes, auto-resolve safely
- if only one singer is ready, auto-lock them
- if no ready singers exist, show a clear attract or recruiting state
- if payment verification is pending, the singer should see that status explicitly
- if participation drops, revert to the preset's safe fallback queue behavior

### Payment Dispute Visibility

Any paid queue mechanic requires a visible status chain:

- payment received
- verification pending or complete
- bid or credit recorded
- slot assigned or not assigned
- tie-break rule if relevant

Support should never need to reconstruct these events from logs for common disputes.

## Visual System: Premium BeauRocks Console

This feature family should look and feel like a live entertainment console, not a reduced host admin page.

### Visual Direction

Keep BeauRocks branding, but raise the fidelity bar:

- rich black base
- neon cyan
- hot pink
- electric amber
- chrome and glass accents
- oversized type
- confident contrast
- cinematic transitions
- strong scene framing

### Design Rule

Every major state gets:

- one dominant action
- one dominant piece of live information
- one clear emotional tone

Avoid:

- walls of equal-weight buttons
- dashboard tables as the primary experience
- settings-panel composition on TV
- utility-card clutter in live states

### TV State Model

#### `Attract`

- giant QR
- room code
- tonight's format
- live join count
- sponsor or event headline

#### `Queue Live`

- `Now`
- `On Deck`
- `In Contention`
- live queue motion

#### `Vote Window`

- full-screen candidate cards
- animated timer
- vote momentum
- big reveal space

#### `Performance Live`

- performer spotlight
- minimal distraction
- reaction energy visible

#### `Result Reveal`

- winner lock
- next-up reveal
- sponsor callout if relevant

### Mobile State Model

Mobile should feel like a controller:

- one-tap join
- one clear action per state
- large vote cards
- visible credit or bid status
- queue status without admin density

### Console Experience Target

The benchmark is:

- premium
- event-grade
- console-like
- legible from across the room
- visibly higher-end than generic karaoke apps

Marketing standard:

- iconic enough that people film the TV
- polished enough that a venue or fundraiser organizer would brag about using it
- branded enough that BeauRocks feels like a live format, not a utility app

## Architecture Recommendation

Build this as a new self-service mode framework, not as a thin patch over host runtime controls.

### Reuse As Primary Building Blocks

- PromptVote pattern for general crowd decision rounds
- KaraokeBracket pattern for structured competition
- existing Givebutter and Stripe ingestion rails for verified monetary events
- existing TV QR and audience join surfaces
- existing audience queue submission primitives where safe

### Reuse As Secondary Patterns

- bingo thresholding and participant gating for quorum-style participation logic
- run-of-show release-window voting only for narrow transitional decisions, not the core self-service engine

### New Systems To Add

- `selfServeMode` room controller
- preset configuration schema
- queue policy engine
- vote policy engine
- verified bid ledger
- auction leaderboard projection
- sponsor block state
- premium TV state machine

Implementation note:

- avoid creating a completely separate queue universe when existing queue primitives can be extended
- reuse shared projections and decision lifecycles where possible instead of inventing one-off collections per feature without a clear scaling reason

## Data Model Direction

Likely additions:

- `rooms/{roomCode}.selfServeMode`
- `rooms/{roomCode}.selfServePreset`
- `rooms/{roomCode}.queuePolicyState`
- `rooms/{roomCode}.auctionPolicyState`
- `rooms/{roomCode}.sponsorBlockState`
- `self_serve_votes/*`
- `self_serve_vote_public/*`
- `self_serve_bids/*`
- `self_serve_bid_public/*`
- `self_serve_slot_credits/*`

These should be projection-friendly and audit-friendly.

High-volume writes should prefer dedicated collections plus public projection docs rather than heavy room-doc mutation.

## Recommended Delivery Sequence

### Phase 1: Policy Foundation

- define preset schema
- define queue policy contracts
- define money influence rules
- define integrity boundaries for ranked modes

### Phase 2: Premium Console Shell

- build TV-first self-service shell
- build mobile controller states
- establish motion, typography, and branded visual system

### Phase 3: Fair Self-Service Queue

- ship `Open Mic Self-Serve`
- implement `round_robin_with_crowd_song_pick`
- add break-vs-keep-singing prompt

### Phase 4: Crowd Control Layer

- ship `Crowd Control Party`
- implement `crowd_pick_top_n`
- generalize PromptVote into reusable crowd governance prompts

### Phase 5: Fundraiser Monetization

- implement sponsored slot packs
- implement `Sponsor The Next Hour`
- add slot credit claiming and sponsor block UI

### Phase 6: Donation Auction

- add verified bid ledger backed by Givebutter and Stripe
- ship `Bid For The Opening Showcase`
- optionally add crowd vote among top auction candidates

### Phase 7: Ranked And Bracket Hardening

- formalize `Ranked Showcase`
- harden score integrity
- refine bracket presentation and premium reveal states

## Recommended V1 Launch Package

Do not launch all mode families at once.

Recommended v1 host-facing lineup:

- `BeauRocks Open Stage`
- `BeauRocks Spotlight Auction`

Recommended v1 implementation order:

1. `BeauRocks Open Stage`
2. `BeauRocks Spotlight Auction`
3. `BeauRocks Showcase` as a pilot or phase-two format

This keeps launch understandable while preserving the broader product family in the design system.

### V1 Non-Negotiables

- no raw policy configuration in the main host launcher
- no dead-end state when participation is low
- no hidden money influence rules
- no irreversible queue conversion without a clear return path
- no payment-based queueing without explicit verification and dispute visibility

## Open Decisions For Product

These still need explicit product calls:

1. How often should the crowd get a vote in party mode?
2. Can support points influence governance in casual modes?
3. What is the max acceptable queue priority purchased by money in fundraiser mode?
4. Can a donor win multiple opening slots?
5. Is ranked showcase audience-only, judges-only, or hybrid?
6. Which presets should be launchable from day one?
7. Should self-service modes allow an observer host override, or be strictly autonomous?
8. Should `Crowd Control Party` ship later as a variant of `Open Stage` instead of a separate launcher tile?

## Decision Summary

Recommended baseline:

- Build a self-service framework, not one giant crowd-control mode.
- Use mode presets with explicit policy objects.
- Make `round_robin_with_crowd_song_pick` the fair default.
- Make `crowd_pick_top_n` the main party interaction pattern.
- Make `donation_auction` a fundraiser-specific queue policy with explicit guardrails.
- Protect ranked modes from money-influenced outcomes.
- Treat BeauRocks visual identity as a premium live console system, not a dashboard theme.
- Let hosts launch branded formats with plain-English rules, preview, and recovery paths.
