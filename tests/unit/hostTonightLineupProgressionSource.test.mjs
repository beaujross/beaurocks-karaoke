import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const readSource = (path) => readFileSync(path, 'utf8');

describe("Tonight's Lineup progression control", () => {
  it('wires the persistent horizon control to mixed-lineup auto-advance', () => {
    const host = readSource('src/apps/Host/HostApp.jsx');
    const horizon = readSource('src/apps/Host/components/HostQueueHorizon.jsx');

    expect(host).toContain('onToggleAutomation={toggleTonightLineupAutoAdvance}');
    expect(host).not.toContain('onOpenAutomation={toggleAutoDjQuick}');
    expect(horizon).toContain("model?.automation?.label || 'Auto-Advance Off'");
    expect(horizon).toContain('aria-pressed={automationEnabled}');
    expect(horizon).toContain('aria-busy={automationPending}');
    expect(horizon).toContain('data-feature-id="tonights-lineup-auto-advance"');
    expect(horizon).toMatch(/data-feature-id="tonights-lineup-auto-advance"[\s\S]{0,240}className=\{`inline-flex min-h-\[44px\]/);
  });

  it('adds queue references after committed scenes and adopts the active playback session', () => {
    const host = readSource('src/apps/Host/HostApp.jsx');

    expect(host).toContain('const ensureQueuedPerformancesInTonightLineup = useCallback');
    expect(host).toContain("mutateTonightLineupState('insert_performance'");
    expect(host).toContain("mutateTonightLineupState('adopt_active_performance'");
    expect(host).toContain('currentPerformanceSession');
    expect(host).toContain('ensureQueuedPerformancesInTonightLineup().catch');
  });

  it('uses revisioned transactional mutations for placement and automation intent', () => {
    const host = readSource('src/apps/Host/HostApp.jsx');
    const functions = readSource('functions/index.js');

    expect(host).toContain("mutateTonightLineupState('move_item'");
    expect(host).toContain("mutateTonightLineupState('remove_item'");
    expect(host).toContain("mutateTonightLineupState('assign_performance_to_slot'");
    expect(host).toContain("mutateTonightLineupState('set_automation_intent'");
    expect(functions).toContain('exports.mutateTonightLineup = onCall');
    expect(functions).toContain('lineup_revision_conflict');
    expect(functions).toContain('recentOperations');
    expect(functions).toContain('db.runTransaction');
  });

  it('refuses to recreate a deleted queue performance from a lineup snapshot', () => {
    const host = readSource('src/apps/Host/HostApp.jsx');
    const activation = host.slice(
      host.indexOf('const activateRunOfShowPerformanceItem'),
      host.indexOf('const buildRunOfShowCompletionRoomUpdates'),
    );

    expect(activation).toContain('await getDoc(queueDocRef)');
    expect(activation).toContain('This performance was removed from the queue');
    expect(activation).toContain('await updateDoc(queueDocRef');
    expect(activation).not.toContain('await setDoc(queueDocRef');
    expect(activation).toContain('currentPerformanceSession');
    expect(activation).toContain("sourceType: 'apple_music'");
    expect(activation).toContain("mutateTonightLineupState('adopt_active_performance'");
  });

  it('compare-and-sets executor actions so playback and edits cannot silently overwrite each other', () => {
    const functions = readSource('functions/index.js');
    const executor = functions.slice(
      functions.indexOf('exports.executeRunOfShowAction = onCall'),
      functions.indexOf('const normalizeAudienceDecisionChoiceId'),
    );

    expect(executor).toContain('admin.firestore().runTransaction');
    expect(executor).toContain('latestRevision !== startingRevision');
    expect(executor).toContain('recordTonightLineupOperation');
    expect(executor).toContain('lineup_revision_conflict');
  });

  it('pauses without clearing lineup state and resumes the full progression engine', () => {
    const host = readSource('src/apps/Host/HostApp.jsx');

    expect(host).toContain('toggleRunOfShowAutomationPause(true)');
    expect(host).toContain('toggleRunOfShowAutomationPause(false)');
    expect(host).toContain("updateRunOfShowPolicyState({ defaultAutomationMode: 'auto' })");
    expect(host).toContain("Tonight's lineup order is preserved.");
  });
});
