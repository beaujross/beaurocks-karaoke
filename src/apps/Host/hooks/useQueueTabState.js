import { useEffect, useMemo, useRef, useState } from 'react';

const PANEL_LAYOUT_DEFAULTS = {
    stagePanelOpen: true,
    tvControlsOpen: true,
    soundboardOpen: true,
    chatOpen: true,
    overlaysOpen: true,
    vibeSyncOpen: true,
    automationOpen: true,
    showAddForm: true,
    showQueueList: true
};

const PANEL_LAYOUT_KEYS = Object.keys(PANEL_LAYOUT_DEFAULTS);

const PANEL_LAYOUT_PRESETS = {
    default: { ...PANEL_LAYOUT_DEFAULTS },
    performance: {
        ...PANEL_LAYOUT_DEFAULTS,
        overlaysOpen: false,
        vibeSyncOpen: false,
        chatOpen: false
    },
    crowd: {
        ...PANEL_LAYOUT_DEFAULTS,
        automationOpen: false,
        showAddForm: false
    },
    broadcast: {
        ...PANEL_LAYOUT_DEFAULTS,
        soundboardOpen: false,
        chatOpen: false,
        showAddForm: false
    },
    all_open: PANEL_LAYOUT_KEYS.reduce((acc, key) => ({ ...acc, [key]: true }), {}),
    collapsed: PANEL_LAYOUT_KEYS.reduce((acc, key) => ({ ...acc, [key]: false }), {})
};

const WORKSPACE_OPTIONS = [
    { id: 'default', label: 'Default Layout' },
    { id: 'performance', label: 'Performance Mode' },
    { id: 'crowd', label: 'Crowd Mode' },
    { id: 'broadcast', label: 'Broadcast Mode' },
    { id: 'all_open', label: 'All Open' },
    { id: 'collapsed', label: 'Collapsed' },
    { id: 'custom', label: 'Custom Layout' }
];

const sanitizePart = (value = '', fallback = 'default') => {
    const cleaned = String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, '-')
        .replace(/^-+|-+$/g, '');
    return cleaned || fallback;
};

const parsePersistedState = (raw) => {
    if (!raw) return null;
    try {
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return null;
        const layout = {};
        PANEL_LAYOUT_KEYS.forEach((key) => {
            if (typeof parsed.layout?.[key] === 'boolean') layout[key] = parsed.layout[key];
        });
        const workspace = typeof parsed.workspace === 'string' ? parsed.workspace : null;
        return { layout, workspace };
    } catch {
        return null;
    }
};

