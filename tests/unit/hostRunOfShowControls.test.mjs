import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "vitest";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const hostAppPath = path.resolve(__dirname, "../../src/apps/Host/HostApp.jsx");
const runOfShowDirectorPanelPath = path.resolve(__dirname, "../../src/apps/Host/components/RunOfShowDirectorPanel.jsx");
const runOfShowQueueHudPath = path.resolve(__dirname, "../../src/apps/Host/components/RunOfShowQueueHud.jsx");

test("HostApp clears run of show state back to straight queue mode", () => {
  const source = readFileSync(hostAppPath, "utf8");

  assert.match(source, /const clearRunOfShowNow = useCallback\(async \(\) => \{/);
  assert.match(source, /runOfShowEnabled:\s*false,/);
  assert.match(source, /runOfShowDirector:\s*nextDirector,/);
  assert.match(source, /runOfShowPolicy:\s*nextPolicy,/);
  assert.match(source, /runOfShowRoles:\s*nextRoles,/);
  assert.match(source, /runOfShowTemplateMeta:\s*nextTemplateMeta,/);
  assert.match(source, /runOfShowItemId:\s*null,/);
});

test("Run of show queue and board surfaces expose clear-show controls", () => {
  const queueHudSource = readFileSync(runOfShowQueueHudPath, "utf8");
  const directorPanelSource = readFileSync(runOfShowDirectorPanelPath, "utf8");

  assert.match(queueHudSource, /onClear,/);
  assert.match(queueHudSource, />\s*Clear Show\s*</);
  assert.match(directorPanelSource, /onClearRunOfShow,/);
  assert.match(directorPanelSource, />\s*Clear Show\s*</);
});
