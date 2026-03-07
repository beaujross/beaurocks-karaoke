const normalizeToken = (value = "") =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const normalizeTokenList = (input = [], maxItems = 8) => {
  const source = Array.isArray(input)
    ? input
    : String(input || "")
      .split(/[,\n]/g)
      .map((entry) => entry.trim());
  const seen = new Set();
  const output = [];
  source.forEach((entry) => {
    const token = normalizeToken(entry);
    if (!token || seen.has(token)) return;
    seen.add(token);
    output.push(token);
  });
  return output.slice(0, Math.max(1, Number(maxItems || 8)));
};

const toBoolLevel = (value = "") => {
  const token = normalizeToken(value);
  if (!token) return "";
  if (["yes", "true", "1", "high", "very_high", "friendly", "welcoming"].includes(token)) return "high";
  if (["medium", "sometimes", "mixed"].includes(token)) return "medium";
  if (["low", "no", "false", "0"].includes(token)) return "low";
  return token;
};

const pushUnique = (list = [], value = "") => {
  const token = String(value || "").trim();
  if (!token || list.includes(token)) return;
  list.push(token);
};

const capitalizeLabel = (value = "") =>
  String(value || "")
    .split("_")
    .filter(Boolean)
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(" ");

const describeRotation = (token = "") => {
  if (token === "fast" || token === "lightning") return "Fast Rotation";
  if (token === "medium" || token === "steady") return "Steady Rotation";
  if (token === "slow" || token === "long_wait") return "Longer Queue";
  return "";
};

const buildCapabilitySet = (entry = {}) => {
  const capabilities = new Set(normalizeTokenList(entry?.beauRocksCapabilities || [], 10));
  const isBeauRocksPowered = !!entry?.isOfficialBeauRocksRoom
    || !!entry?.hasBeauRocksHostAccount
    || !!entry?.hasBeauRocksHostPlan
    || String(entry?.sourceType || "").trim().toLowerCase() === "host_room"
    || capabilities.size > 0;

  if (!isBeauRocksPowered) return { isBeauRocksPowered: false, capabilities };

  if (String(entry?.roomCode || "").trim()) capabilities.add("live_join");
  if (entry?.isOfficialBeauRocksRoom || entry?.hasBeauRocksHostPlan || String(entry?.sourceType || "").trim().toLowerCase() === "host_room") {
    capabilities.add("audience_app");
    capabilities.add("interactive_tv");
    capabilities.add("modern_queue");
  }
  if (Number(entry?.hostRecapCount || 0) > 0) capabilities.add("recap_ready");
  if (Number(entry?.scheduleVerifiedAtMs || 0) > 0 || String(entry?.karaokeNightsLabel || "").trim() || String(entry?.recurringRule || "").trim()) {
    capabilities.add("verified_schedule");
  }
  if (Number(entry?.lastActiveAtMs || 0) > 0) capabilities.add("live_activity");
  capabilities.add("host_verified");

  return { isBeauRocksPowered: true, capabilities };
};

