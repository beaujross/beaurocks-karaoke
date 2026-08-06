import React from 'react';

const ComplimentaryHostSetupReady = ({
  hostName = 'Host',
  workspaceName = '',
  onBack,
  onFinish,
  buttonClass = '',
  secondaryButtonClass = '',
}) => (
  <div className="space-y-4" data-complimentary-host-setup-ready>
    <div className="rounded-2xl border border-emerald-300/30 bg-[linear-gradient(120deg,rgba(6,78,59,0.26),rgba(8,47,73,0.5),rgba(31,20,48,0.65))] p-5 shadow-[0_0_28px_rgba(52,211,153,0.1)]">
      <div className="flex items-start gap-4">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-emerald-200/25 bg-emerald-400/10 text-lg text-emerald-100">
          <i className="fa-solid fa-check" aria-hidden="true" />
        </span>
        <div>
          <div className="text-[11px] font-black uppercase tracking-[0.24em] text-emerald-100/70">Host profile ready</div>
          <h3 className="mt-1 text-xl font-black text-white">Your complimentary testing access is active</h3>
          <p className="mt-2 text-sm leading-6 text-emerald-50/75">Approved testing access is $0 while your invitation is active. No card is required, no subscription was started, and there are no automatic charges. If paid Host plans become available, you will see the price, what is included, and the terms before deciding. Access will not convert automatically; you must explicitly opt in before any charge.</p>
          <p className="mt-2 text-sm leading-6 text-emerald-50/65">Next, use Room Setup to prepare the Room your guests will join.</p>
        </div>
      </div>
    </div>

    <div className="grid gap-3 sm:grid-cols-2" aria-label="Saved Host profile">
      <div className="rounded-xl border border-cyan-300/20 bg-black/20 p-4">
        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-100/55">Host name</div>
        <div className="mt-1 text-base font-black text-white">{hostName || 'Host'}</div>
      </div>
      <div className="rounded-xl border border-fuchsia-300/20 bg-black/20 p-4">
        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-fuchsia-100/55">Workspace</div>
        <div className="mt-1 text-base font-black text-white">{workspaceName || `${hostName || 'Host'} Workspace`}</div>
      </div>
    </div>

    <div className="flex flex-wrap justify-between gap-2">
      <button type="button" onClick={onBack} className={secondaryButtonClass}>Back</button>
      <button type="button" onClick={onFinish} className={buttonClass}>Continue to Room Setup</button>
    </div>
  </div>
);

export default ComplimentaryHostSetupReady;
