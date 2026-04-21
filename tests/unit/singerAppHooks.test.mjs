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

test("SingerApp declares bracket signup state before streamlined tight15 effects", () => {
  const source = readFileSync(singerAppPath, "utf8");
  const bracketSignupDecl = "const bracketSignupActive = isBracketSignupOpen(bracketSignupBracket);";
  const tight15Effect = "if (!isStreamlinedAudienceShell || songsTab !== 'tight15' || bracketSignupActive) return;";
  const bracketSignupIndex = source.indexOf(bracketSignupDecl);
  const tight15EffectIndex = source.indexOf(tight15Effect);

  assert.notEqual(
    bracketSignupIndex,
    -1,
    "SingerApp should declare bracket signup activity state",
  );
  assert.notEqual(
    tight15EffectIndex,
    -1,
    "SingerApp streamlined Tight 15 redirect effect should exist",
  );
  assert.ok(
    bracketSignupIndex < tight15EffectIndex,
    "SingerApp must declare `bracketSignupActive` before the streamlined Tight 15 effect to avoid TDZ crashes on audience boot",
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
    /const hideOmnipresentStageAreaForStreamlinedIdle = isStreamlinedAudienceShell && noSingerOnStage && !lobbyVolleySceneActive;/,
    "SingerApp should hide the omnipresent stage chrome in streamlined mode while the stage is empty",
  );
  assert.match(
    source,
    /const streamlinedSongsNavItems = \[\s*\{ key: 'requests', label: 'Add Song', icon: 'fa-plus' \},/,
    "SingerApp should label the streamlined request tab as Add Song so the primary action is obvious",
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
    /Search \+ Add Song/,
    "SingerApp should use Search + Add Song copy in streamlined mode",
  );
  assert.match(
    source,
    /Request a Song/,
    "SingerApp should expose a Request a Song CTA from streamlined party surfaces",
  );
  assert.match(
    source,
    /Open search, pick a song, and it goes straight to the queue\./,
    "SingerApp should explain the streamlined search flow directly under the primary action",
  );
  assert.match(
    source,
    /\(!isStreamlinedAudienceShell \|\| latestMyRequest \|\| activeRequestCount > 0\)/,
    "SingerApp should hide the streamlined My Requests panel until there is request state to show",
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
  assert.match(
    source,
    /Continue with a BeauRocks account to unlock custom emoji in this room\./,
    "SingerApp should explain room-level custom emoji account gating directly in the unlock path",
  );
  assert.match(
    source,
    /featureKey: AUDIENCE_FEATURE_KEYS\.premiumReactions,/,
    "SingerApp should evaluate room-level access for featured voting reaction emojis",
  );
  assert.match(
    source,
    /const premiumReactionsUnlocked = hasPremiumRoomAccess \|\| premiumReactionAccess\.allowed;/,
    "SingerApp should unlock featured voting reactions from either premium access or room audience access policy",
  );
  assert.match(
    source,
    /premiumReactionsUnlocked \? react\(t, cost\) : openVipUpgrade\(\)/,
    "SingerApp featured reaction buttons should use the room access policy instead of only VIP/support state",
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
    /const openAudienceCatalogSearch = useCallback\(\(\) => \{\s*setTab\('request'\);\s*setSongsTab\('requests'\);\s*setCatalogSearchMode\(preferredCatalogSearchMode\);\s*setCatalogSearchOpen\(true\);\s*\}, \[preferredCatalogSearchMode\]\);/,
    "SingerApp should move broken empty-stage search entry points to the request tab and open in the preferred mode",
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
    /const handleAudienceCatalogPrimaryAction = \(result\) => \{\s*if \(!result\) return;\s*if \(catalogSearchMode === 'youtube' && audienceManualBackingAllowed\)/,
    "SingerApp should route catalog result presses through a YouTube-first audience action",
  );
  assert.match(
    source,
    /const audienceInputShellClass = isStreamlinedAudienceShell\s*\?\s*'rounded-2xl border-2 border-cyan-200\/70 bg-white/,
    "SingerApp streamlined request fields should use a visible light input surface instead of transparent black-on-black fields",
  );
  assert.match(
    source,
    /const audienceSearchInputClass = isStreamlinedAudienceShell\s*\?\s*'flex-1 min-w-0 bg-transparent text-base font-semibold text-zinc-950 placeholder:text-zinc-600/,
    "SingerApp streamlined request fields should use dark input text and visible placeholder text",
  );
});

test("SingerApp keeps pop-up trivia voting prominent in audience shells", () => {
  const source = readFileSync(singerAppPath, "utf8");

  assert.match(
    source,
    /const showPopTriviaStandaloneSheet = !!popTriviaCardKey && showPopTriviaCard;/,
    "SingerApp should lift active pop-up trivia into a standalone sheet instead of leaving it inside the stage card",
  );
  assert.match(
    source,
    /const showPopTriviaPromptCta = !!popTriviaQuestion && popTriviaMyVote === null && showPopTriviaCard && !showPopTriviaStandaloneSheet;/,
    "SingerApp should only use the floating pop-up trivia CTA when the standalone sheet is not already open",
  );
  assert.match(
    source,
    /Answer pop-up trivia now/,
    "SingerApp should use urgent copy on the live trivia card",
  );
  assert.match(
    source,
    /data-feature-id="pop-trivia-standalone-sheet"/,
    "SingerApp should render pop-up trivia outside the clipped stage area",
  );
  assert.match(
    source,
    /showPopTriviaCard && !showPopTriviaStandaloneSheet/,
    "SingerApp should suppress the embedded stage trivia card while the standalone sheet is open",
  );
  assert.match(
    source,
    /max-h-\[calc\(100dvh-5\.5rem\)\] overflow-y-auto overscroll-contain touch-scroll-y/,
    "SingerApp standalone trivia sheet should be scrollable on small mobile screens",
  );
  assert.match(
    source,
    /Trivia Live: Tap An Answer/,
    "SingerApp floating engagement prompt should directly tell guests to answer",
  );
  assert.match(
    source,
    /border-yellow-200\/80 bg-yellow-300 text-black/,
    "SingerApp floating trivia CTA should use a high-contrast treatment",
  );
});

test("SingerApp gives audience members local applause tap feedback", () => {
  const source = readFileSync(singerAppPath, "utf8");

  assert.match(
    source,
    /const \[applauseTapCount, setApplauseTapCount\] = useState\(0\);/,
    "SingerApp should track the user's local applause tap count",
  );
  assert.match(
    source,
    /applauseSessionKeyRef\.current = sessionKey;\s*setApplauseTapCount\(0\);/,
    "SingerApp should reset local applause taps for each applause session",
  );
  assert.match(
    source,
    /setApplauseTapCount\(prev => prev \+ 1\);/,
    "SingerApp should increment local applause feedback when a clap tap is accepted",
  );
  assert.match(
    source,
    /Your Applause/,
    "SingerApp should label the local applause feedback block",
  );
  assert.match(
    source,
    /\{applauseTapCount\}/,
    "SingerApp should render the local applause tap count",
  );
});

test("SingerApp keeps audience stage collapse controls inside mobile viewport", () => {
  const source = readFileSync(singerAppPath, "utf8");

  assert.match(
    source,
    /className="flex flex-wrap items-center justify-between gap-2"/,
    "SingerApp stage headers should wrap instead of pushing controls off the right edge",
  );
  assert.match(
    source,
    /className="flex min-w-0 shrink-0 flex-wrap items-center justify-end gap-2"/,
    "SingerApp stage action clusters should shrink and wrap inside the card",
  );
  assert.match(
    source,
    /aria-label="Collapse stage panel"/,
    "SingerApp icon-only mobile collapse buttons should keep an accessible label",
  );
  assert.match(
    source,
    /inline-flex h-9 w-9 shrink-0 items-center justify-center[\s\S]*sm:h-auto sm:w-auto sm:px-3 sm:py-1\.5 sm:text-base/,
    "SingerApp collapse buttons should be compact on mobile and expand on wider screens",
  );
  assert.match(
    source,
    /<span className="hidden sm:inline">Collapse<\/span>/,
    "SingerApp should hide collapse text on narrow screens to prevent clipping",
  );
});
