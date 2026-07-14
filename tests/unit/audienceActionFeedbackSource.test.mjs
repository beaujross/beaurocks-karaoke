import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'vitest';

const source = readFileSync('src/apps/Mobile/SingerApp.jsx', 'utf8');

test('audience actions report their actual effects without implying payment completion', () => {
  assert.match(source, /getReactionFeedback/);
  assert.match(source, /currencyLabel: roomCurrencyPresentation\.shortLabel/);
  assert.match(source, /performerName: takeoverClapVotingActive \? '' : currentSinger\?\.singerName/);
  assert.match(source, /roomInfluence: takeoverClapVotingActive/);
  assert.match(source, /toast\(getCheckoutLaunchFeedback\('Givebutter'\)\)/);
  assert.match(source, /Need \$\{nextCost\} \$\{roomCurrencyPresentation\.shortLabel\}/);
});
