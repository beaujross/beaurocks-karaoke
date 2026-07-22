"use strict";

const commercialContract = require("./hostCommercialContract.json");
const reactionPointCosts = require("./reactionPointCosts.json");

const nonEmpty = (value) => String(value || "").trim();
const wholeNumber = (value) => {
  if (value === null || value === undefined || (typeof value === "string" && !value.trim())) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.floor(parsed) : null;
};
const uniqueTokens = (values = []) => [...new Set((Array.isArray(values) ? values : [])
  .map((value) => nonEmpty(value).toUpperCase())
  .filter(Boolean))];

const makeGate = (id, label, blockers = [], details = {}) => ({
  id,
  label,
  passed: blockers.length === 0,
  blockers: [...new Set(blockers.filter(Boolean))],
  details,
});

const buildPrelaunchSafetyGate = (contract = commercialContract) => {
  const policy = contract.beauBucksPolicy || {};
  const publicPackIds = Object.values(policy.packs || {})
    .filter((pack) => pack?.publicOffer === true)
    .map((pack) => nonEmpty(pack?.id))
    .filter(Boolean);
  const blockers = [];
  if (policy.checkoutEnabled === true) blockers.push("Checkout is already enabled before the activation review.");
  if (nonEmpty(policy.status) === "active") blockers.push("The BeauBucks policy is already active before the activation review.");
  if (publicPackIds.length) blockers.push("A BeauBucks pack is already public before the activation review.");
  return makeGate("prelaunch_safety", "Prelaunch safety", blockers, {
    checkoutEnabled: policy.checkoutEnabled === true,
    status: nonEmpty(policy.status),
    publicPackIds,
  });
};

const buildDecisionRecordGate = (inputs = {}) => {
  const blockers = [];
  if (wholeNumber(inputs.schemaVersion) !== 1) blockers.push("Use decision-record schema version 1.");
  if (inputs.publicPricing !== false) blockers.push("Keep publicPricing false until the separately reviewed activation change.");
  if (!nonEmpty(inputs.status)) blockers.push("Record the decision packet status.");
  return makeGate("decision_record", "Decision record integrity", blockers, {
    schemaVersion: wholeNumber(inputs.schemaVersion),
    publicPricing: inputs.publicPricing === true,
    status: nonEmpty(inputs.status),
  });
};

const buildProductPolicyGate = (policyDecision = {}, contract = commercialContract) => {
  const policy = contract.beauBucksPolicy || {};
  const blockers = [];
  const allowedSpendKinds = Array.isArray(policy.allowedSpendKinds) ? policy.allowedSpendKinds : [];
  if (nonEmpty(policyDecision.approvalStatus) !== "approved") blockers.push("Owner approval of the account-level BeauBucks product policy is required.");
  if (nonEmpty(policy.balanceScope) !== "account" || nonEmpty(policyDecision.balanceScope) !== "account") blockers.push("BeauBucks must persist with the signed-in BeauRocks account across Rooms.");
  if (allowedSpendKinds.length !== 1 || allowedSpendKinds[0] !== "reaction") blockers.push("The canary contract must allow BeauBucks for paid reactions only.");
  if (policyDecision.noCashValue !== true) blockers.push("Approve the no-cash-value promise.");
  if (policyDecision.transferable !== false) blockers.push("Approve non-transferable balances for the canary.");
  if (nonEmpty(policy.competitiveIntegrity) !== "no_scoring_win_or_queue_priority") blockers.push("Preserve the rule that BeauBucks cannot buy scores, wins, or queue priority.");
  if (!nonEmpty(policyDecision.decisionRef)) blockers.push("Record the product-policy decision reference.");
  return makeGate("product_policy", "Product policy", blockers, {
    balanceScope: nonEmpty(policy.balanceScope),
    allowedSpendKinds,
    competitiveIntegrity: nonEmpty(policy.competitiveIntegrity),
  });
};

