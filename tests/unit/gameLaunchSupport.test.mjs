import { describe, expect, it } from 'vitest';

import {
  buildDefaultBingoBoard,
  buildParticipantPayload,
  buildRunOfShowGameLaunchRoomUpdates,
  extractRoomUserUidFromDocId,
  findRoomUserByUid,
  getResolvedRoomUserUids,
  resolveRoomUserUid,
  selectQuickLaunchBingoBoard,
} from '../../src/lib/gameLaunchSupport.js';

describe('game launch support', () => {
  it('resolves room user ids from current and legacy room user shapes', () => {
    expect(resolveRoomUserUid({ uid: 'uid-123', id: 'room_old' })).toBe('uid-123');
    expect(resolveRoomUserUid({ id: 'room_uid-456' })).toBe('uid-456');
    expect(resolveRoomUserUid({ id: 'room_uid_with_under_scores' })).toBe('uid_with_under_scores');
    expect(extractRoomUserUidFromDocId('room_uid_with_under_scores')).toBe('uid_with_under_scores');
    expect(resolveRoomUserUid({})).toBe('');
    expect(getResolvedRoomUserUids([
      { uid: 'alpha' },
      { id: 'room_bravo' },
      { id: 'room_charlie_delta' },
      { id: 'invalid' },
      null,
    ])).toEqual(['alpha', 'bravo', 'charlie_delta']);

    const roomUsers = [
      { uid: 'host-1', name: 'Host' },
      { id: 'room_guest-2', name: 'Guest' },
      { id: 'room_guest_with_under_scores', name: 'Guest 2' },
    ];
    expect(findRoomUserByUid(roomUsers, 'guest-2')?.name).toBe('Guest');
    expect(findRoomUserByUid(roomUsers, 'guest_with_under_scores')?.name).toBe('Guest 2');
    expect(findRoomUserByUid(roomUsers, 'missing')).toBeNull();
  });

  it('selects custom bingo boards before preset bingo boards', () => {
    const presetBoard = { id: 'preset', tiles: [{ id: 1 }] };
    const customBoard = { id: 'custom', tiles: [{ id: 2 }] };

    expect(selectQuickLaunchBingoBoard({
      bingoBoards: [customBoard],
      presetBoards: [presetBoard],
    })?.id).toBe('custom');
    expect(selectQuickLaunchBingoBoard({
      bingoBoards: [],
      presetBoards: [presetBoard],
    })?.id).toBe('preset');
    expect(selectQuickLaunchBingoBoard({ bingoBoards: [], presetBoards: [] })).toBeNull();
  });

  it('builds participant payloads without leaking stale selected users into all-player games', () => {
    expect(buildParticipantPayload('selected', ['a', 'b', 'a', ''])).toEqual({
      gameParticipantMode: 'selected',
      gameParticipants: ['a', 'b'],
    });
    expect(buildParticipantPayload('all', ['a'])).toEqual({
      gameParticipantMode: 'all',
      gameParticipants: [],
    });
  });

  it('creates a default bingo board for run-of-show game cards', () => {
    const board = buildDefaultBingoBoard({ size: 5, title: 'Room Bingo' });

    expect(board.title).toBe('Room Bingo');
    expect(board.tiles).toHaveLength(25);
    expect(board.tiles[12].free).toBe(true);
  });

  it('maps a run-of-show bingo card to the same room fields used by live bingo', () => {
    const updates = buildRunOfShowGameLaunchRoomUpdates({
      item: {
        id: 'bingo-card',
        type: 'game_break',
        title: 'Bingo Break',
        modeLaunchPlan: {
          modeKey: 'bingo',
          launchConfig: { size: 5, bingoMode: 'karaoke' },
        },
      },
      room: { bingoVotingMode: 'host+votes', bingoAutoApprovePct: 45 },
      roomUsers: [{ uid: 'u1' }, { uid: 'u2' }],
      startedAtMs: 12345,
    });

    expect(updates.activeMode).toBe('bingo');
    expect(updates.bingoData).toHaveLength(25);
    expect(updates.bingoRevealed).toEqual({ 12: true });
    expect(updates.gameParticipantMode).toBe('all');
  });

  it('maps a planned selfie challenge to all current room users when no explicit participants are set', () => {
    const updates = buildRunOfShowGameLaunchRoomUpdates({
      item: {
        id: 'selfie-card',
        type: 'game_break',
        title: 'Selfie Break',
        modeLaunchPlan: {
          modeKey: 'selfie_challenge',
          launchConfig: { question: 'Best karaoke face' },
        },
      },
      roomUsers: [{ uid: 'u1' }, { id: 'ROOM_u2' }],
      startedAtMs: 12345,
    });

    expect(updates.activeMode).toBe('selfie_challenge');
    expect(updates.selfieChallenge.participants).toEqual(['u1', 'u2']);
    expect(updates.gameParticipantMode).toBe('selected');
  });

  it('maps team pong cards to live gameData instead of generic placeholder data', () => {
    const updates = buildRunOfShowGameLaunchRoomUpdates({
      item: {
        id: 'pong-card',
        type: 'game_break',
        title: 'Team Pong',
        modeLaunchPlan: {
          modeKey: 'team_pong',
          launchConfig: { targetRally: 30 },
        },
      },
      startedAtMs: 12345,
    });

    expect(updates.activeMode).toBe('team_pong');
    expect(updates.gameData.sessionId).toBe('team_pong_12345');
    expect(updates.gameData.targetRally).toBe(30);
  });

  it('maps doodle-oke cards with selected participants and round timing', () => {
    const updates = buildRunOfShowGameLaunchRoomUpdates({
      item: {
        id: 'doodle-card',
        type: 'game_break',
        title: 'Doodle-oke',
        modeLaunchPlan: {
          modeKey: 'doodle_oke',
          launchConfig: {
            prompt: 'Draw the final chorus',
            drawingSec: 30,
            guessSec: 8,
            participantMode: 'selected',
            participants: ['u2', 'u2', ''],
          },
        },
      },
      roomUsers: [{ uid: 'u1' }, { id: 'ROOM_u2' }],
      startedAtMs: 1000,
    });

    expect(updates.activeMode).toBe('doodle_oke');
    expect(updates.doodleOke.prompt).toBe('Draw the final chorus');
    expect(updates.doodleOke.durationMs).toBe(30000);
    expect(updates.doodleOke.endsAt).toBe(31000);
    expect(updates.doodleOke.guessEndsAt).toBe(39000);
    expect(updates.doodleOkeConfig.participants).toEqual(['u2']);
    expect(updates.gameParticipantMode).toBe('selected');
    expect(updates.gameParticipants).toEqual(['u2']);
  });

  it('maps vocal challenge cards as ambient crowd games with explicit tuning', () => {
    const updates = buildRunOfShowGameLaunchRoomUpdates({
      item: {
        id: 'vocal-card',
        type: 'game_break',
        title: 'Vocal Warmup',
        plannedDurationSec: 90,
        modeLaunchPlan: {
          modeKey: 'vocal_challenge',
          launchConfig: { guideTone: 'G4', difficulty: 'hard' },
        },
      },
      startedAtMs: 12345,
    });

    expect(updates.activeMode).toBe('vocal_challenge');
    expect(updates.gameData.status).toBe('playing');
    expect(updates.gameData.inputSource).toBe('ambient');
    expect(updates.gameData.turnDurationMs).toBe(90000);
    expect(updates.gameData.guideTone).toBe('G4');
    expect(updates.gameParticipantMode).toBe('all');
  });

  it('maps riding scales cards with crowd input, rewards, and a stable pattern', () => {
    const updates = buildRunOfShowGameLaunchRoomUpdates({
      item: {
        id: 'scale-card',
        type: 'game_break',
        title: 'Riding Scales',
        modeLaunchPlan: {
          modeKey: 'riding_scales',
          launchConfig: {
            durationSec: 45,
            guideTone: 'D4',
            maxStrikes: 2,
            rewardPerRound: 75,
          },
        },
      },
      startedAtMs: 12345,
    });

    expect(updates.activeMode).toBe('riding_scales');
    expect(updates.gameData.status).toBe('running');
    expect(updates.gameData.inputSource).toBe('crowd');
    expect(updates.gameData.turnDurationMs).toBe(45000);
    expect(updates.gameData.pattern).toEqual(['C', 'E', 'G', 'A', 'G', 'F', 'E', 'D', 'C']);
    expect(updates.gameData.maxStrikes).toBe(2);
    expect(updates.gameData.rewardPerRound).toBe(75);
  });

  it('maps applause countdown cards without leaving stale game payloads behind', () => {
    const updates = buildRunOfShowGameLaunchRoomUpdates({
      item: {
        id: 'applause-card',
        type: 'game_break',
        title: 'Applause Check',
        modeLaunchPlan: {
          modeKey: 'applause_countdown',
          launchConfig: {},
        },
      },
      startedAtMs: 12345,
    });

    expect(updates.activeMode).toBe('applause_countdown');
    expect(updates.applausePeak).toBe(0);
    expect(updates.currentApplauseLevel).toBe(0);
    expect(updates.gameData).toBeNull();
    expect(updates.triviaQuestion).toBeNull();
    expect(updates.wyrData).toBeNull();
  });

  it('maps unknown run-of-show game cards through a generic live game fallback', () => {
    const updates = buildRunOfShowGameLaunchRoomUpdates({
      item: {
        id: 'custom-card',
        type: 'game_break',
        title: 'Custom Crowd Game',
        modeLaunchPlan: {
          modeKey: 'custom_room_game',
          launchConfig: {
            durationSec: 25,
            participantMode: 'selected',
            participants: ['u3', 'u3'],
          },
        },
      },
      roomUsers: [{ uid: 'u1' }, { uid: 'u3' }],
      startedAtMs: 12345,
    });

    expect(updates.activeMode).toBe('custom_room_game');
    expect(updates.gameData.id).toBe('custom-card_12345');
    expect(updates.gameData.source).toBe('run_of_show');
    expect(updates.gameData.runOfShowItemId).toBe('custom-card');
    expect(updates.gameData.durationSec).toBe(25);
    expect(updates.gameParticipantMode).toBe('selected');
    expect(updates.gameParticipants).toEqual(['u3']);
    expect(updates.triviaQuestion).toBeNull();
    expect(updates.wyrData).toBeNull();
  });
});
