import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'vitest';

const auditSource = readFileSync('scripts/audit-browse-backings.mjs', 'utf8');

test('bundled backing audit checks every indexed YouTube choice with a strict release mode', () => {
  assert.match(auditSource, /import \{ BROWSE_BACKING_INDEX \}/);
  assert.match(auditSource, /Object\.entries\(BROWSE_BACKING_INDEX\)/);
  assert.match(auditSource, /youtube\/v3\/videos/);
  assert.match(auditSource, /item\?\.status\?\.embeddable === true/);
  assert.match(auditSource, /youtube\.com\/oembed/);
  assert.match(auditSource, /process\.argv\.includes\('--fail-on-unavailable'\)/);
  assert.match(auditSource, /unavailable\.length \|\| unknown\.length/);
});
