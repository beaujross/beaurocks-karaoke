/**
 * Fame Points Calculator
 * 
 * Pure functions for calculating and awarding fame points
 * No side effects - safe to use in game loops
 */

import { FAME_CALCULATION } from './fameConstants.js';

/**
 * Convert decibel reading to fame score points
 * 
 * @param {number} peakDecibel - Peak decibel level detected (0-140)
 * @returns {number} Fame score points (0-100)
 */
export function calculateDecibelScore(peakDecibel) {
    const { decibelMinimum, decibelMaximum, decibelScoreCap } = FAME_CALCULATION;
    
    // Clamp to valid range
    const clamped = Math.max(decibelMinimum, Math.min(decibelMaximum, peakDecibel));
    
    // Linear interpolation from min to max decibels → 0 to decibelScoreCap
    const score = ((clamped - decibelMinimum) / (decibelMaximum - decibelMinimum)) * decibelScoreCap;
    
    return Math.round(score);
}

/**
 * Calculate total fame points from a performance
 * 
 * Formula: Fame = HypePoints + DecibelScore + (HypePoints × HostBonus)
 * NO VIP multipliers (skill-based only - fair for all players)
 * 
 * @param {object} performanceData
 * @param {number} performanceData.hypePoints - Points from game (required)
 * @param {number} performanceData.peakDecibel - Peak decibel during performance (default: 65)
 * @param {number} performanceData.hostBonus - Multiplier from host (default: 1.0)
 * @returns {number} Total fame points awarded
 * 
 * @example
 * const fame = calculateFamePoints({
 *   hypePoints: 150,
 *   peakDecibel: 85,
 *   hostBonus: 1.5
 * });
 * // Returns: 475
 */
export function calculateFamePoints(performanceData) {
    const {
        hypePoints = 0,
        peakDecibel = 65,
        hostBonus = 1.0
    } = performanceData;
    
    // Validate inputs
    const hype = Math.max(0, Math.round(hypePoints));
    const hostMult = Math.max(0.5, Math.min(3.0, hostBonus)); // Clamp 0.5x - 3.0x
    
    // Calculate components
    const decibelScore = calculateDecibelScore(peakDecibel);
    const hostBonusPoints = Math.round(hype * hostMult);
    
    // Total: hype + decibel + host bonus (NO VIP multiplier - fair for all)
    const totalFame = hype + decibelScore + hostBonusPoints;
    
    return Math.round(totalFame);
}

/**
 * Get detailed breakdown of fame calculation
 * Useful for showing to players after performance
 * 
 * @returns {object} Detailed breakdown with all components
 */
export function calculateFamePointsDetailed(performanceData) {
    const {
        hypePoints = 0,
        peakDecibel = 65,
        hostBonus = 1.0
    } = performanceData;
    
    const hype = Math.max(0, Math.round(hypePoints));
    const hostMult = Math.max(0.5, Math.min(3.0, hostBonus));
    
    const decibelScore = calculateDecibelScore(peakDecibel);
    const hostBonusPoints = Math.round(hype * hostMult);
    
    // NO VIP multiplier applied - skill-based progression for all
    const totalFame = hype + decibelScore + hostBonusPoints;
    
    return {
        // Input components
        hypePoints: hype,
        peakDecibel: Math.round(peakDecibel * 10) / 10,
        decibelScore,
        hostBonus: hostMult,
        hostBonusPoints,
        
        // Calculation steps
        baseCalculation: {
            formula: "Hype + Decibel + (Hype × Host Bonus)",
            hype,
            decibel: decibelScore,
            hostBonus: hostBonusPoints,
            subtotal: totalFame
        },
        
        // Result
        totalFameAwarded: totalFame,
        breakdown: `${hype}(hype) + ${decibelScore}(decibel) + ${hostBonusPoints}(host) = ${totalFame}`
    };
}

/**
 * Simulate fame calculation for testing/display
 * Useful for showing players what they could earn
 */
export function simulateFamePoints(hypeEstimate, decibelEstimate, hostBonus) {
    return calculateFamePoints({
        hypePoints: hypeEstimate,
        peakDecibel: decibelEstimate,
        hostBonus
    });
}

/**
 * Format fame breakdown for display
 */
export function formatFameBreakdown(breakdown) {
    return {
        displayText: breakdown.breakdown,
        hypeLabel: `Hype Points: ${breakdown.hypePoints}`,
        decibelLabel: `Decibel Score: ${breakdown.decibelScore} (${breakdown.peakDecibel}dB)`,
        hostBonusLabel: `Host Bonus: ×${breakdown.hostBonus.toFixed(1)} (+${breakdown.hostBonusPoints})`,
        totalLabel: `Total Fame: ${breakdown.totalFameAwarded}`
    };
}

/**
 * Calculate cumulative fame needed to reach a level
 */
export function calculateFameCumulativeToLevel(targetLevel) {
    let total = 0;
    for (let level = 0; level < targetLevel; level++) {
        const next = FAME_LEVELS?.[level + 1]?.minFame ?? Infinity;
        total = next;
    }
    return total;
}

// Import for use in calculations
import { FAME_LEVELS } from './fameConstants.js';