export const deriveDirectoryExperience = (entry = {}) => {
  const experienceTags = normalizeTokenList(entry?.experienceTags || [], 10);
  const hostStyleTags = normalizeTokenList(entry?.hostStyleTags || [], 6);
  const crowdVibeTags = normalizeTokenList(entry?.crowdVibeTags || [], 8);
  const bestForTags = normalizeTokenList(entry?.bestForTags || [], 6);
  const reviewTags = normalizeTokenList(entry?.tags || [], 10);
  const allTasteTags = Array.from(new Set([
    ...experienceTags,
    ...hostStyleTags,
    ...crowdVibeTags,
    ...bestForTags,
    ...reviewTags,
  ]));
  const rotationEstimate = normalizeToken(entry?.rotationEstimate || "");
  const beginnerFriendly = toBoolLevel(entry?.beginnerFriendly || "");
  const duetFriendly = toBoolLevel(entry?.duetFriendly || "");
  const scheduleVerifiedAtMs = Number(entry?.scheduleVerifiedAtMs || 0) || 0;
  const lastActiveAtMs = Number(entry?.lastActiveAtMs || 0) || 0;
  const { isBeauRocksPowered, capabilities } = buildCapabilitySet(entry);
  const capabilityBadges = [];
  const funBadges = [];
  const trustBadges = [];
  const bestForBadges = [];
  const whyThisNightWorks = [];

  const rotationLabel = describeRotation(rotationEstimate);
  if (rotationLabel) {
    pushUnique(funBadges, rotationLabel);
    pushUnique(whyThisNightWorks, `${rotationLabel.toLowerCase()} keeps the room moving.`);
  }
  if (beginnerFriendly === "high") {
    pushUnique(funBadges, "Beginner Friendly");
    pushUnique(bestForBadges, "First Timers");
    pushUnique(whyThisNightWorks, "A welcoming setup lowers the barrier for first-time singers.");
  }
  if (duetFriendly === "high") {
    pushUnique(funBadges, "Duet Friendly");
    pushUnique(bestForBadges, "Friend Groups");
    pushUnique(whyThisNightWorks, "Duets and group moments make it easier to pull friends in.");
  }
  if (allTasteTags.includes("crowd_energy") || allTasteTags.includes("singalong") || allTasteTags.includes("party_mode")) {
    pushUnique(funBadges, "Big Singalong Energy");
  }
  if (allTasteTags.includes("welcoming") || allTasteTags.includes("friendly_regulars")) {
    pushUnique(funBadges, "Welcoming Crowd");
  }
  if (allTasteTags.includes("serious_singers") || allTasteTags.includes("big_voices")) {
    pushUnique(funBadges, "Performance Forward");
  }
  if (allTasteTags.includes("late_night") || allTasteTags.includes("party_bar")) {
    pushUnique(funBadges, "Late-Night Crowd");
  }
  if (allTasteTags.includes("country") || allTasteTags.includes("country_friendly")) pushUnique(funBadges, "Country Friendly");
  if (allTasteTags.includes("pop") || allTasteTags.includes("pop_heavy")) pushUnique(funBadges, "Pop Heavy");
  if (allTasteTags.includes("musical_theater")) pushUnique(funBadges, "Theater Friendly");
  if (allTasteTags.includes("host_vibe") || hostStyleTags.includes("hype") || hostStyleTags.includes("playful")) {
    pushUnique(funBadges, "Strong Host Energy");
  }
  if (allTasteTags.includes("sound_mix") || allTasteTags.includes("gear_quality")) {
    pushUnique(funBadges, "Strong Sound");
  }

  if (scheduleVerifiedAtMs > 0 || String(entry?.karaokeNightsLabel || "").trim() || String(entry?.recurringRule || "").trim()) {
    pushUnique(trustBadges, "Verified Weekly");
  }
  if (lastActiveAtMs > 0 || Number(entry?.startsAtMs || 0) > 0) {
    pushUnique(trustBadges, "Fresh Activity");
  }
  if (Number(entry?.venueReviewCount || 0) > 0) {
    pushUnique(trustBadges, "Crowd Reviewed");
  }
  if (Number(entry?.venueCheckinCount || 0) >= 3) {
    pushUnique(trustBadges, "Repeat Crowd");
  }
  if (Number(entry?.hostLeaderboardRank || 0) > 0 && Number(entry?.hostLeaderboardRank || 0) <= 25) {
    pushUnique(trustBadges, "Host Favorite");
  }

  if (isBeauRocksPowered) {
    if (capabilities.has("live_join")) pushUnique(capabilityBadges, "Live Join");
    if (capabilities.has("audience_app")) pushUnique(capabilityBadges, "Audience App");
    if (capabilities.has("interactive_tv")) pushUnique(capabilityBadges, "Interactive TV");
    if (capabilities.has("modern_queue")) pushUnique(capabilityBadges, "Modern Queue");
    if (capabilities.has("recap_ready")) pushUnique(capabilityBadges, "Recap Ready");
    if (capabilities.has("verified_schedule")) pushUnique(capabilityBadges, "Schedule Confirmed");
    if (capabilities.has("host_verified")) pushUnique(capabilityBadges, "Host Verified");
  }

  bestForTags.forEach((tag) => {
    const label = capitalizeLabel(tag);
    if (!label) return;
    pushUnique(bestForBadges, label);
  });

  const storyLine = isBeauRocksPowered
    ? "Modern karaoke night with live join, audience participation, and smoother host flow."
    : funBadges.length > 0
      ? `${funBadges.slice(0, 2).join(" + ")}.`
      : "Classic karaoke listing with the basics covered.";

  if (isBeauRocksPowered) {
    pushUnique(whyThisNightWorks, "Guests can join faster and stay engaged between turns.");
    pushUnique(whyThisNightWorks, "BeauRocks turns the listing into a live room, not just a flyer.");
  } else {
    pushUnique(whyThisNightWorks, "A richer BeauRocks setup could add live join, audience play, and recap proof.");
  }

  const discoveryBoost = (
    (isBeauRocksPowered ? 22 : 0)
    + (capabilityBadges.length * 5)
    + (funBadges.length * 3)
    + (trustBadges.length * 2)
    + (Number(entry?.hostLeaderboardRank || 0) > 0 && Number(entry?.hostLeaderboardRank || 0) <= 25 ? 6 : 0)
  );

  const upgradePitch = isBeauRocksPowered
    ? "This room already signals a more modern karaoke experience."
    : "Claim this listing to add live join, audience interaction, modern queue flow, and recap-powered proof.";

  return {
    isBeauRocksPowered,
    capabilityBadges,
    funBadges,
    trustBadges,
    bestForBadges,
    storyLine,
    whyThisNightWorks: whyThisNightWorks.slice(0, 4),
    upgradePitch,
    discoveryBoost,
    tasteTags: allTasteTags,
    capabilities: Array.from(capabilities),
  };
};

