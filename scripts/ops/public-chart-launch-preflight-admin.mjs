#!/usr/bin/env node
import process from "node:process";
import { createRequire } from "node:module";
import { loadEnv } from "vite";

const PROJECT_ID = "beaurocks-karaoke-v2";
const PAGE_SIZE = 500;
const ROOT_PATH = "artifacts/bross-app/public/data";
const DEFAULT_SUPER_ADMIN_EMAILS = ["hello@beauross.com", "hello@beaurocks.app"];

const env = loadEnv("production", process.cwd(), "");
if (!process.env.GOOGLE_APPLICATION_CREDENTIALS && env.GOOGLE_APPLICATION_CREDENTIALS) {
  process.env.GOOGLE_APPLICATION_CREDENTIALS = env.GOOGLE_APPLICATION_CREDENTIALS;
}
if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  throw new Error("GOOGLE_APPLICATION_CREDENTIALS is required for the operator preflight.");
}
if (!process.env.GOOGLE_CLOUD_QUOTA_PROJECT) {
  process.env.GOOGLE_CLOUD_QUOTA_PROJECT = PROJECT_ID;
}

const require = createRequire(import.meta.url);
const admin = require("../../functions/node_modules/firebase-admin");
const { getPlanDefinition, isEntitledStatus } = require("../../functions/lib/entitlementsUsage");
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: PROJECT_ID,
  });
}
const db = admin.firestore();
const rootRef = db.doc(ROOT_PATH);
const normalizeUid = (value = "") => String(value || "").trim().replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 180);
const toMillis = (value) => {
  if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, value);
  if (value && typeof value.toMillis === "function") return Math.max(0, value.toMillis());
  return 0;
};
const readCollection = async (collectionRef) => {
  const docs = [];
  let cursor = null;
  do {
    let query = collectionRef.orderBy(admin.firestore.FieldPath.documentId()).limit(PAGE_SIZE);
    if (cursor) query = query.startAfter(cursor);
    const snap = await query.get();
    docs.push(...snap.docs);
    cursor = snap.docs.at(-1) || null;
    if (snap.size < PAGE_SIZE) break;
  } while (cursor);
  return docs;
};
const isRoomOpen = (room = {}) => {
  const archived = room.archived === true || String(room.archivedStatus || "").trim().toLowerCase() === "archived";
  const closedAtMs = toMillis(room.closedAt) || Math.max(0, Number(room.closedAtMs || room.closedAt || 0) || 0);
  return !archived && closedAtMs <= 0;
};
const roomActivityAtMs = (room = {}) => Math.max(
  toMillis(room.updatedAt),
  Math.max(0, Number(room.updatedAtMs || 0) || 0),
  toMillis(room.lastPerformance?.timestamp),
  Math.max(0, Number(room.currentPerformanceSession?.lastHeartbeatAtMs || 0) || 0),
  toMillis(room.createdAt),
  Math.max(0, Number(room.createdAtMs || 0) || 0)
);
const isPublicRoom = (room = {}) => room.publicRoom === true
  || room.discover?.publicRoom === true
  || String(room.discover?.visibility || "").trim().toLowerCase() === "public";
const superAdminEmails = new Set(
  String(process.env.SUPER_ADMIN_EMAILS || env.SUPER_ADMIN_EMAILS || DEFAULT_SUPER_ADMIN_EMAILS.join(","))
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)
);
const buildInviteId = (email = "") =>
  "wl_" + (email.replace(/[^a-z0-9]/g, "_").replace(/_+/g, "_").slice(0, 140) || "unknown");
