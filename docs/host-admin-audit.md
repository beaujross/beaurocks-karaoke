# Host Admin Audit

## Working Split

- `Admin` should own saved room defaults, account/workspace setup, billing, and diagnostics.
- `Top chrome` should own live runtime toggles and one-tap show operations.
- `Queue / Stage / Show` workspaces should own context-specific live actions such as queue launches, scene launches, inbox review, and media execution.

## Admin Inventory

### Night Setup

- Run Tonight shortcuts: open night setup, open Public TV, copy join link, open live modes, connect Apple Music, jump to chat, jump to approvals.
- Audience App Layout: classic vs streamlined audience shell, audience preview visibility, audience preview compact mode, TV preview visibility, TV preview compact mode.
- Audience Access: BeauRocks account requirement for custom emoji and featured reactions.
- Branding + Tips: host name, logo manager, orb skin manager, tip link, tip QR.
- Night Profiles: host presets, event profiles.
- Guest Flow + Audience Settings:
  - queue limit mode
  - queue limit count
  - queue rotation
  - first-time boost
  - show scoring
  - auto-play media
  - fame level visibility
  - bingo reopen
  - auto lyrics on queue
  - pop trivia
  - ready check duration
  - ready check reward
  - auto-BG fade out
  - auto-BG fade in
  - BG mix during performance
  - post-performance recap on TV
  - applause warm-up
  - applause countdown
  - applause meter duration
  - recap beat
  - leaderboard beat
  - next-up beat
  - clear room data
  - download room data
  - preview recap on TV
  - declare round winners
  - clear round winners podium
  - close room + generate recap
  - search sources
  - embeddable-only YouTube filter
  - audience join policy
  - guest request mode
  - unknown backing policy
  - audience YouTube-only search
  - audience theme preset
  - audience app title
  - primary / secondary / accent colors
- Screens + Overlays defaults:
  - scoring toggle
  - fame level toggle
  - TV chat toggle
  - marquee toggle
  - chat TV mode
  - marquee show mode
  - marquee duration
  - marquee interval
  - marquee item add / edit / remove
- Automation Defaults + Policy:
  - auto DJ
  - auto BG music
  - auto playback
  - auto end
  - auto bonus
  - pop trivia
  - auto-DJ delay
  - auto bonus points
  - ready check duration
  - ready check reward
  - auto party enable
  - auto party moment order
  - auto party ready-check duration
  - auto party volley duration

### Automation

- Live-state summary cards for auto DJ, auto BG, auto end, auto bonus.
- Auto-DJ toggle.
- Auto BG toggle.
- Auto end toggle.
- Auto bonus toggle.
- Auto-DJ delay.
- Auto bonus points.
- Auto Party toggle.
- Auto Party configuration.

### Chat

- Embedded live Host Chat console.
- Embedded Chat Settings panel.

### Approvals

- chat audience mode
- TV chat toggle
- TV chat fullscreen / auto
- jump to full chat controls
- moderation inbox snapshot
- open main inbox

### Tips + Boosts

- event credits config panel
- boost offer label
- boost offer dollar amount
- boost offer points
- reward scope
- badge award toggle
- remove offer
- add offer

### Screens + Playback

- YouTube playlist indexing and queue-all
- QA playlist shortcut controls
- Apple Music connect / disconnect
- Apple Music playlist play / pause / resume
- Auto-DJ fallback playlist ID + title
- manual "make song searchable" YouTube entry form
- room upload picker
- upload + queue
- save to TV library
- use in run of show
- upload only
- save offline backup
- recent room media actions
- full room library filter and actions
- room library curator modal

### Overlays

- marquee show mode
- marquee duration
- marquee interval
- marquee item add / edit / remove
- save marquee

### Live Controls

- open launchpad
- open stage controls
- open Public TV

### Billing

- plan / status / renewal / workspace view
- AI access guide
- AI demo bypass
- access refresh
- usage period
- invoice customer
- invoice draft generation
- invoice export / snapshot
- invoice status / notes
- invoice history refresh
- subscription checkout / billing portal

### Live Effects

- read-only live status cards
- lobby playground pause
- lobby playground visual-only rewards
- lobby playground strict cooldown
- open live deck
- emergency reset scene
- silence all SFX

### Diagnostics

- Host QA debug panel
- smoke tools
- library curator diagnostics
- YouTube track-health loading and refresh

## Duplicate / Overlap Audit

