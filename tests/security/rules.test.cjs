const fs = require("node:fs/promises");
const {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} = require("@firebase/rules-unit-testing");

const PROJECT_ID = "demo-bross";
const APP_ID = "bross-app";
const ROOT = `artifacts/${APP_ID}/public/data`;
const ROOM_CODE = "ROOM1";
const HOST_UID = "host-uid";
const GUEST_UID = "guest-uid";
const OTHER_UID = "other-uid";
const BUCKET = `gs://${PROJECT_ID}.firebasestorage.app`;

let testEnv;

const roomPath = (roomCode = ROOM_CODE) => `${ROOT}/rooms/${roomCode}`;
const roomUserPath = (roomCode, uid) => `${ROOT}/room_users/${roomCode}_${uid}`;

async function resetState() {
  await testEnv.clearFirestore();
  await testEnv.clearStorage();
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await db.doc(roomPath()).set({
      hostUid: HOST_UID,
      hostUids: [HOST_UID],
      activeMode: "karaoke",
    });
  });
}

async function runCase(name, fn) {
  await resetState();
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
  const firestoreRules = await fs.readFile("firestore.rules", "utf8");
  const storageRules = await fs.readFile("storage.rules", "utf8");

  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: firestoreRules },
    storage: { rules: storageRules },
  });

  const checks = [
    ["firestore: unauthenticated cannot read user profile", async () => {
      const db = testEnv.unauthenticatedContext().firestore();
      await assertFails(db.doc(`users/${GUEST_UID}`).get());
    }],

    ["firestore: public can read canonical song lyrics", async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await db.doc("song_lyrics/test-song").set({
          songId: "test-song",
          lyrics: "line one\nline two",
        });
      });
      const db = testEnv.unauthenticatedContext().firestore();
      await assertSucceeds(db.doc("song_lyrics/test-song").get());
    }],

    ["firestore: clients cannot write canonical song lyrics", async () => {
      const db = testEnv.authenticatedContext(HOST_UID).firestore();
      await assertFails(
        db.doc("song_lyrics/test-song").set({
          songId: "test-song",
          lyrics: "forbidden write",
        })
      );
    }],

    ["firestore: user can write own profile", async () => {
      const db = testEnv.authenticatedContext(GUEST_UID).firestore();
      await assertSucceeds(
        db.doc(`users/${GUEST_UID}`).set({
          name: "Guest",
          vipLevel: 1,
        })
      );
    }],

    ["firestore: user cannot write another user profile", async () => {
      const db = testEnv.authenticatedContext(GUEST_UID).firestore();
      await assertFails(
        db.doc(`users/${OTHER_UID}`).set({
          name: "Nope",
        })
      );
    }],

    ["firestore: unauthenticated cannot create room", async () => {
      const db = testEnv.unauthenticatedContext().firestore();
      await assertFails(
        db.doc(roomPath("UNAUTH")).set({
          hostUid: "x",
          hostUids: ["x"],
        })
      );
    }],

    ["firestore: host can create room", async () => {
      const db = testEnv.authenticatedContext(HOST_UID).firestore();
      await assertSucceeds(
        db.doc(roomPath("NEW01")).set({
          hostUid: HOST_UID,
          hostUids: [HOST_UID],
        })
      );
    }],

    ["firestore: non-host can update whitelisted room key", async () => {
      const db = testEnv.authenticatedContext(GUEST_UID).firestore();
      await assertSucceeds(db.doc(roomPath()).update({ activeMode: "bingo" }));
    }],

    ["firestore: non-host cannot update non-whitelisted room key", async () => {
      const db = testEnv.authenticatedContext(GUEST_UID).firestore();
      await assertFails(db.doc(roomPath()).update({ tipPointRate: 999 }));
    }],

    ["firestore: room user id must match roomCode_uid", async () => {
      const db = testEnv.authenticatedContext(GUEST_UID).firestore();
      await assertFails(
        db.doc(`${ROOT}/room_users/${ROOM_CODE}_WRONG`).set({
          roomCode: ROOM_CODE,
          uid: GUEST_UID,
          name: "Guest",
        })
      );
    }],

    ["firestore: user can create own room_user doc", async () => {
      const db = testEnv.authenticatedContext(GUEST_UID).firestore();
      await assertSucceeds(
        db.doc(roomUserPath(ROOM_CODE, GUEST_UID)).set({
          roomCode: ROOM_CODE,
          uid: GUEST_UID,
          name: "Guest",
        })
      );
    }],

    ["firestore: host can delete another user in room", async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await db.doc(roomUserPath(ROOM_CODE, GUEST_UID)).set({
          roomCode: ROOM_CODE,
          uid: GUEST_UID,
          name: "Guest",
        });
      });
      const db = testEnv.authenticatedContext(HOST_UID).firestore();
      await assertSucceeds(db.doc(roomUserPath(ROOM_CODE, GUEST_UID)).delete());
    }],

    ["storage: host can upload allowed audio/video", async () => {
      const storage = testEnv.authenticatedContext(HOST_UID).storage(BUCKET);
      const ref = storage.ref(`room_uploads/${ROOM_CODE}/clip.mp3`);
      await assertSucceeds(
        ref.putString("abc", "raw", { contentType: "audio/mpeg" })
      );
    }],

    ["storage: host can upload branding image", async () => {
      const storage = testEnv.authenticatedContext(HOST_UID).storage(BUCKET);
      const ref = storage.ref(`room_branding/${ROOM_CODE}/logo.png`);
      await assertSucceeds(
        ref.putString("abc", "raw", { contentType: "image/png" })
      );
    }],

    ["storage: non-host cannot upload branding image", async () => {
      const storage = testEnv.authenticatedContext(OTHER_UID).storage(BUCKET);
      const ref = storage.ref(`room_branding/${ROOM_CODE}/logo.png`);
      await assertFails(
        ref.putString("abc", "raw", { contentType: "image/png" })
      );
    }],

    ["storage: non-host cannot upload room media", async () => {
      const storage = testEnv.authenticatedContext(OTHER_UID).storage(BUCKET);
      const ref = storage.ref(`room_uploads/${ROOM_CODE}/intrude.mp4`);
      await assertFails(
        ref.putString("abc", "raw", { contentType: "video/mp4" })
      );
    }],

    ["storage: host cannot upload non-media content types", async () => {
      const storage = testEnv.authenticatedContext(HOST_UID).storage(BUCKET);
      const ref = storage.ref(`room_uploads/${ROOM_CODE}/bad.png`);
      await assertFails(
        ref.putString("abc", "raw", { contentType: "image/png" })
      );
    }],

    ["storage: only host can read uploaded room media", async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const storage = context.storage(BUCKET);
        const ref = storage.ref(`room_uploads/${ROOM_CODE}/private.mp4`);
        await ref.putString("abc", "raw", { contentType: "video/mp4" });
      });
      const hostStorage = testEnv.authenticatedContext(HOST_UID).storage(BUCKET);
      const guestStorage = testEnv.authenticatedContext(GUEST_UID).storage(BUCKET);
      const hostRef = hostStorage.ref(`room_uploads/${ROOM_CODE}/private.mp4`);
      const guestRef = guestStorage.ref(`room_uploads/${ROOM_CODE}/private.mp4`);
      await assertSucceeds(hostRef.getDownloadURL());
      await assertFails(guestRef.getDownloadURL());
    }],
  ];

  const results = [];
  for (const [name, fn] of checks) {
    // Execute each case in isolation so state doesn't bleed across checks.
    results.push(await runCase(name, fn));
  }
  await testEnv.cleanup();

  const failed = results.filter((ok) => !ok).length;
  if (failed > 0) {
    console.error(`\n${failed} rules check(s) failed.`);
    process.exit(1);
  }
  console.log(`\nAll ${results.length} rules checks passed.`);
}

run().catch(async (err) => {
  console.error("Rules test run failed.");
  console.error(err);
  if (testEnv) {
    await testEnv.cleanup();
  }
  process.exit(1);
});
