import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { test } from 'vitest';

const source = readFileSync('src/apps/Host/components/RunOfShowDirectorPanel.jsx', 'utf8');

test('run-of-show director panel keeps host-facing copy free of mojibake', () => {
  assert.doesNotMatch(source, /[^\x00-\x7F]/);
});
