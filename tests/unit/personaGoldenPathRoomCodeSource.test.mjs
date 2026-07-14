import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'vitest';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const source = fs.readFileSync(
  path.resolve(__dirname, '../../scripts/qa/persona-golden-paths-playwright.mjs'),
  'utf8',
);

test('persona QA room-code fallback rejects prose token ALREADY', () => {
  assert.match(source, /ROOM_CODE_BLOCKLIST[^\n]+"ALREADY"/);
  assert.match(source, /!ROOM_CODE_BLOCKLIST\.has\(code\)/);
});

test('persona QA waits for asynchronous vote feedback and detects submission errors', () => {
  assert.match(source, /voteFeedbackStartedAt/);
  assert.match(source, /Math\.min\(15000, timeoutMs\)/);
  assert.match(source, /voteErrorMatch/);
  assert.match(source, /option0\.waitFor\(\{ state: "visible"/);
  assert.match(source, /freshRoundButton/);
  assert.match(source, /hasReturningIdentity/);
  assert.match(source, /Active game overlay is visible before singer membership/);
  assert.doesNotMatch(source, /await singerPage\.getByRole\("button"\)\.first\(\)\.click/);
});