const assert = require("node:assert/strict");
const admin = require("../../functions/node_modules/firebase-admin");
const {
  finalizePopTriviaQuestion,
  finalizeGuitarSyncRound,
  finalizeStrobeModeRound,
  finalizeLobbyPlaygroundAward,
} = require("../../functions/index.js");

const PROJECT_ID = process.env.GCLOUD_PROJECT || "demo-bross";
const APP_ID = "bross-app";
const ROOT = `artifacts/${APP_ID}/public/data`;
const ROOM_CODE = "TVAWARD1";

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error("FIRESTORE_EMULATOR_HOST is required for callable integration tests.");
}

process.env.GCLOUD_PROJECT = PROJECT_ID;

const db = admin.firestore();
const ref = (path) => db.doc(`${ROOT}/${path}`);
const roomRef = ref(`rooms/${ROOM_CODE}`);
const roomUserRefFor = (uid) => ref(`room_users/${ROOM_CODE}_${uid}`);
const awardRefFor = (awardKey) => ref(`room_awards/${awardKey}`);

const requestFor = (uid, data = {}) => ({
  auth: uid ? { uid, token: data.__token || {} } : null,
  app: null,
  data: Object.fromEntries(Object.entries(data).filter(([key]) => key !== "__token")),
  rawRequest: {
    ip: "127.0.0.1",
    get: () => "",
  },
});

async function deleteQuery(collectionName) {
  const snap = await db.collection(`${ROOT}/${collectionName}`).where("roomCode", "==", ROOM_CODE).get();
  await Promise.all(snap.docs.map((docSnap) => docSnap.ref.delete()));
}

async function resetState() {
  await Promise.all([
    deleteQuery("karaoke_songs"),
    deleteQuery("reactions"),
    deleteQuery("room_users"),
    deleteQuery("activities"),
    roomRef.delete().catch(() => null),
    awardRefFor(`pop_trivia_${ROOM_CODE}_q1`).delete().catch(() => null),
    awardRefFor(`guitar_${ROOM_CODE}_g1`).delete().catch(() => null),
    awardRefFor(`strobe_${ROOM_CODE}_s1`).delete().catch(() => null),
    awardRefFor(`lobby_${ROOM_CODE}_lobby_playground_0_tier_1`).delete().catch(() => null),
    awardRefFor(`lobby_${ROOM_CODE}_lobby_altitude_0_inflated`).delete().catch(() => null),
  ]);
}

async function seedRoom(extra = {}) {
  await roomRef.set({
    hostUid: "host-uid",
    hostUids: ["host-uid"],
    activeMode: "karaoke",
    lightMode: "karaoke",
    popTriviaEnabled: true,
    gameDefaults: {
      popTriviaCorrectPoints: 40,
    },
    ...extra,
  }, { merge: true });
}

