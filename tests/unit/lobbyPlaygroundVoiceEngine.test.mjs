import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { test } from 'vitest';
import {
  applyLobbyVoiceFrame,
  createLobbyVolleyState,
  deriveLobbyVoiceTarget,
  LOBBY_PLAYGROUND_ENGINE_CONSTANTS,
} from '../../src/apps/TV/lobbyPlaygroundEngine.js';

const publicTvSource = readFileSync('src/apps/TV/PublicTV.jsx', 'utf8');

test('applyLobbyVoiceFrame inflates the Volley orb from forgiving crowd volume', () => {
  const now = 10000;
  const next = applyLobbyVoiceFrame(createLobbyVolleyState(), {
    active: true,
    pitch: 98,
    note: 'G2',
    confidence: 0.84,
    volumeNormalized: 0.48,
    stableNote: 'G2',
    stability: 0.72,
    isSinging: true,
    capturedAtMs: now,
  }, now);

  assert.equal(next.streakCount, 1);
  assert.ok(next.energy > 4, `expected crowd air to add meaningful energy, got ${next.energy}`);
  assert.equal(next.lastInteractionType, 'voice_lift');
  assert.equal(next.voice.target.phase, 'inflate');
  assert.match(next.voice.promptHeadline, /AIR IS FILLING|INFLATE/);
  assert.ok(next.participants.room_voice, 'room voice should count as the default crowd participant');
});

test('deriveLobbyVoiceTarget asks for higher notes as altitude pressure rises', () => {
  const lowTarget = deriveLobbyVoiceTarget({ ...createLobbyVolleyState(), peakAltitudeFt: 0 }, 20000);
  const highTarget = deriveLobbyVoiceTarget({ ...createLobbyVolleyState(), peakAltitudeFt: 150 }, 20000);

  assert.equal(lowTarget.phase, 'inflate');
  assert.equal(highTarget.phase, 'orbit');
  assert.ok(highTarget.targetMidi > lowTarget.targetMidi);
  assert.equal(LOBBY_PLAYGROUND_ENGINE_CONSTANTS.VOICE_TARGETS.length, 4);
  assert.equal(lowTarget.commandLabel, 'BLOW AIR');
  assert.equal(highTarget.commandLabel, 'HOLD ORBIT');
  assert.match(highTarget.commandHelper, /High voices/);
});

test('applyLobbyVoiceFrame ignores stale telemetry and marks the voice feed inactive', () => {
  const now = 30000;
  const active = {
    ...createLobbyVolleyState(),
    streakCount: 2,
    energy: 24,
    lastInteractionAtMs: now - 1000,
  };
  const next = applyLobbyVoiceFrame(active, {
    active: true,
    pitch: 98,
    confidence: 0.9,
    volumeNormalized: 0.6,
    stability: 0.8,
    capturedAtMs: now - 3000,
  }, now);

  assert.equal(next.streakCount, 2);
  assert.equal(next.voice.active, false);
  assert.equal(next.voice.fresh, false);
  assert.ok(next.energy < active.energy, 'stale frames should decay instead of lift');
});
test('deriveLobbyVoiceTarget raises the minimum lift requirement as rocket pressure climbs', () => {
  const now = 60000;
  const launchTarget = deriveLobbyVoiceTarget({ ...createLobbyVolleyState(), peakAltitudeFt: 0 }, now);
  const orbitTarget = deriveLobbyVoiceTarget({
    ...createLobbyVolleyState(),
    peakAltitudeFt: 150,
    currentTier: 4,
    airborneStartedAtMs: now - 42000,
    startedAtMs: now - 42000,
    lastInteractionAtMs: now - 200,
  }, now);

  assert.equal(launchTarget.phase, 'inflate');
  assert.equal(orbitTarget.phase, 'orbit');
  assert.ok(orbitTarget.requiredLift > launchTarget.requiredLift, 'orbit should need more lift than launch');
  assert.ok(orbitTarget.pressurePct > launchTarget.pressurePct, 'orbit should report more pressure');
  assert.match(orbitTarget.requirementLabel, /Need G4/);
});

test('applyLobbyVoiceFrame stores raw lift, required lift, and pressure for the TV rocket HUD', () => {
  const now = 70000;
  const pressured = {
    ...createLobbyVolleyState(),
    peakAltitudeFt: 150,
    currentTier: 4,
    airborneStartedAtMs: now - 42000,
    startedAtMs: now - 42000,
    lastInteractionAtMs: now - 200,
    energy: 70,
  };
  const next = applyLobbyVoiceFrame(pressured, {
    active: true,
    pitch: 330,
    note: 'E4',
    confidence: 0.28,
    volumeNormalized: 0.09,
    stableNote: 'E4',
    stability: 0.2,
    isSinging: true,
    capturedAtMs: now,
  }, now);

  assert.equal(next.voice.target.phase, 'orbit');
  assert.equal(next.voice.lift, 0, 'weak orbit notes should not keep lifting forever');
  assert.ok(next.voice.rawLift > 0, 'raw lift should still be visible for coaching');
  assert.ok(next.voice.requiredLift > 3, 'orbit should require a stronger sustained note');
  assert.ok(next.voice.pressurePct > 70, 'pressure should be visible to the TV HUD');
});

test('Public TV exposes the Vocal Rocket target, match, lift, and pressure HUD', () => {
  assert.match(publicTvSource, /Vocal Rocket/);
  assert.match(publicTvSource, /lobbyVoiceDisplayTarget/);
  assert.match(publicTvSource, /lobbyVoiceRequirementLabel/);
  assert.match(publicTvSource, /lobbyVoiceCommandLabel/);
  assert.match(publicTvSource, /playVoiceGameCue/);
  assert.match(publicTvSource, /vocal_rocket/);
  assert.match(publicTvSource, /sharedRocketCue/);
  assert.match(publicTvSource, /lobbyInstructionHeadline = \(!lobbyObjectiveIsTeamPong && lobbyVoiceCommandLabel\)/);
  assert.match(publicTvSource, /lobbyVoicePressurePct/);
  assert.match(publicTvSource, /lobbyVoiceRawLift\.toFixed\(1\)/);
  assert.match(publicTvSource, /lobbyVoiceRequiredLift\.toFixed\(1\)/);
});