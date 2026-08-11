export const getHostRoomLaunchProgress = ({
  tvOpened = false,
  joinLinkCopied = false,
  roomSetupReviewed = false,
} = {}) => {
  const completedCount = Number(Boolean(tvOpened))
    + Number(Boolean(joinLinkCopied))
    + Number(Boolean(roomSetupReviewed));
  return {
    completedCount,
    totalCount: 3,
    complete: completedCount === 3,
    percent: Math.round((completedCount / 3) * 100),
  };
};
