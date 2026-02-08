/**
 * Profile Editor Component
 * 
 * Allows users to augment their profile data
 * Each completed section awards fame points
 * Shows completion percentage and available bonuses
 */

import React, { useState, useEffect } from 'react';
import { useFameManagement } from '@/hooks/useFameManagement';
import { PROFILE_AUGMENTATION, MUSIC_GENRES } from '@/lib/fameConstants';
import { doc, getDoc, updateDoc } from '@/lib/firebase';
import { db } from '@/lib/firebase';

export function ProfileEditor({ uid, onProfileUpdate }) {
  const [profile, setProfile] = useState({
    bio: '',
    pronouns: '',
    favoriteGenre: '',
    musicPreferences: [],
    socialLinks: {},
    recordLabel: '',
    profilePictureUrl: null
  });

  const [augmentation, setAugmentation] = useState({});
  const [loading, setLoading] = useState(false);
  const [completionPercentage, setCompletionPercentage] = useState(0);
  const { awardAugmentationBonus } = useFameManagement(uid);

  // Load current profile data
  useEffect(() => {
    if (!uid) return;

    const loadProfile = async () => {
      try {
        const userRef = doc(db, 'users', uid);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
          const data = userSnap.data();
          setProfile(data.profile || {});
          setAugmentation(data.augmentationBonuses || {});
          setCompletionPercentage(data.profile?.profileCompletion || 0);
        }
      } catch (err) {
        console.error('Error loading profile:', err);
      }
    };

    loadProfile();
  }, [uid]);

  const handleBioChange = (e) => {
    setProfile(prev => ({ ...prev, bio: e.target.value }));
  };

  const handlePronounsChange = (e) => {
    setProfile(prev => ({ ...prev, pronouns: e.target.value }));
  };

  const handleFavoriteGenreChange = (e) => {
    setProfile(prev => ({ ...prev, favoriteGenre: e.target.value }));
  };

  const handleMusicPreferencesToggle = (genre) => {
    setProfile(prev => ({
      ...prev,
      musicPreferences: prev.musicPreferences.includes(genre)
        ? prev.musicPreferences.filter(g => g !== genre)
        : [...prev.musicPreferences, genre]
    }));
  };

  const handleRecordLabelChange = (e) => {
    setProfile(prev => ({ ...prev, recordLabel: e.target.value }));
  };

  const handleProfilePictureUpload = (e) => {
    // TODO: Implement image upload to Firebase Storage
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfile(prev => ({ ...prev, profilePictureUrl: reader.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const saveProfile = async () => {
    if (!uid) return;

    setLoading(true);
    try {
      const userRef = doc(db, 'users', uid);
      
      // Calculate completion percentage
      let completionCount = 0;
      if (profile.bio) completionCount++;
      if (profile.pronouns) completionCount++;
      if (profile.favoriteGenre) completionCount++;
      if (profile.musicPreferences.length >= 5) completionCount++;
      if (Object.keys(profile.socialLinks).length > 0) completionCount++;
      if (profile.recordLabel) completionCount++;

      const newCompletion = Math.round((completionCount / 6) * 100);

      await updateDoc(userRef, {
        profile: {
          ...profile,
          profileCompletion: newCompletion
        }
      });

      setCompletionPercentage(newCompletion);
      onProfileUpdate?.();
    } catch (err) {
      console.error('Error saving profile:', err);
    } finally {
      setLoading(false);
    }
  };

  const awardBonus = async (augmentationType) => {
    if (augmentation[augmentationType]) {
      alert('Bonus already claimed for this item!');
      return;
    }

    const result = await awardAugmentationBonus(augmentationType);
    
    if (result.success) {
      setAugmentation(prev => ({ ...prev, [augmentationType]: true }));
      alert(`+${PROFILE_AUGMENTATION[augmentationType].fameBonus} Fame Points! Total: ${result.totalFame}`);
    } else {
      alert(`Error: ${result.error}`);
    }
  };

  const bioComplete = profile.bio?.length >= 50;
  const musicPreferencesComplete = profile.musicPreferences.length >= 5;

  return (
    <div className="max-w-2xl mx-auto p-6 bg-gradient-to-br from-slate-900 to-slate-800 rounded-lg text-white">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">👤 Enhance Your Profile</h1>
        <p className="text-gray-400">Complete your profile to earn Fame Points and unlock rewards</p>
      </div>

      {/* Progress Bar */}
      <div className="mb-6 p-4 bg-slate-700 bg-opacity-50 rounded-lg">
        <div className="flex justify-between items-center mb-2">
          <span className="font-semibold">Profile Completion</span>
          <span className="text-lg font-bold text-purple-400">{completionPercentage}%</span>
        </div>
        <div className="w-full h-3 bg-slate-600 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-purple-500 to-blue-500 transition-all duration-500"
            style={{ width: `${completionPercentage}%` }}
          />
        </div>
      </div>

      {/* Profile Sections */}
      <div className="space-y-6">
        {/* Profile Picture */}
        <div className="bg-slate-700 bg-opacity-30 rounded-lg p-4 border border-slate-600">
          <div className="flex justify-between items-start mb-3">
            <div>
              <h3 className="text-lg font-semibold">📸 Profile Picture</h3>
              <p className="text-sm text-gray-400">Upload your avatar</p>
            </div>
            <div className={`text-sm font-semibold px-2 py-1 rounded ${
              augmentation.profilePicture 
                ? 'bg-green-500 bg-opacity-20 text-green-300' 
                : 'bg-blue-500 bg-opacity-20 text-blue-300'
            }`}>
              {augmentation.profilePicture ? '✓ Claimed' : `+${PROFILE_AUGMENTATION.profilePicture.fameBonus} pts`}
            </div>
          </div>
          <input 
            type="file" 
            accept="image/*"
            onChange={handleProfilePictureUpload}
            className="w-full text-sm"
          />
        </div>

        {/* Bio */}
        <div className="bg-slate-700 bg-opacity-30 rounded-lg p-4 border border-slate-600">
          <div className="flex justify-between items-start mb-3">
            <div>
              <h3 className="text-lg font-semibold">✍️ Bio</h3>
              <p className="text-sm text-gray-400">Tell us about yourself (50+ characters)</p>
            </div>
            <button
              onClick={() => bioComplete && !augmentation.bio && awardBonus('bio')}
              disabled={!bioComplete || augmentation.bio}
              className={`text-sm font-semibold px-3 py-1 rounded transition ${
                augmentation.bio 
                  ? 'bg-green-500 bg-opacity-20 text-green-300 cursor-not-allowed' 
                  : bioComplete
                  ? 'bg-blue-500 hover:bg-blue-600 text-white cursor-pointer'
                  : 'bg-gray-600 text-gray-400 cursor-not-allowed'
              }`}
            >
              {augmentation.bio ? '✓ Claimed' : `+${PROFILE_AUGMENTATION.bio.fameBonus} pts`}
            </button>
          </div>
          <textarea 
            value={profile.bio || ''}
            onChange={handleBioChange}
            placeholder="Write something interesting about yourself..."
            className="w-full p-3 bg-slate-600 rounded text-white text-sm"
            rows="3"
          />
          <div className="text-xs text-gray-500 mt-2">
            {profile.bio?.length || 0}/50 characters {bioComplete && '✓'}
          </div>
        </div>

        {/* Pronouns */}
        <div className="bg-slate-700 bg-opacity-30 rounded-lg p-4 border border-slate-600">
          <div className="flex justify-between items-start mb-3">
            <div>
              <h3 className="text-lg font-semibold">👥 Pronouns</h3>
              <p className="text-sm text-gray-400">How would you like to be referred to?</p>
            </div>
            <button
              onClick={() => profile.pronouns && !augmentation.pronouns && awardBonus('pronouns')}
              disabled={!profile.pronouns || augmentation.pronouns}
              className={`text-sm font-semibold px-3 py-1 rounded transition ${
                augmentation.pronouns 
                  ? 'bg-green-500 bg-opacity-20 text-green-300 cursor-not-allowed' 
                  : profile.pronouns
                  ? 'bg-blue-500 hover:bg-blue-600 text-white cursor-pointer'
                  : 'bg-gray-600 text-gray-400 cursor-not-allowed'
              }`}
            >
              {augmentation.pronouns ? '✓ Claimed' : `+${PROFILE_AUGMENTATION.pronouns.fameBonus} pts`}
            </button>
          </div>
          <input 
            type="text" 
            value={profile.pronouns || ''}
            onChange={handlePronounsChange}
            placeholder="e.g., they/them, she/her, he/him"
            className="w-full p-3 bg-slate-600 rounded text-white text-sm"
          />
        </div>

        {/* Favorite Genre */}
        <div className="bg-slate-700 bg-opacity-30 rounded-lg p-4 border border-slate-600">
          <div className="flex justify-between items-start mb-3">
            <div>
              <h3 className="text-lg font-semibold">🎵 Favorite Genre</h3>
              <p className="text-sm text-gray-400">What's your go-to music style?</p>
            </div>
            <button
              onClick={() => profile.favoriteGenre && !augmentation.favoriteGenre && awardBonus('favoriteGenre')}
              disabled={!profile.favoriteGenre || augmentation.favoriteGenre}
              className={`text-sm font-semibold px-3 py-1 rounded transition ${
                augmentation.favoriteGenre 
                  ? 'bg-green-500 bg-opacity-20 text-green-300 cursor-not-allowed' 
                  : profile.favoriteGenre
                  ? 'bg-blue-500 hover:bg-blue-600 text-white cursor-pointer'
                  : 'bg-gray-600 text-gray-400 cursor-not-allowed'
              }`}
            >
              {augmentation.favoriteGenre ? '✓ Claimed' : `+${PROFILE_AUGMENTATION.favoriteGenre.fameBonus} pts`}
            </button>
          </div>
          <select 
            value={profile.favoriteGenre || ''}
            onChange={handleFavoriteGenreChange}
            className="w-full p-3 bg-slate-600 rounded text-white text-sm"
          >
            <option value="">Select a genre...</option>
            {MUSIC_GENRES.map(genre => (
              <option key={genre} value={genre}>{genre}</option>
            ))}
          </select>
        </div>

        {/* Music Preferences */}
        <div className="bg-slate-700 bg-opacity-30 rounded-lg p-4 border border-slate-600">
          <div className="flex justify-between items-start mb-3">
            <div>
              <h3 className="text-lg font-semibold">🎸 Music Preferences</h3>
              <p className="text-sm text-gray-400">Select 5+ genres you enjoy</p>
            </div>
            <button
              onClick={() => musicPreferencesComplete && !augmentation.musicPreferences && awardBonus('musicPreferences')}
              disabled={!musicPreferencesComplete || augmentation.musicPreferences}
              className={`text-sm font-semibold px-3 py-1 rounded transition ${
                augmentation.musicPreferences 
                  ? 'bg-green-500 bg-opacity-20 text-green-300 cursor-not-allowed' 
                  : musicPreferencesComplete
                  ? 'bg-blue-500 hover:bg-blue-600 text-white cursor-pointer'
                  : 'bg-gray-600 text-gray-400 cursor-not-allowed'
              }`}
            >
              {augmentation.musicPreferences ? '✓ Claimed' : `+${PROFILE_AUGMENTATION.musicPreferences.fameBonus} pts`}
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {MUSIC_GENRES.map(genre => (
              <label key={genre} className="flex items-center gap-2 cursor-pointer hover:bg-slate-600 p-2 rounded">
                <input 
                  type="checkbox"
                  checked={profile.musicPreferences.includes(genre)}
                  onChange={() => handleMusicPreferencesToggle(genre)}
                  className="w-4 h-4"
                />
                <span className="text-sm">{genre}</span>
              </label>
            ))}
          </div>
          <div className="text-xs text-gray-500 mt-2">
            {profile.musicPreferences.length}/5+ selected {musicPreferencesComplete && '✓'}
          </div>
        </div>

        {/* Record Label / Artist Name */}
        <div className="bg-slate-700 bg-opacity-30 rounded-lg p-4 border border-slate-600">
          <div className="flex justify-between items-start mb-3">
            <div>
              <h3 className="text-lg font-semibold">🎤 Record Label / Artist Name</h3>
              <p className="text-sm text-gray-400">Your artist or label name</p>
            </div>
            <button
              onClick={() => profile.recordLabel && !augmentation.recordLabel && awardBonus('recordLabel')}
              disabled={!profile.recordLabel || augmentation.recordLabel}
              className={`text-sm font-semibold px-3 py-1 rounded transition ${
                augmentation.recordLabel 
                  ? 'bg-green-500 bg-opacity-20 text-green-300 cursor-not-allowed' 
                  : profile.recordLabel
                  ? 'bg-blue-500 hover:bg-blue-600 text-white cursor-pointer'
                  : 'bg-gray-600 text-gray-400 cursor-not-allowed'
              }`}
            >
              {augmentation.recordLabel ? '✓ Claimed' : `+${PROFILE_AUGMENTATION.recordLabel.fameBonus} pts`}
            </button>
          </div>
          <input 
            type="text" 
            value={profile.recordLabel || ''}
            onChange={handleRecordLabelChange}
            placeholder="Your stage name or label..."
            className="w-full p-3 bg-slate-600 rounded text-white text-sm"
          />
        </div>

        {/* Total Possible Bonus */}
        <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg p-4 mt-6">
          <div className="text-sm text-purple-200 mb-1">Potential Fame Points</div>
          <div className="text-2xl font-bold text-white">
            +{PROFILE_AUGMENTATION.profilePicture.fameBonus + PROFILE_AUGMENTATION.bio.fameBonus + PROFILE_AUGMENTATION.musicPreferences.fameBonus + PROFILE_AUGMENTATION.pronouns.fameBonus + PROFILE_AUGMENTATION.favoriteGenre.fameBonus + PROFILE_AUGMENTATION.recordLabel.fameBonus} points
          </div>
          <div className="text-xs text-purple-100 mt-1">
            Earn by completing all profile sections
          </div>
        </div>
      </div>

      {/* Save Button */}
      <button
        onClick={saveProfile}
        disabled={loading}
        className="w-full mt-6 px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-bold rounded-lg transition disabled:opacity-50"
      >
        {loading ? 'Saving...' : '💾 Save Profile'}
      </button>
    </div>
  );
}

export default ProfileEditor;
