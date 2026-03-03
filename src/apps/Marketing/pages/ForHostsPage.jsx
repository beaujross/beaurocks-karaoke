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
  "Simple 4-button host flow",
  "Room manager built in",
  "Works with your current setup",
];

const HOST_QUICK_STEPS = [
  {
    title: "Log in",
    detail: "Use your BeauRocks account once and stay in host mode.",
  },
  {
    title: "Launch",
    detail: "Create or open a room with room code defaults already filled.",
  },
  {
    title: "Run show",
    detail: "Use Host, TV, and audience links from one manager surface.",
  },
  {
    title: "Review recap",
    detail: "Jump back into room history and recaps in one click.",
  },
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
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [roomFilter, setRoomFilter] = useState("active");
  const autoLaunchIntentRef = useRef("");
  const roomManagerRef = useRef(null);
  const [managedRooms, setManagedRooms] = useState([]);
  const [managedRoomsLoading, setManagedRoomsLoading] = useState(false);
  const [managedRoomsError, setManagedRoomsError] = useState("");
  const [publishedSessions, setPublishedSessions] = useState([]);
  const [publishedSessionsLoading, setPublishedSessionsLoading] = useState(false);
  const [roomManagerStatus, setRoomManagerStatus] = useState("");

  const trackPersonaCta = (cta = "") => {
    trackEvent("mk_persona_cta_click", {
      persona: "host",
      page: "for_hosts",
      cta: String(cta || ""),
    });
  };

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

  const openHostSetup = useCallback(() => {
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
      setStatus("Sign in with your BeauRocks account to launch room setup.");
      return;
    }
    if (!hostSetupHref) return;
    trackEvent("mk_host_setup_redirect", {
      source: "for_hosts_wizard_launch",
      roomCode: normalizeRoomCode(privateForm.roomCode),
      publicRoom: privateForm.publicRoom ? 1 : 0,
      virtualOnly: privateForm.virtualOnly ? 1 : 0,
    });
    window.location.href = hostSetupHref;
  }, [authFlow, canSubmit, hostSetupHref, privateForm.publicRoom, privateForm.roomCode, privateForm.virtualOnly]);

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
  const filteredRooms = useMemo(() => {
    if (roomFilter === "history") return roomHistory;
    if (roomFilter === "all") return managedRooms;
    return activeRooms;
  }, [activeRooms, managedRooms, roomFilter, roomHistory]);
  const roomManagerSummary = useMemo(
    () => ({
      total: managedRooms.length,
      active: activeRooms.length,
      history: roomHistory.length,
      recaps: managedRooms.filter((entry) => entry.hasRecap).length,
      published: publishedSessions.length,
    }),
    [activeRooms.length, managedRooms, publishedSessions.length, roomHistory.length]
  );
  const latestActiveRoomCode = useMemo(
    () => String(activeRooms[0]?.code || "").trim().toUpperCase(),
    [activeRooms]
  );

  const focusRoomManager = useCallback((nextFilter = "active") => {
    setRoomFilter(nextFilter);
    roomManagerRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" });
  }, []);

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
    <section className="mk3-page mk3-host-command mk3-host-rebuild">
      <article className="mk3-detail-card mk3-host-hero mk3-zone mk3-host-hero-rebuild">
        <div className="mk3-host-kicker">host room control</div>
        <h1>Simple host workflow: log in, launch room, run show, review recap.</h1>
        <p>
          This page is now focused on the fast path. Keep room setup simple here, then hand off to Host Dashboard for
          live operations.
        </p>
        <div className="mk3-status mk3-status-warning">
          <strong>Account required to host</strong>
          <span>Guests can join rooms without an account, but creating and running rooms requires a BeauRocks account.</span>
        </div>
        <div className="mk3-host-badge-row">
          {HOST_STACK_BADGES.map((badge) => (
            <span key={badge}>{badge}</span>
          ))}
        </div>
        <div className="mk3-host-primary-actions">
          <button
            type="button"
            onClick={() => {
              trackPersonaCta(canSubmit ? "hero_start_new_room" : "hero_start_new_room_auth_gate");
              openHostSetup();
            }}
          >
            Start New Room
          </button>
          <button
            type="button"
            onClick={() => {
              trackPersonaCta("hero_resume_last_room");
              if (latestActiveRoomCode) {
                openManagedRoom(latestActiveRoomCode);
                return;
              }
              focusRoomManager("active");
            }}
            disabled={!latestActiveRoomCode && managedRoomsLoading}
          >
            {latestActiveRoomCode ? `Resume ${latestActiveRoomCode}` : "Open Active Rooms"}
          </button>
          <button
            type="button"
            onClick={() => {
              trackPersonaCta("hero_room_history");
              focusRoomManager("history");
            }}
          >
            Room History
          </button>
          <button
            type="button"
            onClick={() => {
              trackPersonaCta("hero_watch_demo");
              navigate("demo");
            }}
          >
            Watch Demo
          </button>
        </div>
      </article>

      <section className="mk3-detail-card mk3-host-flow mk3-zone" aria-label="Host flow overview">
        <h2>Host Flow</h2>
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

      <div className="mk3-two-col mk3-host-rebuild-grid">
        <aside className="mk3-actions-card mk3-host-setup-card">
          <h4>Room Launch Wizard</h4>
          <p className="mk3-host-setup-subcopy">
            Keep this short. Only room code and title are optional. Advanced fields are available if you need them.
          </p>
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
                placeholder="Friday Main Room"
              />
            </label>
            <div className="mk3-host-toggle-grid">
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
                Virtual-only room
              </label>
            </div>
            <button type="button" onClick={openHostSetup}>
              Continue In Host Dashboard
            </button>
            <button type="button" onClick={() => navigate("join")}>
              Open Join By Code
            </button>
            <button
              type="button"
              className={showAdvanced ? "is-secondary-active" : ""}
              onClick={() => setShowAdvanced((value) => !value)}
            >
              {showAdvanced ? "Hide Advanced Fields" : "Show Advanced Fields"}
            </button>
            {showAdvanced && (
              <div className="mk3-host-advanced-grid">
                <label>
                  Start Time (optional)
                  <input
                    type="datetime-local"
                    value={privateForm.startsAtLocal}
                    onChange={(e) => setPrivateForm((prev) => ({ ...prev, startsAtLocal: e.target.value }))}
                  />
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
                <label>
                  Notes (optional)
                  <textarea
                    value={privateForm.description}
                    onChange={(e) => setPrivateForm((prev) => ({ ...prev, description: e.target.value }))}
                    placeholder="Invite-only, private event, etc."
                  />
                </label>
              </div>
            )}
            {!!status && <div className="mk3-status">{status}</div>}
          </div>
        </aside>

        <section className="mk3-detail-card mk3-host-manager-card" ref={roomManagerRef}>
          <div className="mk3-host-manager-head">
            <h2>Room Manager</h2>
            <div className="mk3-actions-inline">
              <button type="button" onClick={() => loadRoomManagerData()} disabled={managedRoomsLoading || publishedSessionsLoading}>
                {managedRoomsLoading || publishedSessionsLoading ? "Refreshing..." : "Refresh"}
              </button>
            </div>
          </div>
          <div className="mk3-metric-row mk3-metric-row-mobile">
            <article className="mk3-metric"><span>Total Rooms</span><strong>{roomManagerSummary.total}</strong></article>
            <article className="mk3-metric"><span>Active</span><strong>{roomManagerSummary.active}</strong></article>
            <article className="mk3-metric"><span>History</span><strong>{roomManagerSummary.history}</strong></article>
            <article className="mk3-metric"><span>Recaps</span><strong>{roomManagerSummary.recaps}</strong></article>
            <article className="mk3-metric"><span>Listings</span><strong>{roomManagerSummary.published}</strong></article>
          </div>
          <div className="mk3-host-filter-row" role="tablist" aria-label="Room filters">
            <button type="button" className={roomFilter === "active" ? "active" : ""} onClick={() => setRoomFilter("active")}>
              Active
            </button>
            <button type="button" className={roomFilter === "history" ? "active" : ""} onClick={() => setRoomFilter("history")}>
              History
            </button>
            <button type="button" className={roomFilter === "all" ? "active" : ""} onClick={() => setRoomFilter("all")}>
              All
            </button>
          </div>
          {!!roomManagerStatus && <div className="mk3-status">{roomManagerStatus}</div>}
          {managedRoomsLoading && <div className="mk3-status">Loading your room manager...</div>}
          {!!managedRoomsError && <div className="mk3-status mk3-status-error">{managedRoomsError}</div>}
          {!managedRoomsLoading && !managedRoomsError && !filteredRooms.length && (
            <div className="mk3-status">
              {canSubmit
                ? "No rooms in this filter yet. Start a room and it will appear here."
                : "Log in with a BeauRocks account to load your rooms."}
            </div>
          )}
          {!managedRoomsLoading && filteredRooms.map((room) => {
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
        </section>
      </div>

      <section className="mk3-detail-card">
        <h2>Published Room Listings</h2>
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
        <div className="mk3-sub-list compact">
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
      </section>
    </section>
  );
};

export default ForHostsPage;
