const assert = require('node:assert/strict');

const { resolveAppleLyrics } = require('../../functions/lib/lyrics/providers/appleProvider');
const { resolveLyricsForSong } = require('../../functions/lib/lyrics/resolveLyricsForSong');

const buildDeps = ({ musicUserTokenExpected = '' } = {}) => {
  const fetchImpl = async (url, options = {}) => {
    if (url.includes('/search?')) {
      return {
        ok: true,
        json: async () => ({
          results: {
            songs: {
              data: [{
                id: 'apple-song-1',
                attributes: { name: 'Test Song', artistName: 'Test Artist' },
              }],
            },
          },
        }),
      };
    }
    assert.equal(options.headers['Music-User-Token'] || '', musicUserTokenExpected);
    return {
      ok: false,
      status: 400,
      text: async () => JSON.stringify({
        errors: [{ code: '40012', title: 'Insufficient Privileges' }],
      }),
    };
  };
  return {
    fetchImpl,
    getAppleMusicToken: () => 'developer-token',
    parseTtml: () => [],
    normalizeLyricsText: (value) => String(value || '').trim(),
    normalizeTimedLyrics: (value) => Array.isArray(value) ? value : [],
    db: {
      collection: () => ({
        doc: () => ({
          get: async () => ({ exists: false }),
        }),
      }),
    },
    buildSongKey: () => 'canonical-song-1',
    timedAdapterEnabled: false,
    resolveTimedLyrics: null,
    fetchAiLyricsFallbackText: async () => null,
  };
};

test('Apple lyrics code 40012 requests host authorization when no Music User Token is present', async () => {
  const result = await resolveAppleLyrics({
    title: 'Test Song',
    artist: 'Test Artist',
  }, buildDeps());

  assert.equal(result.resolution, 'apple_needs_user_token');
  assert.equal(result.needsUserToken, true);
  assert.equal(result.accessDenied, false);
});

test('Apple lyrics code 40012 is a provider permission denial after host authorization', async () => {
  const result = await resolveAppleLyrics({
    title: 'Test Song',
    artist: 'Test Artist',
    musicUserToken: 'music-user-token',
  }, buildDeps({ musicUserTokenExpected: 'music-user-token' }));

  assert.equal(result.resolution, 'apple_permission_denied');
  assert.equal(result.needsUserToken, false);
  assert.equal(result.accessDenied, true);
});

test('lyrics resolver preserves Apple permission denial instead of reporting no match', async () => {
  const result = await resolveLyricsForSong({
    songId: 'canonical-song-1',
    title: 'Test Song',
    artist: 'Test Artist',
    musicUserToken: 'music-user-token',
    allowAiFallback: false,
    allowTimedAdapter: false,
  }, buildDeps({ musicUserTokenExpected: 'music-user-token' }));

  assert.equal(result.resolution, 'apple_permission_denied');
  assert.equal(result.needsUserToken, false);
  assert.equal(result.accessDenied, true);
});
