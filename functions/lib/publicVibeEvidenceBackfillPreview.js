"use strict";

const {
  TRUSTED_EVIDENCE_TYPES,
  VIBE_V2_VERSION,
  VIBE_V2_WINDOW_DAYS,
  buildVibeV2EvidenceSnapshot,
} = require("./publicVibeIndexEvidenceV2");

const VIBE_V2_PREVIEW_TARGET_TYPES = Object.freeze([
  "venue",
  "host",
  "event",
  "room_session",
]);

const normalizeToken = (value = "") =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const normalizeId = (value = "", maxLength = 220) => String(value || "").trim().slice(0, maxLength);

const increment = (target = {}, key = "", amount = 1) => {
  if (!key) return;
  target[key] = (target[key] || 0) + amount;
};

const readOwners = (ownersByTarget, key) => {
  if (ownersByTarget instanceof Map) return ownersByTarget.get(key) || [];
  if (ownersByTarget && typeof ownersByTarget === "object") return ownersByTarget[key] || [];
  return [];
};

const buildPublicVibeEvidenceBackfillPreview = ({
  evidence: evidenceInputs = [],
  ownerUidsByTarget = new Map(),
  targetTypes: targetTypeInputs = VIBE_V2_PREVIEW_TARGET_TYPES,
  nowMs = Date.now(),
  sampleLimit = 500,
  truncated = false,
} = {}) => {
  const requestedTargetTypes = Array.from(new Set(
    (Array.isArray(targetTypeInputs) ? targetTypeInputs : [targetTypeInputs])
      .map(normalizeToken)
      .filter((type) => VIBE_V2_PREVIEW_TARGET_TYPES.includes(type))
  ));
  const selectedTargetTypes = requestedTargetTypes.length
    ? requestedTargetTypes
    : [...VIBE_V2_PREVIEW_TARGET_TYPES];
  const evidence = Array.isArray(evidenceInputs) ? evidenceInputs : [];
  const groups = new Map();
  let excludedByRequestedTypeCount = 0;
  let unsupportedTargetEvidenceCount = 0;

  evidence.forEach((record) => {
    const targetType = normalizeToken(record?.targetType);
    const targetId = normalizeId(record?.targetId);
    if (!VIBE_V2_PREVIEW_TARGET_TYPES.includes(targetType) || !targetId) {
      unsupportedTargetEvidenceCount += 1;
      return;
    }
    if (!selectedTargetTypes.includes(targetType)) {
      excludedByRequestedTypeCount += 1;
      return;
    }
    const key = `${targetType}:${targetId}`;
    if (!groups.has(key)) groups.set(key, { targetType, targetId, evidence: [] });
    groups.get(key).evidence.push(record);
  });

  const targetTypeSummary = Object.fromEntries(selectedTargetTypes.map((targetType) => [
    targetType,
    {
      targetType,
      targetCount: 0,
      eligibleTargetCount: 0,
      notEnoughDataTargetCount: 0,
      inputEvidenceCount: 0,
      qualifiedEvidenceCount: 0,
      droppedEvidenceCount: 0,
    },
  ]));
  const confidenceCounts = { low: 0, medium: 0, high: 0 };
  const eligibilityReasonCounts = {};
  const droppedReasonCounts = {};
  const inputEvidenceTypeCounts = Object.fromEntries(TRUSTED_EVIDENCE_TYPES.map((type) => [type, 0]));
  inputEvidenceTypeCounts.unsupported = 0;
  let eligibleTargetCount = 0;
  let notEnoughDataTargetCount = 0;
  let qualifiedEvidenceCount = 0;
  let droppedEvidenceCount = 0;

  groups.forEach((group, key) => {
    group.evidence.forEach((record) => {
      const type = normalizeToken(record?.evidenceType || record?.type);
      increment(inputEvidenceTypeCounts, TRUSTED_EVIDENCE_TYPES.includes(type) ? type : "unsupported");
    });
    const snapshot = buildVibeV2EvidenceSnapshot({
      targetType: group.targetType,
      targetId: group.targetId,
      ownerUids: readOwners(ownerUidsByTarget, key),
      evidence: group.evidence,
      nowMs,
    });
    const summary = targetTypeSummary[group.targetType];
    summary.targetCount += 1;
    summary.inputEvidenceCount += snapshot.integritySummary.inputCount;
    summary.qualifiedEvidenceCount += snapshot.evidenceSummary.qualifiedEvidenceCount;
    summary.droppedEvidenceCount += snapshot.integritySummary.droppedCount;
    qualifiedEvidenceCount += snapshot.evidenceSummary.qualifiedEvidenceCount;
    droppedEvidenceCount += snapshot.integritySummary.droppedCount;
    increment(confidenceCounts, snapshot.confidence);
    snapshot.eligibilityReasons.forEach((reason) => increment(eligibilityReasonCounts, reason));
    Object.entries(snapshot.integritySummary.droppedByReason || {})
      .forEach(([reason, count]) => increment(droppedReasonCounts, reason, Number(count || 0)));
    if (snapshot.minimumThresholdMet) {
      eligibleTargetCount += 1;
      summary.eligibleTargetCount += 1;
    } else {
      notEnoughDataTargetCount += 1;
      summary.notEnoughDataTargetCount += 1;
    }
  });

  return {
    ok: true,
    dryRun: true,
    scoreVersion: VIBE_V2_VERSION,
    sampleWindowDays: VIBE_V2_WINDOW_DAYS,
    sampleLimit: Math.max(1, Number(sampleLimit || 0) || 1),
    truncated: truncated === true,
    selectedTargetTypes,
    scannedEvidenceCount: evidence.length,
    consideredEvidenceCount: evidence.length - excludedByRequestedTypeCount - unsupportedTargetEvidenceCount,
    excludedByRequestedTypeCount,
    unsupportedTargetEvidenceCount,
    targetCount: groups.size,
    eligibleTargetCount,
    notEnoughDataTargetCount,
    qualifiedEvidenceCount,
    droppedEvidenceCount,
    collisionCount: Number(droppedReasonCounts.duplicate || 0),
    inputEvidenceTypeCounts,
    confidenceCounts,
    eligibilityReasonCounts,
    droppedReasonCounts,
    targetTypeSummaries: selectedTargetTypes.map((type) => targetTypeSummary[type]),
    privacy: {
      aggregateOnly: true,
      identifiersReturned: false,
      individualEvidenceReturned: false,
    },
  };
};

module.exports = {
  VIBE_V2_PREVIEW_TARGET_TYPES,
  buildPublicVibeEvidenceBackfillPreview,
};
