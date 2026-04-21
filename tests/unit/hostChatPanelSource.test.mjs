import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { test } from 'vitest';

const source = readFileSync('src/apps/Host/components/HostChatPanel.jsx', 'utf8');

test('host chat panel stays focused on live chat instead of policy controls', () => {
  assert.match(source, /Host chat/);
  assert.match(source, /chatEnabled \? 'Open' : 'Off'/);
  assert.match(source, /chatShowOnTv \? 'TV On' : 'TV Off'/);
  assert.doesNotMatch(source, /await updateRoom\(\{ chatEnabled:/);
  assert.doesNotMatch(source, /await updateRoom\(\{ chatShowOnTv:/);
  assert.doesNotMatch(source, /setChatAudienceMode/);
});

