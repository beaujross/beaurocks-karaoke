"use strict";

const LOUNGE_MESSAGES = "room_lounge_messages";
const PRIVATE_MESSAGES = "room_private_messages";
const PRIVATE_THREADS = "room_host_threads";
const OPERATOR_SIGNALS = "room_operator_signals";
const COHOST_INVITES = "room_cohost_invites";
const RATE_LIMITS = "room_communication_limits";
const PUBLIC_TV_MESSAGES = "tv_chat_messages";

const SIGNAL_TYPES = new Set([
  "wrong_backing",
  "audio_attention",
  "guest_help",
  "next_not_ready",
  "pacing",
]);
const SIGNAL_AUDIO_AREAS = new Set(["", "track", "vocal", "mix"]);
const SIGNAL_STATUSES = new Set(["delivered", "seen", "resolved", "expired"]);
const THREAD_STATUSES = new Set(["open", "seen", "resolved"]);

const cleanText = (value, max = 300) => String(value || "").trim().slice(0, max);
const cleanUid = (value) => cleanText(value, 180).replace(/[^A-Za-z0-9:_-]/g, "");
const cleanRoomCode = (value) => cleanText(value, 24).toUpperCase().replace(/[^A-Z0-9_-]/g, "");
const cleanToken = (value, max = 80) => cleanText(value, max).toLowerCase().replace(/[^a-z0-9_-]/g, "_");
const uniqueUids = (values = []) => [...new Set((Array.isArray(values) ? values : []).map(cleanUid).filter(Boolean))].slice(0, 40);
const timestampMs = (value) => {
  if (typeof value?.toMillis === "function") return value.toMillis();
  if (Number.isFinite(Number(value?._seconds))) return Number(value._seconds) * 1000;
  if (Number.isFinite(Number(value))) return Number(value);
  return 0;
};
const stableId = (...parts) => parts.map((part) => cleanText(part, 180)).filter(Boolean).join("_").replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 520);

