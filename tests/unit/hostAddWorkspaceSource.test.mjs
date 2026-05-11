import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { test } from "vitest";

const addWorkspaceSource = readFileSync("src/apps/Host/components/AddToQueueFormBody.jsx", "utf8");
const hostAppSource = readFileSync("src/apps/Host/HostApp.jsx", "utf8");
const gameRegistrySource = readFileSync("src/lib/gameRegistry.js", "utf8");

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
