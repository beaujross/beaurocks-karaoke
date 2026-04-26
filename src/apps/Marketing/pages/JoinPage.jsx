import React, { useEffect, useState } from "react";
import { directoryActions } from "../api/directoryApi";
import { formatDateTime } from "./shared";
import { buildSurfaceUrl } from "../../../lib/surfaceDomains";
import { getJoinPreviewFallback } from "./joinFallback";

const STANDARD_ROOM_CODE_LENGTH = 4;
const MAX_ROOM_CODE_LENGTH = 10;
const normalizeJoinEntryCode = (value = "") =>
  String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, MAX_ROOM_CODE_LENGTH);

const JoinPage = ({ navigate, id = "" }) => {
  const [roomCode, setRoomCode] = useState(normalizeJoinEntryCode(id));
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [statusTone, setStatusTone] = useState("error");
  const [showManualEntry, setShowManualEntry] = useState(false);
  const resolvedJoinCode = normalizeJoinEntryCode(roomCode || id || "");
  const hasJoinCodeInRoute = !!normalizeJoinEntryCode(id);
  const isActiveJoinTarget = preview?.previewType === "active_room" || preview?.previewType === "directory_session";
  const heroTitle = preview?.title || `Room ${resolvedJoinCode || "Code"}`;
  const heroTimeLabel = preview?.startsAtMs ? formatDateTime(preview.startsAtMs) : "";
  const heroContextLabel = preview?.venueName || preview?.hostName || preview?.visibility || "Live karaoke";

  const joinOnMobile = () => {
    const code = normalizeJoinEntryCode(resolvedJoinCode || "");
    if (!code) {
      setStatus(`Enter a room code first. Standard codes are ${STANDARD_ROOM_CODE_LENGTH} characters.`);
      setStatusTone("error");
      return;
    }
    window.location.href = buildSurfaceUrl({ surface: "app", params: { room: code } }, window.location);
  };

  const onSubmit = (event) => {
    event.preventDefault();
    const token = normalizeJoinEntryCode(roomCode || "");
    if (!token) return;
    navigate({ page: "join", params: { roomCode: token } });
  };

  useEffect(() => {
    setRoomCode(normalizeJoinEntryCode(id));
    setShowManualEntry(false);
  }, [id]);

  useEffect(() => {
    const token = normalizeJoinEntryCode(id);
    if (!token) {
      setPreview(null);
      setStatus("");
      setStatusTone("error");
      return;
    }
    let cancelled = false;
    setLoading(true);
    setStatus("");
    setStatusTone("error");
    (async () => {
      try {
        const payload = await directoryActions.resolveJoinRoomCodePreview({ roomCode: token });
        if (!cancelled) {
          setPreview(payload || null);
          if (payload?.previewType === "active_room") {
            setStatus("Active room found. You can join now.");
            setStatusTone("warning");
          }
        }
      } catch (error) {
        if (!cancelled) {
          setPreview(null);
          const fallback = getJoinPreviewFallback({ error, roomCode: token });
          setStatus(String(fallback?.message || "Room code not found."));
          setStatusTone(fallback?.tone === "warning" ? "warning" : "error");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  return (
    <section className="mk3-page mk3-two-col">
      <article className="mk3-detail-card">
        {hasJoinCodeInRoute && !showManualEntry ? (
          <>
            <div className="mk3-chip">join room</div>
            <h2>{loading ? "Checking room..." : `Join ${heroTitle}`}</h2>
            <p>
              {loading
                ? "Confirming the room and getting the join path ready."
                : isActiveJoinTarget
                  ? "This room is live. Move straight into the audience experience."
                  : "We found a room code. If it is active, you can move straight into the audience experience."}
            </p>
            <div className="mk3-status">
              <strong>{heroTitle}</strong>
              {heroTimeLabel ? <span>{heroTimeLabel}</span> : null}
              <span>{heroContextLabel}</span>
              <span>Room code {resolvedJoinCode}</span>
            </div>
            {loading ? <div className="mk3-status">Checking that room code...</div> : null}
            {status && !loading ? (
              <div className={statusTone === "warning" ? "mk3-status mk3-status-warning" : "mk3-status mk3-status-error"}>
                {status}
              </div>
            ) : null}
            <div className="mk3-actions-block">
              <button type="button" onClick={joinOnMobile}>
                Join Room Now
              </button>
              <button type="button" onClick={() => setShowManualEntry(true)}>
                Use Different Room Code
              </button>
              {preview?.previewType === "directory_session" && preview.id ? (
                <button type="button" onClick={() => navigate("session", preview.id)}>
                  View Event Details
                </button>
              ) : null}
            </div>
          </>
        ) : (
          <>
            <div className="mk3-chip">join private room</div>
            <h2>Enter Room Code</h2>
            <p>Private rooms stay off the public pages. If you have the code, you are basically at the velvet rope already. Most BeauRocks rooms use a 4-character code.</p>
            <form className="mk3-actions-block" onSubmit={onSubmit}>
              <label>
                Room Code
                <input
                  value={roomCode}
                  onChange={(event) => setRoomCode(normalizeJoinEntryCode(event.target.value || ""))}
                  placeholder="A1B2"
                  maxLength={MAX_ROOM_CODE_LENGTH}
                  inputMode="text"
                  autoCapitalize="characters"
                  autoCorrect="off"
                  spellCheck={false}
                />
              </label>
              <div className="mk3-field-hint">Standard room codes are 4 characters and use letters or numbers.</div>
              <button type="submit">Open Join Page</button>
              <button type="button" onClick={joinOnMobile}>
                Join On Mobile
              </button>
            </form>
            {loading && <div className="mk3-status">Checking that room code...</div>}
            {status && <div className={statusTone === "warning" ? "mk3-status mk3-status-warning" : "mk3-status mk3-status-error"}>{status}</div>}
            {!!preview && (
              <div className="mk3-status">
                <strong>{preview.title || "Room session"}</strong>
                <span>{preview.startsAtMs ? formatDateTime(preview.startsAtMs) : "Time TBD"}</span>
                <span>{preview.venueName || preview.hostName || preview.visibility || "Private session"}</span>
                <div className="mk3-actions-inline">
                  {preview.previewType === "directory_session" && preview.id ? (
                    <button type="button" onClick={() => navigate("session", preview.id)}>
                      Open Session Details
                    </button>
                  ) : null}
                  <button type="button" onClick={joinOnMobile}>Join On Mobile</button>
                </div>
              </div>
            )}
          </>
        )}
      </article>
      <aside className="mk3-actions-card">
        <h4>{hasJoinCodeInRoute && !showManualEntry ? "Need To Switch Rooms?" : "Looking For Public Nights?"}</h4>
        <p>
          {hasJoinCodeInRoute && !showManualEntry
            ? "Go back to Discover if you meant to browse more public events instead of joining this room."
            : "Use Discover to browse public events, hosts, and venues nearby when you are in the mood to roam instead of entering a secret code."}
        </p>
        <button type="button" onClick={() => navigate("discover")}>
          Open Discover
        </button>
      </aside>
    </section>
  );
};

export default JoinPage;
