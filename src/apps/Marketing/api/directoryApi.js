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
  previewDirectoryRoomSessionByCode,
} from "../../../lib/firebase";

const mapDocs = (snap) => snap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));

const isIndexRequiredError = (error) => {
  const message = String(error?.message || "").toLowerCase();
  const code = String(error?.code || "").toLowerCase();
  return (
    message.includes("requires an index")
    || (code.includes("failed-precondition") && message.includes("index"))
  );
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
    onData?.({ isModerator: false, isAdmin: false, roles: [] });
    return () => {};
  }
  return onSnapshot(
    doc(db, "directory_roles", uid),
    (snap) => {
      const roles = Array.isArray(snap.data()?.roles) ? snap.data().roles : [];
      const isAdmin = roles.includes("directory_admin");
      const isModerator = isAdmin || roles.includes("directory_editor");
      onData?.({ isModerator, isAdmin, roles });
    },
    onError
  );
};

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

export const fetchEntityDoc = async ({ collectionName, id }) => {
  const snap = await getDoc(doc(db, collectionName, id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
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
  previewDirectoryRoomSessionByCode,
};
