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

test("SingerApp treats host-room-mic vocal games as audience prompts instead of duplicate game screens", () => {
  const source = readFileSync(singerAppPath, "utf8");

  assert.match(
    source,
    /const isHostRoomMicVoiceGame = isVoiceGame && voiceInputMode === 'host' && \(hostRoomMicSource \|\| hostRoomMicPlayerId\);/,
    "SingerApp should detect crowd voice games driven by the Host room mic",
  );
  assert.match(
    source,
    /data-feature-id="audience-room-mic-voice-prompt"/,
    "SingerApp should render a dedicated lightweight audience prompt for Host room mic voice games",
  );
  assert.match(
    source,
    /Watch the main screen and sing with the room\. The Host room mic is the controller for this round\./,
    "SingerApp should tell audience members to use the room mic and main screen instead of local game visuals",
  );
  assert.match(
    source,
    /setTab\('request'\);\s*setSongsTab\('browse'\);/,
    "SingerApp should let guests leave the room-mic prompt and add songs",
  );
  assert.match(
    source,
    /setTab\('request'\);\s*setSongsTab\('queue'\);/,
    "SingerApp should let guests leave the room-mic prompt and view the queue",
  );
  assert.match(
    source,
    /if \(!hideBingoOverlay && !hideAudienceRoomMicVoiceOverlay\)/,
    "SingerApp should avoid falling through to the full GameContainer when the room-mic prompt is minimized",
  );
});

