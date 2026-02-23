import React, { useEffect, useState } from "react";
import { directoryActions } from "../api/directoryApi";
import { formatDateTime } from "./shared";

const JoinPage = ({ navigate, id = "" }) => {
  const [roomCode, setRoomCode] = useState(String(id || "").trim().toUpperCase());
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");

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
      return;
    }
    let cancelled = false;
    setLoading(true);
    setStatus("");
    (async () => {
      try {
        const payload = await directoryActions.previewDirectoryRoomSessionByCode({ roomCode: token });
        if (!cancelled) setPreview(payload?.session || null);
      } catch (error) {
        if (!cancelled) {
          setPreview(null);
          setStatus(String(error?.message || "Room code not found."));
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
        <h2>Enter room code</h2>
        <p>Private room sessions stay out of public index pages and require a valid room code.</p>
        <form className="mk3-actions-block" onSubmit={onSubmit}>
          <label>
            Room Code
            <input
              value={roomCode}
              onChange={(event) => setRoomCode(String(event.target.value || "").toUpperCase())}
              placeholder="ABC123"
            />
          </label>
          <button type="submit">Open Join Route</button>
        </form>
        {loading && <div className="mk3-status">Looking up room code...</div>}
        {status && <div className="mk3-status mk3-status-error">{status}</div>}
        {!!preview && (
          <div className="mk3-status">
            <strong>{preview.title || "Room session"}</strong>
            <span>{preview.startsAtMs ? formatDateTime(preview.startsAtMs) : "Time TBD"}</span>
            <span>{preview.venueName || preview.hostName || preview.visibility || "Private session"}</span>
            <div className="mk3-actions-inline">
              <button type="button" onClick={() => navigate("session", preview.id)}>
                Open Session Profile
              </button>
              <button type="button" onClick={() => { window.location.href = `/?room=${encodeURIComponent(String(roomCode || id).trim().toUpperCase())}`; }}>
                Join Mobile Room
              </button>
            </div>
          </div>
        )}
      </article>
      <aside className="mk3-actions-card">
        <h4>Need Public Listings?</h4>
        <p>Use Discover for public events, hosts, and venues.</p>
        <button type="button" onClick={() => navigate("discover")}>
          Go to Discover
        </button>
      </aside>
    </section>
  );
};

export default JoinPage;
