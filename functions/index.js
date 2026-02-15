const { onCall, onRequest, HttpsError } = require("firebase-functions/v2/https");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { setGlobalOptions } = require("firebase-functions/v2");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const jwt = require("jsonwebtoken");
const Stripe = require("stripe");
const {
  BASE_CAPABILITIES,
  PLAN_DEFINITIONS,
  USAGE_METER_DEFINITIONS,
  getPlanDefinition,
  isEntitledStatus,
  buildCapabilitiesForPlan,
  resolveUsageMeterQuota,
  buildUsageMeterSummary,
} = require("./lib/entitlementsUsage");

admin.initializeApp();
const APP_ID = "bross-app";
const ORGS_COLLECTION = "organizations";
const STRIPE_SUBSCRIPTIONS_COLLECTION = "stripe_subscriptions";

setGlobalOptions({
  region: "us-west1",
  maxInstances: 2,
  timeoutSeconds: 30,
  memory: "256MiB",
});

const YOUTUBE_API_KEY = defineSecret("YOUTUBE_API_KEY");
const GEMINI_API_KEY = defineSecret("GEMINI_API_KEY");
const APPLE_MUSIC_TEAM_ID = defineSecret("APPLE_MUSIC_TEAM_ID");
const APPLE_MUSIC_KEY_ID = defineSecret("APPLE_MUSIC_KEY_ID");
const APPLE_MUSIC_PRIVATE_KEY = defineSecret("APPLE_MUSIC_PRIVATE_KEY");
const STRIPE_SECRET_KEY = defineSecret("STRIPE_SECRET_KEY");
const STRIPE_WEBHOOK_SECRET = defineSecret("STRIPE_WEBHOOK_SECRET");
const GOOGLE_MAPS_API_KEY = defineSecret("GOOGLE_MAPS_API_KEY");

const rateState = new Map();
const GLOBAL_LIMITS = { perMinute: 120, perHour: 1000 };
const DEFAULT_LIMITS = { perMinute: 30, perHour: 300 };

const nowMs = () => Date.now();

const getClientIp = (req) => {
  const forwarded = req.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.ip || "unknown";
};

const limitKey = (scope, ip) => `${scope}:${ip}`;

const checkRateLimit = (req, scope, limits = DEFAULT_LIMITS) => {
  const ip = getClientIp(req);
  const now = nowMs();
  const minuteKey = `${limitKey(scope, ip)}:m:${Math.floor(now / 60000)}`;
  const hourKey = `${limitKey(scope, ip)}:h:${Math.floor(now / 3600000)}`;
  const globalMinuteKey = `global:m:${Math.floor(now / 60000)}`;
  const globalHourKey = `global:h:${Math.floor(now / 3600000)}`;

  const bump = (key) => {
    const next = (rateState.get(key) || 0) + 1;
    rateState.set(key, next);
    return next;
  };

  const minuteCount = bump(minuteKey);
  const hourCount = bump(hourKey);
  const globalMinute = bump(globalMinuteKey);
  const globalHour = bump(globalHourKey);

  if (minuteCount > limits.perMinute || hourCount > limits.perHour) {
    throw new HttpsError("resource-exhausted", "Rate limit exceeded.");
  }
  if (globalMinute > GLOBAL_LIMITS.perMinute || globalHour > GLOBAL_LIMITS.perHour) {
    throw new HttpsError("resource-exhausted", "Server is busy. Try again.");
  }
};

const ensureString = (val, name) => {
  if (!val || typeof val !== "string") {
    throw new HttpsError("invalid-argument", `${name} must be a string.`);
  }
};

const getAppCheckMode = () => {
  const mode = String(process.env.APP_CHECK_MODE || "off").trim().toLowerCase();
  return mode === "log" || mode === "enforce" ? mode : "off";
};

const hasAppCheck = (request) =>
  typeof request?.app?.appId === "string" && request.app.appId.trim().length > 0;

const enforceAppCheckIfEnabled = (request, scope = "unknown") => {
  if (hasAppCheck(request)) return;
  const mode = getAppCheckMode();
  if (mode === "off") return;

  const uid = request.auth?.uid || "anonymous";
  console.warn(`[app-check] missing token scope=${scope} uid=${uid}`);

  if (mode === "log") return;
  throw new HttpsError("failed-precondition", "App Check token required.");
};

const requireAuth = (request, message = "Sign in required.") => {
  const uid = request.auth?.uid || "";
  if (!uid) {
    throw new HttpsError("unauthenticated", message);
  }
  return uid;
};

const normalizeOptionalName = (value, fallback = "Guest") => {
  const name = typeof value === "string" ? value.trim().slice(0, 80) : "";
  return name || fallback;
};

const clampNumber = (val, min, max, fallback) => {
  const num = Number(val);
  if (Number.isNaN(num)) return fallback;
  return Math.max(min, Math.min(max, num));
};

const normalizeText = (value = "") =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");

const buildSongKey = (title = "", artist = "") => {
  const cleanTitle = normalizeText(title || "unknown");
  const cleanArtist = normalizeText(artist || "unknown");
  return `${cleanTitle}__${cleanArtist}`;
};

const extractYouTubeId = (input = "") => {
  if (!input) return "";
  const match = input.match(/(?:v=|youtu\.be\/|embed\/)([A-Za-z0-9_-]{6,})/);
  return match ? match[1] : "";
};

const getWeekKeyUtc = (date = new Date()) => {
  const utc = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = utc.getUTCDay();
  utc.setUTCDate(utc.getUTCDate() - day);
  const y = utc.getUTCFullYear();
  const m = String(utc.getUTCMonth() + 1).padStart(2, "0");
  const d = String(utc.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const isBetterScore = (candidateScore, candidateApplause, current) => {
  if (!current) return true;
  const bestScore = Number(current.bestScore || current.score || 0);
  const bestApplause = Number(current.applauseScore || 0);
  if (candidateScore > bestScore) return true;
  if (candidateScore === bestScore && candidateApplause > bestApplause) return true;
  return false;
};

let stripeClient = null;
const getStripeClient = () => {
  if (stripeClient) return stripeClient;
  const key = STRIPE_SECRET_KEY.value();
  if (!key) {
    throw new HttpsError("failed-precondition", "Stripe is not configured.");
  }
  stripeClient = new Stripe(key);
  return stripeClient;
};

const getRootRef = () =>
  admin
    .firestore()
    .collection("artifacts")
    .doc(APP_ID)
    .collection("public")
    .doc("data");

const normalizeRoomCode = (value = "") => String(value || "").trim().toUpperCase();

const sanitizeOrgToken = (value = "") =>
  String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .slice(0, 80);

const buildOrgIdForUid = (uid = "") => {
  const token = sanitizeOrgToken(uid) || "owner";
  return `org_${token}`;
};

const normalizeOrgName = (value = "", uid = "") => {
  const trimmed = typeof value === "string" ? value.trim().slice(0, 120) : "";
  if (trimmed) return trimmed;
  const token = sanitizeOrgToken(uid).slice(0, 6) || "ORG";
  return `Workspace ${token.toUpperCase()}`;
};

const normalizeCapabilities = (input = {}) => {
  const caps = { ...BASE_CAPABILITIES };
  Object.entries(input || {}).forEach(([key, value]) => {
    caps[key] = !!value;
  });
  return caps;
};

const isPaidPlan = (planId = "") => {
  const plan = getPlanDefinition(planId);
  return !!(plan && plan.id !== "free" && plan.interval && plan.amountCents > 0);
};

const planToUserTier = (planId = "") => {
  const plan = getPlanDefinition(planId);
  return plan?.tier || "free";
};

const planToUserPlan = (planId = "") => {
  const plan = getPlanDefinition(planId);
  if (plan?.interval === "year") return "yearly";
  if (plan?.interval === "month") return "monthly";
  return "monthly";
};

const valueToMillis = (value) => {
  if (!value) return 0;
  if (value instanceof Date) return value.getTime();
  if (typeof value?.toMillis === "function") return value.toMillis();
  if (typeof value?.seconds === "number") return value.seconds * 1000;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

const orgsCollection = () => admin.firestore().collection(ORGS_COLLECTION);

const getUsagePeriodKey = (date = new Date()) => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${year}${month}`;
};

const normalizeUsagePeriodKey = (value = "") => {
  const trimmed = String(value || "").trim();
  if (!trimmed) return getUsagePeriodKey();
  if (!/^\d{6}$/.test(trimmed)) return "";
  const month = Number(trimmed.slice(4, 6));
  if (month < 1 || month > 12) return "";
  return trimmed;
};

const getPeriodRangeForKey = (periodKey = "") => {
  const safe = String(periodKey || "");
  if (!/^\d{6}$/.test(safe)) {
    return { startMs: 0, endMs: 0 };
  }
  const year = Number(safe.slice(0, 4));
  const monthIndex = Number(safe.slice(4, 6)) - 1;
  const start = Date.UTC(year, monthIndex, 1, 0, 0, 0, 0);
  const end = Date.UTC(year, monthIndex + 1, 1, 0, 0, 0, 0) - 1;
  return { startMs: start, endMs: end };
};

const toWholeNumber = (value, fallback = 0) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.floor(n));
};

const readOrganizationUsageSummary = async ({
  orgId = "",
  entitlements = null,
  periodKey = getUsagePeriodKey(),
}) => {
  if (!orgId) {
    return {
      orgId: "",
      period: periodKey,
      planId: entitlements?.planId || "free",
      status: entitlements?.status || "inactive",
      meters: {},
      totals: {
        estimatedOverageCents: 0,
      },
      generatedAtMs: nowMs(),
      periodRange: getPeriodRangeForKey(periodKey),
    };
  }
  const usageRef = orgsCollection().doc(orgId).collection("usage").doc(periodKey);
  const usageSnap = await usageRef.get();
  const usageData = usageSnap.data() || {};
  const meterData = usageData.meters || {};
  const meters = {};
  let estimatedOverageCents = 0;

  Object.keys(USAGE_METER_DEFINITIONS).forEach((meterId) => {
    const quota = resolveUsageMeterQuota({
      meterId,
      planId: entitlements?.planId || "free",
      status: entitlements?.status || "inactive",
    });
    const used = toWholeNumber(meterData?.[meterId]?.used, 0);
    const summary = buildUsageMeterSummary({
      meterId,
      used,
      quota,
      periodKey,
    });
    meters[meterId] = summary;
    estimatedOverageCents += summary.estimatedOverageCents;
  });

  return {
    orgId,
    period: periodKey,
    planId: entitlements?.planId || "free",
    status: entitlements?.status || "inactive",
    meters,
    totals: {
      estimatedOverageCents,
    },
    generatedAtMs: nowMs(),
    periodRange: getPeriodRangeForKey(periodKey),
  };
};

const centsToDollarString = (cents = 0) => (toWholeNumber(cents, 0) / 100).toFixed(2);

const csvEscape = (value = "") => {
  const s = String(value ?? "");
  if (s.includes(",") || s.includes("\"") || s.includes("\n")) {
    return `"${s.replace(/"/g, "\"\"")}"`;
  }
  return s;
};

const formatPeriodLabel = (periodKey = "") => {
  if (!/^\d{6}$/.test(String(periodKey || ""))) return "Current Period";
  const year = Number(periodKey.slice(0, 4));
  const monthIndex = Number(periodKey.slice(4, 6)) - 1;
  const date = new Date(Date.UTC(year, monthIndex, 1));
  return date.toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
};

