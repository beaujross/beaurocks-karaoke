import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { test } from "vitest";

const addWorkspaceSource = readFileSync("src/apps/Host/components/AddToQueueFormBody.jsx", "utf8");
const hostAppSource = readFileSync("src/apps/Host/HostApp.jsx", "utf8");
const gameRegistrySource = readFileSync("src/lib/gameRegistry.js", "utf8");
const quickMomentMutationSource = hostAppSource.slice(
  hostAppSource.indexOf("const addQuickRunOfShowMoment"),
  hostAppSource.indexOf("const importRunOfShowCsv"),
);
const sceneQueueMutationSource = hostAppSource.slice(
  hostAppSource.indexOf("const queueScenePresetAsMoment"),
  hostAppSource.indexOf("const duplicateRunOfShowItem"),
);

test("host add workspace exposes the broader game and scene catalog instead of a trimmed subset", () => {
  assert.match(
    addWorkspaceSource,
    /import \{ GAMES_META \} from '\.\.\/\.\.\/\.\.\/lib\/gameRegistry';/,
    "AddToQueueFormBody should source game cards from the canonical game registry",
  );
  assert.match(
    addWorkspaceSource,
    /const allScenePresets = Array\.isArray\(scenePresets\) \? scenePresets : \[\];/,
    "AddToQueueFormBody should keep the full saved scene list available in the TV add surface",
  );
  assert.doesNotMatch(
    addWorkspaceSource,
    /scenePresets\.slice\(0, 4\)/,
    "AddToQueueFormBody should stop trimming TV scenes to only four cards",
  );
  assert.match(
    addWorkspaceSource,
    /\.\.\.GAMES_META\.filter\(/,
    "AddToQueueFormBody should build the game cards from the full canonical game registry",
  );
  [
    "trivia_pop",
    "wyr",
    "team_pong",
    "karaoke_bracket",
    "applause_countdown",
  ].forEach((gameId) => {
    assert.match(
      gameId === "applause_countdown" ? hostAppSource : gameRegistrySource,
      new RegExp(gameId),
      `The host add flow should expose ${gameId} through the registry-backed game lineup`,
    );
  });
});

test("host room setup keeps quick actions compact instead of repeating the Night Setup label as a hero block", () => {
  assert.match(
    hostAppSource,
    /Quick Actions/,
    "HostApp Night Setup should use a compact quick-actions strip",
  );
  assert.doesNotMatch(
    hostAppSource,
    /text-sm uppercase tracking-widest text-cyan-300">Run Tonight/,
    "HostApp Night Setup should drop the redundant Run Tonight hero heading directly below the tabs",
  );
  assert.doesNotMatch(
    hostAppSource,
    />1\. Night Setup</,
    "HostApp Night Setup should not spend a top quick-action button restating the current tab",
  );
});

test("host add workspace uses one destination selector and append-only Queue language", () => {
  assert.match(addWorkspaceSource, /Add to Queue/);
  assert.match(addWorkspaceSource, /Save for Later/);
  assert.match(addWorkspaceSource, /Add to Tonight's Flow/);
  assert.match(addWorkspaceSource, /data-feature-id="moment-destination-control"/);
  assert.match(addWorkspaceSource, /Queue always adds it at the end\./);
  assert.match(addWorkspaceSource, /placement: 'append'/);
  assert.doesNotMatch(addWorkspaceSource, /Tap to queue/);
  assert.doesNotMatch(addWorkspaceSource, /Queue Only/);
  assert.doesNotMatch(addWorkspaceSource, /moment-pack-queue-next/);
  assert.match(hostAppSource, /added to the end of Live Queue/);
  assert.match(quickMomentMutationSource, /placement: 'append'/);
  assert.doesNotMatch(quickMomentMutationSource, /activateShow/);
  assert.match(sceneQueueMutationSource, /items\.push\(nextItem\)/);
  assert.doesNotMatch(sceneQueueMutationSource, /activateShow/);
  assert.match(addWorkspaceSource, /\['karaoke', 'Karaoke tracks'\]/);
  assert.match(addWorkspaceSource, /\['any', 'All videos'\]/);
  assert.match(addWorkspaceSource, /data-search-control='provider'/);
  assert.match(addWorkspaceSource, /data-search-control='scope'/);
  assert.match(addWorkspaceSource, /aria-pressed=\{autocompleteProvider === 'youtube'\}/);
  assert.doesNotMatch(addWorkspaceSource, /Queue Later/);
});

test("host add workspace uses one YouTube expansion action and consistent segmented tabs", () => {
  const performanceSearchSource = addWorkspaceSource.slice(
    addWorkspaceSource.indexOf('className={`host-autocomplete-shell'),
    addWorkspaceSource.indexOf('{queueSearchSourceNote ?'),
  );

  assert.match(addWorkspaceSource, /data-feature-id="host-moment-type-tabs"/);
  assert.match(addWorkspaceSource, /role="tablist"\s*aria-label="Performance and moment types"/);
  assert.match(addWorkspaceSource, /role="tab"\s*aria-selected=\{active\}/);
  assert.match(performanceSearchSource, /Backing source/);
  assert.match(performanceSearchSource, /YouTube filter/);
  assert.match(performanceSearchSource, /Karaoke tracks/);
  assert.match(performanceSearchSource, /All videos/);
  assert.match(performanceSearchSource, /data-feature-id="host-performance-search-expand"/);
  assert.match(performanceSearchSource, /Expand Search/);
  assert.doesNotMatch(performanceSearchSource, /aria-label="Open YouTube search"|Search more on YouTube|More YouTube/);
});

test("host performance results queue directly while manual requests keep a local action", () => {
  assert.match(addWorkspaceSource, /data-feature-id="performance-result-row"/);
  assert.match(addWorkspaceSource, /if \(performanceActionsEnabled\) \{\s*onQueueOnly\?\.\(r\);\s*return;/);
  assert.doesNotMatch(addWorkspaceSource, /data-feature-id="performance-result-queue-only"/);
  assert.match(addWorkspaceSource, /performanceActionsEnabled \? 'Add to Queue' : 'Select'/);
  assert.match(addWorkspaceSource, /External playback/);
  assert.doesNotMatch(addWorkspaceSource, /\? 'External' : 'TV'/);
  assert.match(addWorkspaceSource, /data-feature-id="host-manual-queue-submit"/);
  assert.match(addWorkspaceSource, /'Add Manual Request' : 'Enter a Song Title'/);
  assert.doesNotMatch(addWorkspaceSource, /\{performanceMode \? \(\s*<div className="mb-2 mt-2 flex justify-end">/);
});
