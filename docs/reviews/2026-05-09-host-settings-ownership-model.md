# Host Settings Ownership Model Audit

## Scope

This audit is based on the current host code and backend guardrails in:

- `src/apps/Host/HostApp.jsx`
- `src/apps/Host/components/HostTopChrome.jsx`
- `src/apps/Host/lib/hostUiPrefs.js`
- `src/lib/hostAudioLibrary.js`
- `src/lib/bgTrackOptions.js`
- `functions/index.js`
- `firestore.rules`
- `storage.rules`

Counts below use first-class host control surfaces only. They ignore passive summaries, preset chips, and read-only previews.

## Snapshot

- Admin is currently organized into `6` section groups.
- It contains `11` tab surfaces total.
- `9` of those are visible as normal admin destinations.
- `2` are handoff/recovery surfaces hidden from the normal admin nav:
  - `Live Controls`
  - `Live Effects`

Visible admin destinations today:

1. `Night Setup`
2. `Automation`
3. `Chat`
4. `Approvals`
5. `Tips + Boosts`
6. `Screens + Playback`
7. `Overlays`
8. `Billing`
9. `Diagnostics`

Outside Admin, hosts also have three high-power runtime control surfaces:

1. `Top Chrome > Room`
2. `Top Chrome > Automation`
3. `Top Chrome > Overlays`

There is also a separate `Night Setup` modal/flow that overlaps with some Admin controls.

## Current Storage Reality

### 1. Room-scoped settings

The room document is still the main owner of most host-facing configuration.

Examples currently stored on `rooms/{roomCode}`:

- queue/request policy
- audience join policy
- automation defaults
- TV and overlay behavior
- branding fields like `hostName`, `logoUrl`, `tipUrl`, `tipQrUrl`
- bingo sponsor fields like `bingoSponsorName` and `bingoSponsorLogo`
- run-of-show state and policy
- a field named `hostUiPrefs`

Important note:

- `hostUiPrefs` is not actually host-personal today.
- It is room-scoped persisted state on the room document.
- That means things like runtime shell mode are currently room settings, not personal host settings.

### 2. Room-scoped libraries

The system already has multiple room-scoped library stores:

- `host_libraries/{roomCode}`
  - `ytIndex`
  - `logoLibrary`
  - `orbSkinLibrary`
  - game banks like `trivia`, `wyr`, `bingo`
- `room_uploads`
  - generic uploaded media
  - audio uploads
  - background-bed uploads
  - SFX uploads
- `room_scene_presets`
  - reusable TV scene items
  - sponsor cards
  - flyers
  - interstitial media scenes
- Storage paths
  - `room_branding/{roomCode}/...`
  - `room_scene_media/{roomCode}/...`

### 3. Organization-scoped data

Organizations are real backend entities already, but they are mostly used for access and billing rather than shared content/settings inheritance.

Current organization model:

- `organizations/{orgId}`
- `organizations/{orgId}/members`
- `organizations/{orgId}/subscription/current`
- `organizations/{orgId}/entitlements/current`
- `organizations/{orgId}/usage/...`
- `organizations/{orgId}/invoices/...`

Important note:

- Rooms carry `orgId`.
- Hosts are explicitly blocked from mutating `orgId` through room updates.
- This is already a strong signal that room ownership and workspace ownership should be separate concerns.

### 4. Missing layer: true host-personal settings

There is not a strong host-personal settings layer yet.

That is the core modeling problem:

- many things that feel like `host defaults` are actually stored per room
- many things that feel like `workspace/shared assets` are also stored per room

## Current Admin Inventory

### Night Setup

Current themes in this page:

- run-tonight shortcuts
- audience shell mode and audience access rules
- branding and tips
- queue settings
- scoring/fame toggles
- auto-play media
- bingo reopen
- auto lyrics
- pop trivia
- ready check tuning
- applause/recap timing
- search source policy
- guest request policy
- unknown backing policy
- embeddable-only YouTube policy
- audience join policy

### Automation

Current themes in this page:

- auto DJ
- auto BG music
- auto stage playback
- auto end
- auto bonus
- pop trivia
- ready check duration/reward
- auto-DJ delay
- auto bonus points
- auto party settings

