import { useCallback, useEffect, useRef } from 'react';

const useHostNightSetupFlow = ({
    applyMissionDraftToNightSetupState,
    buildMissionDraftFromRoom,
    buildMissionPartyFromRoom,
    buildMissionPartyPayload,
    compileMissionPayloadWithAssist,
    deriveAudienceBackingMode,
    deriveUnknownBackingPolicy,
    hostLogger,
    hostName = '',
    hostNightPresets = {},
    legacyGuestBackingOptionalRequestMode = '',
    logoUrl = '',
    missionAssistDefaultLevel = 'balanced',
    missionControlCohort = 'legacy',
    missionControlEnabled = false,
    missionControlVersion = 1,
    missionDraft = {},
    missionFlowRules = [],
    missionPartyDraft = {},
    missionPrimaryModes = [],
    missionAdvancedOverrides = {},
    audienceFeatureAccess = {},
    nightSetupAutoPlayMedia = true,
    nightSetupChatOnTv = false,
    nightSetupMarqueeEnabled = true,
    nightSetupPlanSnapshotRef,
    nightSetupPrimaryMode = 'karaoke',
    nightSetupPresetId = 'casual',
    nightSetupPrimaryModes = [],
    nightSetupQueueFirstTimeBoost = true,
    nightSetupQueueLimitCount = 0,
    nightSetupQueueLimitMode = 'none',
    nightSetupQueueRotation = 'round_robin',
    nightSetupQueueRotationOptions = [],
    nightSetupQueueLimitOptions = [],
    nightSetupShowScoring = true,
    nightSetupStep = 0,
    nowMs = () => Date.now(),
    room = {},
    roomCode = '',
    roomUsers = [],
    queuedCount = 0,
    roomLaunchUrls = {},
    normalizeRoomRequestMode,
    playingBg = false,
    primaryMissionStorageKey = '',
    overrideMissionStorageKey = '',
    requestRoomUpdate,
    serverTimestamp,
    setAudienceBackingMode,
    setAudienceFeatureAccess,
    setAudienceBingoReopenEnabled,
    setAllowSingerTrackSelect,
    setAutoBgMusic,
    setAutoBonusEnabled,
    setAutoBonusPoints,
    setAutoDj,
    setAutoDjDelaySec,
    setAutoEndOnTrackFinish,
    setAutoLyricsOnQueue,
    setAutoOpenGameId,
    setAutoPlayMedia,
    setChatShowOnTv,
    setHostNightPreset,
    setMarqueeEnabled,
    setMarqueeShowMode,
    setMissionAdvancedOpen,
    setMissionAdvancedOverrides,
    setMissionAdvancedPartyOpen,
    setMissionAdvancedQueueOpen,
    setMissionAdvancedTogglesOpen,
    setMissionDraft,
    setMissionPartyDraft,
    setMissionShowAllSpotlightModes,
    setNightSetupApplying,
    setNightSetupAutoPlayMedia,
    setNightSetupChatOnTv,
    setNightSetupMarqueeEnabled,
    setNightSetupPlanPulse,
    setNightSetupPresetId,
    setNightSetupPrimaryMode,
    setNightSetupQueueFirstTimeBoost,
    setNightSetupQueueLimitCount,
    setNightSetupQueueLimitMode,
    setNightSetupQueueRotation,
    setNightSetupRecommendation,
    setNightSetupShowScoring,
    setNightSetupStep,
    setPopTriviaEnabled,
    setQueueFirstTimeBoost,
    setQueueLimitCount,
    setQueueLimitMode,
    setQueueRotation,
    setRequestMode,
    setSearchSources,
    setShowFameLevel,
    setShowLaunchMenu,
    setShowNavMenu,
    setShowNightSetupWizard,
    setShowScoring,
    setUnknownBackingPolicy,
    setBgMusicState,
    showNightSetupWizard = false,
    setTab,
    toast,
    trackEvent,
}) => {
    const nightSetupAutoOpenGameTimerRef = useRef(null);

    const resolveNightSetupRecommendation = useCallback(() => {
        const knownPresetIds = new Set(Object.keys(hostNightPresets));
        const lastPreset = (() => {
            try {
                return String(localStorage.getItem('bross_last_night_setup_preset') || '').trim();
            } catch {
                return '';
            }
        })();
        if (knownPresetIds.has(lastPreset)) {
            return {
                presetId: lastPreset,
                reason: 'Based on your most recent host setup.',
            };
        }

        const guestCount = Array.isArray(roomUsers) ? roomUsers.length : 0;
        const activeQueueCount = Number(queuedCount || 0);
        if (guestCount >= 18 || activeQueueCount >= 16) {
            return {
                presetId: 'competition',
                reason: 'High turnout detected. Competition keeps queue pressure under control.',
            };
        }
        if (activeQueueCount >= 8 && guestCount >= 10) {
            return {
                presetId: 'bingo',
                reason: 'Balanced crowd + queue size suggests Bingo Spotlight engagement.',
            };
        }

        const dayOfWeek = new Date().getDay();
        if (dayOfWeek === 5 || dayOfWeek === 6) {
            return {
                presetId: 'casual',
                reason: 'Weekend default: high-energy casual flow.',
            };
        }
        return {
            presetId: 'trivia',
            reason: 'Weeknight default: trivia bursts keep non-singers active.',
        };
    }, [hostNightPresets, queuedCount, roomUsers]);

    const seedNightSetupFromPreset = useCallback((presetId = 'casual', options = {}) => {
        const preset = hostNightPresets[presetId] || hostNightPresets.casual;
        const presetSettings = preset?.settings || {};
        const queueSettings = presetSettings.queueSettings || {};
        const keepQueueDraft = !!options.keepQueueDraft;
        setNightSetupPresetId(preset.id);
        if (!keepQueueDraft) {
            setNightSetupQueueLimitMode(queueSettings.limitMode || 'none');
            setNightSetupQueueLimitCount(Math.max(0, Number(queueSettings.limitCount || 0)));
            setNightSetupQueueRotation(queueSettings.rotation || 'round_robin');
            setNightSetupQueueFirstTimeBoost(queueSettings.firstTimeBoost !== false);
        }
        setNightSetupShowScoring(presetSettings.showScoring !== false);
        setNightSetupAutoPlayMedia(presetSettings.autoPlayMedia !== false);
        setNightSetupChatOnTv(!!presetSettings.chatShowOnTv);
        setNightSetupMarqueeEnabled(!!presetSettings.marqueeEnabled);
        setNightSetupPrimaryMode(presetSettings.gamePreviewId || (preset.id === 'bingo' ? 'bingo' : preset.id === 'trivia' ? 'trivia_pop' : 'karaoke'));
        return preset;
    }, [
        hostNightPresets,
        setNightSetupAutoPlayMedia,
        setNightSetupChatOnTv,
        setNightSetupMarqueeEnabled,
        setNightSetupPresetId,
        setNightSetupPrimaryMode,
        setNightSetupQueueFirstTimeBoost,
        setNightSetupQueueLimitCount,
        setNightSetupQueueLimitMode,
        setNightSetupQueueRotation,
        setNightSetupShowScoring,
    ]);

    const openNightSetupWizard = useCallback((presetId = '') => {
        const recommendation = resolveNightSetupRecommendation();
        const resolvedPresetId = (presetId && hostNightPresets[presetId]) ? presetId : recommendation.presetId;
        setNightSetupRecommendation(recommendation);
        if (missionControlEnabled) {
            const roomDraft = buildMissionDraftFromRoom(room || {}, {
                flowRules: missionFlowRules,
                primaryModes: missionPrimaryModes,
            });
            const seedDraft = {
                ...roomDraft,
                archetype: resolvedPresetId || roomDraft.archetype || 'casual',
                assistLevel: roomDraft.assistLevel || missionAssistDefaultLevel,
            };
            let persistedDraft = null;
            let persistedOverrides = null;
            try {
                const savedDraftRaw = localStorage.getItem(primaryMissionStorageKey);
                const savedOverrideRaw = localStorage.getItem(overrideMissionStorageKey);
                persistedDraft = savedDraftRaw ? JSON.parse(savedDraftRaw) : null;
                persistedOverrides = savedOverrideRaw ? JSON.parse(savedOverrideRaw) : null;
            } catch (_err) {
                persistedDraft = null;
                persistedOverrides = null;
            }
            const nextDraft = (persistedDraft && typeof persistedDraft === 'object' && !Array.isArray(persistedDraft))
                ? { ...seedDraft, ...persistedDraft }
                : seedDraft;
            const nextOverrides = (room?.missionControl?.advancedOverrides && typeof room.missionControl.advancedOverrides === 'object')
                ? room.missionControl.advancedOverrides
                : ((persistedOverrides && typeof persistedOverrides === 'object' && !Array.isArray(persistedOverrides)) ? persistedOverrides : {});
            const nextParty = buildMissionPartyFromRoom(room || {});
            setMissionDraft(nextDraft);
            setMissionPartyDraft(nextParty);
            setMissionAdvancedOverrides(nextOverrides);
            setMissionAdvancedOpen(false);
            setMissionAdvancedQueueOpen(false);
            setMissionAdvancedPartyOpen(false);
            setMissionAdvancedTogglesOpen(false);
            setMissionShowAllSpotlightModes(false);
            applyMissionDraftToNightSetupState(nextDraft, nextOverrides);
            trackEvent('host_mission_setup_opened', {
                room_code: roomCode || '',
                archetype: nextDraft.archetype,
                spotlight_mode: nextDraft.spotlightMode,
                feature_flag: 'mission_control_v1',
                cohort: missionControlCohort,
                timestamp: nowMs(),
            });
        } else {
            seedNightSetupFromPreset(resolvedPresetId, { keepQueueDraft: false });
            setMissionPartyDraft(buildMissionPartyPayload());
        }
        setNightSetupStep(0);
        setShowNightSetupWizard(true);
    }, [
        resolveNightSetupRecommendation,
        hostNightPresets,
        setNightSetupRecommendation,
        missionControlEnabled,
        buildMissionDraftFromRoom,
        room,
        missionFlowRules,
        missionPrimaryModes,
        missionAssistDefaultLevel,
        primaryMissionStorageKey,
        overrideMissionStorageKey,
        buildMissionPartyFromRoom,
        setMissionDraft,
        setMissionPartyDraft,
        setMissionAdvancedOverrides,
        setMissionAdvancedOpen,
        setMissionAdvancedQueueOpen,
        setMissionAdvancedPartyOpen,
        setMissionAdvancedTogglesOpen,
        setMissionShowAllSpotlightModes,
        applyMissionDraftToNightSetupState,
        trackEvent,
        roomCode,
        missionControlCohort,
        nowMs,
        seedNightSetupFromPreset,
        buildMissionPartyPayload,
        setNightSetupStep,
        setShowNightSetupWizard,
    ]);

    useEffect(() => {
        if (!showNightSetupWizard) return;
        setShowLaunchMenu(false);
        setShowNavMenu(false);
        trackEvent('host_night_setup_step_view', {
            step_index: nightSetupStep,
            preset_id: nightSetupPresetId,
            primary_mode: nightSetupPrimaryMode,
        });
    }, [
        showNightSetupWizard,
        setShowLaunchMenu,
        setShowNavMenu,
        trackEvent,
        nightSetupStep,
        nightSetupPresetId,
        nightSetupPrimaryMode,
    ]);

    useEffect(() => {
        if (!showNightSetupWizard) {
            nightSetupPlanSnapshotRef.current = {
                night: '',
                pacing: '',
                spotlight: '',
                readiness: '',
            };
            setNightSetupPlanPulse({
                night: 0,
                pacing: 0,
                spotlight: 0,
                readiness: 0,
            });
            return;
        }
        const selectedPreset = hostNightPresets[nightSetupPresetId] || hostNightPresets.casual;
        const selectedMode = nightSetupPrimaryModes.find((mode) => mode.id === nightSetupPrimaryMode) || nightSetupPrimaryModes[0];
        const limitOption = nightSetupQueueLimitOptions.find((option) => option.id === nightSetupQueueLimitMode) || nightSetupQueueLimitOptions[0];
        const rotationOption = nightSetupQueueRotationOptions.find((option) => option.id === nightSetupQueueRotation) || nightSetupQueueRotationOptions[0];
        const readinessChecks = [
            !!String(hostName || '').trim(),
            !!String(roomCode || '').trim(),
            !!String(selectedPreset?.id || '').trim(),
            !!String(selectedMode?.id || '').trim(),
            !!String(nightSetupQueueLimitMode || '').trim() && !!String(nightSetupQueueRotation || '').trim(),
            !!String(logoUrl || '').trim(),
            !!nightSetupAutoPlayMedia || !!nightSetupShowScoring || !!nightSetupQueueFirstTimeBoost || !!nightSetupChatOnTv || !!nightSetupMarqueeEnabled,
        ];
        const readinessScore = Math.round((readinessChecks.filter(Boolean).length / readinessChecks.length) * 100);
        const nextSnapshot = {
            night: selectedPreset.label,
            pacing: `${limitOption.label}${nightSetupQueueLimitMode !== 'none' ? ` (${Math.max(0, Number(nightSetupQueueLimitCount || 0))})` : ''} | ${rotationOption.label}`,
            spotlight: selectedMode.label,
            readiness: `${readinessScore}% Ready`,
        };
        const previous = nightSetupPlanSnapshotRef.current || {};
        const ts = nowMs();
        const patch = {};
        if (previous.night && previous.night !== nextSnapshot.night) patch.night = ts;
        if (previous.pacing && previous.pacing !== nextSnapshot.pacing) patch.pacing = ts;
        if (previous.spotlight && previous.spotlight !== nextSnapshot.spotlight) patch.spotlight = ts;
        if (previous.readiness && previous.readiness !== nextSnapshot.readiness) patch.readiness = ts;
        nightSetupPlanSnapshotRef.current = nextSnapshot;
        if (Object.keys(patch).length) {
            setNightSetupPlanPulse((prev) => ({ ...prev, ...patch }));
        }
    }, [
        showNightSetupWizard,
        nightSetupPlanSnapshotRef,
        setNightSetupPlanPulse,
        hostNightPresets,
        nightSetupPresetId,
        nightSetupPrimaryModes,
        nightSetupPrimaryMode,
        nightSetupQueueLimitOptions,
        nightSetupQueueLimitMode,
        nightSetupQueueLimitCount,
        nightSetupQueueRotationOptions,
        nightSetupQueueRotation,
        hostName,
        roomCode,
        logoUrl,
        nightSetupAutoPlayMedia,
        nightSetupShowScoring,
        nightSetupQueueFirstTimeBoost,
        nightSetupChatOnTv,
        nightSetupMarqueeEnabled,
        nowMs,
    ]);

    useEffect(() => () => {
        if (nightSetupAutoOpenGameTimerRef.current) {
            clearTimeout(nightSetupAutoOpenGameTimerRef.current);
            nightSetupAutoOpenGameTimerRef.current = null;
        }
    }, []);

    const openSpotlightFlowFromSetup = useCallback((modeId = 'karaoke') => {
        const targetMode = String(modeId || '').trim().toLowerCase();
        if (!targetMode || targetMode === 'karaoke') {
            setTab('stage');
            return;
        }
        setTab('games');
        setAutoOpenGameId('');
        if (nightSetupAutoOpenGameTimerRef.current) {
            clearTimeout(nightSetupAutoOpenGameTimerRef.current);
        }
        nightSetupAutoOpenGameTimerRef.current = setTimeout(() => {
            setAutoOpenGameId(targetMode);
            nightSetupAutoOpenGameTimerRef.current = null;
        }, 0);
    }, [setAutoOpenGameId, setTab]);

    const applyNightSetupWizard = useCallback(async (options = {}) => {
        const intent = String(options?.intent || 'save').trim().toLowerCase();
        if (!roomCode) {
            toast('Open a room first.');
            return false;
        }
        const legacyPreset = hostNightPresets[nightSetupPresetId] || hostNightPresets.casual;
        const legacyPresetSettings = legacyPreset.settings || {};
        const legacyGameDefaults = legacyPresetSettings.gameDefaults || {};
        const legacyAutoLyricsEnabled = !!legacyPresetSettings.autoLyricsOnQueue;
        const legacyQueueLimitModeValue = nightSetupQueueLimitMode || 'none';
        const legacyQueueLimitCountValue = legacyQueueLimitModeValue === 'none'
            ? 0
            : Math.max(0, Number(nightSetupQueueLimitCount || 0));
        const normalizedLegacyRequestMode = normalizeRoomRequestMode(legacyPresetSettings.requestMode, legacyPresetSettings.allowSingerTrackSelect);
        const legacyPayload = {
            hostNightPreset: legacyPreset.id,
            autoDj: !!legacyPresetSettings.autoDj,
            autoBgMusic: !!legacyPresetSettings.autoBgMusic,
            autoPlayMedia: !!nightSetupAutoPlayMedia,
            autoEndOnTrackFinish: legacyPresetSettings.autoEndOnTrackFinish !== false,
            autoBonusEnabled: legacyPresetSettings.autoBonusEnabled !== false,
            autoBonusPoints: Math.max(0, Math.min(1000, Number(legacyPresetSettings.autoBonusPoints ?? 25) || 25)),
            autoDjDelaySec: Math.max(2, Math.min(45, Number(legacyPresetSettings.autoDjDelaySec ?? 10) || 10)),
            showVisualizerTv: !!legacyPresetSettings.showVisualizerTv,
            showLyricsTv: !!legacyPresetSettings.showLyricsTv,
            showScoring: !!nightSetupShowScoring,
            showFameLevel: !!legacyPresetSettings.showFameLevel,
            requestMode: normalizedLegacyRequestMode,
            allowSingerTrackSelect: normalizedLegacyRequestMode === legacyGuestBackingOptionalRequestMode,
            audienceBackingMode: deriveAudienceBackingMode({
                audienceBackingMode: legacyPresetSettings.audienceBackingMode,
                requestMode: legacyPresetSettings.requestMode,
                allowSingerTrackSelect: legacyPresetSettings.allowSingerTrackSelect,
            }),
            unknownBackingPolicy: deriveUnknownBackingPolicy({
                unknownBackingPolicy: legacyPresetSettings.unknownBackingPolicy,
                requestMode: legacyPresetSettings.requestMode,
                allowSingerTrackSelect: legacyPresetSettings.allowSingerTrackSelect,
            }),
            marqueeEnabled: !!nightSetupMarqueeEnabled,
            marqueeShowMode: legacyPresetSettings.marqueeShowMode || 'always',
            chatShowOnTv: !!nightSetupChatOnTv,
            chatTvMode: legacyPresetSettings.chatTvMode || 'auto',
            bouncerMode: !!legacyPresetSettings.bouncerMode,
            bingoShowTv: legacyPresetSettings.bingoShowTv !== false,
            bingoVotingMode: legacyPresetSettings.bingoVotingMode || 'host+votes',
            bingoAutoApprovePct: Math.max(10, Math.min(100, Number(legacyPresetSettings.bingoAutoApprovePct ?? 50))),
            bingoAudienceReopenEnabled: legacyPresetSettings.bingoAudienceReopenEnabled !== false,
            autoLyricsOnQueue: legacyAutoLyricsEnabled,
            popTriviaEnabled: legacyPresetSettings.popTriviaEnabled === true,
            gamePreviewId: nightSetupPrimaryMode === 'karaoke' ? null : nightSetupPrimaryMode,
            gameDefaults: {
                triviaRoundSec: Math.max(5, Number(legacyGameDefaults.triviaRoundSec || 20)),
                triviaAutoReveal: legacyGameDefaults.triviaAutoReveal !== false,
                bingoVotingMode: legacyGameDefaults.bingoVotingMode || 'host+votes',
                bingoAutoApprovePct: Math.max(10, Math.min(100, Number(legacyGameDefaults.bingoAutoApprovePct ?? 50))),
            },
            audienceFeatureAccess,
            queueSettings: {
                limitMode: legacyQueueLimitModeValue,
                limitCount: legacyQueueLimitCountValue,
                rotation: nightSetupQueueRotation || 'round_robin',
                firstTimeBoost: nightSetupQueueFirstTimeBoost !== false,
            },
        };
        const missionPayload = compileMissionPayloadWithAssist(missionDraft, missionAdvancedOverrides);
        const basePayload = missionControlEnabled ? missionPayload : legacyPayload;
        const payload = {
            ...basePayload,
            audienceFeatureAccess,
        };
        const payloadPreset = hostNightPresets[payload.hostNightPreset] || hostNightPresets.casual;
        const resolvedSpotlightMode = String(
            missionControlEnabled
                ? (missionDraft?.spotlightMode || payload.gamePreviewId || nightSetupPrimaryMode || 'karaoke')
                : (nightSetupPrimaryMode || payload.gamePreviewId || 'karaoke')
        ).trim().toLowerCase();
        setNightSetupApplying(true);
        try {
            await requestRoomUpdate({
                ...payload,
                missionControl: {
                    version: missionControlVersion,
                    enabled: !!missionControlEnabled,
                    setupDraft: {
                        archetype: missionDraft?.archetype || payload.hostNightPreset || 'casual',
                        flowRule: missionDraft?.flowRule || 'balanced',
                        spotlightMode: missionDraft?.spotlightMode || (payload.gamePreviewId || 'karaoke'),
                        assistLevel: missionDraft?.assistLevel || missionAssistDefaultLevel,
                    },
                    advancedOverrides: missionAdvancedOverrides || {},
                    party: buildMissionPartyPayload(missionPartyDraft),
                    lastAppliedAt: serverTimestamp(),
                    lastSuggestedAction: room?.missionControl?.lastSuggestedAction || '',
                },
            });
            setHostNightPreset(payload.hostNightPreset);
            setAutoDj(!!payload.autoDj);
            setAutoBgMusic(!!payload.autoBgMusic);
            setAutoPlayMedia(!!payload.autoPlayMedia);
            setAutoEndOnTrackFinish(payload.autoEndOnTrackFinish !== false);
            setAutoBonusEnabled(payload.autoBonusEnabled !== false);
            setAutoBonusPoints(Math.max(0, Math.min(1000, Number(payload.autoBonusPoints ?? 25) || 25)));
            setAutoDjDelaySec(Math.max(2, Math.min(45, Number(payload.autoDjDelaySec ?? 10) || 10)));
            setQueueLimitMode(payload.queueSettings.limitMode);
            setQueueLimitCount(payload.queueSettings.limitCount);
            setQueueRotation(payload.queueSettings.rotation);
            setQueueFirstTimeBoost(!!payload.queueSettings.firstTimeBoost);
            setShowScoring(!!payload.showScoring);
            setShowFameLevel(!!payload.showFameLevel);
            setRequestMode(normalizeRoomRequestMode(payload.requestMode, payload.allowSingerTrackSelect));
            setAllowSingerTrackSelect(!!payload.allowSingerTrackSelect);
            setAudienceBackingMode(deriveAudienceBackingMode({
                audienceBackingMode: payload.audienceBackingMode,
                requestMode: payload.requestMode,
                allowSingerTrackSelect: payload.allowSingerTrackSelect,
            }));
            setUnknownBackingPolicy(deriveUnknownBackingPolicy({
                unknownBackingPolicy: payload.unknownBackingPolicy,
                requestMode: payload.requestMode,
                allowSingerTrackSelect: payload.allowSingerTrackSelect,
            }));
            setAudienceFeatureAccess(payload.audienceFeatureAccess || {});
            setMarqueeEnabled(!!payload.marqueeEnabled);
            setMarqueeShowMode(payload.marqueeShowMode || 'always');
            setChatShowOnTv(!!payload.chatShowOnTv);
            setAudienceBingoReopenEnabled(payload.bingoAudienceReopenEnabled !== false);
            setAutoLyricsOnQueue(!!payload.autoLyricsOnQueue);
            setPopTriviaEnabled(payload.popTriviaEnabled === true);
            setSearchSources(payloadPreset.searchSources || { local: true, youtube: true, itunes: true });
            if (payload.autoBgMusic && !playingBg) setBgMusicState(true);
            if (!payload.autoBgMusic && playingBg) setBgMusicState(false);
            if (intent === 'start_match') {
                openSpotlightFlowFromSetup(resolvedSpotlightMode);
            }
            trackEvent('host_night_setup_applied', {
                preset_id: payload.hostNightPreset,
                primary_mode: resolvedSpotlightMode,
                queue_limit_mode: payload.queueSettings.limitMode,
            });
            if (missionControlEnabled) {
                trackEvent('host_mission_applied', {
                    room_code: roomCode,
                    archetype: missionDraft?.archetype || payload.hostNightPreset,
                    flow_rule: missionDraft?.flowRule || 'balanced',
                    spotlight_mode: missionDraft?.spotlightMode || (payload.gamePreviewId || 'karaoke'),
                    feature_flag: 'mission_control_v1',
                    cohort: missionControlCohort,
                    timestamp: nowMs(),
                });
            }
            try {
                localStorage.setItem('bross_last_night_setup_preset', payload.hostNightPreset);
            } catch (_err) {
                // ignore local storage errors
            }
            toast(intent === 'start_match'
                ? 'Setup saved. Match flow ready.'
                : (missionControlEnabled ? 'Mission control setup applied.' : 'Night setup applied.'));
            setShowNightSetupWizard(false);
            setNightSetupStep(0);
            return true;
        } catch (error) {
            hostLogger.error('Apply night setup wizard failed', error);
            toast('Could not apply night setup.');
            return false;
        } finally {
            setNightSetupApplying(false);
        }
    }, [
        roomCode,
        toast,
        hostNightPresets,
        nightSetupPresetId,
        nightSetupQueueLimitMode,
        nightSetupQueueLimitCount,
        nightSetupAutoPlayMedia,
        nightSetupShowScoring,
        nightSetupMarqueeEnabled,
        nightSetupChatOnTv,
        nightSetupPrimaryMode,
        nightSetupQueueRotation,
        nightSetupQueueFirstTimeBoost,
        audienceFeatureAccess,
        normalizeRoomRequestMode,
        legacyGuestBackingOptionalRequestMode,
        deriveAudienceBackingMode,
        deriveUnknownBackingPolicy,
        compileMissionPayloadWithAssist,
        missionDraft,
        missionAdvancedOverrides,
        missionControlEnabled,
        setNightSetupApplying,
        requestRoomUpdate,
        serverTimestamp,
        missionControlVersion,
        missionAssistDefaultLevel,
        buildMissionPartyPayload,
        missionPartyDraft,
        room?.missionControl?.lastSuggestedAction,
        setHostNightPreset,
        setAutoDj,
        setAutoBgMusic,
        setAutoPlayMedia,
        setAutoEndOnTrackFinish,
        setAutoBonusEnabled,
        setAutoBonusPoints,
        setAutoDjDelaySec,
        setQueueLimitMode,
        setQueueLimitCount,
        setQueueRotation,
        setQueueFirstTimeBoost,
        setShowScoring,
        setShowFameLevel,
        setRequestMode,
        setAllowSingerTrackSelect,
        setAudienceBackingMode,
        setUnknownBackingPolicy,
        setAudienceFeatureAccess,
        setMarqueeEnabled,
        setMarqueeShowMode,
        setChatShowOnTv,
        setAudienceBingoReopenEnabled,
        setAutoLyricsOnQueue,
        setPopTriviaEnabled,
        setSearchSources,
        playingBg,
        setBgMusicState,
        openSpotlightFlowFromSetup,
        trackEvent,
        missionControlCohort,
        nowMs,
        setShowNightSetupWizard,
        setNightSetupStep,
        hostLogger,
    ]);

    const launchNightSetupPackage = useCallback(async () => {
        if (!roomCode) {
            toast('Open a room first.');
            return;
        }
        const tvUrl = String(roomLaunchUrls?.tvUrl || '').trim();
        try {
            if (tvUrl) {
                window.open(tvUrl, '_blank', 'noopener,noreferrer');
            }
        } catch (_err) {
            // ignore popup-block issues
        }
        const applied = await applyNightSetupWizard({ intent: 'start_match' });
        if (!applied) return;

        const joinUrl = String(roomLaunchUrls?.audienceUrl || '').trim();
        if (!joinUrl) {
            toast('Launch package complete. Audience link is unavailable right now.');
            return;
        }
        try {
            await navigator.clipboard.writeText(joinUrl);
            toast('Launch package complete: TV opened and join link copied.');
        } catch (_err) {
            toast(`Launch package complete. Join link: ${joinUrl}`);
        }

        trackEvent('host_night_setup_launch_package', {
            room_code: roomCode,
            preset_id: nightSetupPresetId,
            primary_mode: nightSetupPrimaryMode,
        });
    }, [
        roomCode,
        toast,
        roomLaunchUrls?.tvUrl,
        applyNightSetupWizard,
        roomLaunchUrls?.audienceUrl,
        trackEvent,
        nightSetupPresetId,
        nightSetupPrimaryMode,
    ]);

    return {
        applyNightSetupWizard,
        launchNightSetupPackage,
        openNightSetupWizard,
        openSpotlightFlowFromSetup,
        resolveNightSetupRecommendation,
        seedNightSetupFromPreset,
    };
};

export default useHostNightSetupFlow;
