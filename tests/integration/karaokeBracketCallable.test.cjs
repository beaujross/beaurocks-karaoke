const assert = require("node:assert/strict");
const admin = require("../../functions/node_modules/firebase-admin");
const {
  castKaraokeBracketVote,
  executeRunOfShowAction,
  manageKaraokeBracket,
  resolveKaraokeBracketMatch,
  submitBracketRoundSong,
} = require("../../functions/index.js");

const PROJECT_ID = process.env.GCLOUD_PROJECT || "demo-bross";
const APP_ID = "bross-app";
const ROOT = `artifacts/${APP_ID}/public/data`;
const ROOM_CODE = "ROOM1";
const HOST_UID = "host-uid";
const A_UID = "singer-a";
const B_UID = "singer-b";
const VOTER_UID = "voter-uid";
const OTHER_VOTER_UID = "other-voter";
const ROS_BRACKET_ITEM_ID = "ros_bracket_break";

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error("FIRESTORE_EMULATOR_HOST is required for callable integration tests.");
}

process.env.GCLOUD_PROJECT = PROJECT_ID;

const db = admin.firestore();
const roomRef = db.doc(`${ROOT}/rooms/${ROOM_CODE}`);
const roomUserRefFor = (uid) => db.doc(`${ROOT}/room_users/${ROOM_CODE}_${uid}`);
const bracketQueueRefFor = (bracketId, matchId, uid) => db.doc(`${ROOT}/karaoke_songs/bracket_${ROOM_CODE}_${bracketId}_${matchId}_${uid}`);

const requestFor = (uid, data = {}) => ({
  auth: uid ? { uid, token: data.__token || {} } : null,
  app: null,
  data: Object.fromEntries(Object.entries(data).filter(([key]) => key !== "__token")),
  rawRequest: {
    ip: "127.0.0.1",
    get: () => "",
  },
});

async function deleteIfPresent(ref) {
  try {
    await ref.delete();
  } catch {
    // Ignore missing docs during cleanup.
  }
}

function buildBracket() {
  return {
    id: "bracket_1",
    style: "sweet16",
    format: "single_elimination",
    size: 2,
    status: "in_progress",
    activeRoundIndex: 0,
    activeMatchId: "m_1_1",
    crowdVotingEnabled: true,
    contestantOrder: [A_UID, B_UID],
    contestantsByUid: {
      [A_UID]: { uid: A_UID, name: "Singer A", avatar: "A", tight15: [{ songTitle: "Song A", artist: "Artist A" }] },
      [B_UID]: { uid: B_UID, name: "Singer B", avatar: "B", tight15: [{ songTitle: "Song B", artist: "Artist B" }] },
    },
    rounds: [{
      id: "round_1",
      index: 0,
      name: "Final",
      matches: [{
        id: "m_1_1",
        slot: 1,
        aUid: A_UID,
        bUid: B_UID,
        aSong: { songTitle: "Song A", artist: "Artist A" },
        bSong: { songTitle: "Song B", artist: "Artist B" },
        winnerUid: null,
        queuedAt: 123,
        completedAt: null,
      }],
    }],
  };
}

async function resetState({ bracketPatch = {}, includeOtherVoter = true } = {}) {
  await Promise.all([
    deleteIfPresent(roomRef),
    deleteIfPresent(roomUserRefFor(A_UID)),
    deleteIfPresent(roomUserRefFor(B_UID)),
    deleteIfPresent(roomUserRefFor(VOTER_UID)),
    deleteIfPresent(roomUserRefFor(OTHER_VOTER_UID)),
  ]);
  const bracket = { ...buildBracket(), ...bracketPatch };
  await roomRef.set({
    hostUid: HOST_UID,
    hostUids: [HOST_UID],
    activeMode: "karaoke_bracket",
    karaokeBracket: bracket,
    gameData: bracket,
  });
  await Promise.all([
    roomUserRefFor(A_UID).set({ roomCode: ROOM_CODE, uid: A_UID, name: "Singer A" }),
    roomUserRefFor(B_UID).set({ roomCode: ROOM_CODE, uid: B_UID, name: "Singer B" }),
    roomUserRefFor(VOTER_UID).set({ roomCode: ROOM_CODE, uid: VOTER_UID, name: "Voter" }),
    includeOtherVoter
      ? roomUserRefFor(OTHER_VOTER_UID).set({ roomCode: ROOM_CODE, uid: OTHER_VOTER_UID, name: "Other" })
      : Promise.resolve(),
  ]);
}

