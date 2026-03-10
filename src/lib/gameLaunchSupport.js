export const resolveRoomUserUid = (roomUser = {}) => roomUser?.uid || roomUser?.id?.split('_')[1] || '';

export const getResolvedRoomUserUids = (roomUsers = []) => (
    Array.isArray(roomUsers)
        ? roomUsers.map((entry) => resolveRoomUserUid(entry)).filter(Boolean)
        : []
);

export const findRoomUserByUid = (roomUsers = [], uid = '') => {
    if (!uid || !Array.isArray(roomUsers)) return null;
    return roomUsers.find((entry) => resolveRoomUserUid(entry) === uid) || null;
};

export const selectQuickLaunchBingoBoard = ({ bingoBoards = [], presetBoards = [] } = {}) => {
    const candidates = [
        ...(Array.isArray(bingoBoards) ? bingoBoards : []),
        ...(Array.isArray(presetBoards) ? presetBoards : [])
    ];
    return candidates.find((board) => Array.isArray(board?.tiles) && board.tiles.length > 0) || null;
};
