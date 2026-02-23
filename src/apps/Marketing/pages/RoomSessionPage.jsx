import React, { useEffect, useState } from "react";
import {
  db,
  collection,
  query,
  where,
  limit,
  onSnapshot,
} from "../../../lib/firebase";
import { EMPTY_STATE_CONTEXT, getEmptyStateConfig } from "../emptyStateOrchestrator";
import EntityActionsCard from "./EntityActionsCard";
import EmptyStatePanel from "./EmptyStatePanel";
import {
  formatDateTime,
  getInitials,
  resolveListingImageCandidates,
  resolveProfileAvatarUrl,
} from "./shared";

const RoomSessionPage = ({ id, route, navigate, session, authFlow }) => {
  const [sessionItem, setSessionItem] = useState(null);
  const [hostProfile, setHostProfile] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return () => {};
    const q = query(collection(db, "room_sessions"), where("__name__", "==", id), limit(1));
    return onSnapshot(
      q,
      (snap) => setSessionItem(snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() }),
      (err) => setError(String(err?.message || "Failed to load session."))
    );
  }, [id]);

  useEffect(() => {
    if (!sessionItem?.hostUid) return () => {};
    const q = query(collection(db, "directory_profiles"), where("__name__", "==", sessionItem.hostUid), limit(1));
    return onSnapshot(
      q,
      (snap) => setHostProfile(snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() }),
      () => setHostProfile(null)
    );
  }, [sessionItem?.hostUid]);

  if (error) {
    return <section className="mk3-page"><div className="mk3-status mk3-status-error">{error}</div></section>;
  }
  if (!sessionItem) {
    return (
      <section className="mk3-page">
        <EmptyStatePanel
          {...getEmptyStateConfig({ context: EMPTY_STATE_CONTEXT.SESSION_MISSING, session })}
          onAction={(action) => {
            if (action.intent === "join") navigate("join");
            else navigate("discover");
          }}
        />
      </section>
    );
  }

  const hostName = hostProfile?.displayName || hostProfile?.handle || sessionItem.hostName || "Session Host";
  const hostAvatarUrl = resolveProfileAvatarUrl(hostProfile || sessionItem);
  const sessionImageCandidates = [
    ...resolveListingImageCandidates(sessionItem, "session"),
    ...resolveListingImageCandidates(hostProfile || {}, "host"),
  ].filter((value, index, arr) => arr.indexOf(value) === index);
  const heroImage = sessionImageCandidates[0] || "/images/logo-library/beaurocks-karaoke-logo-2.png";
  const listingGallery = sessionImageCandidates.slice(0, 3);

  return (
    <section className="mk3-page mk3-two-col">
      <article className="mk3-detail-card">
        <div className="mk3-listing-hero">
          <img src={heroImage} alt={`${sessionItem.title} room session visual`} loading="lazy" />
          <div className="mk3-listing-hero-content">
            <div className="mk3-chip">room session</div>
            <h2>{sessionItem.title}</h2>
            <div className="mk3-detail-meta">{formatDateTime(sessionItem.startsAtMs)}</div>
          </div>
        </div>
        <div className="mk3-profile-pill">
          <div className="mk3-profile-avatar" aria-hidden="true">
            {hostAvatarUrl
              ? <img src={hostAvatarUrl} alt={`${hostName} avatar`} loading="lazy" />
              : <span>{getInitials(hostName)}</span>}
          </div>
          <div className="mk3-profile-copy">
            <strong>Host</strong>
            <span>{hostName}</span>
          </div>
        </div>
        <div className="mk3-venue-gallery" aria-label="Room session media gallery">
          {listingGallery.map((imageUrl, index) => (
            <figure key={`${imageUrl}-${index}`}>
              <img src={imageUrl} alt={`${sessionItem.title} visual ${index + 1}`} loading="lazy" />
            </figure>
          ))}
        </div>
        <p>{sessionItem.description || "No session notes yet."}</p>
        <div className="mk3-sub-list">
          <div className="mk3-list-row static">
            <span>Visibility</span>
            <span>{sessionItem.visibility || "public"}</span>
          </div>
          {sessionItem.roomCode && (
            <div className="mk3-list-row static">
              <span>Room Code</span>
              <span>{sessionItem.roomCode}</span>
            </div>
          )}
          {hostProfile && (
            <button type="button" className="mk3-list-row" onClick={() => navigate("host", hostProfile.id)}>
              <span>Host</span>
              <span>{hostProfile.displayName || hostProfile.handle || hostProfile.id}</span>
            </button>
          )}
        </div>
      </article>
      <EntityActionsCard
        targetType="session"
        targetId={sessionItem.id}
        session={session}
        navigate={navigate}
        authFlow={authFlow}
        conversionSource={String(route?.params?.src || "session_page")}
      />
    </section>
  );
};

export default RoomSessionPage;
