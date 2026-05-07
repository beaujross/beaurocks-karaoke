import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { test } from 'vitest';

import HostNightPilotPrototype from '../../src/apps/Host/components/HostNightPilotPrototype.jsx';

const styles = {
  input: 'input',
};

const runtimeModel = {
  currentPerformance: {
    id: 'live-1',
    objectRole: 'live',
    objectType: 'performance',
    title: 'Alex Rivers',
    subtitle: 'Dreams',
    detail: 'Fleetwood Mac',
    sourceLabel: 'YouTube',
    statusLabel: 'Track ready',
    raw: {
      id: 'live-1',
      mediaUrl: 'https://www.youtube.com/watch?v=abc1234',
      resolutionStatus: 'audience_selected_unverified',
    },
  },
  nextPerformance: {
    id: 'next-1',
    objectRole: 'next',
    objectType: 'performance',
    title: 'Jordan',
    subtitle: 'Valerie',
    sourceLabel: 'YouTube',
    statusLabel: 'Track ready',
  },
  queuePreview: [
    { id: 'q1', title: 'Jordan', subtitle: 'Valerie', statusLabel: 'Track ready' },
    { id: 'q2', title: 'Taylor', subtitle: 'Mr. Brightside', statusLabel: 'Track ready' },
  ],
  showBeatFlow: [
    { id: 'b1', title: 'Feature Slot 1', subtitle: 'Planned next object', statusLabel: 'Ready' },
  ],
  attentionItems: [
    { id: 'a1', title: '1 queue issue', subtitle: 'Queue needs host intervention' },
  ],
  playback: {
    sourceLabel: 'YouTube',
    songTitle: 'Dreams',
    artistName: 'Fleetwood Mac',
    playing: true,
    elapsedLabel: '0:45',
    durationLabel: '3:32',
    progressPct: 25,
  },
  trackCheckState: {
    hasPendingPrompt: true,
    deferredCount: 1,
  },
};

const queueItems = [
  { id: 'q1', singerName: 'Jordan', songTitle: 'Valerie', artist: 'Amy Winehouse', sourceLabel: 'YouTube', statusLabel: 'Track ready' },
  { id: 'q2', singerName: 'Taylor', songTitle: 'Mr. Brightside', artist: 'The Killers', sourceLabel: 'YouTube', statusLabel: 'Track ready' },
  { id: 'q3', singerName: 'Sam Lee', songTitle: 'Since U Been Gone', artist: 'Kelly Clarkson', sourceLabel: 'YouTube', statusLabel: 'Track ready' },
];

test('HostNightPilotPrototype renders a separate fullscreen operating surface', () => {
  const markup = renderToStaticMarkup(
    React.createElement(HostNightPilotPrototype, {
      runtimeModel,
      room: {
        audienceBrandTheme: {
          appTitle: 'BeauRocks Karaoke',
          primaryColor: '#00C4D9',
          secondaryColor: '#FF7AC8',
          accentColor: '#15091f',
        },
      },
      roomCode: 'DEMOBR',
      queueItems,
      styles,
      customBonus: '15',
      onCustomBonusChange: () => {},
      onTogglePlay: () => {},
      onRestartPlayback: () => {},
      onOpenBackingWindow: () => {},
      onEndPerformance: () => {},
      onStartApplause: () => {},
      onReturnCurrentToQueue: () => {},
      onAddBonusToCurrent: () => {},
      onEditCurrentPerformance: () => {},
      onToggleAudienceSync: () => {},
      onApproveCurrentAudienceBacking: () => {},
      onAvoidCurrentAudienceBacking: () => {},
      onRateCurrentBackingUp: () => {},
      onRateCurrentBackingDown: () => {},
      onOpenQueue: () => {},
      onOpenAdd: () => {},
      onOpenInbox: () => {},
      onOpenPlanner: () => {},
      onOpenSceneLibrary: () => {},
      onStartNextPerformance: () => {},
      onExitPrototype: () => {},
    }),
  );

  assert.match(markup, /Night Pilot/);
  assert.match(markup, /Live Performance/);
  assert.match(markup, /Queue Command Deck/);
  assert.match(markup, /Show Beats/);
  assert.match(markup, /Backing Player/);
  assert.match(markup, /Command Rail/);
  assert.match(markup, /Classic/);
  assert.match(markup, /Mr\. Brightside/);
});
