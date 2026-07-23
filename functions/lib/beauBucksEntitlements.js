"use strict";

const crypto = require("node:crypto");
const catalog = require("./premiumCosmeticCatalog.json");

const BEAUBUCKS_ENTITLEMENT_COLLECTION = "beaurocks_account_entitlements";
const BEAUBUCKS_ENTITLEMENT_OPERATION_COLLECTION = "beaurocks_entitlement_operations";
const BEAUBUCKS_ENTITLEMENT_SCHEMA_VERSION = 1;

const token = (value = "") => String(value || "").trim();
const normalizedToken = (value = "") => token(value).toLowerCase().replace(/[^a-z0-9_-]/g, "_").replace(/_+/g, "_").slice(0, 160);
const whole = (value) => Math.max(0, Math.floor(Number(value) || 0));

const listPublicPremiumProducts = (source = catalog) => Object.values(source?.products || {})
  .filter((product) => product?.publicOffer === true)
  .map((product) => ({
    id: normalizedToken(product.id),
    kind: normalizedToken(product.kind),
    avatarId: normalizedToken(product.avatarId),
    label: token(product.label).slice(0, 80),
    flavor: token(product.flavor).slice(0, 180),
    cost: whole(product.cost),
    slotCount: whole(product.slotCount),
    grantedReactionType: normalizedToken(product.grantedReactionType),
    reactionType: normalizedToken(product.reactionType),
    baseReactionType: normalizedToken(product.baseReactionType),
  }))
  .filter((product) => product.id && product.kind && product.cost > 0);

const getPremiumProduct = (productId = "", source = catalog) => {
  const safeId = normalizedToken(productId);
  return listPublicPremiumProducts(source).find((product) => product.id === safeId) || null;
};

const normalizeEntitlementIds = (value = []) => [...new Set((Array.isArray(value) ? value : [])
  .map(normalizedToken)
  .filter(Boolean))].slice(0, 200);

const buildEntitlementDocumentId = ({ uid = "", productId = "" } = {}) => {
  const safeUid = token(uid);
  const safeProductId = normalizedToken(productId);
  if (!safeUid) throw new Error("uid is required");
  if (!safeProductId) throw new Error("productId is required");
  return crypto.createHash("sha256").update(`${safeUid}:${safeProductId}`).digest("hex");
};

const buildEntitlementOperationId = ({ uid = "", clientOperationId = "" } = {}) => {
  const safeUid = token(uid);
  const safeOperationId = token(clientOperationId);
  if (!safeUid) throw new Error("uid is required");
  if (!safeOperationId || safeOperationId.length > 120 || !/^[A-Za-z0-9:_-]+$/.test(safeOperationId)) {
    throw new Error("clientOperationId is invalid");
  }
  return crypto.createHash("sha256").update(`${safeUid}:${safeOperationId}`).digest("hex");
};

const getReactionSlotCount = ({ accountEligible = false, entitlementIds = [] } = {}, source = catalog) => {
  if (!accountEligible) return whole(source.defaultReactionSlots) || 4;
  const owned = new Set(normalizeEntitlementIds(entitlementIds));
  const paidSlotCount = listPublicPremiumProducts(source)
    .filter((product) => product.kind === "reaction_slot" && owned.has(product.id))
    .reduce((highest, product) => Math.max(highest, product.slotCount), 0);
  return Math.min(
    whole(source.maxReactionSlots) || 6,
    Math.max(whole(source.accountReactionSlots) || 5, paidSlotCount),
  );
};

module.exports = {
  BEAUBUCKS_ENTITLEMENT_COLLECTION,
  BEAUBUCKS_ENTITLEMENT_OPERATION_COLLECTION,
  BEAUBUCKS_ENTITLEMENT_SCHEMA_VERSION,
  buildEntitlementDocumentId,
  buildEntitlementOperationId,
  getPremiumProduct,
  getReactionSlotCount,
  listPublicPremiumProducts,
  normalizeEntitlementIds,
};
