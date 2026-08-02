import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { test } from 'vitest';

import HostStageConsoleExperimental from '../../src/apps/Host/components/HostStageConsoleExperimental.jsx';

const styles = {
  btnStd: 'btn',
  btnSecondary: 'btn-secondary',
  btnNeutral: 'btn-neutral',
  btnHighlight: 'btn-highlight',
  input: 'input',
};

const runtimeModel = {
  runtimeModeEmphasis: 'audienceLed',
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
  attentionItems: [
    {
      id: 'attention-1',
      tone: 'warning',
      title: '1 queue issue',
      subtitle: 'Queue needs host intervention',
    },
  ],
  candidateGroups: [],
  rotationFlow: [],
  candidatePool: [],
  playback: {
    sourceLabel: 'YouTube',
    playing: true,
  },
  roomControlsSummary: {
    autoDj: true,
    readyCheckActive: true,
  },
};

test('HostStageConsoleExperimental takes over the workspace while preserving room deck access and branding', () => {
  const markup = renderToStaticMarkup(
    React.createElement(HostStageConsoleExperimental, {
      runtimeModel,
      room: {
        applausePeak: 88,
        audienceVideoMode: 'force',
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
      audienceSyncActive: true,
      audienceSyncDisabled: false,
      onOpenQueue: () => {},
      onOpenAdd: () => {},
      onOpenInbox: () => {},
      onOpenPlanner: () => {},
      onOpenSceneLibrary: () => {},
      onStartNextPerformance: () => {},
      workspacePanel: React.createElement('div', null, 'Workspace Panel'),
      utilityPanel: React.createElement('div', null, 'Soundboard Tools'),
    }),
  );

  assert.match(markup, /data-host-runtime-brand-title="AAHF Festival"/);
  assert.match(markup, />Live</);
  assert.match(markup, /Next/);
  assert.match(markup, /Performance Actions/);
  assert.match(markup, /Guest Track/);
  assert.match(markup, /Audience Sync On/);
  assert.match(markup, /Support Lane/);
  assert.match(markup, /Summary/);
  assert.match(markup, /Tonight Flow/);
  assert.match(markup, /Deeper lineup, Show Plan, inbox, and tools stay collapsed until you call for them\./);
  assert.match(markup, /Workspace/);
  assert.match(markup, /Tools/);
});
