# Crowd Selfie Profile Spec

## Goal

Turn the strongest audience selfie moments into a reusable, opt-in identity layer instead of treating every photo as a one-off reaction.

This is **not** the same thing as:

- `selfie_challenge` with prompts and voting
- `selfie_cam` as a transient room mode
- the old local `profilePictureUrl` flow in `ProfileEditor`

This feature should let a guest:

1. agree to party rules and explicit photo-display consent
2. optionally take a selfie
3. let the host approve that selfie for room use
4. promote that approved selfie into the guest's default BeauRocks crowd photo
5. re-take and re-submit later
6. show that approved photo in room moments and recaps

## Product Position

Treat this as a **Crowd Selfie Profile**, not a game mode.

It should feel like:

- "add your crowd photo for tonight"
- "your approved selfie can show up in hype moments and recap"

It should not feel like:

- "join selfie challenge"
- "enter a photo contest"
- "this is your permanent legal profile image forever"

## Important Privacy Constraint

Do **not** use generic Terms acceptance as the only consent for this feature.

Reason:

- agreeing to party rules is not the same thing as agreeing to image display and recap reuse
- hosts need a defensible, explicit opt-in for photos that may appear on Public TV and recaps

Recommended model:

1. Terms / party rules acceptance remains required for room participation.
2. Crowd selfie is an **optional second consent**.

Suggested consent copy:

- `Use my selfie in this room's live moments and recap`

Optional supporting copy:

- `You can change or remove it later.`

## Recommended UX

### Entry Point

After Terms acceptance in the audience app, show a lightweight optional card:

- headline: `Add your crowd selfie`
- support: `Show up in crowd moments, shout-outs, and tonight's recap.`
- actions:
  - `Take Selfie`
  - `Maybe Later`

This should not block room entry.

### Submission Flow

1. Guest accepts photo-display consent.
2. Guest captures selfie.
3. Selfie uploads into a moderation bucket.
4. Host can approve / reject from host panel.
5. Once approved:
   - room-level selfie becomes eligible for Public TV fun moments
   - guest can promote it as their default BeauRocks crowd photo

### Retake Flow

Give the guest a persistent profile action:

- `Retake Crowd Selfie`
- `Remove Crowd Selfie`

If a new selfie is submitted:

- it replaces the current pending one
- the previous approved selfie remains active until the new one is approved

That avoids blanking the guest's identity while waiting on moderation.

## Recommended Data Model

### Room-Level Submission

Add a new room-scoped collection for opt-in crowd selfies.

Suggested collection:

- `artifacts/{APP_ID}/public/data/crowd_selfie_submissions`

Suggested fields:

- `roomCode`
- `uid`
- `userName`
- `avatar`
- `storagePath`
- `url`
- `timestamp`
- `status`
  - `pending`
  - `approved`
  - `rejected`
- `approvedAt`
- `approvedBy`
- `consentAccepted`
- `consentAcceptedAt`
- `promoteToDefault`
- `supersedesSubmissionId`

### User-Level Default Crowd Selfie

Store the promoted default crowd selfie on the top-level user record.

Suggested fields on `users/{uid}`:

- `crowdSelfieUrl`
- `crowdSelfieStoragePath`
- `crowdSelfieApprovedAt`
- `crowdSelfieSourceRoomCode`
- `crowdSelfieConsentVersion`
- `crowdSelfieStatus`

Do **not** rely on the old inline `profile.profilePictureUrl` path. That flow is legacy, base64-oriented, and not aligned with the current storage-backed media pipeline.

### Room Projection

Project the approved crowd selfie into `room_users` for live room use.

Suggested projected field:

- `crowdSelfieUrl`

This keeps live TV / host / audience surfaces from repeatedly dereferencing full user profile docs.

## Approval Model

Recommended first version:

- room selfies require host approval by default

Reason:

- this will be visible on Public TV
- it avoids abuse
- it fits the current moderation posture for image moments