const buildUsageInvoiceDraft = ({
  orgId = "",
  orgName = "",
  entitlements = null,
  usageSummary = null,
  periodKey = getUsagePeriodKey(),
  includeBasePlan = false,
  taxRatePercent = 0,
  customerName = "",
}) => {
  const safeEntitlements = entitlements || {};
  const safeUsage = usageSummary || {
    meters: {},
    period: periodKey,
    totals: { estimatedOverageCents: 0 },
    periodRange: getPeriodRangeForKey(periodKey),
  };
  const period = safeUsage.period || periodKey;
  const periodLabel = formatPeriodLabel(period);
  const plan = getPlanDefinition(safeEntitlements.planId) || PLAN_DEFINITIONS.free;
  const issueDateMs = safeUsage?.periodRange?.endMs || nowMs();
  const dueDateMs = issueDateMs + (14 * 24 * 60 * 60 * 1000);
  const invoiceId = `INV-${sanitizeOrgToken(orgId).toUpperCase().slice(-12) || "ORG"}-${period}`;
  const lineItems = [];
  const billingEntity = String(customerName || "").trim() || String(orgName || "").trim() || orgId || "Customer";
  const rateCardSnapshot = {
    generatedAtMs: nowMs(),
    planId: safeEntitlements.planId || "free",
    planStatus: safeEntitlements.status || "inactive",
    meters: {},
  };

  if (includeBasePlan && isEntitledStatus(safeEntitlements.status) && plan.amountCents > 0) {
    lineItems.push({
      id: `base_plan_${plan.id}`,
      type: "base_plan",
      description: `${plan.name} subscription (${plan.interval || "period"})`,
      quantity: 1,
      unit: "plan",
      unitPriceCents: toWholeNumber(plan.amountCents, 0),
      amountCents: toWholeNumber(plan.amountCents, 0),
      period,
    });
  }

  const meters = Object.values(safeUsage.meters || {}).sort((a, b) =>
    String(a?.label || "").localeCompare(String(b?.label || ""))
  );
  meters.forEach((meter) => {
    const overageUnits = toWholeNumber(meter?.overageUnits, 0);
    const passThroughUnitCostCents = toWholeNumber(meter?.passThroughUnitCostCents, 0);
    const markupMultiplier = Number.isFinite(Number(meter?.markupMultiplier))
      ? Math.max(0, Number(meter?.markupMultiplier))
      : 1;
    const billableUnitRateCents = toWholeNumber(
      meter?.billableUnitRateCents,
      toWholeNumber(meter?.overageRateCents, 0)
    );
    rateCardSnapshot.meters[meter.meterId] = {
      meterId: meter.meterId,
      label: meter.label || meter.meterId,
      unit: meter.unit || "unit",
      includedUnits: toWholeNumber(meter?.included, 0),
      hardLimitUnits: toWholeNumber(meter?.hardLimit, 0),
      passThroughUnitCostCents,
      markupMultiplier,
      billableUnitRateCents,
    };
    if (!overageUnits || !billableUnitRateCents) return;
    lineItems.push({
      id: `overage_${meter.meterId}`,
      type: "overage",
      meterId: meter.meterId,
      description: `${meter.label} overage (${periodLabel})`,
      quantity: overageUnits,
      unit: meter.unit || "unit",
      includedUnits: toWholeNumber(meter?.included, 0),
      overageUnits,
      passThroughUnitCostCents,
      markupMultiplier,
      billableUnitRateCents,
      unitPriceCents: billableUnitRateCents,
      amountCents: overageUnits * billableUnitRateCents,
      period,
    });
  });

  const subtotalCents = lineItems.reduce((sum, line) => sum + toWholeNumber(line.amountCents, 0), 0);
  const safeTaxRatePercent = Math.max(0, Math.min(100, Number(taxRatePercent || 0)));
  const taxCents = Math.round(subtotalCents * (safeTaxRatePercent / 100));
  const totalCents = subtotalCents + taxCents;

  const qbseTransactionCsvRows = [
    ["Date", "Description", "Amount"],
    ...lineItems.map((line) => ([
      new Date(issueDateMs).toISOString().slice(0, 10),
      `${billingEntity} - ${line.description}`,
      centsToDollarString(line.amountCents),
    ])),
  ];
  const qbseTransactionCsv = qbseTransactionCsvRows
    .map((row) => row.map((cell) => csvEscape(cell)).join(","))
    .join("\n");

  const lineItemCsvRows = [
    [
      "InvoiceNumber",
      "InvoiceDate",
      "DueDate",
      "Customer",
      "Description",
      "Qty",
      "UnitPrice",
      "Amount",
      "IncludedUnits",
      "OverageUnits",
      "PassThroughUnitCost",
      "MarkupMultiplier",
      "BillableUnitRate",
    ],
    ...lineItems.map((line) => ([
      invoiceId,
      new Date(issueDateMs).toISOString().slice(0, 10),
      new Date(dueDateMs).toISOString().slice(0, 10),
      billingEntity,
      line.description,
      String(line.quantity || 0),
      centsToDollarString(line.unitPriceCents || 0),
      centsToDollarString(line.amountCents || 0),
      String(toWholeNumber(line.includedUnits, 0)),
      String(toWholeNumber(line.overageUnits, 0)),
      centsToDollarString(line.passThroughUnitCostCents || 0),
      Number(line.markupMultiplier || 1).toFixed(2),
      centsToDollarString(line.billableUnitRateCents || line.unitPriceCents || 0),
    ])),
  ];
  const lineItemCsv = lineItemCsvRows
    .map((row) => row.map((cell) => csvEscape(cell)).join(","))
    .join("\n");

  return {
    invoiceId,
    orgId,
    orgName: orgName || orgId,
    customerName: billingEntity,
    period,
    periodLabel,
    issueDateMs,
    dueDateMs,
    planId: safeEntitlements.planId || "free",
    planStatus: safeEntitlements.status || "inactive",
    includeBasePlan: !!includeBasePlan,
    taxRatePercent: safeTaxRatePercent,
    lineItems,
    totals: {
      subtotalCents,
      taxCents,
      totalCents,
    },
    rateCardSnapshot,
    usageSummary: safeUsage,
    quickbooks: {
      selfEmployed: {
        apiSupported: false,
        suggestedFlow: "Use line-item CSV for manual invoice entry and transaction CSV for income import reconciliation.",
        lineItemCsv,
        qbseTransactionCsv,
      },
      online: {
        apiSupported: true,
        suggestedFlow: "Map lineItems to QuickBooks Online Invoice API SalesItemLineDetail entries.",
        invoicePayloadCandidate: {
          customerDisplayName: billingEntity,
          txnDate: new Date(issueDateMs).toISOString().slice(0, 10),
          dueDate: new Date(dueDateMs).toISOString().slice(0, 10),
          lineItems: lineItems.map((line) => ({
            description: line.description,
            qty: line.quantity || 0,
            unitPrice: Number(centsToDollarString(line.unitPriceCents || 0)),
            amount: Number(centsToDollarString(line.amountCents || 0)),
          })),
        },
      },
    },
  };
};

const sanitizeInvoiceStatus = (value = "") => {
  const safe = String(value || "").trim().toLowerCase();
  if (["draft", "sent", "paid", "void"].includes(safe)) return safe;
  return "draft";
};

const MARKETING_WAITLIST_USE_CASES = new Set([
  "Home Party Host",
  "Fundraiser Organizer",
  "Community Event Host",
  "Venue / KJ Operator",
]);

const sanitizeWaitlistName = (value = "") => {
  const safe = String(value || "").trim().slice(0, 80);
  if (!safe) {
    throw new HttpsError("invalid-argument", "name is required.");
  }
  return safe;
};

const sanitizeWaitlistEmail = (value = "") => {
  const safe = String(value || "").trim().toLowerCase();
  if (!safe || safe.length > 254) {
    throw new HttpsError("invalid-argument", "Valid email is required.");
  }
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(safe);
  if (!valid) {
    throw new HttpsError("invalid-argument", "Valid email is required.");
  }
  return safe;
};

const sanitizeWaitlistUseCase = (value = "") => {
  const safe = String(value || "").trim();
  if (MARKETING_WAITLIST_USE_CASES.has(safe)) return safe;
  return "Home Party Host";
};

const sanitizeWaitlistSource = (value = "") => {
  const safe = String(value || "").trim().slice(0, 120);
  if (!safe) return "marketing_site";
  return safe;
};

const buildWaitlistDocId = (email = "") =>
  `wl_${email.replace(/[^a-z0-9]/g, "_").replace(/_+/g, "_").slice(0, 140) || "unknown"}`;

const reserveOrganizationUsageUnits = async ({
  orgId = "",
  entitlements = null,
  meterId = "",
  units = 1,
}) => {
  if (!orgId) {
    throw new HttpsError("failed-precondition", "Organization is not initialized.");
  }
  const meter = USAGE_METER_DEFINITIONS[meterId];
  if (!meter) {
    throw new HttpsError("invalid-argument", `Unknown usage meter "${meterId}".`);
  }
  const safeUnits = Math.max(1, toWholeNumber(units, 1));
  const periodKey = getUsagePeriodKey();
  const quota = resolveUsageMeterQuota({
    meterId,
    planId: entitlements?.planId || "free",
    status: entitlements?.status || "inactive",
  });
  const usageRef = orgsCollection().doc(orgId).collection("usage").doc(periodKey);
  const now = admin.firestore.FieldValue.serverTimestamp();
  const db = admin.firestore();

  const nextUsed = await db.runTransaction(async (tx) => {
    const snap = await tx.get(usageRef);
    const data = snap.data() || {};
    const currentUsed = toWholeNumber(data?.meters?.[meterId]?.used, 0);
    const plannedUsed = currentUsed + safeUnits;
    if (quota.hardLimit > 0 && plannedUsed > quota.hardLimit) {
      throw new HttpsError(
        "resource-exhausted",
        `${meter.label} monthly hard limit reached for this workspace.`
      );
    }
    const patch = {
      orgId,
      period: periodKey,
      planIdSnapshot: entitlements?.planId || "free",
      statusSnapshot: entitlements?.status || "inactive",
      updatedAt: now,
      [`meters.${meterId}.used`]: plannedUsed,
      [`meters.${meterId}.included`]: quota.included,
      [`meters.${meterId}.hardLimit`]: quota.hardLimit,
      [`meters.${meterId}.overageRateCents`]: quota.overageRateCents,
      [`meters.${meterId}.passThroughUnitCostCents`]: quota.passThroughUnitCostCents,
      [`meters.${meterId}.markupMultiplier`]: quota.markupMultiplier,
      [`meters.${meterId}.billableUnitRateCents`]: quota.billableUnitRateCents,
      [`meters.${meterId}.updatedAt`]: now,
    };
    if (!snap.exists) {
      patch.createdAt = now;
    }
    tx.set(usageRef, patch, { merge: true });
    return plannedUsed;
  });

  return buildUsageMeterSummary({
    meterId,
    used: nextUsed,
    quota,
    periodKey,
  });
};

const ensureOrganizationForUser = async ({ uid, orgName = "" }) => {
  const db = admin.firestore();
  const userRef = db.collection("users").doc(uid);
  const userSnap = await userRef.get();
  const userData = userSnap.data() || {};
  const existingOrgId = String(userData?.organization?.orgId || "").trim();
  const orgId = sanitizeOrgToken(existingOrgId) ? existingOrgId : buildOrgIdForUid(uid);
  const role = String(userData?.organization?.role || "owner").trim() || "owner";
  const orgRef = orgsCollection().doc(orgId);
  const memberRef = orgRef.collection("members").doc(uid);
  const subscriptionRef = orgRef.collection("subscription").doc("current");
  const entitlementsRef = orgRef.collection("entitlements").doc("current");
  const now = admin.firestore.FieldValue.serverTimestamp();

  const orgSnap = await orgRef.get();
  const batch = db.batch();
  if (!orgSnap.exists) {
    batch.set(orgRef, {
      orgId,
      name: normalizeOrgName(orgName, uid),
      ownerUid: uid,
      status: "active",
      createdAt: now,
      updatedAt: now,
    }, { merge: true });
    batch.set(subscriptionRef, {
      orgId,
      planId: "free",
      status: "inactive",
      provider: "internal",
      createdAt: now,
      updatedAt: now,
    }, { merge: true });
    batch.set(entitlementsRef, {
      orgId,
      planId: "free",
      status: "inactive",
      capabilities: { ...BASE_CAPABILITIES },
      source: "bootstrap",
      createdAt: now,
      updatedAt: now,
    }, { merge: true });
  } else {
    batch.set(orgRef, { updatedAt: now }, { merge: true });
  }
  batch.set(memberRef, {
    uid,
    role,
    createdAt: now,
    updatedAt: now,
  }, { merge: true });
  batch.set(userRef, {
    organization: {
      orgId,
      role,
      updatedAt: now,
    },
  }, { merge: true });
  await batch.commit();
  return { orgId, role };
};

const readOrganizationEntitlements = async (orgId = "") => {
  if (!orgId) {
    return {
      orgId: "",
      planId: "free",
      status: "inactive",
      capabilities: { ...BASE_CAPABILITIES },
      provider: "internal",
      renewalAtMs: 0,
      cancelAtPeriodEnd: false,
      source: "none",
    };
  }
  const orgRef = orgsCollection().doc(orgId);
  const [subscriptionSnap, entitlementsSnap] = await Promise.all([
    orgRef.collection("subscription").doc("current").get(),
    orgRef.collection("entitlements").doc("current").get(),
  ]);

  const subscriptionData = subscriptionSnap.data() || {};
  const planId = String(
    entitlementsSnap.data()?.planId
      || subscriptionData.planId
      || "free"
  ).trim() || "free";
  const status = String(
    entitlementsSnap.data()?.status
      || subscriptionData.status
      || "inactive"
  ).trim() || "inactive";
  const capabilities = entitlementsSnap.exists
    ? normalizeCapabilities(entitlementsSnap.data()?.capabilities || {})
    : buildCapabilitiesForPlan(planId, status);
  const renewalAtMs = valueToMillis(subscriptionData.currentPeriodEnd);
  const provider = String(subscriptionData.provider || "internal").trim() || "internal";
  const cancelAtPeriodEnd = !!subscriptionData.cancelAtPeriodEnd;

  return {
    orgId,
    planId,
    status,
    provider,
    renewalAtMs,
    cancelAtPeriodEnd,
    capabilities,
    source: String(entitlementsSnap.data()?.source || "derived"),
  };
};

const resolveUserEntitlements = async (uid) => {
  const db = admin.firestore();
  const { orgId, role } = await ensureOrganizationForUser({ uid });
  const [entitlements, userSnap] = await Promise.all([
    readOrganizationEntitlements(orgId),
    db.collection("users").doc(uid).get(),
  ]);
  const userData = userSnap.data() || {};
  const legacyTier = String(userData?.subscription?.tier || "").toLowerCase();
  const capabilities = normalizeCapabilities(entitlements.capabilities || {});
  if (legacyTier === "host" || legacyTier === "host_plus") {
    capabilities["ai.generate_content"] = true;
    capabilities["api.youtube_data"] = true;
    capabilities["api.apple_music"] = true;
    capabilities["billing.invoice_drafts"] = true;
    capabilities["workspace.onboarding"] = true;
  }
  return {
    orgId,
    role,
    planId: entitlements.planId,
    status: entitlements.status,
    provider: entitlements.provider,
    renewalAtMs: entitlements.renewalAtMs,
    cancelAtPeriodEnd: entitlements.cancelAtPeriodEnd,
    source: entitlements.source,
    capabilities,
  };
};

const requireCapability = async (request, capability) => {
  const uid = requireAuth(request);
  const entitlements = await resolveUserEntitlements(uid);
  if (!entitlements.capabilities?.[capability]) {
    throw new HttpsError(
      "permission-denied",
      `Capability "${capability}" requires an active subscription.`
    );
  }
  return { uid, entitlements };
};

