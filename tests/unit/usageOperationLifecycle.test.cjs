const assert = require("node:assert/strict");
const {
  USAGE_OPERATION_STATES,
  applyUsageLifecycleTransition,
  canTransitionUsageOperation,
  normalizeUsageLifecycleCounts,
  normalizeUsageOperationId,
} = require("../../functions/lib/usageOperationLifecycle");

test("usage operations allow only forward accounting transitions", () => {
  assert.equal(canTransitionUsageOperation("reserved", "settled"), true);
  assert.equal(canTransitionUsageOperation("reserved", "released"), true);
  assert.equal(canTransitionUsageOperation("settled", "billable"), true);
  assert.equal(canTransitionUsageOperation("billable", "invoiced"), true);
  assert.equal(canTransitionUsageOperation("settled", "released"), false);
  assert.equal(canTransitionUsageOperation("invoiced", "reserved"), false);
  assert.equal(USAGE_OPERATION_STATES.released, "released");
});

test("settle and release consume outstanding reservations without rewriting settled history", () => {
  const baseline = normalizeUsageLifecycleCounts({ reserved: 4, settled: 8, released: 1 }, 99);
  assert.deepEqual(applyUsageLifecycleTransition(baseline, {
    fromState: "reserved",
    toState: "settled",
    units: 2,
  }), { reserved: 2, settled: 10, released: 1, billable: 0, invoiced: 0 });
  assert.deepEqual(applyUsageLifecycleTransition(baseline, {
    fromState: "reserved",
    toState: "released",
    units: 3,
  }), { reserved: 1, settled: 8, released: 4, billable: 0, invoiced: 0 });
  assert.throws(() => applyUsageLifecycleTransition(baseline, {
    fromState: "reserved",
    toState: "settled",
    units: 5,
  }), /underflow/);
});

test("operation ids are bounded to Firestore-safe tokens", () => {
  const normalized = normalizeUsageOperationId(" youtube search / request ? 123 ");
  assert.equal(normalized, "youtubesearchrequest123");
  assert.equal(normalizeUsageOperationId("x".repeat(200)).length, 160);
});
