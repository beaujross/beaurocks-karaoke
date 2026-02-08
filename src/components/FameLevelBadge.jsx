/**
 * Fame Level Badge Component
 * 
 * Displays player's current fame level with styling
 * Used in lobbies, player cards, leaderboards
 */

import React from 'react';
import { FAME_LEVELS } from '../lib/fameConstants';

export function FameLevelBadge({ 
  level = 0, 
  size = 'md',
  showName = true,
  showPoints = false,
  totalPoints = 0,
  animated = true 
}) {
  const levelData = FAME_LEVELS[level] || FAME_LEVELS[0];
  
  const sizeClasses = {
    xs: 'w-8 h-8 text-xs',
    sm: 'w-10 h-10 text-sm',
    md: 'w-12 h-12 text-base',
    lg: 'w-16 h-16 text-lg',
    xl: 'w-20 h-20 text-2xl'
  };

  const containerClass = `
    flex items-center justify-center rounded-full font-bold
    ${sizeClasses[size]}
    ${animated && 'transition-all duration-300'}
  `;

  // Create gradient background based on level
  const getGradient = (lv) => {
    if (lv === 20) return 'from-yellow-400 to-yellow-600'; // Gold for max
    if (lv >= 15) return 'from-red-400 to-red-600';
    if (lv >= 10) return 'from-purple-400 to-purple-600';
    if (lv >= 5) return 'from-amber-400 to-amber-600';
    return 'from-gray-400 to-gray-600';
  };

  return (
    <div className="flex items-center gap-2">
      <div className={`bg-gradient-to-br ${getGradient(level)} ${containerClass} text-white shadow-lg`}>
        {level}
      </div>
      {showName && size !== 'xs' && (
        <div className="flex flex-col">
          <span className="font-semibold text-sm truncate">{levelData.name}</span>
          {showPoints && (
            <span className="text-xs text-gray-600">{totalPoints} pts</span>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Larger Fame Card Component
 * Shows level, progress bar, and rewards
 */
export function FameLevelCard({ level = 0, totalPoints = 0, progressToNext = 0 }) {
  const currentLevel = FAME_LEVELS[level] || FAME_LEVELS[0];
  const nextLevel = level < 20 ? FAME_LEVELS[level + 1] : null;

  return (
    <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-lg p-6 text-white shadow-lg">
      {/* Level Display */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center text-3xl font-bold">
            {level}
          </div>
          <div>
            <h2 className="text-2xl font-bold">{currentLevel.name}</h2>
            <p className="text-gray-300 text-sm">{currentLevel.description}</p>
          </div>
        </div>
      </div>

      {/* Points Info */}
      <div className="mb-4 p-3 bg-slate-700 bg-opacity-50 rounded">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-gray-300">Total Fame Points</span>
          <span className="font-semibold">{totalPoints}</span>
        </div>
      </div>

      {/* Progress Bar */}
      {nextLevel && (
        <div className="mb-4">
          <div className="flex justify-between text-xs mb-2">
            <span className="text-gray-300">Progress to {nextLevel.name}</span>
            <span className="font-semibold">{progressToNext}%</span>
          </div>
          <div className="w-full bg-slate-700 rounded-full h-3 overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-500"
              style={{ width: `${progressToNext}%` }}
            />
          </div>
        </div>
      )}

      {/* Current Reward */}
      <div className="text-xs text-amber-300">
        <span className="font-semibold">Reward:</span> {currentLevel.reward}
      </div>

      {/* Max Level */}
      {level === 20 && (
        <div className="mt-4 p-3 bg-gradient-to-r from-yellow-500 to-orange-500 rounded text-sm font-bold text-center">
          🏆 ULTIMATE LEGEND - MAX LEVEL REACHED
        </div>
      )}
    </div>
  );
}

/**
 * Progress Bar for Fame Level
 * Compact inline version
 */
export function FameLevelProgressBar({ level = 0, progressToNext = 0, showLabel = true }) {
  const currentLevel = FAME_LEVELS[level] || FAME_LEVELS[0];
  const nextLevel = level < 20 ? FAME_LEVELS[level + 1] : null;

  if (!nextLevel) {
    return (
      <div className="space-y-1">
        {showLabel && <p className="text-xs font-semibold text-gray-600">Max Level</p>}
        <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
          <div className="w-full h-full bg-gradient-to-r from-yellow-400 to-yellow-600" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {showLabel && (
        <p className="text-xs font-semibold text-gray-600">
          {currentLevel.name} → {nextLevel.name} ({progressToNext}%)
        </p>
      )}
      <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
        <div 
          className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-500"
          style={{ width: `${progressToNext}%` }}
        />
      </div>
    </div>
  );
}

export default FameLevelBadge;
