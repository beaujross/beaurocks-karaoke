import {
    RUN_OF_SHOW_PERFORMER_MODES,
    createRunOfShowItem,
    resequenceRunOfShowItems,
} from '../../../lib/runOfShowDirector';
import {
    AAHF_KICKOFF_EVENT_PROFILE_ID,
    buildAahfKickoffStarterTemplate,
} from '../roomEventProfiles';

const cleanText = (value = '') => String(value || '').trim();

const extractImportedYouTubeId = (value = '') => {
    const safeValue = cleanText(value);
    if (!safeValue) return '';
    const rawMatch = safeValue.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([A-Za-z0-9_-]{11})/i);
    if (rawMatch?.[1]) return rawMatch[1];
    if (/^[A-Za-z0-9_-]{11}$/.test(safeValue)) return safeValue;
    return '';
};

const inferSceneMediaType = (mediaUrl = '', mediaType = '') => {
    const safeMediaType = cleanText(mediaType).toLowerCase();
    if (safeMediaType === 'video') return 'video';
    const safeUrl = cleanText(mediaUrl).toLowerCase();
    return /\.(mp4|mov|webm|m4v)(?:$|\?)/.test(safeUrl) ? 'video' : 'image';
};

const buildPerformanceItemFromQueueSong = (song = {}, now = Date.now(), index = 0) => {
    const mediaUrl = cleanText(song?.mediaUrl);
    const appleMusicId = cleanText(song?.appleMusicId);
    const trackId = cleanText(song?.trackId);
    const youtubeId = mediaUrl ? extractImportedYouTubeId(mediaUrl) : '';
    const sourceType = appleMusicId
        ? 'apple_music'
        : youtubeId
            ? 'youtube'
            : (mediaUrl || trackId ? 'canonical_default' : 'manual_external');
    const durationSec = Math.max(30, Number(song?.duration || song?.performanceStartedDurationSec || 210) || 210);
    const title = [cleanText(song?.singerName) || 'Guest', cleanText(song?.songTitle) || 'Performance Slot']
        .filter(Boolean)
        .join(' - ');

    return createRunOfShowItem('performance', {
        title,
        plannedDurationSec: durationSec,
        plannedDurationSource: 'backing',
        performerMode: RUN_OF_SHOW_PERFORMER_MODES.assigned,
        assignedPerformerUid: cleanText(song?.singerUid),
        assignedPerformerName: cleanText(song?.singerName) || 'Guest',
        songId: cleanText(song?.songId),
        songTitle: cleanText(song?.songTitle) || 'Performance Slot',
        artistName: cleanText(song?.artist),
        preparedQueueSongId: cleanText(song?.id),
        queueLinkState: 'linked',
        backingPlan: {
            sourceType,
            label: [cleanText(song?.songTitle), cleanText(song?.artist)].filter(Boolean).join(' · ') || title,
            durationSec,
            songId: cleanText(song?.songId),
            trackId: sourceType === 'youtube' ? '' : trackId,
            mediaUrl,
            youtubeId: sourceType === 'youtube' ? youtubeId : '',
            appleMusicId: sourceType === 'apple_music' ? (appleMusicId || trackId) : '',
            localAssetId: '',
            submittedBackingId: '',
            approvalStatus: 'approved',
            playbackReady: !!(mediaUrl || appleMusicId || trackId),
            resolutionStatus: mediaUrl || appleMusicId || trackId ? 'ready' : 'needs_selection',
        },
        status: 'ready',
    }, now + index);
};

const buildSceneItemFromPreset = (preset = {}, now = Date.now(), index = 0) => {
    const mediaUrl = cleanText(preset?.mediaUrl || preset?.url);
    const mediaType = inferSceneMediaType(mediaUrl, preset?.mediaType);
    const title = cleanText(preset?.title) || (mediaType === 'video' ? 'Video Scene' : 'Image Scene');

    return createRunOfShowItem('announcement', {
        title,
        notes: '',
        status: 'ready',
        optionalScene: true,
        governanceMode: 'host_only',
        releasePolicy: 'manual_release',
        plannedDurationSec: Math.max(5, Math.min(600, Number(preset?.durationSec || 20) || 20)),
        presentationPlan: {
            publicTvTakeoverEnabled: true,
            takeoverScene: 'media_scene',
            headline: title,
            subhead: '',
            accentTheme: 'cyan',
            mediaSceneUrl: mediaUrl,
            mediaSceneType: mediaType,
            mediaSceneFit: 'contain',
            mediaSceneSourceUploadId: cleanText(preset?.sourceUploadId || preset?.id),
            mediaSceneStoragePath: cleanText(preset?.storagePath),
            mediaSceneFileName: cleanText(preset?.fileName),
        },
        roomMomentPlan: {
            activeScreen: 'stage',
            activeMode: '',
            showHowToPlay: false,
            lightMode: 'off',
        },
    }, now + index);
};

const isCurrentRoomScenePreset = (preset = {}) => {
    const mediaUrl = cleanText(preset?.mediaUrl || preset?.url);
    return !!mediaUrl && !mediaUrl.startsWith('blob:');
};

const isCurrentRoomQueueSong = (song = {}) => {
    return cleanText(song?.id) && String(song?.status || '').trim().toLowerCase() === 'requested';
};

export const buildCurrentRoomRunOfShowDraft = ({
    eventProfileId = '',
    queueSongs = [],
    scenePresets = [],
    now = Date.now(),
} = {}) => {
    const safeEventProfileId = cleanText(eventProfileId).toLowerCase();
    const performanceItems = (Array.isArray(queueSongs) ? queueSongs : [])
        .filter(isCurrentRoomQueueSong)
        .map((song, index) => buildPerformanceItemFromQueueSong(song, now + 50, index));
    const sceneItems = (Array.isArray(scenePresets) ? scenePresets : [])
        .filter(isCurrentRoomScenePreset)
        .map((preset, index) => buildSceneItemFromPreset(preset, now + 500, index));

    if (safeEventProfileId === AAHF_KICKOFF_EVENT_PROFILE_ID) {
        const starter = buildAahfKickoffStarterTemplate(now);
        const baseItems = Array.isArray(starter?.runOfShowDirector?.items) ? starter.runOfShowDirector.items : [];
        const remainingPerformanceItems = [...performanceItems];
        const mergedItems = baseItems.map((item) => {
            if (item?.type !== 'performance' || !remainingPerformanceItems.length) return item;
            const nextPerformance = remainingPerformanceItems.shift();
            return {
                ...item,
                ...nextPerformance,
                id: item.id,
                sequence: item.sequence,
            };
        });
        const closingIndex = mergedItems.findIndex((item) => item?.type === 'closing');
        const insertionIndex = closingIndex >= 0 ? closingIndex : mergedItems.length;
        const beforeClosing = mergedItems.slice(0, insertionIndex);
        const afterClosing = mergedItems.slice(insertionIndex);
        return {
            label: 'AAHF Kick-Off from current room',
            items: resequenceRunOfShowItems([
                ...beforeClosing,
                ...remainingPerformanceItems,
                ...sceneItems,
                ...afterClosing,
            ]),
            runOfShowPolicy: starter?.runOfShowPolicy || null,
        };
    }

    return {
        label: 'Current room draft',
        items: resequenceRunOfShowItems([
            ...performanceItems,
            ...sceneItems,
        ]),
        runOfShowPolicy: null,
    };
};
