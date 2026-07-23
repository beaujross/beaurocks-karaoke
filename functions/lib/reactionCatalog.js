"use strict";

const catalog = require("./reactionCatalog.json");

const token = (value = "") => String(value || "").trim().toLowerCase();
const whole = (value) => Math.max(0, Math.floor(Number(value) || 0));

const listReactionDefinitions = (source = catalog) => Object.values(source?.reactions || {}).map((reaction) => ({
  ...reaction,
  id: token(reaction.id),
  pointCost: whole(reaction.pointCost),
  scoreValue: whole(reaction.scoreValue),
  cooldownMs: whole(reaction.cooldownMs),
})).filter((reaction) => reaction.id && reaction.pointCost > 0 && reaction.scoreValue === reaction.pointCost);

const getReactionDefinition = (reactionType = "", source = catalog) => (
  listReactionDefinitions(source).find((reaction) => reaction.id === token(reactionType)) || null
);

const getReactionPointCosts = (source = catalog) => Object.freeze(Object.fromEntries(
  listReactionDefinitions(source).map((reaction) => [reaction.id, reaction.pointCost])
));

const isReactionUnlocked = ({ reaction, accountEligible = false, fameLevel = 0, entitlementIds = [] } = {}) => {
  if (!reaction) return false;
  const unlock = reaction.unlock || {};
  if (unlock.type === "free") return true;
  if (unlock.type === "account") return accountEligible === true;
  if (unlock.type === "fame") return accountEligible === true && whole(fameLevel) >= whole(unlock.level);
  if (unlock.type === "entitlement") return accountEligible === true
    && new Set((Array.isArray(entitlementIds) ? entitlementIds : []).map(token)).has(token(unlock.productId));
  return false;
};

module.exports = { getReactionDefinition, getReactionPointCosts, isReactionUnlocked, listReactionDefinitions };