async function seedRoomUser(uid, data = {}) {
  await roomUserRefFor(uid).set({
    roomCode: ROOM_CODE,
    uid,
    name: uid,
    avatar: ":)",
    points: 0,
    ...data,
  }, { merge: true });
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

async function main() {
  const results = [];

  results.push(await runCase("Pop Trivia finalizer awards correct signed-in voters once", async () => {
    await resetState();
    await seedRoom();
    await Promise.all([
      seedRoomUser("alice"),
      seedRoomUser("bob"),
      seedRoomUser("cara"),
      ref(`karaoke_songs/${ROOM_CODE}_song1`).set({
        roomCode: ROOM_CODE,
        status: "performing",
        songTitle: "Test Song",
        popTrivia: [{ id: "q1", q: "Pick B", options: ["A", "B"], correct: 1 }],
      }),
      db.collection(`${ROOT}/reactions`).add({ roomCode: ROOM_CODE, type: "vote_popup_trivia", questionId: "q1", uid: "alice", userName: "Alice", avatar: "A", val: 1, timestamp: admin.firestore.FieldValue.serverTimestamp() }),
      db.collection(`${ROOT}/reactions`).add({ roomCode: ROOM_CODE, type: "vote_popup_trivia", questionId: "q1", uid: "bob", userName: "Bob", avatar: "B", val: 0, timestamp: admin.firestore.FieldValue.serverTimestamp() }),
      db.collection(`${ROOT}/reactions`).add({ roomCode: ROOM_CODE, type: "vote_popup_trivia", questionId: "q1", uid: "cara", userName: "Cara", avatar: "C", val: 1, timestamp: admin.firestore.FieldValue.serverTimestamp() }),
    ]);

    const result = await finalizePopTriviaQuestion.run(requestFor(null, { roomCode: ROOM_CODE, questionId: "q1" }));
    assert.equal(result.ok, true);
    assert.equal(result.awardedCount, 2);
    assert.equal(result.awardedPoints, 80);
    assert.equal(result.correctIndex, 1);
    assert.equal(result.correctOption, "B");
    assert.deepEqual(result.winners.map((entry) => entry.uid), ["alice", "cara"]);
    assert.deepEqual(result.winners.map((entry) => entry.name), ["Alice", "Cara"]);
    assert.equal((await roomUserRefFor("alice").get()).data().points, 40);
    assert.equal((await roomUserRefFor("bob").get()).data().points, 0);
    assert.equal((await roomUserRefFor("cara").get()).data().points, 40);
    const roomAfterAward = (await roomRef.get()).data();
    assert.equal(roomAfterAward.popTriviaAwards.q1.correctOption, "B");
    assert.equal(roomAfterAward.popTriviaAwards.q1.awardedCount, 2);
    assert.equal(roomAfterAward.popTriviaAwards.q1.awardedPoints, 80);
    assert.deepEqual(roomAfterAward.popTriviaAwards.q1.winners.map((entry) => entry.uid), ["alice", "cara"]);

    const duplicate = await finalizePopTriviaQuestion.run(requestFor(null, { roomCode: ROOM_CODE, questionId: "q1" }));
    assert.equal(duplicate.duplicate, true);
    assert.equal((await roomUserRefFor("alice").get()).data().points, 40);
  }));

  results.push(await runCase("Pop Trivia finalizer records a clean no-winner reveal", async () => {
    await resetState();
    await seedRoom();
    await Promise.all([
      seedRoomUser("alice"),
      seedRoomUser("bob"),
      ref(`karaoke_songs/${ROOM_CODE}_song1`).set({
        roomCode: ROOM_CODE,
        status: "performing",
        songTitle: "Test Song",
        popTrivia: [{ id: "q1", q: "Pick B", options: ["A", "B"], correct: 1 }],
      }),
      db.collection(`${ROOT}/reactions`).add({ roomCode: ROOM_CODE, type: "vote_popup_trivia", questionId: "q1", uid: "alice", userName: "Alice", avatar: "A", val: 0, timestamp: admin.firestore.FieldValue.serverTimestamp() }),
      db.collection(`${ROOT}/reactions`).add({ roomCode: ROOM_CODE, type: "vote_popup_trivia", questionId: "q1", uid: "bob", userName: "Bob", avatar: "B", val: 0, timestamp: admin.firestore.FieldValue.serverTimestamp() }),
    ]);

    const result = await finalizePopTriviaQuestion.run(requestFor(null, { roomCode: ROOM_CODE, questionId: "q1" }));
    assert.equal(result.ok, true);
    assert.equal(result.finalized, true);
    assert.equal(result.awardedCount, 0);
    assert.equal(result.awardedPoints, 0);
    assert.equal(result.correctIndex, 1);
    assert.equal(result.correctOption, "B");
    assert.deepEqual(result.winners, []);
    assert.equal((await roomUserRefFor("alice").get()).data().points, 0);
    assert.equal((await roomUserRefFor("bob").get()).data().points, 0);
    const roomAfterAward = (await roomRef.get()).data();
    assert.equal(roomAfterAward.popTriviaAwards.q1.correctOption, "B");
    assert.equal(roomAfterAward.popTriviaAwards.q1.awardedCount, 0);
    assert.equal(roomAfterAward.popTriviaAwards.q1.awardedPoints, 0);
    assert.deepEqual(roomAfterAward.popTriviaAwards.q1.winners, []);
  }));
  results.push(await runCase("Guitar Sync finalizer awards the top hitter", async () => {
    await resetState();
    await seedRoom({ lightMode: "karaoke", guitarSessionId: "g1" });
    await Promise.all([
      seedRoomUser("alice", { guitarSessionId: "g1", guitarHits: 7 }),
      seedRoomUser("bob", { guitarSessionId: "g1", guitarHits: 11 }),
      seedRoomUser("cara", { guitarSessionId: "old", guitarHits: 99 }),
    ]);

    const result = await finalizeGuitarSyncRound.run(requestFor(null, { roomCode: ROOM_CODE, sessionId: "g1" }));
    assert.equal(result.ok, true);
    assert.equal(result.winner.uid, "bob");
    assert.equal((await roomUserRefFor("bob").get()).data().points, 200);
    assert.equal((await roomUserRefFor("alice").get()).data().points, 0);
    const room = (await roomRef.get()).data();
    assert.equal(room.guitarWinner.uid, "bob");
    assert.equal(room.guitarVictory.status, "pending");
    assert.equal(room.guitarVictory.awardedBy, "server");
  }));

  results.push(await runCase("Strobe finalizer awards the top three tappers", async () => {
    await resetState();
    await seedRoom({ lightMode: "karaoke", strobeSessionId: "s1", strobeEndsAt: Date.now() - 1000 });
    await Promise.all([
      seedRoomUser("alice", { strobeSessionId: "s1", strobeTaps: 9 }),
      seedRoomUser("bob", { strobeSessionId: "s1", strobeTaps: 17 }),
      seedRoomUser("cara", { strobeSessionId: "s1", strobeTaps: 12 }),
      seedRoomUser("drew", { strobeSessionId: "s1", strobeTaps: 2 }),
    ]);

    const result = await finalizeStrobeModeRound.run(requestFor(null, { roomCode: ROOM_CODE, sessionId: "s1" }));
    assert.equal(result.ok, true);
    assert.deepEqual(result.winners.map((entry) => entry.uid), ["bob", "cara", "alice"]);
    assert.equal((await roomUserRefFor("bob").get()).data().points, 150);
    assert.equal((await roomUserRefFor("cara").get()).data().points, 90);
    assert.equal((await roomUserRefFor("alice").get()).data().points, 50);
    assert.equal((await roomUserRefFor("drew").get()).data().points, 0);
    const room = (await roomRef.get()).data();
    assert.equal(room.strobeResults.awardedBy, "server");
    assert.equal(room.strobeVictory.status, "pending");
  }));

  results.push(await runCase("Volley Orb finalizer awards recent lobby players once without host auth", async () => {
    await resetState();
    await seedRoom({ lightMode: "volley", lobbyVolleyEnabled: true });
    await Promise.all([
      seedRoomUser("alice"),
      seedRoomUser("bob"),
      seedRoomUser("cara"),
    ]);
    const now = Date.now();
    await Promise.all([
      db.collection(`${ROOT}/reactions`).add({ roomCode: ROOM_CODE, type: "lobby_play_wave", uid: "alice", userName: "Alice", timestamp: admin.firestore.Timestamp.fromMillis(now - 4200) }),
      db.collection(`${ROOT}/reactions`).add({ roomCode: ROOM_CODE, type: "lobby_play_laser", uid: "bob", userName: "Bob", timestamp: admin.firestore.Timestamp.fromMillis(now - 3200) }),
      db.collection(`${ROOT}/reactions`).add({ roomCode: ROOM_CODE, type: "lobby_play_echo", uid: "cara", userName: "Cara", timestamp: admin.firestore.Timestamp.fromMillis(now - 2200) }),
      db.collection(`${ROOT}/reactions`).add({ roomCode: ROOM_CODE, type: "lobby_play_confetti", uid: "alice", userName: "Alice", timestamp: admin.firestore.Timestamp.fromMillis(now - 1200) }),
    ]);

    const result = await finalizeLobbyPlaygroundAward.run(requestFor(null, { roomCode: ROOM_CODE, awardKey: "lobby_playground_0_tier_1" }));
    assert.equal(result.ok, true);
    assert.equal(result.finalized, true);
    assert.equal(result.awardedCount, 3);
    assert.ok(result.awardedPoints > 0);
    assert.ok((await roomUserRefFor("alice").get()).data().points > 0);
    assert.ok((await roomUserRefFor("bob").get()).data().points > 0);
    assert.ok((await roomUserRefFor("cara").get()).data().points > 0);

    const aliceAfterFirst = (await roomUserRefFor("alice").get()).data().points;
    const duplicate = await finalizeLobbyPlaygroundAward.run(requestFor(null, { roomCode: ROOM_CODE, awardKey: "lobby_playground_0_tier_1" }));
    assert.equal(duplicate.duplicate, true);
    assert.equal((await roomUserRefFor("alice").get()).data().points, aliceAfterFirst);
  }));

  results.push(await runCase("Volley Orb altitude finalizer uses server-side recent reaction evidence", async () => {
    await resetState();
    await seedRoom({ lightMode: "volley", lobbyVolleyEnabled: true });
    await Promise.all([
      seedRoomUser("alice"),
      seedRoomUser("bob"),
    ]);
    const now = Date.now();
    await Promise.all([
      db.collection(`${ROOT}/reactions`).add({ roomCode: ROOM_CODE, type: "lobby_play_wave", uid: "alice", userName: "Alice", timestamp: admin.firestore.Timestamp.fromMillis(now - 5000) }),
      db.collection(`${ROOT}/reactions`).add({ roomCode: ROOM_CODE, type: "lobby_play_laser", uid: "bob", userName: "Bob", timestamp: admin.firestore.Timestamp.fromMillis(now - 4000) }),
      db.collection(`${ROOT}/reactions`).add({ roomCode: ROOM_CODE, type: "lobby_play_echo", uid: "alice", userName: "Alice", timestamp: admin.firestore.Timestamp.fromMillis(now - 3000) }),
      db.collection(`${ROOT}/reactions`).add({ roomCode: ROOM_CODE, type: "lobby_play_confetti", uid: "bob", userName: "Bob", timestamp: admin.firestore.Timestamp.fromMillis(now - 2000) }),
    ]);

    const result = await finalizeLobbyPlaygroundAward.run(requestFor(null, { roomCode: ROOM_CODE, awardKey: "lobby_altitude_0_inflated" }));
    assert.equal(result.ok, true);
    assert.equal(result.finalized, true);
    assert.equal(result.awardedCount, 2);
    assert.ok(result.serverEstimatedPeakAltitudeFt >= 24);
    assert.ok((await roomUserRefFor("alice").get()).data().points > 0);
    assert.ok((await roomUserRefFor("bob").get()).data().points > 0);
  }));

  const failed = results.filter((ok) => !ok).length;
  await resetState();
  if (failed) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});



