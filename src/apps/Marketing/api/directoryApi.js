import {
  db,
  collection,
  doc,
  query,
  where,
  onSnapshot,
  orderBy,
  limit,
  getDoc,
  getDirectoryMapsConfig,
  upsertDirectoryProfile,
  submitDirectoryListing,
  updateDirectoryListing,
  followDirectoryEntity,
  unfollowDirectoryEntity,
  createDirectoryCheckin,
  submitDirectoryReview,
  listModerationQueue,
  resolveModerationItem,
  runExternalDirectoryIngestion,
  submitDirectoryClaimRequest,
  resolveDirectoryClaimRequest,
  setDirectoryRsvp,
  setDirectoryReminderPreferences,
  listDirectoryGeoLanding,
  listDirectoryDiscover,
  submitCatalogContribution,
  listCatalogContributionQueue,
  resolveCatalogContribution,
  previewDirectoryRoomSessionByCode,
  submitMarketingWaitlist,
  setHostApprovalStatus,
  listHostApplications,
  resolveHostApplication,
  getMyHostAccessStatus,
  getMyDirectoryAccess,
  runDemoDirectorAction,
  recordMarketingTelemetry,
  getMarketingReportingSummary,
} from "../../../lib/firebase";

const mapDocs = (snap) => snap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
const BASE_ACCESS = Object.freeze({ isModerator: false, isAdmin: false, roles: [] });
const APP_ROOM_ROOT = ["artifacts", "bross-app", "public", "data", "rooms"];

const normalizeAccess = (payload = {}) => {
  const roles = Array.isArray(payload?.roles)
    ? Array.from(new Set(payload.roles.map((entry) => String(entry || "").trim()).filter(Boolean)))
    : [];
  const isAdmin = !!payload?.isAdmin || roles.includes("directory_admin") || roles.includes("super_admin");
  const isModerator = !!payload?.isModerator || isAdmin || roles.includes("directory_editor");
  return { isModerator, isAdmin, roles };
};

const mergeAccess = (first = BASE_ACCESS, second = BASE_ACCESS) => {
  const primary = normalizeAccess(first);
  const secondary = normalizeAccess(second);
  const roles = Array.from(new Set([...(primary.roles || []), ...(secondary.roles || [])]));
  const isAdmin = primary.isAdmin || secondary.isAdmin || roles.includes("directory_admin") || roles.includes("super_admin");
  const isModerator = primary.isModerator || secondary.isModerator || isAdmin || roles.includes("directory_editor");
  return { isModerator, isAdmin, roles };
};

const isIndexRequiredError = (error) => {
  const message = String(error?.message || "").toLowerCase();
  const code = String(error?.code || "").toLowerCase();
  return (
    message.includes("requires an index")
    || (code.includes("failed-precondition") && message.includes("index"))
  );
};

const normalizeJoinRoomCode = (value = "") =>
  String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, "")
    .slice(0, 32);

const asMillis = (value) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (value && typeof value.toMillis === "function") {
    const ms = Number(value.toMillis());
    return Number.isFinite(ms) ? ms : 0;
  }
  const seconds = Number(value?.seconds ?? value?._seconds ?? 0);
  const nanos = Number(value?.nanoseconds ?? value?._nanoseconds ?? 0);
  if (!Number.isFinite(seconds)) return 0;
  return Math.max(0, Math.round((seconds * 1000) + (nanos / 1e6)));
};

const buildActiveRoomJoinPreview = ({ roomCode = "", roomData = {} } = {}) => {
  const code = normalizeJoinRoomCode(roomCode);
  const mode = String(roomData?.activeMode || "karaoke").trim() || "karaoke";
  const isPaused = Boolean(roomData?.paused || roomData?.isPaused || mode.toLowerCase() === "paused");
  return {
    id: `room:${code}`,
    title: roomData?.title || roomData?.name || `Room ${code}`,
    description: "",
    startsAtMs: asMillis(roomData?.updatedAt || roomData?.createdAt),
    endsAtMs: 0,
    hostUid: String(roomData?.hostUid || ""),
    hostName: String(roomData?.hostName || ""),
    venueId: "",
    venueName: isPaused ? "Paused room" : `Live ${mode.replace(/_/g, " ")}`,
    visibility: "private",
    roomCode: code,
    previewType: "active_room",
    activeMode: mode,
    isPaused,
  };
};

const subscribeWithFallback = ({
  primaryQuery,
  fallbackQuery = null,
  onData,
  onError,
}) => {
  let unsub = () => {};

  const start = (queryRef, allowFallback) => {
    unsub = onSnapshot(
      queryRef,
      (snap) => onData?.(snap),
      (error) => {
        if (allowFallback && fallbackQuery && isIndexRequiredError(error)) {
          try {
            unsub();
          } catch {
            // Ignore cleanup errors and continue with fallback.
          }
          start(fallbackQuery, false);
          return;
        }
        onError?.(error);
      }
    );
  };

  start(primaryQuery, true);
  return () => unsub();
};

