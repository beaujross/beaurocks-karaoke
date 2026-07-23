const assert = require('node:assert/strict');
const { buildBeauBucksActivationReadiness } = require('../../functions/lib/beauBucksActivationReadiness');

const approvedInputs = {
  schemaVersion: 1,
  status: 'owner_approved_checkout_disabled',
  publicPricing: false,
  productPolicy: {
    approvalStatus: 'approved', balanceScope: 'account', noCashValue: true, transferable: false,
    decisionRef: 'decision-product-1',
  },
  accountWalletMigration: {
    approvalStatus: 'approved', strategy: 'aggregate_legacy_room_balances_once', completed: true,
    reportRef: 'migration-report-1', decisionRef: 'decision-migration-1',
  },
  starterPack: {
    approvalStatus: 'approved', packId: 'beaubucks_starter_1200', publicLabel: 'Starter 1,200 BeauBucks',
    amountCents: 500, currency: 'usd', beauBucks: 1200, scope: 'account', maxPurchasesPerAccount: 1,
    decisionRef: 'decision-pack-1',
    costEnvelope: { approvalStatus: 'approved', maximumEntitlementPurchasesPerPack: 7, maximumAuthorityWritesPerPack: 34, decisionRef: 'decision-cost-1' },
  },
  customerPromises: {
    approvalStatus: 'approved', accountPersistentDisclosure: true, noCashValueDisclosure: true,
    nonTransferableDisclosure: true, durableCosmeticsDisclosure: true,
    expirationPolicy: 'no_expiration_during_canary',
    refundPolicy: 'contact_support_proportionate_unspent_reversal',
    termsUrl: 'https://beaurocks.app/karaoke/terms', supportEmail: 'hello@beaurocks.app',
    decisionRef: 'decision-terms-1',
  },
  commercialOperations: {
    approvalStatus: 'approved', merchantOfRecord: 'BeauRocks', supportOwner: 'Owner', refundResponseSlaHours: 72,
    taxTreatmentStatus: 'owner_approved', accountingTreatmentStatus: 'owner_approved',
    reconciliationOwner: 'Owner', decisionRef: 'decision-ops-1',
  },
  cohort: {
    approved: true, roomCodes: ['ROOMBB'], maxParticipants: 10, maxGrossSalesCents: 5000,
    durationDays: 14, manualRosterRequired: true, serverBuyerAllowlistRequired: true, rollbackOwner: 'Owner', decisionRef: 'decision-cohort-1',
  },
  activation: { approved: true, approvedBy: 'Owner', decisionRef: 'decision-activation-1' },
};

test('blank decisions keep paid checkout blocked while confirming prelaunch safety', () => {
  const packet = buildBeauBucksActivationReadiness({ decisionInputs: {} });
  assert.equal(packet.status, 'blocked_checkout_disabled');
  assert.equal(packet.readyForControlledActivation, false);
  assert.equal(packet.checkoutMustRemainDisabled, true);
  assert.equal(packet.runtimeMutationPerformed, false);
  assert.equal(packet.gates.find((gate) => gate.id === 'prelaunch_safety').passed, true);
  assert.equal(packet.gates.find((gate) => gate.id === 'customer_promises').passed, false);
});

test('all explicit decisions can ready a separate bounded activation without mutating runtime', () => {
  const packet = buildBeauBucksActivationReadiness({ decisionInputs: approvedInputs });
  assert.equal(packet.status, 'ready_for_separately_reviewed_activation');
  assert.equal(packet.readyForControlledActivation, true);
  assert.equal(packet.checkoutMustRemainDisabled, false);
  assert.equal(packet.runtimeMutationPerformed, false);
  assert.ok(packet.gates.every((gate) => gate.passed));
  assert.match(packet.recommendedNextAction, /separate bounded production activation change/);
});

test('pack approval must match the server catalog and durable entitlement cost envelope', () => {
  const packet = buildBeauBucksActivationReadiness({
    decisionInputs: {
      ...approvedInputs,
      starterPack: {
        ...approvedInputs.starterPack,
        amountCents: 499,
        costEnvelope: { ...approvedInputs.starterPack.costEnvelope, maximumEntitlementPurchasesPerPack: 6 },
      },
    },
  });
  const gate = packet.gates.find((candidate) => candidate.id === 'starter_pack');
  assert.equal(gate.passed, false);
  assert.equal(gate.details.minimumUnlockCost, 120);
  assert.equal(gate.details.publicEntitlementCount, 13);
  assert.equal(gate.details.maximumEntitlementPurchasesPerPack, 7);
  assert.equal(gate.details.maximumAuthorityWritesPerPack, 34);
  assert.ok(gate.blockers.some((blocker) => blocker.includes('amountCents')));
  assert.ok(gate.blockers.some((blocker) => blocker.includes('purchase ceiling')));
});

test('the first paid cohort stays one-room, small, capped, and manually rostered', () => {
  const packet = buildBeauBucksActivationReadiness({
    decisionInputs: {
      ...approvedInputs,
      cohort: {
        ...approvedInputs.cohort,
        roomCodes: ['ROOM1', 'ROOM2'], maxParticipants: 11, maxGrossSalesCents: 5001,
        durationDays: 15, manualRosterRequired: false, serverBuyerAllowlistRequired: false,
      },
    },
  });
  const gate = packet.gates.find((candidate) => candidate.id === 'controlled_cohort');
  assert.equal(gate.passed, false);
  assert.equal(gate.blockers.length, 6);
});

test('public pricing or an already active contract fails the pre-activation packet closed', () => {
  const commercial = require('../../functions/lib/hostCommercialContract.json');
  const activeCommercial = JSON.parse(JSON.stringify(commercial));
  activeCommercial.beauBucksPolicy.status = 'active';
  activeCommercial.beauBucksPolicy.checkoutEnabled = true;
  activeCommercial.beauBucksPolicy.packs.beaubucks_starter_1200.publicOffer = true;
  const packet = buildBeauBucksActivationReadiness({
    decisionInputs: { ...approvedInputs, publicPricing: true },
    commercial: activeCommercial,
  });
  assert.equal(packet.readyForControlledActivation, false);
  assert.equal(packet.gates.find((gate) => gate.id === 'prelaunch_safety').passed, false);
  assert.equal(packet.gates.find((gate) => gate.id === 'decision_record').passed, false);
});
