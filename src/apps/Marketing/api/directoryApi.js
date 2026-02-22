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
} from "../../../lib/firebase";

const mapDocs = (snap) => snap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));

export const subscribeApprovedListings = ({ onData, onError }) => {
  const venueQuery = query(
    collection(db, "venues"),
    where("status", "==", "approved"),
    limit(120)
  );
  const eventQuery = query(
    collection(db, "karaoke_events"),
    where("status", "==", "approved"),
    orderBy("startsAtMs", "asc"),
    limit(160)
  );
  const sessionQuery = query(
    collection(db, "room_sessions"),
    where("status", "==", "approved"),
    where("visibility", "==", "public"),
    orderBy("startsAtMs", "asc"),
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
  const unsubEvent = onSnapshot(
    eventQuery,
    (snap) => {
      state.events = mapDocs(snap);
      emit();
    },
    onError
  );
  const unsubSession = onSnapshot(
    sessionQuery,
    (snap) => {
      state.sessions = mapDocs(snap);
      emit();
    },
    onError
  );

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
    onData?.({ follows: [], checkins: [], reviews: [], submissions: [] });
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

  const state = { follows: [], checkins: [], reviews: [], submissions: [] };
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
};

