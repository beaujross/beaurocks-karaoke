import React, { useEffect, useState } from "react";
import {
  db,
  collection,
  query,
  where,
  limit,
  onSnapshot,
} from "../../../lib/firebase";
import { directoryActions } from "../api/directoryApi";
import { DIRECTORY_REVIEW_TAGS } from "../types";

const EntityActionsCard = ({ targetType, targetId, session }) => {
  const uid = session?.uid || "";
  const canAct = !!uid && !session?.isAnonymous;
  const [following, setFollowing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [checkinPublic, setCheckinPublic] = useState(false);
  const [checkinNote, setCheckinNote] = useState("");
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewText, setReviewText] = useState("");
  const [reviewTags, setReviewTags] = useState([]);

  useEffect(() => {
    if (!canAct || !targetType || !targetId) {
      setFollowing(false);
      return () => {};
    }
    const q = query(
      collection(db, "follows"),
      where("followerUid", "==", uid),
      where("targetType", "==", targetType),
      where("targetId", "==", targetId),
      limit(1)
    );
    return onSnapshot(q, (snap) => setFollowing(!snap.empty), () => setFollowing(false));
  }, [canAct, uid, targetType, targetId]);

  const requireAuthMessage = "Sign in with a full BeauRocks account to follow, check in, and review.";

  const toggleFollow = async () => {
    if (!canAct) {
      setMessage(requireAuthMessage);
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      if (following) {
        await directoryActions.unfollowDirectoryEntity({ targetType, targetId });
        setMessage("Unfollowed.");
      } else {
        await directoryActions.followDirectoryEntity({ targetType, targetId });
        setMessage("Following.");
      }
    } catch (error) {
      setMessage(String(error?.message || "Follow action failed."));
    } finally {
      setBusy(false);
    }
  };

  const submitCheckin = async () => {
    if (!canAct) {
      setMessage(requireAuthMessage);
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      await directoryActions.createDirectoryCheckin({
        targetType,
        targetId,
        isPublic: !!checkinPublic,
        note: checkinNote,
      });
      setCheckinNote("");
      setMessage("Check-in saved.");
    } catch (error) {
      setMessage(String(error?.message || "Check-in failed."));
    } finally {
      setBusy(false);
    }
  };

  const submitReview = async () => {
    if (!canAct) {
      setMessage(requireAuthMessage);
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      await directoryActions.submitDirectoryReview({
        targetType,
        targetId,
        rating: Number(reviewRating || 5),
        text: reviewText,
        tags: reviewTags,
      });
      setReviewText("");
      setMessage("Review saved.");
    } catch (error) {
      setMessage(String(error?.message || "Review failed."));
    } finally {
      setBusy(false);
    }
  };

  const toggleTag = (tag) => {
    setReviewTags((prev) => {
      if (prev.includes(tag)) return prev.filter((item) => item !== tag);
      if (prev.length >= 5) return prev;
      return [...prev, tag];
    });
  };

  return (
    <aside className="mk3-actions-card">
      <h4>Social Actions</h4>
      <p>Private by default check-ins, public karaoke reviews, and follow tracking.</p>
      <button type="button" disabled={busy} onClick={toggleFollow}>
        {following ? "Unfollow" : "Follow"}
      </button>

      <div className="mk3-actions-block">
        <label className="mk3-inline">
          <input
            type="checkbox"
            checked={checkinPublic}
            onChange={(e) => setCheckinPublic(e.target.checked)}
          />
          Share this check-in publicly
        </label>
        <textarea
          value={checkinNote}
          onChange={(e) => setCheckinNote(e.target.value)}
          placeholder="Check-in note (optional)"
        />
        <button type="button" disabled={busy} onClick={submitCheckin}>Check In</button>
      </div>

      <div className="mk3-actions-block">
        <label>
          Karaoke Rating
          <select value={reviewRating} onChange={(e) => setReviewRating(Number(e.target.value))}>
            <option value={5}>5</option>
            <option value={4}>4</option>
            <option value={3}>3</option>
            <option value={2}>2</option>
            <option value={1}>1</option>
          </select>
        </label>
        <div className="mk3-tag-pills">
          {DIRECTORY_REVIEW_TAGS.map((tag) => (
            <button
              type="button"
              key={tag}
              className={reviewTags.includes(tag) ? "mk3-tag active" : "mk3-tag"}
              onClick={() => toggleTag(tag)}
              disabled={busy}
            >
              {tag.replace(/_/g, " ")}
            </button>
          ))}
        </div>
        <textarea
          value={reviewText}
          onChange={(e) => setReviewText(e.target.value)}
          placeholder="How was this from a karaoke perspective?"
        />
        <button type="button" disabled={busy} onClick={submitReview}>Submit Review</button>
      </div>

      {message && <div className="mk3-status">{message}</div>}
    </aside>
  );
};

export default EntityActionsCard;

