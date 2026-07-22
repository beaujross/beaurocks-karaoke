import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const contract = require('../../functions/lib/roomCostEnvelopeContract.json');
const inputs = require('../../docs/costs/nightly_cost_model_inputs.json');
const { buildRoomCostEnvelope, validateRoomCostEnvelopeContract } = require('../../functions/lib/roomCostEnvelope');

const errors = validateRoomCostEnvelopeContract(contract);
for (const listener of contract.listenerInventory) {
  const source = readFileSync(listener.file, 'utf8');
  if (!source.includes(listener.anchor)) errors.push(`${listener.id} source anchor was not found in ${listener.file}`);
}

if (errors.length) {
  console.error('Room cost envelope preflight failed:');
  errors.forEach((error) => console.error(`- ${error}`));
  process.exitCode = 1;
} else {
  const envelopes = Object.entries(inputs.scenarios).map(([scenarioId, scenario]) => (
    buildRoomCostEnvelope({ scenarioId, scenario, pricingInputs: inputs.pricing_inputs, envelopeContract: contract })
  ));
  const unbounded = contract.listenerInventory.filter((entry) => String(entry.shape).includes('unbounded'));
  const remainingActions = contract.listenerInventory.filter((entry) => entry.disposition === 'contain');
  console.log(`Room cost envelope preflight passed (${contract.listenerInventory.length} listeners, ${unbounded.length} unbounded, ${remainingActions.length} containment actions remaining).`);
  for (const envelope of envelopes) {
    console.log(`${envelope.scenarioId}: expected $${envelope.percentiles.expected.directProviderCostUsd.toFixed(2)}, p95 $${envelope.percentiles.p95.directProviderCostUsd.toFixed(2)}, p99 $${envelope.percentiles.p99.directProviderCostUsd.toFixed(2)}`);
  }
}