const resolveReadOnlyHostAccess = async (uid) => {
  let userRecord = null;
  let authLookupStatus = "found";
  let authLookupErrorCode = "";
  let authLookupErrorMessage = "";
  try {
    userRecord = await admin.auth().getUser(uid);
  } catch (error) {
    authLookupErrorCode = String(error?.code || "unknown");
    authLookupErrorMessage = String(error?.message || "").slice(0, 300);
    authLookupStatus = authLookupErrorCode.includes("user-not-found") ? "not_found" : "error";
  }
  const email = String(userRecord?.email || "").trim().toLowerCase();
  const isSuperAdmin = userRecord?.emailVerified === true && superAdminEmails.has(email);
  const inviteId = email ? buildInviteId(email) : "";
  const userRef = db.collection("users").doc(uid);
  const reads = [
    db.collection("host_access_approvals").doc(uid).get(),
    db.collection("marketing_private_access").doc(uid).get(),
    userRef.get(),
  ];
  if (inviteId) {
    reads.push(
      db.collection("host_access_approval_invites").doc(inviteId).get(),
      db.collection("marketing_private_invites").doc(inviteId).get()
    );
  }
  const [approvalSnap, legacySnap, userSnap, inviteSnap = null, legacyInviteSnap = null] = await Promise.all(reads);
  const approved = approvalSnap.get("hostApprovalEnabled") === true
    || legacySnap.get("privateHostAccessEnabled") === true
    || inviteSnap?.get("hostApprovalEnabled") === true
    || legacyInviteSnap?.get("privateHostAccessEnabled") === true;
  const claimedOrgId = String(userSnap.get("organization.orgId") || "").trim().replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80);
  const ownerOrgId = "org_" + (normalizeUid(uid).slice(0, 80) || "owner");
  let orgId = ownerOrgId;
  if (claimedOrgId && claimedOrgId !== ownerOrgId) {
    const memberSnap = await db.collection("organizations").doc(claimedOrgId).collection("members").doc(uid).get();
    if (memberSnap.exists) orgId = claimedOrgId;
  }
  const orgRef = db.collection("organizations").doc(orgId);
  const [entitlementSnap, subscriptionSnap] = await Promise.all([
    orgRef.collection("entitlements").doc("current").get(),
    orgRef.collection("subscription").doc("current").get(),
  ]);
  const planId = String(entitlementSnap.get("planId") || subscriptionSnap.get("planId") || "free").trim() || "free";
  const status = String(entitlementSnap.get("status") || subscriptionSnap.get("status") || "inactive").trim() || "inactive";
  const capabilities = entitlementSnap.get("capabilities") || {};
  const entitled = (
    getPlanDefinition(planId)?.tier === "host" && isEntitledStatus(status)
  ) || capabilities["api.youtube_data"] === true
    || capabilities["api.apple_music"] === true
    || capabilities["ai.generate_content"] === true;
  return {
    uid,
    eligible: isSuperAdmin || approved || entitled,
    reason: isSuperAdmin ? "super_admin" : approved ? "approved_access" : entitled ? "host_entitlement" : "none",
    authUserExists: authLookupStatus === "found",
    authLookupStatus,
    authLookupErrorCode,
    authLookupErrorMessage,
    emailVerified: userRecord?.emailVerified === true,
    configuredSuperAdminEmail: superAdminEmails.has(email),
  };
};

const [roomDocs, approvalDocs] = await Promise.all([
  readCollection(rootRef.collection("rooms")),
  readCollection(db.collection("host_access_approvals")),
]);
const activeRooms = roomDocs.filter((docSnap) => isRoomOpen(docSnap.data() || {}));
const nowMs = Date.now();
const recentActiveRooms = activeRooms.filter((docSnap) => roomActivityAtMs(docSnap.data() || {}) >= nowMs - (30 * 24 * 60 * 60 * 1000));
const publicActiveRooms = activeRooms.filter((docSnap) => isPublicRoom(docSnap.data() || {}));
const collectHostUids = (roomDocs) => {
  const hostUids = new Set();
  roomDocs.forEach((docSnap) => {
    const room = docSnap.data() || {};
    [room.hostUid, ...(Array.isArray(room.hostUids) ? room.hostUids : [])]
      .map(normalizeUid)
      .filter(Boolean)
      .forEach((uid) => hostUids.add(uid));
  });
  return hostUids;
};
const activeHostUids = collectHostUids(activeRooms);
const recentActiveHostUids = collectHostUids(recentActiveRooms);
const publicActiveHostUids = collectHostUids(publicActiveRooms);
const approvedHostUids = new Set(
    approvalDocs
    .filter((docSnap) => docSnap.get("hostApprovalEnabled") === true)
    .map((docSnap) => normalizeUid(docSnap.id || docSnap.get("uid") || ""))
    .filter(Boolean)
);
const scopedHostUids = new Set([...recentActiveHostUids, ...publicActiveHostUids]);
const scopedAccess = await Promise.all(Array.from(scopedHostUids).map(resolveReadOnlyHostAccess));
const accessByUid = new Map(scopedAccess.map((entry) => [entry.uid, entry]));
const ineligibleRecentHostUids = Array.from(recentActiveHostUids)
  .filter((uid) => accessByUid.get(uid)?.authUserExists === true && accessByUid.get(uid)?.eligible !== true)
  .sort();
