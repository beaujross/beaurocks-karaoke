const collectIdentityValues = (values = []) => {
    const seen = new Set();
    const next = [];
    values.forEach((value) => {
        const normalized = String(value || '').trim();
        if (!normalized || seen.has(normalized)) return;
        seen.add(normalized);
        next.push(normalized);
    });
    return next;
};

const hasSharedValue = (left = [], right = []) => {
    if (!left.length || !right.length) return false;
    const rightSet = new Set(right);
    return left.some((value) => rightSet.has(value));
};

export const buildRoomMediaIdentity = (source = {}) => {
    const mediaScene = source?.mediaScene && typeof source.mediaScene === 'object'
        ? source.mediaScene
        : {};
    const presentationPlan = source?.presentationPlan && typeof source.presentationPlan === 'object'
        ? source.presentationPlan
        : {};
    return {
        uploadIds: collectIdentityValues([
            source?.id,
            source?.sourceUploadId,
            source?.mediaSceneSourceUploadId,
            mediaScene?.sourceUploadId,
            presentationPlan?.mediaSceneSourceUploadId,
        ]),
        storagePaths: collectIdentityValues([
            source?.storagePath,
            source?.mediaSceneStoragePath,
            mediaScene?.storagePath,
            presentationPlan?.mediaSceneStoragePath,
        ]),
        mediaUrls: collectIdentityValues([
            source?.url,
            source?.mediaUrl,
            source?.mediaSceneUrl,
            mediaScene?.mediaUrl,
            presentationPlan?.mediaSceneUrl,
        ]),
    };
};

export const mergeRoomMediaIdentities = (...identities) => ({
    uploadIds: collectIdentityValues(identities.flatMap((identity) => identity?.uploadIds || [])),
    storagePaths: collectIdentityValues(identities.flatMap((identity) => identity?.storagePaths || [])),
    mediaUrls: collectIdentityValues(identities.flatMap((identity) => identity?.mediaUrls || [])),
});

export const hasRoomMediaIdentity = (identity = {}) => (
    (identity?.uploadIds || []).length > 0
    || (identity?.storagePaths || []).length > 0
    || (identity?.mediaUrls || []).length > 0
);

export const roomMediaIdentityMatches = (asset = {}, candidate = {}) => {
    const left = Array.isArray(asset?.uploadIds) ? asset : buildRoomMediaIdentity(asset);
    const right = Array.isArray(candidate?.uploadIds) ? candidate : buildRoomMediaIdentity(candidate);
    if (!hasRoomMediaIdentity(left) || !hasRoomMediaIdentity(right)) return false;
    return hasSharedValue(left.uploadIds, right.uploadIds)
        || hasSharedValue(left.storagePaths, right.storagePaths)
        || hasSharedValue(left.mediaUrls, right.mediaUrls);
};

export const stripRoomMediaFromRunOfShowItem = (item = {}, asset = {}) => {
    const presentationPlan = item?.presentationPlan && typeof item.presentationPlan === 'object'
        ? item.presentationPlan
        : {};
    if (!roomMediaIdentityMatches(asset, presentationPlan)) {
        return { changed: false, item };
    }
    const currentTakeoverScene = String(presentationPlan?.takeoverScene || item?.type || 'announcement').trim().toLowerCase();
    const fallbackTakeoverScene = currentTakeoverScene === 'media_scene'
        ? (String(item?.type || 'announcement').trim().toLowerCase() || 'announcement')
        : currentTakeoverScene;
    return {
        changed: true,
        item: {
            ...item,
            presentationPlan: {
                ...presentationPlan,
                takeoverScene: fallbackTakeoverScene,
                mediaSceneUrl: '',
                mediaSceneType: 'image',
                mediaSceneFit: 'contain',
                mediaSceneSourceUploadId: '',
                mediaSceneStoragePath: '',
                mediaSceneFileName: '',
            },
        },
    };
};

export const reconcileRunOfShowDirectorMediaDeletion = (director = {}, asset = {}) => {
    const items = Array.isArray(director?.items) ? director.items : [];
    const affectedItemIds = [];
    let changed = false;
    const nextItems = items.map((item) => {
        const result = stripRoomMediaFromRunOfShowItem(item, asset);
        if (result.changed) {
            changed = true;
            if (item?.id) affectedItemIds.push(item.id);
        }
        return result.item;
    });
    return {
        changed,
        affectedItemIds,
        nextDirector: changed
            ? {
                ...director,
                items: nextItems,
            }
            : director,
    };
};
