/**
 * Performance Summary Component
 * 
 * Shows detailed score breakdown after game performance
 * Displays hype points, decibel score, host bonus, total fame
 * Includes level-up animation if applicable
 */

import React, { useEffect, useState } from 'react';
import { FameLevelCard } from './FameLevelBadge';
import { FAME_LEVELS } from '@/lib/fameConstants';

export function PerformanceSummary({ 
  breakdown,
  previousLevel,
  newLevel,
  totalPoints,
  onDismiss,
  levelUpCallback
}) {
  const [showLevelUpAnimation, setShowLevelUpAnimation] = useState(false);
  const levelUpOccurred = newLevel !== undefined && newLevel > previousLevel;

  useEffect(() => {
    if (levelUpOccurred) {
      // Delay animation for dramatic effect
      const timer = setTimeout(() => setShowLevelUpAnimation(true), 500);
      return () => clearTimeout(timer);
    }
  }, [levelUpOccurred]);

  const handleDismiss = () => {
    if (levelUpCallback) levelUpCallback({ previousLevel, newLevel });
    onDismiss?.();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl max-w-2xl w-full max-h-96 overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-blue-600 px-6 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white">🎤 Performance Summary</h1>
          <button
            onClick={handleDismiss}
            className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-2 transition"
          >
            ✕
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Score Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Hype Points */}
            <div className="bg-slate-700 bg-opacity-50 rounded-lg p-4">
              <div className="text-sm text-gray-400 mb-1">Hype Points</div>
              <div className="text-3xl font-bold text-blue-400">
                {breakdown?.hypePoints || 0}
              </div>
            </div>

            {/* Decibel Score */}
            <div className="bg-slate-700 bg-opacity-50 rounded-lg p-4">
              <div className="flex justify-between items-center mb-2">
                <div className="text-sm text-gray-400">Vocal Power</div>
                <div className="text-sm font-semibold">{breakdown?.peakDecibel?.toFixed(1)}dB</div>
              </div>
              <div className="text-3xl font-bold text-orange-400">
                {breakdown?.decibelScore || 0}
              </div>
              <div className="text-xs text-gray-500 mt-2">
                Score from vocal intensity
              </div>
            </div>

            {/* Host Bonus */}
            <div className="bg-slate-700 bg-opacity-50 rounded-lg p-4">
              <div className="text-sm text-gray-400 mb-1">Host Bonus Multiplier</div>
              <div className="text-3xl font-bold text-emerald-400">
                ×{breakdown?.hostBonus?.toFixed(1) || 1.0}
              </div>
              <div className="text-xs text-emerald-300 mt-2">
                +{breakdown?.hostBonusPoints || 0} points
              </div>
            </div>
          </div>

          {/* Total Fame */}
          <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg p-4">
            <div className="text-sm text-purple-200 mb-2">Total Fame Awarded</div>
            <div className="flex items-baseline justify-between">
              <div className="text-4xl font-bold text-white">
                {breakdown?.totalFameAwarded || 0}
              </div>
              <div className="text-lg text-purple-200 font-semibold">⭐ Fame Points</div>
            </div>
          </div>

          {/* Level Up Animation */}
          {showLevelUpAnimation && levelUpOccurred && (
            <div className="bg-gradient-to-r from-yellow-500 via-amber-500 to-red-500 rounded-lg p-6 text-center animate-pulse">
              <div className="text-5xl mb-3">🎉</div>
              <h2 className="text-3xl font-bold text-white mb-2">LEVEL UP!</h2>
              <div className="flex items-center justify-center gap-4 mt-4">
                <div className="text-center">
                  <div className="text-gray-700 text-sm font-semibold">Previous</div>
                  <div className="text-2xl font-bold text-white">
                    {previousLevel}
                  </div>
                </div>
                <div className="text-3xl text-white">→</div>
                <div className="text-center">
                  <div className="text-gray-700 text-sm font-semibold">New Level</div>
                  <div className="text-4xl font-bold text-white bg-yellow-300 bg-opacity-30 px-4 py-2 rounded-lg">
                    {newLevel}
                  </div>
                </div>
              </div>
              
              {/* Level Unlock */}
              {FAME_LEVELS[newLevel]?.unlock && (
                <div className="mt-4 p-3 bg-black bg-opacity-30 rounded-lg text-white">
                  <div className="text-sm text-yellow-200 font-semibold">🔓 Unlock</div>
                  <div className="text-lg font-bold mt-1">{FAME_LEVELS[newLevel].unlock}</div>
                </div>
              )}

              {/* Level Name & Reward */}
              <div className="mt-4 space-y-2 text-white">
                <div>
                  <span className="font-semibold text-lg">{FAME_LEVELS[newLevel]?.name}</span>
                </div>
                <div className="text-sm">
                  🎁 {FAME_LEVELS[newLevel]?.reward}
                </div>
              </div>
            </div>
          )}

          {/* Current Status */}
          <div className="bg-slate-700 bg-opacity-50 rounded-lg p-4">
            <div className="text-sm text-gray-400 mb-3">Your Fame Status</div>
            <div className="flex justify-between text-sm">
              <div>
                <div className="text-gray-400">Current Level</div>
                <div className="text-xl font-bold text-white">{newLevel}</div>
              </div>
              <div>
                <div className="text-gray-400">Total Points</div>
                <div className="text-xl font-bold text-purple-400">{totalPoints}</div>
              </div>
              <div className="text-right">
                <div className="text-gray-400">{FAME_LEVELS[newLevel]?.name}</div>
                <div className="text-sm text-gray-500 mt-1">{FAME_LEVELS[newLevel]?.description}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="border-t border-slate-700 p-4 flex gap-3">
          <button
            onClick={handleDismiss}
            className="flex-1 px-4 py-3 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg transition"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}

export default PerformanceSummary;
