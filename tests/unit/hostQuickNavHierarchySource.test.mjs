import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { test } from "vitest";

const source = readFileSync(
  "src/apps/Host/components/HostTopChrome.jsx",
  "utf8",
);

test("Host quick navigation uses one touch target size and a clear text hierarchy", () => {
  const menu =
    source.match(
      /data-feature-id="host-quick-nav-menu"[\s\S]*?<\/div>\s*\)\}/,
    )?.[0] || "";
  assert.match(menu, /min-h-\[58px\]/);
  assert.match(menu, /text-\[15px\] font-black leading-5/);
  assert.match(menu, /text-\[11px\] font-medium leading-4 text-zinc-500/);
  assert.match(menu, /Queue[\s\S]*Run singers and song order/);
  assert.match(menu, /Show[\s\S]*Plan moments between songs/);
  assert.doesNotMatch(menu, /text-sm font-bold uppercase tracking-widest/);
});
