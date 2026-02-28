import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  fetchEntityDoc,
  subscribeDocById,
  subscribeOwnDashboard,
  subscribeProfileByUid,
  directoryActions,
} from "../api/directoryApi";
import { formatDateTime } from "./shared";
import {
  collectFollowedHostIds,
} from "../dashboardUtils";

const ROLE_OPTIONS = [
  { id: "host", label: "Host" },
  { id: "venue_owner", label: "Venue Owner" },
  { id: "performer", label: "Performer" },
  { id: "fan", label: "Fan" },
];

const ProfileDashboardPage = ({ session, navigate }) => {
  const uid = session?.uid || "";
  const canUseDashboard = !!uid && !session?.isAnonymous;
  const [profile, setProfile] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [history, setHistory] = useState({
    follows: [],
    checkins: [],
    reviews: [],
    submissions: [],
    rsvps: [],
    reminders: [],
    performanceHistory: [],
  });
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [nextSteps, setNextSteps] = useState([]);
  const [form, setForm] = useState({
    displayName: "",
    handle: "",
    bio: "",
    city: "",
    state: "",
    country: "US",
    visibility: "public",
    roles: ["fan"],
  });
  const [followedHostProfiles, setFollowedHostProfiles] = useState([]);
  const [followedHostsLoading, setFollowedHostsLoading] = useState(false);
  const [moderationQueue, setModerationQueue] = useState([]);
  const [moderationLoading, setModerationLoading] = useState(false);
  const [moderationStatus, setModerationStatus] = useState("");

  useEffect(() => {
    if (!canUseDashboard) {
      setProfile(null);
      return () => {};
    }
    return subscribeProfileByUid({
      uid,
      onData: (nextProfile) => {
        setProfile(nextProfile || null);
      },
      onError: () => setProfile(null),
    });
  }, [canUseDashboard, uid]);

  useEffect(() => {
    if (!canUseDashboard) {
      setUserProfile(null);
      return () => {};
    }
    return subscribeDocById({
      collectionName: "users",
      id: uid,
      onData: (nextUser) => setUserProfile(nextUser || null),
      onError: () => setUserProfile(null),
    });
  }, [canUseDashboard, uid]);

  useEffect(() => {
    if (!canUseDashboard) {
      setHistory({
        follows: [],
        checkins: [],
        reviews: [],
        submissions: [],
        rsvps: [],
        reminders: [],
        performanceHistory: [],
      });
      return () => {};
    }
    return subscribeOwnDashboard({
      uid,
      onData: setHistory,
      onError: () => setHistory({
        follows: [],
        checkins: [],
        reviews: [],
        submissions: [],
        rsvps: [],
        reminders: [],
        performanceHistory: [],
      }),
    });
  }, [canUseDashboard, uid]);

  useEffect(() => {
    if (!profile) return;
    setForm({
      displayName: profile.displayName || "",
      handle: profile.handle || "",
      bio: profile.bio || "",
      city: profile.city || "",
      state: profile.state || "",
      country: profile.country || "US",
      visibility: profile.visibility || "public",
      roles: Array.isArray(profile.roles) && profile.roles.length ? profile.roles : ["fan"],
    });
  }, [profile]);

  const inferredDisplayName = useMemo(() => {
    const fromDirectory = String(profile?.displayName || "").trim();
    if (fromDirectory) return fromDirectory;
    const fromUserDoc = String(userProfile?.name || "").trim();
    if (fromUserDoc) return fromUserDoc;
    const email = String(session?.email || "").trim();
    if (email.includes("@")) return email.split("@")[0];
    return "";
  }, [profile?.displayName, session?.email, userProfile?.name]);

  useEffect(() => {
    if (!canUseDashboard || profile) return;
    if (!inferredDisplayName) return;
    setForm((prev) => {
      if (String(prev.displayName || "").trim()) return prev;
      return {
        ...prev,
        displayName: inferredDisplayName,
        handle: String(prev.handle || "").trim() ? prev.handle : inferredDisplayName.toLowerCase().replace(/[^a-z0-9]+/g, "_"),
      };
    });
  }, [canUseDashboard, inferredDisplayName, profile]);

  const followedHostIds = useMemo(
    () => collectFollowedHostIds(history.follows),
    [history.follows]
  );

  useEffect(() => {
    if (!canUseDashboard || !followedHostIds.length) {
      setFollowedHostProfiles([]);
      setFollowedHostsLoading(false);
      return;
    }
    let cancelled = false;
    setFollowedHostsLoading(true);
    (async () => {
      const docs = await Promise.all(
        followedHostIds.slice(0, 12).map(async (hostId) => {
          try {
            return await fetchEntityDoc({ collectionName: "directory_profiles", id: hostId });
          } catch {
            return null;
          }
        })
      );
      if (cancelled) return;
      setFollowedHostProfiles(docs.filter(Boolean));
      setFollowedHostsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [canUseDashboard, followedHostIds]);

  const hostNameById = useMemo(() => {
    const next = new Map();
    followedHostProfiles.forEach((entry) => {
      const id = String(entry?.id || entry?.uid || "").trim();
      const displayName = String(entry?.displayName || entry?.handle || "").trim();
      if (id && displayName) next.set(id, displayName);
    });
    return next;
  }, [followedHostProfiles]);

  const loadCatalogModerationQueue = useCallback(async () => {
    if (!session?.isModerator) return;
    setModerationLoading(true);
    setModerationStatus("");
    try {
      const result = await directoryActions.listCatalogContributionQueue({
        status: "pending",
        limit: 40,
      });
      setModerationQueue(Array.isArray(result?.items) ? result.items : []);
    } catch (error) {
      setModerationStatus(String(error?.message || "Could not load catalog moderation queue."));
    } finally {
      setModerationLoading(false);
    }
  }, [session?.isModerator]);

  useEffect(() => {
    if (!canUseDashboard || !session?.isModerator) {
      setModerationQueue([]);
      setModerationStatus("");
      return;
    }
    loadCatalogModerationQueue();
  }, [canUseDashboard, loadCatalogModerationQueue, session?.isModerator]);

  const toggleRole = (roleId) => {
    setForm((prev) => {
      const hasRole = prev.roles.includes(roleId);
      if (hasRole) {
        const next = prev.roles.filter((item) => item !== roleId);
        return { ...prev, roles: next.length ? next : ["fan"] };
      }
      return { ...prev, roles: [...prev.roles, roleId] };
    });
  };

  const summary = useMemo(() => ({
    follows: history.follows.length,
    checkins: history.checkins.length,
    reviews: history.reviews.length,
    submissions: history.submissions.length,
    rsvps: history.rsvps.length,
    performances: history.performanceHistory.length,
  }), [history]);

  const performanceStats = useMemo(() => {
    const source = Array.isArray(history.performanceHistory) ? history.performanceHistory : [];
    const songCounts = new Map();
    const roomCounts = new Map();
    const hostCounts = new Map();
    source.forEach((entry) => {
      const songTitle = String(entry.songTitle || "").trim();
      if (songTitle) songCounts.set(songTitle, (songCounts.get(songTitle) || 0) + 1);
      const roomCode = String(entry.roomCode || "").trim().toUpperCase();
      if (roomCode) roomCounts.set(roomCode, (roomCounts.get(roomCode) || 0) + 1);
    });
    (Array.isArray(history.follows) ? history.follows : []).forEach((entry) => {
      if (String(entry.targetType || "") !== "host") return;
      const token = String(entry.targetId || "").trim();
      if (!token) return;
      hostCounts.set(token, (hostCounts.get(token) || 0) + 1);
    });
    const topSongs = Array.from(songCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    const topRooms = Array.from(roomCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    const topHosts = Array.from(hostCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);
    return {
      total: source.length,
      topSongs,
      topRooms,
      topHosts,
      recent: source.slice(0, 10),
    };
  }, [history.performanceHistory, history.follows]);

  const saveProfile = async () => {
    if (!canUseDashboard) {
      setStatus("Create an account to edit your profile.");
      return;
    }
    const safeDisplayName = String(form.displayName || "").trim();
    if (!safeDisplayName) {
      setStatus("Display name is required before saving profile.");
      return;
    }
    setSaving(true);
    setStatus("");
    try {
      await directoryActions.upsertDirectoryProfile({
        profile: {
          ...form,
          displayName: safeDisplayName,
          handle: String(form.handle || "").trim() || safeDisplayName.toLowerCase().replace(/[^a-z0-9]+/g, "_"),
        },
      });
      setStatus("Profile updated.");
      setNextSteps([
        {
          id: "follow_hosts",
          label: "Next: Follow 3 hosts",
          onClick: () => navigate("discover", "", { intent: "follow", targetType: "host" }),
        },
        {
          id: "rsvp_first",
          label: "Next: RSVP to first event",
          onClick: () => navigate("discover", "", { intent: "rsvp", targetType: "event" }),
        },
      ]);
    } catch (error) {
      setStatus(String(error?.message || "Could not save profile."));
    } finally {
      setSaving(false);
    }
  };

  const resolveCatalogContributionItem = async (contributionId = "", action = "approve") => {
    if (!session?.isModerator || !contributionId) return;
    setModerationLoading(true);
    setModerationStatus("");
    try {
      await directoryActions.resolveCatalogContribution({
        contributionId,
        action,
        notes: action === "approve" ? "Approved from marketing moderator dashboard." : "Rejected from marketing moderator dashboard.",
      });
      setModerationStatus(action === "approve" ? "Contribution approved." : "Contribution rejected.");
      await loadCatalogModerationQueue();
    } catch (error) {
      setModerationStatus(String(error?.message || "Could not resolve catalog contribution."));
    } finally {
      setModerationLoading(false);
    }
  };

  if (!canUseDashboard) {
    return (
      <section className="mk3-page">
        <div className="mk3-actions-card">
          <h4>Profile Dashboard</h4>
          <p>Use the sign-in panel above to access your history dashboard and saved activity.</p>
          <div className="mk3-status">
            <strong>Access details</strong>
            <span>After sign in, you will return here automatically.</span>
          </div>
          <div className="mk3-actions-inline">
            <button type="button" onClick={() => navigate("discover")}>
              Open Setlist Finder
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="mk3-page mk3-two-col">
      <article className="mk3-detail-card">
        <div className="mk3-chip">account dashboard</div>
        <h2>Profile Dashboard</h2>
        <p>Manage your public profile and keep your account details up to date.</p>

        <div className="mk3-form-grid">
          <label>
            Display Name
            <input value={form.displayName} onChange={(e) => setForm((prev) => ({ ...prev, displayName: e.target.value }))} />
          </label>
          <label>
            Handle
            <input value={form.handle} onChange={(e) => setForm((prev) => ({ ...prev, handle: e.target.value }))} />
          </label>
          <label className="full">
            Bio
            <textarea value={form.bio} onChange={(e) => setForm((prev) => ({ ...prev, bio: e.target.value }))} />
          </label>
          <label>
            City
            <input value={form.city} onChange={(e) => setForm((prev) => ({ ...prev, city: e.target.value }))} />
          </label>
          <label>
            State
            <input value={form.state} onChange={(e) => setForm((prev) => ({ ...prev, state: e.target.value }))} />
          </label>
          <label>
            Country
            <input value={form.country} onChange={(e) => setForm((prev) => ({ ...prev, country: e.target.value }))} />
          </label>
          <label>
            Visibility
            <select value={form.visibility} onChange={(e) => setForm((prev) => ({ ...prev, visibility: e.target.value }))}>
              <option value="public">Public</option>
              <option value="private">Private</option>
            </select>
          </label>
        </div>

        <div className="mk3-tag-pills">
          {ROLE_OPTIONS.map((role) => (
            <button
              type="button"
              key={role.id}
              className={form.roles.includes(role.id) ? "mk3-tag active" : "mk3-tag"}
              onClick={() => toggleRole(role.id)}
            >
              {role.label}
            </button>
          ))}
        </div>

        <div className="mk3-actions-inline">
          <button type="button" onClick={saveProfile} disabled={saving}>
            {saving ? "Saving..." : "Save Profile"}
          </button>
          <button type="button" onClick={() => navigate("submit")}>
            Submit Listing
          </button>
        </div>
        {status && <div className="mk3-status">{status}</div>}
        {nextSteps.length > 0 && (
          <div className="mk3-actions-inline">
            {nextSteps.map((step) => (
              <button key={step.id} type="button" className="mk3-inline-next" onClick={step.onClick}>
                {step.label}
              </button>
            ))}
          </div>
        )}
      </article>

      <aside className="mk3-actions-card">
        <h4>Full History Snapshot</h4>
        <div className="mk3-metric-row">
          <article className="mk3-metric"><span>Following</span><strong>{summary.follows}</strong></article>
          <article className="mk3-metric"><span>Check-ins</span><strong>{summary.checkins}</strong></article>
          <article className="mk3-metric"><span>Reviews</span><strong>{summary.reviews}</strong></article>
          <article className="mk3-metric"><span>Listings</span><strong>{summary.submissions}</strong></article>
          <article className="mk3-metric"><span>RSVPs</span><strong>{summary.rsvps}</strong></article>
          <article className="mk3-metric"><span>Performances</span><strong>{summary.performances}</strong></article>
        </div>

        <div className="mk3-sub-list compact">
          <h3>Followed Host Profiles</h3>
          {followedHostsLoading && <div className="mk3-status">Loading host profiles...</div>}
          {!followedHostsLoading && followedHostProfiles.map((item) => (
            <button key={item.id} type="button" className="mk3-list-row" onClick={() => navigate("host", item.id)}>
              <span>{item.displayName || item.handle || item.id}</span>
              <span>{item.city ? `${item.city}, ${item.state || ""}`.replace(/,\s*$/, "") : "Open profile"}</span>
            </button>
          ))}
          {!followedHostsLoading && !followedHostProfiles.length && (
            <div className="mk3-status">
              <span>Follow hosts in the Setlist Finder to pin them here for quick profile access.</span>
            </div>
          )}
        </div>

        {session?.isModerator && (
          <div className="mk3-sub-list compact">
            <h3>Catalog Moderation Queue</h3>
            <div className="mk3-actions-inline">
              <button type="button" onClick={loadCatalogModerationQueue} disabled={moderationLoading}>
                {moderationLoading ? "Refreshing..." : "Refresh Queue"}
              </button>
            </div>
            {moderationStatus && <div className="mk3-status">{moderationStatus}</div>}
            {moderationQueue.slice(0, 12).map((item) => (
              <div key={item.id} className="mk3-list-row">
                <span>
                  {item?.payload?.title || "Untitled"} - {item?.payload?.artist || "Unknown"} ({item?.payload?.source || "custom"})
                </span>
                <div className="mk3-actions-inline">
                  <button
                    type="button"
                    onClick={() => resolveCatalogContributionItem(item.id, "approve")}
                    disabled={moderationLoading}
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => resolveCatalogContributionItem(item.id, "reject")}
                    disabled={moderationLoading}
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
            {!moderationLoading && !moderationQueue.length && (
              <div className="mk3-status">No pending catalog contributions.</div>
            )}
          </div>
        )}

        <div className="mk3-sub-list compact">
          <h3>Recent RSVPs</h3>
          {history.rsvps.slice(0, 8).map((item) => (
            <div key={item.id || item.docId} className="mk3-list-row static">
              <span>{item.targetType}: {item.targetId}</span>
              <span>{item.status || "going"}</span>
            </div>
          ))}
        </div>

        <div className="mk3-sub-list compact">
          <h3>Recent Check-ins</h3>
          {history.checkins.slice(0, 8).map((item) => (
            <div key={item.id || item.checkinId} className="mk3-list-row static">
              <span>{item.targetType}: {item.targetId}</span>
              <span>{formatDateTime(item.createdAt?.toMillis ? item.createdAt.toMillis() : item.createdAtMs || 0)}</span>
            </div>
          ))}
        </div>

        <div className="mk3-sub-list compact">
          <h3>Recent Submissions</h3>
          {history.submissions.slice(0, 8).map((item) => (
            <div key={item.id || item.submissionId} className="mk3-list-row static">
              <span>{item.listingType}</span>
              <span>{item.status}</span>
            </div>
          ))}
        </div>

        <div className="mk3-sub-list compact">
          <h3>Performance History</h3>
          <div className="mk3-list-row static">
            <span>Total performances</span>
            <span>{performanceStats.total}</span>
          </div>
          {performanceStats.topSongs.map(([songTitle, count]) => (
            <div key={songTitle} className="mk3-list-row static">
              <span>{songTitle}</span>
              <span>{count}</span>
            </div>
          ))}
          {performanceStats.topRooms.map(([roomCode, count]) => (
            <div key={roomCode} className="mk3-list-row static">
              <span>Room {roomCode}</span>
              <span>{count}</span>
            </div>
          ))}
          {performanceStats.topHosts.map(([hostId, count]) => (
            <button key={hostId} type="button" className="mk3-list-row" onClick={() => navigate("host", hostId)}>
              <span>{hostNameById.get(hostId) || `Host ${hostId}`}</span>
              <span>{count} follows</span>
            </button>
          ))}
          {performanceStats.recent.slice(0, 6).map((entry) => (
            <div key={entry.id || `${entry.songId}_${entry.timestamp?.seconds || 0}`} className="mk3-list-row static">
              <span>{entry.songTitle || "Untitled song"}</span>
              <span>{entry.artist || "Unknown artist"}</span>
            </div>
          ))}
        </div>
      </aside>
    </section>
  );
};

export default ProfileDashboardPage;
