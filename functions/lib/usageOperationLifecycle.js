"use strict";

const USAGE_OPERATION_STATES = Object.freeze({
  reserved: "reserved",
  settled: "settled",
  released: "released",
  billable: "billable",
  invoiced: "invoiced",
});

const ALLOWED_TRANSITIONS = Object.freeze({
  reserved: new Set([USAGE_OPERATION_STATES.settled, USAGE_OPERATION_STATES.released]),
  settled: new Set([USAGE_OPERATION_STATES.billable]),
  released: new Set(),
  billable: new Set([USAGE_OPERATION_STATES.invoiced]),
  invoiced: new Set(),
});

const toWholeNumber = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : fallback;
};

const normalizeUsageOperationId = (value = "") => String(value || "")
  .trim()
  .replace(/[^a-zA-Z0-9:_-]/g, "")
  .slice(0, 160);

const normalizeUsageLifecycleCounts = (value = {}, legacyUsed = 0) => ({
  reserved: toWholeNumber(value?.reserved, 0),
  settled: toWholeNumber(value?.settled, toWholeNumber(legacyUsed, 0)),
  released: toWholeNumber(value?.released, 0),
  billable: toWholeNumber(value?.billable, 0),
  invoiced: toWholeNumber(value?.invoiced, 0),
});

const canTransitionUsageOperation = (fromState = "", toState = "") => (
  ALLOWED_TRANSITIONS[String(fromState || "")]?.has(String(toState || "")) === true
);

const applyUsageLifecycleTransition = (counts = {}, {
  fromState = "",
  toState = "",
  units = 1,
} = {}) => {
  if (!canTransitionUsageOperation(fromState, toState)) {
    throw new Error(`Unsupported usage operation transition: ${fromState || "missing"} -> ${toState || "missing"}`);
  }
  const safeUnits = Math.max(1, toWholeNumber(units, 1));
  const next = normalizeUsageLifecycleCounts(counts, counts?.used);
  if (fromState === USAGE_OPERATION_STATES.reserved) {
    if (next.reserved < safeUnits) throw new Error("Usage reservation underflow.");
    next.reserved -= safeUnits;
  }
  next[toState] += safeUnits;
  return next;
};

module.exports = {
  USAGE_OPERATION_STATES,
  applyUsageLifecycleTransition,
  canTransitionUsageOperation,
  normalizeUsageLifecycleCounts,
  normalizeUsageOperationId,
};