export const subscribeApprovedListings = ({ onData, onError }) => {
  const venueQuery = query(
    collection(db, "venues"),
    where("status", "==", "approved"),
    where("visibility", "==", "public"),
    limit(120)
  );
  const eventQueryPrimary = query(
    collection(db, "karaoke_events"),
    where("status", "==", "approved"),
    where("visibility", "==", "public"),
    orderBy("startsAtMs", "asc"),
    limit(160)
  );
  const eventQueryFallback = query(
    collection(db, "karaoke_events"),
    where("status", "==", "approved"),
    where("visibility", "==", "public"),
    limit(160)
  );
  const sessionQueryPrimary = query(
    collection(db, "room_sessions"),
    where("status", "==", "approved"),
    where("visibility", "==", "public"),
    orderBy("startsAtMs", "asc"),
    limit(160)
  );
  const sessionQueryFallback = query(
    collection(db, "room_sessions"),
    where("status", "==", "approved"),
    where("visibility", "==", "public"),
    limit(160)
  );

  const state = { venues: [], events: [], sessions: [] };
  const emit = () => onData?.({ ...state });

  const unsubVenue = onSnapshot(
    venueQuery,
    (snap) => {
      state.venues = mapDocs(snap);
      emit();
    },
    onError
  );
  const unsubEvent = subscribeWithFallback({
    primaryQuery: eventQueryPrimary,
    fallbackQuery: eventQueryFallback,
    onData: (snap) => {
      state.events = mapDocs(snap);
      emit();
    },
    onError,
  });
  const unsubSession = subscribeWithFallback({
    primaryQuery: sessionQueryPrimary,
    fallbackQuery: sessionQueryFallback,
    onData: (snap) => {
      state.sessions = mapDocs(snap);
      emit();
    },
    onError,
  });

  return () => {
    unsubVenue();
    unsubEvent();
    unsubSession();
  };
};

export const subscribeDocById = ({ collectionName, id, onData, onError }) => {
  if (!collectionName || !id) {
    onData?.(null);
    return () => {};
  }
  return onSnapshot(
    doc(db, collectionName, id),
    (snap) => onData?.(snap.exists() ? { id: snap.id, ...snap.data() } : null),
    onError
  );
};

export const subscribeProfileByUid = ({ uid, onData, onError }) =>
  subscribeDocById({ collectionName: "directory_profiles", id: uid, onData, onError });

export const subscribeModeratorAccess = ({ uid, onData, onError }) => {
  if (!uid) {
    onData?.({ ...BASE_ACCESS });
    return () => {};
  }

  let disposed = false;
  let roleDocAccess = { ...BASE_ACCESS };
  let callableAccess = { ...BASE_ACCESS };
  const emit = () => {
    if (disposed) return;
    onData?.(mergeAccess(roleDocAccess, callableAccess));
  };

  const stopRoleDoc = onSnapshot(
    doc(db, "directory_roles", uid),
    (snap) => {
      const roles = Array.isArray(snap.data()?.roles) ? snap.data().roles : [];
      const isAdmin = roles.includes("directory_admin");
      const isModerator = isAdmin || roles.includes("directory_editor");
      roleDocAccess = { isModerator, isAdmin, roles };
      emit();
    },
    (error) => {
      roleDocAccess = { ...BASE_ACCESS };
      emit();
      onError?.(error);
    }
  );

  getMyDirectoryAccess().then((payload) => {
    callableAccess = normalizeAccess(payload || {});
    emit();
  }).catch(() => {
    // Keep role-doc access path as fallback if callable fails.
  });

  return () => {
    disposed = true;
    stopRoleDoc();
  };
};

export { getMyHostAccessStatus, getMyDirectoryAccess, listHostApplications, resolveHostApplication };

