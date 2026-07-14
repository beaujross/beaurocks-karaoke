import assert from 'node:assert/strict';
import { test } from 'vitest';

import { formatRoomActionDisclosure } from '../../src/lib/roomActionDisclosure.js';

test('formats digital costs with the active room currency', () => {
  assert.equal(formatRoomActionDisclosure({ intent: 'play', cost: 10, currencyLabel: 'PTS' }), 'Digital play • 10 PTS');
  assert.equal(formatRoomActionDisclosure({ intent: 'performer', cost: 25, currencyLabel: 'BB' }), 'Performer score • 25 BB');
});

test('labels free influence and real-money checkout without implying equivalence', () => {
  assert.equal(formatRoomActionDisclosure({ intent: 'influence', free: true }), 'Room influence • FREE');
  assert.equal(formatRoomActionDisclosure({ intent: 'support', externalCheckout: true }), 'Real money • external checkout');
});
