const assert = require("node:assert/strict");
const {
  USAGE_CONTROL_REASON_CODES,
  resolveConfiguredHardLimit,
  resolveUsageControlDecision,
} = require("../../functions/lib/usageCapabilityControl");

test("configured Workspace and Room limits can only reduce the plan ceiling", () => {
  assert.equal(resolveConfiguredHardLimit({
    control: { hardLimit: 900 },
    maximumHardLimit: 500,
  }), 500);
  assert.equal(resolveConfiguredHardLimit({
    control: { hardLimit: 240 },
    maximumHardLimit: 500,
  }), 240);
  assert.equal(resolveConfiguredHardLimit({
    control: {},
    maximumHardLimit: 500,
  }), 500);
});

test("platform and capability circuits fail before budget evaluation", () => {
  const platform = resolveUsageControlDecision({
    planHardLimit: 100,
    workspaceExposure: 100,
    platformState: "blocked",
  });
  assert.equal(platform.allowed, false);
  assert.equal(platform.reasonCode, USAGE_CONTROL_REASON_CODES.platformCircuitOpen);
  assert.equal(platform.scope, "platform");

  const capability = resolveUsageControlDecision({
    planHardLimit: 100,
    capabilityState: "blocked",
  });
  assert.equal(capability.allowed, false);
  assert.equal(capability.reasonCode, USAGE_CONTROL_REASON_CODES.capabilityCircuitOpen);
});

test("Workspace exposure includes new reservations and uses a stable denial reason", () => {
  const decision = resolveUsageControlDecision({
    units: 2,
    planHardLimit: 100,
    workspaceControl: { hardLimit: 10 },
    workspaceExposure: 9,
  });
  assert.equal(decision.allowed, false);
  assert.equal(decision.workspaceHardLimit, 10);
  assert.equal(decision.reasonCode, USAGE_CONTROL_REASON_CODES.workspaceHardLimitReached);
});

test("optional Room limits are bounded by the Workspace limit and fail independently", () => {
  const decision = resolveUsageControlDecision({
    planHardLimit: 100,
    workspaceControl: { hardLimit: 80 },
    roomControl: { hardLimit: 3 },
    workspaceExposure: 20,
    roomExposure: 3,
  });
  assert.equal(decision.allowed, false);
  assert.equal(decision.workspaceHardLimit, 80);
  assert.equal(decision.roomHardLimit, 3);
  assert.equal(decision.reasonCode, USAGE_CONTROL_REASON_CODES.roomHardLimitReached);
  assert.equal(decision.scope, "room");

  const unboundedRoom = resolveUsageControlDecision({
    planHardLimit: 100,
    workspaceExposure: 20,
    roomExposure: 99,
  });
  assert.equal(unboundedRoom.allowed, true);
  assert.equal(unboundedRoom.roomHardLimit, null);
});

test("an explicit zero cap disables use while a missing Room cap remains optional", () => {
  const workspaceOff = resolveUsageControlDecision({
    planHardLimit: 100,
    workspaceControl: { hardLimit: 0 },
  });
  assert.equal(workspaceOff.reasonCode, USAGE_CONTROL_REASON_CODES.workspaceUnavailable);

  const roomOff = resolveUsageControlDecision({
    planHardLimit: 100,
    roomControl: { hardLimit: 0 },
  });
  assert.equal(roomOff.reasonCode, USAGE_CONTROL_REASON_CODES.roomHardLimitReached);
});
