"use strict";

const FAME_THRESHOLDS = Object.freeze([0, 100, 300, 600, 1000, 1500, 2200, 3000, 4000, 5200, 6500, 8000, 9500, 11000, 12500, 14200, 16000, 18000, 20000, 22500, 25000]);

const whole = (value) => Math.max(0, Math.floor(Number(value) || 0));
const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, Number(value) || 0));

const getFameLevel = (totalFame = 0) => {
  const total = whole(totalFame);
  let level = 0;
  FAME_THRESHOLDS.forEach((threshold, index) => {
    if (total >= threshold) level = index;
  });
  return level;
};

const calculatePerformanceFame = ({ hypeScore = 0, peakDecibel = 65, hostMultiplier = 1 } = {}) => {
  const hype = whole(hypeScore);
  const clampedDecibel = clamp(peakDecibel, 40, 100);
  const decibelScore = Math.round(((clampedDecibel - 40) / 60) * 100);
  const multiplier = clamp(hostMultiplier, 0.5, 3);
  const hostBonusPoints = Math.round(hype * multiplier);
  return {
    hype,
    decibelScore,
    hostMultiplier: multiplier,
    hostBonusPoints,
    totalFameAwarded: hype + decibelScore + hostBonusPoints,
  };
};

module.exports = { FAME_THRESHOLDS, calculatePerformanceFame, getFameLevel };
