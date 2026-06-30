import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { test } from 'vitest';

const tvSource = readFileSync('src/apps/TV/PublicTV.jsx', 'utf8');
const cssSource = readFileSync('src/index.css', 'utf8');

test('PublicTV falls back to the festival sunburst theme when no explicit room brand colors are set', () => {
  assert.match(
    tvSource,
    /getAudienceBrandThemePreset,\s*normalizeAudienceBrandTheme,\s*withAudienceBrandAlpha/,
    'PublicTV should import the shared preset helper for theme fallback.',
  );
  assert.match(
    tvSource,
    /hasExplicitTvBrandColors[\s\S]*\? normalizeAudienceBrandTheme\(\{[\s\S]*\}\)[\s\S]*: getAudienceBrandThemePreset\('festival_sunburst', \{ appTitle: rawTvBrandAppTitle \}\)/,
    'PublicTV should default the TV surface to the festival palette unless the room sets explicit brand colors.',
  );
  assert.match(
    tvSource,
    /const tvShellStyle = useMemo\(\s*\(\) => \(\{[\s\S]*\.\.\.tvBrandPalette\.rootStyle,/,
    'The main TV shell should derive its background from the resolved brand palette.',
  );
  assert.match(
    tvSource,
    /const isAahfTvTheme = useMemo\(/,
    'PublicTV should detect the AAHF TV theme so festival rooms can push a more vivid blossom background.',
  );
  assert.match(
    tvSource,
    /isAahfTvTheme[\s\S]*withAudienceBrandAlpha\(tvAudienceBrandTheme\.primaryColor, 0\.46\)/,
    'AAHF TV branding should use a much stronger coral bloom in the shell background.',
  );
});

test('PublicTV queue sidebar promotes queue count and estimated wait as dedicated stat cards', () => {
  assert.match(
    tvSource,
    /const queueCountCardStyle = useMemo\(/,
    'Queue count should have its own emphasized card styling.',
  );
  assert.match(
    tvSource,
    /const queueWaitCardStyle = useMemo\(/,
    'Estimated wait should have its own emphasized card styling.',
  );
  assert.match(
    tvSource,
    /Queued Songs/,
    'The queue sidebar should call out queued songs as a dedicated metric.',
  );
  assert.match(
    tvSource,
    /Est\. Wait/,
    'The queue sidebar should call out estimated wait as a dedicated metric.',
  );
  assert.doesNotMatch(
    tvSource,
    /Queue:\s*<span className="text-white font-bold">\{allQueue\.length\}<\/span>\s*songs/,
    'The old inline queue summary should be removed in favor of the larger stat cards.',
  );
});

test('PublicTV next-up queue includes staged and assigned singers while skipping track-review blockers', () => {
  assert.match(
    tvSource,
    /const UPCOMING_PUBLIC_TV_QUEUE_STATUS_RANK = Object\.freeze\(\{[\s\S]*staged: 0,[\s\S]*assigned: 1,[\s\S]*requested: 2,/,
    'The TV queue should rank staged and assigned singers ahead of the open requested queue.',
  );
  assert.match(
    tvSource,
    /requiresBackingHostReview\(song\?\.resolutionStatus\) \|\| requiresBackingHostReview\(song\?\.mediaResolutionStatus\)/,
    'The TV next-up list should not promote songs that still need host backing review.',
  );
  assert.match(
    tvSource,
    /const allQueue = songs\.filter\(isUpcomingPublicTvQueueSong\)\.sort\(compareUpcomingPublicTvQueueSongs\);/,
    'The normal queue rail and post-performance next-up overlay should share the same upcoming queue derivation.',
  );
});

test('PublicTV keeps the performance score anchored to the stage top-right HUD lane', () => {
  assert.match(
    tvSource,
    /const showTopHypeMeter = showHypeMeter && topBarHypeMeter;/,
    'The score should only drop when the separate top hype bar is actually visible.',
  );
  assert.match(
    tvSource,
    /const scoreHasFloatingJoinQr = isCinema && showJoinOverlay;[\s\S]*\? 'top-\[11\.75rem\] md:top-\[12\.75rem\] 2xl:top-\[14\.75rem\]'[\s\S]*const performanceScorePositionClass = `right-3 \${performanceScoreTopClass\}/,
    'The score should stay in the top-right HUD lane and drop below the floating QR in cinema mode.',
  );
  assert.doesNotMatch(
    tvSource,
    /scoreAvoidsFloatingJoinQr[\s\S]*left-3/,
    'Cinema mode should not move the score to the left side of the stage.',
  );
  assert.match(
    tvSource,
    /showComboCharge=\{scoreIntegratedHypeMeter\}/,
    'The score HUD should receive combo intensity so its styling stays tied to the hype meter.',
  );
  assert.match(
    tvSource,
    /className=\{`mt-1 flex items-center gap-1 md:mt-2 md:gap-2 justify-end`\}/,
    'The score label should align with the right-anchored score position.',
  );
});

test('PublicTV score and hype meter share charged stage HUD styling', () => {
  assert.match(
    tvSource,
    /className=\{`tv-score-charge tv-score-charge-\$\{comboTier\}/,
    'The score display should render as a tiered charged HUD element.',
  );
  assert.match(
    tvSource,
    /setScoreDelta\(gain\);[\s\S]*setBurstKey\(prev => prev \+ 1\);/,
    'Score updates should trigger a visible gain burst.',
  );
  assert.match(
    tvSource,
    /className=\{`tv-hype-meter[\s\S]*tv-hype-meter-inferno[\s\S]*tv-hype-meter-hot[\s\S]*tv-hype-meter-charged/,
    'The hype meter should expose charge tiers as combo builds.',
  );
  assert.match(
    tvSource,
    /normalizeHypeMeterDisplayMode\([\s\S]*showScoring \? HYPE_METER_DISPLAY_MODES\.scoreIntegrated : HYPE_METER_DISPLAY_MODES\.topBar/,
    'Rooms without an explicit setting should avoid duplicating the top bar when scoring is visible.',
  );
  assert.match(
    tvSource,
    /\$\{showTopHypeMeter \? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-6 pointer-events-none'\}/,
    'The separate top hype bar should be gated independently from the integrated score HUD.',
  );
  assert.match(
    tvSource,
    /\.tv-hype-meter-charge-front[\s\S]*left: calc\(var\(--combo-pct\) - 10px\);/,
    'The hype meter should show a moving charge front at the current combo fill.',
  );
  assert.match(
    tvSource,
    /tv-score-charge-leds[\s\S]*tv-hype-meter-leds/,
    'The score and hype meters should expose analog LED segment overlays.',
  );
  assert.match(
    tvSource,
    /performanceIntroSpotlight[\s\S]*spotlightAvatar \|\| EMOJI\.mic[\s\S]*Coming To The Stage[\s\S]*spotlightName \|\| headline/,
    'Performance intro takeovers should spotlight the singer avatar and name.',
  );
  assert.match(
    tvSource,
    /@keyframes score-charge-hit[\s\S]*@keyframes hype-charge-flow/,
    'The score and hype meter should define matching motion language for charged updates.',
  );
});

test('PublicTV treats missing marquee show mode as idle', () => {
  assert.match(
    tvSource,
    /const mode = room\?\.marqueeShowMode \|\| 'idle';/,
    'A room missing marqueeShowMode should not fall back to an always-on scrolling strip.',
  );
});

test('PublicTV logo flourish stays subtle and honors reduced-motion preferences', () => {
  assert.match(
    cssSource,
    /@keyframes tv-brand-logo-sheen/,
    'The TV logo should have a subtle animated sheen available.',
  );
  assert.match(
    cssSource,
    /\.tv-brand-logo-shell::after/,
    'The logo shell should render the animated highlight overlay.',
  );
  assert.match(
    cssSource,
    /\.tv-brand-logo\s*\{[\s\S]*animation: tv-brand-logo-float 7s ease-in-out infinite;/,
    'The TV logo should use a slow float animation instead of a harsh bounce.',
  );
  assert.match(
    cssSource,
    /@media \(prefers-reduced-motion: reduce\)[\s\S]*animation: none;/,
    'The logo flourish should disable motion for reduced-motion users.',
  );
});

test('PublicTV cinema QR includes explicit Join Now copy', () => {
  assert.match(tvSource, /floating \? \(/);
  assert.match(tvSource, /Join Now/);
  assert.match(tvSource, /Scan to sing/);
});