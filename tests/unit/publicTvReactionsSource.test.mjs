import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { test } from 'vitest';

const source = readFileSync('src/apps/TV/PublicTV.jsx', 'utf8');

test('PublicTV keeps floating reaction emojis visible in simple profile while trimming the heavier labels', () => {
  assert.match(
    source,
    /\{reactions\.map\(r => \{/,
    'Reaction rendering should not be gated behind ambient-fx mode alone.',
  );
  assert.doesNotMatch(
    source,
    /\{showAmbientFx && reactions\.map\(r => \(/,
    'Simple TV mode should still render reaction emojis even when ambient fx are disabled.',
  );
  assert.match(
    source,
    /isSimpleTvProfile \? \(/,
    'Simple TV profile should use its own lighter reaction label treatment.',
  );
  assert.match(
    source,
    /<span className="text-lg leading-none">\{r\.avatar \|\| EMOJI\.sparkle\}<\/span>/,
    'Simple TV reactions should still show the audience avatar emoji chip.',
  );
  assert.match(
    source,
    /<span className="ml-2 max-w-\[8rem\] truncate">\{r\.userName \|\| 'Guest'\}<\/span>/,
    'Simple TV reactions should still attribute the sender after the featured banner was removed.',
  );
});

test('PublicTV centers reaction emphasis on the floating emoji layer instead of a queued top banner', () => {
  assert.doesNotMatch(
    source,
    /\{featuredReaction && currentPerformanceId && \(/,
    'Reaction emphasis should not rely on the old queued top banner.',
  );
  assert.doesNotMatch(
    source,
    /enqueueFeaturedReaction\(/,
    'New reactions should no longer enqueue into a separate featured-banner flow.',
  );
  assert.match(
    source,
    /const TV_REACTION_VISIBILITY_MS = 12800;/,
    'Reactions should stay visible longer on the primary shared board.',
  );
  assert.match(
    source,
    /const visibilityWindowMs = Math\.max\(\s*TV_REACTION_VISIBILITY_MS,\s*Number\(r\?\.motionDurationMs \|\| 0\) \+ 900\s*\);/,
    'Reaction cleanup should respect extended per-reaction motion durations.',
  );
});

test('PublicTV reaction animations provide stronger arrival staging and a reduced-motion fallback', () => {
  assert.match(
    source,
    /reaction-impact-bloom/,
    'Reaction rendering should include an arrival bloom around the emoji.',
  );
  assert.match(
    source,
    /reaction-impact-ring/,
    'Reaction rendering should include a ring-based entrance cue around the emoji.',
  );
  assert.match(
    source,
    /reaction-impact-bloom-\$\{reactionTheme\}/,
    'Reaction entrance styling should theme the bloom by reaction type.',
  );
  assert.match(
    source,
    /reaction-stack-launch[\s\S]*reaction-stack-prism[\s\S]*reaction-stack-royal[\s\S]*reaction-stack-blossom[\s\S]*reaction-stack-cheers[\s\S]*reaction-stack-ember[\s\S]*reaction-stack-heart[\s\S]*reaction-stack-applause/,
    'Each reaction type should have its own TV movement path.',
  );
  assert.match(
    source,
    /@keyframes reaction-safe-float/,
    'Reactions should define a calmer reduced-motion animation path.',
  );
  assert.match(
    source,
    /\.motion-safe-fx \.reaction-stack-drift-left,[\s\S]*animation: reaction-safe-float/,
    'Reduced-motion TV mode should swap the reaction stack onto the safer motion path.',
  );
});

test('PublicTV keeps support celebrations full-screen even outside the ambient TV profile', () => {
  assert.match(
    source,
    /\{bonusDropBurst && \(/,
    'Host-triggered made-it-rain moments should not depend on ambient TV mode.',
  );
  assert.match(
    source,
    /\{purchaseCelebrationBurst && \(/,
    'Webhook-driven support celebrations should still render in simple TV mode and between performances.',
  );
  assert.match(
    source,
    /const purchaseCelebrationIsMoneyRain = purchaseCelebrationBurst\?\.celebrationStyle === SUPPORT_CELEBRATION_STYLES\.moneybagsBurst;/,
    'TV support celebrations should preserve the dedicated money-rain takeover style.',
  );
});