const createRoomCommunicationCallables = ({
  admin,
  onCall,
  HttpsError,
  requireAuth,
  checkRateLimit,
  checkDurableRateLimit,
  requireAppCheck,
  getRootRef,
  isSuperAdminUid,
}) => {
  const db = admin.firestore();
  const root = () => getRootRef();
  const now = () => admin.firestore.Timestamp.now();
  const fromMs = (value) => admin.firestore.Timestamp.fromMillis(value);

  const preflight = async (request, id, limits = { perMinute: 60, perHour: 600 }) => {
    const uid = requireAuth(request, "Sign in required.");
    requireAppCheck(request, id);
    checkRateLimit(request.rawRequest, id, limits);
    await checkDurableRateLimit(request.rawRequest, id, limits, uid);
    return uid;
  };

  const requireNamedAccount = (request) => {
    const provider = String(request.auth?.token?.firebase?.sign_in_provider || "").trim().toLowerCase();
    if (provider === "anonymous") {
      throw new HttpsError("permission-denied", "A named account is required for Room communication.");
    }
  };

  const loadRoomActor = async ({ roomCode, uid }) => {
    const safeRoomCode = cleanRoomCode(roomCode);
    if (!safeRoomCode) throw new HttpsError("invalid-argument", "roomCode is required.");
    const roomRef = root().collection("rooms").doc(safeRoomCode);
    const roomUserRef = root().collection("room_users").doc(`${safeRoomCode}_${uid}`);
    const [roomSnap, roomUserSnap, superAdmin] = await Promise.all([
      roomRef.get(),
      roomUserRef.get(),
      isSuperAdminUid(uid),
    ]);
    if (!roomSnap.exists) throw new HttpsError("not-found", "Room not found.");
    const room = roomSnap.data() || {};
    const hostUids = uniqueUids([room.hostUid, ...(Array.isArray(room.hostUids) ? room.hostUids : [])]);
    const coHostUids = uniqueUids(room.coHostUids || []);
    const isHost = superAdmin || hostUids.includes(uid);
    const isCoHost = coHostUids.includes(uid);
    if (!roomUserSnap.exists && !isHost) {
      throw new HttpsError("permission-denied", "Join the Room before using Room communication.");
    }
    return {
      roomCode: safeRoomCode,
      roomRef,
      room,
      roomUserRef,
      roomUser: roomUserSnap.exists ? (roomUserSnap.data() || {}) : {},
      hostUids,
      coHostUids,
      isHost,
      isCoHost,
    };
  };

  const actorPresentation = ({ request, actor, uid }) => {
    const fallback = cleanText(request.auth?.token?.name || request.auth?.token?.displayName || "", 80);
    const name = actor.isHost
      ? cleanText(actor.room?.hostName || fallback || "Host", 80)
      : cleanText(actor.roomUser?.name || fallback || "Guest", 80);
    return {
      name,
      avatar: cleanText(actor.isHost ? (actor.room?.hostAvatar || "") : (actor.roomUser?.avatar || actor.roomUser?.emoji || ""), 80),
      isVip: actor.isHost ? false : actor.roomUser?.isVip === true,
      uid,
    };
  };

  const enforceLaneRate = async ({ actor, uid, lane, cooldownMs, capCount = 0, capWindowMs = 600000 }) => {
    const rateRef = db.collection(RATE_LIMITS).doc(stableId(actor.roomCode, uid, lane));
    const currentMs = Date.now();
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(rateRef);
      const data = snap.data() || {};
      const previousMs = timestampMs(data.lastSentAtMs || data.lastSentAt);
      if (previousMs > 0 && currentMs - previousMs < cooldownMs) {
        const waitSeconds = Math.max(1, Math.ceil((cooldownMs - (currentMs - previousMs)) / 1000));
        throw new HttpsError("resource-exhausted", `Wait ${waitSeconds}s before sending again.`);
      }
      const recent = (Array.isArray(data.sendTimesMs) ? data.sendTimesMs : [])
        .map(Number)
        .filter((entry) => Number.isFinite(entry) && currentMs - entry < capWindowMs)
        .slice(-99);
      if (capCount > 0 && recent.length >= capCount) {
        throw new HttpsError("resource-exhausted", "The Room message limit has been reached. Try again later.");
      }
      tx.set(rateRef, {
        roomCode: actor.roomCode,
        uid,
        lane,
        lastSentAtMs: currentMs,
        sendTimesMs: [...recent, currentMs],
        updatedAt: now(),
        expiresAt: fromMs(currentMs + Math.max(capWindowMs, 3600000)),
      }, { merge: true });
    });
  };

  const findCurrentPerformance = async (roomCode) => {
    const snap = await root().collection("karaoke_songs").where("roomCode", "==", roomCode).limit(200).get();
    const items = snap.docs.map((docSnap) => ({ id: docSnap.id, ...(docSnap.data() || {}) }));
    const current = items.find((entry) => String(entry.status || "").trim().toLowerCase() === "performing") || null;
    if (!current) return null;
    return {
      performanceId: cleanText(current.id, 180),
      performanceSongId: cleanText(current.songId || "", 180),
      performanceSongTitle: cleanText(current.songTitle || "", 180),
      performanceArtistName: cleanText(current.artist || current.artistName || "", 180),
      performanceSingerUid: cleanUid(current.singerUid || current.uid || ""),
      performanceSingerName: cleanText(current.singerName || "", 120),
      performanceAlbumArtUrl: cleanText(current.albumArtUrl || current.artworkUrl || current.art || "", 1200),
      performanceStartedAtMs: timestampMs(current.performingStartedAt || current.timestamp),
    };
  };

  return {
    sendRoomLoungeMessage: onCall({ cors: true }, async (request) => {
      const uid = await preflight(request, "send_room_lounge_message", { perMinute: 30, perHour: 360 });
      requireNamedAccount(request);
      const text = cleanText(request.data?.text, 300);
      if (!text) throw new HttpsError("invalid-argument", "Message is required.");
      const actor = await loadRoomActor({ roomCode: request.data?.roomCode, uid });
      if (!actor.isHost) {
        if (actor.room?.chatEnabled === false) throw new HttpsError("failed-precondition", "Chat is off right now.");
        if (actor.roomUser?.chatMuted === true) throw new HttpsError("permission-denied", "You are muted by the Host.");
        if (String(actor.room?.chatAudienceMode || "all").toLowerCase() === "vip" && actor.roomUser?.isVip !== true) {
          throw new HttpsError("permission-denied", "This Room's lounge is limited to approved members.");
        }
      }
      const slowModeMs = actor.isHost ? 500 : Math.max(1500, Math.min(120000, Number(actor.room?.chatSlowModeSec || 0) * 1000));
      const capCount = actor.isHost ? 0 : Math.max(0, Math.min(100, Number(actor.room?.chatMessageCap || 0) || 0));
      const capWindowMs = Math.max(60000, Math.min(86400000, Number(actor.room?.chatMessageWindowMin || 10) * 60000));
      await enforceLaneRate({ actor, uid, lane: "lounge", cooldownMs: slowModeMs, capCount, capWindowMs });
      const presentation = actorPresentation({ request, actor, uid });
      const ref = db.collection(LOUNGE_MESSAGES).doc();
      const createdAt = now();
      const record = {
        roomCode: actor.roomCode,
        text,
        user: presentation.name,
        avatar: presentation.avatar,
        uid,
        isHost: actor.isHost,
        isVip: presentation.isVip,
        channel: "lounge",
        timestamp: createdAt,
        createdAt,
        expiresAt: fromMs(Date.now() + (7 * 86400000)),
        serverProvenance: "send_room_lounge_message_v1",
      };
      const batch = db.batch();
      batch.set(ref, record);
      if (actor.room?.chatShowOnTv === true) {
        batch.set(root().collection(PUBLIC_TV_MESSAGES).doc(ref.id), {
          roomCode: actor.roomCode,
          text,
          user: presentation.name,
          avatar: presentation.avatar,
          isHost: actor.isHost,
          isVip: presentation.isVip,
          channel: "lounge",
          timestamp: createdAt,
          createdAt,
          projectionSourceId: ref.id,
          expiresAt: fromMs(Date.now() + 86400000),
          serverProvenance: "send_room_lounge_message_tv_projection_v1",
        });
      }
      await batch.commit();
      return { ok: true, messageId: ref.id, delivered: true };
    }),

    sendRoomHostMessage: onCall({ cors: true }, async (request) => {
      const uid = await preflight(request, "send_room_host_message", { perMinute: 30, perHour: 240 });
      requireNamedAccount(request);
      const text = cleanText(request.data?.text, 300);
      if (!text) throw new HttpsError("invalid-argument", "Message is required.");
      const actor = await loadRoomActor({ roomCode: request.data?.roomCode, uid });
      const requestedParticipantUid = cleanUid(request.data?.participantUid || request.data?.targetUid || "");
      const participantUid = actor.isHost ? requestedParticipantUid : uid;
      if (!participantUid) throw new HttpsError("invalid-argument", "A Room participant is required.");
      const participantRef = root().collection("room_users").doc(`${actor.roomCode}_${participantUid}`);
      const participantSnap = participantUid === uid ? await actor.roomUserRef.get() : await participantRef.get();
      if (!participantSnap.exists) throw new HttpsError("not-found", "That participant is no longer in the Room.");
      if (!actor.isHost && actor.room?.hostMessagesEnabled === false) {
        throw new HttpsError("failed-precondition", "Host messages are unavailable right now.");
      }
      if (!actor.isHost && actor.roomUser?.chatMuted === true) {
        throw new HttpsError("permission-denied", "You are muted by the Host.");
      }
      await enforceLaneRate({ actor, uid, lane: `host_${participantUid}`, cooldownMs: actor.isHost ? 500 : 1500 });
      const presentation = actorPresentation({ request, actor, uid });
      const threadId = stableId(actor.roomCode, participantUid);
      const threadRef = db.collection(PRIVATE_THREADS).doc(threadId);
      const messageRef = db.collection(PRIVATE_MESSAGES).doc();
      const createdAt = now();
      const participant = participantSnap.data() || {};
      const message = {
        threadId,
        roomCode: actor.roomCode,
        participantUid,
        text,
        user: presentation.name,
        avatar: presentation.avatar,
        uid,
        senderRole: actor.isHost ? "host" : "participant",
        isHost: actor.isHost,
        toHost: !actor.isHost,
        ...(actor.isHost ? { toUid: participantUid } : {}),
        channel: actor.isHost ? "dm" : "host",
        timestamp: createdAt,
        createdAt,
        expiresAt: fromMs(Date.now() + (30 * 86400000)),
        serverProvenance: "send_room_host_message_v1",
      };
      const batch = db.batch();
      batch.set(messageRef, message);
      batch.set(threadRef, {
        threadId,
        roomCode: actor.roomCode,
        participantUid,
        participantName: cleanText(participant.name || "Guest", 80),
        participantAvatar: cleanText(participant.avatar || participant.emoji || "", 80),
        hostUids: actor.hostUids,
        status: "open",
        lastMessagePreview: cleanText(text, 120),
        lastMessageByRole: actor.isHost ? "host" : "participant",
        hostUnread: !actor.isHost,
        participantUnread: actor.isHost,
        updatedAt: createdAt,
        expiresAt: fromMs(Date.now() + (30 * 86400000)),
      }, { merge: true });
      await batch.commit();
      return { ok: true, threadId, messageId: messageRef.id, delivered: true };
    }),

    setRoomHostThreadStatus: onCall({ cors: true }, async (request) => {
      const uid = await preflight(request, "set_room_host_thread_status", { perMinute: 60, perHour: 600 });
      const actor = await loadRoomActor({ roomCode: request.data?.roomCode, uid });
      const participantUid = cleanUid(request.data?.participantUid || "");
      const status = cleanToken(request.data?.status);
      if (!participantUid || !THREAD_STATUSES.has(status)) throw new HttpsError("invalid-argument", "Participant and valid status are required.");
      if (!actor.isHost && uid !== participantUid) throw new HttpsError("permission-denied", "This conversation is private.");
      const threadRef = db.collection(PRIVATE_THREADS).doc(stableId(actor.roomCode, participantUid));
      const snap = await threadRef.get();
      if (!snap.exists) throw new HttpsError("not-found", "Conversation not found.");
      await threadRef.set({
        status,
        ...(actor.isHost ? { hostUnread: false } : { participantUnread: false }),
        statusUpdatedAt: now(),
        statusUpdatedByUid: uid,
        updatedAt: now(),
      }, { merge: true });
      return { ok: true, threadId: threadRef.id, status };
    }),

    manageRoomCoHostInvite: onCall({ cors: true }, async (request) => {
      const uid = await preflight(request, "manage_room_cohost_invite", { perMinute: 30, perHour: 180 });
      const actor = await loadRoomActor({ roomCode: request.data?.roomCode, uid });
      if (!actor.isHost) throw new HttpsError("permission-denied", "Only a Room Host can manage co-host invitations.");
      const targetUid = cleanUid(request.data?.targetUid || "");
      const action = cleanToken(request.data?.action);
      if (!targetUid || !["invite", "revoke"].includes(action)) throw new HttpsError("invalid-argument", "Target and action are required.");
      if (actor.hostUids.includes(targetUid)) throw new HttpsError("failed-precondition", "That person is already a Host.");
      const targetRef = root().collection("room_users").doc(`${actor.roomCode}_${targetUid}`);
      const targetSnap = await targetRef.get();
      if (!targetSnap.exists) throw new HttpsError("not-found", "That person must join the Room first.");
      const inviteRef = db.collection(COHOST_INVITES).doc(stableId(actor.roomCode, targetUid));
      const currentMs = Date.now();
      await db.runTransaction(async (tx) => {
        const roomSnap = await tx.get(actor.roomRef);
        const room = roomSnap.data() || {};
        const currentCoHosts = uniqueUids(room.coHostUids || []);
        const legacyRoles = room.runOfShowRoles && typeof room.runOfShowRoles === "object" ? room.runOfShowRoles : {};
        if (action === "invite") {
          tx.set(inviteRef, {
            inviteId: inviteRef.id,
            roomCode: actor.roomCode,
            targetUid,
            targetName: cleanText(targetSnap.data()?.name || "Guest", 80),
            invitedByUid: uid,
            invitedByName: actorPresentation({ request, actor, uid }).name,
            status: "invited",
            createdAt: now(),
            updatedAt: now(),
            expiresAt: fromMs(currentMs + (12 * 3600000)),
          }, { merge: true });
        } else {
          tx.set(inviteRef, { status: "revoked", revokedByUid: uid, revokedAt: now(), updatedAt: now() }, { merge: true });
          tx.set(actor.roomRef, {
            coHostRoleSchemaVersion: 2,
            coHostUids: currentCoHosts.filter((entry) => entry !== targetUid),
            runOfShowRoles: {
              ...legacyRoles,
              coHosts: uniqueUids(legacyRoles.coHosts || []).filter((entry) => entry !== targetUid),
            },
            updatedAt: now(),
          }, { merge: true });
        }
      });
      return { ok: true, inviteId: inviteRef.id, status: action === "invite" ? "invited" : "revoked" };
    }),

    respondToRoomCoHostInvite: onCall({ cors: true }, async (request) => {
      const uid = await preflight(request, "respond_room_cohost_invite", { perMinute: 20, perHour: 120 });
      requireNamedAccount(request);
      const actor = await loadRoomActor({ roomCode: request.data?.roomCode, uid });
      const action = cleanToken(request.data?.action);
      if (!["accept", "decline"].includes(action)) throw new HttpsError("invalid-argument", "Accept or decline the invitation.");
      const inviteRef = db.collection(COHOST_INVITES).doc(stableId(actor.roomCode, uid));
      await db.runTransaction(async (tx) => {
        const [inviteSnap, roomSnap] = await Promise.all([tx.get(inviteRef), tx.get(actor.roomRef)]);
        if (!inviteSnap.exists || inviteSnap.data()?.targetUid !== uid) throw new HttpsError("not-found", "Co-host invitation not found.");
        const invite = inviteSnap.data() || {};
        if (String(invite.status || "") !== "invited") throw new HttpsError("failed-precondition", "This invitation is no longer pending.");
        if (timestampMs(invite.expiresAt) <= Date.now()) throw new HttpsError("deadline-exceeded", "This invitation has expired.");
        const room = roomSnap.data() || {};
        const legacyRoles = room.runOfShowRoles && typeof room.runOfShowRoles === "object" ? room.runOfShowRoles : {};
        tx.set(inviteRef, {
          status: action === "accept" ? "active" : "declined",
          respondedAt: now(),
          updatedAt: now(),
        }, { merge: true });
        if (action === "accept") {
          tx.set(actor.roomRef, {
            coHostRoleSchemaVersion: 2,
            coHostUids: uniqueUids([...(room.coHostUids || []), uid]),
            runOfShowRoles: {
              ...legacyRoles,
              coHosts: uniqueUids([...(legacyRoles.coHosts || []), uid]),
            },
            updatedAt: now(),
          }, { merge: true });
        }
      });
      return { ok: true, inviteId: inviteRef.id, status: action === "accept" ? "active" : "declined" };
    }),

    leaveRoomCoHostRole: onCall({ cors: true }, async (request) => {
      const uid = await preflight(request, "leave_room_cohost_role", { perMinute: 10, perHour: 60 });
      const actor = await loadRoomActor({ roomCode: request.data?.roomCode, uid });
      const inviteRef = db.collection(COHOST_INVITES).doc(stableId(actor.roomCode, uid));
      await db.runTransaction(async (tx) => {
        const roomSnap = await tx.get(actor.roomRef);
        const room = roomSnap.data() || {};
        const roles = room.runOfShowRoles && typeof room.runOfShowRoles === "object" ? room.runOfShowRoles : {};
        tx.set(actor.roomRef, {
          coHostRoleSchemaVersion: 2,
          coHostUids: uniqueUids(room.coHostUids || []).filter((entry) => entry !== uid),
          runOfShowRoles: { ...roles, coHosts: uniqueUids(roles.coHosts || []).filter((entry) => entry !== uid) },
          updatedAt: now(),
        }, { merge: true });
        tx.set(inviteRef, { status: "left", leftAt: now(), updatedAt: now() }, { merge: true });
      });
      return { ok: true, status: "left" };
    }),

    sendRoomOperatorSignal: onCall({ cors: true }, async (request) => {
      const uid = await preflight(request, "send_room_operator_signal", { perMinute: 12, perHour: 80 });
      requireNamedAccount(request);
      const actor = await loadRoomActor({ roomCode: request.data?.roomCode, uid });
      if (!actor.isCoHost) throw new HttpsError("permission-denied", "An active co-host role is required.");
      const type = cleanToken(request.data?.type || request.data?.signalId);
      const audioArea = cleanToken(request.data?.audioArea || "");
      if (!SIGNAL_TYPES.has(type) || !SIGNAL_AUDIO_AREAS.has(audioArea) || (type !== "audio_attention" && audioArea)) {
        throw new HttpsError("invalid-argument", "Choose a supported Tell Host signal.");
      }
      const performance = await findCurrentPerformance(actor.roomCode);
      const presentation = actorPresentation({ request, actor, uid });
      const contextKey = performance?.performanceId || "room";
      const signalRef = db.collection(OPERATOR_SIGNALS).doc(stableId(actor.roomCode, contextKey, type, audioArea || "general"));
      const rateRef = db.collection(RATE_LIMITS).doc(stableId(actor.roomCode, uid, "signal", type, audioArea || "general"));
      const currentMs = Date.now();
      await db.runTransaction(async (tx) => {
        const [signalSnap, rateSnap, roomSnap] = await Promise.all([tx.get(signalRef), tx.get(rateRef), tx.get(actor.roomRef)]);
        const currentRoom = roomSnap.data() || {};
        if (!uniqueUids(currentRoom.coHostUids || []).includes(uid)) {
          throw new HttpsError("permission-denied", "Your co-host role is no longer active.");
        }
        const lastSentMs = timestampMs(rateSnap.data()?.lastSentAtMs || 0);
        if (lastSentMs > 0 && currentMs - lastSentMs < 75000) {
          throw new HttpsError("resource-exhausted", "Wait before sending this signal again.");
        }
        const existing = signalSnap.data() || {};
        const existingActive = signalSnap.exists && ["delivered", "seen"].includes(String(existing.status || ""));
        const actorUids = uniqueUids([...(existing.actorUids || []), uid]);
        tx.set(rateRef, {
          roomCode: actor.roomCode,
          uid,
          lane: "operator_signal",
          lastSentAtMs: currentMs,
          updatedAt: now(),
          expiresAt: fromMs(currentMs + 3600000),
        }, { merge: true });
        tx.set(signalRef, {
          signalId: signalRef.id,
          roomCode: actor.roomCode,
          type,
          audioArea,
          status: existingActive ? existing.status : "delivered",
          actorUid: uid,
          actorUids,
          actorName: presentation.name,
          count: existingActive ? Math.max(1, Number(existing.count || 1)) + 1 : 1,
          ...performance,
          signalScope: performance ? "performance" : "room",
          createdAt: existingActive ? (existing.createdAt || now()) : now(),
          deliveredAt: existingActive ? (existing.deliveredAt || now()) : now(),
          updatedAt: now(),
          expiresAt: fromMs(currentMs + (2 * 3600000)),
          serverProvenance: "send_room_operator_signal_v1",
        }, { merge: true });
      });
      return { ok: true, signalId: signalRef.id, status: "delivered", delivered: true };
    }),

    setRoomOperatorSignalStatus: onCall({ cors: true }, async (request) => {
      const uid = await preflight(request, "set_room_operator_signal_status", { perMinute: 60, perHour: 480 });
      const actor = await loadRoomActor({ roomCode: request.data?.roomCode, uid });
      if (!actor.isHost) throw new HttpsError("permission-denied", "Only a Room Host can update operational signals.");
      const signalId = cleanText(request.data?.signalId, 520);
      const status = cleanToken(request.data?.status);
      if (!signalId || !SIGNAL_STATUSES.has(status) || status === "delivered") {
        throw new HttpsError("invalid-argument", "Signal and valid Host status are required.");
      }
      const signalRef = db.collection(OPERATOR_SIGNALS).doc(signalId);
      const snap = await signalRef.get();
      if (!snap.exists || cleanRoomCode(snap.data()?.roomCode) !== actor.roomCode) throw new HttpsError("not-found", "Signal not found.");
      const timestamp = now();
      await signalRef.set({
        status,
        updatedAt: timestamp,
        ...(status === "seen" ? { seenAt: timestamp, seenByUid: uid } : {}),
        ...(status === "resolved" ? { resolvedAt: timestamp, resolvedByUid: uid } : {}),
        ...(status === "expired" ? { expiredAt: timestamp, expiredByUid: uid } : {}),
      }, { merge: true });
      return { ok: true, signalId, status };
    }),
  };
};

module.exports = {
  createRoomCommunicationCallables,
  LOUNGE_MESSAGES,
  PRIVATE_MESSAGES,
  PRIVATE_THREADS,
  OPERATOR_SIGNALS,
  COHOST_INVITES,
};
