import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { trackEvent } from "../lib/marketingAnalytics";
import {
  db,
  collection,
  query,
  where,
  limit,
  getDocs,
} from "../../../lib/firebase";
import { buildSurfaceUrl } from "../../../lib/surfaceDomains";
import { formatDateTime } from "./shared";
import { toRoomManagerEntryFromData } from "./hostRoomManagerUtils";

const HOST_STACK_BADGES = [
  "Content-Agnostic Control",
  "Works With Existing Tools",
  "Built For Live Flow",
];

const HOST_QUICK_STEPS = [
  {
    title: "Set room defaults",
    detail: "Configure queue, moderation, and overlays in one place.",
  },
  {
    title: "Run a unified queue",
    detail: "Use your current sources without changing your stack.",
  },
  {
    title: "Close with clean recap",
    detail: "Finish with consistent room data instead of manual cleanup.",
  },
];

const HOST_OUTCOMES = [
  "Less dead air between singers.",
  "Cleaner transitions across host, TV, and audience devices.",
  "More repeatable host operations night to night.",
];

const normalizeRoomCode = (value = "") =>
  String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 10);

const APP_ROOM_COLLECTION_PATH = ["artifacts", "bross-app", "public", "data", "rooms"];

const toRoomManagerEntry = (docSnap) => {
  const data = docSnap.data() || {};
  return toRoomManagerEntryFromData({ id: docSnap.id, data });
};

