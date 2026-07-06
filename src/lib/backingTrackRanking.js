const DEFAULT_PROVIDER = 'youtube';

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const toNumber = (value, fallback = 0) => {
    const next = Number(value);
    return Number.isFinite(next) ? next : fallback;
};

const toCount = (value) => Math.max(0, Math.round(toNumber(value, 0)));

const normalizeKeyPart = (value = '') => String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 96);

export const normalizeCanonicalSongIdentity = (song = {}) => {
    const input = song && typeof song === 'object' ? song : {};
    const appleMusicId = String(input.appleMusicId || input.itunesTrackId || input.trackId || '').trim();
    const title = String(input.title || input.trackName || input.name || '').trim();
    const artist = String(input.artist || input.artistName || '').trim();
    const explicitSongId = String(input.canonicalSongId || input.songId || input.id || '').trim();
    const generatedSongId = appleMusicId
        ? `apple:${appleMusicId}`
        : [normalizeKeyPart(artist), normalizeKeyPart(title)].filter(Boolean).join('__');

    return {
        canonicalSongId: explicitSongId || generatedSongId,
        appleMusicId,
        title,
        artist
    };
};

export const buildBackingTrackCandidateId = (candidate = {}) => {
    const input = candidate && typeof candidate === 'object' ? candidate : {};
    const canonicalSongId = String(input.canonicalSongId || input.songId || '').trim();
    const provider = normalizeKeyPart(input.provider || DEFAULT_PROVIDER) || DEFAULT_PROVIDER;
    const providerTrackId = String(input.providerTrackId || input.videoId || input.youtubeVideoId || input.id || '').trim();
    if (!canonicalSongId || !providerTrackId) return '';
    return `${normalizeKeyPart(canonicalSongId)}__${provider}__${normalizeKeyPart(providerTrackId)}`;
};

export const normalizeBackingCandidateTelemetry = (telemetry = {}) => {
    const input = telemetry && typeof telemetry === 'object' ? telemetry : {};
    return {
        hostUpvotes: toCount(input.hostUpvotes ?? input.hostVotes?.up),
        hostDownvotes: toCount(input.hostDownvotes ?? input.hostVotes?.down),
        coHostUpvotes: toCount(input.coHostUpvotes ?? input.cohostUpvotes ?? input.coHostVotes?.up ?? input.cohostVotes?.up),
        coHostDownvotes: toCount(input.coHostDownvotes ?? input.cohostDownvotes ?? input.coHostVotes?.down ?? input.cohostVotes?.down),
        audienceUpvotes: toCount(input.audienceUpvotes ?? input.audienceVotes?.up),
        audienceDownvotes: toCount(input.audienceDownvotes ?? input.audienceVotes?.down),
        usageCount: toCount(input.usageCount ?? input.plays),
        completionCount: toCount(input.completionCount ?? input.completedCount),
        skipCount: toCount(input.skipCount ?? input.skips)
    };
};

export const scoreBackingTrackCandidate = (candidate = {}) => {
    const input = candidate && typeof candidate === 'object' ? candidate : {};
    const telemetry = normalizeBackingCandidateTelemetry(input.telemetry || input);
    const youtubeStatus = String(input.youtubePlaybackStatus || input.playbackStatus || '').trim().toLowerCase();
    const isEmbeddable = input.embeddable === true || youtubeStatus === 'embeddable';
    const isKnownBadEmbed = input.embeddable === false
        || input.backingAudioOnly === true
        || youtubeStatus === 'not_embeddable'
        || youtubeStatus === 'not-embeddable';
    const usageCount = Math.max(telemetry.usageCount, telemetry.completionCount + telemetry.skipCount);
    const completionRate = usageCount > 0 ? telemetry.completionCount / usageCount : 0;
    const audienceNet = clamp(telemetry.audienceUpvotes - telemetry.audienceDownvotes, -8, 8);
    const titleIntentMatch = clamp(toNumber(input.titleIntentMatch ?? input.intentMatch, 0), 0, 1);
    const durationFit = clamp(toNumber(input.durationFit, 0), 0, 1);
    const sourceTrust = clamp(toNumber(input.sourceTrust, 0), 0, 1);
    const viewPrior = clamp(Math.log10(toNumber(input.viewCount, 0) + 1), 0, 6);

    let score = 50;
    score += telemetry.hostUpvotes * 22;
    score -= telemetry.hostDownvotes * 34;
    score += telemetry.coHostUpvotes * 16;
    score -= telemetry.coHostDownvotes * 24;
    score += audienceNet * 2.5;
    score += Math.min(telemetry.completionCount, 12) * 2.25;
    score -= Math.min(telemetry.skipCount, 12) * 5;
    if (usageCount > 0) score += (completionRate - 0.5) * 10;
    if (isEmbeddable) score += 12;
    if (isKnownBadEmbed) score -= 90;
    score += titleIntentMatch * 10;
    score += durationFit * 8;
    score += sourceTrust * 6;
    score += viewPrior * 0.75;

    return Math.round(score * 100) / 100;
};

export const normalizeBackingTrackCandidate = (candidate = {}, canonicalSong = {}) => {
    const songIdentity = normalizeCanonicalSongIdentity({
        ...canonicalSong,
        canonicalSongId: candidate?.canonicalSongId || candidate?.songId || canonicalSong?.canonicalSongId || canonicalSong?.songId,
        appleMusicId: candidate?.appleMusicId || canonicalSong?.appleMusicId || canonicalSong?.itunesTrackId
    });
    const provider = String(candidate?.provider || DEFAULT_PROVIDER).trim().toLowerCase() || DEFAULT_PROVIDER;
    const providerTrackId = String(candidate?.providerTrackId || candidate?.videoId || candidate?.youtubeVideoId || candidate?.id || '').trim();
    const normalized = {
        ...candidate,
        canonicalSongId: songIdentity.canonicalSongId,
        appleMusicId: songIdentity.appleMusicId,
        provider,
        providerTrackId,
        candidateId: candidate?.candidateId || buildBackingTrackCandidateId({
            ...candidate,
            canonicalSongId: songIdentity.canonicalSongId,
            provider,
            providerTrackId
        }),
        telemetry: normalizeBackingCandidateTelemetry(candidate?.telemetry || candidate)
    };
    return {
        ...normalized,
        rankingScore: scoreBackingTrackCandidate(normalized)
    };
};

export const rankBackingTrackCandidates = (candidates = [], options = {}) => {
    const canonicalSong = normalizeCanonicalSongIdentity(options.canonicalSong || options);
    return (Array.isArray(candidates) ? candidates : [])
        .map((candidate) => normalizeBackingTrackCandidate(candidate, canonicalSong))
        .filter((candidate) => {
            if (!options.canonicalSongId && !canonicalSong.canonicalSongId) return true;
            return candidate.canonicalSongId === (options.canonicalSongId || canonicalSong.canonicalSongId);
        })
        .sort((a, b) => {
            if (b.rankingScore !== a.rankingScore) return b.rankingScore - a.rankingScore;
            if ((b.telemetry.hostUpvotes + b.telemetry.coHostUpvotes) !== (a.telemetry.hostUpvotes + a.telemetry.coHostUpvotes)) {
                return (b.telemetry.hostUpvotes + b.telemetry.coHostUpvotes) - (a.telemetry.hostUpvotes + a.telemetry.coHostUpvotes);
            }
            return String(a.candidateId).localeCompare(String(b.candidateId));
        });
};
