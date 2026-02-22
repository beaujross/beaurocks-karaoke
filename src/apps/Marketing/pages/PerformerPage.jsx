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
import EntityActionsCard from "./EntityActionsCard";
import { readStars } from "./shared";

const PerformerPage = ({ id, session }) => {
  const [profile, setProfile] = useState(null);
  const [reviews, setReviews] = useState([]);

  useEffect(() => {
    if (!id) return () => {};
    const q = query(collection(db, "directory_profiles"), where("__name__", "==", id), limit(1));
    return onSnapshot(q, (snap) => setProfile(snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() }));
  }, [id]);

  useEffect(() => {
    if (!id) return () => {};
    const q = query(
      collection(db, "reviews"),
      where("targetType", "==", "performer"),
      where("targetId", "==", id),
      orderBy("updatedAt", "desc"),
      limit(60)
    );
    return onSnapshot(q, (snap) => setReviews(snap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))));
  }, [id]);

  if (!profile) {
    return <section className="mk3-page"><div className="mk3-status">Performer profile not found.</div></section>;
  }

  return (
    <section className="mk3-page mk3-two-col">
      <article className="mk3-detail-card">
        <div className="mk3-chip">performer profile</div>
        <h2>{profile.displayName || profile.handle || profile.id}</h2>
        <div className="mk3-detail-meta">{[profile.city, profile.state, profile.country].filter(Boolean).join(" | ")}</div>
        <p>{profile.bio || "No performer bio yet."}</p>
        <div className="mk3-sub-list">
          <h3>Karaoke Reviews</h3>
          {reviews.length === 0 && <div className="mk3-status">No reviews yet.</div>}
          {reviews.map((review) => (
            <div key={review.id} className="mk3-list-row static">
              <span>{readStars(review.rating)}</span>
              <span>{Array.isArray(review.tags) ? review.tags.join(", ") : ""}</span>
            </div>
          ))}
        </div>
      </article>
      <EntityActionsCard targetType="performer" targetId={profile.id} session={session} />
    </section>
  );
};

export default PerformerPage;
