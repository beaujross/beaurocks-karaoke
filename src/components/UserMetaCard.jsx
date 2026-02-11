import React from 'react';
import { FameLevelProgressBar } from './FameLevelBadge';

const vipBadge = (
  <span className="inline-flex items-center text-[9px] uppercase tracking-[0.18em] px-1.5 py-0.5 rounded-full border bg-[#00C4D9]/10 text-cyan-200 border-[#00C4D9]/40">
    VIP
  </span>
);

export default function UserMetaCard({
  mode = 'compact',
  avatar = '\u{1F600}',
  name = 'Guest',
  isVip = false,
  fameLevel = 0,
  fameLevelName = 'Rising Star',
  fameProgressToNext = 0,
  fameTotal = 0,
  showFame = true,
  showProgress = true,
  nameMaxClass = 'max-w-[140px]',
}) {
  if (mode === 'full') {
    return (
      <div className="flex items-center gap-4">
        <div className="text-5xl drop-shadow-[0_0_16px_rgba(0,196,217,0.4)]">{avatar}</div>
        <div className="min-w-0">
          <div className="text-3xl font-black truncate">{name || 'Guest'}</div>
          {isVip ? <div className="mt-1 inline-flex">{vipBadge}</div> : null}
          {showFame ? (
            <div className="mt-2">
              <div className="text-sm text-zinc-300">Lv {fameLevel} - {fameLevelName}</div>
              {showProgress ? (
                <div className="mt-1">
                  <FameLevelProgressBar level={fameLevel} progressToNext={fameProgressToNext} showLabel={false} />
                </div>
              ) : null}
              <div className="mt-1 text-xs text-zinc-400">{Number(fameTotal || 0).toLocaleString()} fame points</div>
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 min-w-0 flex-1">
      <span className="text-2xl">{avatar || '\u{1F600}'}</span>
      <div className="min-w-0 flex-1">
        <div className="text-sm text-white font-bold flex items-center gap-2">
          <span className={`truncate ${nameMaxClass}`}>{name || 'Guest'}</span>
          {isVip ? vipBadge : null}
        </div>
        {showFame ? (
          <div className="mt-1">
            <div className="text-[10px] text-zinc-300">Lv {fameLevel} - {fameLevelName}</div>
            {showProgress ? (
              <div className="mt-1">
                <FameLevelProgressBar level={fameLevel} progressToNext={fameProgressToNext} showLabel={false} />
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
