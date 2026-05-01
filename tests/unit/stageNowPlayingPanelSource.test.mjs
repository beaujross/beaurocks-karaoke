import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "vitest";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const stagePanelPath = path.resolve(__dirname, "../../src/apps/Host/components/StageNowPlayingPanel.jsx");

test("StageNowPlayingPanel keeps performance-critical controls in the visible transport area", () => {
  const source = readFileSync(stagePanelPath, "utf8");

  assert.match(
    source,
    /Now Performing[\s\S]*Track note[\s\S]*Transport/,
    "Backing-track note actions should live with the now-performing song, above transport controls",
  );
  assert.match(
    source,
    /Last Track Check[\s\S]*Use Again[\s\S]*Bad Track[\s\S]*Inbox[\s\S]*Skip/s,
    "The last-track review card should allow deferring into inbox or skipping entirely",
  );
  assert.match(
    source,
    /Transport[\s\S]*End performance[\s\S]*fa-forward-step[\s\S]*Stage Options/,
    "End and next actions should remain in the compact transport block above secondary stage options",
  );
  assert.match(
    source,
    /min-h-\[54px\]/,
    "Transport buttons should stay compact enough for constrained host-panel heights",
  );
  assert.doesNotMatch(
    source,
    /Performance Controls/,
    "The old lower performance-control section should not push end controls below the fold",
  );
  assert.doesNotMatch(
    source,
    /Post-Performance Timing|post-performance-timing-slider|Recap On|Recap Off/,
    "The live stage rail should not expose post-performance timing or recap configuration controls",
  );
  assert.doesNotMatch(
    source,
    /performanceRecapNextUpMs|Exact beat lengths live in Admin room settings/,
    "Timing configuration copy and per-beat fields should live in Admin, not the stage runtime",
  );
  assert.match(
    source,
    /if \(typeof onEndPerformance === 'function'\) \{\s*onEndPerformance\(current\.id\);\s*return;\s*\}\s*updateStatus\(current\.id, 'performed'\);/s,
    "The End transport button should delegate to the applause-aware end-performance callback before falling back to a direct status write",
  );
  assert.match(
    source,
    /if \(typeof onMeasureApplause === 'function'\) \{\s*onMeasureApplause\(\);\s*return;\s*\}\s*updateRoom\(\{ activeMode: room\?\.activeMode === 'applause' \? 'karaoke' : 'applause_countdown', applausePeak: 0 \}\);/s,
    "The applause control should route through the host-provided applause callback before using the legacy room-mode toggle",
  );
});