### Chat

Current themes in this page:

- chat policy
- DM behavior
- chat routing
- TV chat behavior

### Approvals

Current themes in this page:

- moderation entry points
- audience review policy
- inbox shortcuts

### Tips + Boosts

Current themes in this page:

- event credits
- room-specific boost offers
- tip crate pricing and reward scope

### Screens + Playback

Current themes in this page:

- TV queue defaults
- scoring / fame / TV chat / marquee quick toggles
- media ingestion
- Apple Music setup
- upload-to-library flows
- TV scene save path

### Overlays

Current themes in this page:

- marquee timing
- marquee rotation items

### Billing

Current themes in this page:

- plan
- workspace status
- usage
- invoices
- checkout / billing portal

### Diagnostics

Current themes in this page:

- smoke tools
- debug snapshots
- recovery surfaces

## Duplicate Toggle Count

These are the highest-signal overlaps in the current host UX.

| Setting or cluster | Count | Current surfaces |
| --- | ---: | --- |
| `popTriviaEnabled` | `5` | Night Setup modal, Admin `Night Setup`, Admin `Automation`, Top Chrome `Automation`, Top Chrome `Overlays` |
| `chatShowOnTv` | `4` | Night Setup modal, Admin `Chat`, Admin `Screens + Playback`, Top Chrome `Overlays` |
| `showScoring` | `4` | Night Setup modal, Admin `Night Setup`, Admin `Screens + Playback`, Top Chrome `Overlays` |
| queue rules (`queueLimitMode`, `queueLimitCount`, `queueRotation`, `queueFirstTimeBoost`) | `3` | Night Setup modal, Admin `Night Setup`, Top Chrome `Room` |
| `autoPlayMedia` | `3` | Night Setup modal, Admin `Night Setup`, Top Chrome `Automation` |
| `marqueeEnabled` | `3` | Night Setup modal, Admin `Screens + Playback`, Top Chrome `Overlays` |
| `readyCheckDurationSec` | `3` | Admin `Night Setup`, Admin `Automation`, Top Chrome `Room` |
| `requestMode` | `2` | Admin `Night Setup`, Top Chrome `Room` |
| `autoDj` | `2` | Admin `Automation`, Top Chrome `Automation` |
| `autoBgMusic` | `2` | Admin `Automation`, Top Chrome `Automation` |
| `autoEndOnTrackFinish` | `2` | Admin `Automation`, Top Chrome `Automation` |
| `autoBonusEnabled` | `2` | Admin `Automation`, Top Chrome `Automation` |
| `autoLyricsOnQueue` | `2` | Admin `Night Setup`, Top Chrome `Automation` |

Controls that now appear to have a single practical owner in current code:

- `audienceJoinPolicy`
- `unknownBackingPolicy`
- `hideNonEmbeddableYouTube`
- `runtimeShellMode`
- `postPerformanceBackingPromptEnabled`

That is better than the older audit, but the surface is still too duplicated overall.

## Clear Ownership Model

## What should be room-scoped

A room should own anything that is specific to one live event, one venue session, or one room runtime.

Room scope should include:

- queue rules
- guest request rules
- audience join behavior for that room
- unknown backing policy
- embeddable-only YouTube policy
- automation defaults for that room
- TV/overlay behavior for that room
- run-of-show plan and live state
- sponsor state for that event
- room media working set
- room scene library
- room audio library
- event-specific branding overrides

Examples from the current system that are correctly room-like:

- `requestMode`
- `queueSettings`
- `autoDj`
- `autoPlayMedia`
- `chatShowOnTv`
- `marqueeEnabled`
- `runOfShowDirector`
- `room_uploads`
- `room_scene_presets`
- `bingoSponsorName` / `bingoSponsorLogo`

## What should be host-scoped

A host should own portable defaults that follow them across rooms.

Host scope should include:

- host display name default
- default tip links
- preferred default branding pack
- personal operating preferences
- personal workflow preferences
- saved host presets/templates
- favorite reusable host-only assets

Examples that feel host-scoped but are currently room-scoped:

- `hostName`
- `tipUrl`
- `tipQrUrl`
- `logoUrl`
- `lobbyOrbSkinUrl`
- `hostUiPrefs.runtimeShellMode`

