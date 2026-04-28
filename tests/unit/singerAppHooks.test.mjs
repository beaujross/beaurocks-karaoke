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

test("SingerApp keeps event bonus messaging automatic and renders reaction cooldown inside the button shell", () => {
  const source = readFileSync(singerAppPath, "utf8");

  assert.match(
    source,
    /Official event links, QR drops, and ticket-matched perks can add more automatically without slowing down the room\./,
    "SingerApp should describe event bonuses as automatic instead of manual claims",
  );
  assert.match(
    source,
    /Official event links and ticket-matched perks can unlock bonuses automatically\. Only use a promo code here when the event explicitly shares one\./,
    "SingerApp should steer guests away from claim-step language in the event credits drawer",
  );
  assert.match(
    source,
    /const renderReactionCooldownFill = useCallback\(/,
    "SingerApp should centralize the cooldown overlay so reaction buttons do not resize when cooling down",
  );
  assert.match(
    source,
    /pointer-events-none absolute inset-0 overflow-hidden/,
    "SingerApp cooldown treatment should stay inside the button bounds",
  );
  assert.match(
    source,
    /Tap to push the applause meter/,
    "SingerApp applause takeover should keep stable helper copy instead of swapping layout around a cooldown badge",
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
    /const showStreamlinedIdleRequestCard = shouldShowStreamlinedIdleRequestCard\(\{/,
    "SingerApp should derive the streamlined idle request-first state through a dedicated helper",
  );
  assert.match(
    source,
    /const streamlinedSongsNavItems = \[\s*\{ key: 'browse', label: 'Browse', icon: 'fa-magnifying-glass' \},/,
    "SingerApp should keep streamlined song tabs focused on browse and queue instead of generic button actions",
  );
  assert.match(
    source,
    /const streamlinedSongsTabActiveStyle = useMemo\(\(\) => \(\{/,
    "SingerApp should give streamlined song subtabs a dedicated tab style instead of reusing action pill styling",
  );
  assert.match(
    source,
    /role="tablist"\s+aria-label="Song request sections"/,
    "SingerApp should render Add Song and Queue as tabs in the streamlined song area",
  );
  assert.match(
    source,
    /className="grid gap-1 border-b border-white\/10 px-1 pt-1"\s+style=\{\{ gridTemplateColumns: `repeat\(\$\{streamlinedSongsNavItems\.length\}, minmax\(0, 1fr\)\)` \}\}/,
    "SingerApp streamlined song tabs should use a flat tab strip that adapts to optional tabs",
  );
  assert.match(
    source,
    /role="tab"\s+aria-selected=\{isActive\}/,
    "SingerApp streamlined song tab buttons should expose selected state semantically",
  );
  assert.match(
    source,
    /relative inline-flex min-h-\[38px\] items-center justify-center gap-2 border-b-2 px-2 pb-2 pt-1 text-\[11px\]/,
    "SingerApp streamlined song tabs should look like tabs, not rounded action buttons",
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
    /Room Ready/,
    "SingerApp streamlined idle home should read as room status instead of a duplicate request funnel",
  );
  assert.match(
    source,
    /The room is open and the next singer slot is coming up/,
    "SingerApp streamlined idle home should keep the copy focused on room status and pacing",
  );
  assert.match(
    source,
    /data-feature-id="singer-streamlined-idle-request-cta"/,
    "SingerApp streamlined idle home should expose a dedicated request CTA for QA and regression coverage",
  );
  assert.match(
    source,
    /Open Songs/,
    "SingerApp streamlined idle home should route guests into the Songs tab instead of duplicating request language",
  );
  assert.match(
    source,
    /How it works/,
    "SingerApp streamlined idle home should keep help available as a small secondary action instead of a full utility tile row",
  );
  assert.match(
    source,
    /Open search, pick a song, and it goes straight to the queue\./,
    "SingerApp should explain the streamlined search flow directly under the primary action",
  );
  assert.match(
    source,
    /Use the Songs tab when you are ready to search\. From here, just keep an eye on the queue and room activity\./,
    "SingerApp streamlined idle home should explain that the Party view is status-first while Songs owns search",
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
  assert.match(
    source,
    /grid w-full gap-2 \$\{isStreamlinedAudienceShell \? 'grid-cols-2' : 'grid-cols-3'\}/,
    "SingerApp should trim the always-visible utility row in streamlined mode so idle home stays focused on request and queue actions",
  );
  assert.match(
    source,
    /!isStreamlinedAudienceShell && \(\s*<button onClick=\{\(\) => setShowHowToPlay\(true\)\}/,
    "SingerApp should demote the How to Play utility button out of the streamlined always-visible action row",
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
    /const openAudienceCatalogSearch = useCallback\(\(\) => \{\s*setTab\('request'\);\s*setSongsTab\(isStreamlinedAudienceShell \? 'browse' : 'requests'\);\s*setCatalogSearchMode\(preferredCatalogSearchMode\);\s*setCatalogSearchOpen\(true\);\s*\}, \[isStreamlinedAudienceShell, preferredCatalogSearchMode\]\);/,
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

test("SingerApp applies host-configured reaction cooldowns and co-host credit policy", () => {
  const source = readFileSync(singerAppPath, "utf8");

  assert.match(
    source,
    /coHostCreditPolicy: normalizeCoHostCreditPolicy\(source\.coHostCreditPolicy \|\| ''\)/,
    "SingerApp should read the co-host credit policy from room event credits",
  );
  assert.match(
    source,
    /reactionTapCooldownMs: normalizeReactionTapCooldownMs\(source\.reactionTapCooldownMs \?\? DEFAULT_REACTION_TAP_COOLDOWN_MS\)/,
    "SingerApp should read the host-configured reaction cooldown from room event credits",
  );
  assert.match(
    source,
    /const coHostUnlimitedCredits = isRunOfShowCoHost && coHostCreditPolicy === CO_HOST_CREDIT_POLICIES\.unlimited;/,
    "SingerApp should support unlimited co-host credit policy",
  );
  assert.match(
    source,
    /const coHostFreeReactions = isRunOfShowCoHost[\s\S]*CO_HOST_CREDIT_POLICIES\.freeReactions[\s\S]*CO_HOST_CREDIT_POLICIES\.unlimited/,
    "SingerApp should let co-host reactions run free under the configured policy",
  );
  assert.match(
    source,
    /const \[reactionCooldownByType, setReactionCooldownByType\] = useState\(\{\}\);/,
    "SingerApp should track reaction cooldowns per reaction key instead of sharing one room-wide lockout",
  );
  assert.match(
    source,
    /const getReactionCooldownRemainingMs = useCallback\(\(reactionKey = ''\) =>/,
    "SingerApp should resolve cooldown timers per reaction key",
  );
  assert.match(
    source,
    /const cooldownUntil = Number\(reactionCooldownByType\?\.\[safeType\] \|\| 0\);/,
    "SingerApp should look up cooldown state for the tapped reaction only",
  );
  assert.match(
    source,
    /setReactionCooldownByType\(\(prev\) => applyReactionCooldown\(prev, safeType, now, reactionTapCooldownMs\)\);/,
    "SingerApp should start a cooldown only for the tapped reaction button via the extracted helper",
  );
  assert.match(
    source,
    /renderReactionCooldownFill/,
    "SingerApp should render the cooldown countdown inside cooled-down reaction controls",
  );
  assert.match(
    source,
    /Tap to push the applause meter/,
    "SingerApp applause mode should keep the helper copy stable while the cooldown lives inside the clap button",
  );
  assert.match(
    source,
    /displayValue=\{coHostUnlimitedCredits \? '∞' : null\}/,
    "SingerApp should visually show unlimited co-host credits in the audience points pill",
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