const resolvePlanIdFromStripeSubscription = ({ explicitPlanId = "", subscription = null, fallbackPlanId = "" }) => {
  const candidates = [explicitPlanId, fallbackPlanId, subscription?.metadata?.planId || ""];
  for (const candidate of candidates) {
    if (getPlanDefinition(candidate)) return candidate;
  }
  const interval = subscription?.items?.data?.[0]?.price?.recurring?.interval || "";
  if (interval === "year") return "host_annual";
  if (interval === "month") return "host_monthly";
  return "free";
};

const applyOrganizationSubscriptionState = async ({
  orgId,
  ownerUid = "",
  planId = "free",
  status = "inactive",
  provider = "stripe",
  stripeCustomerId = "",
  stripeSubscriptionId = "",
  currentPeriodEndSec = 0,
  cancelAtPeriodEnd = false,
  source = "stripe_webhook",
}) => {
  if (!orgId) return;
  const db = admin.firestore();
  const now = admin.firestore.FieldValue.serverTimestamp();
  const safePlanId = getPlanDefinition(planId) ? planId : "free";
  const plan = getPlanDefinition(safePlanId) || PLAN_DEFINITIONS.free;
  const capabilities = buildCapabilitiesForPlan(safePlanId, status);
  const entitlementActive = isEntitledStatus(status);
  const currentPeriodEnd = Number(currentPeriodEndSec || 0) > 0
    ? new Date(Number(currentPeriodEndSec) * 1000)
    : null;
  const orgRef = orgsCollection().doc(orgId);
  const batch = db.batch();
  batch.set(orgRef, {
    orgId,
    ownerUid: ownerUid || null,
    billingPlanId: safePlanId,
    billingStatus: status,
    updatedAt: now,
  }, { merge: true });
  batch.set(orgRef.collection("subscription").doc("current"), {
    orgId,
    planId: safePlanId,
    status,
    provider,
    interval: plan.interval || null,
    amountCents: plan.amountCents || 0,
    stripeCustomerId: stripeCustomerId || null,
    stripeSubscriptionId: stripeSubscriptionId || null,
    cancelAtPeriodEnd: !!cancelAtPeriodEnd,
    currentPeriodEnd: currentPeriodEnd || null,
    updatedAt: now,
  }, { merge: true });
  batch.set(orgRef.collection("entitlements").doc("current"), {
    orgId,
    planId: safePlanId,
    status,
    capabilities,
    source,
    updatedAt: now,
  }, { merge: true });

  if (ownerUid) {
    const userRef = db.collection("users").doc(ownerUid);
    batch.set(userRef, {
      organization: {
        orgId,
        role: "owner",
        updatedAt: now,
      },
      subscription: {
        tier: planToUserTier(safePlanId),
        plan: planToUserPlan(safePlanId),
        startDate: entitlementActive ? now : null,
        renewalDate: currentPeriodEnd || null,
        cancelledAt: cancelAtPeriodEnd ? now : null,
        paymentMethod: provider,
      },
    }, { merge: true });
    batch.set(orgRef.collection("members").doc(ownerUid), {
      uid: ownerUid,
      role: "owner",
      updatedAt: now,
    }, { merge: true });
  }

  if (stripeSubscriptionId) {
    batch.set(db.collection(STRIPE_SUBSCRIPTIONS_COLLECTION).doc(stripeSubscriptionId), {
      orgId,
      ownerUid: ownerUid || null,
      planId: safePlanId,
      status,
      stripeCustomerId: stripeCustomerId || null,
      updatedAt: now,
    }, { merge: true });
  }

  await batch.commit();
};

const ensureRoomHostAccess = async ({
  tx = null,
  rootRef = getRootRef(),
  roomCode = "",
  callerUid = "",
  deniedMessage = "Only room hosts can perform this action.",
}) => {
  const safeRoomCode = normalizeRoomCode(roomCode);
  if (!safeRoomCode) {
    throw new HttpsError("invalid-argument", "roomCode is required.");
  }
  if (!callerUid) {
    throw new HttpsError("unauthenticated", "Sign in required.");
  }

  const roomRef = rootRef.collection("rooms").doc(safeRoomCode);
  const roomSnap = tx ? await tx.get(roomRef) : await roomRef.get();
  if (!roomSnap.exists) {
    throw new HttpsError("not-found", "Room not found.");
  }

  const roomData = roomSnap.data() || {};
  const hostUid = typeof roomData.hostUid === "string" ? roomData.hostUid : "";
  const hostUids = Array.isArray(roomData.hostUids)
    ? roomData.hostUids.filter((u) => typeof u === "string")
    : [];
  const isHost = callerUid === hostUid || hostUids.includes(callerUid);
  if (!isHost) {
    throw new HttpsError("permission-denied", deniedMessage);
  }

  return { roomRef, roomData, roomCode: safeRoomCode };
};

const normalizeAwardKeyToken = (value = "") =>
  String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .slice(0, 120);

const normalizePointAwards = (awards = []) => {
  const aggregate = new Map();
  (Array.isArray(awards) ? awards : []).forEach((raw) => {
    const uid = typeof raw?.uid === "string" ? raw.uid.trim() : "";
    const points = clampNumber(raw?.points || 0, 0, 5000, 0);
    if (!uid || !points) return;
    aggregate.set(uid, (aggregate.get(uid) || 0) + points);
  });
  const normalized = [];
  for (const [uid, total] of aggregate.entries()) {
    const points = clampNumber(total, 0, 5000, 0);
    if (!points) continue;
    normalized.push({ uid, points });
  }
  return normalized;
};