| Control cluster | In Admin | Also appears elsewhere | Audit |
| --- | --- | --- | --- |
| Queue rules and request policy | Night Setup | Top `Room` quick menu | Duplicated with nearly the same semantics. Top chrome should stay live; Admin should keep only defaults and policy. |
| Automation booleans | Night Setup and Automation | Top `Automation` quick menu | Triple-surfaced. Current labels say "default" in Admin, but the interaction model still feels like live toggles. |
| Ready Check | Night Setup timing fields | Top `Room` and `Overlays` menus | Config and runtime are mixed correctly in theory, but visually too similar. |
| Runtime shell mode | Admin header | Top `Room` menu | Same setting shown in two places. Keep one canonical home in Admin; expose top-chrome entry as a shortcut only if needed. |
| Audience preview / TV preview | Night Setup | Top `Overlays` quick menu | These are ephemeral host viewport tools, not admin settings. |
| Chat-on-TV and fullscreen chat | Night Setup, Approvals, Chat Settings | Top `Overlays` quick menu | Too many entry points for one live overlay state. |
| Marquee on/off and marquee data | Night Setup and Overlays | Top `Overlays` quick menu | Three surfaces: global default, manager, and live toggle. Needs a stronger split. |
| Pop Trivia | Night Setup and Automation | Top `Automation` and `Overlays` | One boolean is treated as both room default and live show switch. |
| Media library and scene use | Screens + Playback | Queue workspace / top `Scenes` menu | Admin still contains live launch actions such as queue, TV library launch, and run-of-show placement. |
| Apple Music connection | Night Setup shortcut and Screens + Playback | top status light signals connection | Not harmful, but "Connect Apple Music" belongs in media setup, not Run Tonight. |
| Chat operations | Chat tab | Queue inbox / audience surfaces | Admin still embeds a live message console, which makes Admin feel like an operating surface instead of a settings surface. |
| Moderation actions | Approvals | Queue inbox | Admin already says the global inbox is canonical, but still duplicates chat policy and routing controls. |
| Live Effects recovery | Live Effects | Top live deck | This page is meant to be handoff-only, but still contains active live toggles. |

## Non-Negotiable Control Preservation

These should not disappear during cleanup. They need a clear home even if their current location changes.

### Room Policy

- request mode
- queue limit mode and count
- queue rotation
- first-time boost
- host approval / bouncer mode
- audience join policy
- unknown backing policy
- embeddable-only YouTube filter
- audience YouTube-only search

### Automation Defaults

- auto DJ
- auto BG music
- auto stage playback
- auto end
- auto bonus
- auto lyrics on queue
- pop trivia default
- auto-DJ delay
- auto bonus points
- ready-check duration
- ready-check reward
- auto party enable
- auto party order
- auto party timing

### TV / Audience Defaults

- scoring
- fame-level visibility
- chat on TV default
- chat TV mode default
- marquee enabled default
- marquee timing and items
- audience shell mode
- audience emoji/account-access policy
- audience theme / title / colors

### Media / Library Management

- Apple Music connect state and playlist fallback
- YouTube playlist indexing
- searchable-track curation
- room uploads
- TV library save path
- run-of-show media handoff
- offline backup path

### Runtime-Only Controls That Must Stay Reachable

- start ready check
- open Public TV
- audience preview
- TV preview
- scene launch / queue / end
- SFX mute / volume / trigger
- vibe mode triggers
- run-of-show automation pause / resume
- emergency reset scene
- silence all SFX
- open inbox

## CPO Lens

### Product Principles

- The host should never have to wonder whether a control changes the room `right now` or changes the room `by default next time`.
- Controls that support the same operator intent should be grouped by workflow, not by implementation domain.
- Live-night confidence matters more than exhaustive exposure. The top surfaces should feel unmistakably operational.

### CPO Recommendations

- Group `Room Policy` together as one coherent settings group.
  - request mode, queue rules, approval rules, guest search rules, and audience join rules belong together.
- Group `Automation Defaults` together as one settings group.
  - auto DJ, auto BG, auto end, auto bonus, auto lyrics, pop trivia default, auto party policy.
- Group `TV + Audience Defaults` together.
  - scoring, fame level, chat-on-TV defaults, marquee defaults, audience shell variant, audience branding.
- Group `Media Library Management` separately from `Media Execution`.
  - management belongs in Admin; launching scenes and controlling live media belongs in the deck.
- Group `Recovery / Emergency` separately from normal configuration.
  - emergency reset, silence all SFX, and similar controls should not be mixed into general setup forms.

### CPO Risk Calls

- `Chat` is currently split between policy, console, and TV behavior. That is operator-confusing.
- `Approvals` is too narrow as a label for what is partly moderation policy and partly inbox routing.
- `Screens + Playback` is overstuffed with setup, ingestion, and live execution shortcuts.

## CTO Lens

### System Principles

- Every persisted room field should have one canonical settings surface.
- Every live runtime control should have one canonical execution surface.
- Duplicate controls are only acceptable if one is a shortcut into the canonical surface, not a second owner of the same state.

### CTO Recommendations

