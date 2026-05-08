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
    /Now Performing[\s\S]*Track note[\s\S]*Playback Track/,
    "Backing-track note actions should live with the now-performing song, above playback controls",
  );
  assert.match(
    source,
    /Last Track Check[\s\S]*Use Again[\s\S]*Bad Track[\s\S]*Inbox[\s\S]*Skip/s,
    "The last-track review card should allow deferring into inbox or skipping entirely",
  );
  assert.match(
    source,
    /Track note[\s\S]*Performance Flow[\s\S]*End performance[\s\S]*fa-forward-step[\s\S]*Stop & Re-Queue[\s\S]*Playback Track[\s\S]*Pop Out/,
    "Performance actions should stay tied to the now-performing card, while playback transport remains a distinct control group below",
  );
  assert.match(
    source,
    /onOpenBackingWindow = null/,
    "The stage panel should accept a host-provided backing-window handler so browser failures can be handled higher up",
  );
  assert.match(
    source,
    /const currentBackingUrl = String\(currentMediaUrl \|\| current\?\.mediaUrl \|\| ''\)\.trim\(\);[\s\S]*window\.open\(currentBackingUrl, '_blank', 'noopener,noreferrer'\)/s,
    "Pop-out fallback should use the resolved backing URL and safe window flags",
  );
  assert.match(
    source,
    /min-h-\[54px\]/,
    "Transport buttons should stay compact enough for constrained host-panel heights",
  );
  assert.doesNotMatch(
    source,
    /showStageDetails|Audience sync|TV Display Mode|Lyrics View|Auto Lyrics|setCustomBonus|addBonusToCurrent/,
    "The left stage rail should not unfurl a secondary More drawer with duplicate room and TV controls",
  );
  assert.doesNotMatch(
    source,
    /Keep the backing under control without touching the live performer flow\.|End the song, capture the room beat, and stage the next protected performer\./,
    "The stage rail should not spend vertical space on helper copy under the playback and performance headers",
  );
  assert.doesNotMatch(
    source,
    /Transport|Stage Options|Performance Controls/,
    "The old mixed transport and stage-options labels should be replaced by clearer playback and performance groupings",
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
