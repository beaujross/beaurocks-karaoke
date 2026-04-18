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

test("SingerApp keeps streamlined audience shell inside party and songs flows", () => {
  const source = readFileSync(singerAppPath, "utf8");

  assert.match(
    source,
    /const primaryStageTabs = isStreamlinedAudienceShell \? \['home', 'request'\] : \['home', 'request', 'social'\];/,
    "SingerApp should treat streamlined stage tabs as party and songs only",
  );
  assert.match(
    source,
    /if \(!isStreamlinedAudienceShell \|\| tab !== 'social'\) return;\s*setTab\('home'\);/,
    "SingerApp should bounce streamlined audiences back to party if stale state lands on social",
  );
  assert.match(
    source,
    /if \(isStreamlinedAudienceShell\) \{\s*openEditProfile\(\);\s*return;\s*}\s*setTab\('social'\);\s*setSocialTab\('profile'\);/,
    "SingerApp should route the streamlined profile shortcut to the profile editor instead of the social tab",
  );
  assert.match(
    source,
    /isStreamlinedAudienceShell \? 'View Queue' : 'Open Lobby'/,
    "SingerApp should swap the empty-stage secondary action to queue in streamlined mode",
  );
  assert.match(
    source,
    /const showStreamlinedStageNav = isStreamlinedAudienceShell && \['home', 'request', 'social'\]\.includes\(tab\);/,
    "SingerApp should keep the streamlined top nav eligible across home, songs, and stale social states",
  );
  const streamlinedStageNavRenderIndex = source.indexOf("{streamlinedStageNav}");
  const omnipresentStageAreaIndex = source.indexOf("/* Omnipresent Stage Area */");

  assert.notEqual(
    streamlinedStageNavRenderIndex,
    -1,
    "SingerApp should render the streamlined top nav in the main shell",
  );
  assert.notEqual(
    omnipresentStageAreaIndex,
    -1,
    "SingerApp omnipresent stage area marker should exist",
  );
  assert.ok(
    streamlinedStageNavRenderIndex < omnipresentStageAreaIndex,
    "SingerApp should render the streamlined top nav outside the omnipresent stage gate so it stays visible when the stage is idle",
  );
});

test("SingerApp defaults guest backing rooms to YouTube search", () => {
  const source = readFileSync(singerAppPath, "utf8");

  assert.match(
    source,
    /const preferredCatalogSearchMode = audienceManualBackingAllowed \? 'youtube' : 'catalog';/,
    "SingerApp should derive a preferred audience search mode from the room backing policy",
  );
  assert.match(
    source,
    /const openAudienceCatalogSearch = useCallback\(\(\) => \{\s*setCatalogSearchMode\(preferredCatalogSearchMode\);\s*setCatalogSearchOpen\(true\);\s*\}, \[preferredCatalogSearchMode\]\);/,
    "SingerApp should open the audience search sheet in the preferred mode instead of always starting in catalog",
  );
  assert.match(
    source,
    /if \(catalogSearchOpen\) return;\s*setCatalogSearchMode\(preferredCatalogSearchMode\);/,
    "SingerApp should reset closed audience searches back to the preferred mode for the next open",
  );
  assert.match(
    source,
    /if \(audienceManualBackingAllowed \|\| catalogSearchMode !== 'youtube'\) return;\s*setCatalogSearchMode\('catalog'\);/,
    "SingerApp should fall back to catalog mode if guest YouTube selection stops being allowed",
  );
  assert.match(
    source,
    /onClick=\{openAudienceCatalogSearch\}/,
    "SingerApp should route audience search entry points through the preferred-mode opener",
  );
  assert.match(
    source,
    /if \(searchQ.length < 3\) \{\s*setResults\(\[\]\);\s*setCatalogResultsLoading\(false\);\s*return;\s*\}/,
    "SingerApp should keep catalog song matching active for typed audience searches instead of gating it behind catalog-only mode",
  );
  assert.match(
    source,
    /Song matches/,
    "SingerApp should show song matches in YouTube mode so guest-pick search starts with canonical song lookup context",
  );
  assert.match(
    source,
    /Direct YouTube Results/,
    "SingerApp should still show direct YouTube karaoke hits in guest-pick mode",
  );
  assert.match(
    source,
    /const handleAudienceCatalogPrimaryAction = useCallback\(/,
    "SingerApp should route catalog result presses through a YouTube-first audience action",
  );
});
