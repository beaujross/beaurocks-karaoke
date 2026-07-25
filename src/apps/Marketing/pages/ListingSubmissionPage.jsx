import React, { useMemo, useState } from "react";
import { trackEvent, trackGoldenPathMilestone } from "../lib/marketingAnalytics";
import { directoryActions } from "../api/directoryApi";
import { formatDateTime, fromDateTimeLocalInput, toDateTimeLocalInput } from "./shared";
import {
  buildKaraokeNightsLabel,
  buildNextCadenceWindow,
  buildRecurringRule,
  createEmptyCadenceRows,
} from "./cadenceSchedule";
import WeeklyScheduleEditor from "./WeeklyScheduleEditor";
import "./listingGoldenPath.css";

const splitTagInput = (value = "", max = 8) =>
  String(value || "")
    .split(/[,\n]/g)
    .map((entry) => entry.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, ""))
    .filter(Boolean)
    .filter((entry, index, array) => array.indexOf(entry) === index)
    .slice(0, Math.max(1, Number(max || 8)));

const getBrowserTimezone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
};

const normalizeRequestedListingType = (value = "") => {
  const token = String(value || "").trim().toLowerCase();
  return ["venue", "event", "room_session"].includes(token) ? token : "venue";
};

const ListingSubmissionPage = ({ session, navigate, authFlow, route }) => {
  const routeParams = route?.params || {};
  const canSubmit = !!session?.uid && !session?.isAnonymous;
  const [listingType, setListingType] = useState(() => normalizeRequestedListingType(routeParams.targetType));
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [venueCreateMode, setVenueCreateMode] = useState(() => normalizeRequestedListingType(routeParams.targetType) !== "venue");
  const [venueSearch, setVenueSearch] = useState("");
  const [venueSearchBusy, setVenueSearchBusy] = useState(false);
  const [venueSearchComplete, setVenueSearchComplete] = useState(false);
  const [venueMatches, setVenueMatches] = useState([]);
  const [form, setForm] = useState({
    title: "",
    description: "",
    city: String(routeParams.city || ""),
    state: String(routeParams.state || ""),
    region: "nationwide",
    timezone: String(routeParams.timezone || "") || getBrowserTimezone(),
    address1: String(routeParams.address1 || ""),
    startsAtLocal: "",
    endsAtLocal: "",
    cadenceRows: createEmptyCadenceRows(),
    hostName: "",
    venueId: String(routeParams.venueId || ""),
    venueName: String(routeParams.venueName || ""),
    roomCode: "",
    visibility: "public",
    experienceTagsInput: "",
    hostStyleTagsInput: "",
    crowdVibeTagsInput: "",
    bestForTagsInput: "",
    rotationEstimate: "",
    beginnerFriendly: "",
    duetFriendly: "",
    beauRocksCapabilitiesInput: "",
  });

  const cadenceLabel = useMemo(() => buildKaraokeNightsLabel(form.cadenceRows), [form.cadenceRows]);
  const recurringRulePreview = useMemo(() => buildRecurringRule(form.cadenceRows), [form.cadenceRows]);
  const nextCadenceWindow = useMemo(() => buildNextCadenceWindow(form.cadenceRows), [form.cadenceRows]);
  const previewStart = useMemo(
    () => fromDateTimeLocalInput(form.startsAtLocal) || Number(nextCadenceWindow.startsAtMs || 0),
    [form.startsAtLocal, nextCadenceWindow.startsAtMs]
  );

  const chooseListingType = (nextType = "venue") => {
    const safeType = normalizeRequestedListingType(nextType);
    setListingType(safeType);
    setSubmitted(false);
    setStatus("");
    setVenueCreateMode(safeType !== "venue");
  };

  const searchExistingVenues = async (event) => {
    event.preventDefault();
    const token = String(venueSearch || "").trim();
    if (token.length < 2) {
      setStatus("Enter at least two characters to search existing venues.");
      return;
    }
    setVenueSearchBusy(true);
    setVenueSearchComplete(false);
    setStatus("");
    try {
      const result = await directoryActions.listDirectoryDiscover({
        listingType: "venue",
        search: token,
        timeWindow: "all",
        includeEnded: true,
        sortMode: "smart",
        limit: 8,
      });
      setVenueMatches(Array.isArray(result?.items) ? result.items : []);
      setVenueSearchComplete(true);
      trackEvent("mk_listing_venue_duplicate_search", {
        resultCount: Array.isArray(result?.items) ? result.items.length : 0,
      });
    } catch (error) {
      setVenueMatches([]);
      setVenueSearchComplete(true);
      setStatus(String(error?.message || "Could not search venues."));
    } finally {
      setVenueSearchBusy(false);
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!canSubmit) {
      authFlow?.requireFullAuth?.({
        intent: "listing_submit",
        targetType: listingType,
        targetId: "",
        returnRoute: {
          page: "submit",
          params: {
            intent: "listing_submit",
            targetType: listingType,
          },
        },
      });
      setStatus("Create your BeauRocks account to submit listings.");
      return;
    }
    setBusy(true);
    setStatus("");
    try {
      let startsAtMs = fromDateTimeLocalInput(form.startsAtLocal);
      let endsAtMs = fromDateTimeLocalInput(form.endsAtLocal);
      if (listingType === "event" && startsAtMs <= 0 && Number(nextCadenceWindow.startsAtMs || 0) > 0) {
        startsAtMs = Number(nextCadenceWindow.startsAtMs || 0);
      }
      if (listingType === "event" && endsAtMs <= 0 && Number(nextCadenceWindow.endsAtMs || 0) > 0) {
        endsAtMs = Number(nextCadenceWindow.endsAtMs || 0);
      }
      const payload = {
        title: form.title,
        description: form.description,
        venueId: form.venueId,
        city: form.city,
        state: form.state,
        region: form.region,
        timezone: form.timezone,
        address1: form.address1,
        startsAtMs: Number(startsAtMs || 0) || 0,
        endsAtMs: Number(endsAtMs || 0) || 0,
        karaokeNightsLabel: listingType === "venue" ? cadenceLabel : "",
        recurringRule: listingType === "event" ? recurringRulePreview : "",
        hostName: form.hostName,
        venueName: form.venueName,
        roomCode: form.roomCode,
        visibility: listingType === "room_session" ? form.visibility : "public",
        experienceTags: splitTagInput(form.experienceTagsInput, 10),
        hostStyleTags: splitTagInput(form.hostStyleTagsInput, 6),
        crowdVibeTags: splitTagInput(form.crowdVibeTagsInput, 8),
        bestForTags: splitTagInput(form.bestForTagsInput, 6),
        rotationEstimate: String(form.rotationEstimate || "").trim().toLowerCase(),
        beginnerFriendly: String(form.beginnerFriendly || "").trim().toLowerCase(),
        duetFriendly: String(form.duetFriendly || "").trim().toLowerCase(),
        beauRocksCapabilities: splitTagInput(form.beauRocksCapabilitiesInput, 10),
        scheduleVerifiedAtMs: Date.now(),
      };
      const result = await directoryActions.submitDirectoryListing({
        listingType,
        payload,
      });
      setSubmitted(true);
      setStatus(`Submitted for moderation. Submission ID: ${result?.submissionId || "pending"}`);
      trackEvent(`mk_listing_created_${listingType}`, {
        listingType,
        submissionId: result?.submissionId || "",
      });
      if (listingType === "venue") {
        trackGoldenPathMilestone({ pathId: "venue_submit_listing", workstream: "venue_growth", source: "listing_submit" });
      } else if (listingType === "event") {
        trackGoldenPathMilestone({ pathId: "host_publish_event", workstream: "host_growth", source: "listing_submit" });
      } else if (listingType === "room_session") {
        trackGoldenPathMilestone({ pathId: "host_create_session", workstream: "host_growth", source: "listing_submit" });
      }
    } catch (error) {
      setStatus(String(error?.message || "Submission failed."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mk3-page mk3-two-col">
      <article className="mk3-detail-card">
        <div className="mk3-chip">submit listing</div>
        <h2>Put Your Karaoke Night on the Map</h2>
        <p>
          List an existing karaoke night or add a venue for free. BeauRocks reviews new listings before they go live.
        </p>
        <div className="mk3-owner-listing-choice" data-feature-id="listing-type-golden-path">
          <button type="button" className={listingType === "event" ? "active" : ""} onClick={() => chooseListingType("event")}>
            <strong>List a karaoke night</strong>
            <span>One-time or recurring schedule</span>
          </button>
          <button type="button" className={listingType === "venue" ? "active" : ""} onClick={() => chooseListingType("venue")}>
            <strong>Add or claim a venue</strong>
            <span>Search first to avoid duplicates</span>
          </button>
          <button type="button" onClick={() => navigate("for_hosts", "", { intent: "host_apply" })}>
            <strong>Run it with BeauRocks</strong>
            <span>Queue, TV, and guest phones</span>
          </button>
        </div>
        {!canSubmit && (
          <div className="mk3-actions-block">
            <div className="mk3-status">Create your BeauRocks account to submit and manage listings.</div>
            <button
              type="button"
              onClick={() => authFlow?.requireFullAuth?.({
                intent: "listing_submit",
                targetType: listingType,
                targetId: "",
                returnRoute: {
                  page: "submit",
                  params: {
                    intent: "listing_submit",
                    targetType: listingType,
                  },
                },
              })}
            >
              Create BeauRocks Account
            </button>
          </div>
        )}
        {canSubmit && listingType === "venue" && !venueCreateMode && (
          <section className="mk3-venue-search-fork" data-feature-id="venue-add-or-claim-fork">
            <div>
              <h3>Find the venue first</h3>
              <p>If it is already listed, open it and claim it. Create a new venue only when there is no match.</p>
            </div>
            <form onSubmit={searchExistingVenues}>
              <input
                value={venueSearch}
                onChange={(event) => setVenueSearch(event.target.value)}
                placeholder="Venue name or city"
                aria-label="Search existing venues"
              />
              <button type="submit" disabled={venueSearchBusy}>
                {venueSearchBusy ? "Searching..." : "Search Venues"}
              </button>
            </form>
            {!!venueMatches.length && (
              <div className="mk3-sub-list compact">
                {venueMatches.map((venue) => (
                  <button
                    key={venue.id}
                    type="button"
                    className="mk3-list-row"
                    onClick={() => navigate("venue", venue.id, { intent: "claim", targetType: "venue", targetId: venue.id })}
                  >
                    <span>{venue.title || "Venue"}</span>
                    <span>{[venue.city, venue.state].filter(Boolean).join(", ") || "Open and claim"}</span>
                  </button>
                ))}
              </div>
            )}
            {venueSearchComplete && !venueMatches.length && (
              <div className="mk3-status">No matching venue found. You can create a new one.</div>
            )}
            <button type="button" className="mk3-inline-next" onClick={() => setVenueCreateMode(true)}>
              {venueSearchComplete && !venueMatches.length ? "Create This Venue" : "My Venue Is Not Listed"}
            </button>
          </section>
        )}
        {canSubmit && (listingType !== "venue" || venueCreateMode) && (
        <form className="mk3-form-grid" onSubmit={submit}>
          <label>
            Listing Type
            <select value={listingType} onChange={(e) => chooseListingType(e.target.value)}>
              <option value="venue">Venue page</option>
              <option value="event">Karaoke night / event</option>
              <option value="room_session">BeauRocks room session</option>
            </select>
          </label>
          <label>
            Title
            <input required value={form.title} onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))} />
          </label>
          <label className="full">
            Description
            <textarea value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} />
          </label>
          <details className="full mk3-submission-optional">
            <summary>Optional experience details</summary>
            <p>Help singers find the right vibe. You can add these later.</p>
            <div className="mk3-form-grid">
              <label>
                Rotation
                <select value={form.rotationEstimate} onChange={(e) => setForm((prev) => ({ ...prev, rotationEstimate: e.target.value }))}>
                  <option value="">Unknown</option>
                  <option value="fast">Fast</option>
                  <option value="medium">Steady</option>
                  <option value="slow">Longer queue</option>
                </select>
              </label>
              <label>
                Beginner Friendly
                <select value={form.beginnerFriendly} onChange={(e) => setForm((prev) => ({ ...prev, beginnerFriendly: e.target.value }))}>
                  <option value="">Unknown</option>
                  <option value="high">High</option>
                  <option value="medium">Mixed</option>
                  <option value="low">Low</option>
                </select>
              </label>
              <label>
                Duet Friendly
                <select value={form.duetFriendly} onChange={(e) => setForm((prev) => ({ ...prev, duetFriendly: e.target.value }))}>
                  <option value="">Unknown</option>
                  <option value="high">High</option>
                  <option value="medium">Mixed</option>
                  <option value="low">Low</option>
                </select>
              </label>
              <label className="full">
                Experience
                <input
                  value={form.experienceTagsInput}
                  onChange={(e) => setForm((prev) => ({ ...prev, experienceTagsInput: e.target.value }))}
                  placeholder="Fast rotation, singalong, strong sound"
                />
              </label>
              <label className="full">
                Crowd vibe
                <input
                  value={form.crowdVibeTagsInput}
                  onChange={(e) => setForm((prev) => ({ ...prev, crowdVibeTagsInput: e.target.value }))}
                  placeholder="Welcoming, late night, serious singers"
                />
              </label>
              <label className="full">
                Best for
                <input
                  value={form.bestForTagsInput}
                  onChange={(e) => setForm((prev) => ({ ...prev, bestForTagsInput: e.target.value }))}
                  placeholder="First timers, friend groups, regulars"
                />
              </label>
              <label className="full">
                Host style
                <input
                  value={form.hostStyleTagsInput}
                  onChange={(e) => setForm((prev) => ({ ...prev, hostStyleTagsInput: e.target.value }))}
                  placeholder="Hype, organized, playful"
                />
              </label>
              <label className="full">
                BeauRocks features
                <input
                  value={form.beauRocksCapabilitiesInput}
                  onChange={(e) => setForm((prev) => ({ ...prev, beauRocksCapabilitiesInput: e.target.value }))}
                  placeholder="Live join, audience app, interactive TV, recap ready"
                />
              </label>
            </div>
          </details>
          {listingType === "venue" && (
            <div className="full mk3-cadence-field">
              <span>Weekly Karaoke Schedule</span>
              <WeeklyScheduleEditor
                value={form.cadenceRows}
                onChange={(cadenceRows) => setForm((prev) => ({ ...prev, cadenceRows }))}
              />
              {cadenceLabel && (
                <div className="mk3-status">
                  <strong>Cadence Preview</strong>
                  <span>{cadenceLabel}</span>
                </div>
              )}
            </div>
          )}
          <label>
            City
            <input value={form.city} onChange={(e) => setForm((prev) => ({ ...prev, city: e.target.value }))} />
          </label>
          <label>
            State
            <input value={form.state} onChange={(e) => setForm((prev) => ({ ...prev, state: e.target.value }))} />
          </label>
          <label>
            Venue Timezone
            <input
              value={form.timezone}
              onChange={(e) => setForm((prev) => ({ ...prev, timezone: e.target.value }))}
              placeholder="America/Los_Angeles"
            />
          </label>
          <label className="full">
            Address
            <input value={form.address1} onChange={(e) => setForm((prev) => ({ ...prev, address1: e.target.value }))} />
          </label>
          {(listingType === "event" || listingType === "room_session") && (
            <>
              <label>
                Start
                <input
                  type="datetime-local"
                  value={form.startsAtLocal}
                  onChange={(e) => setForm((prev) => ({ ...prev, startsAtLocal: e.target.value }))}
                />
              </label>
              <label>
                End
                <input
                  type="datetime-local"
                  value={form.endsAtLocal}
                  onChange={(e) => setForm((prev) => ({ ...prev, endsAtLocal: e.target.value }))}
                />
              </label>
            </>
          )}
          {listingType === "event" && (
            <>
              <div className="full mk3-cadence-field">
                <span>Recurring Weekly Schedule</span>
                <WeeklyScheduleEditor
                  value={form.cadenceRows}
                  onChange={(cadenceRows) => setForm((prev) => ({ ...prev, cadenceRows }))}
                />
                {recurringRulePreview && (
                  <div className="mk3-status">
                    <strong>Recurring Rule Preview</strong>
                    <span>{recurringRulePreview}</span>
                  </div>
                )}
              </div>
              {Number(nextCadenceWindow.startsAtMs || 0) > 0 && (
                <div className="mk3-actions-inline full">
                  <button
                    type="button"
                    onClick={() => setForm((prev) => ({
                      ...prev,
                      startsAtLocal: toDateTimeLocalInput(nextCadenceWindow.startsAtMs || 0),
                      endsAtLocal: toDateTimeLocalInput(nextCadenceWindow.endsAtMs || 0),
                    }))}
                  >
                    Use Next Cadence Slot
                  </button>
                </div>
              )}
              <label>
                Host Name
                <input value={form.hostName} onChange={(e) => setForm((prev) => ({ ...prev, hostName: e.target.value }))} />
              </label>
              <label>
                Venue Name
                <input value={form.venueName} onChange={(e) => setForm((prev) => ({ ...prev, venueName: e.target.value }))} />
              </label>
              {!!form.venueId && (
                <div className="mk3-status full">Linked to the venue page for {form.venueName || form.venueId}.</div>
              )}
            </>
          )}
          {listingType === "room_session" && (
            <>
              <label>
                Room Code
                <input value={form.roomCode} onChange={(e) => setForm((prev) => ({ ...prev, roomCode: e.target.value.toUpperCase() }))} />
              </label>
              <label>
                Visibility
                <select value={form.visibility} onChange={(e) => setForm((prev) => ({ ...prev, visibility: e.target.value }))}>
                  <option value="public">Public</option>
                  <option value="private">Private</option>
                </select>
              </label>
            </>
          )}
          <div className="mk3-actions-inline full">
            <button type="submit" disabled={busy}>{busy ? "Submitting..." : "Submit For Review"}</button>
            <button type="button" onClick={() => navigate("profile")}>Back To Dashboard</button>
          </div>
        </form>
        )}
        {status && <div className="mk3-status">{status}</div>}
        {submitted && (
          <div className="mk3-actions-inline">
            <button type="button" onClick={() => navigate("profile", "", { intent: "manage_listings" })}>Open My Listings</button>
            <button type="button" className="mk3-inline-next" onClick={() => navigate("for_hosts", "", { intent: "host_apply" })}>Run This Night With BeauRocks</button>
          </div>
        )}
      </article>

      <aside className="mk3-actions-card">
        <h4>Submission Notes</h4>
        <ul className="mk3-plain-list">
          <li>Moderation required before publish.</li>
          <li>Google/Yelp enrichment can be added by admins.</li>
          <li>Use Venue or Karaoke night / event for an independent listing. BeauRocks room sessions are published from the Host setup flow.</li>
          <li>Room sessions support explicit public/private visibility.</li>
          <li>Experience tags drive discover badges and modern karaoke storytelling.</li>
        </ul>
        {previewStart > 0 && (
          <div className="mk3-status">Start Preview: {formatDateTime(previewStart)}</div>
        )}
      </aside>
    </section>
  );
};

export default ListingSubmissionPage;

