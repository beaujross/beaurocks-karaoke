import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { test } from 'vitest';

const singerSource = readFileSync('src/apps/Mobile/SingerApp.jsx', 'utf8');
const functionsSource = readFileSync('functions/index.js', 'utf8');
const indexes = JSON.parse(readFileSync('firestore.indexes.json', 'utf8'));

test('streamlined Songs keeps Tight 15 visible and explains what it does', () => {
  assert.match(
    singerSource,
    /const streamlinedSongsNavItems = \[[\s\S]*\{ key: 'tight15', label: 'Tight 15'[\s\S]*\];/,
  );
  assert.doesNotMatch(
    singerSource,
    /songsTab !== 'tight15' \|\| bracketSignupActive[\s\S]*setSongsTab\('browse'\)/,
  );
  assert.match(singerSource, /data-feature-id="audience-tight15-discovery"/);
  assert.match(singerSource, /Your 15 go-to karaoke songs/);
  assert.match(singerSource, /Hosts and game modes can pull from your list/);
  assert.match(singerSource, /data-feature-id="audience-tight15-library"/);
});

test('Tight 15 mutations are account-gated with a concrete account reward', () => {
  assert.match(singerSource, /const requireTight15Account = \(\) => \{[\s\S]*openTight15AccountGate\(\)/);
  assert.match(singerSource, /const addToTight15 = async \(item\) => \{\s*if \(!requireTight15Account\(\)\) return;/);
  assert.match(singerSource, /const removeFromTight15 = async \(id\) => \{\s*if \(!requireTight15Account\(\)\) return;/);
  assert.match(singerSource, /const importRecentToTight15 = async \(\) => \{\s*if \(!requireTight15Account\(\)\) return;/);
  assert.match(singerSource, /data-feature-id="audience-tight15-account-gate"/);
  assert.match(singerSource, /Create account \+ 5,000 PTS/);
  assert.match(singerSource, /save your Tight 15 and build your performance history/);
});

test('account performance history is owner-scoped, cross-room, and artwork-aware', () => {
  assert.match(
    singerSource,
    /collection\(db, 'performances'\)[\s\S]*where\('singerUid', '==', accountProfileUid\)[\s\S]*orderBy\('timestamp', 'desc'\)[\s\S]*limit\(50\)/,
  );
  assert.match(singerSource, /const merged = \[\.\.\.accountPerformanceHistory, \.\.\.roomHistory\]/);
  assert.match(singerSource, /Saved to your BeauRocks account across rooms/);
  assert.match(functionsSource, /performanceRef\.set\(\{[\s\S]*albumArtUrl: albumArtUrl \|\| null,[\s\S]*timestamp:/);

  const performanceHistoryIndex = indexes.indexes.find((index) => (
    index.collectionGroup === 'performances'
    && index.queryScope === 'COLLECTION'
    && index.fields?.some((field) => field.fieldPath === 'singerUid' && field.order === 'ASCENDING')
    && index.fields?.some((field) => field.fieldPath === 'timestamp' && field.order === 'DESCENDING')
  ));
  assert.ok(performanceHistoryIndex, 'performance history requires its singerUid/timestamp index');
});