const applyRoomAwardsOnce = async ({
  roomCode,
  awardKey,
  awards = [],
  source = "room_signal",
}) => {
  const safeRoomCode = normalizeRoomCode(roomCode);
  const safeAwardKey = normalizeAwardKeyToken(awardKey);
  const normalizedAwards = normalizePointAwards(awards);
  if (!safeRoomCode || !safeAwardKey || !normalizedAwards.length) {
    return { applied: false, awardedCount: 0, awardedPoints: 0 };
  }

  const rootRef = getRootRef();
  const eventRef = rootRef.collection("room_awards").doc(safeAwardKey);

  return admin.firestore().runTransaction(async (tx) => {
    const eventSnap = await tx.get(eventRef);
    if (eventSnap.exists) {
      return { applied: false, duplicate: true, awardedCount: 0, awardedPoints: 0 };
    }

    const targets = normalizedAwards.map((entry) => ({
      ...entry,
      ref: rootRef.collection("room_users").doc(`${safeRoomCode}_${entry.uid}`),
    }));
    const snaps = await Promise.all(targets.map((entry) => tx.get(entry.ref)));

    const appliedAwards = [];
    const skippedUids = [];
    targets.forEach((entry, idx) => {
      if (!snaps[idx].exists) {
        skippedUids.push(entry.uid);
        return;
      }
      appliedAwards.push(entry);
      tx.update(entry.ref, {
        points: admin.firestore.FieldValue.increment(entry.points),
        lastActiveAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });

    let awardedPoints = 0;
    appliedAwards.forEach((entry) => {
      awardedPoints += entry.points;
    });

    tx.set(eventRef, {
      roomCode: safeRoomCode,
      source,
      awards: appliedAwards.map(({ uid, points }) => ({ uid, points })),
      skippedUids,
      awardedCount: appliedAwards.length,
      awardedPoints,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return {
      applied: appliedAwards.length > 0,
      duplicate: false,
      awardedCount: appliedAwards.length,
      awardedPoints,
      skippedUids,
    };
  });
};

const decodeEntities = (input = "") =>
  input
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

const parseTimeMs = (val = "") => {
  const parts = val.split(":").map((p) => p.trim());
  const toSeconds = (p) => {
    const [s, ms = "0"] = p.split(".");
    return Number(s || 0) + Number(ms.padEnd(3, "0")) / 1000;
  };
  if (parts.length === 3) {
    return (
      Number(parts[0] || 0) * 3600 * 1000 +
      Number(parts[1] || 0) * 60 * 1000 +
      toSeconds(parts[2]) * 1000
    );
  }
  if (parts.length === 2) {
    return Number(parts[0] || 0) * 60 * 1000 + toSeconds(parts[1]) * 1000;
  }
  return toSeconds(parts[0] || "0") * 1000;
};

const parseTtml = (ttml = "") => {
  if (!ttml) return [];
  const results = [];
  const regex = /<p\b[^>]*begin="([^"]+)"[^>]*end="([^"]+)"[^>]*>([\s\S]*?)<\/p>/gi;
  let match;
  while ((match = regex.exec(ttml))) {
    const startMs = parseTimeMs(match[1]);
    const endMs = parseTimeMs(match[2]);
    const rawText = match[3]
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .trim();
    const text = decodeEntities(rawText);
    if (!text) continue;
    results.push({ text, startMs, endMs });
  }
  return results;
};

let appleTokenCache = { token: null, exp: 0 };
const getAppleMusicToken = () => {
  const teamId = APPLE_MUSIC_TEAM_ID.value();
  const keyId = APPLE_MUSIC_KEY_ID.value();
  let privateKey = APPLE_MUSIC_PRIVATE_KEY.value();
  if (!teamId || !keyId || !privateKey) {
    throw new HttpsError("failed-precondition", "Apple Music secrets not configured.");
  }
  privateKey = privateKey.replace(/\\n/g, "\n");
  const now = Math.floor(Date.now() / 1000);
  if (appleTokenCache.token && appleTokenCache.exp > now + 60) {
    return appleTokenCache.token;
  }
  const exp = now + 60 * 60;
  const token = jwt.sign(
    { iss: teamId, iat: now, exp },
    privateKey,
    { algorithm: "ES256", header: { kid: keyId } }
  );
  appleTokenCache = { token, exp };
  return token;
};

const ensureSongAdmin = async ({
  title,
  artist,
  artworkUrl,
  itunesId,
  appleMusicId,
  aliases = [],
  verifyMeta = false,
  verifiedBy = "host",
}) => {
  const safeTitle = (title || "").trim();
  if (!safeTitle) return null;
  const safeArtist = (artist || "Unknown").trim() || "Unknown";
  const songId = buildSongKey(safeTitle, safeArtist);
  const ref = admin.firestore().collection("songs").doc(songId);
  const snap = await ref.get();

  const updates = {
    title: safeTitle,
    artist: safeArtist,
    normalizedKey: songId,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  if (!snap.exists) {
    updates.createdAt = admin.firestore.FieldValue.serverTimestamp();
  }
  if (artworkUrl) {
    updates.artworkUrl = artworkUrl;
  }
  if (itunesId) {
    updates.itunesId = String(itunesId);
  }
  if (appleMusicId) {
    updates.appleMusicIds = admin.firestore.FieldValue.arrayUnion(String(appleMusicId));
  }
  if (aliases.length) {
    const cleanAliases = aliases.filter(Boolean).map((item) => String(item));
    if (cleanAliases.length) {
      updates.aliases = admin.firestore.FieldValue.arrayUnion(...cleanAliases);
    }
  }

  if (verifyMeta && typeof verifyMeta === "object") {
    updates.verifiedMeta = {
      title: safeTitle,
      artist: safeArtist,
      artworkUrl: artworkUrl || null,
      lyricsSource: verifyMeta.lyricsSource || null,
      lyricsTimed: !!verifyMeta.lyricsTimed,
      lastVerifiedAt: admin.firestore.FieldValue.serverTimestamp(),
      verifiedBy,
    };
  }

  await ref.set(updates, { merge: true });
  return { songId, songData: snap.exists ? snap.data() : null };
};

const ensureTrackAdmin = async ({
  songId,
  source,
  mediaUrl,
  appleMusicId,
  label,
  duration,
  audioOnly,
  backingOnly,
  addedBy,
}) => {
  if (!songId) return null;
  const cleanSource = source || "custom";
  const youtubeId = cleanSource === "youtube" ? extractYouTubeId(mediaUrl) : "";
  let trackId = "";

  if (cleanSource === "youtube" && youtubeId) {
    trackId = `${songId}__yt__${youtubeId}`;
  } else if (cleanSource === "apple" && appleMusicId) {
    trackId = `${songId}__apple__${appleMusicId}`;
  }

  const payload = {
    songId,
    source: cleanSource,
    mediaUrl: mediaUrl || null,
    appleMusicId: appleMusicId || null,
    label: label || null,
    duration: duration || null,
    audioOnly: !!audioOnly,
    backingOnly: !!backingOnly,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  if (addedBy) payload.addedBy = addedBy;

  if (trackId) {
    const ref = admin.firestore().collection("tracks").doc(trackId);
    const snap = await ref.get();
    if (!snap.exists) {
      payload.createdAt = admin.firestore.FieldValue.serverTimestamp();
    }
    await ref.set(payload, { merge: true });
    return { trackId };
  }

  payload.createdAt = admin.firestore.FieldValue.serverTimestamp();
  const docRef = await admin.firestore().collection("tracks").add(payload);
  return { trackId: docRef.id };
};

const normalizeLyricsText = (value = "") =>
  typeof value === "string"
    ? value.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim()
    : "";

const normalizeTimedLyrics = (timedLyrics = []) => {
  if (!Array.isArray(timedLyrics)) return [];
  const normalized = [];
  for (const raw of timedLyrics) {
    const text = normalizeLyricsText(raw?.text || "");
    if (!text) continue;
    const startMs = Math.max(0, Math.round(Number(raw?.startMs || 0)));
    const endCandidate = Math.round(Number(raw?.endMs || startMs + 2500));
    const endMs = Math.max(startMs + 300, endCandidate);
    normalized.push({ text, startMs, endMs });
  }
  return normalized;
};

const toMillisSafe = (value) => {
  if (!value) return 0;
  if (typeof value === "number") return value;
  if (typeof value?.toMillis === "function") return value.toMillis();
  if (typeof value?.seconds === "number") return value.seconds * 1000;
  return 0;
};

const scoreTrack = (track = {}) => {
  const source = String(track.source || "").toLowerCase();
  const sourceScore = source === "apple" ? 30 : source === "youtube" ? 20 : source ? 10 : 0;
  const backingScore = track.backingOnly ? 5 : 0;
  return sourceScore + backingScore;
};

const pickBestTrack = (tracks = []) => {
  if (!Array.isArray(tracks) || !tracks.length) return null;
  return tracks
    .slice()
    .sort((a, b) => {
      const scoreDiff = scoreTrack(b) - scoreTrack(a);
      if (scoreDiff !== 0) return scoreDiff;
      return toMillisSafe(b.updatedAt) - toMillisSafe(a.updatedAt);
    })[0];
};

const ensureSongLyricsAdmin = async ({
  songId,
  title,
  artist,
  lyrics,
  lyricsTimed,
  lyricsSource,
  appleMusicId,
  language = "en",
  verifiedBy = "system",
}) => {
  const safeSongId = String(songId || "").trim();
  if (!safeSongId) return { songId: "", hasLyrics: false, hasTimedLyrics: false };

  const normalizedLyrics = normalizeLyricsText(lyrics || "");
  const normalizedTimed = normalizeTimedLyrics(lyricsTimed);
  if (!normalizedLyrics && !normalizedTimed.length) {
    return { songId: safeSongId, hasLyrics: false, hasTimedLyrics: false };
  }

  const ref = admin.firestore().collection("song_lyrics").doc(safeSongId);
  const snap = await ref.get();
  const payload = {
    songId: safeSongId,
    title: (title || "").trim() || null,
    artist: (artist || "").trim() || null,
    lyrics: normalizedLyrics || "",
    lyricsTimed: normalizedTimed.length ? normalizedTimed : null,
    hasTimedLyrics: normalizedTimed.length > 0,
    lineCount: normalizedTimed.length
      || (normalizedLyrics ? normalizedLyrics.split("\n").filter(Boolean).length : 0),
    lyricsSource: (lyricsSource || (normalizedTimed.length ? "timed" : "text")).trim() || null,
    appleMusicId: appleMusicId ? String(appleMusicId) : null,
    language: (language || "en").trim() || "en",
    verifiedBy: (verifiedBy || "system").trim() || "system",
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  if (!snap.exists) {
    payload.createdAt = admin.firestore.FieldValue.serverTimestamp();
  }

  await ref.set(payload, { merge: true });
  await admin.firestore().collection("songs").doc(safeSongId).set(
    {
      hasLyrics: true,
      hasTimedLyrics: normalizedTimed.length > 0,
      canonicalLyricsSource: payload.lyricsSource || null,
      canonicalLyricsUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  return {
    songId: safeSongId,
    hasLyrics: true,
    hasTimedLyrics: normalizedTimed.length > 0,
  };
};

const isSongVerified = (songDoc) => {
  const meta = songDoc?.verifiedMeta || {};
  return !!(meta.title && meta.artist && meta.artworkUrl);
};

const buildGeminiPrompt = (type, context) => {
  if (type === "bingo_board") {
    const { title, size, mode } = context || {};
    const count = Number(size || 5) ** 2;
    if (mode === "mystery") {
      return `Generate ${count} pairs of (Clue, Song Title, Artist) for a music bingo game with the theme "${title}". Format strictly as JSON array of objects: [{"clue": "...", "title": "...", "artist": "..."}]. Do not include markdown.`;
    }
    return `Generate ${count} short bingo terms (1-3 words) for a bingo game with the theme "${title}". Format strictly as JSON array of strings. Do not include markdown.`;
  }
  if (type === "lyrics") {
    const { title, artist } = context || {};
    return `Generate the full lyrics for the song "${title}" by "${artist}". Format strictly as JSON object with a single key "lyrics" containing the text with \\n for line breaks. Example: {"lyrics": "Line 1\\nLine 2"}. Do not include markdown.`;
  }
  if (type === "selfie_prompt") {
    return 'Generate 5 short, funny selfie prompts for a karaoke crowd. Format strictly as JSON array of strings. Do not include markdown.';
  }
  if (type === "doodle_lyrics") {
    const { topic, count } = context || {};
    const total = clampNumber(count || 12, 5, 30, 12);
    return `Generate ${total} short, recognizable lyric lines for a karaoke drawing game. Keep each line under 8 words. Theme: "${topic || 'karaoke hits'}". Format strictly as JSON array of strings. Do not include markdown.`;
  }
  const songs = Array.isArray(context)
    ? context.slice(0, 5).map((s) => `${s.songTitle} by ${s.artist}`).join(", ")
    : "";
  if (type === "trivia") {
    return `Generate 3 trivia questions based on: ${songs}. Format strictly as JSON array of objects: [{q, correct, w1, w2, w3}]`;
  }
  return `Generate 3 "Would You Rather" questions based on: ${songs}. Format strictly as JSON array: [{q, a, b}]`;
};

exports.itunesSearch = onCall({ cors: true }, async (request) => {
  checkRateLimit(request.rawRequest, "itunes");
  const term = request.data?.term || "";
  ensureString(term, "term");
  const limit = clampNumber(request.data?.limit || 6, 1, 25, 6);
  const url = `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&media=music&entity=song&limit=${limit}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new HttpsError("unavailable", "iTunes search failed.");
  }
  const data = await res.json();
  return { results: data.results || [] };
});

exports.ensureSong = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Sign in required.");
  }
  const data = request.data || {};
  const title = (data.title || "").trim();
  if (!title) {
    throw new HttpsError("invalid-argument", "title is required.");
  }
  const res = await ensureSongAdmin({
    title,
    artist: data.artist || "Unknown",
    artworkUrl: data.artworkUrl || "",
    itunesId: data.itunesId || "",
    appleMusicId: data.appleMusicId || "",
    aliases: Array.isArray(data.aliases) ? data.aliases : [],
    verifyMeta: data.verifyMeta || false,
    verifiedBy: data.verifiedBy || "host",
  });
  return { songId: res?.songId || buildSongKey(title, data.artist || "Unknown") };
});

exports.ensureTrack = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Sign in required.");
  }
  const data = request.data || {};
  if (!data.songId) {
    throw new HttpsError("invalid-argument", "songId is required.");
  }
  const res = await ensureTrackAdmin({
    songId: data.songId,
    source: data.source || "custom",
    mediaUrl: data.mediaUrl || "",
    appleMusicId: data.appleMusicId || "",
    label: data.label || null,
    duration: data.duration ?? null,
    audioOnly: !!data.audioOnly,
    backingOnly: !!data.backingOnly,
    addedBy: data.addedBy || "",
  });
  return { trackId: res?.trackId || null };
});

exports.logPerformance = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Sign in required.");
  }
  const data = request.data || {};
  const songTitle = (data.songTitle || data.title || "").trim();
  if (!songTitle) {
    throw new HttpsError("invalid-argument", "songTitle is required.");
  }
  const artist = (data.artist || "Unknown").trim() || "Unknown";
  const roomCode = data.roomCode || "";
  const albumArtUrl = data.albumArtUrl || "";
  const songResult = await ensureSongAdmin({
    title: songTitle,
    artist,
    artworkUrl: albumArtUrl,
    verifyMeta: false,
    verifiedBy: data.verifiedBy || "host",
  });
  const songId = data.songId || songResult?.songId || buildSongKey(songTitle, artist);
  const sourceGuess = data.trackSource
    || (data.appleMusicId ? "apple" : extractYouTubeId(data.mediaUrl || "") ? "youtube" : "custom");

  let trackId = data.trackId || null;
  if (!trackId && (data.mediaUrl || data.appleMusicId)) {
    const trackResult = await ensureTrackAdmin({
      songId,
      source: sourceGuess,
      mediaUrl: data.mediaUrl || "",
      appleMusicId: data.appleMusicId || "",
      duration: data.duration ?? null,
      audioOnly: !!data.audioOnly,
      backingOnly: !!data.backingAudioOnly,
      addedBy: data.addedBy || data.hostName || "Host",
    });
    trackId = trackResult?.trackId || null;
  }

  const applauseScore = Math.round(data.applauseScore || 0);
  const hypeScore = Math.round(data.hypeScore || 0);
  const hostBonus = Math.round(data.hostBonus || 0);
  const totalScore = hypeScore + applauseScore + hostBonus;
  const weekKey = getWeekKeyUtc(new Date());
  const isOfficial = isSongVerified(songResult?.songData);

  await admin.firestore().collection("performances").add({
    songId,
    trackId: trackId || null,
    roomCode,
    singerName: data.singerName || "",
    singerUid: data.singerUid || null,
    songTitle,
    artist,
    score: totalScore,
    totalScore,
    applauseScore,
    hypeScore,
    hostBonus,
    isOfficial,
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
  });

  const bestRef = admin.firestore().collection("song_hall_of_fame").doc(songId);
  const bestSnap = await bestRef.get();
  const bestData = bestSnap.exists ? bestSnap.data() : null;
  const isNewAllTime = isBetterScore(totalScore, applauseScore, bestData);

  if (isNewAllTime) {
    await bestRef.set({
      songId,
      songTitle,
      artist,
      albumArtUrl,
      bestScore: totalScore,
      applauseScore,
      singerName: data.singerName || "",
      singerUid: data.singerUid || null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
  }

  const weeklyId = `${weekKey}__${songId}`;
  const weeklyRef = admin.firestore().collection("song_hall_of_fame_weeks").doc(weeklyId);
  const weeklySnap = await weeklyRef.get();
  const weeklyData = weeklySnap.exists ? weeklySnap.data() : null;
  if (isBetterScore(totalScore, applauseScore, weeklyData)) {
    await weeklyRef.set({
      weekKey,
      songId,
      songTitle,
      artist,
      albumArtUrl,
      bestScore: totalScore,
      applauseScore,
      singerName: data.singerName || "",
      singerUid: data.singerUid || null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
  }

  return {
    songId,
    trackId,
    totalScore,
    applauseScore,
    hypeScore,
    hostBonus,
    isNewAllTime,
    weekKey,
  };
});

exports.youtubeSearch = onCall({ cors: true, secrets: [YOUTUBE_API_KEY] }, async (request) => {
  checkRateLimit(request.rawRequest, "youtube_search");
  const uid = requireAuth(request);
  const entitlements = await resolveUserEntitlements(uid);
  enforceAppCheckIfEnabled(request, "youtube_search");
  const query = request.data?.query || "";
  ensureString(query, "query");
  const maxResults = clampNumber(request.data?.maxResults || 10, 1, 10, 10);
  const apiKey = YOUTUBE_API_KEY.value();
  if (!apiKey) {
    throw new HttpsError("failed-precondition", "YouTube API key not configured.");
  }
  await reserveOrganizationUsageUnits({
    orgId: entitlements.orgId,
    entitlements,
    meterId: "youtube_data_request",
    units: 1,
  });
  const url = `https://www.googleapis.com/youtube/v3/search?key=${apiKey}&q=${encodeURIComponent(query)}&part=snippet&type=video&maxResults=${maxResults}&order=relevance`;
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text();
    throw new HttpsError("unavailable", `YouTube search failed: ${text}`);
  }
  const data = await res.json();
  const items = (data.items || []).map((item) => ({
    id: item.id?.videoId || item.id,
    title: item.snippet?.title || "",
    channelTitle: item.snippet?.channelTitle || "",
    thumbnails: item.snippet?.thumbnails || {},
  }));
  return { items };
});

exports.youtubePlaylist = onCall({ cors: true, secrets: [YOUTUBE_API_KEY] }, async (request) => {
  checkRateLimit(request.rawRequest, "youtube_playlist");
  const uid = requireAuth(request);
  const entitlements = await resolveUserEntitlements(uid);
  enforceAppCheckIfEnabled(request, "youtube_playlist");
  const playlistId = request.data?.playlistId || "";
  ensureString(playlistId, "playlistId");
  const apiKey = YOUTUBE_API_KEY.value();
  if (!apiKey) {
    throw new HttpsError("failed-precondition", "YouTube API key not configured.");
  }
  const maxTotal = clampNumber(request.data?.maxTotal || 150, 1, 250, 150);
  const items = [];
  let pageToken = "";
  while (items.length < maxTotal) {
    const batchSize = Math.min(50, maxTotal - items.length);
    await reserveOrganizationUsageUnits({
      orgId: entitlements.orgId,
      entitlements,
      meterId: "youtube_data_request",
      units: 1,
    });
    const url = `https://www.googleapis.com/youtube/v3/playlistItems?key=${apiKey}&part=snippet&maxResults=${batchSize}&playlistId=${playlistId}${pageToken ? `&pageToken=${pageToken}` : ""}`;
    const res = await fetch(url);
    if (!res.ok) {
      const text = await res.text();
      throw new HttpsError("unavailable", `Playlist fetch failed: ${text}`);
    }
    const data = await res.json();
    (data.items || []).forEach((item) => {
      items.push({
        id: item.snippet?.resourceId?.videoId || item.id,
        title: item.snippet?.title || "",
        channelTitle: item.snippet?.channelTitle || "",
        thumbnails: item.snippet?.thumbnails || {},
      });
    });
    pageToken = data.nextPageToken;
    if (!pageToken) break;
  }
  return { items };
});

exports.youtubeStatus = onCall({ cors: true, secrets: [YOUTUBE_API_KEY] }, async (request) => {
  checkRateLimit(request.rawRequest, "youtube_status");
  const uid = requireAuth(request);
  const entitlements = await resolveUserEntitlements(uid);
  enforceAppCheckIfEnabled(request, "youtube_status");
  const ids = Array.isArray(request.data?.ids) ? request.data.ids : [];
  if (!ids.length) return { items: [] };
  const apiKey = YOUTUBE_API_KEY.value();
  if (!apiKey) {
    throw new HttpsError("failed-precondition", "YouTube API key not configured.");
  }
  await reserveOrganizationUsageUnits({
    orgId: entitlements.orgId,
    entitlements,
    meterId: "youtube_data_request",
    units: 1,
  });
  const sliced = ids.slice(0, 50);
  const url = `https://www.googleapis.com/youtube/v3/videos?key=${apiKey}&part=status&id=${sliced.join(",")}`;
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text();
    throw new HttpsError("unavailable", `YouTube status failed: ${text}`);
  }
  const data = await res.json();
  const items = (data.items || []).map((item) => ({
    id: item.id,
    embeddable: !!item.status?.embeddable,
  }));
  return { items };
});

const parseIsoDuration = (value = "") => {
  const match = value.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const hours = parseInt(match[1] || "0", 10);
  const minutes = parseInt(match[2] || "0", 10);
  const seconds = parseInt(match[3] || "0", 10);
  return hours * 3600 + minutes * 60 + seconds;
};

exports.youtubeDetails = onCall({ cors: true, secrets: [YOUTUBE_API_KEY] }, async (request) => {
  checkRateLimit(request.rawRequest, "youtube_details");
  const uid = requireAuth(request);
  const entitlements = await resolveUserEntitlements(uid);
  enforceAppCheckIfEnabled(request, "youtube_details");
  const ids = Array.isArray(request.data?.ids) ? request.data.ids : [];
  if (!ids.length) return { items: [] };
  const apiKey = YOUTUBE_API_KEY.value();
  if (!apiKey) {
    throw new HttpsError("failed-precondition", "YouTube API key not configured.");
  }
  await reserveOrganizationUsageUnits({
    orgId: entitlements.orgId,
    entitlements,
    meterId: "youtube_data_request",
    units: 1,
  });
  const sliced = ids.slice(0, 50);
  const url = `https://www.googleapis.com/youtube/v3/videos?key=${apiKey}&part=contentDetails&id=${sliced.join(",")}`;
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text();
    throw new HttpsError("unavailable", `YouTube details failed: ${text}`);
  }
  const data = await res.json();
  const items = (data.items || []).map((item) => ({
    id: item.id,
    durationSec: parseIsoDuration(item.contentDetails?.duration || ""),
  }));
  return { items };
});

exports.geminiGenerate = onCall({ cors: true, secrets: [GEMINI_API_KEY] }, async (request) => {
  checkRateLimit(request.rawRequest, "gemini");
  const { entitlements } = await requireCapability(request, "ai.generate_content");
  enforceAppCheckIfEnabled(request, "gemini");
  await reserveOrganizationUsageUnits({
    orgId: entitlements.orgId,
    entitlements,
    meterId: "ai_generate_content",
    units: 1,
  });
  const type = request.data?.type || "";
  ensureString(type, "type");
  const prompt = buildGeminiPrompt(type, request.data?.context);
  const apiKey = GEMINI_API_KEY.value();
  if (!apiKey) {
    throw new HttpsError("failed-precondition", "Gemini API key not configured.");
  }
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json" }
    })
  });
  if (!res.ok) {
    const text = await res.text();
    throw new HttpsError("unavailable", `Gemini request failed: ${text}`);
  }
  const data = await res.json();
  const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
  const cleanText = rawText.replace(/```json|```/g, "").trim();
  try {
    return { result: JSON.parse(cleanText) };
  } catch (_err) {
    throw new HttpsError("data-loss", "Gemini response parse failed.");
  }
});

const cacheSongLyricsFromQueueDoc = async (data = {}, verifiedBy = "queue") => {
  const rawTitle = (data.songTitle || data.title || "").trim();
  if (!rawTitle) return null;
  const rawArtist = (data.artist || "Unknown").trim() || "Unknown";
  const fallbackSongId = buildSongKey(rawTitle, rawArtist);
  const songId = (data.songId || "").trim() || fallbackSongId;

  const songResult = await ensureSongAdmin({
    title: rawTitle,
    artist: rawArtist,
    artworkUrl: data.albumArtUrl || "",
    appleMusicId: data.appleMusicId || "",
    verifyMeta: {
      lyricsSource: data.lyricsSource || null,
      lyricsTimed: Array.isArray(data.lyricsTimed) && data.lyricsTimed.length > 0,
    },
    verifiedBy,
  });
  const resolvedSongId = songResult?.songId || songId;
  const lyricRes = await ensureSongLyricsAdmin({
    songId: resolvedSongId,
    title: rawTitle,
    artist: rawArtist,
    lyrics: data.lyrics || "",
    lyricsTimed: data.lyricsTimed || null,
    lyricsSource: data.lyricsSource || "queue",
    appleMusicId: data.appleMusicId || "",
    verifiedBy,
  });

  if (data.appleMusicId) {
    const trackResult = await ensureTrackAdmin({
      songId: resolvedSongId,
      source: "apple",
      mediaUrl: "",
      appleMusicId: String(data.appleMusicId),
      duration: data.duration ?? null,
      audioOnly: true,
      backingOnly: true,
      addedBy: verifiedBy,
    });
    if (trackResult?.trackId) {
      await admin.firestore().collection("songs").doc(resolvedSongId).set(
        {
          primaryTrackId: trackResult.trackId,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    }
  }

  return {
    songId: resolvedSongId,
    hasLyrics: !!lyricRes?.hasLyrics,
    hasTimedLyrics: !!lyricRes?.hasTimedLyrics,
  };
};

exports.resolveSongCatalog = onCall({ cors: true }, async (request) => {
  requireAuth(request);
  const data = request.data || {};
  const rawSongId = (data.songId || "").trim();
  const title = (data.title || "").trim();
  const artist = (data.artist || "Unknown").trim() || "Unknown";
  const songId = rawSongId || (title ? buildSongKey(title, artist) : "");
  if (!songId) {
    throw new HttpsError("invalid-argument", "songId or title is required.");
  }

  const songRef = admin.firestore().collection("songs").doc(songId);
  const lyricsRef = admin.firestore().collection("song_lyrics").doc(songId);
  const trackQuery = admin.firestore().collection("tracks").where("songId", "==", songId).limit(20);

  const [songSnap, lyricsSnap, trackSnap] = await Promise.all([
    songRef.get(),
    lyricsRef.get(),
    trackQuery.get(),
  ]);

  const tracks = trackSnap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
  const bestTrack = pickBestTrack(tracks);
  const lyrics = lyricsSnap.exists ? lyricsSnap.data() : null;

  return {
    found: !!(songSnap.exists || lyrics || bestTrack),
    songId,
    song: songSnap.exists ? { id: songSnap.id, ...songSnap.data() } : null,
    track: bestTrack ? {
      id: bestTrack.id,
      source: bestTrack.source || null,
      mediaUrl: bestTrack.mediaUrl || "",
      appleMusicId: bestTrack.appleMusicId || "",
      duration: bestTrack.duration || null,
      backingOnly: !!bestTrack.backingOnly,
      audioOnly: !!bestTrack.audioOnly,
      updatedAt: bestTrack.updatedAt || null,
    } : null,
    lyrics: lyrics ? {
      lyrics: lyrics.lyrics || "",
      timedLyrics: Array.isArray(lyrics.lyricsTimed) ? lyrics.lyricsTimed : null,
      source: lyrics.lyricsSource || null,
      appleMusicId: lyrics.appleMusicId || "",
      hasTimedLyrics: !!lyrics.hasTimedLyrics,
      updatedAt: lyrics.updatedAt || null,
    } : null,
  };
});

exports.upsertSongLyrics = onCall({ cors: true }, async (request) => {
  const uid = requireAuth(request);
  const data = request.data || {};
  const title = (data.title || "").trim();
  const artist = (data.artist || "Unknown").trim() || "Unknown";
  const explicitSongId = (data.songId || "").trim();
  if (!explicitSongId && !title) {
    throw new HttpsError("invalid-argument", "songId or title is required.");
  }

  let songId = explicitSongId;
  if (!songId) {
    const songResult = await ensureSongAdmin({
      title,
      artist,
      artworkUrl: data.artworkUrl || "",
      appleMusicId: data.appleMusicId || "",
      verifyMeta: false,
      verifiedBy: data.verifiedBy || uid,
    });
    songId = songResult?.songId || buildSongKey(title, artist);
  }

  if (title) {
    await ensureSongAdmin({
      title,
      artist,
      artworkUrl: data.artworkUrl || "",
      appleMusicId: data.appleMusicId || "",
      verifyMeta: {
        lyricsSource: data.lyricsSource || null,
        lyricsTimed: Array.isArray(data.lyricsTimed) && data.lyricsTimed.length > 0,
      },
      verifiedBy: data.verifiedBy || uid,
    });
  }

  const lyricResult = await ensureSongLyricsAdmin({
    songId,
    title,
    artist,
    lyrics: data.lyrics || "",
    lyricsTimed: data.lyricsTimed || null,
    lyricsSource: data.lyricsSource || "manual",
    appleMusicId: data.appleMusicId || "",
    language: data.language || "en",
    verifiedBy: data.verifiedBy || uid,
  });

  return {
    songId,
    hasLyrics: !!lyricResult?.hasLyrics,
    hasTimedLyrics: !!lyricResult?.hasTimedLyrics,
  };
});

exports.appleMusicLyrics = onCall(
  { cors: true, secrets: [APPLE_MUSIC_TEAM_ID, APPLE_MUSIC_KEY_ID, APPLE_MUSIC_PRIVATE_KEY] },
  async (request) => {
    checkRateLimit(request.rawRequest, "apple_music");
    const uid = requireAuth(request);
    enforceAppCheckIfEnabled(request, "apple_music_lyrics");
    const title = (request.data?.title || "").trim();
    const artist = (request.data?.artist || "").trim();
    const safeArtist = artist || "Unknown";
    const requestedSongId = (request.data?.songId || "").trim();
    const canonicalSongId = requestedSongId || buildSongKey(title, safeArtist);
    const musicUserToken = (request.data?.musicUserToken || "").trim();
    ensureString(title, "title");
    const storefront = request.data?.storefront || "us";
    const term = `${title} ${safeArtist}`.trim();
    if (!term) throw new HttpsError("invalid-argument", "Missing title/artist.");

    const cachedLyricsSnap = canonicalSongId
      ? await admin.firestore().collection("song_lyrics").doc(canonicalSongId).get()
      : null;
    if (cachedLyricsSnap?.exists) {
      const cached = cachedLyricsSnap.data() || {};
      const cachedTimed = normalizeTimedLyrics(cached.lyricsTimed);
      const cachedText = normalizeLyricsText(cached.lyrics || "");
      if (cachedTimed.length || cachedText) {
        return {
          found: true,
          cached: true,
          songId: cached.appleMusicId || "",
          title: cached.title || title,
          artist: cached.artist || safeArtist,
          timedLyrics: cachedTimed,
          lyrics: cachedText,
        };
      }
    }

    const entitlements = await resolveUserEntitlements(uid);
    const token = getAppleMusicToken();
    const headers = { Authorization: `Bearer ${token}` };
    if (musicUserToken) {
      headers["Music-User-Token"] = musicUserToken;
    }
    await reserveOrganizationUsageUnits({
      orgId: entitlements.orgId,
      entitlements,
      meterId: "apple_music_request",
      units: 1,
    });
    const searchUrl = `https://api.music.apple.com/v1/catalog/${storefront}/search?term=${encodeURIComponent(
      term
    )}&types=songs&limit=1`;
    const searchRes = await fetch(searchUrl, {
      headers,
    });
    if (!searchRes.ok) {
      const text = await searchRes.text();
      throw new HttpsError("unavailable", `Apple Music search failed: ${text}`);
    }
    const searchData = await searchRes.json();
    const song = searchData?.results?.songs?.data?.[0];
    if (!song?.id) {
      return { found: false, message: "No Apple Music match." };
    }
    const appleSongId = song.id;
    const resolvedTitle = song.attributes?.name || title;
    const resolvedArtist = song.attributes?.artistName || safeArtist;

    const songResult = await ensureSongAdmin({
      title: resolvedTitle,
      artist: resolvedArtist,
      appleMusicId: appleSongId,
      verifyMeta: false,
      verifiedBy: "apple_music",
    });
    const resolvedSongId = songResult?.songId || canonicalSongId || buildSongKey(resolvedTitle, resolvedArtist);
    const appleTrack = await ensureTrackAdmin({
      songId: resolvedSongId,
      source: "apple",
      mediaUrl: "",
      appleMusicId: appleSongId,
      label: "Apple Music",
      duration: null,
      audioOnly: true,
      backingOnly: true,
      addedBy: "apple_music",
    });
    if (appleTrack?.trackId) {
      await admin.firestore().collection("songs").doc(resolvedSongId).set(
        {
          primaryTrackId: appleTrack.trackId,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    }

    await reserveOrganizationUsageUnits({
      orgId: entitlements.orgId,
      entitlements,
      meterId: "apple_music_request",
      units: 1,
    });
    const lyricsUrl = `https://api.music.apple.com/v1/catalog/${storefront}/songs/${appleSongId}/lyrics`;
    const lyricsRes = await fetch(lyricsUrl, {
      headers,
    });
    if (!lyricsRes.ok) {
      const text = await lyricsRes.text();
      // Apple returns code 40012 when lyrics permission is missing from the request.
      // This is commonly resolved by providing a Music User Token from MusicKit auth.
      if (lyricsRes.status === 400 && text.includes("\"code\":\"40012\"")) {
        return {
          found: true,
          songId: appleSongId,
          title: resolvedTitle,
          artist: resolvedArtist,
          timedLyrics: [],
          lyrics: "",
          needsUserToken: !musicUserToken,
          message: "Apple Music lyrics require additional permissions in request (code 40012).",
        };
      }
      throw new HttpsError("unavailable", `Apple Music lyrics failed: ${text}`);
    }
    const lyricsData = await lyricsRes.json();
    const attrs = lyricsData?.data?.[0]?.attributes || {};
    const ttml = attrs.ttml || "";
    const plainLyrics = attrs.lyrics || "";
    const timedLyrics = parseTtml(ttml);

    const lyricResult = await ensureSongLyricsAdmin({
      songId: resolvedSongId,
      title: resolvedTitle,
      artist: resolvedArtist,
      lyrics: plainLyrics,
      lyricsTimed: timedLyrics,
      lyricsSource: (timedLyrics.length || plainLyrics) ? "apple" : "",
      appleMusicId: appleSongId,
      language: attrs.language || "en",
      verifiedBy: "apple_music",
    });
    if (lyricResult?.hasLyrics) {
      await admin.firestore().collection("songs").doc(resolvedSongId).set(
        {
          primaryLyricsId: resolvedSongId,
          canonicalLyricsUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    }

    return {
      found: true,
      songId: appleSongId,
      title: resolvedTitle,
      artist: resolvedArtist,
      timedLyrics,
      lyrics: plainLyrics,
    };
  }
);

exports.autoAppleLyrics = onDocumentCreated(
  {
    document: `artifacts/${APP_ID}/public/data/karaoke_songs/{songId}`,
    secrets: [APPLE_MUSIC_TEAM_ID, APPLE_MUSIC_KEY_ID, APPLE_MUSIC_PRIVATE_KEY],
  },
  async (event) => {
    const data = event.data?.data();
    if (!data) return;
    if (data.lyricsTimed?.length || data.lyrics) {
      try {
        await cacheSongLyricsFromQueueDoc(data, "auto_queue_seed");
      } catch (err) {
        console.warn("autoAppleLyrics queue seed cache failed", err?.message || err);
      }
      return;
    }
    if (data.lyricsSource) return;
    const rawTitle = data.songTitle || data.title || "";
    const rawArtist = data.artist || "";
    const cleanedTitle = rawTitle.replace(/\bkaraoke\b/gi, "").replace(/\s+/g, " ").trim();
    const cleanedArtist = rawArtist.replace(/\bkaraoke\b/gi, "").replace(/\s+/g, " ").trim();
    const term = `${cleanedTitle} ${cleanedArtist}`.trim();
    if (!cleanedTitle) return;

    try {
      const storefront = data.storefront || "us";
      const token = getAppleMusicToken();
      const searchApple = async (q) => {
        const url = `https://api.music.apple.com/v1/catalog/${storefront}/search?term=${encodeURIComponent(
          q
        )}&types=songs&limit=1`;
        const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) {
          const text = await res.text();
          console.warn(`Apple search failed (${res.status})`, text?.slice(0, 300));
          return null;
        }
        const data = await res.json();
        return data?.results?.songs?.data?.[0] || null;
      };
      let song = await searchApple(term);
      if (!song && cleanedTitle) {
        song = await searchApple(cleanedTitle);
      }
      if (!song?.id) return;
      const songId = song.id;
      const lyricsUrl = `https://api.music.apple.com/v1/catalog/${storefront}/songs/${songId}/lyrics`;
      const lyricsRes = await fetch(lyricsUrl, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!lyricsRes.ok) {
        const text = await lyricsRes.text();
        if (lyricsRes.status === 400 && text.includes("\"code\":\"40012\"")) {
          // Server-side trigger does not have a Music User Token, so silently skip.
          return;
        }
        console.warn(`Apple lyrics failed (${lyricsRes.status})`, text?.slice(0, 300));
        return;
      }
      const lyricsData = await lyricsRes.json();
      const attrs = lyricsData?.data?.[0]?.attributes || {};
      const ttml = attrs.ttml || "";
      const plainLyrics = attrs.lyrics || "";
      const timedLyrics = parseTtml(ttml);
      await event.data.ref.set(
        {
          lyrics: plainLyrics || "",
          lyricsTimed: timedLyrics || null,
          appleMusicId: songId,
          lyricsSource: timedLyrics?.length ? "apple" : plainLyrics ? "apple" : "",
        },
        { merge: true }
      );
      await cacheSongLyricsFromQueueDoc({
        ...data,
        songTitle: data.songTitle || cleanedTitle,
        artist: data.artist || cleanedArtist || "Unknown",
        lyrics: plainLyrics || "",
        lyricsTimed: timedLyrics || null,
        appleMusicId: songId,
        lyricsSource: timedLyrics?.length ? "apple" : plainLyrics ? "apple" : "",
      }, "auto_apple");
    } catch (err) {
      console.error("autoAppleLyrics failed", err?.message || err);
    }
  }
);

const resolveOrigin = (req, originFromClient) => {
  const origin = originFromClient || req.get("origin") || "";
  const isAllowed =
    origin.includes("beauross.com") ||
    origin.includes("localhost") ||
    origin.includes("127.0.0.1");
  return isAllowed && origin.startsWith("http") ? origin : "https://beauross.com";
};

const isAllowedOrigin = (origin = "") =>
  origin.includes("beauross.com") ||
  origin.includes("localhost") ||
  origin.includes("127.0.0.1");

exports.googleMapsKey = onCall({ cors: true, secrets: [GOOGLE_MAPS_API_KEY] }, async (request) => {
  checkRateLimit(request.rawRequest, "google_maps_key");
  requireAuth(request);
  enforceAppCheckIfEnabled(request, "google_maps_key");
  const origin = request.rawRequest?.get?.("origin") || "";
  if (origin && !isAllowedOrigin(origin)) {
    throw new HttpsError("permission-denied", "Origin not allowed.");
  }
  const apiKey = GOOGLE_MAPS_API_KEY.value();
  if (!apiKey) {
    throw new HttpsError("failed-precondition", "Google Maps API key not configured.");
  }
  return { apiKey };
});

exports.submitMarketingWaitlist = onCall({ cors: true }, async (request) => {
  checkRateLimit(request.rawRequest, "submit_marketing_waitlist", { perMinute: 12, perHour: 80 });
  enforceAppCheckIfEnabled(request, "submit_marketing_waitlist");

  const name = sanitizeWaitlistName(request.data?.name || "");
  const email = sanitizeWaitlistEmail(request.data?.email || "");
  const useCase = sanitizeWaitlistUseCase(request.data?.useCase || "");
  const source = sanitizeWaitlistSource(request.data?.source || "");
  const now = admin.firestore.FieldValue.serverTimestamp();
  const uid = request.auth?.uid || null;
  const userAgent = String(request.rawRequest?.get?.("user-agent") || "").slice(0, 320);
  const ip = getClientIp(request.rawRequest);

  const db = admin.firestore();
  const waitlistRef = db.collection("marketing_waitlist").doc(buildWaitlistDocId(email));
  const metaRef = db.collection("marketing_meta").doc("waitlist");
  let linePosition = 0;
  let isNewSignup = false;

  await db.runTransaction(async (tx) => {
    const [signupSnap, metaSnap] = await Promise.all([tx.get(waitlistRef), tx.get(metaRef)]);
    const currentTotal = Number(metaSnap.data()?.totalSignups || 0);

    if (!signupSnap.exists) {
      linePosition = currentTotal + 1;
      isNewSignup = true;
      tx.set(waitlistRef, {
        name,
        email,
        useCase,
        source,
        status: "active",
        linePosition,
        createdAt: now,
        updatedAt: now,
        firstUid: uid,
        lastUid: uid,
        firstIp: ip,
        lastIp: ip,
        userAgent,
        duplicateSubmitCount: 0,
      }, { merge: true });
      tx.set(metaRef, {
        totalSignups: linePosition,
        updatedAt: now,
      }, { merge: true });
      return;
    }

    const existing = signupSnap.data() || {};
    linePosition = Number(existing.linePosition || currentTotal || 1);
    tx.set(waitlistRef, {
      name,
      useCase,
      source,
      updatedAt: now,
      lastUid: uid,
      lastIp: ip,
      userAgent,
      duplicateSubmitCount: admin.firestore.FieldValue.increment(1),
      lastSubmittedAt: now,
    }, { merge: true });
  });

  return {
    ok: true,
    linePosition,
    isNewSignup,
    message: isNewSignup
      ? `You are in line. Early access position: #${linePosition}.`
      : `You are already on the list. Current position: #${linePosition}.`,
  };
});

exports.ensureOrganization = onCall({ cors: true }, async (request) => {
  checkRateLimit(request.rawRequest, "ensure_organization", { perMinute: 20, perHour: 200 });
  const uid = requireAuth(request);
  enforceAppCheckIfEnabled(request, "ensure_organization");
  const orgName = typeof request.data?.orgName === "string" ? request.data.orgName : "";
  const ensured = await ensureOrganizationForUser({ uid, orgName });
  const entitlements = await resolveUserEntitlements(uid);
  return {
    orgId: ensured.orgId,
    role: ensured.role,
    planId: entitlements.planId,
    status: entitlements.status,
    provider: entitlements.provider,
    renewalAtMs: entitlements.renewalAtMs,
    cancelAtPeriodEnd: entitlements.cancelAtPeriodEnd,
    capabilities: entitlements.capabilities,
  };
});

exports.bootstrapOnboardingWorkspace = onCall({ cors: true }, async (request) => {
  checkRateLimit(request.rawRequest, "bootstrap_onboarding_workspace", { perMinute: 20, perHour: 200 });
  const { uid } = await requireCapability(request, "workspace.onboarding");
  enforceAppCheckIfEnabled(request, "bootstrap_onboarding_workspace");
  const orgName = typeof request.data?.orgName === "string" ? request.data.orgName : "";
  const hostName = normalizeOptionalName(request.data?.hostName, "Host");
  const logoUrl = typeof request.data?.logoUrl === "string"
    ? request.data.logoUrl.trim().slice(0, 2048)
    : "";
  const planPreference = getPlanDefinition(request.data?.planId || "")
    ? request.data.planId
    : null;
  const ensured = await ensureOrganizationForUser({ uid, orgName });
  const orgRef = orgsCollection().doc(ensured.orgId);
  const now = admin.firestore.FieldValue.serverTimestamp();
  await orgRef.set({
    name: normalizeOrgName(orgName, uid),
    onboardingDefaults: {
      hostName,
      logoUrl: logoUrl || null,
      planPreference,
    },
    onboarding: {
      initializedAt: now,
      initializedBy: uid,
      updatedAt: now,
      updatedBy: uid,
    },
    updatedAt: now,
  }, { merge: true });
  const entitlements = await resolveUserEntitlements(uid);
  return {
    ok: true,
    orgId: ensured.orgId,
    role: ensured.role,
    entitlements,
  };
});

exports.getMyEntitlements = onCall({ cors: true }, async (request) => {
  checkRateLimit(request.rawRequest, "get_my_entitlements", { perMinute: 30, perHour: 300 });
  const uid = requireAuth(request);
  enforceAppCheckIfEnabled(request, "get_my_entitlements");
  const entitlements = await resolveUserEntitlements(uid);
  return entitlements;
});

exports.getMyUsageSummary = onCall({ cors: true }, async (request) => {
  checkRateLimit(request.rawRequest, "get_my_usage_summary", { perMinute: 30, perHour: 300 });
  const uid = requireAuth(request);
  enforceAppCheckIfEnabled(request, "get_my_usage_summary");
  const requestedPeriod = normalizeUsagePeriodKey(request.data?.period || "");
  if (!requestedPeriod) {
    throw new HttpsError("invalid-argument", "period must be in YYYYMM format.");
  }
  const entitlements = await resolveUserEntitlements(uid);
  const summary = await readOrganizationUsageSummary({
    orgId: entitlements.orgId,
    entitlements,
    periodKey: requestedPeriod,
  });
  return summary;
});

exports.getMyUsageInvoiceDraft = onCall({ cors: true }, async (request) => {
  checkRateLimit(request.rawRequest, "get_my_usage_invoice_draft", { perMinute: 20, perHour: 180 });
  const { entitlements } = await requireCapability(request, "billing.invoice_drafts");
  enforceAppCheckIfEnabled(request, "get_my_usage_invoice_draft");
  const requestedPeriod = normalizeUsagePeriodKey(request.data?.period || "");
  if (!requestedPeriod) {
    throw new HttpsError("invalid-argument", "period must be in YYYYMM format.");
  }
  const includeBasePlan = !!request.data?.includeBasePlan;
  const taxRatePercent = clampNumber(request.data?.taxRatePercent ?? 0, 0, 100, 0);
  const customerName = typeof request.data?.customerName === "string"
    ? request.data.customerName.trim().slice(0, 160)
    : "";
  const role = String(entitlements?.role || "").toLowerCase();
  if (!["owner", "admin"].includes(role)) {
    throw new HttpsError("permission-denied", "Only organization owners/admins can generate invoice drafts.");
  }
  const orgId = entitlements?.orgId || "";
  if (!orgId) {
    throw new HttpsError("failed-precondition", "Organization is not initialized.");
  }
  const orgSnap = await orgsCollection().doc(orgId).get();
  const orgName = String(orgSnap.data()?.name || "").trim() || orgId;
  const usageSummary = await readOrganizationUsageSummary({
    orgId,
    entitlements,
    periodKey: requestedPeriod,
  });
  const invoice = buildUsageInvoiceDraft({
    orgId,
    orgName,
    entitlements,
    usageSummary,
    periodKey: requestedPeriod,
    includeBasePlan,
    taxRatePercent,
    customerName,
  });
  return invoice;
});

exports.saveMyUsageInvoiceDraft = onCall({ cors: true }, async (request) => {
  checkRateLimit(request.rawRequest, "save_my_usage_invoice_draft", { perMinute: 20, perHour: 180 });
  const { uid, entitlements } = await requireCapability(request, "billing.invoice_drafts");
  enforceAppCheckIfEnabled(request, "save_my_usage_invoice_draft");
  const requestedPeriod = normalizeUsagePeriodKey(request.data?.period || "");
  if (!requestedPeriod) {
    throw new HttpsError("invalid-argument", "period must be in YYYYMM format.");
  }
  const includeBasePlan = !!request.data?.includeBasePlan;
  const taxRatePercent = clampNumber(request.data?.taxRatePercent ?? 0, 0, 100, 0);
  const customerName = typeof request.data?.customerName === "string"
    ? request.data.customerName.trim().slice(0, 160)
    : "";
  const status = sanitizeInvoiceStatus(request.data?.status || "draft");
  const notes = typeof request.data?.notes === "string"
    ? request.data.notes.trim().slice(0, 5000)
    : "";

  const role = String(entitlements?.role || "").toLowerCase();
  if (!["owner", "admin"].includes(role)) {
    throw new HttpsError("permission-denied", "Only organization owners/admins can save invoice drafts.");
  }
  const orgId = entitlements?.orgId || "";
  if (!orgId) {
    throw new HttpsError("failed-precondition", "Organization is not initialized.");
  }
  const orgRef = orgsCollection().doc(orgId);
  const orgSnap = await orgRef.get();
  const orgName = String(orgSnap.data()?.name || "").trim() || orgId;
  const usageSummary = await readOrganizationUsageSummary({
    orgId,
    entitlements,
    periodKey: requestedPeriod,
  });
  const invoiceDraft = buildUsageInvoiceDraft({
    orgId,
    orgName,
    entitlements,
    usageSummary,
    periodKey: requestedPeriod,
    includeBasePlan,
    taxRatePercent,
    customerName,
  });

  const invoicesRef = orgRef.collection("invoices");
  const docRef = invoicesRef.doc();
  const now = admin.firestore.FieldValue.serverTimestamp();
  await docRef.set({
    orgId,
    orgName,
    period: invoiceDraft.period,
    invoiceId: invoiceDraft.invoiceId,
    status,
    notes,
    createdBy: uid,
    updatedBy: uid,
    customerName: invoiceDraft.customerName || "",
    includeBasePlan: !!includeBasePlan,
    taxRatePercent: Number(taxRatePercent || 0),
    lineItemCount: Array.isArray(invoiceDraft.lineItems) ? invoiceDraft.lineItems.length : 0,
    totals: invoiceDraft.totals || { subtotalCents: 0, taxCents: 0, totalCents: 0 },
    rateCardSnapshot: invoiceDraft.rateCardSnapshot || null,
    invoiceDraft,
    createdAt: now,
    updatedAt: now,
  }, { merge: true });

  return {
    ok: true,
    recordId: docRef.id,
    invoiceId: invoiceDraft.invoiceId,
    status,
    invoiceDraft,
  };
});

exports.listMyUsageInvoices = onCall({ cors: true }, async (request) => {
  checkRateLimit(request.rawRequest, "list_my_usage_invoices", { perMinute: 30, perHour: 240 });
  const { entitlements } = await requireCapability(request, "billing.invoice_drafts");
  enforceAppCheckIfEnabled(request, "list_my_usage_invoices");
  const role = String(entitlements?.role || "").toLowerCase();
  if (!["owner", "admin"].includes(role)) {
    throw new HttpsError("permission-denied", "Only organization owners/admins can view invoice history.");
  }
  const orgId = entitlements?.orgId || "";
  if (!orgId) {
    throw new HttpsError("failed-precondition", "Organization is not initialized.");
  }
  const maxItems = clampNumber(request.data?.limit ?? 25, 1, 100, 25);
  const statusFilter = sanitizeInvoiceStatus(request.data?.status || "");
  let invoiceQuery = orgsCollection()
    .doc(orgId)
    .collection("invoices")
    .orderBy("createdAt", "desc")
    .limit(maxItems);
  if (request.data?.status) {
    invoiceQuery = invoiceQuery.where("status", "==", statusFilter);
  }
  const snap = await invoiceQuery.get();
  const invoices = snap.docs.map((docSnap) => {
    const data = docSnap.data() || {};
    return {
      recordId: docSnap.id,
      orgId: data.orgId || orgId,
      orgName: data.orgName || "",
      period: data.period || "",
      invoiceId: data.invoiceId || "",
      status: data.status || "draft",
      notes: data.notes || "",
      customerName: data.customerName || "",
      includeBasePlan: !!data.includeBasePlan,
      taxRatePercent: Number(data.taxRatePercent || 0),
      lineItemCount: Number(data.lineItemCount || 0),
      totals: data.totals || { subtotalCents: 0, taxCents: 0, totalCents: 0 },
      createdBy: data.createdBy || "",
      updatedBy: data.updatedBy || "",
      createdAtMs: valueToMillis(data.createdAt),
      updatedAtMs: valueToMillis(data.updatedAt),
    };
  });
  return {
    orgId,
    count: invoices.length,
    invoices,
  };
});

exports.awardRoomPoints = onCall({ cors: true }, async (request) => {
  checkRateLimit(request.rawRequest, "award_room_points", { perMinute: 20, perHour: 240 });
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Sign in required.");
  }

  const roomCode = String(request.data?.roomCode || "").trim().toUpperCase();
  ensureString(roomCode, "roomCode");

  const rawAwards = Array.isArray(request.data?.awards) ? request.data.awards : [];
  if (!rawAwards.length) {
    throw new HttpsError("invalid-argument", "awards must be a non-empty array.");
  }
  if (rawAwards.length > 25) {
    throw new HttpsError("invalid-argument", "Too many awards in one request.");
  }

  const normalizedAwards = normalizePointAwards(rawAwards);
  if (!normalizedAwards.length) {
    throw new HttpsError("invalid-argument", "No valid awards to apply.");
  }

  let totalRequested = 0;
  normalizedAwards.forEach((entry) => {
    totalRequested += entry.points;
  });
  if (totalRequested > 50000) {
    throw new HttpsError("invalid-argument", "Requested points exceed batch limit.");
  }
  const awardKey = normalizeAwardKeyToken(request.data?.awardKey || "");
  const source = typeof request.data?.source === "string" && request.data.source.trim()
    ? request.data.source.trim().slice(0, 80)
    : "manual_host_award";

  const db = admin.firestore();
  const rootRef = getRootRef();
  const callerUid = request.auth.uid;

  if (awardKey) {
    await db.runTransaction(async (tx) => {
      await ensureRoomHostAccess({
        tx,
        rootRef,
        roomCode,
        callerUid,
        deniedMessage: "Only room hosts can award points.",
      });
    });
    const onceResult = await applyRoomAwardsOnce({
      roomCode,
      awardKey,
      awards: normalizedAwards,
      source,
    });
    return {
      ok: true,
      awardedCount: onceResult.awardedCount || 0,
      awardedPoints: onceResult.awardedPoints || 0,
      skipped: Array.isArray(onceResult.skippedUids) ? onceResult.skippedUids : [],
      duplicate: !!onceResult.duplicate,
      applied: !!onceResult.applied,
    };
  }

  const result = await db.runTransaction(async (tx) => {
    const { roomCode: safeRoomCode } = await ensureRoomHostAccess({
      tx,
      rootRef,
      roomCode,
      callerUid,
      deniedMessage: "Only room hosts can award points.",
    });

    const userAwards = normalizedAwards.map(({ uid, points }) => ({
      uid,
      points,
      ref: rootRef.collection("room_users").doc(`${safeRoomCode}_${uid}`),
    }));

    const snaps = await Promise.all(userAwards.map((entry) => tx.get(entry.ref)));
    const awarded = [];
    const skipped = [];
    userAwards.forEach((entry, idx) => {
      if (!snaps[idx].exists) {
        skipped.push(entry.uid);
        return;
      }
      awarded.push(entry);
      tx.update(entry.ref, {
        points: admin.firestore.FieldValue.increment(entry.points),
        lastActiveAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });

    let awardedPoints = 0;
    awarded.forEach((entry) => {
      awardedPoints += entry.points;
    });
    return {
      awardedCount: awarded.length,
      awardedPoints,
      skipped,
    };
  });

  return {
    ok: true,
    ...result,
  };
});

exports.setSelfieSubmissionApproval = onCall({ cors: true }, async (request) => {
  checkRateLimit(request.rawRequest, "selfie_approval", { perMinute: 40, perHour: 400 });
  const callerUid = request.auth?.uid || "";
  if (!callerUid) {
    throw new HttpsError("unauthenticated", "Sign in required.");
  }

  const roomCode = String(request.data?.roomCode || "").trim().toUpperCase();
  ensureString(roomCode, "roomCode");
  const submissionId = String(request.data?.submissionId || "").trim();
  ensureString(submissionId, "submissionId");
  const approved = !!request.data?.approved;

  const db = admin.firestore();
  const rootRef = getRootRef();
  const submissionRef = rootRef.collection("selfie_submissions").doc(submissionId);

  await db.runTransaction(async (tx) => {
    const { roomCode: safeRoomCode } = await ensureRoomHostAccess({
      tx,
      rootRef,
      roomCode,
      callerUid,
      deniedMessage: "Only room hosts can moderate selfies.",
    });
    const submissionSnap = await tx.get(submissionRef);
    if (!submissionSnap.exists) {
      throw new HttpsError("not-found", "Selfie submission not found.");
    }
    const submission = submissionSnap.data() || {};
    const submissionRoomCode = normalizeRoomCode(submission.roomCode || "");
    if (submissionRoomCode !== safeRoomCode) {
      throw new HttpsError("permission-denied", "Submission does not belong to this room.");
    }
    tx.update(submissionRef, {
      approved,
      moderatedAt: admin.firestore.FieldValue.serverTimestamp(),
      moderatedBy: callerUid,
    });
  });

  return { ok: true, approved };
});

exports.deleteRoomReaction = onCall({ cors: true }, async (request) => {
  checkRateLimit(request.rawRequest, "delete_room_reaction", { perMinute: 40, perHour: 400 });
  const callerUid = request.auth?.uid || "";
  if (!callerUid) {
    throw new HttpsError("unauthenticated", "Sign in required.");
  }

  const roomCode = String(request.data?.roomCode || "").trim().toUpperCase();
  ensureString(roomCode, "roomCode");
  const reactionId = String(request.data?.reactionId || "").trim();
  ensureString(reactionId, "reactionId");

  const db = admin.firestore();
  const rootRef = getRootRef();
  const reactionRef = rootRef.collection("reactions").doc(reactionId);

  await db.runTransaction(async (tx) => {
    const { roomCode: safeRoomCode } = await ensureRoomHostAccess({
      tx,
      rootRef,
      roomCode,
      callerUid,
      deniedMessage: "Only room hosts can remove reactions.",
    });
    const reactionSnap = await tx.get(reactionRef);
    if (!reactionSnap.exists) {
      throw new HttpsError("not-found", "Reaction not found.");
    }
    const reaction = reactionSnap.data() || {};
    const reactionRoomCode = normalizeRoomCode(reaction.roomCode || "");
    if (reactionRoomCode !== safeRoomCode) {
      throw new HttpsError("permission-denied", "Reaction does not belong to this room.");
    }
    tx.delete(reactionRef);
  });

  return { ok: true };
});

exports.createSubscriptionCheckout = onCall(
  { cors: true, secrets: [STRIPE_SECRET_KEY] },
  async (request) => {
    checkRateLimit(request.rawRequest, "stripe_checkout");
    const callerUid = requireAuth(request);
    enforceAppCheckIfEnabled(request, "create_subscription_checkout");
    const planId = String(request.data?.planId || "").trim();
    const plan = getPlanDefinition(planId);
    if (!plan || !isPaidPlan(planId)) {
      throw new HttpsError("invalid-argument", "Invalid subscription plan.");
    }

    const orgName = typeof request.data?.orgName === "string" ? request.data.orgName : "";
    const { orgId } = await ensureOrganizationForUser({ uid: callerUid, orgName });
    const origin = resolveOrigin(request.rawRequest, request.data?.origin);
    const stripe = getStripeClient();
    const ownerEmail = typeof request.auth?.token?.email === "string"
      ? request.auth.token.email.trim()
      : "";

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      allow_promotion_codes: true,
      customer_email: ownerEmail || undefined,
      line_items: [
        {
          price_data: {
            currency: "usd",
            unit_amount: plan.amountCents,
            recurring: { interval: plan.interval },
            product_data: {
              name: `BROSS ${plan.name}`,
              description: `Organization subscription (${plan.id})`,
            },
          },
          quantity: 1,
        },
      ],
      metadata: {
        checkoutType: "org_subscription",
        orgId,
        ownerUid: callerUid,
        planId: plan.id,
      },
      subscription_data: {
        metadata: {
          orgId,
          ownerUid: callerUid,
          planId: plan.id,
        },
      },
      success_url: `${origin}/?mode=host&subscription=success&org=${encodeURIComponent(orgId)}`,
      cancel_url: `${origin}/?mode=host&subscription=cancel&org=${encodeURIComponent(orgId)}`,
    });

    return {
      url: session.url,
      id: session.id,
      orgId,
      planId: plan.id,
    };
  }
);

exports.createSubscriptionPortalSession = onCall(
  { cors: true, secrets: [STRIPE_SECRET_KEY] },
  async (request) => {
    checkRateLimit(request.rawRequest, "stripe_checkout");
    const callerUid = requireAuth(request);
    enforceAppCheckIfEnabled(request, "create_subscription_portal");
    const { orgId, role } = await ensureOrganizationForUser({ uid: callerUid });
    if (!orgId) {
      throw new HttpsError("failed-precondition", "Organization is not initialized.");
    }
    if (!["owner", "admin"].includes(role)) {
      throw new HttpsError("permission-denied", "Only organization owners/admins can manage billing.");
    }
    const subSnap = await orgsCollection()
      .doc(orgId)
      .collection("subscription")
      .doc("current")
      .get();
    const sub = subSnap.data() || {};
    const stripeCustomerId = String(sub.stripeCustomerId || "").trim();
    if (!stripeCustomerId) {
      throw new HttpsError(
        "failed-precondition",
        "No Stripe billing profile found. Start a subscription first."
      );
    }
    const origin = resolveOrigin(request.rawRequest, request.data?.origin);
    const stripe = getStripeClient();
    const session = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: `${origin}/?mode=host&billing=return`,
    });

    return { url: session.url };
  }
);

exports.createTipCrateCheckout = onCall(
  { cors: true, secrets: [STRIPE_SECRET_KEY] },
  async (request) => {
    checkRateLimit(request.rawRequest, "stripe_checkout");
    const callerUid = requireAuth(request);
    enforceAppCheckIfEnabled(request, "create_tip_crate_checkout");
    const roomCode = normalizeRoomCode(request.data?.roomCode || "");
    const crateId = request.data?.crateId || "";
    ensureString(roomCode, "roomCode");
    ensureString(crateId, "crateId");

    const roomSnap = await getRootRef().collection("rooms").doc(roomCode).get();
    if (!roomSnap.exists) {
      throw new HttpsError("not-found", "Room not found.");
    }
    const crates = Array.isArray(roomSnap.data()?.tipCrates)
      ? roomSnap.data().tipCrates
      : [];
    const crate = crates.find((c) => c.id === crateId);
    if (!crate) {
      throw new HttpsError("invalid-argument", "Tip crate not found.");
    }
    const amount = clampNumber(crate.amount || 0, 1, 500, 0);
    if (!amount) {
      throw new HttpsError("invalid-argument", "Invalid tip amount.");
    }
    const points = clampNumber(crate.points || 0, 0, 100000, 0);
    const origin = resolveOrigin(request.rawRequest, request.data?.origin);
    const buyerUid = callerUid;
    const buyerName = normalizeOptionalName(request.data?.userName || "", "Guest");
    const stripe = getStripeClient();

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `BROSS Room Tip: ${crate.label || "Room Boost"}`,
            },
            unit_amount: Math.round(amount * 100),
          },
          quantity: 1,
        },
      ],
      metadata: {
        roomCode,
        crateId,
        points: `${points}`,
        rewardScope: crate.rewardScope || "room",
        awardBadge: crate.awardBadge ? "1" : "0",
        buyerUid,
        buyerName,
        label: crate.label || "Room Boost",
      },
      success_url: `${origin}/?room=${encodeURIComponent(roomCode)}&tip=success`,
      cancel_url: `${origin}/?room=${encodeURIComponent(roomCode)}&tip=cancel`,
    });

    return { url: session.url, id: session.id };
  }
);

