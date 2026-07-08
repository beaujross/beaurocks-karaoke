import assert from "node:assert/strict";
import { statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "vitest";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");

test("AAHF badge logo library asset is present and web-sized", () => {
  const assetPath = path.join(repoRoot, "public/images/logo-library/AAHF-Badge-FlowerOutside.png");
  const stats = statSync(assetPath);

  assert.ok(stats.size > 0, "AAHF badge asset should exist");
  assert.ok(
    stats.size <= 750 * 1024,
    "AAHF badge asset should stay below 750 KB so host logo thumbnails load reliably",
  );
});