- Keep Admin as the canonical writer for persisted defaults.
  - room policy
  - automation defaults
  - audience defaults
  - media-library configuration
  - billing and diagnostics
- Keep top chrome as the canonical writer for live runtime toggles.
  - room quick settings
  - automation quick toggles
  - overlays and previews
  - scenes, SFX, vibe
- Keep queue / show / inbox workspaces as the canonical owners of contextual runtime workflows.
  - queue actions
  - media library modal
  - run-of-show execution
  - moderation review
- Convert duplicate Admin buttons that directly mutate runtime state into one of two patterns:
  - a saved default control
  - a shortcut that routes to the canonical runtime surface

### CTO Risk Calls

- `Pop Trivia`, `Marquee`, and `Chat TV` are currently expressed as both defaults and live toggles without a strict distinction in the UI.
- `Ready Check` is spread across timing configuration and live trigger surfaces; this is acceptable only if the trigger and the defaults are clearly separated.
- `Runtime shell mode` exists in both Admin and top chrome. That should resolve to one owner and one optional shortcut.

## Control-Object Recommendations

- Persistent booleans should use switches or compact toggle rows.
  - Examples: `autoDj`, `autoBgMusic`, `autoEndOnTrackFinish`, `popTriviaEnabled`, `marqueeEnabled`, `chatShowOnTv`, `queueFirstTimeBoost`.
- Small mutually exclusive modes should use segmented controls or radio cards.
  - Examples: audience shell mode, runtime shell mode, queue rotation, request mode, audience join policy, chat TV mode, auto-party order preset.
- Numeric tuning should use labeled numeric inputs or select menus with units.
  - Examples: ready-check timing, auto-DJ delay, applause timing, marquee timing, BG fade timing.
- One-shot runtime actions should remain buttons and leave Admin when possible.
  - Examples: open Public TV, copy join link, start ready check, preview recap, declare winners, upload + queue, open queue workspace, open launchpad.
- Destructive actions should stay isolated in a danger zone.
  - Examples: clear room data, close room + generate recap, delete upload, remove crate.

## Streamlining Plan

### Phase 1: Define canonical homes

- Keep `Admin` for saved defaults and policies only.
- Keep `Top chrome` for live runtime toggles only.
- Keep `Queue / Stage / Show / Inbox` for contextual execution actions only.
- Keep a dedicated `Recovery` cluster for emergency actions instead of hiding them inside unrelated settings pages.

### Phase 2: Remove duplicate live controls from Admin

- Remove preview visibility toggles from `Night Setup`.
- Remove live chat console from `Chat`; keep policy and routing only.
- Remove live media launch actions from `Screens + Playback`; keep ingestion, indexing, and library management only.
- Reduce `Approvals` to moderation policy plus inbox routing.
- Keep emergency recovery buttons accessible, but relocate them out of ordinary settings groups.

### Phase 3: Normalize control objects

- Convert large on/off buttons in Admin into switch rows.
- Convert small mode sets into segmented controls.
- Separate default-state labels from live-state labels consistently.
  - Example: `Default Auto-DJ` in Admin vs `Auto DJ` in top chrome.
- Treat shortcuts as navigation objects, not duplicated state owners.

### Phase 4: Collapse weak sections

- Fold `Overlays` into `Screens + Playback` as one `Screens + Overlays` settings page.
- Fold `Live Controls` into a handoff card instead of a full Admin section.
- Keep `Live Effects` as a true read-only handoff + emergency recovery page, or move its remaining active controls into the live deck.
- Recast `Chat` as policy-only unless there is a strong product reason to keep a live console in Admin.

### Phase 5: Tighten navigation language

- Rename `Approvals` to `Moderation Policy`.
- Rename `Chat` to `Chat Policy + Console` only if the console remains; otherwise keep it policy-only.
- Rename `Screens + Playback` to `Media Library + Playback Defaults` if uploads stay there.

## Proposed Grouping Model

### Admin Groups

- `Room Policy`
  - queue rules
  - guest request rules
  - audience join and approval rules
- `Automation Defaults`
  - all persistent between-song automation behavior
- `TV + Audience Defaults`
  - scoring, chat TV defaults, marquee defaults, shell mode, branding
- `Media Library Management`
  - Apple Music setup, indexing, uploads, curation, storage
- `Support Economy`
  - tips, boosts, event credits
- `Billing + Access`
  - subscriptions, AI access, invoices
- `Diagnostics + Recovery`
  - diagnostics, smoke tests, emergency fallbacks only

### Runtime Groups

- `Top Chrome`
  - room quick changes
  - automation quick changes
  - overlays / previews
  - scenes / SFX / vibe
- `Queue / Stage / Show`
  - execution workflows tied to context
- `Inbox`
  - moderation and communication review
