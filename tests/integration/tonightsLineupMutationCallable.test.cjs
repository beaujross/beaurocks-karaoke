const assert = require('node:assert/strict');
const admin = require('../../functions/node_modules/firebase-admin');
const { executeRunOfShowAction, mutateTonightLineup } = require('../../functions/index.js');

const PROJECT_ID = process.env.GCLOUD_PROJECT || 'demo-bross';
const ROOT = 'artifacts/bross-app/public/data';
const ROOM_CODE = 'LINEUPTX1';
const HOST_UID = 'lineup-host';
const SONG_ID = 'lineup-song-1';

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error('FIRESTORE_EMULATOR_HOST is required for callable integration tests.');
}
process.env.GCLOUD_PROJECT = PROJECT_ID;
if (!admin.apps.length) admin.initializeApp({ projectId: PROJECT_ID });

const db = admin.firestore();
const roomRef = db.doc(`${ROOT}/rooms/${ROOM_CODE}`);
const songRef = db.doc(`${ROOT}/karaoke_songs/${SONG_ID}`);
const requestFor = (data = {}) => ({
  auth: { uid: HOST_UID, token: { email: 'lineup-host@example.com', name: 'Lineup Host' } },
  app: null,
  data,
  rawRequest: { ip: '127.0.0.1', get: () => '' },
});

async function resetData() {
  await Promise.all([roomRef.delete().catch(() => {}), songRef.delete().catch(() => {})]);
  await roomRef.set({
    hostUid: HOST_UID,
    hostUids: [HOST_UID],
    programMode: 'run_of_show',
    runOfShowEnabled: true,
    runOfShowDirector: {
      version: 2,
      revision: 0,
      enabled: true,
      automationIntent: 'auto',
      items: [
        { id: 'welcome', type: 'announcement', title: 'Welcome', sequence: 1, status: 'ready', destination: 'queue' },
        { id: 'warmup', type: 'game_break', title: 'Warm-up', sequence: 2, status: 'ready', destination: 'queue' },
      ],
    },
  });
  await songRef.set({
    roomCode: ROOM_CODE,
    singerUid: 'guest-one',
    singerName: 'Guest One',
    songTitle: 'Dreams',
    artist: 'Fleetwood Mac',
    youtubeId: 'video-1',
    status: 'requested',
    priorityScore: 100,
  });
}

async function mutate(action, operationId, expectedRevision, payload = {}) {
  return mutateTonightLineup.run(requestFor({ roomCode: ROOM_CODE, action, operationId, expectedRevision, payload }));
}

async function execute(action, itemId, operationId) {
  return executeRunOfShowAction.run(requestFor({ roomCode: ROOM_CODE, action, itemId, operationId }));
}

async function expectConflict(promise) {
  try {
    await promise;
  } catch (error) {
    assert.match(String(error?.code || ''), /aborted/);
    return;
  }
  assert.fail('Expected a lineup revision conflict.');
}

async function runCase(name, fn) {
  await resetData();
  try {
    await fn();
    console.log(`PASS ${name}`);
    return true;
  } catch (error) {
    console.error(`FAIL ${name}`);
    console.error(error);
    return false;
  }
}