Possible future setting:

- `Auto-approve crowd selfies from signed-in users`

But I would not default to that yet.

## How It Differs From Existing Selfie Features

### `selfie_cam`

Keep `selfie_cam` as a temporary live capture mode.

New behavior:

- if the guest already has an approved default crowd selfie, `selfie_cam` can use it as a fallback / featured image source
- guests can still snap fresh photos during `selfie_cam`

### `selfie_challenge`

Keep `selfie_challenge` as a game with prompt + wall + voting.

Do not mix these concepts:

- challenge selfie = temporary game submission
- crowd selfie profile = reusable approved identity image

Optional bridge:

- after a guest submits a strong challenge selfie, let the host or guest promote it to crowd selfie profile

## Public TV Usage

Approved crowd selfies should be available for:

- crowd-cam drops
- performer intro / hype rails
- applause / celebration moments
- hall-of-fame style shout-outs
- recap mosaics

Recommended rule:

- Public TV fun moments should prefer approved crowd selfie profiles first
- then fall back to fresh live `photoOverlay` drops

This gives the room a stronger identity layer even when guests are not actively in selfie mode.

## Host UX

Add a new moderation queue section:

- `Crowd Selfies`

Each item should offer:

- `Approve`
- `Reject`
- `Approve + Make Default`

If already approved:

- `Use as Default`
- `Remove Default`

This should live with other image moderation, not inside run of show.

## Audience UX

Add a small identity card in the audience profile/account area:

- `Crowd Selfie`
- state:
  - `none`
  - `pending review`
  - `approved`
  - `rejected`
- actions:
  - `Take Selfie`
  - `Retake`
  - `Remove`

If approved, explain:

- `This photo can appear in crowd moments and tonight's recap.`

## Recap Integration

This is one of the strongest reasons to do the feature.

Recap should use approved crowd selfies in two ways:

1. **Identity-enhanced recap**
   - top fans
   - loudest crowd members
   - challenge winners
   - VIP / spotlight guests

2. **Photo collage**
   - mix approved crowd selfie profiles with live room photo moments

Recommended recap payload additions:

- `crowdSelfies`
  - recent approved room selfies
- `featuredCrowdSelfies`
  - chosen for recap hero moments

Recommended ranking inputs:

- approved for this room
- default crowd selfie exists
- audience engagement level
- spotlight / top-fan / participation signals

## Migration / Implementation Notes

### Existing Fit Points

Current repo pieces that align well:

- audience Terms acceptance exists in `SingerApp`
- room photo uploads already use Storage-backed paths
- Public TV already supports `photoOverlay`
- recaps already pull recent `photo` reactions
- top-level user profile shape already exists

### Existing Gaps

- old profile picture flow is legacy and not storage-backed
- there is no explicit room-photo identity consent layer
- there is no dedicated `crowd selfie` moderation path
- recap does not yet distinguish reusable approved selfies from one-off reactions

## Recommended Rollout

### Phase 1

- add optional post-Terms crowd-selfie prompt
- store pending room selfie submission
- host approval UI
- room-level approved selfie usage

### Phase 2

- promote approved selfie to user default crowd selfie
- project into `room_users`
- use in Public TV crowd moments

### Phase 3

- recap collage / featured use
- retake / replace flow
- optional reuse across rooms

## Recommended Naming

Use one of:

- `Crowd Selfie`
- `Crowd Photo`
- `Big Screen Selfie`

Avoid:

- `profile picture`
- `selfie challenge`
- `hall of fame selfie`

Those names either feel too permanent or too game-specific.

## Final Recommendation

Build this as:

- an **optional identity layer**
- with **separate explicit photo-display consent**
- **host approval**
- **promotion to default crowd selfie**
- and **recap reuse**

That gives you a much stronger audience-photo system without muddying `selfie_cam` and `selfie_challenge`.
