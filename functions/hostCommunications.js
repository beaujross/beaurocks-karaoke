"use strict";

const ANNOUNCEMENTS = "host_announcements";
const SUPPORT_THREADS = "host_support_threads";
const ANNOUNCEMENT_CATEGORIES = new Set(["product_update", "known_issue", "maintenance", "testing_request"]);
const ANNOUNCEMENT_STATUSES = new Set(["draft", "published", "archived"]);
const SUPPORT_CATEGORIES = new Set(["access", "onboarding", "billing", "bug", "feature_request", "other"]);
const SUPPORT_STATUSES = new Set(["open", "waiting_on_team", "waiting_on_host", "resolved"]);

const text = (value, max = 1000) => String(value || "").trim().slice(0, max);
const token = (value, max = 80) => text(value, max).toLowerCase().replace(/[^a-z0-9_-]/g, "_").replace(/^_+|_+$/g, "");
const choice = (value, allowed, fallback = "") => {
  const normalized = token(value);
  return allowed.has(normalized) ? normalized : fallback;
};
const millis = (value) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (value && typeof value.toMillis === "function") return value.toMillis();
  if (value && Number.isFinite(Number(value._seconds))) return Number(value._seconds) * 1000;
  return 0;
};

const sanitizeSupportContext = (value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const source = token(value.source, 80);
  if (source !== "host_panel_feedback") return null;
  const count = Number(value.queueCount);
  const capturedAtMs = Number(value.capturedAtMs);
  const context = {
    source,
    roomCode: text(value.roomCode, 24).toUpperCase(),
    roomName: text(value.roomName, 120),
    workspaceView: token(value.workspaceView, 80),
    workspaceSection: token(value.workspaceSection, 120),
    tab: token(value.tab, 80),
    activeMode: token(value.activeMode, 80),
    queueCount: Number.isFinite(count) ? Math.max(0, Math.min(9999, Math.round(count))) : 0,
    performanceTitle: text(value.performanceTitle, 180),
    performanceArtist: text(value.performanceArtist, 180),
    pathname: text(value.pathname, 240).split(/[?#]/, 1)[0].replace(/[^A-Za-z0-9_./-]/g, ""),
    capturedAtMs: Number.isFinite(capturedAtMs) ? Math.max(0, Math.round(capturedAtMs)) : 0,
  };
  return Object.fromEntries(Object.entries(context).filter(([, entry]) => entry !== ""));
};

const serializeAnnouncement = (snap) => {
  const data = snap?.data?.() || {};
  return {
    announcementId: snap?.id || "",
    title: text(data.title, 180),
    body: text(data.body, 12000),
    category: choice(data.category, ANNOUNCEMENT_CATEGORIES, "product_update"),
    status: choice(data.status, ANNOUNCEMENT_STATUSES, "draft"),
    pinned: data.pinned === true,
    commentsEnabled: data.commentsEnabled !== false,
    publishedAtMs: millis(data.publishedAt),
    createdAtMs: millis(data.createdAt),
    updatedAtMs: millis(data.updatedAt),
    publishedByName: text(data.publishedByName, 120) || "BeauRocks Team",
    commentCount: Math.max(0, Number(data.commentCount || 0) || 0),
  };
};

const serializeComment = (snap) => {
  const data = snap?.data?.() || {};
  return {
    commentId: snap?.id || "",
    announcementId: text(data.announcementId, 180),
    body: text(data.body, 3000),
    authorName: text(data.authorName, 120) || "Host",
    authorRole: data.authorRole === "team" ? "team" : "host",
    hidden: data.hidden === true,
    createdAtMs: millis(data.createdAt),
    updatedAtMs: millis(data.updatedAt),
  };
};

const serializeThread = (snap) => {
  const data = snap?.data?.() || {};
  return {
    threadId: snap?.id || "",
    ownerUid: text(data.ownerUid, 180),
    ownerEmail: text(data.ownerEmail, 320).toLowerCase(),
    ownerName: text(data.ownerName, 120) || "Host",
    title: text(data.title, 180) || "Support request",
    category: choice(data.category, SUPPORT_CATEGORIES, "other"),
    status: choice(data.status, SUPPORT_STATUSES, "open"),
    lastMessagePreview: text(data.lastMessagePreview, 240),
    lastMessageByRole: data.lastMessageByRole === "team" ? "team" : "host",
    messageCount: Math.max(0, Number(data.messageCount || 0) || 0),
    createdAtMs: millis(data.createdAt),
    updatedAtMs: millis(data.updatedAt),
    context: sanitizeSupportContext(data.context),
  };
};

const serializeMessage = (snap) => {
  const data = snap?.data?.() || {};
  return {
    messageId: snap?.id || "",
    threadId: text(data.threadId, 180),
    body: text(data.body, 6000),
    authorName: text(data.authorName, 120) || "Host",
    authorRole: data.authorRole === "team" ? "team" : "host",
    createdAtMs: millis(data.createdAt),
  };
};

const createHostCommunicationCallables = ({
  admin, onCall, HttpsError, requireAuth, getDirectoryModeratorAccess,
  resolveHostWorkspaceAccess, checkRateLimit, checkDurableRateLimit,
  enforceAppCheckIfEnabled, requireAppCheck,
}) => {
  const db = admin.firestore();
  const now = () => admin.firestore.Timestamp.now();
  const documentId = (value, label = "Document") => {
    const normalized = text(value, 180);
    if (!/^[A-Za-z0-9_-]{1,180}$/.test(normalized)) {
      throw new HttpsError("invalid-argument", `${label} is invalid.`);
    }
    return normalized;
  };
  const preflight = (request, id, limits = { perMinute: 60, perHour: 600 }, strictAppCheck = false) => {
    const uid = requireAuth(request, "Sign in required.");
    if (strictAppCheck) requireAppCheck(request, id);
    else enforceAppCheckIfEnabled(request, id);
    checkRateLimit(request.rawRequest, id, limits);
    return uid;
  };
  const guard = async (request, { adminOnly = false, uid = "" } = {}) => {
    const actorUid = uid || requireAuth(request, "Sign in required.");
    const email = text(request.auth?.token?.email, 320).toLowerCase();
    const moderator = await getDirectoryModeratorAccess(actorUid);
    const isSuperAdmin = moderator?.mode === "super_admin";
    if (adminOnly && !isSuperAdmin) throw new HttpsError("permission-denied", "Super admin access required.");
    if (!isSuperAdmin) {
      const host = await resolveHostWorkspaceAccess(actorUid, email);
      if (host?.hostApprovalEnabled !== true) {
        throw new HttpsError("permission-denied", "Active Host invitation required.");
      }
    }
    const fallbackName = email.split("@")[0] || (isSuperAdmin ? "BeauRocks Team" : "Host");
    return {
      uid: actorUid, email, isAdmin: isSuperAdmin,
      name: text(request.auth?.token?.name || request.auth?.token?.displayName || fallbackName, 120) || fallbackName,
    };
  };
  const durable = async (request, id, limits, uid) => {
    await checkDurableRateLimit(request.rawRequest, id, limits, uid);
  };
  const loadThread = async (threadId, access) => {
    const safeThreadId = documentId(threadId, "Conversation");
    const ref = db.collection(SUPPORT_THREADS).doc(safeThreadId);
    const snap = await ref.get();
    if (!snap.exists) throw new HttpsError("not-found", "Support conversation not found.");
    const thread = serializeThread(snap);
    if (!access.isAdmin && thread.ownerUid !== access.uid) {
      throw new HttpsError("permission-denied", "This support conversation is private.");
    }
    return { ref, thread };
  };

  return {
    listHostAnnouncements: onCall({ cors: true }, async (request) => {
      const uid = preflight(request, "list_host_announcements");
      const access = await guard(request, { uid });
      const includeDrafts = access.isAdmin && request.data?.includeDrafts === true;
      const maxItems = Math.max(1, Math.min(100, Number(request.data?.limit || 50) || 50));
      const snap = await db.collection(ANNOUNCEMENTS).orderBy("updatedAt", "desc").limit(150).get();
      const items = snap.docs.map(serializeAnnouncement)
        .filter((item) => includeDrafts || item.status === "published")
        .sort((left, right) => left.pinned !== right.pinned
          ? (left.pinned ? -1 : 1)
          : (right.publishedAtMs || right.updatedAtMs) - (left.publishedAtMs || left.updatedAtMs))
        .slice(0, maxItems);
      return { ok: true, items, isAdmin: access.isAdmin };
    }),

    upsertHostAnnouncement: onCall({ cors: true }, async (request) => {
      const limits = { perMinute: 20, perHour: 120 };
      const uid = preflight(request, "upsert_host_announcement", limits, true);
      const access = await guard(request, { adminOnly: true, uid });
      await durable(request, "upsert_host_announcement", limits, uid);
      const payload = request.data && typeof request.data === "object" ? request.data : {};
      const title = text(payload.title, 180);
      const body = text(payload.body, 12000);
      if (!title || !body) throw new HttpsError("invalid-argument", "Title and message are required.");
      const requestedId = payload.announcementId ? documentId(payload.announcementId, "Update") : "";
      const ref = requestedId ? db.collection(ANNOUNCEMENTS).doc(requestedId) : db.collection(ANNOUNCEMENTS).doc();
      const existing = await ref.get();
      const current = existing.data() || {};
      const timestamp = now();
      const status = choice(payload.status, ANNOUNCEMENT_STATUSES, "draft");
      await ref.set({
        title, body,
        category: choice(payload.category, ANNOUNCEMENT_CATEGORIES, "product_update"),
        status,
        pinned: payload.pinned === true,
        commentsEnabled: payload.commentsEnabled !== false,
        createdAt: current.createdAt || timestamp,
        createdByUid: current.createdByUid || access.uid,
        updatedAt: timestamp,
        updatedByUid: access.uid,
        publishedAt: status === "published"
          ? (current.status === "published" && current.publishedAt ? current.publishedAt : timestamp)
          : null,
        publishedByUid: status === "published" ? access.uid : (current.publishedByUid || ""),
        publishedByName: "BeauRocks Team",
      }, { merge: true });
      return { ok: true, item: serializeAnnouncement(await ref.get()) };
    }),

    listHostAnnouncementComments: onCall({ cors: true }, async (request) => {
      const uid = preflight(request, "list_host_announcement_comments", { perMinute: 80, perHour: 800 });
      const access = await guard(request, { uid });
      const announcementId = documentId(request.data?.announcementId, "Update");
      if (!announcementId) throw new HttpsError("invalid-argument", "announcementId is required.");
      const ref = db.collection(ANNOUNCEMENTS).doc(announcementId);
      const announcementSnap = await ref.get();
      if (!announcementSnap.exists) throw new HttpsError("not-found", "Update not found.");
      const announcement = serializeAnnouncement(announcementSnap);
      if (!access.isAdmin && announcement.status !== "published") throw new HttpsError("permission-denied", "Update is not published.");
      const snap = await ref.collection("comments").orderBy("createdAt", "desc").limit(200).get();
      const items = snap.docs.map(serializeComment)
        .filter((item) => access.isAdmin || !item.hidden)
        .sort((left, right) => left.createdAtMs - right.createdAtMs);
      return { ok: true, announcement, items, isAdmin: access.isAdmin };
    }),

    postHostAnnouncementComment: onCall({ cors: true }, async (request) => {
      const limits = { perMinute: 6, perHour: 30 };
      const uid = preflight(request, "post_host_announcement_comment", limits, true);
      const access = await guard(request, { uid });
      await durable(request, "post_host_announcement_comment", limits, uid);
      const announcementId = documentId(request.data?.announcementId, "Update");
      const body = text(request.data?.body, 3000);
      if (!announcementId || !body) throw new HttpsError("invalid-argument", "Update and comment are required.");
      const ref = db.collection(ANNOUNCEMENTS).doc(announcementId);
      const announcementSnap = await ref.get();
      if (!announcementSnap.exists) throw new HttpsError("not-found", "Update not found.");
      const announcement = serializeAnnouncement(announcementSnap);
      if (!access.isAdmin && (announcement.status !== "published" || !announcement.commentsEnabled)) {
        throw new HttpsError("failed-precondition", "Comments are closed for this update.");
      }
      const timestamp = now();
      const commentRef = ref.collection("comments").doc();
      const batch = db.batch();
      batch.set(commentRef, {
        announcementId, body, authorUid: access.uid,
        authorName: access.isAdmin ? "BeauRocks Team" : access.name,
        authorRole: access.isAdmin ? "team" : "host",
        hidden: false, createdAt: timestamp, updatedAt: timestamp,
      });
      batch.set(ref, { commentCount: admin.firestore.FieldValue.increment(1), updatedAt: timestamp }, { merge: true });
      await batch.commit();
      return { ok: true, item: serializeComment(await commentRef.get()) };
    }),

    moderateHostAnnouncementComment: onCall({ cors: true }, async (request) => {
      const limits = { perMinute: 30, perHour: 180 };
      const uid = preflight(request, "moderate_host_announcement_comment", limits, true);
      const access = await guard(request, { adminOnly: true, uid });
      await durable(request, "moderate_host_announcement_comment", limits, uid);
      const announcementId = documentId(request.data?.announcementId, "Update");
      const commentId = documentId(request.data?.commentId, "Comment");
      if (!announcementId || !commentId) throw new HttpsError("invalid-argument", "Announcement and comment are required.");
      const ref = db.collection(ANNOUNCEMENTS).doc(announcementId).collection("comments").doc(commentId);
      const snap = await ref.get();
      if (!snap.exists) throw new HttpsError("not-found", "Comment not found.");
      await ref.set({ hidden: request.data?.hidden !== false, moderatedByUid: access.uid, updatedAt: now() }, { merge: true });
      return { ok: true, item: serializeComment(await ref.get()) };
    }),

    listHostSupportThreads: onCall({ cors: true }, async (request) => {
      const uid = preflight(request, "list_host_support_threads");
      const access = await guard(request, { uid });
      const maxItems = Math.max(1, Math.min(100, Number(request.data?.limit || 50) || 50));
      const collection = db.collection(SUPPORT_THREADS);
      const snap = access.isAdmin
        ? await collection.orderBy("updatedAt", "desc").limit(200).get()
        : await collection.where("ownerUid", "==", access.uid).orderBy("updatedAt", "desc").limit(maxItems).get();
      const items = snap.docs.map(serializeThread)
        .filter((item) => access.isAdmin || item.ownerUid === access.uid)
        .sort((left, right) => right.updatedAtMs - left.updatedAtMs)
        .slice(0, maxItems);
      return { ok: true, items, isAdmin: access.isAdmin };
    }),

    createHostSupportThread: onCall({ cors: true }, async (request) => {
      const limits = { perMinute: 4, perHour: 20 };
      const uid = preflight(request, "create_host_support_thread", limits, true);
      const access = await guard(request, { uid });
      await durable(request, "create_host_support_thread", limits, uid);
      const title = text(request.data?.title, 180);
      const body = text(request.data?.body, 6000);
      if (!title || !body) throw new HttpsError("invalid-argument", "Subject and message are required.");
      const ref = db.collection(SUPPORT_THREADS).doc();
      const messageRef = ref.collection("messages").doc();
      const timestamp = now();
      const authorRole = access.isAdmin ? "team" : "host";
      const context = sanitizeSupportContext(request.data?.context);
      const batch = db.batch();
      batch.set(ref, {
        ownerUid: access.uid, ownerEmail: access.email, ownerName: access.name,
        title, category: choice(request.data?.category, SUPPORT_CATEGORIES, "other"),
        status: access.isAdmin ? "waiting_on_host" : "waiting_on_team",
        lastMessagePreview: text(body, 240), lastMessageByRole: authorRole,
        messageCount: 1, createdAt: timestamp, updatedAt: timestamp,
        ...(context ? { context } : {}),
      });
      batch.set(messageRef, {
        threadId: ref.id, body, authorUid: access.uid,
        authorName: access.isAdmin ? "BeauRocks Team" : access.name,
        authorRole, createdAt: timestamp,
      });
      await batch.commit();
      return { ok: true, item: serializeThread(await ref.get()) };
    }),

    getHostSupportThread: onCall({ cors: true }, async (request) => {
      const uid = preflight(request, "get_host_support_thread", { perMinute: 90, perHour: 900 });
      const access = await guard(request, { uid });
      const threadId = documentId(request.data?.threadId, "Conversation");
      if (!threadId) throw new HttpsError("invalid-argument", "threadId is required.");
      const { ref, thread } = await loadThread(threadId, access);
      const snap = await ref.collection("messages").orderBy("createdAt", "desc").limit(250).get();
      return {
        ok: true, thread,
        messages: snap.docs.map(serializeMessage).sort((left, right) => left.createdAtMs - right.createdAtMs),
        isAdmin: access.isAdmin,
      };
    }),

    postHostSupportMessage: onCall({ cors: true }, async (request) => {
      const limits = { perMinute: 10, perHour: 60 };
      const uid = preflight(request, "post_host_support_message", limits, true);
      const access = await guard(request, { uid });
      await durable(request, "post_host_support_message", limits, uid);
      const threadId = documentId(request.data?.threadId, "Conversation");
      const body = text(request.data?.body, 6000);
      if (!threadId || !body) throw new HttpsError("invalid-argument", "Conversation and message are required.");
      const { ref } = await loadThread(threadId, access);
      const timestamp = now();
      const authorRole = access.isAdmin ? "team" : "host";
      const messageRef = ref.collection("messages").doc();
      const batch = db.batch();
      batch.set(messageRef, {
        threadId, body, authorUid: access.uid,
        authorName: access.isAdmin ? "BeauRocks Team" : access.name,
        authorRole, createdAt: timestamp,
      });
      batch.set(ref, {
        status: access.isAdmin ? "waiting_on_host" : "waiting_on_team",
        lastMessagePreview: text(body, 240), lastMessageByRole: authorRole,
        messageCount: admin.firestore.FieldValue.increment(1), updatedAt: timestamp,
      }, { merge: true });
      await batch.commit();
      return { ok: true, item: serializeMessage(await messageRef.get()) };
    }),

    setHostSupportThreadStatus: onCall({ cors: true }, async (request) => {
      const limits = { perMinute: 20, perHour: 120 };
      const uid = preflight(request, "set_host_support_thread_status", limits, true);
      const access = await guard(request, { uid });
      await durable(request, "set_host_support_thread_status", limits, uid);
      const threadId = documentId(request.data?.threadId, "Conversation");
      const status = choice(request.data?.status, SUPPORT_STATUSES, "");
      if (!threadId || !status) throw new HttpsError("invalid-argument", "Conversation and valid status are required.");
      const { ref } = await loadThread(threadId, access);
      if (!access.isAdmin && !["open", "resolved"].includes(status)) {
        throw new HttpsError("permission-denied", "Hosts can only reopen or resolve their conversations.");
      }
      const timestamp = now();
      await ref.set({ status, statusUpdatedAt: timestamp, statusUpdatedByUid: access.uid, updatedAt: timestamp }, { merge: true });
      return { ok: true, item: serializeThread(await ref.get()) };
    }),
  };
};

module.exports = {
  createHostCommunicationCallables,
  serializeAnnouncement,
  serializeComment,
  serializeThread,
  sanitizeSupportContext,
  serializeMessage,
};
