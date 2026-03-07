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
import DirectoryExperienceSpotlight from "./DirectoryExperienceSpotlight";
import EmptyStatePanel from "./EmptyStatePanel";
import {
  formatDateTime,
  getInitials,
  resolveListingImageCandidates,
  resolveProfileAvatarUrl,
} from "./shared";

const HostPage = ({ id, route, navigate, session, authFlow }) => {
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
            if (action.intent === "auth") {
              authFlow?.requireFullAuth?.({
                intent: "profile",
                targetType: "profile",
                targetId: "",
                returnRoute: { page: "profile" },
              });
              return;
            }
            if (action.intent === "profile") {
              navigate("profile");
              return;
            }
            navigate("discover");
          }}
        />
      </section>
    );
  }

  const hostName = profile.displayName || profile.handle || profile.id;
  const hostAvatarUrl = resolveProfileAvatarUrl(profile);
  const hostImageCandidates = [
    ...resolveListingImageCandidates(profile, "host"),
    ...(events[0] ? resolveListingImageCandidates(events[0], "event") : []),
  ].filter((value, index, arr) => arr.indexOf(value) === index);
  const heroImage = hostImageCandidates[0] || "/images/logo-library/beaurocks-karaoke-logo-2.png";
  const listingGallery = hostImageCandidates.slice(0, 3);
  const hostExperienceSource = {
    ...profile,
    ...(sessions[0] || events[0] || {}),
    title: hostName,
    description: profile.bio || events[0]?.description || sessions[0]?.description || "",
    hostName,
    imageUrl: heroImage,
  };
  const hostModernized = !!hostExperienceSource?.isOfficialBeauRocksRoom
    || !!hostExperienceSource?.hasBeauRocksHostAccount
    || (Array.isArray(hostExperienceSource?.beauRocksCapabilities) && hostExperienceSource.beauRocksCapabilities.length > 0);

  return (
    <section className="mk3-page mk3-two-col">
      <article className="mk3-detail-card">
        <div className="mk3-listing-hero">
          <img src={heroImage} alt={`${hostName} host profile visual`} loading="lazy" />
          <div className="mk3-listing-hero-content">
            <div className="mk3-chip">host profile</div>
            <h2>{hostName}</h2>
            <div className="mk3-detail-meta">{[profile.city, profile.state, profile.country].filter(Boolean).join(" | ")}</div>
          </div>
        </div>
        <div className="mk3-profile-pill">
          <div className="mk3-profile-avatar" aria-hidden="true">
            {hostAvatarUrl
              ? <img src={hostAvatarUrl} alt={`${hostName} avatar`} loading="lazy" />
              : <span>{getInitials(hostName)}</span>}
          </div>
          <div className="mk3-profile-copy">
            <strong>Host Handle</strong>
            <span>{profile.handle || hostName}</span>
          </div>
        </div>
        <div className="mk3-venue-gallery" aria-label="Host media gallery">
          {listingGallery.map((imageUrl, index) => (
            <figure key={`${imageUrl}-${index}`}>
              <img src={imageUrl} alt={`${hostName} visual ${index + 1}`} loading="lazy" />
            </figure>
          ))}
        </div>
        <p>{profile.bio || "No host bio yet."}</p>
        <DirectoryExperienceSpotlight
          entry={hostExperienceSource}
          title="Host Signature"
          eyebrow="host identity"
        />

        <div className="mk3-sub-list">
          <h3>Upcoming Events</h3>
          {events.length === 0 && <div className="mk3-status">No approved host events yet.</div>}
          {events.map((item) => (
            <button type="button" className="mk3-list-row" key={item.id} onClick={() => navigate("event", item.id)}>
              <span>{item.title}</span>
              <span>{formatDateTime(item.startsAtMs)}</span>
            </button>
          ))}
        </div>
        <div className="mk3-sub-list">
          <h3>Public Sessions</h3>
          {sessions.length === 0 && <div className="mk3-status">No public sessions yet.</div>}
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
          isModernized={hostModernized}
        />
        <EntityActionsCard
          targetType="host"
          targetId={profile.id}
          session={session}
          navigate={navigate}
          authFlow={authFlow}
          conversionSource={String(route?.params?.src || "host_page")}
        />
      </div>
    </section>
  );
};

export default HostPage;
