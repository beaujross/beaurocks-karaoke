import assert from 'node:assert/strict';
import { test } from 'vitest';
import {
  VOICE_GAME_ROOM_TUNING_PRESETS,
  VOICE_GAME_SOUND_CUE_LIBRARY,
  buildAudioBufferLevelMap,
  buildDynamicAudioScapePlan,
  buildVoiceGameSoundPackManifest,
  buildWaveformLevelGeometry,
  getVoiceGameCueAssetCandidates,
  getVoiceGameCueProfile,
  getVoiceGameRoomTuning,
  listVoiceGameSoundPackCueSlots,
  normalizeVoiceGameSoundPack,
  resolveVoiceGameSoundAsset
} from '../../src/lib/voiceGameSoundSystem.js';

test('voice game sound system exposes richer cue families for console-style stingers', () => {
  assert.equal(getVoiceGameCueProfile('pitch_runner', 'checkpoint')?.family, 'reward');
  assert.equal(getVoiceGameCueProfile('team_pong', 'spike')?.family, 'attack');
  assert.equal(getVoiceGameCueProfile('musical_moments', 'nailed')?.label, 'Nailed It');
  assert.equal(getVoiceGameCueProfile('vocal_rocket', 'inflate')?.label, 'Inflate Air');
  assert.equal(getVoiceGameCueProfile('vocal_rocket', 'ignition')?.label, 'Rumble Low');
  assert.ok(VOICE_GAME_SOUND_CUE_LIBRARY.team_pong.spike.layers.length >= 3);
  assert.ok(VOICE_GAME_SOUND_CUE_LIBRARY.riding_scales.checkpoint.assetNames.includes('riding-scales-checkpoint.webm'));
  assert.ok(VOICE_GAME_SOUND_CUE_LIBRARY.musical_moments.countdown.assetNames.includes('musical-moments-countdown.webm'));
});

test('voice game sound system resolves future produced asset packs while preserving procedural fallback names', () => {
  assert.equal(
    resolveVoiceGameSoundAsset({ mode: 'team_pong', cue: 'spike', soundPack: { team_pong: { spike: '/packs/arena/spike.wav' } } }),
    '/packs/arena/spike.wav'
  );
  assert.equal(
    resolveVoiceGameSoundAsset({ mode: 'pitch_runner', cue: 'higher', basePath: '/assets/sfx' }),
    '/assets/sfx/pitch_runner/pitch-runner-higher.webm'
  );
});

test('waveform analysis turns audio energy into level geometry and dynamic map metadata', () => {
  const samples = Array.from({ length: 256 }, (_, index) => Math.sin(index / 8) * (index > 96 && index < 150 ? 0.95 : 0.18));
  const geometry = buildWaveformLevelGeometry(samples, { segmentCount: 16 });
  assert.equal(geometry.length, 16);
  assert.ok(geometry.some((segment) => segment.command === 'HIT'));
  assert.ok(geometry.every((segment) => Number.isFinite(segment.topY) && Number.isFinite(segment.bottomY)));

  const plan = buildDynamicAudioScapePlan({ mode: 'musical_moments', cue: 'nailed', samples, durationSec: 12, segmentCount: 16 });
  assert.equal(plan.mode, 'musical_moments');
  assert.equal(plan.family, 'reward');
  assert.ok(plan.peaks.length > 0);
  assert.ok(plan.segments.every((segment) => Number.isFinite(segment.atSec) && Number.isFinite(segment.durationSec)));
});

test('audio buffer adapter reads channel data into the same level map primitive', () => {
  const channelData = Float32Array.from([0, 0.1, -0.4, 0.9, -0.7, 0.2, 0.05, 0]);
  const fakeBuffer = {
    numberOfChannels: 1,
    duration: 2,
    getChannelData: () => channelData
  };
  const geometry = buildAudioBufferLevelMap(fakeBuffer, { segmentCount: 4 });
  assert.equal(geometry.length, 4);
  assert.ok(geometry.some((segment) => segment.energy > 0.2));
});
test('voice game sound packs normalize produced cue manifests and slot-only manifests safely', () => {
  const pack = normalizeVoiceGameSoundPack({
    id: 'arena',
    basePath: '/packs/arena',
    modes: {
      team_pong: {
        cues: {
          spike: { path: 'team-pong-spike.webm', volume: 0.8, playbackRate: 1.05 }
        }
      }
    }
  });
  assert.equal(pack.modes.team_pong.spike.url, '/packs/arena/team-pong-spike.webm');
  assert.equal(pack.modes.team_pong.spike.volume, 0.8);
  assert.equal(getVoiceGameCueAssetCandidates({ mode: 'team_pong', cue: 'spike', soundPack: pack })[0].url, '/packs/arena/team-pong-spike.webm');

  const slotsOnly = buildVoiceGameSoundPackManifest({ assetsAvailable: false });
  assert.equal(resolveVoiceGameSoundAsset({ mode: 'team_pong', cue: 'spike', soundPack: slotsOnly }), '');
  assert.ok(listVoiceGameSoundPackCueSlots().some((slot) => slot.mode === 'vocal_rocket' && slot.cue === 'orbit'));
});

test('voice game room tuning presets expose forgiving room calibration metadata', () => {
  assert.equal(VOICE_GAME_ROOM_TUNING_PRESETS.forgiving_room.label, 'Forgiving Room');
  const loudRoom = getVoiceGameRoomTuning('loud_room');
  assert.ok(loudRoom.pitchWindowMultiplier > 1);
  assert.ok(loudRoom.staleInputGraceMs >= 600);
  const custom = getVoiceGameRoomTuning({ id: 'latency_test', latencyOffsetMs: 1800, cueIntensity: 3 });
  assert.equal(custom.id, 'latency_test');
  assert.equal(custom.latencyOffsetMs, 1200);
  assert.equal(custom.cueIntensity, 2.4);
});