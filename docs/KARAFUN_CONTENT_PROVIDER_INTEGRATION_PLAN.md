# KaraFun content-provider integration plan

Date: 2026-07-24

## Product boundary

BeauRocks remains the karaoke-night operating system: room setup, host controls,
rotation, audience participation, games, scoring, charts, discovery, and recap.
KaraFun is an optional content and playback provider. Connecting it must not make
the room, queue, or public listing a KaraFun-owned object.

The UI should say **KaraFun** only when the provider matters. Everywhere else it
should use the existing public language: song, backing, room, karaoke night, and
host.

## Three materially different integrations

### 1. Companion handoff

BeauRocks runs the night while the host runs KaraFun separately. BeauRocks stores
only a provider reference and launch state. Playback confirmation is manual or
observed through a partner-approved interface.

This is the smallest product experiment, but it cannot promise queue or playback
sync that KaraFun has not exposed contractually.

### 2. KaraFun Business session management

KaraFun Business documents bearer-token access for listing, creating, updating,
and deleting scheduled sessions, plus device assignment. This can synchronize a
BeauRocks room reservation with a KaraFun Business room/device.

This is a server-to-server operational integration. It is not the same as native
consumer account login, catalog search, or embedded playback.

### 3. KaraFun OEM/API partnership

KaraFun publicly describes an OEM API with native KaraFun login, subscription and
entitlement access, catalog search, metadata, syllable-synced lyrics, playback
technology, and licensing/royalty handling. This is the integration that can
deliver the “authenticate KaraFun, then let BeauRocks layer its experience over
the content” product.

It requires a commercial partnership, non-public API documentation, credentials,
licensing scope, entitlement rules, simulator access, and launch approval. It
must not be reverse-engineered from KaraFun Remote.

## Target architecture

### Provider-neutral domain

Keep canonical song identity independent from a backing provider.

```text
SongIntent
  canonicalSongId
  title
  artist

BackingReference
  provider
  providerTrackId
  providerVersionId
  capabilitySnapshot
  connectedAccountId

PlaybackAssignment
  roomCode
  queueSongId
  backingReference
  state
  lastProviderEventId
```

Add provider capabilities instead of provider-specific conditionals:

```text
search_catalog
resolve_track
embedded_playback
external_handoff
account_entitlements
offline_catalog
session_management
playback_events
key_tempo_control
timed_lyrics
```

### Trust and secrets

- KaraFun Business bearer tokens stay server-side in Secret Manager or an
  encrypted provider credential vault. They never enter Firestore documents,
  browser storage, analytics, logs, or client bundles.
- Native KaraFun login uses the partner-approved OAuth/OIDC flow and server-side
  token exchange. BeauRocks stores provider account IDs and safe entitlement
  snapshots, not passwords.
- Every provider mutation is host-authorized, room-scoped, idempotent, rate
  limited, and written to the existing host audit trail.
- Raw karaoke media, lyrics, and provider-restricted metadata are not copied into
  BeauRocks storage unless the partner agreement explicitly permits it.

### Suggested repo boundaries

```text
src/lib/mediaProviders/
  providerCapabilities.js
  backingReference.js
  karaFunPresentation.js

functions/lib/mediaProviders/
  providerRegistry.js
  karaFunBusinessClient.js
  karaFunOemClient.js
  providerCredentialVault.js
  providerIdempotency.js
```

Callable surface:

- `connectKaraFunAccount`
- `disconnectKaraFunAccount`
- `getKaraFunConnectionStatus`
- `searchKaraFunCatalog`
- `resolveKaraFunBacking`
- `syncKaraFunBusinessSession`
- `prepareKaraFunPlayback`
- `getKaraFunPlaybackState`

The public callable names can remain provider-specific while the room and queue
documents use provider-neutral backing references.

## Host experience

1. Room setup shows **Backing sources**.
2. The host chooses Local Library, YouTube, Apple Music, KaraFun, or a permitted
   combination.
3. Choosing KaraFun opens **Connect KaraFun** and explains whether this room uses
   companion handoff, Business session sync, or integrated playback.
4. Search results show capability badges such as `Ready in KaraFun`,
   `Opens KaraFun`, or `Needs connection`.
5. The queue stays in BeauRocks. A provider adapter prepares the selected backing
   at stage time.
6. Loss of KaraFun access never destroys the performance entry. The host can
   choose another backing without rebuilding the queue.

## Offline behavior

KaraFun Business documents an offline catalog prepared inside its own app. Its
Remote Control and other interactive features require internet access. Therefore:

- KaraFun offline files remain controlled by the KaraFun device/app.
- BeauRocks LAN mode may continue to operate its local room state independently.
- Provider sync becomes `offline_provider_managed`; BeauRocks must not claim live
  queue or playback authority while disconnected unless the OEM contract exposes
  a supported local interface.
- Reconnection uses idempotent reconciliation, never blind last-write-wins.

## Delivery slices

1. **Partnership and contract**
   - Submit the KaraFun OEM use case.
   - Obtain API/OpenAPI docs, sandbox, auth requirements, rate limits, offline
     rights, commercial terms, affiliation terms, and brand rules.
   - Decide whether phase one is Business session management, OEM playback, or
     both.

2. **Provider-neutral foundation**
   - Add capability and backing-reference schemas.
   - Migrate current YouTube, Apple, and local presentation onto the same
     capability vocabulary without changing playback behavior.
   - Add provider-safe telemetry and cost controls.

3. **Secure connection**
   - Add provider credential vault and callable-only token exchange.
   - Add host account connection UI, disconnect, expiry, and entitlement states.

4. **Catalog and identity**
   - Search KaraFun through the server adapter.
   - Map KaraFun track/version IDs to the existing canonical song identity.
   - Keep provider results out of public charts except as backing provenance.

5. **Session and playback**
   - Sync Business sessions/devices where applicable.
   - Add prepare/play/pause/end state handling only for officially supported
     endpoints.
   - Add explicit fallback to another backing provider.

6. **Offline and recovery**
   - Test prepared KaraFun offline catalog plus BeauRocks LAN room operation.
   - Add reconnect reconciliation, stale entitlement handling, and host-visible
     degraded states.

7. **Commercial launch**
   - Meter provider operations separately from BeauRocks reads/writes.
   - Apply plan/entitlement gates without marking up KaraFun charges unless the
     agreement allows it.
   - Complete joint QA, licensing review, privacy review, and production approval.

## Go/no-go evidence

- Written permission for the intended account, content, playback, and offline
  behavior.
- Sandbox proves account connection, entitlement checks, search, playback or
  handoff, session sync, expiry, disconnect, and fallback.
- No provider token or restricted content appears in Firestore, logs, analytics,
  or client bundles.
- A room can switch away from KaraFun without losing queue order, singer identity,
  scoring, or public chart continuity.
- Cost and rate-limit envelopes are measurable per host and per room.
