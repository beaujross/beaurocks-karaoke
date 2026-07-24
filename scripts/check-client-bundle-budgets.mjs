import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const assetsDir = path.join(repoRoot, 'dist', 'assets');

const ENTRY_BUDGETS = Object.freeze([
  { label: 'Host application', prefix: 'HostApp-', maxBytes: 1_100_000 },
  { label: 'Audience application', prefix: 'SingerApp-', maxBytes: 565_000 },
  { label: 'Game registry', prefix: 'gameRegistry-', maxBytes: 20_000 },
  { label: 'Game launcher', prefix: 'UnifiedGameLauncher-', maxBytes: 175_000 },
]);

const GAME_CARTRIDGE_MAX_BYTES = 50_000;

const formatBytes = (bytes) => `${(bytes / 1000).toFixed(1)} kB`;

const findSingleAsset = (assets, prefix) => {
  const matches = assets.filter((asset) => asset.name.startsWith(prefix) && asset.name.endsWith('.js'));
  if (matches.length !== 1) {
    throw new Error(`Expected exactly one ${prefix}*.js asset; found ${matches.length}.`);
  }
  return matches[0];
};

const main = async () => {
  const entries = await fs.readdir(assetsDir, { withFileTypes: true });
  const assets = await Promise.all(
    entries
      .filter((entry) => entry.isFile() && entry.name.endsWith('.js'))
      .map(async (entry) => ({
        name: entry.name,
        bytes: (await fs.stat(path.join(assetsDir, entry.name))).size,
      })),
  );

  const failures = [];
  for (const budget of ENTRY_BUDGETS) {
    const asset = findSingleAsset(assets, budget.prefix);
    const passed = asset.bytes <= budget.maxBytes;
    console.log(
      `${passed ? 'PASS' : 'FAIL'} ${budget.label}: ${formatBytes(asset.bytes)} / ${formatBytes(budget.maxBytes)}`,
    );
    if (!passed) {
      failures.push(`${budget.label} is ${formatBytes(asset.bytes)}, above ${formatBytes(budget.maxBytes)}.`);
    }
  }

  const cartridgeAssets = assets.filter((asset) => /^Game-[A-Za-z0-9_-]+\.js$/.test(asset.name));
  if (cartridgeAssets.length < 2) {
    failures.push(`Expected multiple lazy game cartridges; found ${cartridgeAssets.length}.`);
  }
  for (const asset of cartridgeAssets) {
    if (asset.bytes > GAME_CARTRIDGE_MAX_BYTES) {
      failures.push(
        `${asset.name} is ${formatBytes(asset.bytes)}, above the ${formatBytes(GAME_CARTRIDGE_MAX_BYTES)} cartridge budget.`,
      );
    }
  }
  const largestCartridge = cartridgeAssets.reduce(
    (largest, asset) => (asset.bytes > largest.bytes ? asset : largest),
    { name: 'none', bytes: 0 },
  );
  console.log(
    `${cartridgeAssets.every((asset) => asset.bytes <= GAME_CARTRIDGE_MAX_BYTES) ? 'PASS' : 'FAIL'} `
      + `game cartridges: ${cartridgeAssets.length} chunks, largest ${largestCartridge.name} at ${formatBytes(largestCartridge.bytes)}`,
  );

  if (failures.length) {
    for (const failure of failures) console.error(`- ${failure}`);
    process.exitCode = 1;
    return;
  }
  console.log('Client bundle budgets passed.');
};

main().catch((error) => {
  console.error(String(error?.stack || error?.message || error));
  process.exit(1);
});
