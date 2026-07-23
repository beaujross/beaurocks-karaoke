"use strict";

const premiumCosmeticCatalog = require("./premiumCosmeticCatalog.json");

const buildPremiumCostEnvelope = ({ packBalance = 0, catalog = premiumCosmeticCatalog } = {}) => {
  const balance = Math.max(0, Math.floor(Number(packBalance || 0) || 0));
  const publicProducts = Object.values(catalog?.products || {})
    .filter((product) => product?.publicOffer === true && Number(product?.cost) > 0)
    .map((product) => ({ ...product, cost: Math.floor(Number(product.cost)) }));
  const affordableSubsets = [];
  for (let mask = 0; mask < (1 << publicProducts.length); mask += 1) {
    const products = publicProducts.filter((_, index) => (mask & (1 << index)) !== 0);
    if (products.reduce((sum, product) => sum + product.cost, 0) <= balance) affordableSubsets.push(products);
  }
  return {
    minimumUnlockCost: publicProducts.length ? Math.min(...publicProducts.map((product) => product.cost)) : null,
    publicEntitlementCount: publicProducts.length,
    maximumEntitlementPurchasesPerPack: affordableSubsets.reduce((maximum, products) => Math.max(maximum, products.length), 0),
    maximumAuthorityWritesPerPack: affordableSubsets.reduce((maximum, products) => Math.max(maximum,
      products.reduce((sum, product) => sum + (product.kind === "profile_emoji" ? 5 : 4), 0)), 0),
  };
};

module.exports = { buildPremiumCostEnvelope };
