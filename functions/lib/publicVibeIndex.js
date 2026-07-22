"use strict";

const PUBLIC_VIBE_INDEX_VERSION = "vibe_v1";
const PUBLIC_VIBE_INDEX_MIN_EVIDENCE = 5;

const clampScore = (value = 0) => Math.max(0, Math.min(100, Math.round(Number(value || 0) || 0)));

const normalizeToken = (value = "") =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const normalizePublicTags = (values = []) => {
  const source = Array.isArray(values) ? values : [];
  return Array.from(new Set(source.map(normalizeToken).filter(Boolean))).slice(0, 8);
};

const labelForScore = (score = 0) => {
  if (score >= 85) return "electric";
  if (score >= 70) return "lively";
  if (score >= 55) return "warm";
  return "building";
};

const activityBandFor = ({ recentRecaps = 0, upcomingPublicEvents30d = 0, lastActiveAtMs = 0, nowMs = Date.now() } = {}) => {
  const recent = Number(lastActiveAtMs || 0) > 0 && (nowMs - Number(lastActiveAtMs || 0)) <= (14 * 24 * 60 * 60 * 1000);
  const signal = (Math.max(0, Number(recentRecaps || 0)) * 2)
    + Math.max(0, Number(upcomingPublicEvents30d || 0))
    + (recent ? 3 : 0);
  if (signal >= 12) return "very_active";
  if (signal >= 6) return "active";
  if (signal >= 2) return "building";
  return "not_enough_data";
};

const confidenceFor = ({ evidenceCount = 0, recapCount = 0 } = {}) => {
  if (evidenceCount >= 20 && recapCount >= 5) return "high";
  if (evidenceCount >= 8) return "medium";
  return "low";
};

const sanitizePublishedProjection = (projection = {}, safeContext = {}) => {
  const minimumThresholdMet = projection?.minimumThresholdMet === true;
  const score = clampScore(projection?.score);
  if (!minimumThresholdMet || score <= 0) return null;
  const components = projection?.components && typeof projection.components === "object"
    ? projection.components
    : {};
  return {
    scoreVersion: PUBLIC_VIBE_INDEX_VERSION,
    status: "published",
    score,
    label: labelForScore(score),
    confidence: ["low", "medium", "high"].includes(normalizeToken(projection?.confidence))
      ? normalizeToken(projection.confidence)
      : "low",
    activityBand: normalizeToken(projection?.activityBand) || "building",
    trend: ["heating_up", "steady", "cooling"].includes(normalizeToken(projection?.trend))
      ? normalizeToken(projection.trend)
      : "steady",
    upcomingPublicEvents30d: Math.max(0, Number(safeContext?.upcomingPublicEvents30d || projection?.upcomingPublicEvents30d || 0) || 0),
    publicNightFrequency: normalizeToken(safeContext?.publicNightFrequency || projection?.publicNightFrequency),
    components: {
      energy: clampScore(components.energy),
      activity: clampScore(components.activity),
      participation: clampScore(components.participation),
      consistency: clampScore(components.consistency),
      hostCraft: clampScore(components.hostCraft),
      community: clampScore(components.community),
    },
    publicTags: normalizePublicTags(projection?.publicTags || safeContext?.publicTags),
    sampleWindowDays: 30,
    minimumThresholdMet: true,
  };
};

