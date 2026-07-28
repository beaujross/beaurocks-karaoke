import { readFileSync } from 'node:fs';
import { test } from 'vitest';

const publicTvSource = readFileSync('src/apps/TV/PublicTV.jsx', 'utf8');
const visualizerHookSource = readFileSync('src/apps/TV/hooks/useTvVisualizerSettings.js', 'utf8');
const visualizerSource = readFileSync('src/components/AudioVisualizer.jsx', 'utf8');
const stageSource = readFileSync('src/components/Stage.jsx', 'utf8');

test('Public TV routes active local audio into the visualizer without requesting a microphone', () => {
  assert.match(
    visualizerHookSource,
    /resolveTvVisualizerSource\(\{[\s\S]*stageMediaUrl,[\s\S]*stageAudioOnly,[\s\S]*stagePlaying: room\?\.videoPlaying === true/,
    'Visualizer source selection should consider the active performance media',
  );
  assert.match(
    visualizerHookSource,
    /shouldUseStageMediaElement = visualizerEnabled && visualizerResolvedSource === 'stage_media'/,
    'Active stage audio should resolve to the native Stage media element',
  );
  assert.match(
    publicTvSource,
    /onVisualizerMediaElementChange=\{setStageVisualizerSourceElement\}/,
    'Public TV should receive the native Stage audio element',
  );
  assert.match(
    publicTvSource,
    /const visualizerSourceElement = shouldUseStageMediaElement\s*\?\s*stageVisualizerSourceElement/,
    'Visualizer rendering should prefer the active stage media element when selected',
  );
  assert.match(
    stageSource,
    /ref=\{setAudioElementRef\}/,
    'Stage should publish the same native audio element it uses for playback',
  );
  assert.match(
    stageSource,
    /const isBackingAudioOnly = !!current\?\.backingAudioOnly && !isDirectAudioMedia;/,
    'Already-queued direct audio should bypass stale external-window backing flags',
  );
});

test('microphone visualizer fallback respects browser permissions policy', () => {
  assert.match(
    visualizerSource,
    /await canAttemptVisualizerMicrophone\(/,
    'Visualizer should preflight microphone availability before calling getUserMedia',
  );
  assert.match(
    visualizerSource,
    /isNonRetryableVisualizerMicrophoneError\(error\)/,
    'Policy and permission failures should switch directly to simulation instead of retrying',
  );
});
