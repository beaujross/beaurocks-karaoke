import React, { useState } from 'react';
import { callFunction } from '../../../lib/firebase';

const CLASSIFICATION_LABELS = Object.freeze({
    exact: 'Exact',
    opening_balance_gap: 'Opening history',
    missing_shadow_event: 'Missing shadow event',
    duplicate_idempotency_conflict: 'Duplicate / identity conflict',
    currency_mismatch: 'Currency mismatch',
    unsupported_legacy_spend: 'Unshadowed spend',
});

const SPEND_BLOCKER_LABELS = Object.freeze({
    report_truncated: 'Report is partial',
    accepted_operation_missing_ledger: 'Accepted spend missing its debit',
    accepted_operation_invalid_ledger: 'Spend and debit disagree',
    nonaccepted_operation_has_ledger: 'Declined spend created a debit',
    orphan_spend_ledger: 'Debit has no spend operation',
    invalid_balance_transition: 'Balance transition disagrees',
    unrecognized_operation_outcome: 'Unknown operation outcome',
    accepted_sample_below_threshold: 'Need more accepted canary spends',
    account_sample_below_threshold: 'Need more distinct canary guests',
    duplicate_replay_evidence_missing: 'Need one verified retry replay',
    required_spend_kind_missing: 'Reaction, profile, and avatar evidence required',
});
const SPEND_KIND_LABELS = Object.freeze({
    reaction: 'Reactions',
    profile_change: 'Profile changes',
    avatar_unlock: 'Avatar unlocks',
});

const formatNumber = (value = 0) => new Intl.NumberFormat('en-US').format(Number(value || 0) || 0);
const shortUid = (uid = '') => {
    const safeUid = String(uid || '').trim();
    return safeUid.length > 18 ? `${safeUid.slice(0, 8)}...${safeUid.slice(-6)}` : safeUid || '--';
};

