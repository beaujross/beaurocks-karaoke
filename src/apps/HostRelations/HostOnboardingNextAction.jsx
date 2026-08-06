import React from 'react';
import { trackEvent } from '../../lib/firebase';
import { getHostOnboardingNextAction } from './hostOnboardingNextActionModel';

const HostOnboardingNextAction = ({ onboarding }) => {
  const action = getHostOnboardingNextAction(onboarding);

  return (
    <section
      className="relative overflow-hidden rounded-[1.6rem] border border-cyan-200/25 bg-[linear-gradient(120deg,rgba(8,47,73,0.92),rgba(45,20,58,0.9)_58%,rgba(10,10,14,0.96))] p-5 shadow-[0_18px_54px_rgba(6,182,212,0.12)] sm:p-6"
      data-host-onboarding-next-action={action.currentStage}
    >
      <div className="pointer-events-none absolute -right-12 -top-16 h-44 w-44 rounded-full bg-fuchsia-400/15 blur-3xl" />
      <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl border border-cyan-100/25 bg-cyan-300/10 text-xl text-cyan-100 shadow-[0_0_28px_rgba(34,211,238,0.16)]">
            <i className={`fa-solid ${action.icon}`} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <div className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-100/65">Your next step</div>
            <div className="mt-1 text-xs font-bold text-emerald-200">{action.stageLabel}</div>
            <h2 className="mt-1 text-2xl font-black text-white">{action.title}</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-cyan-50/70">{action.description}</p>
          </div>
        </div>
        <a
          className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-xl border border-cyan-100/30 bg-[linear-gradient(115deg,rgba(34,211,238,0.95),rgba(217,70,239,0.88))] px-5 py-3 text-sm font-black text-slate-950 shadow-[0_14px_34px_rgba(6,182,212,0.2)] transition hover:-translate-y-0.5 hover:brightness-110"
          href={action.href}
          data-host-onboarding-next-cta={action.ctaLabel}
          onClick={() => trackEvent('host_onboarding_next_action_clicked', {
            onboarding_stage: action.currentStage,
            source: 'host_hub_getting_started',
            destination: action.href,
          })}
        >
          {action.ctaLabel}
          <i className="fa-solid fa-arrow-right" aria-hidden="true" />
        </a>
      </div>
    </section>
  );
};

export default HostOnboardingNextAction;