exports.createPointsCheckout = onCall(
  { cors: true, secrets: [STRIPE_SECRET_KEY] },
  async (request) => {
    checkRateLimit(request.rawRequest, "stripe_checkout");
    const callerUid = requireAuth(request);
    enforceAppCheckIfEnabled(request, "create_points_checkout");
    const roomCode = normalizeRoomCode(request.data?.roomCode || "");
    const amount = clampNumber(request.data?.amount || 0, 1, 500, 0);
    const points = clampNumber(request.data?.points || 0, 0, 100000, 0);
    const label = normalizeOptionalName(request.data?.label || "", "Points Pack");
    const packId = request.data?.packId || "points_pack";
    const buyerName = normalizeOptionalName(request.data?.userName || "", "Guest");
    ensureString(roomCode, "roomCode");
    if (!amount || !points) {
      throw new HttpsError("invalid-argument", "Invalid points pack.");
    }

    const roomSnap = await getRootRef().collection("rooms").doc(roomCode).get();
    if (!roomSnap.exists) {
      throw new HttpsError("not-found", "Room not found.");
    }

    const origin = resolveOrigin(request.rawRequest, request.data?.origin);
    const stripe = getStripeClient();
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `BROSS Points: ${label}`,
            },
            unit_amount: Math.round(amount * 100),
          },
          quantity: 1,
        },
      ],
      metadata: {
        roomCode,
        points: `${points}`,
        packId,
        label,
        buyerUid: callerUid,
        buyerName,
      },
      success_url: `${origin}/?room=${encodeURIComponent(roomCode)}&points=success`,
      cancel_url: `${origin}/?room=${encodeURIComponent(roomCode)}&points=cancel`,
    });

    return { url: session.url, id: session.id };
  }
);

