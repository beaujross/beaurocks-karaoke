import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "vitest";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const singerAppPath = path.resolve(__dirname, "../../src/apps/Mobile/SingerApp.jsx");
const howToPlayPath = path.resolve(__dirname, "../../src/lib/howToPlay.js");

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
  assert.match(
    source,
    /Tonight&apos;s Points/,
    "SingerApp points modal should lead with a plain summary of tonight's points config",
  );
  assert.match(
    source,
    /How To Earn More/,
    "SingerApp points modal should group point-earning paths into one clear section",
  );
  assert.match(
    source,
    /Quest Log/,
    "SingerApp points modal should expose festival quests as a dedicated log",
  );
  assert.match(
    source,
    /Donate with Givebutter/,
    "SingerApp points modal should keep one primary donation CTA instead of burying support across multiple cards",
  );
  assert.match(
    source,
    /supportWidgetId: String\(source\.supportWidgetId \|\| ''\)\.trim\(\)/,
    "SingerApp should preserve a room-level Givebutter widget id in the active event credits config",
  );
  assert.match(
    source,
    /React\.createElement\('givebutter-widget', \{ id: roomSupportWidgetId \}\)/,
    "SingerApp should render a Givebutter widget inside the support modal when a widget id is configured",
  );
  assert.match(
    source,
    /Every \$1 donated tonight via Givebutter credits the entire room with about/,
    "SingerApp donation section should explain the room-wide points effect of Givebutter support",
  );
  assert.match(
    source,
    /MONEYBAGS_BADGE_LABEL.*latest room-wide support burst|MONEYBAGS_BADGE_LABEL.*spotlight a supporter after a room-wide donation burst/,
    "SingerApp donation section should explain the Moneybags supporter spotlight",
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
    /const streamlinedSongsNavItems = \[\s*\{ key: 'browse', label: 'Add Song', icon: 'fa-magnifying-glass' \},/,
    "SingerApp should keep streamlined song tabs focused on Add Song and View Queue instead of drifting button language",
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
    /Add Song/,
    "SingerApp should use Add Song as the primary request CTA label",
  );
  assert.match(
    source,
    /Host Review Pending/,
    "SingerApp should keep the request CTA language tight and only branch for true review states",
  );
  assert.match(
    source,
    /Room Ready/,
    "SingerApp streamlined idle home should read as room status instead of a duplicate request funnel",
  );
  assert.match(
    source,
    /No one is on stage yet/,
    "SingerApp streamlined idle home should keep the copy focused on room status and pacing",
  );
  assert.match(
    source,
    /data-feature-id="singer-streamlined-idle-request-cta"/,
    "SingerApp streamlined idle home should expose a dedicated request CTA for QA and regression coverage",
  );
  assert.match(
    source,
    /Add Song/,
    "SingerApp streamlined idle home should route guests into the Songs tab with the same Add Song language used elsewhere",
  );
  assert.match(
    source,
    /\) : showStreamlinedIdleReactionGuide \? \(/,
    "SingerApp should not render the weaker Stage Open add-song card when the stronger Room Ready idle card is already on screen",
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
    /Sing, support, or just wait for the room to light up\. Songs is for joining the queue\. Party is for reacting once someone is live\./,
    "SingerApp streamlined idle home should explain the three audience intents while still making Songs own the queue and Party own the live reaction state",
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
  assert.match(
    source,
    /const streamlinedPerformanceVotingBannerVisible = isStreamlinedAudienceShell && karaokePerformanceVotingOpen && tab === 'request';/,
    "SingerApp should detect when streamlined guests are in Songs while a live performance vote is happening",
  );
  assert.match(
    source,
    /item\.key === 'home' && showPerformanceVotingPromptCta/,
    "SingerApp should mark the Party tab as live when voting is open away from home",
  );
  assert.match(
    source,
    /data-feature-id="singer-streamlined-performance-vote-banner"/,
    "SingerApp should surface a dedicated voting callout inside streamlined Songs",
  );
  assert.match(
    source,
    /A TV scene is live\. Jump back to Party to clap vote\.|A performance is on\. Jump back to Party to vote and react\./,
    "SingerApp should tell streamlined guests exactly why they should leave search and go back to Party",
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

test("SingerApp gives streamlined join and first-song flows clearer onboarding cues", () => {
  const source = readFileSync(singerAppPath, "utf8");

  assert.match(
    source,
    /Choose your emoji and enter your name to jump into Songs\./,
    "SingerApp join should keep the immediate next step clear without the extra step strip",
  );
  assert.doesNotMatch(
    source,
    /Pick Emoji|Add Name|Festival Join Ready/,
    "SingerApp join should remove the old step labels and extra ready pill from the festival join screen",
  );
  assert.match(
    source,
    /const joinButtonLabel = isJoining[\s\S]*'JOINING\.\.\.'[\s\S]*'JOIN THE PARTY'[\s\S]*'ADD YOUR NAME';/,
    "SingerApp join CTA should explain why the button is not ready when the name is missing",
  );
  assert.match(
    source,
    /Name shows in the queue and on the room screen\./,
    "SingerApp join should tell guests where their entered name will appear",
  );
  assert.match(
    source,
    /Songs opens first so you can add yourself fast\./,
    "SingerApp join should reinforce the immediate post-join destination",
  );
  assert.match(
    source,
    /Songs is where you add yourself\. Party is where you react once the room is rolling\./,
    "SingerApp idle home should explain the difference between streamlined Party and Songs surfaces",
  );
  assert.match(
    source,
    /Search for your first song/,
    "SingerApp streamlined browse should celebrate entry and guide first-time singers toward their first request",
  );
  assert.match(
    source,
    /3 Back to Party/,
    "SingerApp streamlined browse should teach the full search, queue, and return-to-party loop",
  );
  assert.match(
    source,
    /const \[isJoining, setIsJoining\] = useState\(false\);/,
    "SingerApp should track join-in-flight state for async room entry",
  );
  assert.match(
    source,
    /const joinButtonLabel = isJoining[\s\S]*'JOINING\.\.\.'/,
    "SingerApp join CTA should switch into a visible joining state after the guest taps it",
  );
  assert.match(
    source,
    /Adding you to the room now\. This can take a moment\./,
    "SingerApp join flow should explain that the room entry is still in progress",
  );
  assert.match(
    source,
    /data-singer-night-guide-button/,
    "SingerApp festival join should keep the night-guide CTA available on the join screen",
  );
  assert.match(
    source,
    /renderNightGuideModal/,
    "SingerApp festival join should open the night guide inside the app instead of a new tab",
  );
  assert.match(
    source,
    /setIsJoining\(true\);[\s\S]*finally \{\s*setIsJoining\(false\);/m,
    "SingerApp should always clear join-in-flight state after join resolves or fails",
  );
});

test("SingerApp shows visible in-flight feedback while adding songs to the queue", () => {
  const source = readFileSync(singerAppPath, "utf8");

  assert.match(
    source,
    /const \[requestSubmitPending, setRequestSubmitPending\] = useState\(false\);/,
    "SingerApp should track audience queue-submit pending state",
  );
  assert.match(
    source,
    /if \(requestSubmitPending\) return;/,
    "SingerApp should suppress duplicate queue submissions while one is already in flight",
  );
  assert.match(
    source,
    /setRequestSubmitPending\(true\);[\s\S]*finally \{\s*setRequestSubmitPending\(false\);/m,
    "SingerApp should bracket queue submissions with an explicit pending lifecycle",
  );
  assert.match(
    source,
    /data-feature-id="singer-request-pending-indicator"/,
    "SingerApp should render a visible pending indicator while a song request is being submitted",
  );
  assert.match(
    source,
    /Adding song to the queue\.\.\.|Adding .* to the queue\.\.\./,
    "SingerApp pending indicator should tell the guest that the song request is still processing",
  );
  assert.match(
    source,
    /Sending Request\.\.\./,
    "SingerApp manual request submit button should acknowledge the tap while waiting on the network",
  );
});

test("SingerApp shows pending feedback for slower audience game submissions and votes", () => {
  const source = readFileSync(singerAppPath, "utf8");

  assert.match(
    source,
    /const \[doodleSubmitting, setDoodleSubmitting\] = useState\(false\);/,
    "SingerApp should track in-flight doodle submissions",
  );
  assert.match(
    source,
    /const \[doodleVotePendingUid, setDoodleVotePendingUid\] = useState\(''\);/,
    "SingerApp should track in-flight doodle votes",
  );
  assert.match(
    source,
    /Submitting\.\.\./,
    "SingerApp should acknowledge slower audience game submissions with explicit pending button copy",
  );
  assert.match(
    source,
    /Uploading your drawing now\.\.\./,
    "SingerApp should explain that a doodle submission is still uploading",
  );
  assert.match(
    source,
    /const \[selfieChallengeSubmitting, setSelfieChallengeSubmitting\] = useState\(false\);/,
    "SingerApp should track in-flight selfie challenge submissions",
  );
  assert.match(
    source,
    /const \[selfieVotePendingUid, setSelfieVotePendingUid\] = useState\(''\);/,
    "SingerApp should track in-flight selfie challenge votes",
  );
  assert.match(
    source,
    /Submitting your selfie\.\.\./,
    "SingerApp should show clear progress text after a selfie challenge submit tap",
  );
  assert.match(
    source,
    /Sending vote\.\.\./,
    "SingerApp should show explicit vote-in-flight feedback in selfie challenge voting",
  );
  assert.match(
    source,
    /const \[bingoSpinPending, setBingoSpinPending\] = useState\(false\);/,
    "SingerApp should track in-flight bingo spin requests",
  );
  assert.match(
    source,
    /const \[bingoSuggestSubmitting, setBingoSuggestSubmitting\] = useState\(false\);/,
    "SingerApp should track in-flight bingo confirmations",
  );
  assert.match(
    source,
    /Spinning\.\.\./,
    "SingerApp should acknowledge mystery bingo spin requests while the room write is pending",
  );
  assert.match(
    source,
    /Sending\.\.\./,
    "SingerApp should acknowledge bingo note submissions while they are being sent",
  );
});

test("SingerApp keeps streamlined empty-stage party focused on guidance instead of live spending", () => {
  const source = readFileSync(singerAppPath, "utf8");

  assert.match(
    source,
    /const showStreamlinedIdleReactionGuide = showStreamlinedIdleRequestCard && !performanceReactionsReady;/,
    "SingerApp should derive a dedicated streamlined empty-stage reaction guide instead of falling through to live reaction controls",
  );
  assert.match(
    source,
    /data-feature-id="singer-streamlined-idle-reaction-guide"/,
    "SingerApp should expose a dedicated empty-stage reaction guide card for streamlined Party",
  );
  assert.match(
    source,
    /Party reactions unlock when a singer is performing/,
    "SingerApp should explicitly tell streamlined audiences that reaction spending waits for a live singer",
  );
  assert.match(
    source,
    /if \(!currentSinger && !applauseModeActive && !takeoverClapVotingActive\) return toast\('Reactions wake up once someone is on stage or a scene goes live\.'\);/,
    "SingerApp should keep scene takeovers eligible for live reaction spending while idle rooms stay blocked",
  );
});

test("SingerApp uses room-aware how-to guidance instead of the old static audience explainer", () => {
  const singerSource = readFileSync(singerAppPath, "utf8");
  const howToPlaySource = readFileSync(howToPlayPath, "utf8");

  assert.match(
    singerSource,
    /const singerHowToPlay = useMemo\(\(\) => buildSingerHowToPlay\(room\), \[room\]\);/,
    "SingerApp should build its how-to modal from the current room state",
  );
  assert.match(
    singerSource,
    /Swipe through room tips -/,
    "SingerApp how-to modal should present the updated room-tip framing instead of the older generic browse copy",
  );
  assert.match(
    howToPlaySource,
    /export const buildSingerHowToPlay = \(room = null\) => \{/,
    "How-to content should be generated through a room-aware builder",
  );
  assert.match(
    howToPlaySource,
    /Reactions only spend points while someone is performing\./,
    "How-to guidance should explain the current reaction-spend rule directly",
  );
  assert.match(
    howToPlaySource,
    /Tonight\\'s Game Deck/,
    "How-to guidance should expose a dedicated game-focused slide instead of drifting into old generic copy",
  );
  assert.match(
    howToPlaySource,
    /Pop-Up Trivia|Mystery Bingo|Selfie Challenge|Doodle-Oke|Voice Games/,
    "How-to guidance should mention the room's audience game lineup",
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

test("SingerApp opens free clap voting for generic TV scene takeovers", () => {
  const source = readFileSync(singerAppPath, "utf8");

  assert.match(
    source,
    /const sceneReactionVotingActive = !!room\?\.announcement\?\.active && !!announcementTakeoverScene;/,
    "SingerApp should detect generic TV and run-of-show scene takeovers from the room announcement payload",
  );
  assert.match(
    source,
    /const takeoverClapVotingActive = sceneReactionVotingActive[\s\S]*takeoverReactionMode !== 'off'[\s\S]*!currentSinger;/,
    "SingerApp should only switch into scene clap-vote mode when the scene explicitly allows it and is not piggybacking on a live singer",
  );
  assert.match(
    source,
    /if \(takeoverClapVotingActive && safeType === 'clap'\) nextCost = 0;/,
    "SingerApp scene takeover clap votes should be free to tap",
  );
  assert.match(
    source,
    /const performanceReactionsReady = !!currentSinger \|\| applauseModeActive \|\| takeoverClapVotingActive;/,
    "SingerApp should treat scene clap voting as a live participation lane instead of an empty idle state",
  );
  assert.match(
    source,
    /Scene Clap Voting/,
    "SingerApp should label the scene takeover clap-vote state explicitly for the audience",
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
  assert.match(
    source,
    /<span>Audience Video<\/span>[\s\S]*>\s*Hide\s*<\/button>[\s\S]*>\s*Full screen\s*<\/button>/,
    "SingerApp should keep a hide action inside the expanded audience video panel",
  );
  assert.match(
    source,
    /This room is locked to YouTube karaoke search for guest requests\./,
    "SingerApp should explain when the host locked guest search to YouTube only",
  );
});

test("SingerApp lets locked emoji become the active preview and includes new themed avatars", () => {
  const source = readFileSync(singerAppPath, "utf8");

  assert.match(
    source,
    /const \[avatarPreviewEmoji, setAvatarPreviewEmoji\] = useState\(''\);/,
    "SingerApp should track avatar preview separately from the saved avatar choice",
  );
  assert.match(
    source,
    /const activeAvatarPreviewEmoji = avatarPreviewEmoji \|\| form\.emoji \|\| user\?\.avatar \|\| DEFAULT_EMOJI;/,
    "SingerApp should derive a preview avatar even when the locked choice is not yet equipped",
  );
  assert.match(
    source,
    /setAvatarPreviewEmoji\(item\?\.emoji \|\| ''\);[\s\S]*if \(!status\.locked\)/,
    "SingerApp should preview a tapped avatar before deciding whether it can be equipped",
  );
  assert.match(
    source,
    /Cherry Blossom/,
    "SingerApp should include a cherry blossom themed avatar",
  );
  assert.match(
    source,
    /Lantern/,
    "SingerApp should include a lantern themed avatar",
  );
  assert.match(
    source,
    /Carp Banner/,
    "SingerApp should include a carp-banner themed avatar",
  );
  assert.match(
    source,
    /Rice Ball/,
    "SingerApp should include a rice-ball themed avatar",
  );
});

test("SingerApp presents the premium blossom reaction with themed icon motion", () => {
  const source = readFileSync(singerAppPath, "utf8");

  assert.match(
    source,
    /money:'BLOOM'/,
    "SingerApp should rename the former Rich premium reaction to Bloom.",
  );
  assert.match(
    source,
    /getReactionEmoji\(t, EMOJI\.heart\)/,
    "SingerApp reaction buttons should use the shared reaction emoji mapping instead of the generic money bag icon.",
  );
  assert.match(
    source,
    /animate-reaction-option-blossom/,
    "SingerApp should give the blossom reaction button its own themed motion treatment.",
  );
});
