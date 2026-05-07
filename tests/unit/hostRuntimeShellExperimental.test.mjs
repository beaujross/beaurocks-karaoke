import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { test } from 'vitest';

import HostRuntimeShellExperimental from '../../src/apps/Host/components/HostRuntimeShellExperimental.jsx';

const styles = {
  btnStd: 'btn',
  btnSecondary: 'btn-secondary',
  btnNeutral: 'btn-neutral',
  btnHighlight: 'btn-highlight',
  input: 'input',
};

const runtimeModel = {
  runtimeModeEmphasis: 'hostLed',
  topQuestions: {
    liveNow: { title: 'Jordan', subtitle: 'Valerie' },
    nextCommitted: { title: 'Taylor', subtitle: 'Dreams' },
    needsIntervention: { title: 'No active blocker', subtitle: 'The runtime lane is clear.' },
  },
  currentPerformance: {
    id: 'live-1',
    objectType: 'performance',
    objectRole: 'live',
    title: 'Jordan',
    subtitle: 'Valerie',
    detail: 'Amy Winehouse',
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
    objectType: 'performance',
    objectRole: 'next',
    title: 'Taylor',
    subtitle: 'Dreams',
    reason: 'Next committed performance',
    sourceLabel: 'YouTube',
    statusLabel: 'Track ready',
  },
  trackCheckState: {
    hasPendingPrompt: true,
    deferredCount: 1,
  },
  attentionItems: [],
  candidateGroups: [],
  rotationFlow: [],
  candidatePool: [],
  playback: {
    sourceLabel: 'YouTube',
    playing: true,
  },
  roomControlsSummary: {
    autoDj: false,
    readyCheckActive: false,
  },
};

test('HostRuntimeShellExperimental keeps current-performance tools and playback utilities visible', () => {
  const markup = renderToStaticMarkup(
    React.createElement(HostRuntimeShellExperimental, {
      runtimeModel,
      room: { applausePeak: 88, audienceVideoMode: 'force' },
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
      onAdvanceToNext: () => {},
      canAdvanceToNext: true,
      onApproveCurrentAudienceBacking: () => {},
      onAvoidCurrentAudienceBacking: () => {},
      onRateCurrentBackingUp: () => {},
      onRateCurrentBackingDown: () => {},
      onToggleAudienceSync: () => {},
      audienceSyncActive: true,
      audienceSyncDisabled: false,
      onOpenQueue: () => {},
      onOpenAdd: () => {},
      onOpenInbox: () => {},
      onOpenPlanner: () => {},
      onOpenSceneLibrary: () => {},
      onStartNextPerformance: () => {},
    }),
  );

  assert.match(markup, /data-host-runtime-brand-title="BeauRocks Karaoke"/);
  assert.match(markup, /Current Performance Tools/);
  assert.match(markup, /Guest Track/);
  assert.match(markup, /Works/);
  assert.match(markup, /Bad Track/);
  assert.match(markup, /Edit Current/);
  assert.match(markup, /Audience Sync On/);
  assert.match(markup, /Custom Bonus/);
  assert.match(markup, /Apply Bonus/);
  assert.match(markup, /Pause/);
  assert.match(markup, /Restart/);
  assert.match(markup, /Pop Out/);
  assert.match(markup, /Last Applause/);
  assert.match(markup, /88 dB/);
});

test('HostRuntimeShellExperimental carries room branding through the runtime shell so partner rooms stay skinnable', () => {
  const markup = renderToStaticMarkup(
    React.createElement(HostRuntimeShellExperimental, {
      runtimeModel,
      room: {
        applausePeak: 88,
        audienceVideoMode: 'off',
        audienceBrandTheme: {
          appTitle: 'AAHF Festival',
          primaryColor: '#E05A44',
          secondaryColor: '#F4C94A',
          accentColor: '#8F2D2A',
        },
      },
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
      onAdvanceToNext: () => {},
      canAdvanceToNext: true,
      onApproveCurrentAudienceBacking: () => {},
      onAvoidCurrentAudienceBacking: () => {},
      onRateCurrentBackingUp: () => {},
      onRateCurrentBackingDown: () => {},
      onToggleAudienceSync: () => {},
      audienceSyncActive: false,
      audienceSyncDisabled: false,
      onOpenQueue: () => {},
      onOpenAdd: () => {},
      onOpenInbox: () => {},
      onOpenPlanner: () => {},
      onOpenSceneLibrary: () => {},
      onStartNextPerformance: () => {},
    }),
  );

  assert.match(markup, /data-host-runtime-brand-title="AAHF Festival"/);
  assert.match(markup, /data-host-runtime-brand-primary="#E05A44"/);
  assert.match(markup, /data-host-runtime-brand-secondary="#F4C94A"/);
  assert.match(markup, /data-host-runtime-brand-accent="#8F2D2A"/);
  assert.match(markup, /AAHF Festival/);
});
