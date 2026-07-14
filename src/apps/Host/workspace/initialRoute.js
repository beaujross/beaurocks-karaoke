import {
    HOST_WORKSPACE_VIEWS,
    LEGACY_TAB_REDIRECTS,
    SECTION_TO_SETTINGS_TAB,
    getSectionMeta,
    getViewDefaultSection,
} from './navConfig.js';

const HOST_TABS = new Set(['stage', 'run_of_show', 'games', 'lobby', 'browse', 'admin']);

const normalizeToken = (value = '') => String(value || '').trim().toLowerCase();

export const resolveInitialHostWorkspaceRoute = (search = '') => {
    const params = new URLSearchParams(String(search || '').replace(/^\?/, ''));
    const requestedTab = normalizeToken(params.get('tab'));
    const requestedView = normalizeToken(params.get('view'));
    const requestedSection = normalizeToken(params.get('section'));
    const sectionMeta = getSectionMeta(requestedSection);
    const knownView = HOST_WORKSPACE_VIEWS.some((view) => view.id === requestedView) ? requestedView : '';

    if (HOST_TABS.has(requestedTab)) {
        if (requestedTab === 'admin') {
            const adminSection = sectionMeta && SECTION_TO_SETTINGS_TAB[sectionMeta.id]
                ? sectionMeta.id
                : 'ops.room_setup';
            return {
                tab: 'admin',
                view: getSectionMeta(adminSection)?.view || 'ops',
                section: adminSection,
                settingsTab: SECTION_TO_SETTINGS_TAB[adminSection] || 'general',
            };
        }
        const redirect = LEGACY_TAB_REDIRECTS[requestedTab] || LEGACY_TAB_REDIRECTS.stage;
        const hostSection = sectionMeta?.hostTab === requestedTab ? sectionMeta.id : redirect.section;
        return {
            tab: requestedTab,
            view: getSectionMeta(hostSection)?.view || redirect.view,
            section: hostSection,
            settingsTab: 'general',
        };
    }

    const resolvedSection = sectionMeta?.id || (knownView ? getViewDefaultSection(knownView) : 'ops.room_setup');
    const resolvedMeta = getSectionMeta(resolvedSection);
    const settingsTab = SECTION_TO_SETTINGS_TAB[resolvedSection];
    return {
        tab: settingsTab ? 'admin' : (resolvedMeta?.hostTab || 'admin'),
        view: resolvedMeta?.view || knownView || 'ops',
        section: resolvedSection,
        settingsTab: settingsTab || 'general',
    };
};
