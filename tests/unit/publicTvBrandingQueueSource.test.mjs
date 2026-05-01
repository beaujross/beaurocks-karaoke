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