async function run() {
  const outcomes = [];
  outcomes.push(await runCase('performance insertion preserves committed scene order and is idempotent', async () => {
    const inserted = await mutate('insert_performance', 'insert-song-one', 0, { queueSongId: SONG_ID });
    assert.deepEqual(inserted.runOfShowDirector.items.map((item) => item.id), [
      'welcome',
      'warmup',
      'ros_perf_insert-song-one',
    ]);
    assert.equal(inserted.revision, 1);
    const repeated = await mutate('insert_performance', 'insert-song-one', 0, { queueSongId: SONG_ID });
    assert.equal(repeated.idempotent, true);
    assert.equal(repeated.revision, 1);
    assert.equal((await songRef.get()).get('runOfShowItemId'), 'ros_perf_insert-song-one');
  }));

  outcomes.push(await runCase('competing hosts cannot overwrite a newer lineup revision', async () => {
    const results = await Promise.allSettled([
      mutate('move_item', 'move-welcome-a', 0, { itemId: 'welcome', toIndex: 1 }),
      mutate('move_item', 'move-welcome-b', 0, { itemId: 'welcome', toIndex: 1 }),
    ]);
    assert.equal(results.filter((entry) => entry.status === 'fulfilled').length, 1);
    assert.equal(results.filter((entry) => entry.status === 'rejected').length, 1);
    await expectConflict(mutate('move_item', 'stale-move', 0, { itemId: 'warmup', toIndex: 0 }));
    assert.equal((await roomRef.get()).get('runOfShowDirector.revision'), 1);
  }));

  outcomes.push(await runCase('open-slot assignment joins the queue document atomically', async () => {
    await roomRef.update({
      'runOfShowDirector.items': [
        { id: 'welcome', type: 'announcement', title: 'Welcome', sequence: 1, status: 'ready', destination: 'queue' },
        { id: 'open-slot', type: 'performance', title: 'Open Slot', sequence: 2, status: 'blocked', destination: 'queue' },
      ],
    });
    const assigned = await mutate('assign_performance_to_slot', 'assign-song-one', 0, {
      itemId: 'open-slot',
      queueSongId: SONG_ID,
    });
    const slot = assigned.runOfShowDirector.items.find((item) => item.id === 'open-slot');
    assert.equal(slot.queueSongId, SONG_ID);
    assert.equal(slot.assignedPerformerName, 'Guest One');
    assert.equal(slot.status, 'ready');
    const song = (await songRef.get()).data() || {};
    assert.equal(song.status, 'assigned');
    assert.equal(song.runOfShowItemId, 'open-slot');
  }));

  outcomes.push(await runCase('remove and restore update both the placement and queue reference', async () => {
    const inserted = await mutate('insert_performance', 'insert-for-remove', 0, { queueSongId: SONG_ID });
    const itemId = inserted.affectedItemId;
    const removed = await mutate('remove_item', 'remove-song-one', 1, { itemId });
    assert.equal(removed.runOfShowDirector.items.some((item) => item.id === itemId), false);
    assert.equal((await songRef.get()).get('runOfShowItemId'), null);
    const restored = await mutate('restore_item', 'restore-song-one', 2, { removalOperationId: 'remove-song-one' });
    assert.equal(restored.runOfShowDirector.items.some((item) => item.id === itemId), true);
    assert.equal((await songRef.get()).get('runOfShowItemId'), itemId);
  }));

  outcomes.push(await runCase('prompt reveal and completion preserve every queued performance', async () => {
    const startedAtMs = Date.now() - 12000;
    const performanceItems = [
      { id: 'performance-before', type: 'performance', queueSongId: 'song-before', sequence: 1, status: 'complete', destination: 'queue' },
      { id: 'performance-next', type: 'performance', queueSongId: SONG_ID, sequence: 3, status: 'ready', destination: 'queue' },
    ];
    await roomRef.update({
      activeMode: 'trivia_pop',
      triviaQuestion: {
        id: 'trivia-live-question',
        q: 'Which song came first?',
        options: ['A', 'B', 'C', 'D'],
        correct: 0,
        status: 'asking',
        startedAt: startedAtMs,
        durationSec: 12,
        totalDurationSec: 20,
        revealDurationSec: 8,
        revealAt: startedAtMs + 12000,
        completeAt: startedAtMs + 20000,
      },
      runOfShowDirector: {
        version: 2,
        revision: 0,
        enabled: true,
        currentItemId: 'trivia-live',
        automationIntent: 'auto',
        items: [
          performanceItems[0],
          {
            id: 'trivia-live',
            type: 'trivia_break',
            title: 'Trivia',
            sequence: 2,
            status: 'live',
            destination: 'queue',
            liveStartedAtMs: startedAtMs,
            plannedDurationSec: 20,
            modeLaunchPlan: { modeKey: 'trivia_pop', launchConfig: { durationSec: 20, revealDurationSec: 8 } },
          },
          performanceItems[1],
        ],
      },
    });

    const revealed = await execute('reveal', 'trivia-live', 'reveal-trivia-live');
    assert.equal(revealed.runOfShowDirector.items.find((item) => item.id === 'trivia-live').status, 'live');
    let room = (await roomRef.get()).data() || {};
    assert.equal(room.activeMode, 'trivia_reveal');
    assert.equal(room.triviaQuestion.status, 'reveal');
    assert.ok(Number(room.triviaQuestion.completeAt || 0) > Number(room.triviaQuestion.revealedAt || 0));
    assert.deepEqual(
      revealed.runOfShowDirector.items.filter((item) => item.type === 'performance').map((item) => [item.id, item.queueSongId, item.status]),
      performanceItems.map((item) => [item.id, item.queueSongId, item.status]),
    );

    const completed = await execute('complete', 'trivia-live', 'complete-trivia-live');
    room = (await roomRef.get()).data() || {};
    assert.equal(room.activeMode, 'karaoke');
    assert.equal(room.triviaQuestion, null);
    assert.deepEqual(
      completed.runOfShowDirector.items.filter((item) => item.type === 'performance').map((item) => [item.id, item.queueSongId, item.status]),
      performanceItems.map((item) => [item.id, item.queueSongId, item.status]),
    );
    assert.equal(completed.runOfShowDirector.items.find((item) => item.id === 'trivia-live').status, 'complete');
  }));

  const passed = outcomes.filter(Boolean).length;
  console.log(`\n${passed}/${outcomes.length} Tonight's Lineup mutation checks passed`);
  if (passed !== outcomes.length) process.exitCode = 1;
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
