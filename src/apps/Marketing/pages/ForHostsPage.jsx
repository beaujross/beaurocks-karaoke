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

const ForHostsPage = ({ route, session, authFlow }) => {
  const canSubmit = !!session?.uid && !session?.isAnonymous;
  const autoLaunchIntentRef = useRef("");
  const roomManagerRef = useRef(null);
  const [managedRooms, setManagedRooms] = useState([]);
  const [managedRoomsLoading, setManagedRoomsLoading] = useState(false);
  const [managedRoomsError, setManagedRoomsError] = useState("");
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
      setManagedRoomsLoading(false);
      setManagedRoomsError("");
      return;
    }
    setManagedRoomsLoading(true);
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
      const [hostUidsSnap, hostUidSnap] = await Promise.all([
        getDocs(byHostUids),
        getDocs(byHostUid),
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
      setManagedRooms(nextRooms);
    } catch (error) {
      setManagedRoomsError(String(error?.message || "Could not load room manager history."));
      setManagedRooms([]);
    } finally {
      setManagedRoomsLoading(false);
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
  const recentRooms = useMemo(
    () => managedRooms.slice(0, 8),
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

  return (
    <section className="mk3-page mk3-host-command mk3-host-rebuild">
      <article className="mk3-detail-card mk3-host-hero mk3-zone mk3-host-hero-rebuild mk3-host-canon-surface">
        <div className="mk3-host-kicker mk3-host-canon-kicker">host room control</div>
        <h1 className="mk3-host-canon-title is-xl">Simple host workflow: log in, launch room, run show, review recap.</h1>
        <p className="mk3-host-canon-copy">
          This page is now the fast path into Host Dashboard Room Setup and your room manager history.
        </p>
        <div className="mk3-status mk3-status-warning">
          <strong>Account required to host</strong>
          <span>Guests can join rooms without an account, but creating and running rooms requires a BeauRocks account.</span>
        </div>
        <div className="mk3-host-badge-row mk3-host-canon-chip-row">
          {HOST_STACK_BADGES.map((badge) => (
            <span key={badge} className="mk3-host-canon-chip">{badge}</span>
          ))}
        </div>
        <div className="mk3-host-primary-actions">
          <button
            className="mk3-host-canon-button is-primary"
            type="button"
            onClick={() => {
              trackPersonaCta(canSubmit ? "hero_open_host_dashboard" : "hero_host_auth_gate");
              openHostSetup();
            }}
          >
            {canSubmit ? "Open Host Dashboard" : "Host Log In"}
          </button>
        </div>
      </article>

      <section className="mk3-detail-card mk3-host-manager-card mk3-host-canon-surface is-muted" ref={roomManagerRef}>
        <div className="mk3-host-manager-head">
          <h2 className="mk3-host-canon-title is-md">Recent Rooms</h2>
          <div className="mk3-actions-inline">
            <button className="mk3-host-canon-button" type="button" onClick={() => loadRoomManagerData()} disabled={managedRoomsLoading}>
              {managedRoomsLoading ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>
        <p className="mk3-host-setup-subcopy">
          This page is now a launcher view. Full room setup, cleanup, archive, and restore live in Host Control Surface.
        </p>
        <div className="mk3-metric-row mk3-metric-row-mobile">
          <article className="mk3-metric"><span>Total Rooms</span><strong>{roomManagerSummary.total}</strong></article>
          <article className="mk3-metric"><span>Active</span><strong>{roomManagerSummary.active}</strong></article>
          <article className="mk3-metric"><span>History</span><strong>{roomManagerSummary.history}</strong></article>
          <article className="mk3-metric"><span>Recaps</span><strong>{roomManagerSummary.recaps}</strong></article>
        </div>
        {!!roomManagerStatus && <div className="mk3-status">{roomManagerStatus}</div>}
        {managedRoomsLoading && <div className="mk3-status">Loading your room manager...</div>}
        {!!managedRoomsError && <div className="mk3-status mk3-status-error">{managedRoomsError}</div>}
        {!managedRoomsLoading && !managedRoomsError && !recentRooms.length && (
          <div className="mk3-status">
            {canSubmit
              ? "No recent rooms yet. Start a room and it will appear here."
              : "Log in with a BeauRocks account to load your rooms."}
          </div>
        )}
        {!managedRoomsLoading && recentRooms.map((room) => {
          const statusLabel = room.isArchived ? "Archived" : room.isClosed ? "Closed" : "Active";
          const roomCode = room.code || room.id;
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
                <button className="mk3-host-canon-button is-primary" type="button" onClick={() => openManagedRoom(roomCode)}>
                  Open Host
                </button>
              </div>
            </article>
          );
        })}
      </section>
    </section>
  );
};

export default ForHostsPage;
