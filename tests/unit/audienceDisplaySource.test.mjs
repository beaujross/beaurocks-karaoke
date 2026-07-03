import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'vitest';

const hostSource = readFileSync('src/apps/Host/HostApp.jsx', 'utf8');
const topChromeSource = readFileSync('src/apps/Host/components/HostTopChrome.jsx', 'utf8');
const tvSource = readFileSync('src/apps/TV/PublicTV.jsx', 'utf8');
const singerSource = readFileSync('src/apps/Mobile/SingerApp.jsx', 'utf8');
const functionsSource = readFileSync('functions/index.js', 'utf8');
const audienceDisplaySource = readFileSync('src/lib/audienceDisplay.js', 'utf8');
const tvReactionConfigSource = readFileSync('src/apps/TV/publicTvReactionConfig.js', 'utf8');
const rulesSource = readFileSync('firestore.rules', 'utf8');

test('host audience tab exposes reusable audience TV display controls', () => {
  assert.match(hostSource, /from '..\/..\/lib\/audienceDisplay'/);
  assert.match(hostSource, /data-feature-id="host-audience-tv-panel"/);
  assert.match(hostSource, /\['users', 'tv', 'actions', 'history', 'vip', 'tips', 'activity'\]/);
  assert.match(hostSource, /AUDIENCE_DISPLAY_MODE_OPTIONS\.map/);
  assert.match(hostSource, /Commentator Row/);
  assert.match(hostSource, /Use Co-hosts/);
  assert.match(hostSource, /Most Active/);
  assert.match(hostSource, /Add To TV Row/);
  assert.match(hostSource, /onSetAudienceDisplayMode: setAudienceDisplayModeQuick/);
});

test('public tv renders audience display using existing room users and reactions', () => {
  assert.match(tvSource, /from '..\/..\/lib\/audienceDisplay'/);
  assert.match(tvSource, /const audienceDisplay = useMemo/);
  assert.match(tvSource, /data-tv-audience-commentator-row/);
  assert.match(tvSource, /data-tv-audience-lobby-wall/);
  assert.match(tvSource, /audienceDisplayReactionByUid/);
  assert.match(tvSource, /latestReaction\.labelOverride \|\| getTvReactionLabel\(latestReaction\.type\)/);
  assert.match(tvSource, /reactions\.filter\(\(r\) => !r\.audienceDisplaySessionId\)\.map/);
});

test('host tv dropdown exposes fast audience display shortcuts', () => {
  assert.match(topChromeSource, /const audienceDisplayMode = String\(quickRoomControls\?\.audienceDisplay\?\.mode/);
  assert.match(topChromeSource, /quickRoomControls\?\.onSetAudienceDisplayMode/);
  assert.match(topChromeSource, /data-feature-id="deck-tv-audience-layer"/);
  assert.match(topChromeSource, /data-feature-id="deck-tv-audience-commentator-row"/);
  assert.match(topChromeSource, /data-feature-id="deck-tv-audience-lobby-wall"/);
});
test('audience app uses distinct commentator reaction tray mechanics for commentator row', () => {
  assert.match(singerSource, /from '..\/..\/lib\/audienceDisplay'/);
  assert.match(singerSource, /const isAudienceDisplayCommentator = audienceDisplay\.mode === AUDIENCE_DISPLAY_MODES\.commentatorRow/);
  assert.match(singerSource, /const sendAudienceDisplayReaction = async/);
  assert.match(singerSource, /getAudienceDisplayCommentatorReactions/);
  assert.match(singerSource, /audienceDisplaySessionId: audienceDisplay\.sessionId \|\| null/);
  assert.match(singerSource, /data-feature-id="audience-display-commentator-reaction-tray"/);
  assert.match(singerSource, /reaction\.shortLabel \|\| reaction\.label/);
  assert.match(singerSource, /reaction\.iconClass/);
});

test('host callable permits audienceDisplay room updates', () => {
  assert.match(functionsSource, /"audienceDisplay"/);
  assert.match(functionsSource, /HOST_ROOM_OBJECT_OR_NULL_ROOT_KEYS[\s\S]*"audienceDisplay"/);
});

test('commentator reactions have their own TV vocabulary and Firestore contract', () => {
  assert.match(audienceDisplaySource, /commentator_hot_take/);
  assert.match(audienceDisplaySource, /commentator_callback/);
  assert.match(audienceDisplaySource, /commentator_vibe_check/);
  assert.match(audienceDisplaySource, /commentator_wow/);
  assert.match(audienceDisplaySource, /tvToken: 'TAKE'/);
  assert.match(audienceDisplaySource, /iconClass: 'fa-wave-square'/);
  assert.match(audienceDisplaySource, /getAudienceDisplayCommentatorReactionMeta/);
  assert.match(tvSource, /latestReactionMeta\?\.tvToken/);
  assert.match(tvReactionConfigSource, /commentator_hot_take: 'Hot Take'/);
  assert.match(tvReactionConfigSource, /commentator_vibe_check: 'Vibe Check'/);
  assert.match(rulesSource, /'audienceDisplaySessionId'/);
  assert.match(rulesSource, /audienceDisplayMode in \['commentator_row'\]/);
  assert.match(rulesSource, /audienceDisplayRole in \['commentator'\]/);
});
