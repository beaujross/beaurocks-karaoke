import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const { buildBeauBucksActivationReadiness } = require('../../functions/lib/beauBucksActivationReadiness');

const args = Object.fromEntries(process.argv.slice(2).map((arg) => {
  const [key, ...valueParts] = arg.replace(/^--/, '').split('=');
  return [key, valueParts.length ? valueParts.join('=') : true];
}));
const decisionsPath = String(args.decisions || 'docs/costs/beaubucks_activation_decision_inputs.json');
const decisionInputs = JSON.parse(readFileSync(decisionsPath, 'utf8'));
const packet = buildBeauBucksActivationReadiness({ decisionInputs });
const output = { generatedAt: new Date().toISOString(), decisionsPath, ...packet };

if (args.json) {
  console.log(JSON.stringify(output, null, 2));
} else {
  console.log(`BeauBucks paid-canary readiness: ${output.status}`);
  console.log(`Controlled activation ready: ${output.readyForControlledActivation ? 'yes' : 'no'}`);
  console.log(`Checkout must remain disabled: ${output.checkoutMustRemainDisabled ? 'yes' : 'no'}`);
  console.log('This command is read-only and never changes production.');
  for (const gate of output.gates) {
    console.log(`${gate.passed ? 'PASS' : 'BLOCKED'} ${gate.label}`);
    for (const blocker of gate.blockers) console.log(`- ${blocker}`);
  }
  console.log(`Next: ${output.recommendedNextAction}`);
}

if (args.strict && !output.readyForControlledActivation) process.exitCode = 2;