export const matchesDirectoryExperienceFilter = (entry = {}, filterId = "all") => {
  const filter = normalizeToken(filterId || "all");
  if (!filter || filter === "all") return true;
  const experience = entry?.capabilityBadges && entry?.funBadges && entry?.trustBadges
    ? entry
    : deriveDirectoryExperience(entry);

  if (filter === "interactive") return experience.isBeauRocksPowered && experience.capabilities.includes("interactive_tv");
  if (filter === "live_join") return experience.capabilities.includes("live_join");
  if (filter === "recap") return experience.capabilities.includes("recap_ready");
  if (filter === "modern") return experience.isBeauRocksPowered;
  if (filter === "beginner") return experience.funBadges.includes("Beginner Friendly");
  if (filter === "fast_rotation") return experience.funBadges.includes("Fast Rotation");
  return true;
};

export const summarizeGeoExperience = (entries = []) => {
  const summary = {
    beauRocksPowered: 0,
    liveJoin: 0,
    recapReady: 0,
    beginnerFriendly: 0,
    fastRotation: 0,
  };
  (Array.isArray(entries) ? entries : []).forEach((entry) => {
    const experience = deriveDirectoryExperience(entry);
    if (experience.isBeauRocksPowered) summary.beauRocksPowered += 1;
    if (experience.capabilities.includes("live_join")) summary.liveJoin += 1;
    if (experience.capabilities.includes("recap_ready")) summary.recapReady += 1;
    if (experience.funBadges.includes("Beginner Friendly")) summary.beginnerFriendly += 1;
    if (experience.funBadges.includes("Fast Rotation")) summary.fastRotation += 1;
  });
  return summary;
};