Recommendation:

- create a real `host profile` or `host defaults` object per user
- let rooms inherit from it at creation time
- let rooms override it locally when needed

## What should be organization-scoped

An organization should own anything shared across multiple hosts or multiple rooms.

Organization scope should include:

- billing
- subscription and entitlements
- workspace roles
- approved operators / members
- shared room templates
- shared branding kits
- shared sponsor kits
- shared scene templates
- shared audio packs
- shared moderation defaults
- shared automation presets

This is especially important for multi-host setups.

If multiple hosts work under one organization, the organization should be able to own:

- sponsor logos and sponsor copy blocks
- approved sponsor scene templates
- official event themes
- venue-specific branding packs
- reusable background playlists
- approved queue/moderation presets

Current gap:

- the organization model already exists for billing/access
- it does not yet exist as the canonical owner for shared libraries and shared defaults

## Library Model

## Media library

### Current state

The media library is split across:

- `room_uploads`
- `room_scene_presets`
- `host_libraries/{roomCode}`
- storage buckets

That makes sense operationally, but it is still fully room-scoped.

### Recommended model

Split media libraries into three layers:

1. `Organization media library`
   - shared sponsor slides
   - venue loops
   - official event assets
   - reusable branded interstitials

2. `Host personal library`
   - host favorite drops
   - personal branding variants
   - personal reusable scene templates

3. `Room event library`
   - tonight-only uploads
   - event-specific sponsor cards
   - temporary donor slides
   - one-off scene variations

## Background track library

### Current state

Background tracks are currently split between:

- built-in global BG tracks from code constants
- custom room audio uploads categorized as `bg`

This means the system already has:

- a global base catalog
- a room-scoped custom extension layer

### Recommended model

Use a three-tier model:

1. `Global built-ins`
2. `Organization-approved BG packs`
3. `Room playlist for tonight`

That keeps the product simple while still allowing brand/event-specific beds.

## Scene library

### Current state

Scenes are currently room-scoped through:

- `room_scene_presets`
- `room_scene_media/{roomCode}/...`

This is correct for event-specific sponsor slides, flyers, and one-night moments.

### Recommended model

Support both:

1. `Organization scene templates`
   - approved sponsor cards
   - official opener / closing cards
   - venue/brand takeovers

2. `Room scene instances`
   - tonight's chosen assets
   - room-local edits
   - run-of-show placement

Room scenes should be able to reference an org template and then snapshot locally for historical stability.

## Sponsor model

### Current state

Sponsor data is fragmented:

- direct room fields like `bingoSponsorName` and `bingoSponsorLogo`
- sponsor scenes in `room_scene_presets`
- sponsor beats in run-of-show planning
- future sponsor-block state planned on the room

### Recommended model

Create an organization-level `sponsor kit` concept:

- sponsor identity
- logos
- approved copy
- destination links / CTA
- sponsor scene templates
- optional soundtrack / cue defaults

Then each room chooses:

- which sponsor kits are active tonight
- where they appear in the run of show
- whether the room uses local overrides

## Product Recommendation

The clean mental model should be:

1. `Organization` sets shared capabilities, roles, billing, brand kits, sponsor kits, and reusable templates.
2. `Host` sets portable personal defaults and favorite workflows.
3. `Room` sets tonight's rules, tonight's runtime defaults, tonight's media, and tonight's live state.

## Practical IA Recommendation

### Admin should own only persisted defaults and setup

- Room Policy
- Automation Defaults
- TV + Audience Defaults
- Media Library Management
- Support Economy
- Billing + Workspace
- Diagnostics + Recovery

### Top Chrome should own live runtime changes only

- Room quick changes
- Automation quick changes
- Overlays / previews
- emergency actions

### Queue / Show surfaces should own contextual execution

- scene launch
- scene queueing
- media execution
- run-of-show control
- moderation review

## Key Conclusion

The main issue is not just duplication.

The deeper issue is that the product currently has:

- a strong room model
- a partial organization model
- almost no true host-personal model

And because of that, too many settings that feel like `host defaults` or `workspace defaults` are still being stored as `room settings`.

That is the architectural seam to fix first.
