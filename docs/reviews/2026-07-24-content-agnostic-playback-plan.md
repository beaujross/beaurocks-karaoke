# Content-Agnostic Song and Playback Plan

## Product contract

BeauRocks owns the room, queue, performance, and song history. A connected provider owns or supplies a particular way to play that song.

Public copy should say **song** and **version**. `canonicalSongId` remains an internal implementation term.

## Identity layers

1. **Song** — the recognizable song requested by a singer.
2. **Playback option** — a YouTube karaoke version, Apple Music recording, future KaraFun rendition, room upload, or other playable source.
3. **Performance** — the singer or group using a playback option in a room.
4. **Lyrics asset** — rights-cleared lyric text for the song.
5. **Timing map** — timing aligned to the exact playback option.

A playback option may have no song match. Custom and original uploads remain playable with a nullable `songId`; unmatched room media does not create a public song page or affect public song charts.

## Source presentation

The song remains visually primary. Show the playback source only when it changes a host decision:

- A guest selected a specific version.
- A song-only request needs the host to choose a version.
- Authentication, embed support, rights, or another capability needs attention.
- The item is unmatched custom room media.

Routine ready queue items remain source-neutral.

Provider treatments use a small icon, label, and restrained highlight:

- YouTube — red flowing into BeauRocks fuchsia.
- Apple Music — neutral/white flowing into BeauRocks fuchsia.
- Room Upload — BeauRocks cyan flowing into violet.
- KaraFun — violet with an amber accent until partner brand guidance is available.
- Spotify — green flowing into BeauRocks cyan, reserved for a future authorized integration.

Provider appearance must never imply that a metadata match is the selected playback source. An Apple Music song identity can still be a **song-only request** awaiting a karaoke version.

## Compatibility fields

New writers should eventually persist:

```js
{
  songId: null, // allowed for unmatched media
  songIdentityStatus: "matched" | "provisional" | "unmatched" | "original",
  playbackSelectionMode: "song_only" | "specific_version" | "custom_media",
  selectedPlaybackProvider: "youtube" | "apple_music" | "karafun" | "local" | null,
  mediaAssetId: null
}
```

Readers must continue to infer these values from legacy `trackSource`, `mediaUrl`, `resolutionLayer`, `mediaResolutionStatus`, and `submittedVia` fields.

## Delivery slices

1. **Shared vocabulary and contextual provider UI**
   - Central provider style/capability registry.
   - “Choose Version” treatment for song-only review.
   - Provider chip for a specific guest-selected version.
   - No provider decoration on routine ready songs.

2. **Authoritative write contract**
   - Add the compatibility fields to audience and host queue writes.
   - Make `songId` nullable for unmatched custom media.
   - Stop local uploads from automatically creating a public song.

3. **Provider capability preflight**
   - Declare playback, vocals, timed lyrics, scoring, authentication, offline, territory, and room-context capabilities.
   - Explain blockers before the room opens.

4. **Dedicated recipes**
   - Karaoke, Sing-Along, and Lip Sync compile into provider requirements and room controls.
   - Sing-Along requires original playback and a legally available lyric surface.
   - Lip Sync requires original playback but treats lyrics as optional.

5. **Autopilot contract**
   - Present outcome controls while compiling to the existing queue, ready-check, crowd-moment, dead-air, and Run of Show primitives.

6. **Lyrics rights and timing**
   - Separate lyric provenance from version-specific timing.
   - Integrate an authorized lyrics or karaoke partner.
   - Keep undocumented Apple lyric retrieval out of the production contract.

7. **Charts and discovery**
   - Aggregate provider versions under a matched song.
   - Preserve room-level results for unmatched media without publishing misleading song rankings.
