import React, { useEffect, useState } from "react";
import {
  db,
  collection,
  query,
  where,
  limit,
  onSnapshot,
} from "../../../lib/firebase";
import { trackEvent } from "../../../lib/firebase";
import { directoryActions } from "../api/directoryApi";
import { DIRECTORY_REVIEW_TAGS } from "../types";
import { marketingFlags } from "../featureFlags";

const targetRouteFor = (targetType = "", targetId = "") => {
  if (targetType === "event") return { page: "event", id: targetId };
  if (targetType === "session") return { page: "session", id: targetId };
  if (targetType === "venue") return { page: "venue", id: targetId };
  if (targetType === "host") return { page: "host", id: targetId };
  if (targetType === "performer") return { page: "performer", id: targetId };
  return { page: "discover", id: "" };
};

const EntityActionsCard = ({ targetType, targetId, session, authFlow, navigate }) => {
  const uid = session?.uid || "";
  const canAct = !!uid && !session?.isAnonymous;
  const canRsvp = marketingFlags.rsvpEnabled && ["event", "session"].includes(String(targetType || ""));
  const [following, setFollowing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [checkinPublic, setCheckinPublic] = useState(false);
  const [checkinNote, setCheckinNote] = useState("");
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewText, setReviewText] = useState("");
  const [reviewTags, setReviewTags] = useState([]);
  const [rsvpStatus, setRsvpStatus] = useState("going");
  const [reminderEmailOptIn, setReminderEmailOptIn] = useState(true);
  const [reminderSmsOptIn, setReminderSmsOptIn] = useState(false);
  const [reminderPhone, setReminderPhone] = useState("");
  const [rsvpBusy, setRsvpBusy] = useState(false);
  const [nextStep, setNextStep] = useState(null);

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

  useEffect(() => {
    if (!canAct || !canRsvp || !targetType || !targetId) {
      setRsvpStatus("going");
      return () => {};
    }
    const rsvpQuery = query(
      collection(db, "directory_rsvps"),
      where("uid", "==", uid),
      where("targetType", "==", targetType),
      where("targetId", "==", targetId),
      limit(1)
    );
    return onSnapshot(
      rsvpQuery,
      (snap) => {
        if (snap.empty) {
          setRsvpStatus("going");
          return;
        }
        const data = snap.docs[0]?.data?.() || snap.docs[0]?.data() || {};
        const status = String(data.status || "going").trim().toLowerCase();
        setRsvpStatus(status || "going");
      },
      () => setRsvpStatus("going")
    );
  }, [canAct, canRsvp, uid, targetType, targetId]);

  useEffect(() => {
    if (!canAct || !canRsvp || !targetType || !targetId) {
      setReminderEmailOptIn(true);
      setReminderSmsOptIn(false);
      setReminderPhone("");
      return () => {};
    }
    const reminderQuery = query(
      collection(db, "directory_reminders"),
      where("uid", "==", uid),
      where("targetType", "==", targetType),
      where("targetId", "==", targetId),
      limit(1)
    );
    return onSnapshot(
      reminderQuery,
      (snap) => {
        if (snap.empty) {
          setReminderEmailOptIn(true);
          setReminderSmsOptIn(false);
          setReminderPhone("");
          return;
        }
        const data = snap.docs[0]?.data?.() || snap.docs[0]?.data() || {};
        setReminderEmailOptIn(!!data.emailOptIn);
        setReminderSmsOptIn(!!data.smsOptIn);
        setReminderPhone(String(data.phone || ""));
      },
      () => {
        setReminderEmailOptIn(true);
        setReminderSmsOptIn(false);
        setReminderPhone("");
      }
    );
  }, [canAct, canRsvp, uid, targetType, targetId]);

  const requireAuthMessage = "Create an account to follow, RSVP, check in, and review.";
  const requireAuth = (intent = "continue", target = targetType, id = targetId) => {
    if (canAct) return true;
    return !!authFlow?.requireFullAuth?.({
      intent,
      targetType: target,
      targetId: id,
      returnRoute: {
        ...targetRouteFor(targetType, targetId),
        params: { intent, targetType: target, targetId: id },
      },
    });
  };

  if (!canAct) {
    return (
      <aside className="mk3-actions-card">
        <h4>Social Actions</h4>
        <p>Create an account to unlock follow, RSVP, check-ins, reviews, and reminders.</p>
        <button
          type="button"
          onClick={() => authFlow?.requireFullAuth?.({
            intent: canRsvp ? "rsvp" : "follow",
            targetType,
            targetId,
            returnRoute: {
              ...targetRouteFor(targetType, targetId),
              params: {
                intent: canRsvp ? "rsvp" : "follow",
                targetType,
                targetId,
              },
            },
          })}
        >
          Create Account For Social Actions
        </button>
      </aside>
    );
  }

  const toggleFollow = async () => {
    if (!requireAuth("follow", targetType, targetId)) {
      setMessage(requireAuthMessage);
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      if (following) {
        await directoryActions.unfollowDirectoryEntity({ targetType, targetId });
        setMessage("Unfollowed.");
        trackEvent("mk_follow_set", { targetType, targetId, mode: "unfollow" });
        setNextStep(null);
      } else {
        await directoryActions.followDirectoryEntity({ targetType, targetId });
        setMessage("Following.");
        trackEvent("mk_follow_set", { targetType, targetId, mode: "follow" });
        if (targetType === "host" || targetType === "performer") {
          setNextStep({
            label: "Next: RSVP to an event",
            onClick: () => navigate?.("discover"),
          });
        }
      }
    } catch (error) {
      setMessage(String(error?.message || "Follow action failed."));
    } finally {
      setBusy(false);
    }
  };

  const submitCheckin = async () => {
    if (!requireAuth("checkin", targetType, targetId)) {
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
      trackEvent("mk_checkin_create", { targetType, targetId, isPublic: !!checkinPublic });
    } catch (error) {
      setMessage(String(error?.message || "Check-in failed."));
    } finally {
      setBusy(false);
    }
  };

  const submitReview = async () => {
    if (!requireAuth("review", targetType, targetId)) {
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
      trackEvent("mk_review_submit", {
        targetType,
        targetId,
        rating: Number(reviewRating || 5),
        tagsCount: reviewTags.length,
      });
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

  const submitRsvp = async () => {
    if (!requireAuth("rsvp", targetType, targetId)) {
      setMessage(requireAuthMessage);
      return;
    }
    if (!canRsvp) return;
    setRsvpBusy(true);
    setMessage("");
    try {
      await directoryActions.setDirectoryRsvp({
        targetType,
        targetId,
        status: rsvpStatus,
        reminderChannels: [
          ...(reminderEmailOptIn ? ["email"] : []),
          ...(reminderSmsOptIn ? ["sms"] : []),
        ],
      });
      setMessage("RSVP saved.");
      trackEvent("mk_rsvp_set", { targetType, targetId, status: rsvpStatus });
      setNextStep({
        label: "Next: Enable reminders",
        onClick: () => saveReminderPreferences(),
      });
    } catch (error) {
      setMessage(String(error?.message || "RSVP failed."));
    } finally {
      setRsvpBusy(false);
    }
  };

  const saveReminderPreferences = async () => {
    if (!requireAuth("reminders", targetType, targetId)) {
      setMessage(requireAuthMessage);
      return;
    }
    if (!canRsvp) return;
    setRsvpBusy(true);
    setMessage("");
    try {
      await directoryActions.setDirectoryReminderPreferences({
        targetType,
        targetId,
        emailOptIn: !!reminderEmailOptIn,
        smsOptIn: !!reminderSmsOptIn,
        phone: reminderPhone,
      });
      setMessage("Reminder preferences saved.");
      if (reminderEmailOptIn) trackEvent("mk_reminder_opt_in_email", { targetType, targetId });
      if (reminderSmsOptIn) trackEvent("mk_reminder_opt_in_sms", { targetType, targetId });
      setNextStep(null);
    } catch (error) {
      setMessage(String(error?.message || "Reminder preferences failed."));
    } finally {
      setRsvpBusy(false);
    }
  };

  return (
    <aside className="mk3-actions-card">
      <h4>Social Actions</h4>
      <p>Private by default check-ins, public karaoke reviews, and conversion-friendly follow/RSVP flows.</p>
      <button type="button" disabled={busy} onClick={toggleFollow}>
        {following ? "Unfollow" : "Follow"}
      </button>

      {canRsvp && (
        <div className="mk3-actions-block">
          <label>
            RSVP Status
            <select value={rsvpStatus} onChange={(e) => setRsvpStatus(e.target.value)}>
              <option value="going">Going</option>
              <option value="interested">Interested</option>
              <option value="not_going">Not Going</option>
              <option value="cancelled">Cancel RSVP</option>
            </select>
          </label>
          <button type="button" disabled={rsvpBusy} onClick={submitRsvp}>
            {rsvpBusy ? "Saving RSVP..." : "Save RSVP"}
          </button>
          <label className="mk3-inline">
            <input
              type="checkbox"
              checked={reminderEmailOptIn}
              onChange={(e) => setReminderEmailOptIn(e.target.checked)}
            />
            Email reminders
          </label>
          <label className="mk3-inline">
            <input
              type="checkbox"
              checked={reminderSmsOptIn}
              onChange={(e) => setReminderSmsOptIn(e.target.checked)}
              disabled={!marketingFlags.smsRemindersEnabled}
            />
            SMS reminders
          </label>
          {reminderSmsOptIn && (
            <label>
              Reminder Phone
              <input
                value={reminderPhone}
                onChange={(e) => setReminderPhone(e.target.value)}
                placeholder="+1 555 123 4567"
              />
            </label>
          )}
          <button type="button" disabled={rsvpBusy} onClick={saveReminderPreferences}>
            {rsvpBusy ? "Saving..." : "Save Reminder Preferences"}
          </button>
        </div>
      )}

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
      {!!nextStep && (
        <button
          type="button"
          className="mk3-inline-next"
          onClick={nextStep.onClick || (() => {})}
        >
          {nextStep.label}
        </button>
      )}
    </aside>
  );
};

export default EntityActionsCard;
