/**
 * Hook for Managing Fame Points & Levels
 * 
 * Handles awarding points, checking level-ups, and syncing with Firestore
 */

import { useCallback, useState } from 'react';
import {
  db,
  doc,
  updateDoc,
  getDoc,
  serverTimestamp
} from '@/lib/firebase';
import {
  calculateFamePoints,
  calculateFamePointsDetailed
} from '@/lib/fameCalculator';
import {
  getLevelFromFame,
  getProgressToNextLevel,
  PROFILE_AUGMENTATION
} from '@/lib/fameConstants';

export function useFameManagement(uid) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [levelUpData, setLevelUpData] = useState(null);

  /**
   * Award fame points for a performance
   * Handles level-ups and fires events
   */
  const awardPerformancePoints = useCallback(async (performanceData) => {
    if (!uid) {
      setError('No user ID');
      return { success: false };
    }

    setLoading(true);
    setError(null);

    try {
      const userRef = doc(db, 'users', uid);
      const userSnap = await getDoc(userRef);
      
      if (!userSnap.exists()) {
        throw new Error('User profile not found');
      }

      const userData = userSnap.data();
      const currentTotalFame = userData.totalFamePoints || 0;
      const currentLevel = userData.currentLevel || 0;

      // Calculate new fame points
      const fameToAward = calculateFamePoints(performanceData);
      const newTotalFame = currentTotalFame + fameToAward;
      const newLevel = getLevelFromFame(newTotalFame);
      const leveledUp = newLevel > currentLevel;

      // Get detailed breakdown for display
      const breakdown = calculateFamePointsDetailed(performanceData);

      // Prepare update
      const updates = {
        totalFamePoints: newTotalFame,
        currentLevel: newLevel,
        levelProgress: getProgressToNextLevel(newTotalFame, newLevel),
        lastPerformanceScore: {
          gameType: performanceData.gameType,
          hypePoints: performanceData.hypePoints || 0,
          decibelScore: breakdown.decibelScore,
          hostBonus: performanceData.hostBonus || 1.0,
          totalFame: fameToAward,
          timestamp: serverTimestamp(),
          levelUpOccurred: leveledUp,
          previousLevel: currentLevel,
          newLevel: newLevel
        }
      };

      // If leveled up, add to unlockedBadges if there's a special unlock
      if (leveledUp && newLevel > 0) {
        const levelData = await import('@/lib/fameConstants').then(m => m.FAME_LEVELS[newLevel]);
        if (levelData?.unlock) {
          updates.unlockedBadges = [
            ...(userData.unlockedBadges || []),
            { level: newLevel, unlock: levelData.unlock, timestamp: serverTimestamp() }
          ];
        }
      }

      // Update Firestore
      await updateDoc(userRef, updates);

      setLevelUpData(leveledUp ? { previousLevel: currentLevel, newLevel } : null);

      setLoading(false);
      return {
        success: true,
        fameAwarded: fameToAward,
        totalFame: newTotalFame,
        leveledUp,
        previousLevel: currentLevel,
        newLevel,
        breakdown
      };
    } catch (err) {
      console.error('Error awarding fame points:', err);
      setError(err.message);
      setLoading(false);
      return { success: false, error: err.message };
    }
  }, [uid]);

  /**
   * Award profile augmentation bonus
   * Called when user completes profile sections
   */
  const awardAugmentationBonus = useCallback(async (augmentationType) => {
    if (!uid) {
      setError('No user ID');
      return { success: false };
    }

    setLoading(true);
    setError(null);

    try {
      const userRef = doc(db, 'users', uid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        throw new Error('User profile not found');
      }

      const userData = userSnap.data();
      const augmentation = PROFILE_AUGMENTATION[augmentationType];

      if (!augmentation) {
        throw new Error(`Unknown augmentation type: ${augmentationType}`);
      }

      // Check if already awarded
      if (userData.augmentationBonuses?.[augmentationType] && augmentation.once) {
        throw new Error(`Bonus already awarded for ${augmentationType}`);
      }

      // Award the bonus
      const currentTotalFame = userData.totalFamePoints || 0;
      const currentLevel = userData.currentLevel || 0;
      const newTotalFame = currentTotalFame + augmentation.fameBonus;
      const newLevel = getLevelFromFame(newTotalFame);
      const leveledUp = newLevel > currentLevel;

      const updates = {
        totalFamePoints: newTotalFame,
        currentLevel: newLevel,
        levelProgress: getProgressToNextLevel(newTotalFame, newLevel),
        [`augmentationBonuses.${augmentationType}`]: true,
        lastPerformanceScore: {
          gameType: 'profile_augmentation',
          hypePoints: 0,
          decibelScore: 0,
          hostBonus: 1.0,
          totalFame: augmentation.fameBonus,
          timestamp: serverTimestamp(),
          levelUpOccurred: leveledUp,
          previousLevel: currentLevel,
          newLevel: newLevel
        }
      };

      if (leveledUp) {
        const levelData = await import('@/lib/fameConstants').then(m => m.FAME_LEVELS[newLevel]);
        if (levelData?.unlock) {
          updates.unlockedBadges = [
            ...(userData.unlockedBadges || []),
            { level: newLevel, unlock: levelData.unlock, timestamp: serverTimestamp() }
          ];
        }
      }

      await updateDoc(userRef, updates);

      setLevelUpData(leveledUp ? { previousLevel: currentLevel, newLevel } : null);

      setLoading(false);
      return {
        success: true,
        bonusAwarded: augmentation.fameBonus,
        totalFame: newTotalFame,
        leveledUp,
        previousLevel: currentLevel,
        newLevel
      };
    } catch (err) {
      console.error('Error awarding augmentation bonus:', err);
      setError(err.message);
      setLoading(false);
      return { success: false, error: err.message };
    }
  }, [uid]);

  /**
   * Update VIP subscription tier and apply multiplier
   */
  /**
   * Update subscription tier (used when user purchases HOST or HOST Plus)
   * Tier options: 'free', 'vip', 'host', 'host_plus'
   */
  const updateSubscriptionTier = useCallback(async (tier, plan = 'monthly') => {
    if (!uid) {
      setError('No user ID');
      return { success: false };
    }

    setLoading(true);
    setError(null);

    try {
      const userRef = doc(db, 'users', uid);
      const now = new Date();
      
      // Calculate renewal date based on plan
      let renewalDate = null;
      if (plan === 'monthly') {
        renewalDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      } else if (plan === 'yearly') {
        renewalDate = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
      }

      const updates = {
        'subscription.tier': tier,
        'subscription.plan': plan,
        'subscription.startDate': serverTimestamp(),
        'subscription.renewalDate': renewalDate
      };

      await updateDoc(userRef, updates);

      setLoading(false);
      return { success: true };
    } catch (err) {
      console.error('Error updating subscription tier:', err);
      setError(err.message);
      setLoading(false);
      return { success: false, error: err.message };
    }
  }, [uid]);

  /**
   * Get current fame data for user
   */
  const getFameData = useCallback(async () => {
    if (!uid) return null;

    try {
      const userRef = doc(db, 'users', uid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) return null;

      const data = userSnap.data();
      return {
        totalFamePoints: data.totalFamePoints || 0,
        currentLevel: data.currentLevel || 0,
        levelProgress: data.levelProgress || 0,
        unlockedBadges: data.unlockedBadges || [],
        subscription: data.subscription || { tier: 'free' },
        lastPerformance: data.lastPerformanceScore || null
      };
    } catch (err) {
      console.error('Error getting fame data:', err);
      return null;
    }
  }, [uid]);

  return {
    loading,
    error,
    levelUpData,
    awardPerformancePoints,
    awardAugmentationBonus,
    updateSubscriptionTier,
    getFameData
  };
}

export default useFameManagement;
