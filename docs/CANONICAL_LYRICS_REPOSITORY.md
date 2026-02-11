# Canonical Lyrics Repository

This project now supports a central song-lyrics catalog so hosts can reuse previously resolved lyrics/backing metadata instead of calling third-party APIs every queue action.

## Collections

- `songs/{songId}`: canonical song identity and metadata.
- `tracks/{trackId}`: reusable backing tracks linked by `songId`.
- `song_lyrics/{songId}`: canonical lyrics payload (plain + timed lines) for each song.

## Canonical Keys

- `songId` uses `buildSongKey(title, artist)` and is the source-of-truth key.
- `trackId` remains deterministic for Apple/YouTube (`{songId}__apple__{appleMusicId}`, `{songId}__yt__{youtubeId}`).

## `song_lyrics` Document Shape

```json
{
  "songId": "dont stop believin__journey",
  "title": "Don't Stop Believin'",
  "artist": "Journey",
  "lyrics": "Just a small town girl...\n",
  "lyricsTimed": [
    { "text": "Just a small town girl", "startMs": 1200, "endMs": 4200 }
  ],
  "hasTimedLyrics": true,
  "lineCount": 184,
  "lyricsSource": "apple",
  "appleMusicId": "203709340",
  "language": "en",
  "verifiedBy": "apple_music",
  "createdAt": "serverTimestamp",
  "updatedAt": "serverTimestamp"
}
```

## New Callable Endpoints

- `resolveSongCatalog`: returns canonical `song`, best `track`, and canonical `lyrics` for a song key.
- `upsertSongLyrics`: writes/updates canonical lyrics for a song (used by host/manual or ingestion flows).

## Ingestion Sources

- Host queue flow now checks `resolveSongCatalog` first.
- Apple lyrics fetch writes back into canonical `song_lyrics`.
- `autoAppleLyrics` trigger now seeds canonical lyrics from queue docs when lyrics already exist and after successful Apple fetch.

## Security

- `song_lyrics` is read-only from clients (public read, client writes denied).
- Writes occur through Cloud Functions/Admin SDK.