const useQueueTabState = ({ hostName, roomCode }) => {
    const [stagePanelOpen, setStagePanelOpen] = useState(PANEL_LAYOUT_DEFAULTS.stagePanelOpen);
    const [tvControlsOpen, setTvControlsOpen] = useState(PANEL_LAYOUT_DEFAULTS.tvControlsOpen);
    const [soundboardOpen, setSoundboardOpen] = useState(PANEL_LAYOUT_DEFAULTS.soundboardOpen);
    const [chatOpen, setChatOpen] = useState(PANEL_LAYOUT_DEFAULTS.chatOpen);
    const [overlaysOpen, setOverlaysOpen] = useState(PANEL_LAYOUT_DEFAULTS.overlaysOpen);
    const [vibeSyncOpen, setVibeSyncOpen] = useState(PANEL_LAYOUT_DEFAULTS.vibeSyncOpen);
    const [automationOpen, setAutomationOpen] = useState(PANEL_LAYOUT_DEFAULTS.automationOpen);
    const [showAddForm, setShowAddForm] = useState(PANEL_LAYOUT_DEFAULTS.showAddForm);
    const [showQueueList, setShowQueueList] = useState(PANEL_LAYOUT_DEFAULTS.showQueueList);
    const [activeWorkspace, setActiveWorkspace] = useState('default');

    const [searchQ, setSearchQ] = useState('');
    const [results, setResults] = useState([]);
    const [manual, setManual] = useState({
        song: '',
        artist: '',
        singer: hostName || 'Host',
        url: '',
        art: '',
        lyrics: '',
        lyricsTimed: null,
        appleMusicId: '',
        duration: 180,
        backingAudioOnly: false,
        audioOnly: false
    });
    const [quickAddOnResultClick, setQuickAddOnResultClick] = useState(() => {
        try {
            if (typeof window === 'undefined') return true;
            const saved = localStorage.getItem('bross_quick_add_on_result_click');
            return saved === null ? true : saved === '1';
        } catch {
            return true;
        }
    });
    const [quickAddLoadingKey, setQuickAddLoadingKey] = useState('');
    const [quickAddNotice, setQuickAddNotice] = useState(null);
    const [lyricsOpen, setLyricsOpen] = useState(false);
    const [manualSingerMode, setManualSingerMode] = useState('select');
    const [editingSongId, setEditingSongId] = useState(null);
    const [editForm, setEditForm] = useState({
        title: '',
        artist: '',
        singer: '',
        url: '',
        art: '',
        lyrics: '',
        lyricsTimed: null,
        appleMusicId: '',
        duration: 180
    });
    const [customBonus, setCustomBonus] = useState('');
    const [ytSearchOpen, setYtSearchOpen] = useState(false);
    const [ytSearchTarget, setYtSearchTarget] = useState('manual');
    const [ytSearchQ, setYtSearchQ] = useState('');
    const [ytEditingQuery, setYtEditingQuery] = useState(false);
    const [ytResults, setYtResults] = useState([]);
    const [ytLoading, setYtLoading] = useState(false);
    const [ytSearchError, setYtSearchError] = useState('');
    const [embedCache, setEmbedCache] = useState({});
    const [_testingVideoId, setTestingVideoId] = useState(null);
    const [_previewIframe, _setPreviewIframe] = useState(null);

    const hydratedLayoutRef = useRef(false);

    const storageKey = useMemo(() => {
        const hostPart = sanitizePart(hostName, 'host');
        const roomPart = sanitizePart((roomCode || 'no-room').toUpperCase(), 'no-room');
        return `bross_host_panel_layout_${roomPart}_${hostPart}`;
    }, [hostName, roomCode]);

    const panelLayout = useMemo(() => ({
        stagePanelOpen,
        tvControlsOpen,
        soundboardOpen,
        chatOpen,
        overlaysOpen,
        vibeSyncOpen,
        automationOpen,
        showAddForm,
        showQueueList
    }), [
        stagePanelOpen,
        tvControlsOpen,
        soundboardOpen,
        chatOpen,
        overlaysOpen,
        vibeSyncOpen,
        automationOpen,
        showAddForm,
        showQueueList
    ]);

    const applyPanelLayout = (nextLayout = {}) => {
        const resolved = { ...PANEL_LAYOUT_DEFAULTS, ...nextLayout };
        setStagePanelOpen(!!resolved.stagePanelOpen);
        setTvControlsOpen(!!resolved.tvControlsOpen);
        setSoundboardOpen(!!resolved.soundboardOpen);
        setChatOpen(!!resolved.chatOpen);
        setOverlaysOpen(!!resolved.overlaysOpen);
        setVibeSyncOpen(!!resolved.vibeSyncOpen);
        setAutomationOpen(!!resolved.automationOpen);
        setShowAddForm(!!resolved.showAddForm);
        setShowQueueList(!!resolved.showQueueList);
    };

    const applyWorkspacePreset = (workspaceId = 'default') => {
        const preset = PANEL_LAYOUT_PRESETS[workspaceId];
        if (!preset) return;
        applyPanelLayout(preset);
        setActiveWorkspace(workspaceId);
    };

    const expandAllPanels = () => applyWorkspacePreset('all_open');
    const collapseAllPanels = () => applyWorkspacePreset('collapsed');
    const resetPanelLayout = () => applyWorkspacePreset('default');

    useEffect(() => {
        if (typeof window === 'undefined') {
            hydratedLayoutRef.current = true;
            return;
        }
        const hydrateTimer = setTimeout(() => {
            const persisted = parsePersistedState(window.localStorage.getItem(storageKey));
            const nextLayout = persisted?.layout || PANEL_LAYOUT_DEFAULTS;
            const workspace = persisted?.workspace;
            applyPanelLayout(nextLayout);
            if (workspace && (workspace === 'custom' || PANEL_LAYOUT_PRESETS[workspace])) {
                setActiveWorkspace(workspace);
            } else {
                setActiveWorkspace('default');
            }
            hydratedLayoutRef.current = true;
        }, 0);
        return () => clearTimeout(hydrateTimer);
    }, [storageKey]);

    useEffect(() => {
        if (!hydratedLayoutRef.current || typeof window === 'undefined') return;
        try {
            window.localStorage.setItem(storageKey, JSON.stringify({
                workspace: activeWorkspace,
                layout: panelLayout,
                updatedAt: Date.now()
            }));
        } catch {
            // Ignore persistence failures.
        }
    }, [storageKey, activeWorkspace, panelLayout]);

    useEffect(() => {
        if (!hydratedLayoutRef.current || activeWorkspace === 'custom') return;
        const preset = PANEL_LAYOUT_PRESETS[activeWorkspace] || PANEL_LAYOUT_PRESETS.default;
        const matchesPreset = PANEL_LAYOUT_KEYS.every((key) => Boolean(panelLayout[key]) === Boolean(preset[key]));
        if (!matchesPreset) {
            const workspaceTimer = setTimeout(() => setActiveWorkspace('custom'), 0);
            return () => clearTimeout(workspaceTimer);
        }
    }, [activeWorkspace, panelLayout]);

    return {
        stagePanelOpen,
        setStagePanelOpen,
        tvControlsOpen,
        setTvControlsOpen,
        soundboardOpen,
        setSoundboardOpen,
        chatOpen,
        setChatOpen,
        overlaysOpen,
        setOverlaysOpen,
        vibeSyncOpen,
        setVibeSyncOpen,
        automationOpen,
        setAutomationOpen,
        showAddForm,
        setShowAddForm,
        showQueueList,
        setShowQueueList,
        panelLayout,
        activeWorkspace,
        setActiveWorkspace,
        workspaceOptions: WORKSPACE_OPTIONS,
        applyWorkspacePreset,
        expandAllPanels,
        collapseAllPanels,
        resetPanelLayout,
        searchQ,
        setSearchQ,
        results,
        setResults,
        manual,
        setManual,
        quickAddOnResultClick,
        setQuickAddOnResultClick,
        quickAddLoadingKey,
        setQuickAddLoadingKey,
        quickAddNotice,
        setQuickAddNotice,
        lyricsOpen,
        setLyricsOpen,
        manualSingerMode,
        setManualSingerMode,
        editingSongId,
        setEditingSongId,
        editForm,
        setEditForm,
        customBonus,
        setCustomBonus,
        ytSearchOpen,
        setYtSearchOpen,
        ytSearchTarget,
        setYtSearchTarget,
        ytSearchQ,
        setYtSearchQ,
        ytEditingQuery,
        setYtEditingQuery,
        ytResults,
        setYtResults,
        ytLoading,
        setYtLoading,
        ytSearchError,
        setYtSearchError,
        embedCache,
        setEmbedCache,
        _testingVideoId,
        setTestingVideoId,
        _previewIframe,
        _setPreviewIframe
    };
};

export default useQueueTabState;
