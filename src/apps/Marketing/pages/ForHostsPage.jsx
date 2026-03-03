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
  "Room manager first",
  "One login, one control surface",
];

const HOST_QUICK_STEPS = [
  {
    title: "Log in",
    detail: "Use your BeauRocks account once and stay in host mode.",
  },
  {
    title: "Launch",
    detail: "Open Host Dashboard and launch from Room Setup in one place.",
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
    return buildSurfaceUrl({
      surface: "host",
      params: {
        mode: "host",
        hostUiVersion: "v2",
        view: "ops",
        section: "ops.room_setup",
        tab: "admin",
        source: "marketing_for_hosts",
      },
    }, window.location);
  }, []);

  const openHostSetup = useCallback(() => {
    if (!canSubmit) {
      authFlow?.requireFullAuth?.({
        intent: "host_dashboard_resume",
        targetType: "session",
        returnRoute: {
          page: "for_hosts",
          params: {
            intent: "host_dashboard_resume",
            targetType: "session",
          },
        },
      });
      return;
    }
    if (!hostSetupHref) return;
    trackEvent("mk_host_setup_redirect", {
      source: "for_hosts_room_manager_launch",
    });
    window.location.href = hostSetupHref;
  }, [authFlow, canSubmit, hostSetupHref]);

  useEffect(() => {
    const intent = String(route?.params?.intent || "").trim().toLowerCase();
    if (!canSubmit) return;
    if (intent !== "host_dashboard_resume") return;
    const runKey = `${intent}:${String(session?.uid || "")}`;
    if (autoLaunchIntentRef.current === runKey) return;
    autoLaunchIntentRef.current = runKey;
    trackEvent("mk_host_setup_redirect", {
      source: "for_hosts_resume_after_login",
    });
    window.location.href = hostSetupHref;
  }, [canSubmit, hostSetupHref, route?.params?.intent, session?.uid]);

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
          This page is now the fast path into Host Dashboard Room Setup and your room manager history.
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
            Open Host Dashboard
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
          <h4>Host Dashboard Entry</h4>
          <p className="mk3-host-setup-subcopy">
            Room creation now lives directly in Host Dashboard Room Setup. This page is for access and room management.
          </p>
          <div className="mk3-actions-block">
            <button type="button" onClick={openHostSetup}>
              Open Host Dashboard
            </button>
            <button type="button" onClick={() => navigate("join")}>
              Open Join By Code
            </button>
            <div className="mk3-status">
              Room history, recap access, and quick launch actions are all managed below.
            </div>
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
