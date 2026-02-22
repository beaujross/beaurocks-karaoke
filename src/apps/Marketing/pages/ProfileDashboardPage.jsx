import React, { useEffect, useMemo, useState } from "react";
import { subscribeOwnDashboard, subscribeProfileByUid, directoryActions } from "../api/directoryApi";
import { formatDateTime } from "./shared";

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
  const [history, setHistory] = useState({
    follows: [],
    checkins: [],
    reviews: [],
    submissions: [],
  });
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
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
      setHistory({ follows: [], checkins: [], reviews: [], submissions: [] });
      return () => {};
    }
    return subscribeOwnDashboard({
      uid,
      onData: setHistory,
      onError: () => setHistory({ follows: [], checkins: [], reviews: [], submissions: [] }),
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
  }), [history]);

  const saveProfile = async () => {
    if (!canUseDashboard) {
      setStatus("Sign in with a full account to edit your profile.");
      return;
    }
    setSaving(true);
    setStatus("");
    try {
      await directoryActions.upsertDirectoryProfile({ profile: form });
      setStatus("Profile updated.");
    } catch (error) {
      setStatus(String(error?.message || "Could not save profile."));
    } finally {
      setSaving(false);
    }
  };

  if (!canUseDashboard) {
    return (
      <section className="mk3-page">
        <div className="mk3-status">
          Sign in with an upgraded BeauRocks account to access your full history dashboard.
        </div>
      </section>
    );
  }

  return (
    <section className="mk3-page mk3-two-col">
      <article className="mk3-detail-card">
        <div className="mk3-chip">account dashboard</div>
        <h2>Public Profile + History</h2>
        <p>Mostly public profile with karaoke-first social history and listing controls.</p>

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
      </article>

      <aside className="mk3-actions-card">
        <h4>Full History Snapshot</h4>
        <div className="mk3-metric-row">
          <article className="mk3-metric"><span>Following</span><strong>{summary.follows}</strong></article>
          <article className="mk3-metric"><span>Check-ins</span><strong>{summary.checkins}</strong></article>
          <article className="mk3-metric"><span>Reviews</span><strong>{summary.reviews}</strong></article>
          <article className="mk3-metric"><span>Listings</span><strong>{summary.submissions}</strong></article>
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
      </aside>
    </section>
  );
};

export default ProfileDashboardPage;