const ForHostsPage = ({ navigate, route, session, authFlow }) => {
  const canSubmit = !!session?.uid && !session?.isAnonymous;
  const trackPersonaCta = (cta = "") => {
    trackEvent("mk_persona_cta_click", {
      persona: "host",
      page: "for_hosts",
      cta: String(cta || ""),
    });
  };

  const [privateForm, setPrivateForm] = useState({
    title: "",
    roomCode: "",
    startsAtLocal: "",
    description: "",
    publicRoom: false,
    virtualOnly: false,
    city: "",
    state: "",
  });
  const [status, setStatus] = useState("");
  const autoLaunchIntentRef = useRef("");
  const [managedRooms, setManagedRooms] = useState([]);
  const [managedRoomsLoading, setManagedRoomsLoading] = useState(false);
  const [managedRoomsError, setManagedRoomsError] = useState("");
  const [publishedSessions, setPublishedSessions] = useState([]);
  const [publishedSessionsLoading, setPublishedSessionsLoading] = useState(false);
  const [roomManagerStatus, setRoomManagerStatus] = useState("");

  const hostSetupHref = useMemo(() => {
    if (typeof window === "undefined") return "";
    const roomCode = normalizeRoomCode(privateForm.roomCode);
    return buildSurfaceUrl({
      surface: "host",
      params: {
        mode: "host",
        hostUiVersion: "v2",
        view: "ops",
        section: "ops.room_setup",
        tab: "admin",
        onboarding: "1",
        source: "marketing_for_hosts",
        ...(roomCode ? { launch_room_code: roomCode } : {}),
        ...(privateForm.publicRoom ? { launch_public_room: "1" } : {}),
        ...(privateForm.virtualOnly ? { launch_virtual_only: "1" } : {}),
        ...(String(privateForm.title || "").trim() ? { launch_title: String(privateForm.title || "").trim() } : {}),
        ...(String(privateForm.description || "").trim() ? { launch_description: String(privateForm.description || "").trim() } : {}),
        ...(String(privateForm.startsAtLocal || "").trim() ? { launch_starts_at: String(privateForm.startsAtLocal || "").trim() } : {}),
        ...(String(privateForm.city || "").trim() ? { launch_city: String(privateForm.city || "").trim() } : {}),
        ...(String(privateForm.state || "").trim() ? { launch_state: String(privateForm.state || "").trim() } : {}),
      },
    }, window.location);
  }, [privateForm]);

  const openHostSetup = () => {
    if (!canSubmit) {
      authFlow?.requireFullAuth?.({
        intent: "private_session_create",
        targetType: "session",
        targetId: normalizeRoomCode(privateForm.roomCode),
        returnRoute: {
          page: "for_hosts",
          params: {
            intent: "private_session_create",
            targetType: "session",
            targetId: normalizeRoomCode(privateForm.roomCode),
          },
        },
      });
      setStatus("Sign in to launch room setup.");
      return;
    }
    if (!hostSetupHref) return;
    trackEvent("mk_host_setup_redirect", {
      source: "for_hosts_quick_launch",
      roomCode: normalizeRoomCode(privateForm.roomCode),
      publicRoom: privateForm.publicRoom ? 1 : 0,
      virtualOnly: privateForm.virtualOnly ? 1 : 0,
    });
    window.location.href = hostSetupHref;
  };

  useEffect(() => {
    const intent = String(route?.params?.intent || "").trim().toLowerCase();
    if (!canSubmit) return;
    if (intent !== "private_session_create") return;
    const runKey = `${intent}:${String(session?.uid || "")}`;
    if (autoLaunchIntentRef.current === runKey) return;
    autoLaunchIntentRef.current = runKey;
    trackEvent("mk_host_setup_redirect", {
      source: "for_hosts_resume_after_login",
      roomCode: normalizeRoomCode(privateForm.roomCode),
      publicRoom: privateForm.publicRoom ? 1 : 0,
      virtualOnly: privateForm.virtualOnly ? 1 : 0,
    });
    window.location.href = hostSetupHref;
  }, [canSubmit, hostSetupHref, privateForm.publicRoom, privateForm.roomCode, privateForm.virtualOnly, route?.params?.intent, session?.uid]);

  const loadRoomManagerData = useCallback(async () => {
    if (!canSubmit || !session?.uid) {
      setManagedRooms([]);
      setPublishedSessions([]);
      setManagedRoomsLoading(false);
      setPublishedSessionsLoading(false);
      setManagedRoomsError("");
      return;
    }
    setManagedRoomsLoading(true);
    setPublishedSessionsLoading(true);
    setManagedRoomsError("");
    setRoomManagerStatus("");
    try {
      const roomCollectionRef = collection(db, ...APP_ROOM_COLLECTION_PATH);
      const byHostUids = query(
        roomCollectionRef,
        where("hostUids", "array-contains", session.uid),
        limit(180)
      );
      const byHostUid = query(
        roomCollectionRef,
        where("hostUid", "==", session.uid),
        limit(180)
      );
      const qSessions = query(
        collection(db, "room_sessions"),
        where("hostUid", "==", session.uid),
        limit(180)
      );
      const [hostUidsSnap, hostUidSnap, sessionsSnap] = await Promise.all([
        getDocs(byHostUids),
        getDocs(byHostUid),
        getDocs(qSessions),
      ]);
      const merged = new Map();
      hostUidsSnap.docs.forEach((docSnap) => {
        merged.set(docSnap.id, toRoomManagerEntry(docSnap));
      });
      hostUidSnap.docs.forEach((docSnap) => {
        merged.set(docSnap.id, toRoomManagerEntry(docSnap));
      });
      const nextRooms = Array.from(merged.values()).sort(
        (a, b) => (b.updatedAtMs || b.createdAtMs || 0) - (a.updatedAtMs || a.createdAtMs || 0)
      );
      const nextSessions = sessionsSnap.docs
        .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
        .sort((a, b) => Number(b.startsAtMs || 0) - Number(a.startsAtMs || 0));
      setManagedRooms(nextRooms);
      setPublishedSessions(nextSessions);
    } catch (error) {
      setManagedRoomsError(String(error?.message || "Could not load room manager history."));
      setManagedRooms([]);
      setPublishedSessions([]);
    } finally {
      setManagedRoomsLoading(false);
      setPublishedSessionsLoading(false);
    }
  }, [canSubmit, session?.uid]);

  useEffect(() => {
    loadRoomManagerData();
  }, [loadRoomManagerData]);

  const activeRooms = useMemo(
    () => managedRooms.filter((entry) => !entry.isClosed && !entry.isArchived),
    [managedRooms]
  );
  const roomHistory = useMemo(
    () => managedRooms.filter((entry) => entry.isClosed || entry.isArchived),
    [managedRooms]
  );
  const roomManagerSummary = useMemo(
    () => ({
      total: managedRooms.length,
      active: activeRooms.length,
      history: roomHistory.length,
      recaps: managedRooms.filter((entry) => entry.hasRecap).length,
    }),
    [activeRooms.length, managedRooms, roomHistory.length]
  );

  const openManagedRoom = (roomCode = "") => {
    const safeCode = normalizeRoomCode(roomCode);
    if (!safeCode) return;
    const href = buildSurfaceUrl({
      surface: "host",
      params: {
        room: safeCode,
        mode: "host",
        hostUiVersion: "v2",
        view: "ops",
        section: "queue.live_run",
        tab: "queue",
        source: "marketing_host_room_manager",
      },
    }, window.location);
    window.location.href = href;
  };

  const openManagedAudienceJoin = (roomCode = "") => {
    const safeCode = normalizeRoomCode(roomCode);
    if (!safeCode) return;
    const href = buildSurfaceUrl({
      surface: "app",
      params: {
        room: safeCode,
        source: "marketing_host_room_manager_join",
      },
    }, window.location);
    window.open(href, "_blank", "noopener,noreferrer");
  };

  const openManagedAudienceRecap = (roomCode = "") => {
    const safeCode = normalizeRoomCode(roomCode);
    if (!safeCode) return;
    const href = buildSurfaceUrl({
      surface: "app",
      params: {
        room: safeCode,
        mode: "recap",
        source: "marketing_host_room_manager_recap",
      },
    }, window.location);
    window.open(href, "_blank", "noopener,noreferrer");
  };

  const openManagedTv = (roomCode = "") => {
    const safeCode = normalizeRoomCode(roomCode);
    if (!safeCode) return;
    const href = buildSurfaceUrl({
      surface: "tv",
      params: {
        room: safeCode,
        mode: "tv",
        source: "marketing_host_room_manager_tv",
      },
    }, window.location);
    window.open(href, "_blank", "noopener,noreferrer");
  };

  const copyManagedRoomCode = async (roomCode = "") => {
    const safeCode = normalizeRoomCode(roomCode);
    if (!safeCode) return;
    try {
      await navigator.clipboard.writeText(safeCode);
      setRoomManagerStatus(`Copied room code ${safeCode}.`);
    } catch {
      setRoomManagerStatus(`Room code: ${safeCode}`);
    }
  };

  return (
    <section className="mk3-page mk3-host-command">
      <article className="mk3-detail-card mk3-host-hero mk3-zone">
        <div className="mk3-host-kicker">for hosts</div>
        <h1>Run a stronger karaoke night with less setup noise.</h1>
        <p>
          BeauRocks is a control layer, not a catalog lock-in. Keep your existing content tools and run cleaner room
          flow across host, TV, and audience surfaces.
        </p>
        <div className="mk3-status mk3-status-warning">
          <strong>Content-agnostic by design</strong>
          <span>Hosts remain responsible for music-rights compliance.</span>
        </div>
        <div className="mk3-host-badge-row">
          {HOST_STACK_BADGES.map((badge) => (
            <span key={badge}>{badge}</span>
          ))}
        </div>
        <div className="mk3-actions-inline">
          <button
            type="button"
            onClick={() => {
              trackPersonaCta(canSubmit ? "primary_start_hosting" : "primary_start_hosting_auth_gate");
              openHostSetup();
            }}
          >
            Start Hosting
          </button>
          <button
            type="button"
            onClick={() => {
              trackPersonaCta("secondary_watch_demo");
              navigate("demo");
            }}
          >
            Watch Demo
          </button>
          <button
            type="button"
            onClick={() => {
              trackPersonaCta("tertiary_open_discover");
              navigate("discover");
            }}
          >
            Open Discover Map
          </button>
        </div>
      </article>

      <section className="mk3-detail-card mk3-host-flow mk3-zone" aria-label="Host flow overview">
        <h2>Host Flow In 3 Steps</h2>
        <div className="mk3-host-flow-grid">
          {HOST_QUICK_STEPS.map((step, index) => (
            <article key={step.title}>
              <span>{`Step ${index + 1}`}</span>
              <strong>{step.title}</strong>
              <p>{step.detail}</p>
            </article>
          ))}
        </div>
      </section>

      <div className="mk3-two-col mk3-host-late-grid">
        <article className="mk3-detail-card">
          <h2>Why Hosts Use It</h2>
          <ul className="mk3-plain-list">
            {HOST_OUTCOMES.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>

        <aside className="mk3-actions-card mk3-host-quick-card">
          <h4>Room Manager + Quick Launch</h4>
          <div className="mk3-status">
            <strong>Centralized in Host App</strong>
            <span>Room creation and publish controls now run in host.beaurocks.app.</span>
          </div>
          <div className="mk3-actions-inline">
            <button type="button" onClick={() => loadRoomManagerData()} disabled={managedRoomsLoading || publishedSessionsLoading}>
              {managedRoomsLoading || publishedSessionsLoading ? "Refreshing..." : "Refresh Rooms"}
            </button>
          </div>
          <div className="mk3-metric-row mk3-metric-row-mobile">
            <article className="mk3-metric"><span>Total Rooms</span><strong>{roomManagerSummary.total}</strong></article>
            <article className="mk3-metric"><span>Active</span><strong>{roomManagerSummary.active}</strong></article>
            <article className="mk3-metric"><span>History</span><strong>{roomManagerSummary.history}</strong></article>
            <article className="mk3-metric"><span>Recaps</span><strong>{roomManagerSummary.recaps}</strong></article>
          </div>
          {!!roomManagerStatus && <div className="mk3-status">{roomManagerStatus}</div>}

          <div className="mk3-actions-block">
            <label>
              Room Code (optional)
              <input
                value={privateForm.roomCode}
                onChange={(e) => setPrivateForm((prev) => ({ ...prev, roomCode: normalizeRoomCode(e.target.value) }))}
                placeholder="VIP123"
              />
            </label>
            <label>
              Session Title (optional)
              <input
                value={privateForm.title}
                onChange={(e) => setPrivateForm((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="Friends & Family Karaoke"
              />
            </label>
            <label>
              Start (optional)
              <input
                type="datetime-local"
                value={privateForm.startsAtLocal}
                onChange={(e) => setPrivateForm((prev) => ({ ...prev, startsAtLocal: e.target.value }))}
              />
            </label>
            <label>
              Notes (optional)
              <textarea
                value={privateForm.description}
                onChange={(e) => setPrivateForm((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Invite-only room."
              />
            </label>
            <label className="mk3-inline">
              <input
                type="checkbox"
                checked={privateForm.publicRoom}
                onChange={(e) => setPrivateForm((prev) => ({ ...prev, publicRoom: !!e.target.checked }))}
              />
              Public room (discoverable)
            </label>
            <label className="mk3-inline">
              <input
                type="checkbox"
                checked={privateForm.virtualOnly}
                onChange={(e) => setPrivateForm((prev) => ({ ...prev, virtualOnly: !!e.target.checked }))}
              />
              Virtual-only
            </label>
            {!privateForm.virtualOnly && (
              <>
                <label>
                  City (optional)
                  <input
                    value={privateForm.city}
                    onChange={(e) => setPrivateForm((prev) => ({ ...prev, city: e.target.value }))}
                    placeholder="Seattle"
                  />
                </label>
                <label>
                  State (optional)
                  <input
                    value={privateForm.state}
                    onChange={(e) => setPrivateForm((prev) => ({ ...prev, state: e.target.value }))}
                    placeholder="WA"
                  />
                </label>
              </>
            )}
            <button type="button" onClick={openHostSetup}>
              Continue In Host Dashboard
            </button>
            {!!status && <div className="mk3-status">{status}</div>}
          </div>

          <div className="mk3-sub-list compact">
            <h3>Your Rooms (All)</h3>
            {managedRoomsLoading && <div className="mk3-status">Loading your room manager...</div>}
            {!!managedRoomsError && <div className="mk3-status mk3-status-error">{managedRoomsError}</div>}
            {!managedRoomsLoading && !managedRoomsError && managedRooms.length === 0 && (
              <div className="mk3-status">
                No rooms found yet. Create your first room above and it will appear here.
              </div>
            )}
            {!managedRoomsLoading && managedRooms.map((room) => {
              const statusLabel = room.isArchived ? "Archived" : room.isClosed ? "Closed" : "Active";
              return (
                <article key={room.id} className="mk3-host-room-row">
                  <div className="mk3-host-room-row-head">
                    <strong>{room.title}</strong>
                    <span>{statusLabel}</span>
                  </div>
                  <div className="mk3-host-room-row-meta">
                    <span>Code: {room.code || room.id}</span>
                    <span>Mode: {room.activeMode || "karaoke"}</span>
                    <span>Updated: {formatDateTime(room.updatedAtMs)}</span>
                    {room.hasRecap && <span>Recap: {formatDateTime(room.recapAtMs || room.closedAtMs)}</span>}
                  </div>
                  <div className="mk3-actions-inline mk3-host-room-actions">
                    <button type="button" onClick={() => openManagedRoom(room.code)}>
                      Open Host
                    </button>
                    <button type="button" onClick={() => openManagedTv(room.code)}>
                      Open TV
                    </button>
                    <button type="button" onClick={() => openManagedAudienceJoin(room.code)}>
                      Join Room
                    </button>
                    <button type="button" onClick={() => copyManagedRoomCode(room.code)}>
                      Copy Code
                    </button>
                    <button
                      type="button"
                      onClick={() => openManagedAudienceRecap(room.code)}
                      disabled={!room.hasRecap}
                    >
                      View Recap
                    </button>
                  </div>
                </article>
              );
            })}
          </div>

          <div className="mk3-sub-list compact">
            <h3>Published Room Listings</h3>
            {publishedSessionsLoading && (
              <div className="mk3-status">
                Loading published listings...
              </div>
            )}
            {!publishedSessionsLoading && !publishedSessions.length && (
              <div className="mk3-status">
                No room sessions published yet.
              </div>
            )}
            {publishedSessions.map((sessionItem) => (
              <article key={sessionItem.id} className="mk3-host-room-row">
                <div className="mk3-host-room-row-head">
                  <strong>{sessionItem.title || sessionItem.id}</strong>
                  <span>{String(sessionItem.status || "unknown").toLowerCase()}</span>
                </div>
                <div className="mk3-host-room-row-meta">
                  <span>Visibility: {String(sessionItem.visibility || "public").toLowerCase()}</span>
                  <span>Start: {formatDateTime(sessionItem.startsAtMs)}</span>
                  {sessionItem.roomCode && <span>Code: {String(sessionItem.roomCode || "").trim().toUpperCase()}</span>}
                  <span>Type: Room session</span>
                </div>
                <div className="mk3-actions-inline mk3-host-room-actions">
                  <button
                    type="button"
                    onClick={() => navigate("session", sessionItem.id)}
                  >
                    Open Listing
                  </button>
                  {!!sessionItem.roomCode && (
                    <button
                      type="button"
                      onClick={() => openManagedAudienceJoin(sessionItem.roomCode)}
                    >
                      Join Room
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        </aside>
      </div>
    </section>
  );
};

export default ForHostsPage;