const buildAccountMigrationGate = (migration = {}) => {
  const blockers = [];
  if (nonEmpty(migration.approvalStatus) !== "approved") blockers.push("Approve the one-time Room-wallet to account-wallet migration plan.");
  if (nonEmpty(migration.strategy) !== "aggregate_legacy_room_balances_once") blockers.push("Use the idempotent aggregate-once legacy balance strategy.");
  if (migration.completed !== true) blockers.push("Complete and reconcile legacy internal Room-wallet balances before activation.");
  if (!nonEmpty(migration.reportRef)) blockers.push("Attach the migration dry-run or completion report.");
  if (!nonEmpty(migration.decisionRef)) blockers.push("Record the account-wallet migration decision reference.");
  return makeGate("account_wallet_migration", "Account wallet migration", blockers, {
    strategy: nonEmpty(migration.strategy),
    completed: migration.completed === true,
    reportRef: nonEmpty(migration.reportRef),
  });
};

const buildPackGate = (packDecision = {}, contract = commercialContract) => {
  const policy = contract.beauBucksPolicy || {};
  const packId = nonEmpty(packDecision.packId);
  const pack = policy.packs?.[packId] || null;
  const blockers = [];
  if (nonEmpty(packDecision.approvalStatus) !== "approved") blockers.push("Owner approval of the starter pack economics is required.");
  if (!pack) blockers.push("Choose a BeauBucks pack that exists in the checked-in commercial contract.");
  const comparisons = [
    ["publicLabel", nonEmpty(packDecision.publicLabel), nonEmpty(pack?.publicLabel)],
    ["amountCents", wholeNumber(packDecision.amountCents), wholeNumber(pack?.amountCents)],
    ["currency", nonEmpty(packDecision.currency).toLowerCase(), nonEmpty(pack?.currency).toLowerCase()],
    ["beauBucks", wholeNumber(packDecision.beauBucks), wholeNumber(pack?.beauBucks)],
    ["scope", nonEmpty(packDecision.scope), nonEmpty(pack?.scope)],
  ];
  for (const [field, proposed, registered] of comparisons) {
    if (pack && proposed !== registered) blockers.push(`The approved ${field} must match the registered pack.`);
  }
  const maxPurchasesPerAccount = wholeNumber(packDecision.maxPurchasesPerAccount);
  if (maxPurchasesPerAccount !== 1) blockers.push("Limit the internal canary to one purchase per BeauRocks account.");
  const registeredPurchaseLimit = policy.purchaseLimit || {};
  if (wholeNumber(registeredPurchaseLimit.maxCompletedPurchasesPerAccount) !== maxPurchasesPerAccount) blockers.push("The approved account purchase limit must match the server-enforced limit.");
  if (wholeNumber(registeredPurchaseLimit.reservationMinutes) !== 35) blockers.push("Keep the initial checkout reservation at the server-enforced 35-minute window.");
  if (!nonEmpty(packDecision.decisionRef)) blockers.push("Record the pack-economics decision reference.");

  const positiveCosts = Object.values(reactionPointCosts).map(wholeNumber).filter((value) => value && value > 0);
  const minimumSpendCost = positiveCosts.length ? Math.min(...positiveCosts) : null;
  const maximumSpendOperations = minimumSpendCost && wholeNumber(pack?.beauBucks)
    ? Math.floor(wholeNumber(pack.beauBucks) / minimumSpendCost)
    : null;
  const minimumAuthorityWrites = maximumSpendOperations === null ? null : maximumSpendOperations * 3;
  const approvedMaximumSpendOperations = wholeNumber(packDecision.costEnvelope?.maximumSpendOperationsPerPack);
  const approvedMinimumAuthorityWrites = wholeNumber(packDecision.costEnvelope?.minimumAuthorityWritesPerPack);
  if (packDecision.costEnvelope?.approvalStatus !== "approved") blockers.push("Approve the conservative per-pack database-operation envelope.");
  if (maximumSpendOperations !== null && approvedMaximumSpendOperations !== maximumSpendOperations) blockers.push("The approved spend-operation ceiling must match the current lowest reaction cost.");
  if (minimumAuthorityWrites !== null && approvedMinimumAuthorityWrites !== minimumAuthorityWrites) blockers.push("The approved authority-write floor must cover operation, account, and ledger writes for every spend.");
  if (!nonEmpty(packDecision.costEnvelope?.decisionRef)) blockers.push("Record the cost-envelope decision reference.");

  return makeGate("starter_pack", "Starter pack and cost envelope", blockers, {
    packId,
    registeredPack: pack,
    minimumSpendCost,
    maximumSpendOperationsPerPack: maximumSpendOperations,
    minimumAuthorityWritesPerPack: minimumAuthorityWrites,
    registeredPurchaseLimit,
  });
};

