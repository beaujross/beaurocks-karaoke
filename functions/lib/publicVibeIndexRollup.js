"use strict";

const { derivePublicVibeIndexProjection } = require("./publicVibeIndex");

const PUBLIC_VIBE_INDEX_ROLLUP_TARGET_TYPES = Object.freeze([
  "venue",
  "host",
  "event",
  "room_session",
]);
const MAX_PUBLIC_VIBE_INDEX_CANARY_TARGETS = 25;

const normalizeToken = (value = "") =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const asCount = (value = 0) => Math.max(0, Number(value || 0) || 0);

const normalizeTargetType = (value = "") => {
  const token = normalizeToken(value);
  if (token === "session") return "room_session";
  return PUBLIC_VIBE_INDEX_ROLLUP_TARGET_TYPES.includes(token) ? token : "";
};

const normalizeRolloutTarget = (value = "") => {
  const raw = String(value || "").trim();
  const separator = raw.indexOf(":");
  if (separator <= 0) return null;
  const targetType = normalizeTargetType(raw.slice(0, separator));
  const targetId = raw.slice(separator + 1).trim().slice(0, 220);
  if (!targetType || !targetId || targetId.includes("/")) return null;
  return { key: `${targetType}:${targetId}`, targetType, targetId };
};

const normalizeRolloutTargets = (value = "") => {
  const source = Array.isArray(value) ? value : String(value || "").split(",");
  const byKey = new Map();
  source.forEach((entry) => {
    const target = normalizeRolloutTarget(entry);
    if (target && !byKey.has(target.key)) byKey.set(target.key, target);
  });
  return Array.from(byKey.values()).slice(0, MAX_PUBLIC_VIBE_INDEX_CANARY_TARGETS);
};

const clampRolloutLimit = (value, fallback, maximum) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(maximum, Math.floor(parsed)));
};

const buildPublicVibeIndexRolloutConfig = (environment = {}) => {
  const requestedMode = String(environment.PUBLIC_VIBE_INDEX_ROLL_MODE || "off").trim().toLowerCase();
  const mode = ["canary", "all"].includes(requestedMode) ? requestedMode : "off";
  const canaryTargets = normalizeRolloutTargets(environment.PUBLIC_VIBE_INDEX_CANARY_TARGETS || "");
  const canRun = mode === "all" || (mode === "canary" && canaryTargets.length > 0);
  return {
    requestedMode,
    mode,
    canRun,
    reason: mode === "off"
      ? (requestedMode === "off" ? "rollout_disabled" : "invalid_rollout_mode")
      : (canRun ? "rollout_enabled" : "missing_canary_targets"),
    canaryTargets: mode === "canary" ? canaryTargets : [],
    canaryTargetKeys: mode === "canary" ? canaryTargets.map((target) => target.key) : [],
    pageSize: clampRolloutLimit(environment.PUBLIC_VIBE_INDEX_ROLLUP_PAGE_SIZE, 250, 500),
    maxTargetsPerType: clampRolloutLimit(environment.PUBLIC_VIBE_INDEX_MAX_TARGETS_PER_TYPE, 5000, 10000),
  };
};

const authorizePublicVibeIndexApply = ({ rollout = {}, targetTypes = [], targetId = "" } = {}) => {
  if (!rollout?.canRun) return { allowed: false, reason: rollout?.reason || "rollout_disabled" };
  if (rollout.mode === "all") return { allowed: true, reason: "all_enabled" };
  const safeTypes = Array.from(new Set((Array.isArray(targetTypes) ? targetTypes : [targetTypes])
    .map(normalizeTargetType)
    .filter(Boolean)));
  const safeTargetId = String(targetId || "").trim().slice(0, 220);
  if (safeTypes.length !== 1 || !safeTargetId) {
    return { allowed: false, reason: "canary_requires_exact_target" };
  }
  const targetKey = `${safeTypes[0]}:${safeTargetId}`;
  if (!Array.isArray(rollout.canaryTargetKeys) || !rollout.canaryTargetKeys.includes(targetKey)) {
    return { allowed: false, reason: "target_not_allowlisted" };
  }
  return { allowed: true, reason: "canary_target_allowlisted", targetKey };
};

const normalizeTags = (entity = {}) => Array.from(new Set([
  ...(Array.isArray(entity.experienceTags) ? entity.experienceTags : []),
  ...(Array.isArray(entity.hostStyleTags) ? entity.hostStyleTags : []),
  ...(Array.isArray(entity.crowdVibeTags) ? entity.crowdVibeTags : []),
  ...(Array.isArray(entity.bestForTags) ? entity.bestForTags : []),
].map(normalizeToken).filter(Boolean))).slice(0, 8);

