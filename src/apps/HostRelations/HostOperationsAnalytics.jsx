import React, { useEffect, useMemo, useState } from "react";
import { createHostPasswordResetLink, setHostApprovalStatus } from "../../lib/firebase";

const DAY_MS = 86400000;
const METER_META = [
  {
    id: "ai_generate_content",
    shortLabel: "AI",
    color: "#22d3ee",
    icon: "fa-wand-magic-sparkles",
  },
  {
    id: "youtube_data_request",
    shortLabel: "YouTube",
    color: "#f472b6",
    icon: "fa-brands fa-youtube",
  },
  {
    id: "apple_music_request",
    shortLabel: "Apple",
    color: "#fbbf24",
    icon: "fa-brands fa-apple",
  },
];
const inputClass =
  "w-full rounded-xl border border-white/10 bg-black/35 px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-cyan-300/45 focus:ring-2 focus:ring-cyan-400/10";
const formatCount = (value) =>
  new Intl.NumberFormat().format(Number(value || 0));
const formatDate = (value) => {
  const numeric = Number(value || 0);
  if (!numeric) return "Not yet";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(numeric));
};
const formatAgo = (value, referenceMs = 0) => {
  const numeric = Number(value || 0);
  if (!numeric) return "Never";
  const days = Math.max(
    0,
    Math.floor((Number(referenceMs || numeric) - numeric) / DAY_MS),
  );
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days} days ago`;
  return formatDate(numeric);
};
const getUsageValue = (host, meterId) =>
  Number(host?.usageMeters?.[meterId]?.used || 0);
const getOnboardingStage = (host) =>
  host?.secondRoomAtMs
    ? "Repeat Host"
    : host?.firstRoomAtMs
      ? "First Room complete"
      : host?.workspaceActivatedAtMs
        ? "Workspace ready"
        : "Invitation approved";
const getHostHealth = (host, referenceMs = Date.now()) => {
  if (!host?.workspaceActivatedAtMs)
    return {
      label: "Needs setup",
      tone: "amber",
      icon: "fa-screwdriver-wrench",
      detail: "Has access but has not opened the Host workspace.",
    };
  if (!host?.firstRoomAtMs)
    return {
      label: "Needs rehearsal",
      tone: "amber",
      icon: "fa-microphone-lines",
      detail: "Workspace is ready; the first Room has not been created.",
    };
  if (referenceMs - Number(host.lastRoomAtMs || 0) > 14 * DAY_MS)
    return {
      label: "Dormant",
      tone: "rose",
      icon: "fa-moon",
      detail: `No provisioned Room in ${Math.floor((referenceMs - Number(host.lastRoomAtMs || 0)) / DAY_MS)} days.`,
    };
  return {
    label: "Healthy",
    tone: "emerald",
    icon: "fa-signal",
    detail: "Recently provisioned a Room.",
  };
};

const Panel = ({ children, className = "" }) => (
  <section
    className={`rounded-2xl border border-white/10 bg-zinc-950/72 shadow-[0_18px_50px_rgba(0,0,0,0.28)] backdrop-blur-xl ${className}`}
  >
    {children}
  </section>
);
const Eyebrow = ({ children, tone = "cyan" }) => (
  <div
    className={`text-[10px] font-black uppercase tracking-[0.24em] ${tone === "pink" ? "text-pink-300" : tone === "amber" ? "text-amber-300" : "text-cyan-300"}`}
  >
    {children}
  </div>
);
const StatusChip = ({ children, tone = "neutral" }) => {
  const tones = {
    cyan: "border-cyan-300/25 bg-cyan-500/10 text-cyan-100",
    amber: "border-amber-300/25 bg-amber-500/10 text-amber-100",
    rose: "border-rose-300/25 bg-rose-500/10 text-rose-100",
    emerald: "border-emerald-300/25 bg-emerald-500/10 text-emerald-100",
    neutral: "border-white/10 bg-white/5 text-zinc-300",
  };
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${tones[tone] || tones.neutral}`}
    >
      {children}
    </span>
  );
};

