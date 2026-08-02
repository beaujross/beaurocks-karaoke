export const HOST_LIVE_OPS_LANGUAGE = Object.freeze({
    lineup: "Tonight's Lineup",
    lineupShort: 'Lineup',
    showPlan: 'Show Plan',
    addPerformance: 'Add Performance',
    momentDrafts: 'Moment Drafts',
    saveDraft: 'Save Draft',
    addToLineup: 'Add to Lineup',
    startNext: 'Start Next',
    finishAndStartNext: 'Finish & Start Next',
    advancedShowControls: 'Advanced Show Controls',
    autoDj: 'Auto DJ',
    autoDjScope: 'performances only',
    autoAdvance: 'Auto-Advance',
    autoAdvanceOn: 'Auto-Advance On',
    autoAdvancePaused: 'Auto-Advance Paused',
    turnOnAutoAdvance: 'Turn On Auto-Advance',
    pauseAutoAdvance: 'Pause Auto-Advance',
    resumeAutoAdvance: 'Resume Auto-Advance',
});

export const HOST_LINEUP_STATE_LABELS = Object.freeze({
    draft: 'Draft',
    planned: 'In Lineup',
    ready: 'In Lineup',
    staged: 'Up Next',
    live: 'Live',
    complete: 'Finished',
    skipped: 'Finished',
});

export const getHostLineupStateLabel = ({ status = '', isDraft = false } = {}) => {
    if (isDraft) return HOST_LINEUP_STATE_LABELS.draft;
    return HOST_LINEUP_STATE_LABELS[String(status || '').trim().toLowerCase()] || HOST_LINEUP_STATE_LABELS.planned;
};