async function resetSignupState({ withTight15 = false } = {}) {
  await Promise.all([
    deleteIfPresent(roomRef),
    deleteIfPresent(roomUserRefFor(A_UID)),
    deleteIfPresent(roomUserRefFor(B_UID)),
    deleteIfPresent(roomUserRefFor(VOTER_UID)),
    deleteIfPresent(roomUserRefFor(OTHER_VOTER_UID)),
  ]);
  await roomRef.set({
    hostUid: HOST_UID,
    hostUids: [HOST_UID],
    activeMode: "karaoke",
  });
  const tight15A = withTight15 ? [{ songTitle: "Song A", artist: "Artist A" }] : [];
  const tight15B = withTight15 ? [{ songTitle: "Song B", artist: "Artist B" }] : [];
  await Promise.all([
    roomUserRefFor(A_UID).set({ roomCode: ROOM_CODE, uid: A_UID, name: "Singer A", avatar: "A", tight15: tight15A }),
    roomUserRefFor(B_UID).set({ roomCode: ROOM_CODE, uid: B_UID, name: "Singer B", avatar: "B", tight15: tight15B }),
    roomUserRefFor(VOTER_UID).set({ roomCode: ROOM_CODE, uid: VOTER_UID, name: "Voter", avatar: "V" }),
  ]);
}

async function resetRunOfShowBracketState() {
  await resetSignupState({ withTight15: false });
  await roomRef.set({
    programMode: "run_of_show",
    runOfShowEnabled: true,
    runOfShowDirector: {
      enabled: true,
      automationPaused: false,
      automationStatus: "staged",
      currentItemId: "",
      items: [
        {
          id: ROS_BRACKET_ITEM_ID,
          type: "game_break",
          title: "Karaoke Bracket",
          sequence: 1,
          status: "staged",
          visibility: "public",
          automationMode: "manual",
          plannedDurationSec: 600,
          modeLaunchPlan: {
            modeKey: "karaoke_bracket",
            launchConfig: {
              songSelectionMode: "singer_pick_round",
            },
          },
        },
      ],
    },
  }, { merge: true });
}

async function expectHttpsError(run, expectedCode) {
  try {
    await run();
  } catch (err) {
    const code = String(err?.code || "");
    assert.ok(code.includes(expectedCode), `Expected ${expectedCode} but got ${code}`);
    return;
  }
  assert.fail(`Expected callable to throw ${expectedCode}`);
}

async function runCase(name, fn) {
  try {
    await fn();
    console.log(`PASS ${name}`);
    return true;
  } catch (err) {
    console.error(`FAIL ${name}`);
    console.error(err);
    return false;
  }
}

