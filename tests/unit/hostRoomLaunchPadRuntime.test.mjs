import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, test } from 'vitest';
import HostRoomLaunchPad from '../../src/apps/Host/components/HostRoomLaunchPad.jsx';

const noop = () => {};
const styles = new Proxy({}, { get: () => '' });

const buildLaunchPadProps = (overrides = {}) => ({
  STYLES: styles,
  launchState: 'Room browser ready',
  launchStateTone: 'border-emerald-300/35 bg-emerald-500/10 text-emerald-100',
  launchAccessPending: false,
  shouldShowSetupCard: false,
  canUseWorkspaceOnboarding: true,
  openOnboardingWizard: noop,
  launchRoomName: 'Friday Karaoke',
  setLaunchRoomName: noop,
  launchRequestedRoomCode: '',
  setLaunchRequestedRoomCode: noop,
  presets: [
    { id: 'casual', label: 'Casual', isBuiltIn: true, basePresetId: 'casual' },
  ],
  resolvedLaunchPresetId: 'casual',
  setHostNightPreset: noop,
  saveCustomHostPreset: noop,
  deleteCustomHostPreset: noop,
  discoveryListingEnabled: false,
  setDiscoveryListingMode: noop,
  quickLaunchDiscovery: { roomStartsAtLocal: '' },
  setQuickLaunchDiscovery: noop,
  eventCreditsConfig: {},
  setEventCreditsConfig: noop,
  handleStartLauncherRoom: noop,
  canStartLauncherRoom: true,
  creatingRoom: false,
  selectedLaunchPreset: { id: 'casual', label: 'Casual', isBuiltIn: true, basePresetId: 'casual' },
  entryError: '',
  retryLastHostAction: noop,
  hostUpdateDeploymentBanner: null,
  recentHostRoomsLoading: false,
  recentHostRooms: [],
  roomManagerBusyCode: '',
  roomManagerBusyAction: '',
  joiningRoom: false,
  openExistingRoomWorkspace: noop,
  roomCodeInput: '',
  setRoomCodeInput: noop,
  launchRoomCodeCandidate: '',
  hasLaunchRoomCode: false,
  requestedLaunchRoomCodeCandidate: '',
  hasRequestedLaunchRoomCode: false,
  runLandingRoomCleanup: noop,
  setRoomDiscoverability: noop,
  setRoomArchivedState: noop,
  resetRoomToCurrentTemplate: noop,
  seedAahfKickoffRoom: noop,
  runLandingRoomPermanentDelete: noop,
  audienceBase: 'https://audience.example/app',
  canPermanentlyDeleteRooms: true,
  ...overrides,
});

const renderLaunchPad = (overrides = {}) => renderToStaticMarkup(
  React.createElement(HostRoomLaunchPad, buildLaunchPadProps(overrides)),
);

afterEach(() => {
  delete globalThis.window;
});

test('HostRoomLaunchPad prioritizes pinned ready rooms in the browser and selected workspace', () => {
  globalThis.window = {
    localStorage: {
      getItem: () => JSON.stringify(['PIN1']),
      setItem: noop,
    },
  };

  const markup = renderLaunchPad({
    recentHostRooms: [
      {
        code: 'LATE1',
        roomName: 'Later Updated Room',
        updatedAtMs: 2000,
        createdAtMs: 1000,
        closedAtMs: 0,
        archived: false,
        publicRoom: false,
      },
      {
        code: 'PIN1',
        roomName: 'Pinned Priority Room',
        updatedAtMs: 1000,
        createdAtMs: 500,
        closedAtMs: 0,
        archived: false,
        publicRoom: true,
      },
    ],
  });

  assert.match(markup, /Pinned Priority Room/);
  assert.match(markup, /Pinned Room/);
  assert.match(markup, /Pinned/);
  assert.equal(
    markup.indexOf('Pinned Priority Room') < markup.indexOf('Later Updated Room'),
    true,
    'Pinned rooms should render ahead of newer unpinned rooms in the ready browser list',
  );
});

test('HostRoomLaunchPad gives AAHF a dedicated event-focus strip with live and reset actions', () => {
  const markup = renderLaunchPad({
    recentHostRooms: [
      {
        code: 'FRIDAY1',
        roomName: 'Friday Main Room',
        updatedAtMs: 3000,
        createdAtMs: 1000,
        closedAtMs: 0,
        archived: false,
        publicRoom: false,
      },
      {
        code: 'AAHF',
        roomName: 'AAHF Kick-Off',
        updatedAtMs: 2000,
        createdAtMs: 1500,
        closedAtMs: 0,
        archived: false,
        publicRoom: true,
        roomStartsAtMs: Date.parse('2026-05-01T19:00:00-07:00'),
      },
    ],
  });

  assert.match(markup, /Event Focus/);
  assert.match(markup, /AAHF Kick-Off/);
  assert.match(markup, /Keep AAHF one click away while you prep the festival night/);
  assert.match(markup, />Open Host Panel</);
  assert.match(markup, />Show Plan</);
  assert.match(markup, />Room Settings</);
  assert.match(markup, />Reset Room</);
});

test('HostRoomLaunchPad lands on AAHF even when another room is pinned locally', () => {
  globalThis.window = {
    localStorage: {
      getItem: () => JSON.stringify(['PIN1']),
      setItem: noop,
    },
  };

  const markup = renderLaunchPad({
    recentHostRooms: [
      {
        code: 'PIN1',
        roomName: 'Pinned Priority Room',
        updatedAtMs: 4000,
        createdAtMs: 2000,
        closedAtMs: 0,
        archived: false,
        publicRoom: true,
      },
      {
        code: 'AAHF',
        roomName: 'AAHF Kick-Off',
        updatedAtMs: 3000,
        createdAtMs: 1500,
        closedAtMs: 0,
        archived: false,
        publicRoom: true,
        roomStartsAtMs: Date.parse('2026-05-01T19:00:00-07:00'),
      },
    ],
  });

  assert.match(markup, /AAHF Kick-Off/);
  assert.match(markup, /data-room-browser-bucket="upcoming"/);
  assert.doesNotMatch(markup, /Pinned Priority Room/);
});

test('HostRoomLaunchPad keeps create flow collapsed while manage workspace is active by default', () => {
  const markup = renderLaunchPad({
    recentHostRooms: [
      {
        code: 'ROOM1',
        roomName: 'Friday Main Room',
        updatedAtMs: 2000,
        createdAtMs: 1000,
        closedAtMs: 0,
        archived: false,
        publicRoom: false,
      },
    ],
  });

  assert.match(markup, /Manage Selected Room/);
  assert.match(markup, /Create Room/);
  assert.match(markup, /Keep one workspace open at a time so the browser stays visible/);
  assert.match(markup, /Open Host Panel/);
  assert.match(markup, /Friday Main Room/);
  assert.match(markup, /Friday Karaoke/);
  assert.match(markup, /Auto-assign room code/);
  assert.match(markup, /preset ready\./);
  assert.match(markup, />Open</);
  assert.doesNotMatch(markup, /Credits and promos/);
  assert.doesNotMatch(markup, /Requested room code/);
});
