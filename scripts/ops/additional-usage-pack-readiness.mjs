import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { buildAdditionalUsagePackReadiness } = require('../../functions/lib/additionalUsagePackReadiness');

const args = Object.fromEntries(process.argv.slice(2).map((arg) => {
  const [key, ...valueParts] = arg.replace(/^--/, '').split('=');
  return [key, valueParts.length ? valueParts.join('=') : true];
}));

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));
const decisionInputsPath = String(args.decisions || 'docs/costs/additional_usage_pack_decision_inputs.json');
const observationReportPath = String(args['observation-report'] || '').trim();
const days = Math.max(1, Math.min(90, Math.floor(Number(args.days || 90))));

const loadObservationReport = () => {
  if (observationReportPath) return readJson(observationReportPath);
  const reportScript = fileURLToPath(new URL('./room-cost-observation-report.mjs', import.meta.url));
  const childArgs = [reportScript, `--days=${days}`, '--json'];
  if (args.project) childArgs.push(`--project=${String(args.project)}`);
  return JSON.parse(execFileSync(process.execPath, childArgs, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  }));
};

const observationReport = loadObservationReport();
const decisionInputs = readJson(decisionInputsPath);
const packet = buildAdditionalUsagePackReadiness({ observationReport, decisionInputs });
const output = {
  generatedAt: new Date().toISOString(),
  observationWindowDays: days,
  decisionInputsPath,
  ...packet,
};

if (args.json) {
  console.log(JSON.stringify(output, null, 2));
} else {
  console.log(`Additional usage first-pack readiness: ${output.status}`);
  console.log(`Pricing decision ready: ${output.readyForPricingDecision ? 'yes' : 'no'}`);
  console.log(`Controlled activation ready: ${output.readyForControlledActivation ? 'yes' : 'no'}`);
  console.log(`Checkout must remain disabled: ${output.checkoutMustRemainDisabled ? 'yes' : 'no'}`);
  for (const gate of output.gates) {
    console.log(`${gate.passed ? 'PASS' : 'BLOCKED'} ${gate.label}`);
    for (const blocker of gate.blockers) console.log(`- ${blocker}`);
  }
  console.log(`Next: ${output.recommendedNextAction}`);
}

if (args.strict && !output.readyForControlledActivation) process.exitCode = 2;
