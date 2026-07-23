"use strict";

const normalizeUid = (value) => String(value || "").trim().slice(0, 180);

const buildBeauBucksCanaryBuyerPolicy = (env = process.env) => {
  const buyerUids = [...new Set(String(env.BEAUBUCKS_CANARY_BUYER_UIDS || "")
    .split(",")
    .map(normalizeUid)
    .filter(Boolean))];
  const maxBuyers = 10;
  const configured = buyerUids.length > 0 && buyerUids.length <= maxBuyers;
  return Object.freeze({ configured, buyerUids: Object.freeze(buyerUids), buyerUidSet: new Set(buyerUids), maxBuyers });
};

const isBeauBucksCanaryBuyerAllowed = ({ uid = "", policy } = {}) => {
  const safePolicy = policy || buildBeauBucksCanaryBuyerPolicy({});
  return safePolicy.configured === true && safePolicy.buyerUidSet.has(normalizeUid(uid));
};

module.exports = { buildBeauBucksCanaryBuyerPolicy, isBeauBucksCanaryBuyerAllowed };
