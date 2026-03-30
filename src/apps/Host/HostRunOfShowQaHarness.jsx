import React, { useMemo, useState } from 'react';
import RunOfShowDirectorPanel from './components/RunOfShowDirectorPanel';
import { buildQaHostFixture } from './qaHostFixtures';
import {
    RUN_OF_SHOW_OPERATOR_ROLES,
    RUN_OF_SHOW_PROGRAM_MODES,
    createRunOfShowItem,
    getRunOfShowRoleCapabilities,
    normalizeRunOfShowDirector,
    normalizeRunOfShowPolicy,
    normalizeRunOfShowRoles,
    normalizeRunOfShowTemplateMeta,
    resequenceRunOfShowItems,
} from '../../lib/runOfShowDirector';

const cloneDirectorWithItems = (director = {}, items = []) => normalizeRunOfShowDirector({
    ...(director || {}),
    items: resequenceRunOfShowItems(items),
});

export default function HostRunOfShowQaHarness({ fixtureId = 'run-of-show-console', roomCode = 'DEMOAAHF' }) {
    const fixture = useMemo(() => buildQaHostFixture(fixtureId, { roomCode, nowMs: Date.now() }) || {}, [fixtureId, roomCode]);
    const initialRoom = fixture.room || {};
    const [programMode, setProgramMode] = useState(initialRoom.programMode || RUN_OF_SHOW_PROGRAM_MODES.runOfShow);
    const [enabled, setEnabled] = useState(initialRoom.runOfShowEnabled === true);
    const [director, setDirector] = useState(() => normalizeRunOfShowDirector(initialRoom.runOfShowDirector || {}));
    const [runOfShowPolicy, setRunOfShowPolicy] = useState(() => normalizeRunOfShowPolicy(initialRoom.runOfShowPolicy || {}));
    const [runOfShowRoles, setRunOfShowRoles] = useState(() => normalizeRunOfShowRoles(initialRoom.runOfShowRoles || {}));
    const [runOfShowTemplateMeta, setRunOfShowTemplateMeta] = useState(() => normalizeRunOfShowTemplateMeta(initialRoom.runOfShowTemplateMeta || {}));
    const [runOfShowTemplates, setRunOfShowTemplates] = useState(Array.isArray(fixture.runOfShowTemplates) ? fixture.runOfShowTemplates : []);
    const [submissions, setSubmissions] = useState(Array.isArray(fixture.runOfShowSubmissions) ? fixture.runOfShowSubmissions : []);
    const [previewActiveId, setPreviewActiveId] = useState(String(initialRoom?.tvPreviewOverlay?.itemId || ''));
    const operatorRole = RUN_OF_SHOW_OPERATOR_ROLES.host;
    const operatorCapabilities = getRunOfShowRoleCapabilities(operatorRole);

    const patchItem = (itemId = '', patch = {}) => {
        setDirector((prev) => cloneDirectorWithItems(prev, (prev.items || []).map((item) => (
            item.id === itemId ? { ...item, ...(patch || {}) } : item
        ))));
    };

    return (
        <div className="min-h-screen bg-zinc-950 px-4 py-6 text-white">
            <div className="mx-auto max-w-[1480px] space-y-4">
                <div className="rounded-3xl border border-white/10 bg-black/30 p-4">
                    <div className="text-xs uppercase tracking-[0.3em] text-zinc-500">Host QA Harness</div>
                    <div className="mt-2 text-2xl font-bold text-white">Run-of-show console fixture</div>
                    <div className="mt-1 text-sm text-zinc-400">This harness renders the operator surface without the full host runtime so Playwright can validate the console deterministically.</div>
                </div>

                <RunOfShowDirectorPanel
                    enabled={enabled}
                    programMode={programMode}
                    director={director}
                    runOfShowPolicy={runOfShowPolicy}
                    runOfShowRoles={runOfShowRoles}
                    runOfShowTemplateMeta={runOfShowTemplateMeta}
                    runOfShowTemplates={runOfShowTemplates}
                    submissions={submissions}
                    roomUsers={Array.isArray(fixture.users) ? fixture.users : []}
                    localLibrary={Array.isArray(fixture.localLibrary) ? fixture.localLibrary : []}
                    ytIndex={Array.isArray(fixture.ytIndex) ? fixture.ytIndex : []}
                    appleMusicAuthorized={false}
                    previewActiveId={previewActiveId}
                    operatorRole={operatorRole}
                    operatorCapabilities={operatorCapabilities}
                    onSetEnabled={setEnabled}
                    onSetProgramMode={setProgramMode}
                    onAddItem={(type, overrides = {}) => {
                        setDirector((prev) => cloneDirectorWithItems(prev, [
                            ...(prev.items || []),
                            createRunOfShowItem(type, { ...(overrides || {}), status: 'draft' }),
                        ]));
                    }}
                    onDuplicateItem={(itemId) => {
                        setDirector((prev) => {
                            const items = prev.items || [];
                            const target = items.find((entry) => entry.id === itemId);
                            if (!target) return prev;
                            return cloneDirectorWithItems(prev, [...items, createRunOfShowItem(target.type, { ...target, id: '' })]);
                        });
                    }}
                    onDeleteItem={(itemId) => {
                        setDirector((prev) => cloneDirectorWithItems(prev, (prev.items || []).filter((item) => item.id !== itemId)));
                    }}
                    onMoveItem={(itemId, delta) => {
                        setDirector((prev) => {
                            const items = [...(prev.items || [])];
                            const index = items.findIndex((item) => item.id === itemId);
                            if (index < 0) return prev;
                            const nextIndex = Math.max(0, Math.min(items.length - 1, index + Number(delta || 0)));
                            if (nextIndex === index) return prev;
                            const [moved] = items.splice(index, 1);
                            items.splice(nextIndex, 0, moved);
                            return cloneDirectorWithItems(prev, items);
                        });
                    }}
                    onUpdateItem={patchItem}
                    onToggleAutomationPause={(value) => {
                        setDirector((prev) => normalizeRunOfShowDirector({ ...prev, automationPaused: value === true }));
                    }}
                    onPrepareItem={(itemId) => patchItem(itemId, { status: 'staged' })}
                    onPreviewItem={(itemId) => setPreviewActiveId(String(itemId || ''))}
                    onClearPreview={() => setPreviewActiveId('')}
                    onStartItem={(itemId) => {
                        setDirector((prev) => cloneDirectorWithItems(prev, (prev.items || []).map((item) => ({
                            ...item,
                            status: item.id === itemId ? 'live' : item.status === 'live' ? 'complete' : item.status,
                        }))));
                    }}
                    onCompleteItem={(itemId) => patchItem(itemId, { status: 'complete' })}
                    onSkipItem={(itemId) => patchItem(itemId, { status: 'skipped' })}
                    onReviewSubmission={(submissionId, status) => {
                        setSubmissions((prev) => prev.map((entry) => (
                            entry.id === submissionId ? { ...entry, submissionStatus: status } : entry
                        )));
                    }}
                    onUpdatePolicy={(patch) => setRunOfShowPolicy((prev) => normalizeRunOfShowPolicy({ ...(prev || {}), ...(patch || {}) }))}
                    onUpdateRoles={(patch) => setRunOfShowRoles((prev) => normalizeRunOfShowRoles({ ...(prev || {}), ...(patch || {}) }))}
                    onApplyGeneratedDraft={({ items, mode }) => {
                        setDirector((prev) => cloneDirectorWithItems(
                            prev,
                            mode === 'append'
                                ? [...(prev.items || []), ...(Array.isArray(items) ? items : [])]
                                : (Array.isArray(items) ? items : [])
                        ));
                    }}
                    onSaveTemplate={(templateName) => {
                        const templateId = `fixture_${Date.now().toString(36)}`;
                        const template = {
                            id: templateId,
                            templateId,
                            templateName: templateName || 'Fixture Template',
                            runOfShowDirector: director,
                            runOfShowPolicy: runOfShowPolicy,
                        };
                        setRunOfShowTemplates((prev) => [template, ...(prev || [])]);
                        setRunOfShowTemplateMeta((prev) => normalizeRunOfShowTemplateMeta({
                            ...(prev || {}),
                            currentTemplateId: templateId,
                            currentTemplateName: template.templateName,
                        }));
                    }}
                    onApplyTemplate={(templateId) => {
                        const template = (runOfShowTemplates || []).find((entry) => (entry.templateId || entry.id) === templateId);
                        if (!template) return;
                        setDirector(normalizeRunOfShowDirector(template.runOfShowDirector || {}));
                        setRunOfShowPolicy(normalizeRunOfShowPolicy(template.runOfShowPolicy || {}));
                        setRunOfShowTemplateMeta((prev) => normalizeRunOfShowTemplateMeta({
                            ...(prev || {}),
                            currentTemplateId: templateId,
                            currentTemplateName: template.templateName || templateId,
                        }));
                    }}
                    onArchiveCurrent={(templateName) => {
                        const archiveId = `archive_${Date.now().toString(36)}`;
                        setRunOfShowTemplates((prev) => [{
                            id: archiveId,
                            templateId: archiveId,
                            templateName: templateName || 'Archived Fixture',
                            templateType: 'archive',
                            runOfShowDirector: director,
                            runOfShowPolicy: runOfShowPolicy,
                        }, ...(prev || [])]);
                        setRunOfShowTemplateMeta((prev) => normalizeRunOfShowTemplateMeta({
                            ...(prev || {}),
                            lastArchiveId: archiveId,
                            archivedAtMs: Date.now(),
                        }));
                    }}
                />
            </div>
        </div>
    );
}