exports.createAppleMusicToken = onCall(
  { cors: true, secrets: [APPLE_MUSIC_TEAM_ID, APPLE_MUSIC_KEY_ID, APPLE_MUSIC_PRIVATE_KEY] },
  async (request) => {
    checkRateLimit(request.rawRequest, "apple_music_token", { perMinute: 10, perHour: 80 });
    const callerUid = requireAuth(request);
    enforceAppCheckIfEnabled(request, "create_apple_music_token");
    const roomCode = normalizeRoomCode(request.data?.roomCode || "");
    ensureString(roomCode, "roomCode");
    await ensureRoomHostAccess({
      roomCode,
      callerUid,
      deniedMessage: "Only room hosts can request Apple Music tokens.",
    });

    const teamId = APPLE_MUSIC_TEAM_ID.value();
    const keyId = APPLE_MUSIC_KEY_ID.value();
    const rawKey = APPLE_MUSIC_PRIVATE_KEY.value();
    const privateKey = rawKey.includes("BEGIN") ? rawKey : rawKey.replace(/\\n/g, "\n");
    const now = Math.floor(Date.now() / 1000);
    const exp = now + 60 * 60 * 12;
    const token = jwt.sign(
      { iss: teamId, iat: now, exp },
      privateKey,
      { algorithm: "ES256", header: { alg: "ES256", kid: keyId } }
    );
    return { token, expiresAt: exp };
  }
);

