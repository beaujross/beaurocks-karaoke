import React from "react";
import { ASSETS } from "../../../lib/assets";

const HostWorkspaceHeader = ({
  eyebrow,
  title,
  description,
  icon = "fa-wand-magic-sparkles",
  badge = "",
  actions = null,
  compact = false,
  className = "",
}) => (
  <header
    className={`relative overflow-hidden border-b border-cyan-200/20 bg-[radial-gradient(circle_at_12%_0%,rgba(34,211,238,0.24),transparent_34%),radial-gradient(circle_at_88%_0%,rgba(244,114,182,0.22),transparent_36%),linear-gradient(105deg,rgba(20,42,66,0.98),rgba(37,31,67,0.98)_52%,rgba(61,25,59,0.97))] shadow-[0_16px_45px_rgba(8,15,34,0.38)] ${compact ? "rounded-[1.05rem] border px-3 py-3 sm:px-4" : "min-h-[76px] px-3 py-2.5 sm:px-5"} ${className}`}
    data-host-workspace-horizon="true"
  >
    <div className="pointer-events-none absolute -left-8 top-0 h-24 w-48 rotate-12 bg-cyan-300/8 blur-3xl" />
    <div className="relative flex flex-wrap items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        <div
          className={`${compact ? "h-10 w-10" : "h-11 w-11"} relative grid shrink-0 place-items-center rounded-xl border border-white/12 bg-black/28 shadow-xl`}
        >
          <img
            src={ASSETS.logo}
            alt="BeauRocks"
            className="h-full w-full rounded-xl object-contain p-0.5 opacity-90"
          />
          <span className="absolute -bottom-1 -right-1 grid h-5 w-5 place-items-center rounded-md border border-cyan-100/25 bg-slate-950 text-[8px] text-cyan-200">
            <i className={`fa-solid ${icon}`} />
          </span>
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-[10px] font-black uppercase tracking-[0.24em] text-cyan-300">
              {eyebrow}
            </div>
            {badge ? (
              <span className="rounded-full border border-pink-200/20 bg-pink-400/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.14em] text-pink-100">
                {badge}
              </span>
            ) : null}
          </div>
          <h1
            className={`${compact ? "text-lg sm:text-xl" : "text-lg sm:text-xl"} truncate font-black tracking-tight text-white`}
          >
            {title}
          </h1>
          {description ? (
            <p className="mt-0.5 max-w-3xl text-xs leading-5 text-cyan-50/60">
              {description}
            </p>
          ) : null}
        </div>
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </div>
  </header>
);

export default HostWorkspaceHeader;
