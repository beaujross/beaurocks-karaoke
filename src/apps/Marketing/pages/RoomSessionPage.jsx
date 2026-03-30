import React, { useEffect, useState } from "react";
import {
  db,
  collection,
  doc,
  query,
  where,
  limit,
  onSnapshot,
  submitRunOfShowSlotSong,
  trackEvent,
} from "../../../lib/firebase";
import { APP_ID } from "../../../lib/assets";
import { EMPTY_STATE_CONTEXT, getEmptyStateConfig } from "../emptyStateOrchestrator";
import EntityActionsCard from "./EntityActionsCard";
import DirectoryExperienceSpotlight from "./DirectoryExperienceSpotlight";
import EmptyStatePanel from "./EmptyStatePanel";
import {
  getRunOfShowItemLabel,
  getRunOfShowOpenSubmissionItems,
  getRunOfShowPublicItems,
  normalizeRunOfShowDirector,
} from "../../../lib/runOfShowDirector";
import {
  formatDateTime,
  getInitials,
  MARKETING_BRAND_BADGE_URL,
  resolveListingImageCandidates,
  resolveProfileAvatarUrl,
} from "./shared";

const RoomSessionPage = ({ id, route, navigate, session, authFlow }) => {
  const [sessionItem, setSessionItem] = useState(null);
  const [hostProfile, setHostProfile] = useState(null);
  const [roomItem, setRoomItem] = useState(null);
  const [submissionDrafts, setSubmissionDrafts] = useState({});
  const [mySubmissions, setMySubmissions] = useState([]);
  const [submitBusyItemId, setSubmitBusyItemId] = useState("");
  const [submitStatusByItem, setSubmitStatusByItem] = useState({});
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

  useEffect(() => {
    if (!sessionItem?.roomCode) {
      setRoomItem(null);
      return () => {};
    }
    return onSnapshot(
      doc(db, "artifacts", APP_ID, "public", "data", "rooms", sessionItem.roomCode),
      (snap) => setRoomItem(snap.exists() ? { id: snap.id, ...snap.data() } : null),
      () => setRoomItem(null)
    );
  }, [sessionItem?.roomCode]);

  useEffect(() => {
    const uid = session?.uid || "";
    if (!uid || !sessionItem?.roomCode) {
      setMySubmissions([]);
      return () => {};
    }
    const submissionsQuery = query(
      collection(db, "artifacts", APP_ID, "public", "data", "run_of_show_slot_submissions"),
      where("roomCode", "==", sessionItem.roomCode),
      where("uid", "==", uid)
    );
    return onSnapshot(
      submissionsQuery,
      (snap) => {
        const nextSubmissions = snap.docs
          .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
          .sort((a, b) => {
            const left = Number(a?.submittedAt?.seconds || 0);
            const right = Number(b?.submittedAt?.seconds || 0);
            return right - left;
          });
        setMySubmissions(nextSubmissions);
      },
      () => setMySubmissions([])
    );
  }, [session?.uid, sessionItem?.roomCode]);

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
  const heroImage = sessionImageCandidates[0] || MARKETING_BRAND_BADGE_URL;
  const listingGallery = sessionImageCandidates.slice(0, 3);
  const runOfShowDirector = normalizeRunOfShowDirector(roomItem?.runOfShowDirector || {});
  const publicAgenda = getRunOfShowPublicItems(runOfShowDirector);
  const openSubmissionItems = getRunOfShowOpenSubmissionItems(runOfShowDirector);
  const runOfShowActive = roomItem?.runOfShowEnabled === true && String(roomItem?.programMode || "").trim().toLowerCase() === "run_of_show";
  const formatSubmissionStatus = (value = "") => {
    const safe = String(value || "pending").trim().toLowerCase();
    if (safe === "approved") return "Approved";
    if (safe === "declined") return "Declined";
    if (safe === "withdrawn") return "Withdrawn";
    return "Pending Host Review";
  };
  const submissionStatusClass = (value = "") => {
    const safe = String(value || "pending").trim().toLowerCase();
    if (safe === "approved") return "border-emerald-300/25 bg-emerald-500/12 text-emerald-100";
    if (safe === "declined") return "border-rose-300/25 bg-rose-500/12 text-rose-100";
    return "border-amber-300/25 bg-amber-500/12 text-amber-100";
  };
  const slotCriteriaSummary = (item = {}) => {
    const pieces = [
      item?.slotCriteria?.requiresAccount === false ? "Account optional" : "Signed-in account",
    ];
    if (Number(item?.slotCriteria?.minTight15Count || 0) > 0) {
      pieces.push(`Tight 15 minimum ${Number(item.slotCriteria.minTight15Count)}`);
    }
    if (item?.slotCriteria?.hostApprovalRequired !== false) {
      pieces.push("Host approval required");
    }
    return pieces.join(" | ");
  };

  const setSubmissionDraft = (itemId, field, value) => {
    setSubmissionDrafts((prev) => ({
      ...prev,
      [itemId]: {
        ...(prev[itemId] || {}),
        [field]: value,
      },
    }));
  };

  const handleSubmitSlotSong = async (item) => {
    const uid = session?.uid || "";
    if (!uid || session?.isAnonymous) {
      authFlow?.requireFullAuth?.({
        source: "room_session_run_of_show_slot",
        intent: "submit a performance slot song",
      });
      return;
    }
    const draft = submissionDrafts[item.id] || {};
    const songTitle = String(draft.songTitle || "").trim();
    const artistName = String(draft.artistName || "").trim();
    if (!songTitle) {
      setSubmitStatusByItem((prev) => ({ ...prev, [item.id]: "Add a song title before submitting." }));
      return;
    }
    setSubmitBusyItemId(item.id);
    setSubmitStatusByItem((prev) => ({ ...prev, [item.id]: "" }));
    try {
      await submitRunOfShowSlotSong({
        roomCode: sessionItem.roomCode,
        itemId: item.id,
        linkedEventId: sessionItem.linkedEventId || "",
        songTitle,
        artistName,
        displayName: session?.displayName || session?.name || session?.email || "Singer",
      });
      trackEvent("mk_run_of_show_slot_submission_created", {
        roomCode: sessionItem.roomCode,
        itemId: item.id,
        hasArtist: !!artistName,
      });
      setSubmissionDrafts((prev) => ({
        ...prev,
        [item.id]: { songTitle: "", artistName: "" },
      }));
      setSubmitStatusByItem((prev) => ({ ...prev, [item.id]: "Submission sent to the host for review." }));
    } catch (err) {
      setSubmitStatusByItem((prev) => ({ ...prev, [item.id]: String(err?.message || "Could not submit this slot right now.") }));
    } finally {
      setSubmitBusyItemId("");
    }
  };

  return (
    <section className="mk3-page mk3-two-col">
      <article className="mk3-detail-card">
        <div className="mk3-listing-title-block">
          <div className="mk3-chip">live room</div>
          <h2>{sessionItem.title}</h2>
          <div className="mk3-detail-meta">{formatDateTime(sessionItem.startsAtMs)}</div>
        </div>
        <div className="mk3-venue-stat-grid">
          <article>
            <span>Starts</span>
            <strong>{formatDateTime(sessionItem.startsAtMs)}</strong>
          </article>
          <article>
            <span>Access</span>
            <strong>{sessionItem.visibility || "public"}</strong>
          </article>
          <article>
            <span>Join code</span>
            <strong>{sessionItem.roomCode || "Private"}</strong>
          </article>
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
        <div className="mk3-listing-hero">
          <img src={heroImage} alt={`${sessionItem.title} room session visual`} loading="lazy" />
        </div>
        <DirectoryExperienceSpotlight
          entry={{
            ...sessionItem,
            ...(hostProfile || {}),
            title: sessionItem.title,
            hostName,
            imageUrl: heroImage,
          }}
          title="What to expect"
          eyebrow="room details"
          showUpgradePrompt={false}
        />
        <p>{sessionItem.description || "No session notes yet."}</p>
        {runOfShowActive && publicAgenda.length > 0 && (
          <div className="mt-6 space-y-4">
            <div className="rounded-[30px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.14),transparent_42%),linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] p-5">
              <div className="mk3-chip">Tonight's Flow</div>
              <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <div className="text-2xl font-semibold text-white">Lineup Preview</div>
                  <div className="mt-1 max-w-2xl text-sm text-zinc-300">This room is running from a planned run of show. Use the lineup below to see how the night is paced and where public submissions are open.</div>
                </div>
                <div className="flex flex-wrap gap-2 text-xs uppercase tracking-[0.16em] text-zinc-200">
                  <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5">{publicAgenda.length} public stops</span>
                  <span className="rounded-full border border-cyan-300/25 bg-cyan-500/10 px-3 py-1.5">{openSubmissionItems.length} open slots</span>
                </div>
              </div>
            </div>
            <div className="grid gap-3">
              {publicAgenda.map((item, index) => (
                <div key={item.id} className="rounded-[26px] border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-300">
                          Stop {index + 1}
                        </span>
                        <span className="rounded-full border border-cyan-300/25 bg-cyan-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-100">
                          {getRunOfShowItemLabel(item.type)}
                        </span>
                      </div>
                      <div className="mt-3 text-xl font-semibold text-white">
                        {item.title || getRunOfShowItemLabel(item.type)}
                      </div>
                      <div className="mt-1 text-sm text-zinc-300">
                        {item.type === "performance"
                          ? [item.assignedPerformerName, item.songTitle, item.artistName].filter(Boolean).join(" · ") || "Performer to be announced"
                          : item.presentationPlan?.headline || item.modeLaunchPlan?.launchConfig?.question || item.notes || "Show block"}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">Duration</div>
                      <div className="mt-1 text-sm font-semibold text-white">{Math.max(0, Number(item.plannedDurationSec || 0))} sec</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {runOfShowActive && openSubmissionItems.length > 0 && (
          <div className="mt-6 space-y-4">
            <div className="rounded-[30px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.16),transparent_42%),linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] p-5">
              <div className="mk3-chip">Open Performance Slots</div>
              <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <div className="text-2xl font-semibold text-white">Apply For A Slot</div>
                  <div className="mt-1 max-w-2xl text-sm text-zinc-300">Submit the song you want considered for an open block. Nothing is booked instantly in v1. The host reviews and approves performers into the timeline.</div>
                </div>
                <div className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-xs uppercase tracking-[0.16em] text-zinc-200">
                  {openSubmissionItems.length} accepting submissions
                </div>
              </div>
            </div>
            {openSubmissionItems.map((item) => {
              const draft = submissionDrafts[item.id] || {};
              const mySubmission = mySubmissions.find((entry) => entry.itemId === item.id) || null;
              const submitMessage = submitStatusByItem[item.id] || "";
              return (
                <div key={item.id} className="rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(6,182,212,0.10),transparent_40%),linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-cyan-300/25 bg-cyan-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-100">
                          {getRunOfShowItemLabel(item.type)}
                        </span>
                        <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-300">
                          {Math.max(0, Number(item.plannedDurationSec || 0))} sec slot
                        </span>
                      </div>
                      <div className="mt-3 text-xl font-semibold text-white">{item.title || "Performance Slot"}</div>
                      <div className="text-sm text-zinc-300 mt-1">
                        Submit the song you want considered for this block. The host reviews everything before assigning the slot.
                      </div>
                      <div className="mt-3 rounded-2xl border border-white/10 bg-black/15 px-3 py-2 text-sm text-zinc-300">
                        {slotCriteriaSummary(item)}
                      </div>
                    </div>
                    {mySubmission && (
                      <div className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] ${submissionStatusClass(mySubmission.submissionStatus)}`}>
                        {formatSubmissionStatus(mySubmission.submissionStatus)}
                      </div>
                    )}
                  </div>
                  <div className="grid gap-3 md:grid-cols-2 mt-4">
                    <input
                      value={draft.songTitle || ""}
                      onChange={(event) => setSubmissionDraft(item.id, "songTitle", event.target.value)}
                      className="w-full rounded-full border border-white/10 bg-black/25 px-4 py-3 text-white"
                      placeholder="Song title"
                    />
                    <input
                      value={draft.artistName || ""}
                      onChange={(event) => setSubmissionDraft(item.id, "artistName", event.target.value)}
                      className="w-full rounded-full border border-white/10 bg-black/25 px-4 py-3 text-white"
                      placeholder="Artist"
                    />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-3 items-center">
                    <button
                      type="button"
                      onClick={() => handleSubmitSlotSong(item)}
                      disabled={submitBusyItemId === item.id}
                      className="rounded-full border border-cyan-300/35 bg-cyan-500/15 px-4 py-2 text-sm font-semibold text-cyan-50 disabled:opacity-50"
                    >
                      {submitBusyItemId === item.id ? "Submitting..." : "Submit Song"}
                    </button>
                    {!session?.uid || session?.isAnonymous ? (
                      <button
                        type="button"
                        className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white"
                        onClick={() => authFlow?.requireFullAuth?.({
                          source: "room_session_run_of_show_slot",
                          intent: "submit a performance slot song",
                        })}
                      >
                        Sign in to submit
                      </button>
                    ) : null}
                  </div>
                  {mySubmission ? (
                    <div className="mt-3 rounded-2xl border border-white/10 bg-black/15 px-3 py-2 text-sm text-zinc-200">
                      Your latest submission: <strong>{mySubmission.songTitle || "Untitled Song"}</strong>
                      {mySubmission.artistName ? ` by ${mySubmission.artistName}` : ""}
                      {` | ${formatSubmissionStatus(mySubmission.submissionStatus)}`}
                    </div>
                  ) : null}
                  {submitMessage ? <div className="mt-3 rounded-2xl border border-cyan-300/20 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-50">{submitMessage}</div> : null}
                </div>
              );
            })}
          </div>
        )}
        <div className="mk3-venue-gallery" aria-label="Room session media gallery">
          {listingGallery.map((imageUrl, index) => (
            <figure key={`${imageUrl}-${index}`}>
              <img src={imageUrl} alt={`${sessionItem.title} visual ${index + 1}`} loading="lazy" />
            </figure>
          ))}
        </div>
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