export const subscribeOwnDashboard = ({ uid, onData, onError }) => {
  if (!uid) {
    onData?.({
      follows: [],
      checkins: [],
      reviews: [],
      submissions: [],
      rsvps: [],
      reminders: [],
      performanceHistory: [],
    });
    return () => {};
  }

  const followQuery = query(
    collection(db, "follows"),
    where("followerUid", "==", uid),
    orderBy("createdAt", "desc"),
    limit(80)
  );
  const checkinQuery = query(
    collection(db, "checkins"),
    where("uid", "==", uid),
    orderBy("createdAt", "desc"),
    limit(80)
  );
  const reviewQuery = query(
    collection(db, "reviews"),
    where("uid", "==", uid),
    orderBy("updatedAt", "desc"),
    limit(80)
  );
  const submissionQuery = query(
    collection(db, "directory_submissions"),
    where("createdBy", "==", uid),
    orderBy("createdAt", "desc"),
    limit(80)
  );
  const rsvpQuery = query(
    collection(db, "directory_rsvps"),
    where("uid", "==", uid),
    orderBy("updatedAt", "desc"),
    limit(80)
  );
  const reminderQuery = query(
    collection(db, "directory_reminders"),
    where("uid", "==", uid),
    orderBy("updatedAt", "desc"),
    limit(80)
  );
  const performanceQueryPrimary = query(
    collection(db, "performances"),
    where("singerUid", "==", uid),
    orderBy("timestamp", "desc"),
    limit(120)
  );
  const performanceQueryFallback = query(
    collection(db, "performances"),
    where("singerUid", "==", uid),
    limit(120)
  );

  const state = {
    follows: [],
    checkins: [],
    reviews: [],
    submissions: [],
    rsvps: [],
    reminders: [],
    performanceHistory: [],
  };
  const emit = () => onData?.({ ...state });

  const unsubs = [
    onSnapshot(followQuery, (snap) => {
      state.follows = mapDocs(snap);
      emit();
    }, onError),
    onSnapshot(checkinQuery, (snap) => {
      state.checkins = mapDocs(snap);
      emit();
    }, onError),
    onSnapshot(reviewQuery, (snap) => {
      state.reviews = mapDocs(snap);
      emit();
    }, onError),
    onSnapshot(submissionQuery, (snap) => {
      state.submissions = mapDocs(snap);
      emit();
    }, onError),
    onSnapshot(rsvpQuery, (snap) => {
      state.rsvps = mapDocs(snap);
      emit();
    }, onError),
    onSnapshot(reminderQuery, (snap) => {
      state.reminders = mapDocs(snap);
      emit();
    }, onError),
    subscribeWithFallback({
      primaryQuery: performanceQueryPrimary,
      fallbackQuery: performanceQueryFallback,
      onData: (snap) => {
        state.performanceHistory = mapDocs(snap);
        emit();
      },
      onError,
    }),
  ];

  return () => {
    unsubs.forEach((stop) => stop());
  };
};

export const subscribeSongCatalog = ({ onData, onError, max = 120 } = {}) => {
  const safeLimit = Math.min(240, Math.max(20, Number(max || 120)));
  const primaryQuery = query(
    collection(db, "songs"),
    orderBy("updatedAt", "desc"),
    limit(safeLimit)
  );
  const fallbackQuery = query(
    collection(db, "songs"),
    limit(safeLimit)
  );
  return subscribeWithFallback({
    primaryQuery,
    fallbackQuery,
    onData: (snap) => onData?.(mapDocs(snap)),
    onError,
  });
};

export const fetchEntityDoc = async ({ collectionName, id }) => {
  const snap = await getDoc(doc(db, collectionName, id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};

export const resolveJoinRoomCodePreview = async ({ roomCode = "" } = {}) => {
  const code = normalizeJoinRoomCode(roomCode);
  if (!code) {
    const err = new Error("roomCode is required.");
    err.code = "invalid-argument";
    throw err;
  }
  try {
    const payload = await previewDirectoryRoomSessionByCode({ roomCode: code });
    if (payload?.session) {
      return {
        ...payload.session,
        roomCode: code,
        previewType: "directory_session",
      };
    }
  } catch (previewError) {
    const roomSnap = await getDoc(doc(db, ...APP_ROOM_ROOT, code));
    if (roomSnap.exists()) {
      return buildActiveRoomJoinPreview({ roomCode: code, roomData: roomSnap.data() || {} });
    }
    throw previewError;
  }

  const roomSnap = await getDoc(doc(db, ...APP_ROOM_ROOT, code));
  if (roomSnap.exists()) {
    return buildActiveRoomJoinPreview({ roomCode: code, roomData: roomSnap.data() || {} });
  }
  const err = new Error("Room code not found.");
  err.code = "not-found";
  throw err;
};

export const directoryActions = {
  getDirectoryMapsConfig,
  upsertDirectoryProfile,
  submitDirectoryListing,
  updateDirectoryListing,
  followDirectoryEntity,
  unfollowDirectoryEntity,
  createDirectoryCheckin,
  submitDirectoryReview,
  listModerationQueue,
  resolveModerationItem,
  runExternalDirectoryIngestion,
  submitDirectoryClaimRequest,
  resolveDirectoryClaimRequest,
  setDirectoryRsvp,
  setDirectoryReminderPreferences,
  listDirectoryGeoLanding,
  listDirectoryDiscover,
  submitCatalogContribution,
  listCatalogContributionQueue,
  resolveCatalogContribution,
  previewDirectoryRoomSessionByCode,
  resolveJoinRoomCodePreview,
  submitMarketingWaitlist,
  setHostApprovalStatus,
  listHostApplications,
  resolveHostApplication,
  getMyHostAccessStatus,
  getMyDirectoryAccess,
  runDemoDirectorAction,
  recordMarketingTelemetry,
  getMarketingReportingSummary,
};