const orphanedRecentHostUids = Array.from(recentActiveHostUids)
  .filter((uid) => accessByUid.get(uid)?.authLookupStatus === "not_found")
  .sort();
const indeterminateRecentHostUids = Array.from(recentActiveHostUids)
  .filter((uid) => accessByUid.get(uid)?.authLookupStatus === "error" && accessByUid.get(uid)?.eligible !== true)
  .sort();
const ineligiblePublicHostUids = Array.from(publicActiveHostUids)
  .filter((uid) => accessByUid.get(uid)?.eligible !== true)
  .sort();
const accessReasonCounts = scopedAccess.reduce((counts, entry) => {
  counts[entry.reason] = (counts[entry.reason] || 0) + 1;
  return counts;
}, {});
const buildHostScopeDetails = (uids, roomDocs) => uids.map((uid) => {
  const ownedRooms = roomDocs.filter((docSnap) => {
    const room = docSnap.data() || {};
    return [room.hostUid, ...(Array.isArray(room.hostUids) ? room.hostUids : [])]
      .map(normalizeUid)
      .includes(uid);
  });
  const access = accessByUid.get(uid) || {};
  return {
    uid,
    roomCount: ownedRooms.length,
    latestActivityAtMs: ownedRooms.reduce(
      (latest, docSnap) => Math.max(latest, roomActivityAtMs(docSnap.data() || {})),
      0
    ),
    authUserExists: access.authUserExists === true,
    authLookupStatus: access.authLookupStatus || "unknown",
    authLookupErrorCode: access.authLookupErrorCode || "",
    authLookupErrorMessage: access.authLookupErrorMessage || "",
    emailVerified: access.emailVerified === true,
    configuredSuperAdminEmail: access.configuredSuperAdminEmail === true,
  };
});
const result = {
  ok: true,
  source: "operator_admin_read_only",
  chartEra: "launch_v1",
  canLaunch: ineligibleRecentHostUids.length === 0 && indeterminateRecentHostUids.length === 0,
  gateScope: "rooms_with_activity_in_last_30_days",
  scannedRoomCount: roomDocs.length,
  openLifecycleRoomCount: activeRooms.length,
  recentActiveRoomCount30d: recentActiveRooms.length,
  publicMarkedRoomCount: publicActiveRooms.length,
  openLifecycleHostCount: activeHostUids.size,
  directlyApprovedOpenLifecycleHostCount: Array.from(activeHostUids).filter((uid) => approvedHostUids.has(uid)).length,
  recentActiveHostCount30d: recentActiveHostUids.size,
  ineligibleRecentHostCount30d: ineligibleRecentHostUids.length,
  ineligibleRecentHostUids30d: ineligibleRecentHostUids,
  ineligibleRecentHostDetails30d: buildHostScopeDetails(ineligibleRecentHostUids, recentActiveRooms),
  orphanedRecentHostCount30d: orphanedRecentHostUids.length,
  orphanedRecentHostUids30d: orphanedRecentHostUids,
  indeterminateRecentHostCount30d: indeterminateRecentHostUids.length,
  indeterminateRecentHostDetails30d: buildHostScopeDetails(indeterminateRecentHostUids, recentActiveRooms),
  publicMarkedHostCount: publicActiveHostUids.size,
  ineligiblePublicMarkedHostCount: ineligiblePublicHostUids.length,
  ineligiblePublicMarkedHostUids: ineligiblePublicHostUids,
  scopedAccessReasonCounts: accessReasonCounts,
};
console.log(JSON.stringify(result, null, 2));
if (!result.canLaunch) process.exitCode = 2;