const Metric = ({
  label,
  value,
  detail,
  tone = "cyan",
  icon = "fa-chart-simple",
  progress = null,
}) => {
  const accents = {
    cyan: "from-cyan-400/18 via-cyan-500/5 text-cyan-200",
    pink: "from-pink-400/18 via-pink-500/5 text-pink-200",
    amber: "from-amber-300/18 via-amber-500/5 text-amber-200",
    emerald: "from-emerald-300/18 via-emerald-500/5 text-emerald-200",
  };
  return (
    <Panel
      className={`relative overflow-hidden bg-gradient-to-br ${accents[tone] || accents.cyan} to-transparent p-4`}
    >
      <div className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-xl border border-current/10 bg-black/20">
        <i className={`fa-solid ${icon}`} />
      </div>
      <Eyebrow tone={tone}>{label}</Eyebrow>
      <div className="mt-2 text-3xl font-black tracking-tight text-white">
        {formatCount(value)}
      </div>
      <p className="mt-1 pr-8 text-xs leading-5 text-zinc-400">{detail}</p>
      {progress !== null ? (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-black/35">
          <div
            className="h-full rounded-full bg-current"
            style={{
              width: `${Math.max(3, Math.min(100, Number(progress || 0)))}%`,
            }}
          />
        </div>
      ) : null}
    </Panel>
  );
};

