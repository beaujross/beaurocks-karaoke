import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { test } from 'vitest';

const hostSource = readFileSync('src/apps/Host/HostApp.jsx', 'utf8');
const singerSource = readFileSync('src/apps/Mobile/SingerApp.jsx', 'utf8');
const tvSource = readFileSync('src/apps/TV/PublicTV.jsx', 'utf8');
const tvReactionConfigSource = readFileSync('src/apps/TV/publicTvReactionConfig.js', 'utf8');

test('host audience spotlight distinguishes crowd-work spotlight from Tight 15 showcase flow', () => {
  assert.match(hostSource, /data-feature-id="audience-spotlight-control-panel"/);
  assert.match(hostSource, /AUDIENCE_SPOTLIGHT_MODE_OPTIONS\.map/);
  assert.match(hostSource, /Next Prompt/);
  assert.match(hostSource, /kind: SPOTLIGHT_KINDS\.tight15/);
  assert.match(hostSource, /Tight 15 Showcase/);
  assert.match(hostSource, /The spotlighted guest gets a phone-side reaction tray even when the stage is empty\./);
  assert.match(hostSource, /mainstage: options\?\.mainstage === true/);
});

test('singer app exposes a spotlight-only reaction tray outside the normal on-stage reaction flow', () => {
  assert.match(singerSource, /data-feature-id="audience-spotlight-reaction-tray"/);
  assert.match(singerSource, /const sendAudienceSpotlightReaction = async/);
  assert.match(singerSource, /spotlightSessionId: spotlightPayload\?\.sessionId \|\| null/);
  assert.match(singerSource, /These reactions go straight to Public TV even if nobody is singing\./);
});

test('public tv renders audience spotlight prompts separately from Tight 15 showcase metadata', () => {
  assert.match(tvSource, /Audience Spotlight/);
  assert.match(tvSource, /Tight 15 Showcase/);
  assert.match(tvSource, /audienceSpotlightPrompt\.body/);
  assert.match(tvSource, /Number\(r\.points \|\| 0\) > 0 && !r\.spotlightSessionId/);
  assert.match(tvSource, /Showcase Pick/);
  assert.match(tvSource, /Saved Tight 15/);
});

test('tv reaction config knows how to label spotlight reaction bursts', () => {
  assert.match(tvReactionConfigSource, /spotlight_wave: 'Wave'/);
  assert.match(tvReactionConfigSource, /spotlight_question: 'Question'/);
  assert.match(tvReactionConfigSource, /spotlight_micdrop: 'Mic Drop'/);
});
