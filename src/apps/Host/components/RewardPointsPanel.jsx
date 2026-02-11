import React from 'react';

const RewardPointsPanel = ({
    crowdPointsOpen,
    tipPointRate,
    setTipPointRate,
    styles,
    giftTargetUid,
    setGiftTargetUid,
    users,
    giftAmount,
    setGiftAmount,
    giftPointsToUser,
    dropBonus
}) => (
    <div className={crowdPointsOpen ? 'space-y-3' : 'hidden'}>
        <div>
            <div className="text-xs uppercase tracking-widest text-zinc-400 mb-2">Tip points rate</div>
            <input
                value={tipPointRate}
                onChange={e => setTipPointRate(e.target.value)}
                className={styles.input}
                placeholder="Points per $1 tip"
                title="How many points per $1 tip"
            />
            <div className="host-form-helper">Used when awarding points by dollar amount.</div>
        </div>
        <div className="space-y-2">
            <div className="text-xs uppercase tracking-widest text-zinc-400">Gift individual</div>
            <div className="grid grid-cols-3 gap-2">
                <select
                    value={giftTargetUid}
                    onChange={(e) => setGiftTargetUid(e.target.value)}
                    className={`${styles.input} text-xs w-full`}
                    title="Choose a lobby member"
                >
                    <option value="">Select member...</option>
                    {users.map(u => (
                        <option key={u.uid || u.id} value={u.uid || u.id?.split('_')[1]}>
                            {u.name || 'Guest'}
                        </option>
                    ))}
                </select>
                <input
                    value={giftAmount}
                    onChange={(e) => setGiftAmount(e.target.value)}
                    className={`${styles.input} text-xs w-full`}
                    placeholder="Pts"
                    title="Points to gift"
                />
                <button
                    onClick={() => {
                        const amount = Math.max(1, Number(giftAmount || 0));
                        if (!giftTargetUid || !amount) return;
                        giftPointsToUser?.(giftTargetUid, amount);
                        setGiftAmount('');
                    }}
                    className={`${styles.btnStd} ${styles.btnHighlight}`}
                >
                    Gift
                </button>
            </div>
        </div>
        <div className="space-y-2">
            <div className="text-xs uppercase tracking-widest text-zinc-400">Gift all</div>
            <div className="grid grid-cols-3 gap-2">
                {[50, 100, 250].map(val => (
                    <button key={val} onClick={() => dropBonus(val)} className={`${styles.btnStd} ${styles.btnSecondary}`}>+{val} pts</button>
                ))}
            </div>
        </div>
    </div>
);

export default RewardPointsPanel;
