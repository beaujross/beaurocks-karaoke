"use strict";

const { buildLedgerAccountId } = require("./beauBucksLedger");

const token = (value) => String(value || "").trim();
const whole = (value) => Math.max(0, Math.floor(Number(value) || 0));

const buildBeauBucksAccountWalletMigrationReport = ({ accounts = [], truncated = false } = {}) => {
  const normalized = (Array.isArray(accounts) ? accounts : [])
    .map((account) => ({
      documentId: token(account.documentId || account.id),
      uid: token(account.uid),
      scope: token(account.scope).toLowerCase(),
      currency: token(account.currency).toLowerCase(),
      balance: whole(account.balance),
      lifetimePurchased: whole(account.lifetimePurchased),
      lifetimeSpent: whole(account.lifetimeSpent),
      status: token(account.status || "active").toLowerCase(),
    }))
    .filter((account) => account.currency === "beaubucks");
  const legacy = normalized.filter((account) => account.scope !== "account");
  const persistent = normalized.filter((account) => account.scope === "account");
  const byUid = new Map();
  for (const account of normalized) {
    const key = account.uid || `missing:${account.documentId}`;
    const current = byUid.get(key) || { uid: account.uid, legacyAccounts: [], persistentAccounts: [] };
    if (legacy.includes(account)) current.legacyAccounts.push(account);
    else current.persistentAccounts.push(account);
    byUid.set(key, current);
  }
  const users = [...byUid.values()].map((group) => {
    const expectedAccountId = group.uid ? buildLedgerAccountId({ uid: group.uid, currency: "beaubucks" }) : "";
    const legacyBalance = group.legacyAccounts.reduce((sum, account) => sum + account.balance, 0);
    const persistentBalance = group.persistentAccounts.reduce((sum, account) => sum + account.balance, 0);
    const blockers = [];
    if (!group.uid) blockers.push("Legacy account is missing uid.");
    if (group.persistentAccounts.length > 1) blockers.push("Multiple persistent account projections exist for one uid.");
    if (group.persistentAccounts.some((account) => account.documentId !== expectedAccountId)) blockers.push("Persistent account document ID does not match the canonical account ID.");
    if (legacyBalance > 0) blockers.push("Positive legacy Room-wallet balance requires an idempotent transfer before activation.");
    return {
      uid: group.uid,
      expectedAccountId,
      legacyAccountIds: group.legacyAccounts.map((account) => account.documentId),
      persistentAccountIds: group.persistentAccounts.map((account) => account.documentId),
      legacyBalance,
      persistentBalance,
      blockers,
    };
  });
  const blockers = [
    ...(truncated ? ["The account scan was truncated."] : []),
    ...users.flatMap((user) => user.blockers.map((blocker) => `${user.uid || "missing uid"}: ${blocker}`)),
  ];
  return {
    schemaVersion: 1,
    readOnly: true,
    truncated: truncated === true,
    readyForAccountWalletCutover: blockers.length === 0,
    summary: {
      accountCount: normalized.length,
      legacyAccountCount: legacy.length,
      persistentAccountCount: persistent.length,
      positiveLegacyAccountCount: legacy.filter((account) => account.balance > 0).length,
      legacyBalanceTotal: legacy.reduce((sum, account) => sum + account.balance, 0),
      persistentBalanceTotal: persistent.reduce((sum, account) => sum + account.balance, 0),
      userCount: users.length,
    },
    users,
    blockers,
    recommendedNextAction: blockers[0] || "No positive or malformed legacy Room-wallet projection blocks account-wallet cutover.",
  };
};

module.exports = { buildBeauBucksAccountWalletMigrationReport };
