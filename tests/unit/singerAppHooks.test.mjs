import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "vitest";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const singerAppPath = path.resolve(__dirname, "../../src/apps/Mobile/SingerApp.jsx");

test("SingerApp keeps React hooks above the render boundary", () => {
  const source = readFileSync(singerAppPath, "utf8");
  const renderBoundary = "const joinScreen = (";
  const renderBoundaryIndex = source.indexOf(renderBoundary);

  assert.notEqual(
    renderBoundaryIndex,
    -1,
    "SingerApp render boundary marker should exist so hook-order guard can run",
  );

  const afterRenderBoundary = source.slice(renderBoundaryIndex);
  const hookCallPattern = /\buse(?:State|Effect|Memo|Ref|Callback|DeferredValue|Transition|EffectEvent)\s*\(/g;

  assert.equal(
    hookCallPattern.test(afterRenderBoundary),
    false,
    "SingerApp must not declare React hooks after `joinScreen`; later mode returns can skip those hooks and crash the app",
  );
});

test("SingerApp declares ready-check auto-party copy before the ready-check render branch", () => {
  const source = readFileSync(singerAppPath, "utf8");
  const readyCheckBranch = "if (room?.readyCheck?.active) {";
  const autoMomentActiveDecl = "const autoCrowdMomentActive =";
  const autoMomentDetailDecl = "const autoCrowdMomentDetail =";
  const readyCheckBranchIndex = source.indexOf(readyCheckBranch);
  const autoMomentActiveIndex = source.indexOf(autoMomentActiveDecl);
  const autoMomentDetailIndex = source.indexOf(autoMomentDetailDecl);

  assert.notEqual(readyCheckBranchIndex, -1, "SingerApp ready-check branch should exist");
  assert.notEqual(autoMomentActiveIndex, -1, "SingerApp should declare auto-party active state");
  assert.notEqual(autoMomentDetailIndex, -1, "SingerApp should declare auto-party detail copy");
  assert.ok(
    autoMomentActiveIndex < readyCheckBranchIndex,
    "SingerApp must declare `autoCrowdMomentActive` before the ready-check render branch to avoid TDZ crashes",
  );
  assert.ok(
    autoMomentDetailIndex < readyCheckBranchIndex,
    "SingerApp must declare `autoCrowdMomentDetail` before the ready-check render branch to avoid TDZ crashes",
  );
});
