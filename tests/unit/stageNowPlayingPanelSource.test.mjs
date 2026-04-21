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
});