async function run() {
  const checks = [
    ["bracket crowd vote writes server-owned room user vote idempotently", async () => {
      await resetState();
      const first = await castKaraokeBracketVote.run(requestFor(VOTER_UID, {
        roomCode: ROOM_CODE,
        bracketId: "bracket_1",
        matchId: "m_1_1",
        targetUid: A_UID,
      }));
      assert.equal(first.ok, true);
      assert.equal(first.duplicate, false);

      const snap = await roomUserRefFor(VOTER_UID).get();
      assert.equal(snap.get("bracketVote.bracketId"), "bracket_1");
      assert.equal(snap.get("bracketVote.matchId"), "m_1_1");
      assert.equal(snap.get("bracketVote.targetUid"), A_UID);

      const duplicate = await castKaraokeBracketVote.run(requestFor(VOTER_UID, {
        roomCode: ROOM_CODE,
        bracketId: "bracket_1",
        matchId: "m_1_1",
        targetUid: A_UID,
      }));
      assert.equal(duplicate.ok, true);
      assert.equal(duplicate.duplicate, true);
    }],

    ["host can create and queue singer-pick bracket without Tight 15", async () => {
      await resetSignupState({ withTight15: false });
      const signup = await manageKaraokeBracket.run(requestFor(HOST_UID, {
        roomCode: ROOM_CODE,
        action: "open_signup",
        songSelectionMode: "singer_pick_round",
        durationMin: 10,
      }));
      assert.equal(signup.ok, true);
      assert.equal(signup.songSelectionMode, "singer_pick_round");

      const created = await manageKaraokeBracket.run(requestFor(HOST_UID, {
        roomCode: ROOM_CODE,
        action: "create",
        songSelectionMode: "singer_pick_round",
        seedUids: [A_UID, B_UID],
      }));
      assert.equal(created.ok, true);
      assert.equal(created.bracketSize, 2);
      assert.equal(created.songSelectionMode, "singer_pick_round");

      const queued = await manageKaraokeBracket.run(requestFor(HOST_UID, {
        roomCode: ROOM_CODE,
        action: "queue_next_match",
      }));
      assert.equal(queued.ok, true);
      assert.equal(queued.requiresSingerSongPick, true);
      assert.deepEqual(queued.queuedSongs, []);

      const roomSnap = await roomRef.get();
      const bracket = roomSnap.get("karaokeBracket");
      const match = bracket.rounds[0].matches[0];
      assert.equal(bracket.songSelectionMode, "singer_pick_round");
      assert.equal(match.requiresSingerSongPick, true);
      assert.equal(match.aSong, null);
      assert.equal(match.bSong, null);
    }],

    ["contestant submits singer-pick bracket round song idempotently", async () => {
      await resetSignupState({ withTight15: false });
      const created = await manageKaraokeBracket.run(requestFor(HOST_UID, {
        roomCode: ROOM_CODE,
        action: "create",
        songSelectionMode: "singer_pick_round",
        seedUids: [A_UID, B_UID],
      }));
      const queued = await manageKaraokeBracket.run(requestFor(HOST_UID, {
        roomCode: ROOM_CODE,
        action: "queue_next_match",
      }));

      const first = await submitBracketRoundSong.run(requestFor(A_UID, {
        roomCode: ROOM_CODE,
        bracketId: created.bracketId,
        matchId: queued.matchId,
        songTitle: "Singer Pick",
        artist: "Round Artist",
        clientRequestId: "pick-a-1",
      }));
      assert.equal(first.ok, true);
      assert.equal(first.duplicate, false);
      assert.equal(first.side, "a");

      const roomSnap = await roomRef.get();
      const match = roomSnap.get("karaokeBracket").rounds[0].matches[0];
      assert.equal(match.aSong.songTitle, "Singer Pick");
      assert.equal(match.aSong.queueSongId, first.songId);
      const queueSnap = await bracketQueueRefFor(created.bracketId, queued.matchId, A_UID).get();
      assert.equal(queueSnap.exists, true);
      assert.equal(queueSnap.get("submittedVia"), "karaoke_bracket_round");

      const duplicate = await submitBracketRoundSong.run(requestFor(A_UID, {
        roomCode: ROOM_CODE,
        bracketId: created.bracketId,
        matchId: queued.matchId,
        songTitle: "Different Pick",
        artist: "Different Artist",
      }));
      assert.equal(duplicate.ok, true);
      assert.equal(duplicate.duplicate, true);

      await expectHttpsError(
        () => submitBracketRoundSong.run(requestFor(VOTER_UID, {
          roomCode: ROOM_CODE,
          bracketId: created.bracketId,
          matchId: queued.matchId,
          songTitle: "Not My Match",
          artist: "Nope",
        })),
        "permission-denied"
      );
    }],

    ["run of show bracket launch preserves director state and stamps round song queue docs", async () => {
      await resetRunOfShowBracketState();
      const launch = await executeRunOfShowAction.run(requestFor(HOST_UID, {
        roomCode: ROOM_CODE,
        action: "start",
        itemId: ROS_BRACKET_ITEM_ID,
      }));
      assert.equal(launch.ok, true);

      let roomSnap = await roomRef.get();
      assert.equal(roomSnap.get("activeMode"), "karaoke_bracket");
      assert.equal(roomSnap.get("gameData.runOfShowItemId"), ROS_BRACKET_ITEM_ID);
      assert.equal(roomSnap.get("runOfShowDirector.currentItemId"), ROS_BRACKET_ITEM_ID);

      const created = await manageKaraokeBracket.run(requestFor(HOST_UID, {
        roomCode: ROOM_CODE,
        action: "create",
        songSelectionMode: "singer_pick_round",
        seedUids: [A_UID, B_UID],
      }));
      assert.equal(created.ok, true);

      const queued = await manageKaraokeBracket.run(requestFor(HOST_UID, {
        roomCode: ROOM_CODE,
        action: "queue_next_match",
      }));
      assert.equal(queued.ok, true);
      assert.equal(queued.requiresSingerSongPick, true);

      const picked = await submitBracketRoundSong.run(requestFor(A_UID, {
        roomCode: ROOM_CODE,
        bracketId: created.bracketId,
        matchId: queued.matchId,
        songTitle: "ROS Bracket Pick",
        artist: "Run Sheet Artist",
      }));
      assert.equal(picked.ok, true);
      const queueSnap = await bracketQueueRefFor(created.bracketId, queued.matchId, A_UID).get();
      assert.equal(queueSnap.get("runOfShowItemId"), ROS_BRACKET_ITEM_ID);
      assert.equal(queueSnap.get("sourceMode"), "karaoke_bracket");

      roomSnap = await roomRef.get();
      assert.equal(roomSnap.get("runOfShowDirector.currentItemId"), ROS_BRACKET_ITEM_ID);
      assert.equal(roomSnap.get("gameData.id"), created.bracketId);
      assert.equal(roomSnap.get("gameData.rounds")[0].matches[0].aSong.songTitle, "ROS Bracket Pick");

      const resolved = await resolveKaraokeBracketMatch.run(requestFor(HOST_UID, {
        roomCode: ROOM_CODE,
        bracketId: created.bracketId,
        matchId: queued.matchId,
        winnerUid: A_UID,
        reason: "host_decision",
        source: "host",
      }));
      assert.equal(resolved.ok, true);
      roomSnap = await roomRef.get();
      assert.equal(roomSnap.get("bracketLastSummary.championUid"), A_UID);
      assert.equal(roomSnap.get("runOfShowDirector.currentItemId"), ROS_BRACKET_ITEM_ID);

      const cleared = await manageKaraokeBracket.run(requestFor(HOST_UID, {
        roomCode: ROOM_CODE,
        action: "clear",
      }));
      assert.equal(cleared.ok, true);
      roomSnap = await roomRef.get();
      assert.equal(roomSnap.get("karaokeBracket"), null);
      assert.equal(roomSnap.get("gameData"), null);
      assert.equal(roomSnap.get("runOfShowDirector.currentItemId"), ROS_BRACKET_ITEM_ID);
    }],

    ["host queues Tight 15 bracket songs server-side", async () => {
      await resetSignupState({ withTight15: true });
      const created = await manageKaraokeBracket.run(requestFor(HOST_UID, {
        roomCode: ROOM_CODE,
        action: "create",
        songSelectionMode: "tight15_random",
        seedUids: [A_UID, B_UID],
      }));
      const queued = await manageKaraokeBracket.run(requestFor(HOST_UID, {
        roomCode: ROOM_CODE,
        action: "queue_next_match",
      }));
      assert.equal(queued.ok, true);
      assert.equal(queued.requiresSingerSongPick, false);
      assert.equal(queued.queuedSongs.length, 2);
      const [aQueueSnap, bQueueSnap] = await Promise.all([
        bracketQueueRefFor(created.bracketId, queued.matchId, A_UID).get(),
        bracketQueueRefFor(created.bracketId, queued.matchId, B_UID).get(),
      ]);
      assert.equal(aQueueSnap.exists, true);
      assert.equal(bQueueSnap.exists, true);
      assert.equal(aQueueSnap.get("submittedVia"), "karaoke_bracket");
      assert.equal(bQueueSnap.get("sourceMode"), "karaoke_bracket");
    }],

    ["bracket crowd vote rejects contestants and paused voting", async () => {
      await resetState();
      await expectHttpsError(
        () => castKaraokeBracketVote.run(requestFor(A_UID, {
          roomCode: ROOM_CODE,
          bracketId: "bracket_1",
          matchId: "m_1_1",
          targetUid: B_UID,
        })),
        "permission-denied"
      );

      await resetState({ bracketPatch: { crowdVotingEnabled: false } });
      await expectHttpsError(
        () => castKaraokeBracketVote.run(requestFor(VOTER_UID, {
          roomCode: ROOM_CODE,
          bracketId: "bracket_1",
          matchId: "m_1_1",
          targetUid: A_UID,
        })),
        "failed-precondition"
      );
    }],

    ["host resolves bracket match from authoritative crowd votes", async () => {
      await resetState();
      await castKaraokeBracketVote.run(requestFor(VOTER_UID, {
        roomCode: ROOM_CODE,
        bracketId: "bracket_1",
        matchId: "m_1_1",
        targetUid: A_UID,
      }));
      await castKaraokeBracketVote.run(requestFor(OTHER_VOTER_UID, {
        roomCode: ROOM_CODE,
        bracketId: "bracket_1",
        matchId: "m_1_1",
        targetUid: A_UID,
      }));

      const result = await resolveKaraokeBracketMatch.run(requestFor(HOST_UID, {
        roomCode: ROOM_CODE,
        bracketId: "bracket_1",
        matchId: "m_1_1",
        useCrowdVotes: true,
        reason: "crowd_vote",
        source: "crowd",
      }));
      assert.equal(result.ok, true);
      assert.equal(result.winnerUid, A_UID);
      assert.equal(result.status, "complete");
      assert.equal(result.championUid, A_UID);
      assert.equal(result.votes.aVotes, 2);

      const roomSnap = await roomRef.get();
      const roomData = roomSnap.data() || {};
      assert.equal(roomData.karaokeBracket.rounds[0].matches[0].winnerUid, A_UID);
      assert.equal(roomData.karaokeBracket.championUid, A_UID);
      assert.equal(roomData.bracketLastSummary.championUid, A_UID);

      const duplicate = await resolveKaraokeBracketMatch.run(requestFor(HOST_UID, {
        roomCode: ROOM_CODE,
        bracketId: "bracket_1",
        matchId: "m_1_1",
        useCrowdVotes: true,
      }));
      assert.equal(duplicate.ok, true);
      assert.equal(duplicate.duplicate, true);
    }],

    ["host crowd resolve rejects tied votes", async () => {
      await resetState();
      await castKaraokeBracketVote.run(requestFor(VOTER_UID, {
        roomCode: ROOM_CODE,
        bracketId: "bracket_1",
        matchId: "m_1_1",
        targetUid: A_UID,
      }));
      await castKaraokeBracketVote.run(requestFor(OTHER_VOTER_UID, {
        roomCode: ROOM_CODE,
        bracketId: "bracket_1",
        matchId: "m_1_1",
        targetUid: B_UID,
      }));
      await expectHttpsError(
        () => resolveKaraokeBracketMatch.run(requestFor(HOST_UID, {
          roomCode: ROOM_CODE,
          bracketId: "bracket_1",
          matchId: "m_1_1",
          useCrowdVotes: true,
        })),
        "failed-precondition"
      );
    }],
  ];

  let failures = 0;
  for (const [name, fn] of checks) {
    const ok = await runCase(name, fn);
    if (!ok) failures += 1;
  }
  if (failures) {
    throw new Error(`${failures} karaoke bracket callable check(s) failed.`);
  }
  console.log(`All ${checks.length} karaoke bracket callable checks passed.`);
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("karaoke bracket callable integration test failed.");
    console.error(err);
    process.exit(1);
  });
