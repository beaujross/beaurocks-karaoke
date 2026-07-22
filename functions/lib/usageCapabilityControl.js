const USAGE_CONTROL_STATES = Object.freeze({
  enabled: "enabled",
  blocked: "blocked",
});

const USAGE_CONTROL_REASON_CODES = Object.freeze({
  platformCircuitOpen: "usage_platform_circuit_open",
  capabilityCircuitOpen: "usage_capability_circuit_open",
  workspaceUnavailable: "usage_workspace_unavailable",
  workspaceHardLimitReached: "usage_workspace_hard_limit_reached",
  roomHardLimitReached: "usage_room_hard_limit_reached",
});

const toWholeNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.floor(parsed));
};

const normalizeControlState = (value = "") => (
  String(value || "").trim().toLowerCase() === USAGE_CONTROL_STATES.blocked
    ? USAGE_CONTROL_STATES.blocked
    : USAGE_CONTROL_STATES.enabled
);

const hasOwn = (value, key) => !!value
  && typeof value === "object"
  && Object.prototype.hasOwnProperty.call(value, key);

const resolveConfiguredHardLimit = ({
  control = null,
  maximumHardLimit = 0,
  fallbackHardLimit = maximumHardLimit,
} = {}) => {
  const maximum = toWholeNumber(maximumHardLimit, 0);
  const fallback = Math.min(maximum, toWholeNumber(fallbackHardLimit, maximum));
  if (!hasOwn(control, "hardLimit")) return fallback;
  return Math.min(maximum, toWholeNumber(control.hardLimit, fallback));
};

const buildAllowedDecision = ({ workspaceHardLimit = 0, roomHardLimit = null } = {}) => ({
  allowed: true,
  reasonCode: "",
  scope: "",
  workspaceHardLimit,
  roomHardLimit,
});

const buildBlockedDecision = ({
  reasonCode = "",
  scope = "",
  workspaceHardLimit = 0,
  roomHardLimit = null,
} = {}) => ({
  allowed: false,
  reasonCode,
  scope,
  workspaceHardLimit,
  roomHardLimit,
});

const resolveUsageControlDecision = ({
  units = 1,
  planHardLimit = 0,
  workspaceControl = null,
  roomControl = null,
  workspaceExposure = 0,
  roomExposure = 0,
  platformState = USAGE_CONTROL_STATES.enabled,
  capabilityState = USAGE_CONTROL_STATES.enabled,
} = {}) => {
  const safeUnits = Math.max(1, toWholeNumber(units, 1));
  const safePlanHardLimit = toWholeNumber(planHardLimit, 0);
  const workspaceHardLimit = resolveConfiguredHardLimit({
    control: workspaceControl,
    maximumHardLimit: safePlanHardLimit,
    fallbackHardLimit: safePlanHardLimit,
  });
  const roomHardLimit = roomControl && hasOwn(roomControl, "hardLimit")
    ? resolveConfiguredHardLimit({
      control: roomControl,
      maximumHardLimit: workspaceHardLimit,
      fallbackHardLimit: workspaceHardLimit,
    })
    : null;
  const shared = { workspaceHardLimit, roomHardLimit };

  if (normalizeControlState(platformState) === USAGE_CONTROL_STATES.blocked) {
    return buildBlockedDecision({
      ...shared,
      reasonCode: USAGE_CONTROL_REASON_CODES.platformCircuitOpen,
      scope: "platform",
    });
  }
  if (normalizeControlState(capabilityState) === USAGE_CONTROL_STATES.blocked) {
    return buildBlockedDecision({
      ...shared,
      reasonCode: USAGE_CONTROL_REASON_CODES.capabilityCircuitOpen,
      scope: "capability",
    });
  }
  if (workspaceHardLimit <= 0) {
    return buildBlockedDecision({
      ...shared,
      reasonCode: USAGE_CONTROL_REASON_CODES.workspaceUnavailable,
      scope: "workspace",
    });
  }
  if (toWholeNumber(workspaceExposure, 0) + safeUnits > workspaceHardLimit) {
    return buildBlockedDecision({
      ...shared,
      reasonCode: USAGE_CONTROL_REASON_CODES.workspaceHardLimitReached,
      scope: "workspace",
    });
  }
  if (roomHardLimit !== null && toWholeNumber(roomExposure, 0) + safeUnits > roomHardLimit) {
    return buildBlockedDecision({
      ...shared,
      reasonCode: USAGE_CONTROL_REASON_CODES.roomHardLimitReached,
      scope: "room",
    });
  }
  return buildAllowedDecision(shared);
};

module.exports = {
  USAGE_CONTROL_REASON_CODES,
  USAGE_CONTROL_STATES,
  normalizeControlState,
  resolveConfiguredHardLimit,
  resolveUsageControlDecision,
};
