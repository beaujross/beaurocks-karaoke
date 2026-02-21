/**
 * Performance Summary Component
 *
 * Shows detailed score breakdown after game performance.
 * Displays hype points, vocal score, host bonus, and total fame.
 * Includes level-up animation when applicable.
 */

import React, { useEffect, useState } from 'react';
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
  const activeLevel = typeof newLevel === 'number' ? newLevel : previousLevel;
  const activeLevelMeta = FAME_LEVELS[activeLevel] || {};
  const peakDbLabel = typeof breakdown?.peakDecibel === 'number'
    ? `${breakdown.peakDecibel.toFixed(1)} dB`
    : '--';
  const hostBonus = typeof breakdown?.hostBonus === 'number' ? breakdown.hostBonus : 1;

  useEffect(() => {
    if (levelUpOccurred) {
      const timer = setTimeout(() => setShowLevelUpAnimation(true), 500);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [levelUpOccurred]);

  const handleDismiss = () => {
    if (levelUpCallback) levelUpCallback({ previousLevel, newLevel });
    onDismiss?.();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl max-h-[88vh] overflow-y-auto rounded-[28px] border border-cyan-300/30 bg-gradient-to-br from-[#160f26]/95 via-[#101a2b]/95 to-[#0b111d]/95 shadow-[0_30px_85px_rgba(0,0,0,0.62),0_0_48px_rgba(236,72,153,0.16)]">
        <div className="px-6 py-4 border-b border-cyan-400/20 bg-gradient-to-r from-[#0b1e33]/90 via-[#111d33]/90 to-[#2a1431]/85 flex items-center justify-between">
          <h1 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#00C4D9] via-[#8beaf5] to-[#EC4899]">
            Performance Summary
          </h1>
          <button
            onClick={handleDismiss}
            className="rounded-full border border-cyan-300/35 bg-cyan-500/10 px-3 py-1 text-cyan-100 hover:border-pink-300/55 hover:bg-cyan-500/20 transition-colors"
          >
            Close
          </button>
        </div>

        <div className="p-6 space-y-6 text-white">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-xl border border-cyan-400/25 bg-[#0a1325]/78 p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-cyan-100/60 mb-2">Hype Points</div>
              <div className="text-3xl font-black text-cyan-300">{breakdown?.hypePoints || 0}</div>
            </div>

            <div className="rounded-xl border border-pink-400/25 bg-[#161025]/76 p-4">
              <div className="flex justify-between items-center mb-2">
                <div className="text-xs uppercase tracking-[0.2em] text-fuchsia-100/60">Vocal Power</div>
                <div className="text-sm font-semibold text-fuchsia-100">{peakDbLabel}</div>
              </div>
              <div className="text-3xl font-black text-pink-300">{breakdown?.decibelScore || 0}</div>
              <div className="text-xs text-fuchsia-100/60 mt-2">Score from vocal intensity</div>
            </div>

            <div className="rounded-xl border border-emerald-400/30 bg-[#0f1e1d]/76 p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-emerald-100/70 mb-2">Host Bonus</div>
              <div className="text-3xl font-black text-emerald-300">x{hostBonus.toFixed(1)}</div>
              <div className="text-xs text-emerald-300 mt-2">+{breakdown?.hostBonusPoints || 0} points</div>
            </div>
          </div>

          <div className="rounded-xl border border-cyan-300/35 bg-gradient-to-r from-[#00C4D9]/20 via-[#1f4d6c]/18 to-[#EC4899]/22 p-4">
            <div className="text-sm uppercase tracking-[0.2em] text-cyan-100/80 mb-2">Total Fame Awarded</div>
            <div className="flex items-baseline justify-between">
              <div className="text-4xl font-black text-white">{breakdown?.totalFameAwarded || 0}</div>
              <div className="text-lg text-cyan-100/85 font-semibold">Fame Points</div>
            </div>
          </div>

          {showLevelUpAnimation && levelUpOccurred && (
            <div className="rounded-xl border border-yellow-300/45 bg-gradient-to-r from-[#7f4204]/80 via-[#9a3c08]/80 to-[#8b183a]/80 p-6 text-center animate-pulse shadow-[0_0_30px_rgba(250,204,21,0.22)]">
              <div className="text-[11px] uppercase tracking-[0.28em] text-yellow-100/80 mb-3">Milestone</div>
              <h2 className="text-3xl font-bold text-white mb-2">LEVEL UP!</h2>
              <div className="flex items-center justify-center gap-4 mt-4">
                <div className="text-center">
                  <div className="text-yellow-100/80 text-sm font-semibold">Previous</div>
                  <div className="text-2xl font-bold text-white">{previousLevel}</div>
                </div>
                <div className="text-3xl text-white">-&gt;</div>
                <div className="text-center">
                  <div className="text-yellow-100/80 text-sm font-semibold">New Level</div>
                  <div className="text-4xl font-bold text-white bg-yellow-300/30 px-4 py-2 rounded-lg">{newLevel}</div>
                </div>
              </div>

              {FAME_LEVELS[newLevel]?.unlock && (
                <div className="mt-4 p-3 bg-black/30 rounded-lg text-white">
                  <div className="text-sm text-yellow-200 font-semibold">Unlock</div>
                  <div className="text-lg font-bold mt-1">{FAME_LEVELS[newLevel].unlock}</div>
                </div>
              )}

              <div className="mt-4 space-y-2 text-white">
                <div>
                  <span className="font-semibold text-lg">{FAME_LEVELS[newLevel]?.name}</span>
                </div>
                <div className="text-sm">Reward: {FAME_LEVELS[newLevel]?.reward}</div>
              </div>
            </div>
          )}

          <div className="rounded-xl border border-cyan-400/25 bg-[#0a1325]/78 p-4">
            <div className="text-sm text-cyan-100/70 mb-3">Your Fame Status</div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
              <div className="rounded-lg border border-cyan-400/20 bg-black/20 px-3 py-2">
                <div className="text-cyan-100/60">Current Level</div>
                <div className="text-xl font-bold text-white">{activeLevel}</div>
              </div>
              <div className="rounded-lg border border-fuchsia-300/20 bg-black/20 px-3 py-2">
                <div className="text-cyan-100/60">Total Points</div>
                <div className="text-xl font-bold text-pink-300">{totalPoints}</div>
              </div>
              <div className="rounded-lg border border-emerald-300/20 bg-black/20 px-3 py-2">
                <div className="text-cyan-100/60">{activeLevelMeta?.name || 'Fame Tier'}</div>
                <div className="text-sm text-cyan-100/75 mt-1">
                  {activeLevelMeta?.description || 'Keep singing to unlock more rewards.'}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-cyan-400/20 p-4 flex gap-3">
          <button
            onClick={handleDismiss}
            className="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-[#00C4D9] via-[#4ed8ea] to-[#EC4899] text-black font-black uppercase tracking-[0.16em] transition-transform active:scale-[0.98]"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}

export default PerformanceSummary;
