const assert = require('node:assert/strict');
const { calculatePerformanceFame, getFameLevel } = require('../../functions/lib/fameProgression');

test('performance Fame follows the existing fair formula without premium multipliers', () => {
  assert.deepEqual(calculatePerformanceFame({ hypeScore: 150, peakDecibel: 85, hostMultiplier: 1.5 }), {
    hype: 150,
    decibelScore: 75,
    hostMultiplier: 1.5,
    hostBonusPoints: 225,
    totalFameAwarded: 450,
  });
});

test('Fame levels use the account progression thresholds', () => {
  assert.equal(getFameLevel(0), 0);
  assert.equal(getFameLevel(600), 3);
  assert.equal(getFameLevel(25000), 20);
});
