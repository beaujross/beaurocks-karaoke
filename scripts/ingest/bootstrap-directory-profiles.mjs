#!/usr/bin/env node
import process from "node:process";
import admin from "firebase-admin";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const limitArgIndex = args.indexOf("--limit");
const scanLimit = limitArgIndex >= 0 ? Number(args[limitArgIndex + 1] || 400) : 400;
const limit = Number.isFinite(scanLimit) && scanLimit > 0 ? Math.min(scanLimit, 2000) : 400;

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const ROOT = "artifacts/bross-app/public/data";

const normalizeRoles = (user = {}, hostRoomCodes = []) => {
  const roles = new Set(["fan"]);
  if (hostRoomCodes.length) roles.add("host");
  if (Number(user.vipLevel || 0) > 0) roles.add("performer");
  return Array.from(roles);
};

const safe = (value = "", max = 180) => String(value || "").trim().slice(0, max);

const run = async () => {
  const userSnap = await db.collection("users").limit(limit).get();
  if (userSnap.empty) {
    console.log("No users found.");
    return;
  }
  let processed = 0;
  let queued = 0;

  for (const userDoc of userSnap.docs) {
    processed += 1;
    const uid = userDoc.id;
    const user = userDoc.data() || {};
    const roomSnap = await db
      .collection(`${ROOT}/rooms`)
      .where("hostUids", "array-contains", uid)
      .limit(50)
      .get();
    const hostRoomCodes = roomSnap.docs.map((docSnap) => docSnap.id);
    const profilePayload = {
      uid,
      displayName: safe(user.name || "", 120) || `Singer ${uid.slice(0, 6)}`,
      handle: safe(String(user.name || uid).toLowerCase().replace(/[^a-z0-9_-]/g, "_"), 40),
      bio: safe(user.profile?.bio || "", 500),
      roles: normalizeRoles(user, hostRoomCodes),
      city: safe(user.vipProfile?.location || "", 80),
      state: "",
      country: "US",
      avatarUrl: safe(user.profile?.profilePictureUrl || "", 2048),
      visibility: "public",
      vipLevel: Number(user.vipLevel || 0) || 0,
      totalFamePoints: Number(user.totalFamePoints || 0) || 0,
      fameLevel: Number(user.currentLevel || 0) || 0,
      hostRoomCodes: hostRoomCodes.slice(0, 50),
      status: "approved",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    if (dryRun) {
      if (queued < 3) {
        console.log("Preview:", JSON.stringify(profilePayload, null, 2));
      }
      queued += 1;
      continue;
    }
    await db.collection("directory_profiles").doc(uid).set(profilePayload, { merge: true });
    queued += 1;
    if (processed % 50 === 0) {
      console.log(`Processed ${processed}/${userSnap.size} users...`);
    }
  }

  if (dryRun) {
    console.log(`Dry run complete. ${queued} profiles ready for bootstrap.`);
    return;
  }
  console.log(`Bootstrap complete. ${queued} directory profile docs upserted.`);
};

run().catch((error) => {
  console.error(error?.message || error);
  process.exit(1);
});