const derivePublicVibeIndexProjection = (input = {}) => {
  const recapCount = Math.max(0, Number(input?.hostRecapCount || input?.recentRecapCount || 0) || 0);
  const hostedRooms = Math.max(0, Number(input?.hostHostedRooms || 0) || 0);
  const reviewCount = Math.max(0, Number(input?.venueReviewCount || 0) || 0);
  const checkinCount = Math.max(0, Number(input?.venueCheckinCount || 0) || 0);
  const upcomingPublicEvents30d = Math.max(0, Number(input?.upcomingPublicEvents30d || 0) || 0);
  const capabilityCount = Math.max(0, Number(input?.capabilityCount || 0) || 0);
  const funSignalCount = Math.max(0, Number(input?.funSignalCount || 0) || 0);
  const evidenceCount = recapCount + reviewCount + checkinCount;
  const minimumThresholdMet = input?.minimumThresholdMet === true
    || recapCount >= 3
    || (reviewCount + checkinCount) >= PUBLIC_VIBE_INDEX_MIN_EVIDENCE;
  const publicNightFrequency = normalizeToken(input?.publicNightFrequency || input?.recurringRule);
  const publicTags = normalizePublicTags(input?.publicTags);
  const activityBand = activityBandFor({
    recentRecaps: recapCount,
    upcomingPublicEvents30d,
    lastActiveAtMs: input?.lastActiveAtMs,
    nowMs: input?.nowMs,
  });

  if (!minimumThresholdMet) {
    return {
      scoreVersion: PUBLIC_VIBE_INDEX_VERSION,
      status: "not_enough_data",
      score: null,
      label: "building",
      confidence: "low",
      activityBand,
      trend: "steady",
      upcomingPublicEvents30d,
      publicNightFrequency,
      components: null,
      publicTags,
      sampleWindowDays: 30,
      minimumThresholdMet: false,
    };
  }

  const recentActivity = Number(input?.lastActiveAtMs || 0) > 0
    && ((Number(input?.nowMs || Date.now()) - Number(input.lastActiveAtMs)) <= (14 * 24 * 60 * 60 * 1000));
  const hasVerifiedSchedule = Number(input?.scheduleVerifiedAtMs || 0) > 0
    || publicNightFrequency === "weekly"
    || !!String(input?.karaokeNightsLabel || "").trim();
  const isPowered = input?.isBeauRocksPowered === true
    || input?.hasBeauRocksHostAccount === true
    || input?.isOfficialBeauRocksListing === true;

  const components = {
    energy: clampScore(35 + (recapCount * 7) + (funSignalCount * 7) + (capabilityCount * 4)),
    activity: clampScore(30 + (recapCount * 8) + (upcomingPublicEvents30d * 5) + (recentActivity ? 15 : 0)),
    participation: clampScore(30 + (checkinCount * 4) + (reviewCount * 3) + (recapCount * 4)),
    consistency: clampScore(35 + (hasVerifiedSchedule ? 30 : 0) + (upcomingPublicEvents30d * 5) + (hostedRooms >= 3 ? 10 : 0)),
    hostCraft: clampScore(35 + (recapCount * 7) + (capabilityCount * 5) + (isPowered ? 10 : 0)),
    community: clampScore(30 + (reviewCount * 5) + (checkinCount * 3) + (funSignalCount * 4)),
  };
  const score = clampScore(
    (components.energy * 0.25)
    + (components.activity * 0.20)
    + (components.participation * 0.20)
    + (components.consistency * 0.15)
    + (components.hostCraft * 0.10)
    + (components.community * 0.10)
  );

  return {
    scoreVersion: PUBLIC_VIBE_INDEX_VERSION,
    status: "published",
    score,
    label: labelForScore(score),
    confidence: confidenceFor({ evidenceCount, recapCount }),
    activityBand,
    trend: "steady",
    upcomingPublicEvents30d,
    publicNightFrequency,
    components,
    publicTags,
    sampleWindowDays: 30,
    minimumThresholdMet: true,
  };
};

// Public readers may sanitize a projection that was already persisted by trusted
// server code. They must never derive a publishable score from raw entity fields.
// Rollup code uses derivePublicVibeIndexProjection directly so an existing
// document value cannot become an input to its own replacement.
const buildPublicVibeIndexProjection = (input = {}) => {
  const published = sanitizePublishedProjection(input?.publicVibeIndex, input);
  if (published) return published;
  return derivePublicVibeIndexProjection({});
};

module.exports = {
  PUBLIC_VIBE_INDEX_MIN_EVIDENCE,
  PUBLIC_VIBE_INDEX_VERSION,
  buildPublicVibeIndexProjection,
  derivePublicVibeIndexProjection,
};
