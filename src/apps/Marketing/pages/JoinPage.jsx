import React, { useEffect, useState } from "react";
import { directoryActions } from "../api/directoryApi";
import { formatDateTime } from "./shared";
import { buildSurfaceUrl } from "../../../lib/surfaceDomains";
import { getJoinPreviewFallback } from "./joinFallback";

const JoinPage = ({ navigate, id = "" }) => {
  const [roomCode, setRoomCode] = useState(String(id || "").trim().toUpperCase());
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [statusTone, setStatusTone] = useState("error");
  const resolvedJoinCode = String(roomCode || id || "").trim().toUpperCase();

  const joinOnMobile = () => {
    const code = String(resolvedJoinCode || "").trim().toUpperCase();
    if (!code) {
      setStatus("Enter a room code first.");
      setStatusTone("error");
      return;
    }
    window.location.href = buildSurfaceUrl({ surface: "app", params: { room: code } }, window.location);
  };

  const onSubmit = (event) => {
    event.preventDefault();
    const token = String(roomCode || "").trim().toUpperCase();
    if (!token) return;
    navigate({ page: "join", params: { roomCode: token } });
  };

  useEffect(() => {
    setRoomCode(String(id || "").trim().toUpperCase());
  }, [id]);

  useEffect(() => {
    const token = String(id || "").trim().toUpperCase();
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
        <div className="mk3-chip">join private room</div>
        <h2>Enter Room Code</h2>
        <p>Private rooms stay off public pages. If you have the code, you are in.</p>
        <form className="mk3-actions-block" onSubmit={onSubmit}>
          <label>
            Room Code
            <input
              value={roomCode}
              onChange={(event) => setRoomCode(String(event.target.value || "").toUpperCase())}
              placeholder="ABC123"
            />
          </label>
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
      </article>
      <aside className="mk3-actions-card">
        <h4>Looking For Public Nights?</h4>
        <p>Use Discover to browse public events, hosts, and venues nearby.</p>
        <button type="button" onClick={() => navigate("discover")}>
          Open Discover
        </button>
      </aside>
    </section>
  );
};

export default JoinPage;
