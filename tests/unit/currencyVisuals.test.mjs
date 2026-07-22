import assert from 'node:assert/strict';
import { test } from 'vitest';
import { CURRENCY_VISUALS, getCurrencyVisual } from '../../src/lib/currencyVisuals.js';

test('Points, BeauBucks, and Fame have distinct icons and color systems', () => {
  assert.equal(CURRENCY_VISUALS.points.iconText, 'P');
  assert.equal(CURRENCY_VISUALS.beaubucks.iconText, 'B$');
  assert.equal(CURRENCY_VISUALS.fame.iconText, '★');
  assert.match(CURRENCY_VISUALS.points.gradientClass, /cyan/);
  assert.match(CURRENCY_VISUALS.beaubucks.gradientClass, /fuchsia/);
  assert.match(CURRENCY_VISUALS.fame.gradientClass, /amber/);
  assert.equal(getCurrencyVisual('unknown'), CURRENCY_VISUALS.points);
});