const HostBeauBucksReconciliationPanel = ({ roomCode = '', styles = {} }) => {
    const [report, setReport] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const runReport = async () => {
        if (!roomCode || loading) return;
        setLoading(true);
        setError('');
        try {
            const nextReport = await callFunction('reconcileBeauBucksShadowLedger', { roomCode });
            setReport(nextReport || null);
        } catch (runError) {
            const message = String(runError?.message || 'Reconciliation report unavailable.');
            setError(message.replace(/^Firebase:\s*/i, '').replace(/\s*\([^)]*\)\.?$/, ''));
            setReport(null);
        } finally {
            setLoading(false);
        }
    };

    const summary = report?.summary || null;
    const accounts = Array.isArray(report?.accounts) ? report.accounts : [];
    const spendReadiness = report?.spendReadiness || null;
    const spendSummary = spendReadiness?.summary || null;
    const spendCoverage = spendReadiness?.coverage || {};
    const migrationReadiness = report?.migrationReadiness || null;
    const spendLedgerGapCount = [
        ...(spendCoverage.missingLedgerOperationIds || []),
        ...(spendCoverage.invalidLedgerOperationIds || []),
        ...(spendCoverage.unexpectedLedgerOperationIds || []),
        ...(spendCoverage.orphanLedgerOperationIds || []),
    ].length;
    return (
        <div className="mt-4 border-t border-white/10 pt-4" data-beaubucks-reconciliation="read-only">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <div className="text-sm uppercase tracking-widest text-zinc-500">BeauBucks Shadow Ledger</div>
                    <div className="mt-1 max-w-3xl text-xs text-zinc-400">
                        Read-only canary evidence. This compares the shadow ledger with the live room balance; it never changes grants, purchases, spends, refunds, or what guests see.
                    </div>
                </div>
                <button
                    type="button"
                    onClick={runReport}
                    disabled={!roomCode || loading}
                    className={`${styles.btnStd || ''} ${styles.btnSecondary || ''} px-4 ${loading ? 'cursor-not-allowed opacity-70' : ''}`}
                >
                    {loading ? 'Checking...' : report ? 'Refresh report' : 'Run read-only report'}
                </button>
            </div>

            {error && (
                <div className="mt-3 rounded-lg border border-amber-300/25 bg-amber-500/10 px-3 py-2 text-sm text-amber-100" role="status">
                    {error}
                </div>
            )}

            {summary && (
                <div className="mt-3 space-y-3">
                    <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                        <div className="rounded-lg border border-white/10 bg-zinc-900/60 p-3">
                            <div className="text-[11px] uppercase tracking-widest text-zinc-500">Accounts</div>
                            <div className="mt-1 text-xl font-semibold text-white">{formatNumber(summary.accountCount)}</div>
                        </div>
                        <div className="rounded-lg border border-emerald-300/20 bg-emerald-500/5 p-3">
                            <div className="text-[11px] uppercase tracking-widest text-emerald-200/70">Exact</div>
                            <div className="mt-1 text-xl font-semibold text-emerald-100">{formatNumber(summary.reconciledAccountCount)}</div>
                        </div>
                        <div className="rounded-lg border border-amber-300/20 bg-amber-500/5 p-3">
                            <div className="text-[11px] uppercase tracking-widest text-amber-200/70">Needs explanation</div>
                            <div className="mt-1 text-xl font-semibold text-amber-100">{formatNumber(summary.mismatchAccountCount)}</div>
                        </div>
                        <div className="rounded-lg border border-cyan-300/20 bg-cyan-500/5 p-3">
                            <div className="text-[11px] uppercase tracking-widest text-cyan-200/70">Authority</div>
                            <div className="mt-1 text-sm font-semibold text-cyan-100">Legacy balance</div>
                            <div className="text-[11px] text-cyan-100/60">Shadow is not live money</div>
                        </div>
                    </div>

                    {report.truncated && (
                        <div className="rounded-lg border border-rose-300/25 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
                            Partial report: at least one collection exceeded the {formatNumber(report?.limits?.maxDocumentsPerCollection || 250)}-document safety cap. Do not use this result as migration evidence.
                        </div>
                    )}

                    {spendSummary && (
                        <div className="rounded-xl border border-white/10 bg-black/20 p-4" data-beaubucks-spend-readiness={spendReadiness.boundaryReady ? 'ready' : 'collecting'}>
                            <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                    <div className="text-xs font-semibold uppercase tracking-widest text-zinc-300">Canary spend boundary</div>
                                    <div className="mt-1 max-w-3xl text-xs text-zinc-500">
                                        Operation evidence is evaluated separately from historical opening balances. Passing this check does not switch live balance reads.
                                    </div>
                                </div>
                                <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${spendReadiness.boundaryReady ? 'border-emerald-300/30 bg-emerald-500/10 text-emerald-100' : 'border-amber-300/30 bg-amber-500/10 text-amber-100'}`}>
                                    {spendReadiness.boundaryReady ? 'Boundary ready' : 'Collecting evidence'}
                                </span>
                            </div>
                            <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
                                <div className="rounded-lg border border-white/10 bg-zinc-900/60 p-3">
                                    <div className="text-[11px] uppercase tracking-widest text-zinc-500">Accepted</div>
                                    <div className="mt-1 text-lg font-semibold text-white">{formatNumber(spendSummary.acceptedOperationCount)}</div>
                                    <div className="text-[11px] text-zinc-500">target {formatNumber(spendReadiness?.thresholds?.minimumAcceptedOperations)}</div>
                                </div>
                                <div className="rounded-lg border border-white/10 bg-zinc-900/60 p-3">
                                    <div className="text-[11px] uppercase tracking-widest text-zinc-500">Guests</div>
                                    <div className="mt-1 text-lg font-semibold text-white">{formatNumber(spendSummary.distinctAcceptedAccountCount)}</div>
                                    <div className="text-[11px] text-zinc-500">target {formatNumber(spendReadiness?.thresholds?.minimumDistinctAccounts)}</div>
                                </div>
                                <div className="rounded-lg border border-cyan-300/20 bg-cyan-500/5 p-3">
                                    <div className="text-[11px] uppercase tracking-widest text-cyan-200/70">Safe replays</div>
                                    <div className="mt-1 text-lg font-semibold text-cyan-100">{formatNumber(spendSummary.duplicateReplayCount)}</div>
                                    <div className="text-[11px] text-cyan-100/60">same operation, no second debit</div>
                                </div>
                                <div className={`rounded-lg border p-3 ${spendLedgerGapCount === 0 ? 'border-emerald-300/20 bg-emerald-500/5' : 'border-rose-300/20 bg-rose-500/5'}`}>
                                    <div className="text-[11px] uppercase tracking-widest text-zinc-400">Ledger gaps</div>
                                    <div className={`mt-1 text-lg font-semibold ${spendLedgerGapCount === 0 ? 'text-emerald-100' : 'text-rose-100'}`}>{formatNumber(spendLedgerGapCount)}</div>
                                    <div className="text-[11px] text-zinc-500">accepted operation coverage</div>
                                </div>
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2">
                                {Object.entries(spendSummary.kindCounts || {}).map(([kind, counts]) => (
                                    <span key={kind} className="rounded-full border border-white/10 bg-zinc-900 px-2.5 py-1 text-[11px] text-zinc-300">
                                        {SPEND_KIND_LABELS[kind] || kind}: {formatNumber(counts?.accepted)} accepted
                                    </span>
                                ))}
                                <span className="rounded-full border border-white/10 bg-zinc-900 px-2.5 py-1 text-[11px] text-zinc-300">
                                    Insufficient: {formatNumber(spendSummary.insufficientOperationCount)}
                                </span>
                            </div>
                            {(spendReadiness.blockers || []).length > 0 && (
                                <div className="mt-3 flex flex-wrap gap-1.5">
                                    {(spendReadiness.blockers || []).map((blocker) => (
                                        <span key={blocker} className="rounded-full border border-amber-300/20 bg-amber-500/5 px-2 py-1 text-[11px] text-amber-100">
                                            {SPEND_BLOCKER_LABELS[blocker] || blocker}
                                        </span>
                                    ))}
                                </div>
                            )}
                            <div className="mt-3 rounded-lg border border-cyan-300/15 bg-cyan-500/5 px-3 py-2 text-xs text-cyan-100/80">
                                Balance migration: {migrationReadiness?.balanceReadMigrationReady ? 'eligible for an explicit review' : 'blocked; legacy room balance stays authoritative'}.
                                {migrationReadiness?.openingBalancePolicy?.required ? ' Historical gaps require explicit compensating opening entries; destructive backfill is not allowed.' : ''}
                            </div>
                        </div>
                    )}

                    <div className="overflow-x-auto rounded-xl border border-white/10">
                        <table className="min-w-full divide-y divide-white/10 text-left text-xs">
                            <thead className="bg-zinc-900/80 text-zinc-500">
                                <tr>
                                    <th className="px-3 py-2 font-medium">Account</th>
                                    <th className="px-3 py-2 font-medium">Currency</th>
                                    <th className="px-3 py-2 font-medium">Live</th>
                                    <th className="px-3 py-2 font-medium">Shadow</th>
                                    <th className="px-3 py-2 font-medium">Gap</th>
                                    <th className="px-3 py-2 font-medium">Explanation</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5 bg-black/20 text-zinc-300">
                                {accounts.map((account) => (
                                    <tr key={account.accountId}>
                                        <td className="px-3 py-2 font-mono" title={account.uid}>{shortUid(account.uid)}</td>
                                        <td className="px-3 py-2">{account.currency}</td>
                                        <td className="px-3 py-2">{formatNumber(account?.legacy?.roomPoints)}</td>
                                        <td className="px-3 py-2">{formatNumber(account?.shadowLedger?.postedBalance)}</td>
                                        <td className={`px-3 py-2 font-semibold ${account.delta === 0 ? 'text-emerald-300' : 'text-amber-200'}`}>
                                            {account.delta > 0 ? '+' : ''}{formatNumber(account.delta)}
                                        </td>
                                        <td className="px-3 py-2">
                                            <div className="flex max-w-xl flex-wrap gap-1">
                                                {(account.classifications || []).map((classification) => (
                                                    <span key={classification} className="rounded-full border border-white/10 bg-zinc-900 px-2 py-0.5 text-[11px] text-zinc-300">
                                                        {CLASSIFICATION_LABELS[classification] || classification}
                                                    </span>
                                                ))}
                                            </div>
                                            {((account?.canonicalAttribution?.canonicalSongIds || []).length > 0 || (account?.backingAttribution?.backingTrackIds || []).length > 0) && (
                                                <details className="mt-1 text-[11px] text-zinc-500">
                                                    <summary className="cursor-pointer">Attribution evidence</summary>
                                                    <div className="mt-1">Canonical songs: {(account.canonicalAttribution.canonicalSongIds || []).join(', ') || 'none'}</div>
                                                    <div>Performances: {(account.canonicalAttribution.performanceIds || []).join(', ') || 'none'}</div>
                                                    <div>Backing tracks: {(account.backingAttribution.backingTrackIds || []).join(', ') || 'none'}</div>
                                                </details>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                                {accounts.length === 0 && (
                                    <tr><td colSpan="6" className="px-3 py-5 text-center text-zinc-500">No room accounts or shadow entries were found.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

export default HostBeauBucksReconciliationPanel;