const FunnelChart = ({ funnel = {} }) => {
  const approved = Math.max(1, Number(funnel.approved || 0));
  const stages = [
    {
      label: "Approved",
      value: funnel.approved,
      color: "from-cyan-400 to-sky-500",
    },
    {
      label: "Opened workspace",
      value: funnel.activatedHosts,
      color: "from-sky-400 to-violet-500",
    },
    {
      label: "Created first Room",
      value: funnel.firstRoomHosts,
      color: "from-violet-400 to-fuchsia-500",
    },
    {
      label: "Returned for Room 2",
      value: funnel.repeatHosts,
      color: "from-fuchsia-400 to-pink-500",
    },
  ];
  return (
    <Panel className="p-4 sm:p-5" data-host-analytics-funnel>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Eyebrow>Activation journey</Eyebrow>
          <h2 className="mt-1 text-xl font-black text-white">
            From invitation to repeat Host
          </h2>
          <p className="mt-1 text-xs text-zinc-500">
            Milestone conversion among approved Hosts.
          </p>
        </div>
        <div className="rounded-xl border border-pink-300/15 bg-pink-500/8 px-3 py-2 text-right">
          <div className="text-lg font-black text-pink-100">
            {formatCount(funnel.activeHosts30)}
          </div>
          <div className="text-[9px] font-black uppercase tracking-[0.16em] text-pink-300">
            Active in 30 days
          </div>
        </div>
      </div>
      <div className="mt-6 space-y-4">
        {stages.map((stage) => {
          const percent = Math.round(
            (Number(stage.value || 0) / approved) * 100,
          );
          return (
            <div key={stage.label}>
              <div className="mb-1.5 flex items-center justify-between gap-3 text-xs">
                <span className="font-bold text-zinc-200">{stage.label}</span>
                <span className="text-zinc-500">
                  <strong className="text-white">
                    {formatCount(stage.value)}
                  </strong>{" "}
                  · {percent}%
                </span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-black/35">
                <div
                  className={`h-full rounded-full bg-gradient-to-r ${stage.color} shadow-[0_0_18px_rgba(34,211,238,0.2)]`}
                  style={{
                    width: `${Math.max(Number(stage.value || 0) ? 4 : 0, Math.min(100, percent))}%`,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
};

const UsageMixChart = ({ totals = {}, period = "" }) => {
  const entries = METER_META.map((meter) => ({
    ...meter,
    value: Number(totals?.[meter.id] || 0),
  }));
  const total = entries.reduce((sum, item) => sum + item.value, 0);
  let cursor = 0;
  const segments = entries.map((item) => {
    const start = cursor;
    cursor += total ? (item.value / total) * 100 : 0;
    return `${item.color} ${start}% ${cursor}%`;
  });
  return (
    <Panel className="p-4 sm:p-5" data-host-usage-mix>
      <Eyebrow tone="pink">Metered usage</Eyebrow>
      <h2 className="mt-1 text-lg font-black text-white">
        Provider activity mix
      </h2>
      <p className="mt-1 text-xs text-zinc-500">
        Usage units in {period || "the selected month"}—not estimated dollars.
      </p>
      <div className="mt-5 flex items-center gap-5">
        <div
          className="relative grid h-32 w-32 shrink-0 place-items-center rounded-full"
          style={{
            background: total
              ? `conic-gradient(${segments.join(", ")})`
              : "rgba(255,255,255,0.08)",
          }}
        >
          <div className="grid h-[82px] w-[82px] place-items-center rounded-full border border-white/10 bg-zinc-950 text-center">
            <div>
              <div className="text-2xl font-black text-white">
                {formatCount(total)}
              </div>
              <div className="text-[9px] uppercase tracking-[0.16em] text-zinc-500">
                total units
              </div>
            </div>
          </div>
        </div>
        <div className="min-w-0 flex-1 space-y-3">
          {entries.map((item) => (
            <div key={item.id} className="flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ background: item.color }}
              />
              <i
                className={`fa-solid ${item.icon} w-4 text-center text-xs text-zinc-500`}
              />
              <span className="min-w-0 flex-1 text-xs font-bold text-zinc-300">
                {item.shortLabel}
              </span>
              <strong className="text-sm text-white">
                {formatCount(item.value)}
              </strong>
            </div>
          ))}
        </div>
      </div>
    </Panel>
  );
};

const CohortChart = ({ cohorts = {} }) => {
  const entries = Object.entries(cohorts).sort(
    (left, right) => Number(right[1]) - Number(left[1]),
  );
  const max = Math.max(1, ...entries.map(([, value]) => Number(value || 0)));
  return (
    <Panel className="p-4 sm:p-5" data-host-cohort-chart>
      <Eyebrow tone="amber">Applicant mix</Eyebrow>
      <h2 className="mt-1 text-lg font-black text-white">
        Who is asking for access
      </h2>
      <div className="mt-4 space-y-3">
        {entries.slice(0, 6).map(([key, value]) => (
          <div key={key}>
            <div className="mb-1 flex items-center justify-between gap-2 text-xs">
              <span className="capitalize text-zinc-300">
                {key.replace(/_/g, " ")}
              </span>
              <strong className="text-white">{formatCount(value)}</strong>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-black/35">
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-300 to-pink-400"
                style={{
                  width: `${Math.max(5, (Number(value || 0) / max) * 100)}%`,
                }}
              />
            </div>
          </div>
        ))}
        {!entries.length ? (
          <p className="text-sm text-zinc-500">
            No applicant types reported yet.
          </p>
        ) : null}
      </div>
    </Panel>
  );
};

export const HostOverview = ({ summary, onSelectHost }) => {
  const funnel = summary?.funnel || {};
  const hosts = (Array.isArray(summary?.hosts) ? summary.hosts : []).filter(
    (host) => host.status === "approved",
  );
  const referenceMs = Number(summary?.generatedAtMs || 0);
  const health = hosts.map((host) => ({
    host,
    state: getHostHealth(host, referenceMs),
  }));
  const attentionHosts = health.filter(
    ({ state }) => state.label !== "Healthy",
  );
  const activeRate = Math.round(
    (Number(funnel.activeHosts30 || 0) /
      Math.max(1, Number(funnel.approved || 0))) *
      100,
  );
  return (
    <div className="space-y-4" data-host-operations-overview>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Eyebrow>Testing program pulse</Eyebrow>
          <h2 className="mt-1 text-2xl font-black text-white">
            Host usage at a glance
          </h2>
          <p className="mt-1 text-sm text-zinc-400">
            See where Hosts activate, return, and need a nudge—then open the
            individual record.
          </p>
        </div>
        <span className="text-xs text-zinc-500">
          Updated {formatAgo(referenceMs, referenceMs)} · Usage period{" "}
          {summary?.period || "—"}
        </span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Metric
          label="Approved Hosts"
          value={funnel.approved}
          detail="Selected for Host access"
          icon="fa-ticket"
        />
        <Metric
          label="Room-active 30d"
          value={funnel.activeHosts30}
          detail={`${activeRate}% of approved Hosts`}
          tone="pink"
          icon="fa-wave-pulse"
          progress={activeRate}
        />
        <Metric
          label="Repeat Hosts"
          value={funnel.repeatHosts}
          detail="Created at least two distinct Rooms"
          tone="emerald"
          icon="fa-rotate"
        />
        <Metric
          label="Needs attention"
          value={attentionHosts.length}
          detail="Onboarding or activity follow-up"
          tone="amber"
          icon="fa-lightbulb"
        />
        <Metric
          label="Open feedback"
          value={summary?.support?.open}
          detail={`${formatCount(summary?.support?.waitingOnTeam)} waiting on the team`}
          tone="pink"
          icon="fa-inbox"
        />
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(300px,0.75fr)]">
        <FunnelChart funnel={funnel} />
        <UsageMixChart totals={summary?.usageTotals} period={summary?.period} />
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(280px,0.7fr)_minmax(0,1.3fr)]">
        <CohortChart cohorts={summary?.applicantCohorts} />
        <Panel className="p-4 sm:p-5" data-host-activity-health>
          <div className="flex items-end justify-between gap-3">
            <div>
              <Eyebrow>Operating queue</Eyebrow>
              <h2 className="mt-1 text-lg font-black text-white">
                Hosts to check in with
              </h2>
            </div>
            <button
              type="button"
              onClick={() => onSelectHost(null)}
              className="text-xs font-black text-cyan-200 hover:text-white"
            >
              View all Hosts <i className="fa-solid fa-arrow-right ml-1" />
            </button>
          </div>
          <div className="mt-4 grid gap-2">
            {attentionHosts.slice(0, 6).map(({ host, state }) => (
              <button
                type="button"
                key={host.applicationId}
                onClick={() => onSelectHost(host)}
                className="grid gap-2 rounded-xl border border-white/10 bg-black/20 p-3 text-left transition hover:border-cyan-300/30 hover:bg-cyan-500/5 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center"
              >
                <span className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/5 text-amber-200">
                  <i className={`fa-solid ${state.icon}`} />
                </span>
                <div>
                  <strong className="text-sm text-white">
                    {host.name || host.email}
                  </strong>
                  <div className="mt-1 text-xs text-zinc-500">
                    {state.detail}
                  </div>
                </div>
                <StatusChip tone={state.tone}>{state.label}</StatusChip>
              </button>
            ))}
            {!attentionHosts.length ? (
              <div className="rounded-xl border border-emerald-300/15 bg-emerald-500/8 p-4 text-sm text-emerald-100">
                Every approved Host currently clears the onboarding and
                recent-activity checks.
              </div>
            ) : null}
          </div>
        </Panel>
      </div>
    </div>
  );
};

const HostDetailDrawer = ({ host, summary, onClose, onChanged }) => {
  const [accountBusy, setAccountBusy] = useState("");
  const [accountNotice, setAccountNotice] = useState("");
  useEffect(() => {
    if (!host) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [host, onClose]);
  if (!host) return null;
  const createResetLink = async () => {
    if (accountBusy) return;
    setAccountBusy("reset");
    setAccountNotice("");
    try {
      const result = await createHostPasswordResetLink({ targetUid: host.uid, targetEmail: host.email });
      await navigator.clipboard.writeText(String(result?.resetLink || ""));
      setAccountNotice("Secure password-reset link copied. Send it only to this Host.");
    } catch (error) {
      setAccountNotice(String(error?.message || "Could not create a password-reset link.").replace(/^FirebaseError:\s*/i, ""));
    } finally {
      setAccountBusy("");
    }
  };
  const setAccountAccess = async (enabled) => {
    if (accountBusy) return;
    if (!enabled && !window.confirm(`Revoke complimentary testing access for ${host.name || host.email}? Their subscription is not changed.`)) return;
    setAccountBusy("access");
    setAccountNotice("");
    try {
      await setHostApprovalStatus({
        target: host.uid || host.email,
        targetEmail: host.email,
        enabled,
        source: "host_account_console",
        notes: enabled ? "Restored from Host Account Console" : "Revoked from Host Account Console",
      });
      setAccountNotice(enabled ? "Complimentary testing access granted." : "Complimentary testing access revoked. Billing was not changed.");
      await onChanged?.();
    } catch (error) {
      setAccountNotice(String(error?.message || "Could not update Host access.").replace(/^FirebaseError:\s*/i, ""));
    } finally {
      setAccountBusy("");
    }
  };
  const referenceMs = Number(summary?.generatedAtMs || 0);
  const health = getHostHealth(host, referenceMs);
  const usage = METER_META.map((meter) => ({
    ...meter,
    value: getUsageValue(host, meter.id),
    label: host.usageMeters?.[meter.id]?.label || meter.shortLabel,
  }));
  const usageMax = Math.max(1, ...usage.map((item) => item.value));
  const milestones = [
    {
      label: "Application received",
      value: host.submittedAtMs,
      complete: !!host.submittedAtMs,
    },
    {
      label: "Host access approved",
      value: host.approvedAtMs,
      complete: host.status === "approved",
    },
    {
      label: "Onboarding email sent",
      value: host.inviteEmailSentAtMs,
      complete: !!host.inviteEmailSentAtMs,
    },
    {
      label: "Workspace opened",
      value: host.workspaceActivatedAtMs,
      complete: !!host.workspaceActivatedAtMs,
    },
    {
      label: "First Room created",
      value: host.firstRoomAtMs,
      complete: !!host.firstRoomAtMs,
    },
    {
      label: "Returned for Room 2",
      value: host.secondRoomAtMs,
      complete: !!host.secondRoomAtMs,
    },
  ];
  return (
    <div
      className="fixed inset-0 z-[120] flex justify-end bg-black/65 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={`Activity details for ${host.name || host.email}`}
      data-host-detail-drawer
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <aside className="flex h-full w-full max-w-xl flex-col border-l border-cyan-200/20 bg-[radial-gradient(circle_at_top_right,rgba(244,114,182,0.15),transparent_30%),linear-gradient(160deg,rgba(20,36,57,0.99),rgba(8,10,18,0.99)_45%)] shadow-[-30px_0_80px_rgba(0,0,0,0.5)]">
        <div className="flex items-start justify-between gap-3 border-b border-white/10 p-5">
          <div>
            <Eyebrow>Host activity detail</Eyebrow>
            <h2 className="mt-1 text-2xl font-black text-white">
              {host.name || host.email}
            </h2>
            <a
              href={`mailto:${host.email}`}
              className="mt-1 inline-block text-sm text-cyan-200 hover:text-white"
            >
              {host.email}
            </a>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10 hover:text-white"
            aria-label="Close Host details"
          >
            <i className="fa-solid fa-xmark" />
          </button>
        </div>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5 custom-scrollbar">
          <Panel className="p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <StatusChip tone={health.tone}>{health.label}</StatusChip>
              <span className="text-xs text-zinc-500">
                {getOnboardingStage(host)}
              </span>
            </div>
            <p className="mt-3 text-sm leading-6 text-zinc-300">
              {health.detail}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-xl bg-white/5 p-3">
                <span className="block text-zinc-500">Last Room</span>
                <strong className="mt-1 block text-white">
                  {formatAgo(host.lastRoomAtMs, referenceMs)}
                </strong>
              </div>
              <div className="rounded-xl bg-white/5 p-3">
                <span className="block text-zinc-500">Plan snapshot</span>
                <strong className="mt-1 block capitalize text-white">
                  {host.planId || "free"} · {host.planStatus || "inactive"}
                </strong>
              </div>
              <div className="col-span-2 rounded-xl bg-white/5 p-3">
                <span className="block text-zinc-500">Host type</span>
                <strong className="mt-1 block capitalize text-white">
                  {host.hostType?.replace(/_/g, " ") || "Not provided"}
                </strong>
              </div>
            </div>
          </Panel>
          <Panel className="border-cyan-300/18 p-4" data-host-account-console>
            <Eyebrow>Host Account Console</Eyebrow>
            <h3 className="mt-1 text-lg font-black text-white">Access, sign-in, and subscription context</h3>
            <p className="mt-1 text-xs leading-5 text-zinc-500">Testing-access controls change the BeauRocks approval override only. A paid subscription can still grant access; subscription changes remain in Stripe so provider state stays authoritative.</p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <button type="button" disabled={!!accountBusy || !host.email} onClick={createResetLink} className="min-h-[42px] rounded-xl border border-cyan-300/25 bg-cyan-500/10 px-3 text-xs font-black text-cyan-50 disabled:opacity-45">
                <i className="fa-solid fa-key mr-2" />{accountBusy === "reset" ? "Creating link…" : "Copy reset link"}
              </button>
              <button type="button" disabled={!!accountBusy} onClick={() => setAccountAccess(!host.hostApprovalEnabled)} className={`min-h-[42px] rounded-xl border px-3 text-xs font-black disabled:opacity-45 ${host.hostApprovalEnabled ? "border-rose-300/25 bg-rose-500/10 text-rose-100" : "border-emerald-300/25 bg-emerald-500/10 text-emerald-100"}`}>
                <i className={`fa-solid ${host.hostApprovalEnabled ? "fa-user-lock" : "fa-user-check"} mr-2`} />
                {accountBusy === "access" ? "Updating…" : host.hostApprovalEnabled ? "Revoke testing access" : "Grant testing access"}
              </button>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-black/20 p-3">
              <div><div className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500">Provider snapshot</div><div className="mt-1 text-sm font-bold capitalize text-white">{host.planId || "free"} · {host.planStatus || "inactive"}</div></div>
              {host.email ? <a href={`https://dashboard.stripe.com/search?query=${encodeURIComponent(host.email)}`} target="_blank" rel="noreferrer" className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-black text-zinc-200 hover:bg-white/10">Open Stripe <i className="fa-solid fa-arrow-up-right-from-square ml-1" /></a> : null}
            </div>
            {accountNotice ? <div className="mt-3 rounded-xl border border-amber-300/15 bg-amber-500/8 p-3 text-xs leading-5 text-amber-100" role="status">{accountNotice}</div> : null}
          </Panel>
          <Panel className="p-4">
            <Eyebrow tone="pink">
              Usage · {summary?.period || "Current period"}
            </Eyebrow>
            <h3 className="mt-1 text-lg font-black text-white">
              Metered provider activity
            </h3>
            <div className="mt-4 space-y-4">
              {usage.map((item) => (
                <div key={item.id}>
                  <div className="mb-1.5 flex items-center gap-2 text-xs">
                    <i
                      className={`fa-solid ${item.icon} w-4 text-center text-zinc-500`}
                    />
                    <span className="min-w-0 flex-1 text-zinc-300">
                      {item.label}
                    </span>
                    <strong className="text-white">
                      {formatCount(item.value)}
                    </strong>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-black/35">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.max(item.value ? 5 : 0, (item.value / usageMax) * 100)}%`,
                        background: item.color,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-4 text-[11px] leading-5 text-zinc-500">
              These are usage units recorded for billing transparency. They are
              not a cost or revenue estimate.
            </p>
          </Panel>
          <Panel className="p-4">
            <Eyebrow>Onboarding milestones</Eyebrow>
            <div className="mt-4 space-y-0">
              {milestones.map((item, index) => (
                <div
                  key={item.label}
                  className="grid grid-cols-[22px_minmax(0,1fr)] gap-3"
                >
                  <div className="flex flex-col items-center">
                    <span
                      className={`mt-0.5 h-3 w-3 rounded-full border ${item.complete ? "border-cyan-200 bg-cyan-300 shadow-[0_0_12px_rgba(34,211,238,0.55)]" : "border-white/15 bg-zinc-900"}`}
                    />
                    {index < milestones.length - 1 ? (
                      <span
                        className={`h-10 w-px ${item.complete ? "bg-cyan-300/25" : "bg-white/8"}`}
                      />
                    ) : null}
                  </div>
                  <div>
                    <div
                      className={`text-sm font-bold ${item.complete ? "text-white" : "text-zinc-600"}`}
                    >
                      {item.label}
                    </div>
                    <div className="mt-0.5 text-[11px] text-zinc-500">
                      {item.value
                        ? formatDate(item.value)
                        : item.complete
                          ? "Complete · date unavailable"
                          : "Not yet"}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
          <Panel className="p-4">
            <Eyebrow tone="amber">Record context</Eyebrow>
            <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
              <div>
                <dt className="text-zinc-500">Organization</dt>
                <dd className="mt-1 break-all text-zinc-300">
                  {host.orgId || "Not linked"}
                </dd>
              </div>
              <div>
                <dt className="text-zinc-500">Application</dt>
                <dd className="mt-1 break-all text-zinc-300">
                  {host.applicationId}
                </dd>
              </div>
              <div>
                <dt className="text-zinc-500">Invite delivery</dt>
                <dd className="mt-1 capitalize text-zinc-300">
                  {host.decisionEmailStatus || "Not reported"}
                </dd>
              </div>
              <div>
                <dt className="text-zinc-500">Report generated</dt>
                <dd className="mt-1 text-zinc-300">
                  {formatDate(referenceMs)}
                </dd>
              </div>
            </dl>
          </Panel>
        </div>
      </aside>
    </div>
  );
};

export const HostRoster = ({
  summary,
  selectedHostId = "",
  onSelectHost,
  onCloseHost,
  onChanged,
}) => {
  const [query, setQuery] = useState("");
  const allHosts = Array.isArray(summary?.hosts) ? summary.hosts : [];
  const hosts = useMemo(
    () =>
      (Array.isArray(summary?.hosts) ? summary.hosts : []).filter(
        (host) =>
          host.status === "approved" &&
          `${host.name} ${host.email}`
            .toLowerCase()
            .includes(query.toLowerCase()),
      ),
    [query, summary],
  );
  const selectedHost =
    allHosts.find((host) => host.applicationId === selectedHostId) || null;
  const referenceMs = Number(summary?.generatedAtMs || 0);
  return (
    <>
      <Panel className="overflow-hidden" data-active-host-roster>
        <div className="flex flex-col gap-3 border-b border-white/10 p-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Eyebrow>Approved Host roster</Eyebrow>
            <h2 className="mt-1 text-xl font-black text-white">
              Activity and usage snapshot
            </h2>
            <p className="mt-1 text-xs text-zinc-500">
              Select any Host to inspect onboarding milestones and monthly
              metered usage.
            </p>
          </div>
          <input
            className={`${inputClass} sm:max-w-xs`}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search Hosts"
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="bg-white/[0.03] text-[10px] uppercase tracking-[0.16em] text-zinc-500">
              <tr>
                <th className="px-4 py-3">Host</th>
                <th className="px-3 py-3">Last Room</th>
                <th className="px-3 py-3">Onboarding</th>
                <th className="px-3 py-3">AI</th>
                <th className="px-3 py-3">YouTube</th>
                <th className="px-3 py-3">Apple</th>
                <th className="px-3 py-3">Plan</th>
                <th className="px-3 py-3">Health</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {hosts.map((host) => {
                const health = getHostHealth(host, referenceMs);
                return (
                  <tr
                    key={host.applicationId}
                    role="button"
                    tabIndex={0}
                    onClick={() => onSelectHost(host)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onSelectHost(host);
                      }
                    }}
                    className="cursor-pointer outline-none transition hover:bg-cyan-500/[0.06] focus:bg-cyan-500/[0.08]"
                  >
                    <td className="px-4 py-3">
                      <strong className="block text-white">
                        {host.name || host.email}
                      </strong>
                      <span className="text-xs text-zinc-500">
                        {host.email}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-zinc-300">
                      {formatAgo(host.lastRoomAtMs, referenceMs)}
                    </td>
                    <td className="px-3 py-3">
                      <span className="text-xs text-zinc-300">
                        {getOnboardingStage(host)}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-zinc-300">
                      {formatCount(getUsageValue(host, "ai_generate_content"))}
                    </td>
                    <td className="px-3 py-3 text-zinc-300">
                      {formatCount(getUsageValue(host, "youtube_data_request"))}
                    </td>
                    <td className="px-3 py-3 text-zinc-300">
                      {formatCount(getUsageValue(host, "apple_music_request"))}
                    </td>
                    <td className="px-3 py-3">
                      <StatusChip>{host.planId || "free"}</StatusChip>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <StatusChip tone={health.tone}>
                          {health.label}
                        </StatusChip>
                        <i className="fa-solid fa-chevron-right text-[10px] text-zinc-600" />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!hosts.length ? (
          <div className="p-6 text-center text-sm text-zinc-500">
            No approved Hosts match this view.
          </div>
        ) : null}
      </Panel>
      <HostDetailDrawer
        host={selectedHost}
        summary={summary}
        onClose={onCloseHost}
        onChanged={onChanged}
      />
    </>
  );
};
