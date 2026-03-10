"use strict";

const buildLyricsAiAccessState = ({
  timedOnly = false,
  aiCapabilityEnabled = false,
  demoBypassEnabled = false,
  aiFallbackConfigured = false,
} = {}) => {
  const allowAiFallback = !timedOnly && (!!aiCapabilityEnabled || !!demoBypassEnabled);
  return {
    allowAiFallback,
    aiCapabilityBlocked: !timedOnly && !aiCapabilityEnabled && !demoBypassEnabled,
    canCallAiProvider: allowAiFallback && !!aiFallbackConfigured,
  };
};

module.exports = {
  buildLyricsAiAccessState,
};
