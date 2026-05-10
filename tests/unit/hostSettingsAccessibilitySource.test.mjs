import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "vitest";

const hostAppSource = readFileSync("src/apps/Host/HostApp.jsx", "utf8");
const topChromeSource = readFileSync("src/apps/Host/components/HostTopChrome.jsx", "utf8");

test("host settings bundle surfaces expose pressed and live status semantics", () => {
  assert.match(hostAppSource, /role="status"\s+aria-live="polite"\s+aria-atomic="true"/);
  assert.match(hostAppSource, /aria-pressed=\{selected\}/);
  assert.match(topChromeSource, /aria-expanded=\{showOverlaysMenu\}/);
  assert.match(topChromeSource, /role="status"\s+aria-live="polite"\s+aria-atomic="true"/);
  assert.match(topChromeSource, /aria-pressed=\{selected\}/);
});
