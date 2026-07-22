# Apple Music Lyrics Access Request — Owner Guide

Date: 2026-07-19

## Executive Answer

It is reasonable to ask Apple for access, but Apple does not currently document a generally available Apple Music API lyrics-text or synchronized-TTML relationship. The public song model exposes `hasLyrics`; that flag is not permission to retrieve, cache, or publicly display lyric text. BeauRocks currently calls `/v1/catalog/{storefront}/songs/{songId}/lyrics`, so written Apple confirmation is a launch gate, even if the endpoint works for some accounts or partners.

The first request should be a narrowly scoped Apple Developer code-level support request. Ask Apple to confirm whether this endpoint and use case are supported and, if access is restricted, to route the request to the appropriate Apple Music partner or entitlement team. Do not describe the endpoint as public or approved.

## What To Gather First

Use the Apple Developer account that owns the BeauRocks MusicKit identifiers. Gather these values from Certificates, Identifiers & Profiles without placing secrets in this document:

1. Apple Developer Team ID.
2. Media ID / MusicKit identifier used by the web integration.
3. MusicKit key ID. Never attach the `.p8` private key.
4. Production origins: `https://host.beaurocks.app`, `https://app.beaurocks.app`, and `https://tv.beaurocks.app`.
5. A catalog song ID and storefront that reproduce the issue.
6. The complete sanitized `40012` response after a fresh Music User Token was supplied. Remove the developer token and Music User Token.
7. A short screen recording or screenshots showing host authorization, Apple sing-along playback, and the intended synchronized lyric rendering on singer and TV surfaces.
8. The proposed storage policy. Ask Apple what may be cached, for how long, and whether derived timing/provenance may be retained.

## Submit The Request

1. Sign in at `https://developer.apple.com/support/technical/` with the Apple Developer Program account that owns the identifiers.
2. Start one code-level support request. Keep this request limited to MusicKit lyric access and authorization.
3. Use the subject and body below.
4. Attach only sanitized logs and UI evidence. Never send the MusicKit private key, developer token, Music User Token, Apple account credentials, or unredacted user data.
5. Save the case number and Apple acknowledgement email.
6. If Apple says code-level support cannot approve the access, reply once asking which published request form or Apple Music business/partner contact owns the evaluation. Do not probe undocumented endpoints further in production.
7. Record Apple's answer verbatim in a dated compliance note and turn any approval conditions into provider retention, attribution, and display controls before deployment.

## Request Copy

Subject:

`MusicKit on the Web — request for supported synchronized lyrics access and use-case confirmation`

Body:

> BeauRocks Karaoke is a browser-based live-event karaoke companion with separate authenticated Host, Audience/Singer, and public TV surfaces. An Apple Music subscriber explicitly authorizes MusicKit on the Host device and selects a catalog song for full-track playback on that device. We would like to display the corresponding synchronized lyrics to the singer and venue TV while that authorized track is playing.
>
> The public Apple Music API song resource exposes `hasLyrics`, but we have not found public documentation for retrieving lyric text or synchronized TTML. A request to `/v1/catalog/{storefront}/songs/{songId}/lyrics` returns Apple error code `40012` even after a fresh Music User Token is included.
>
> Please confirm:
>
> 1. Is this lyrics endpoint supported for third-party MusicKit web applications?
> 2. Is there a restricted capability, entitlement, licensing program, or partner review that BeauRocks may apply for?
> 3. If approved, may synchronized lyrics be rendered on the authorized Host device and companion singer/TV browser surfaces during the same live performance?
> 4. What attribution, storefront, subscription, caching, retention, deletion, and redistribution restrictions apply to lyric text, TTML, and derived timecodes?
> 5. Does permitted use include private and commercial public karaoke events where Apple Music playback remains on the authorized subscriber's MusicKit player and BeauRocks does not receive, transcode, or redistribute the audio stream?
>
> We can provide our Team ID, Media ID, key ID, production domains, sanitized request/response logs, data-flow diagram, storage policy, and UI recording privately. If code-level support is not the team that evaluates this access, please route us to the appropriate Apple Music partner or entitlement contact or identify the correct request process.

## Approval Standard

Do not call Apple timed lyrics production-ready based only on a successful response, forum reports, or access granted to another developer. The approval needs to cover all of these BeauRocks behaviors explicitly:

- lyric text and synchronized timing retrieval;
- Host, singer-phone, and public-TV display during the same performance;
- private-event and commercial venue use;
- any caching and canonical reuse;
- allowed retention and deletion;
- required Apple attribution and subscription checks;
- regional/storefront restrictions;
- whether derived timecodes may be stored separately from Apple lyric text.

If Apple declines or does not provide a supported path, keep Apple Music as a playback source and use a separately licensed lyrics provider through the existing timed-provider adapter. The shared rendering and synchronization engine does not depend on Apple as the lyric source.

## Official References

- MusicKit overview: `https://developer.apple.com/musickit/`
- Enable MusicKit: `https://developer.apple.com/help/account/services/musickit`
- MusicKit user authorization: `https://developer.apple.com/documentation/applemusicapi/user-authentication-for-musickit`
- Apple song relationships: `https://developer.apple.com/documentation/applemusicapi/songs/relationships-data.dictionary`
- Apple code-level support: `https://developer.apple.com/support/technical/`