const buildCustomerPromiseGate = (terms = {}) => {
  const blockers = [];
  if (nonEmpty(terms.approvalStatus) !== "approved") blockers.push("Approve the customer-facing BeauBucks promises.");
  if (terms.accountPersistentDisclosure !== true) blockers.push("Disclose that BeauBucks stay with the signed-in BeauRocks account across Rooms.");
  if (terms.noCashValueDisclosure !== true) blockers.push("Disclose that BeauBucks have no cash value and cannot be cashed out.");
  if (terms.nonTransferableDisclosure !== true) blockers.push("Disclose that BeauBucks cannot be transferred to another person or cashed out.");
  if (terms.reactionsOnlyDisclosure !== true) blockers.push("Disclose that the current eligible use is paid reactions.");
  if (nonEmpty(terms.expirationPolicy) !== "no_expiration_during_canary") blockers.push("Approve no expiration during the controlled canary.");
  if (nonEmpty(terms.refundPolicy) !== "contact_support_proportionate_unspent_reversal") blockers.push("Approve the refund promise for proportionate unspent BeauBucks reversal.");
  if (!/^https:\/\//i.test(nonEmpty(terms.termsUrl))) blockers.push("Record the public HTTPS Terms URL.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nonEmpty(terms.supportEmail))) blockers.push("Record a monitored customer-support email.");
  if (!nonEmpty(terms.decisionRef)) blockers.push("Record the customer-promise decision reference.");
  return makeGate("customer_promises", "Customer promises", blockers, {
    expirationPolicy: nonEmpty(terms.expirationPolicy),
    refundPolicy: nonEmpty(terms.refundPolicy),
    termsUrl: nonEmpty(terms.termsUrl),
    supportEmail: nonEmpty(terms.supportEmail),
  });
};

const buildCommercialOperationsGate = (operations = {}) => {
  const blockers = [];
  if (nonEmpty(operations.approvalStatus) !== "approved") blockers.push("Approve the merchant, support, tax, and accounting operating owner.");
  if (nonEmpty(operations.merchantOfRecord) !== "BeauRocks") blockers.push("Confirm BeauRocks as merchant of record for BeauBucks purchases.");
  if (!nonEmpty(operations.supportOwner)) blockers.push("Name the person responsible for purchase and refund support.");
  const refundResponseSlaHours = wholeNumber(operations.refundResponseSlaHours);
  if (refundResponseSlaHours === null || refundResponseSlaHours <= 0 || refundResponseSlaHours > 72) blockers.push("Approve a refund-support response target of 72 hours or less.");
  if (!new Set(["owner_approved", "professional_review_complete"]).has(nonEmpty(operations.taxTreatmentStatus))) blockers.push("Record owner or professional review of sales-tax treatment.");
  if (!new Set(["owner_approved", "professional_review_complete"]).has(nonEmpty(operations.accountingTreatmentStatus))) blockers.push("Record owner or professional review of accounting treatment for unused balances and refunds.");
  if (!nonEmpty(operations.reconciliationOwner)) blockers.push("Name the Stripe-to-ledger reconciliation owner.");
  if (!nonEmpty(operations.decisionRef)) blockers.push("Record the commercial-operations decision reference.");
  return makeGate("commercial_operations", "Commercial operations", blockers, {
    merchantOfRecord: nonEmpty(operations.merchantOfRecord),
    supportOwner: nonEmpty(operations.supportOwner),
    refundResponseSlaHours,
    taxTreatmentStatus: nonEmpty(operations.taxTreatmentStatus),
    accountingTreatmentStatus: nonEmpty(operations.accountingTreatmentStatus),
  });
};

const buildCohortGate = (cohort = {}) => {
  const blockers = [];
  const roomCodes = uniqueTokens(cohort.roomCodes);
  const maxParticipants = wholeNumber(cohort.maxParticipants);
  const maxGrossSalesCents = wholeNumber(cohort.maxGrossSalesCents);
  const durationDays = wholeNumber(cohort.durationDays);
  if (cohort.approved !== true) blockers.push("Approve the bounded internal canary cohort.");
  if (roomCodes.length !== 1) blockers.push("Choose exactly one production Room for the first paid canary.");
  if (maxParticipants === null || maxParticipants <= 0 || maxParticipants > 10) blockers.push("Limit the first paid canary to at most 10 named participants.");
  if (maxGrossSalesCents === null || maxGrossSalesCents <= 0 || maxGrossSalesCents > 5000) blockers.push("Set a positive gross-sales ceiling no greater than $50 for the first canary.");
  if (durationDays === null || durationDays <= 0 || durationDays > 14) blockers.push("Limit the first canary window to 14 days or less.");
  if (cohort.manualRosterRequired !== true) blockers.push("Require a named internal tester roster in addition to the server-enforced purchase cap.");
  if (!nonEmpty(cohort.rollbackOwner)) blockers.push("Name the person who can stop checkout and support paid testers.");
  if (!nonEmpty(cohort.decisionRef)) blockers.push("Record the cohort decision reference.");
  return makeGate("controlled_cohort", "Controlled cohort", blockers, {
    roomCodes,
    maxParticipants,
    maxGrossSalesCents,
    durationDays,
    manualRosterRequired: cohort.manualRosterRequired === true,
  });
};

const buildActivationGate = (activation = {}) => {
  const blockers = [];
  if (activation.approved !== true) blockers.push("Final owner approval for the separately reviewed production change is required.");
  if (!nonEmpty(activation.approvedBy)) blockers.push("Record who approved activation.");
  if (!nonEmpty(activation.decisionRef)) blockers.push("Record the activation decision reference.");
  return makeGate("activation_approval", "Activation approval", blockers, {
    approvedBy: nonEmpty(activation.approvedBy),
  });
};

const buildBeauBucksActivationReadiness = ({ decisionInputs = {}, commercial = commercialContract } = {}) => {
  const gates = [
    buildPrelaunchSafetyGate(commercial),
    buildDecisionRecordGate(decisionInputs),
    buildProductPolicyGate(decisionInputs.productPolicy, commercial),
    buildAccountMigrationGate(decisionInputs.accountWalletMigration),
    buildPackGate(decisionInputs.starterPack, commercial),
    buildCustomerPromiseGate(decisionInputs.customerPromises),
    buildCommercialOperationsGate(decisionInputs.commercialOperations),
    buildCohortGate(decisionInputs.cohort),
    buildActivationGate(decisionInputs.activation),
  ];
  const blockers = gates.flatMap((gate) => gate.blockers.map((blocker) => `${gate.label}: ${blocker}`));
  const readyForControlledActivation = gates.every((gate) => gate.passed);
  const firstBlockedGate = gates.find((gate) => !gate.passed);
  return {
    schemaVersion: 1,
    status: readyForControlledActivation ? "ready_for_separately_reviewed_activation" : "blocked_checkout_disabled",
    publicPricing: false,
    readyForControlledActivation,
    checkoutMustRemainDisabled: !readyForControlledActivation,
    runtimeMutationPerformed: false,
    gates,
    blockers,
    recommendedNextAction: firstBlockedGate
      ? `Resolve ${firstBlockedGate.label}: ${firstBlockedGate.blockers[0]}`
      : "All recorded gates passed; review and perform the separate bounded production activation change.",
  };
};

module.exports = { buildBeauBucksActivationReadiness };
