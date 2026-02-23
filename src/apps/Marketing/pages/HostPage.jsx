import React, { useEffect, useState } from "react";
import {
  db,
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
} from "../../../lib/firebase";
import { EMPTY_STATE_CONTEXT, getEmptyStateConfig } from "../emptyStateOrchestrator";
import EntityActionsCard from "./EntityActionsCard";
import ClaimOwnershipCard from "./ClaimOwnershipCard";
import EmptyStatePanel from "./EmptyStatePanel";
import { formatDateTime } from "./shared";

const HostPage = ({ id, navigate, session, authFlow }) => {
  const [profile, setProfile] = useState(null);
  const [events, setEvents] = useState([]);
  const [sessions, setSessions] = useState([]);

  useEffect(() => {
    if (!id) return () => {};
    const q = query(collection(db, "directory_profiles"), where("__name__", "==", id), limit(1));
    return onSnapshot(q, (snap) => setProfile(snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() }));
  }, [id]);

  useEffect(() => {
    if (!id) return () => {};
    const qEvents = query(
      collection(db, "karaoke_events"),
      where("hostUid", "==", id),
      where("status", "==", "approved"),
      orderBy("startsAtMs", "asc"),
      limit(60)
    );
    const qSessions = query(
      collection(db, "room_sessions"),
      where("hostUid", "==", id),
      where("status", "==", "approved"),
      where("visibility", "==", "public"),
      orderBy("startsAtMs", "asc"),
      limit(60)
    );
    const unsubEvents = onSnapshot(qEvents, (snap) => setEvents(snap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))));
    const unsubSessions = onSnapshot(qSessions, (snap) => setSessions(snap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))));
    return () => {
      unsubEvents();
      unsubSessions();
    };
  }, [id]);

  if (!profile) {
    return (
      <section className="mk3-page">
        <EmptyStatePanel
          {...getEmptyStateConfig({ context: EMPTY_STATE_CONTEXT.HOST_MISSING, session })}
          onAction={(action) => {
            if (action.intent === "profile") navigate("profile");
            else navigate("discover");
          }}
        />
      </section>
    );
  }

  return (
    <section className="mk3-page mk3-two-col">
      <article className="mk3-detail-card">
        <div className="mk3-chip">host profile</div>
        <h2>{profile.displayName || profile.handle || profile.id}</h2>
        <div className="mk3-detail-meta">{[profile.city, profile.state, profile.country].filter(Boolean).join(" | ")}</div>
        <p>{profile.bio || "No host bio yet."}</p>

        <div className="mk3-sub-list">
          <h3>Upcoming Events</h3>
          {events.map((item) => (
            <button type="button" className="mk3-list-row" key={item.id} onClick={() => navigate("event", item.id)}>
              <span>{item.title}</span>
              <span>{formatDateTime(item.startsAtMs)}</span>
            </button>
          ))}
        </div>
        <div className="mk3-sub-list">
          <h3>Public Sessions</h3>
          {sessions.map((item) => (
            <button type="button" className="mk3-list-row" key={item.id} onClick={() => navigate("session", item.id)}>
              <span>{item.title}</span>
              <span>{formatDateTime(item.startsAtMs)}</span>
            </button>
          ))}
        </div>
      </article>
      <div className="mk3-side-stack">
        <ClaimOwnershipCard
          listingType="host"
          listingId={profile.id}
          session={session}
          navigate={navigate}
          authFlow={authFlow}
        />
        <EntityActionsCard
          targetType="host"
          targetId={profile.id}
          session={session}
          navigate={navigate}
          authFlow={authFlow}
        />
      </div>
    </section>
  );
};

export default HostPage;
