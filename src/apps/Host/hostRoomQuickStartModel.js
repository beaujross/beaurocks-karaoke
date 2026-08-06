export const getHostRoomLaunchProgress = ({
  tvOpened = false,
  joinLinkCopied = false,
} = {}) => {
  const completedCount = Number(Boolean(tvOpened)) + Number(Boolean(joinLinkCopied));
  return {
    completedCount,
    totalCount: 2,
    complete: completedCount === 2,
    percent: completedCount * 50,
  };
};