const buildPublicVibeIndexRollupProjection = ({
  targetType = "",
  entity = {},
  hostInsights = {},
  hostAccount = {},
  engagement = {},
  venueEngagement = {},
  upcomingPublicEvents30d = 0,
  nowMs = Date.now(),
} = {}) => {
  const normalizedType = normalizeTargetType(targetType);
  const experienceProfile = entity?.experienceProfile && typeof entity.experienceProfile === "object"
    ? entity.experienceProfile
    : {};
  const mechanics = experienceProfile?.mechanics && typeof experienceProfile.mechanics === "object"
    ? experienceProfile.mechanics
    : {};
  const audience = experienceProfile?.audienceFeatures && typeof experienceProfile.audienceFeatures === "object"
    ? experienceProfile.audienceFeatures
    : {};
  const games = experienceProfile?.games && typeof experienceProfile.games === "object"
    ? experienceProfile.games
    : {};
  const publicTags = normalizeTags(entity);
  const inheritVenueEngagement = normalizedType === "event" || normalizedType === "room_session";
  const reviewCount = asCount(engagement.reviewCount)
    + (inheritVenueEngagement ? asCount(venueEngagement.reviewCount) : 0);
  const checkinCount = asCount(engagement.checkinCount)
    + (inheritVenueEngagement ? asCount(venueEngagement.checkinCount) : 0);
  const capabilityCount = [
    ...(Array.isArray(entity.beauRocksCapabilities) ? entity.beauRocksCapabilities : []),
    audience.voting === true ? "audience_voting" : "",
    audience.reactions === true ? "audience_reactions" : "",
    games.trivia === true ? "trivia" : "",
    games.popTrivia === true ? "pop_trivia" : "",
    games.wouldYouRather === true ? "would_you_rather" : "",
    entity.requiresGuestPasscode === true ? "guest_passcode" : "",
    String(entity.roomCode || "").trim() ? "live_join" : "",
  ].filter(Boolean).length;
  const funSignalCount = [
    normalizeToken(experienceProfile.format),
    normalizeToken(experienceProfile.intensity),
    mechanics.firstTimerBoost === true ? "first_timer_boost" : "",
    mechanics.fairRotation === true ? "fair_rotation" : "",
    ...publicTags,
  ].filter(Boolean).length;

  return derivePublicVibeIndexProjection({
    hostRecapCount: asCount(hostInsights.recapCount),
    hostHostedRooms: asCount(hostInsights.hostedRooms),
    venueReviewCount: reviewCount,
    venueCheckinCount: checkinCount,
    upcomingPublicEvents30d: asCount(upcomingPublicEvents30d),
    recurringRule: entity.recurringRule,
    karaokeNightsLabel: entity.karaokeNightsLabel,
    scheduleVerifiedAtMs: entity.scheduleVerifiedAtMs,
    lastActiveAtMs: entity.lastActiveAtMs,
    capabilityCount,
    funSignalCount,
    publicTags,
    isBeauRocksPowered: hostAccount.hasHostRole === true
      || hostAccount.hasHostPlan === true
      || entity.isOfficialBeauRocksListing === true
      || entity.isBeauRocksPowered === true,
    hasBeauRocksHostAccount: hostAccount.hasAccount === true,
    isOfficialBeauRocksListing: entity.isOfficialBeauRocksListing === true,
    nowMs,
  });
};
const comparableComponents = (components = null) => {
  if (!components || typeof components !== "object") return null;
  return {
    energy: asCount(components.energy),
    activity: asCount(components.activity),
    participation: asCount(components.participation),
    consistency: asCount(components.consistency),
    hostCraft: asCount(components.hostCraft),
    community: asCount(components.community),
  };
};


const comparableProjection = (projection = {}) => ({
  scoreVersion: String(projection.scoreVersion || ""),
  status: String(projection.status || ""),
  score: Number.isFinite(Number(projection.score)) ? Number(projection.score) : null,
  label: String(projection.label || ""),
  confidence: String(projection.confidence || ""),
  activityBand: String(projection.activityBand || ""),
  trend: String(projection.trend || ""),
  upcomingPublicEvents30d: asCount(projection.upcomingPublicEvents30d),
  publicNightFrequency: String(projection.publicNightFrequency || ""),
  components: comparableComponents(projection?.components),
  publicTags: Array.isArray(projection.publicTags) ? projection.publicTags : [],
  sampleWindowDays: asCount(projection.sampleWindowDays),
  minimumThresholdMet: projection.minimumThresholdMet === true,
});

const publicVibeIndexProjectionsEqual = (left = {}, right = {}) =>
  JSON.stringify(comparableProjection(left)) === JSON.stringify(comparableProjection(right));

module.exports = {
  MAX_PUBLIC_VIBE_INDEX_CANARY_TARGETS,
  PUBLIC_VIBE_INDEX_ROLLUP_TARGET_TYPES,
  authorizePublicVibeIndexApply,
  buildPublicVibeIndexRollupProjection,
  buildPublicVibeIndexRolloutConfig,
  normalizePublicVibeIndexRollupTargetType: normalizeTargetType,
  normalizePublicVibeIndexRolloutTargets: normalizeRolloutTargets,
  publicVibeIndexProjectionsEqual,
};