exports.stripeWebhook = onRequest(
  { secrets: [STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET] },
  async (req, res) => {
    const stripe = getStripeClient();
    const sig = req.headers["stripe-signature"];
    const webhookSecret = STRIPE_WEBHOOK_SECRET.value();
    let event;

    try {
      event = stripe.webhooks.constructEvent(req.rawBody, sig, webhookSecret);
    } catch (err) {
      console.error("Stripe webhook signature failed.", err?.message || err);
      res.status(400).send("Webhook Error");
      return;
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object || {};
      const metadata = session.metadata || {};
      const isSubscriptionCheckout =
        session.mode === "subscription"
        || metadata.checkoutType === "org_subscription"
        || !!metadata.orgId;

      if (isSubscriptionCheckout) {
        const stripeSubscriptionId = typeof session.subscription === "string"
          ? session.subscription
          : "";
        const stripeCustomerId = typeof session.customer === "string"
          ? session.customer
          : "";
        const orgId = String(metadata.orgId || "").trim();
        let ownerUid = String(metadata.ownerUid || "").trim();
        let planId = String(metadata.planId || "").trim();
        let subscription = null;

        if (stripeSubscriptionId) {
          try {
            subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
          } catch (err) {
            console.warn("Failed to retrieve Stripe subscription after checkout.", err?.message || err);
          }
        }

        if (!ownerUid && subscription?.metadata?.ownerUid) {
          ownerUid = String(subscription.metadata.ownerUid || "").trim();
        }
        planId = resolvePlanIdFromStripeSubscription({
          explicitPlanId: planId,
          subscription,
        });
        const status = String(
          subscription?.status
            || (session.payment_status === "paid" ? "active" : "incomplete")
        ).toLowerCase();
        const currentPeriodEndSec = Number(subscription?.current_period_end || 0);
        const cancelAtPeriodEnd = !!subscription?.cancel_at_period_end;

        if (orgId) {
          await applyOrganizationSubscriptionState({
            orgId,
            ownerUid,
            planId,
            status,
            provider: "stripe",
            stripeCustomerId,
            stripeSubscriptionId,
            currentPeriodEndSec,
            cancelAtPeriodEnd,
            source: "stripe_checkout_completed",
          });
        }

        res.json({
          received: true,
          subscriptionCheckout: true,
          orgId: orgId || null,
        });
        return;
      }

      const roomCode = metadata.roomCode;
      const points = Number(metadata.points || 0);
      const rewardScope = metadata.rewardScope || "room";
      const awardBadge = metadata.awardBadge === "1";
      const buyerUid = metadata.buyerUid || "";
      const buyerName = metadata.buyerName || "Guest";
      const label = metadata.label || "Room Boost";
      if (!roomCode || !points) {
        res.json({ received: true });
        return;
      }

      const eventId = session.id || event.id;
      const rootRef = getRootRef();
      const eventRef = rootRef.collection("stripe_events").doc(eventId);
      const existing = await eventRef.get();
      if (existing.exists) {
        res.json({ received: true, duplicate: true });
        return;
      }
      await eventRef.set({
        roomCode,
        points,
        amount: session.amount_total || 0,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      if (rewardScope === "buyer" && buyerUid) {
        const buyerRef = rootRef.collection("room_users").doc(`${roomCode}_${buyerUid}`);
        await buyerRef.set(
          {
            points: admin.firestore.FieldValue.increment(points),
            roomBoostBadge: awardBadge ? true : undefined,
            roomBoosts: awardBadge ? admin.firestore.FieldValue.increment(1) : undefined,
          },
          { merge: true }
        );
      } else {
        const usersSnap = await rootRef
          .collection("room_users")
          .where("roomCode", "==", roomCode)
          .get();
        if (!usersSnap.empty) {
          const batch = admin.firestore().batch();
          usersSnap.docs.forEach((docSnap) => {
            batch.update(docSnap.ref, {
              points: admin.firestore.FieldValue.increment(points),
            });
          });
          await batch.commit();
        }
        if (buyerUid && awardBadge) {
          const buyerRef = rootRef.collection("room_users").doc(`${roomCode}_${buyerUid}`);
          await buyerRef.set(
            {
              roomBoostBadge: true,
              roomBoosts: admin.firestore.FieldValue.increment(1),
            },
            { merge: true }
          );
        }
      }

      const amount = session.amount_total
        ? `$${(session.amount_total / 100).toFixed(2)}`
        : "";
      await rootRef.collection("activities").add({
        roomCode,
        user: rewardScope === "buyer" ? buyerName : "TIP JAR",
        text:
          rewardScope === "buyer"
            ? `${buyerName} grabbed ${label} - +${points} pts`
            : `room tip jar hit ${amount} - everyone +${points} pts`,
        icon: "$",
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
      const subscription = event.data.object || {};
      const stripeSubscriptionId = String(subscription.id || "").trim();
      if (!stripeSubscriptionId) {
        res.json({ received: true, ignored: true });
        return;
      }
      const subMapSnap = await admin
        .firestore()
        .collection(STRIPE_SUBSCRIPTIONS_COLLECTION)
        .doc(stripeSubscriptionId)
        .get();
      const mapped = subMapSnap.data() || {};
      const orgId = String(subscription.metadata?.orgId || mapped.orgId || "").trim();
      const ownerUid = String(subscription.metadata?.ownerUid || mapped.ownerUid || "").trim();
      const planId = resolvePlanIdFromStripeSubscription({
        explicitPlanId: subscription.metadata?.planId || "",
        subscription,
        fallbackPlanId: mapped.planId || "",
      });
      const status = event.type === "customer.subscription.deleted"
        ? "canceled"
        : String(subscription.status || "inactive").toLowerCase();
      if (orgId) {
        await applyOrganizationSubscriptionState({
          orgId,
          ownerUid,
          planId,
          status,
          provider: "stripe",
          stripeCustomerId: String(subscription.customer || "").trim(),
          stripeSubscriptionId,
          currentPeriodEndSec: Number(subscription.current_period_end || 0),
          cancelAtPeriodEnd: !!subscription.cancel_at_period_end,
          source: "stripe_subscription_event",
        });
      }
    }

    res.json({ received: true });
  }
);

exports.verifyAppleReceipt = onCall(
  { cors: true },
  async (request) => {
    const callerUid = requireAuth(request);
    const transactionId = request.data?.transactionId || "";
    const productId = request.data?.productId || "";
    const userUid = request.data?.userUid || "";
    ensureString(transactionId, "transactionId");
    ensureString(productId, "productId");
    ensureString(userUid, "userUid");
    if (userUid !== callerUid) {
      throw new HttpsError("permission-denied", "userUid must match authenticated user.");
    }

    // TODO: Wire App Store Server API with JWT auth and verify transaction.
    // After verification, grant entitlements and store a transaction record
    // to prevent duplicate grants.
    throw new HttpsError(
      "failed-precondition",
      "Apple IAP verification is not configured yet."
    );
  }
);
