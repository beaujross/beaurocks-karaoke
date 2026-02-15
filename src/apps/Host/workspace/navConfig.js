export const HOST_WORKSPACE_VIEWS = Object.freeze([
    { id: 'ops', label: 'Operations', icon: 'fa-sliders', defaultSection: 'ops.room_setup' },
    { id: 'queue', label: 'Queue & Performances', icon: 'fa-list-check', defaultSection: 'queue.live_run' },
    { id: 'audience', label: 'Audience', icon: 'fa-users', defaultSection: 'audience.roster' },
    { id: 'media', label: 'Media & Displays', icon: 'fa-tv', defaultSection: 'media.playback' },
    { id: 'games', label: 'Games', icon: 'fa-gamepad', defaultSection: 'games.live_controls' },
    { id: 'billing', label: 'Billing & Usage', icon: 'fa-credit-card', defaultSection: 'billing.overview' },
    { id: 'advanced', label: 'Advanced Tools', icon: 'fa-screwdriver-wrench', defaultSection: 'advanced.diagnostics' }
]);

export const HOST_WORKSPACE_SECTIONS = Object.freeze([
    { id: 'ops.room_setup', view: 'ops', label: 'Room Setup', legacyTab: 'general' },
    { id: 'ops.automation', view: 'ops', label: 'Automation', legacyTab: 'automations' },
    { id: 'queue.live_run', view: 'queue', label: 'Live Run', hostTab: 'stage' },
    { id: 'queue.catalog', view: 'queue', label: 'Catalog', hostTab: 'browse' },
    { id: 'audience.roster', view: 'audience', label: 'Roster', hostTab: 'lobby' },
    { id: 'audience.chat', view: 'audience', label: 'Chat', legacyTab: 'chat' },
    { id: 'audience.moderation', view: 'audience', label: 'Moderation', legacyTab: 'moderation' },
    { id: 'audience.monetization', view: 'audience', label: 'Monetization', legacyTab: 'monetization' },
    { id: 'media.playback', view: 'media', label: 'Playback', legacyTab: 'media' },
    { id: 'media.marquee', view: 'media', label: 'Marquee', legacyTab: 'marquee' },
    { id: 'games.live_controls', view: 'games', label: 'Live Controls', hostTab: 'games', legacyTab: 'gamepad' },
    { id: 'billing.overview', view: 'billing', label: 'Overview', legacyTab: 'billing' },
    { id: 'advanced.diagnostics', view: 'advanced', label: 'Diagnostics', legacyTab: 'qa' },
    { id: 'advanced.live_effects', view: 'advanced', label: 'Live Effects', legacyTab: 'live_effects' }
]);

export const LEGACY_TAB_REDIRECTS = Object.freeze({
    stage: { view: 'queue', section: 'queue.live_run' },
    games: { view: 'games', section: 'games.live_controls' },
    lobby: { view: 'audience', section: 'audience.roster' },
    browse: { view: 'queue', section: 'queue.catalog' }
});

export const SETTINGS_TAB_TO_SECTION = Object.freeze({
    general: 'ops.room_setup',
    automations: 'ops.automation',
    chat: 'audience.chat',
    moderation: 'audience.moderation',
    monetization: 'audience.monetization',
    media: 'media.playback',
    marquee: 'media.marquee',
    gamepad: 'games.live_controls',
    billing: 'billing.overview',
    qa: 'advanced.diagnostics',
    live_effects: 'advanced.live_effects'
});

export const SECTION_TO_SETTINGS_TAB = Object.freeze(
    Object.entries(SETTINGS_TAB_TO_SECTION).reduce((acc, [tab, section]) => {
        acc[section] = tab;
        return acc;
    }, {})
);

export const getViewDefaultSection = (viewId = 'ops') =>
    HOST_WORKSPACE_VIEWS.find((view) => view.id === viewId)?.defaultSection || 'ops.room_setup';

export const getSectionMeta = (sectionId = '') =>
    HOST_WORKSPACE_SECTIONS.find((section) => section.id === sectionId) || null;