test("SingerApp keeps event bonus messaging automatic and renders reaction cooldown inside the button shell", () => {
  const source = readFileSync(singerAppPath, "utf8");

  assert.match(
    source,
    /Room promos, QR drops, and host-published codes can add more when they are active\./,
    "SingerApp should describe event bonuses as host-configured room mechanics instead of manual claims",
  );
  assert.match(
    source,
    /Room links and host-published codes can unlock bonuses\. Only use a promo code here when the host or event explicitly shares one\./,
    "SingerApp should steer guests toward host-published promo language in the event credits drawer",
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
    /Tonight&apos;s wallet/,
    "SingerApp points modal should lead with a clear wallet summary",
  );
  assert.match(
    source,
    /Buy points for everyone/,
    "SingerApp points modal should merchandise room-wide boosts as the social purchase",
  );
  assert.match(
    source,
    /Free ways to earn/,
    "SingerApp points modal should expose room bonus opportunities as a dedicated section",
  );
  assert.match(
    source,
    /{supportCtaLabel}/,
    "SingerApp points modal should keep one primary host-configured support CTA instead of burying support across multiple cards",
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
    /Every \$1 through \$\{supportProviderLabel\} gives the room about/,
    "SingerApp donation section should explain the room-wide points effect of the configured support provider",
  );
  assert.match(
    source,
    /MONEYBAGS_BADGE_LABEL[\s\S]*spotlight appears with the room burst/,
    "SingerApp room boost section should explain the Moneybags supporter spotlight",
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
    /item\.key === 'home' && showPerformanceVotingPromptCta[\s\S]*animate-pulse/,
    "SingerApp should mark the Party tab with a pulsing live badge when voting is open away from home",
  );
  assert.doesNotMatch(
    source,
    /data-feature-id="singer-streamlined-performance-vote-banner"|Vote live now|Go Vote/,
    "SingerApp should not duplicate the streamlined Songs stage area with a full voting banner",
  );
  assert.match(
    source,
    /NOW PERFORMING[\s\S]*Vote Now[\s\S]*setTab\('home'\)/,
    "SingerApp should surface a compact vote tag inside the now-performing stage card",
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
    /Pick the emoji that feels most you\./,
    "SingerApp join should keep the hero copy concise now that the detailed Songs guidance lives in the supporting onboarding text",
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
  assert.doesNotMatch(
    source,
    /1 Search|2 Queue It|3 Back to Party|Watch Queue/,
    "SingerApp streamlined browse should drop the old step strip and redundant queue button now that Songs nav already exposes Queue",
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
  assert.doesNotMatch(
    source,
    /Request sent/,
    "SingerApp should not keep rendering a separate request-sent banner above the songs workspace",
  );
  assert.match(
    source,
    /getAudienceRequestStateDetailClass\(latestMyRequestStateMeta\.tone\)/,
    "SingerApp should render request-state detail inline inside My Requests instead of a detached confirmation banner",
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
    /playableOnly: true,/,
    "Audience direct YouTube search should always use the embeddable/playable-only result set",
  );
  assert.match(
    source,
    /\.filter\(\(item\) => item\.youtubePlaybackStatus === YOUTUBE_PLAYBACK_STATUSES\.embeddable\)/,
    "Audience direct YouTube search should not render non-embeddable results even from cache",
  );
  assert.match(
    source,
    /Pick a YouTube result that can play inside Public TV\./,
    "Audience direct YouTube selection should guard against stale non-embeddable result clicks",
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

test("SingerApp browse overlays use the same viewport sheet isolation as other mobile sheets", () => {
  const source = readFileSync(singerAppPath, "utf8");

  assert.match(
    source,
    /const browseOverlayOpen = !!activeBrowseList \|\| showTop100 \|\| showYtIndex;/,
    "SingerApp should track browse overlays as a shared mobile sheet state",
  );
  assert.match(
    source,
    /\!\(catalogSearchOpen \|\| manualRequestComposerOpen \|\| browseOverlayOpen\)/,
    "SingerApp should freeze body scroll while a browse overlay is open",
  );
  assert.match(
    source,
    /\{activeBrowseList && renderAudienceViewportSheet\(/,
    "SingerApp should portal custom browse-list overlays out of the stage shell stack",
  );
  assert.match(
    source,
    /\{showTop100 && renderAudienceViewportSheet\(/,
    "SingerApp should portal the Top 100 overlay out of the stage shell stack",
  );
  assert.match(
    source,
    /\{showYtIndex && renderAudienceViewportSheet\(/,
    "SingerApp should portal the room-library overlay out of the stage shell stack",
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
    /caption=\{coHostUnlimitedCredits \? 'FREE' : 'PTS'\}/,
    "SingerApp should label the audience points pill as free for unlimited co-host credits",
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
  assert.doesNotMatch(
    source,
    /controls=1/,
    "SingerApp audience YouTube embeds should not expose native YouTube controls",
  );
  assert.match(
    source,
    /autoplay=1&controls=0&disablekb=1&fs=0/,
    "SingerApp audience YouTube embeds should disable controls, keyboard shortcuts, and fullscreen affordances",
  );
  assert.doesNotMatch(
    source,
    /allow="autoplay; fullscreen"/,
    "SingerApp audience YouTube embeds should not grant iframe fullscreen permission",
  );
  assert.match(
    source,
    /allow="autoplay; encrypted-media"/,
    "SingerApp audience YouTube embeds should only request autoplay and encrypted media permissions",
  );
  assert.match(
    source,
    /className="absolute inset-0 w-full h-full pointer-events-none select-none"/,
    "SingerApp audience YouTube iframes should not receive touch or pointer input over app controls",
  );
  assert.match(
    source,
    /drift > 2\.5/,
    "SingerApp audience YouTube sync should avoid constant small seek corrections that make playback choppy",
  );
  assert.match(
    source,
    /room\?\.videoPlaying \? 2200 : 1600/,
    "SingerApp audience YouTube sync should poll less aggressively while keeping host playback state aligned",
  );
  assert.match(
    source,
    /SYNCING/,
    "SingerApp audience video badge should show when the YouTube iframe is still becoming ready",
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

test("SingerApp audience video sync uses the active performance session clock", () => {
  const source = readFileSync(singerAppPath, "utf8");
  assert.match(source, /const audiencePerformanceSession = room\?\.currentPerformanceSession \|\| \{\};/);
  assert.match(source, /const getAudiencePlaybackTargetSec = useCallback/);
  assert.match(source, /session\?\.playerPositionSec/);
  assert.match(source, /session\?\.lastHeartbeatAtMs \|\| session\?\.lastReportedAtMs/);
  assert.match(source, /const audienceYoutubeFrameKey = `\$\{youtubeId \|\| ''\}_\$\{audiencePlaybackClockKey\}`;/);
  assert.match(source, /postAudienceYoutubeCommand\(isAudiencePlaybackExpectedPlaying\(\) \? 'playVideo' : 'pauseVideo'/);
});


test("SingerApp backs off expected camera-in-use failures instead of retry-spamming selfie capture", () => {
  const source = readFileSync(singerAppPath, "utf8");

  assert.match(
    source,
    /const EXPECTED_CAMERA_ERROR_NAMES = new Set\(\['NotReadableError',[\s\S]*'OverconstrainedError'\]\);/,
    "SingerApp should classify browser camera lock and permission failures as expected camera errors",
  );
  assert.match(
    source,
    /const cameraStartPromiseRef = useRef\(null\);[\s\S]*const cameraRetryAfterRef = useRef\(0\);/,
    "SingerApp should dedupe in-flight getUserMedia calls and keep a retry cooldown",
  );
  assert.match(
    source,
    /if \(!force && cameraRetryAfterRef\.current > now\) return false;/,
    "SingerApp should avoid immediately retrying camera startup after a browser camera-in-use failure",
  );
  assert.match(
    source,
    /cameraRetryAfterRef\.current = Date\.now\(\) \+ \(expected \? 8000 : 2500\);/,
    "Expected camera failures should pause retries long enough to stop console spam",
  );
  assert.match(
    source,
    /const started = await startCamera\(\);\s*if \(!started\) throw createCameraUnavailableError\(\);/,
    "Selfie capture should stop after a failed camera start instead of waiting for an impossible frame",
  );
  assert.match(
    source,
    /if \(!isExpectedCameraError\(e\)\) console\.error\(e\);/,
    "Expected camera errors should be surfaced as UI messages without console error spam",
  );
  assert.match(
    source,
    /Camera is already in use or unavailable\. Close other camera apps or tabs, then try again\./,
    "Camera-in-use failures should tell guests how to recover",
  );
});

test("SingerApp declares lounge chat opener before takeover render branches use it", () => {
  const source = readFileSync(singerAppPath, "utf8");
  const declarationIndex = source.indexOf("const openLoungeChat = useCallback");
  const firstUseIndex = source.indexOf("onClick={openLoungeChat}");
  assert.ok(declarationIndex > 0, "SingerApp should declare openLoungeChat as an early callback");
  assert.ok(firstUseIndex > 0, "SingerApp should use openLoungeChat in takeover controls");
  assert.ok(declarationIndex < firstUseIndex, "openLoungeChat must be initialized before render branches reference it");
  assert.doesNotMatch(
    source,
    /const openLoungeChat = \(\) => \{[\s\S]*?setSocialTab\('lounge'\);[\s\S]*?\};\s*const openStreamlinedPrimaryStageTab/,
    "SingerApp should not keep the late openLoungeChat declaration after render branches"
  );
});

test("SingerApp only treats server-confirmed room points as spendable", () => {
  const source = readFileSync(singerAppPath, "utf8");

  assert.match(
    source,
    /const pendingSpendOffset = Math\.min\(0, Number\(localPointOffset \|\| 0\) \|\| 0\);/,
    "Audience wallet should not count pending positive point grants as spendable before Firestore accepts them",
  );
  assert.match(
    source,
    /return Math\.max\(0, confirmedPoints \+ pendingSpendOffset\);/,
    "Audience spend checks and point displays should use confirmed room points minus pending spends",
  );
  assert.match(
    source,
    /const nextPoints = Math\.max\(0, Number\(prev\.points \|\| 0\) \+ delta\);[\s\S]*return \{ \.\.\.prev, points: nextPoints \};/,
    "Successful point sync should immediately reconcile local user state with the server-accepted room balance",
  );
});

test("SingerApp does not replay stale host make-it-rain awards", () => {
  const source = readFileSync(singerAppPath, "utf8");

  assert.match(
    source,
    /const BONUS_DROP_AUDIENCE_CLAIM_MS = 15000;/,
    "Audience make-it-rain claims should have a short freshness window",
  );
  assert.match(
    source,
    /expiresAtMs > 0 && expiresAtMs <= Date\.now\(\)/,
    "Audience should respect explicit host bonus-drop expiry timestamps",
  );
  assert.match(
    source,
    /\(Date\.now\(\) - createdAtMs\) > BONUS_DROP_AUDIENCE_CLAIM_MS/,
    "Audience should ignore old bonus-drop payloads left in the room document",
  );
});

test("SingerApp keeps high-zoom audience game actions reachable", () => {
  const source = readFileSync(singerAppPath, "utf8");

  assert.match(
    source,
    /data-feature-id="singer-doodle-oke"[\s\S]*className="min-h-\[100dvh\][^"]*overflow-y-auto[^"]*touch-scroll-y/,
    "Doodle-oke should scroll instead of trapping high-zoom phones in a fixed viewport",
  );
  assert.match(
    source,
    /data-feature-id="singer-doodle-submit"[\s\S]*className={`sticky bottom-3 z-20/,
    "Doodle-oke submit should stay reachable below a large drawing canvas",
  );
  assert.match(
    source,
    /data-feature-id="singer-selfie-challenge"[\s\S]*className="min-h-\[100dvh\][^"]*overflow-y-auto[^"]*touch-scroll-y/,
    "Selfie Challenge should allow scrolling under high text zoom",
  );
  assert.match(
    source,
    /relative z-30 mt-auto flex w-full flex-col items-center[\s\S]*data-feature-id="singer-selfie-submit"/,
    "Selfie Challenge submit should live in a reachable bottom control tray",
  );
  assert.match(
    source,
    /bottom: 'calc\(env\(safe-area-inset-bottom\) \+ 2\.25rem\)'[\s\S]*data-selfie-cam-capture/,
    "Selfie Cam capture should respect the device safe area instead of using a raw fixed bottom offset",
  );
});

test("SingerApp lets high-zoom audiences scroll past the expanded stage", () => {
  const source = readFileSync(singerAppPath, "utf8");

  assert.match(
    source,
    /data-singer-view="main"[\s\S]*className={`relative min-h-\[100dvh\][\s\S]*overflow-y-auto[\s\S]*touch-scroll-y/,
    "Main Audience shell should scroll when browser zoom makes the stage taller than the viewport",
  );
  assert.match(
    source,
    /max-h-\[min\(72dvh,42rem\)\] overflow-y-auto overscroll-contain touch-scroll-y/,
    "Expanded stage area should have its own scroll cap so it cannot consume the whole phone viewport",
  );
  assert.match(
    source,
    /min-h-\[55dvh\] flex-1 p-4 overflow-y-auto overscroll-contain touch-scroll-y/,
    "Main Audience content should keep a reachable scroll area below the stage",
  );
});
test("SingerApp keeps secondary high-zoom action surfaces reachable", () => {
  const source = readFileSync(singerAppPath, "utf8");

  assert.match(
    source,
    /storm-screen storm-phase-[\s\S]*min-h-\[100dvh\][\s\S]*overflow-y-auto[\s\S]*touch-scroll-y/,
    "Storm Mode should scroll when zoom makes its join/action card taller than the phone viewport",
  );
  assert.match(
    source,
    /handleExitGuitarMode[\s\S]*bottom: 'calc\(env\(safe-area-inset-bottom\) \+ 2\.5rem\)'/,
    "Guitar Mode exit should respect the device safe area",
  );
  assert.match(
    source,
    /min-h-\[100dvh\][^`]*vibe-strobe[\s\S]*overflow-y-auto[\s\S]*h-44 w-44[\s\S]*sm:h-56 sm:w-56/,
    "Beat Drop should scroll and scale its tap button down on constrained phones",
  );
  assert.match(
    source,
    /strobeVictoryOpen[\s\S]*overflow-y-auto[\s\S]*max-h-\[50dvh\][\s\S]*takeStrobeVictorySelfie[\s\S]*h-20 w-20/,
    "Beat Drop victory selfie should keep camera and capture controls reachable",
  );
  assert.match(
    source,
    /guitarVictoryOpen[\s\S]*overflow-y-auto[\s\S]*max-h-\[50dvh\][\s\S]*takeGuitarVictorySelfie[\s\S]*h-20 w-20/,
    "Guitar victory selfie should keep camera and capture controls reachable",
  );
  assert.match(
    source,
    /readyCheck\?\.active[\s\S]*overflow-y-auto[\s\S]*text-\[clamp\(5rem,28vw,12rem\)\][\s\S]*h-44 w-44/,
    "Ready Check should scale oversized countdown and button under high zoom",
  );
  assert.match(
    source,
    /audience-room-mic-voice-prompt[\s\S]*overflow-y-auto|overflow-y-auto[\s\S]*audience-room-mic-voice-prompt/,
    "Room-mic voice game prompts should render in a scrollable overlay",
  );
  assert.match(
    source,
    /z-\[83\] min-h-\[100dvh\] overflow-y-auto[\s\S]*z-\[85\] min-h-\[100dvh\] overflow-y-auto/,
    "Song search and manual request full-screen sheets should remain scrollable at high zoom",
  );
  assert.match(
    source,
    /photoOverlay[\s\S]*overflow-y-auto[\s\S]*max-h-\[52dvh\][\s\S]*bottom: 'calc\(env\(safe-area-inset-bottom\) \+ 0\.75rem\)'/,
    "Photo overlay save/share actions should stay inside the safe-area viewport",
  );
});
test("SingerApp idle Live Reactions guide does not duplicate the wallet total", () => {
  const source = readFileSync(singerAppPath, "utf8");
  const cardStart = source.indexOf('data-feature-id="singer-streamlined-idle-reaction-guide"');
  const cardEnd = source.indexOf('Reactions wake up once someone is on stage.', cardStart);
  assert.ok(cardStart > 0, "SingerApp should render the streamlined idle Live Reactions guide");
  assert.ok(cardEnd > cardStart, "SingerApp should include the idle Live Reactions body copy");
  const cardSource = source.slice(cardStart, cardEnd);

  assert.doesNotMatch(
    cardSource,
    /getEffectivePoints\(\)|>Points<|text-fuchsia-100/,
    "Idle Live Reactions should not show a second point total that can drift from the wallet display",
  );
});

test("SingerApp profile editor keeps avatar choices above effects and bottom actions reachable", () => {
  const source = readFileSync(singerAppPath, "utf8");
  const profileStart = source.indexOf('if (showProfile) return (');
  const profileEnd = source.indexOf('if (showVipOnboarding) return', profileStart);
  assert.ok(profileStart > 0, "SingerApp should render the profile editor modal");
  assert.ok(profileEnd > profileStart, "SingerApp should keep profile editor before VIP onboarding");
  const profileSource = source.slice(profileStart, profileEnd);

  assert.match(
    profileSource,
    /overflow-y-auto overscroll-contain touch-scroll-y[\s\S]*paddingBottom: 'calc\(env\(safe-area-inset-bottom\) \+ 1rem\)'/,
    "Profile editor backdrop should scroll and account for the device safe area",
  );
  assert.match(
    profileSource,
    /style=\{\{ maxHeight: 'calc\(100dvh - env\(safe-area-inset-bottom\) - 1\.5rem\)' \}\}/,
    "Profile editor panel should fit inside the safe-area viewport",
  );
  assert.match(
    profileSource,
    /party-lights pointer-events-none z-0[\s\S]*party-lights alt pointer-events-none z-0[\s\S]*party-lights third pointer-events-none z-0/,
    "Profile editor light effects should not sit above or intercept avatar taps",
  );
  assert.match(
    profileSource,
    /<div className="relative z-10"><AvatarCoverflow/,
    "Avatar carousel should render above decorative profile effects",
  );
  assert.match(
    profileSource,
    /sticky bottom-0 z-20[\s\S]*CANCEL[\s\S]*SAVE/,
    "Profile editor Save and Cancel actions should remain reachable at the bottom of the scroll area",
  );
});

test("SingerApp audience-led vote cards emphasize song thumbnails and duration metadata", () => {
  const source = readFileSync(singerAppPath, "utf8");
  const releaseStart = source.indexOf("const audienceReleaseChoiceMetadata = useMemo");
  const releaseEnd = source.indexOf("{isAudienceSpotlightedGuest &&", releaseStart);
  assert.ok(releaseStart > 0, "SingerApp should derive release-window choice metadata");
  assert.ok(releaseEnd > releaseStart, "SingerApp should render audience vote controls after metadata derivation");
  const releaseSource = source.slice(releaseStart, releaseEnd);

  assert.match(
    releaseSource,
    /choiceMetadata\?\.slot_scene[\s\S]*choiceMetadata\?\.keep_queue_moving/,
    "Audience vote cards should read per-choice metadata from the release window",
  );
  assert.match(
    releaseSource,
    /relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl/,
    "Audience vote cards should use larger thumbnail-forward song art",
  );
  assert.match(
    releaseSource,
    /audienceReleaseChoiceMetadata\.slotScene\?\.durationLabel[\s\S]*audienceReleaseChoiceMetadata\.keepQueueMoving\?\.durationLabel/,
    "Audience vote cards should show duration badges when song metadata provides them",
  );
  assert.match(
    releaseSource,
    /audienceReleaseChoiceCounts[\s\S]*getAudienceReleaseChoicePct/,
    "Audience vote cards should expose live server vote counts and percentage bars",
  );
  assert.match(
    releaseSource,
    /data-audience-release-choice-card="slot_scene"[\s\S]*data-audience-release-choice-card="keep_queue_moving"/,
    "Audience vote cards should be explicitly marked as two visible decision choices",
  );
});

test("SingerApp resolves pop-up trivia rewards from server summaries", () => {
  const source = readFileSync(singerAppPath, "utf8");

  assert.match(
    source,
    /const popTriviaAwardSummary = popTriviaRevealQuestionId[\s\S]*room\?\.popTriviaAwards\?\.\[popTriviaRevealQuestionId\]/,
    "SingerApp should read authoritative Pop Trivia award summaries from the room",
  );
  assert.match(
    source,
    /const popTriviaConfirmedAwardDelta = popTriviaAwardWinnerForMe[\s\S]*popTriviaAwardSyncedDelta/,
    "SingerApp should prefer the server-confirmed Pop Trivia award before falling back to wallet delta sync",
  );
  assert.match(
    source,
    /data-feature-id="pop-trivia-audience-winners"/,
    "SingerApp should show credited Pop Trivia winners in the recap",
  );
  assert.match(
    source,
    /data-feature-id="pop-trivia-audience-win-flourish"/,
    "SingerApp should make Pop Trivia wins visually prominent",
  );
});
