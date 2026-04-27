import React from 'react';
import {
    EVENT_CREDITS_PRESET_OPTIONS,
    applyEventCreditsPreset,
} from '../hostLaunchHelpers';
import {
    AUDIENCE_ACCESS_MODES,
    CO_HOST_CREDIT_POLICIES,
    CREDIT_EARNING_MODES,
    DEFAULT_REACTION_TAP_COOLDOWN_MS,
    MONEYBAGS_BADGE_LABEL,
    SUPPORT_CELEBRATION_STYLES,
    normalizeAudienceAccessMode,
    normalizeCoHostCreditPolicy,
    normalizeCreditEarningMode,
    normalizeReactionTapCooldownMs,
    normalizeSupportCelebrationStyle,
} from '../../../lib/roomMonetization';

const cardClass = 'rounded-2xl border border-white/10 bg-black/18 p-4';
const inputClass = 'mt-2 w-full rounded-xl border border-cyan-400/20 bg-black/25 px-3 py-3 text-sm text-white outline-none transition focus:border-cyan-300/45';

const numberValue = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const ACCESS_MODE_OPTIONS = [
    {
        value: AUDIENCE_ACCESS_MODES.account,
        label: 'BeauRocks default',
        note: 'Keep the normal BeauRocks email-driven VIP path.',
    },
    {
        value: AUDIENCE_ACCESS_MODES.email,
        label: 'Email access',
        note: 'Keep the custom skin, but make the unlock action clearly email-first.',
    },
    {
        value: AUDIENCE_ACCESS_MODES.emailCapture,
        label: 'Simple email submit',
        note: 'Capture an email for this room without making guests create or verify an account.',
    },
    {
        value: AUDIENCE_ACCESS_MODES.donation,
        label: 'Donation unlock',
        note: 'Send guests into the Givebutter flow first for supporter perks.',
    },
    {
        value: AUDIENCE_ACCESS_MODES.emailOrDonation,
        label: 'Email or donation',
        note: 'Let guests support the fundraiser first, with email as the fallback path.',
    },
];

const CREDIT_MODE_OPTIONS = [
    {
        value: CREDIT_EARNING_MODES.standard,
        label: 'Standard',
        note: 'One join grant only. Good when points should feel controlled.',
        patch: { generalAdmissionPoints: 100, timedLobbyEnabled: false, timedLobbyPoints: 0, timedLobbyIntervalMin: 10, timedLobbyMaxPerGuest: 0 },
    },
    {
        value: CREDIT_EARNING_MODES.lean,
        label: 'Lean night',
        note: 'Small starting balance and no automatic drip.',
        patch: { generalAdmissionPoints: 75, timedLobbyEnabled: false, timedLobbyPoints: 0, timedLobbyIntervalMin: 10, timedLobbyMaxPerGuest: 0 },
    },
    {
        value: CREDIT_EARNING_MODES.friendly,
        label: 'Friendly refill',
        note: 'Guests get starter credits plus a capped lobby refill every 10 minutes.',
        patch: { generalAdmissionPoints: 200, timedLobbyEnabled: true, timedLobbyPoints: 25, timedLobbyIntervalMin: 10, timedLobbyMaxPerGuest: 150 },
    },
    {
        value: CREDIT_EARNING_MODES.playful,
        label: 'Playful party',
        note: 'More room to play, still capped per guest so it is not a free-for-all.',
        patch: { generalAdmissionPoints: 300, timedLobbyEnabled: true, timedLobbyPoints: 50, timedLobbyIntervalMin: 10, timedLobbyMaxPerGuest: 300 },
    },
    {
        value: CREDIT_EARNING_MODES.custom,
        label: 'Custom',
        note: 'Use the fields below to tune the room economy.',
        patch: {},
    },
];

const CELEBRATION_OPTIONS = [
    {
        value: SUPPORT_CELEBRATION_STYLES.standard,
        label: 'Standard burst',
        note: 'Clean room-boost callout with the normal points burst.',
    },
    {
        value: SUPPORT_CELEBRATION_STYLES.moneybagsBurst,
        label: 'Moneybags burst',
        note: 'Louder donor moments with more festival energy on Public TV.',
    },
];

const CO_HOST_CREDIT_POLICY_OPTIONS = [
    {
        value: CO_HOST_CREDIT_POLICIES.standard,
        label: 'Standard co-host',
        note: 'Co-hosts use the same credits as everyone else.',
    },
    {
        value: CO_HOST_CREDIT_POLICIES.freeReactions,
        label: 'Free reactions',
        note: 'Co-hosts can react and clap for free, while other point-spend actions stay normal.',
    },
    {
        value: CO_HOST_CREDIT_POLICIES.unlimited,
        label: 'Unlimited co-host',
        note: 'Co-hosts bypass all room point costs tonight. Use when they are effectively operators.',
    },
];

const EventCreditsConfigPanel = ({
    eventCreditsConfig,
    setEventCreditsConfig,
    compact = false,
}) => {
    const updateConfig = (patch = {}) => {
        setEventCreditsConfig((prev) => ({
            ...prev,
            ...patch,
        }));
    };

    const supportProvider = String(eventCreditsConfig?.supportProvider || '').trim().toLowerCase();
    const showAdvancedCredits = !!eventCreditsConfig?.enabled;
    const accessMode = normalizeAudienceAccessMode(eventCreditsConfig?.audienceAccessMode || '');
    const creditMode = normalizeCreditEarningMode(eventCreditsConfig?.creditEarningMode || '');
    const celebrationStyle = normalizeSupportCelebrationStyle(eventCreditsConfig?.supportCelebrationStyle || '');
    const coHostCreditPolicy = normalizeCoHostCreditPolicy(eventCreditsConfig?.coHostCreditPolicy || '');
    const reactionTapCooldownMs = normalizeReactionTapCooldownMs(eventCreditsConfig?.reactionTapCooldownMs ?? DEFAULT_REACTION_TAP_COOLDOWN_MS);
    const presetLabel = (
        EVENT_CREDITS_PRESET_OPTIONS.find((preset) => preset.id === (eventCreditsConfig?.presetId || ''))
        || EVENT_CREDITS_PRESET_OPTIONS.find((preset) => preset.id === 'custom_event_credits')
        || EVENT_CREDITS_PRESET_OPTIONS[0]
    )?.label || 'Advanced Credits';
    const accessModeMeta = ACCESS_MODE_OPTIONS.find((option) => option.value === accessMode) || ACCESS_MODE_OPTIONS[0];
    const creditModeMeta = CREDIT_MODE_OPTIONS.find((option) => option.value === creditMode) || CREDIT_MODE_OPTIONS[0];
    const celebrationMeta = CELEBRATION_OPTIONS.find((option) => option.value === celebrationStyle) || CELEBRATION_OPTIONS[0];
    const coHostCreditPolicyMeta = CO_HOST_CREDIT_POLICY_OPTIONS.find((option) => option.value === coHostCreditPolicy) || CO_HOST_CREDIT_POLICY_OPTIONS[0];
    const summaryPills = [
        presetLabel,
        accessModeMeta.label,
        supportProvider === 'givebutter' ? 'Givebutter live' : 'No donation flow',
        creditModeMeta.label,
        coHostCreditPolicyMeta.label,
        celebrationMeta.label,
    ];

    return (
        <div className="space-y-4">
            <div className={cardClass}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="max-w-3xl">
                        <div className="text-[11px] uppercase tracking-[0.2em] text-cyan-100/70">Room experience</div>
                        <div className="mt-1 text-lg font-black text-white">Fundraiser skin, guest unlock, and donor celebration</div>
                        <div className="mt-1 text-sm text-cyan-100/68">
                            This keeps BeauRocks underneath, but lets this room feel like the event. Use it to choose how guests unlock perks, where support goes, and how donation wins hit the room.
                        </div>
                    </div>
                    <label className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-500/8 px-3 py-2 text-sm text-cyan-100">
                        <input
                            type="checkbox"
                            checked={!!eventCreditsConfig?.enabled}
                            onChange={(e) => updateConfig({ enabled: e.target.checked })}
                        />
                        Enable
                    </label>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                    {summaryPills.map((pill) => (
                        <span key={pill} className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-zinc-300">
                            {pill}
                        </span>
                    ))}
                </div>

                <div className={`mt-4 grid gap-3 ${compact ? 'lg:grid-cols-1' : 'lg:grid-cols-2'}`}>
                    <label className="block">
                        <div className="text-[11px] uppercase tracking-[0.18em] text-cyan-100/70">Preset</div>
                        <select
                            value={eventCreditsConfig?.presetId || 'custom_event_credits'}
                            onChange={(e) => {
                                setEventCreditsConfig((prev) => applyEventCreditsPreset(e.target.value, prev));
                            }}
                            className={inputClass}
                        >
                            {EVENT_CREDITS_PRESET_OPTIONS.map((preset) => (
                                <option key={preset.id} value={preset.id}>
                                    {preset.label}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label className="block">
                        <div className="text-[11px] uppercase tracking-[0.18em] text-cyan-100/70">Event label</div>
                        <input
                            value={eventCreditsConfig?.eventLabel || ''}
                            onChange={(e) => updateConfig({ eventLabel: e.target.value })}
                            placeholder="AAHF Festival Night"
                            className={inputClass}
                        />
                    </label>
                </div>

                <div className="mt-4 rounded-2xl border border-cyan-300/15 bg-cyan-500/6 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                            <div className="text-[11px] uppercase tracking-[0.18em] text-cyan-100/70">Credit earning mode</div>
                            <div className="mt-1 text-sm text-zinc-300">Tune how generous this room feels without opening unlimited play.</div>
                        </div>
                        <select
                            value={creditMode}
                            onChange={(e) => {
                                const selected = CREDIT_MODE_OPTIONS.find((option) => option.value === e.target.value) || CREDIT_MODE_OPTIONS[0];
                                updateConfig({
                                    creditEarningMode: selected.value,
                                    ...selected.patch,
                                });
                            }}
                            className="min-w-[13rem] rounded-xl border border-cyan-400/20 bg-black/35 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300/45"
                        >
                            {CREDIT_MODE_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </select>
                    </div>
                    <div className="mt-2 text-xs text-zinc-400">{creditModeMeta.note}</div>
                    <div className={`mt-4 grid gap-3 ${compact ? 'lg:grid-cols-1' : 'lg:grid-cols-4'}`}>
                        <label className="block">
                            <div className="text-[11px] uppercase tracking-[0.18em] text-cyan-100/70">Join credits</div>
                            <input
                                type="number"
                                min="0"
                                value={numberValue(eventCreditsConfig?.generalAdmissionPoints)}
                                onChange={(e) => updateConfig({ generalAdmissionPoints: e.target.value, creditEarningMode: CREDIT_EARNING_MODES.custom })}
                                className={inputClass}
                            />
                        </label>
                        <label className="block">
                            <div className="text-[11px] uppercase tracking-[0.18em] text-cyan-100/70">Lobby refill</div>
                            <input
                                type="number"
                                min="0"
                                value={numberValue(eventCreditsConfig?.timedLobbyPoints)}
                                onChange={(e) => updateConfig({ timedLobbyPoints: e.target.value, timedLobbyEnabled: Number(e.target.value || 0) > 0, creditEarningMode: CREDIT_EARNING_MODES.custom })}
                                className={inputClass}
                            />
                        </label>
                        <label className="block">
                            <div className="text-[11px] uppercase tracking-[0.18em] text-cyan-100/70">Every minutes</div>
                            <input
                                type="number"
                                min="1"
                                max="120"
                                value={numberValue(eventCreditsConfig?.timedLobbyIntervalMin, 10)}
                                onChange={(e) => updateConfig({ timedLobbyIntervalMin: e.target.value, creditEarningMode: CREDIT_EARNING_MODES.custom })}
                                className={inputClass}
                            />
                        </label>
                        <label className="block">
                            <div className="text-[11px] uppercase tracking-[0.18em] text-cyan-100/70">Refill cap</div>
                            <input
                                type="number"
                                min="0"
                                value={numberValue(eventCreditsConfig?.timedLobbyMaxPerGuest)}
                                onChange={(e) => updateConfig({ timedLobbyMaxPerGuest: e.target.value, creditEarningMode: CREDIT_EARNING_MODES.custom })}
                                className={inputClass}
                            />
                        </label>
                    </div>
                    <label className="mt-3 inline-flex items-center gap-2 text-sm text-cyan-100">
                        <input
                            type="checkbox"
                            checked={eventCreditsConfig?.timedLobbyEnabled === true}
                            onChange={(e) => updateConfig({ timedLobbyEnabled: e.target.checked, creditEarningMode: CREDIT_EARNING_MODES.custom })}
                        />
                        Award capped lobby refill credits while guests stay active
                    </label>
                </div>

                <div className={`mt-4 grid gap-3 ${compact ? 'lg:grid-cols-1' : 'lg:grid-cols-2'}`}>
                    <label className="block">
                        <div className="text-[11px] uppercase tracking-[0.18em] text-cyan-100/70">Co-host credit policy</div>
                        <select
                            value={coHostCreditPolicy}
                            onChange={(e) => updateConfig({ coHostCreditPolicy: e.target.value })}
                            className={inputClass}
                        >
                            {CO_HOST_CREDIT_POLICY_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </select>
                        <div className="mt-2 text-xs text-zinc-400">{coHostCreditPolicyMeta.note}</div>
                    </label>
                    <label className="block">
                        <div className="text-[11px] uppercase tracking-[0.18em] text-cyan-100/70">Reaction tap cooldown</div>
                        <input
                            type="number"
                            min="0.25"
                            max="5"
                            step="0.1"
                            value={(reactionTapCooldownMs / 1000).toFixed(1)}
                            onChange={(e) => updateConfig({ reactionTapCooldownMs: normalizeReactionTapCooldownMs(Number(e.target.value || 0) * 1000) })}
                            className={inputClass}
                        />
                        <div className="mt-2 text-xs text-zinc-400">
                            Shared by emoji reactions and the applause clap button. Hosts can tighten or loosen this per room.
                        </div>
                    </label>
                </div>

                <div className={`mt-4 grid gap-3 ${compact ? 'lg:grid-cols-1' : 'lg:grid-cols-2'}`}>
                    <label className="block">
                        <div className="text-[11px] uppercase tracking-[0.18em] text-cyan-100/70">Guest unlock action</div>
                        <select
                            value={accessMode}
                            onChange={(e) => updateConfig({ audienceAccessMode: e.target.value })}
                            className={inputClass}
                        >
                            {ACCESS_MODE_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                        <div className="mt-2 text-xs text-zinc-400">{accessModeMeta.note}</div>
                    </label>
                    <label className="block">
                        <div className="text-[11px] uppercase tracking-[0.18em] text-cyan-100/70">Celebration style</div>
                        <select
                            value={celebrationStyle}
                            onChange={(e) => updateConfig({ supportCelebrationStyle: e.target.value })}
                            className={inputClass}
                        >
                            {CELEBRATION_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                        <div className="mt-2 text-xs text-zinc-400">{celebrationMeta.note}</div>
                    </label>
                </div>

                <div className={`mt-4 grid gap-3 ${compact ? 'lg:grid-cols-1' : 'lg:grid-cols-2'}`}>
                    <label className="block">
                        <div className="text-[11px] uppercase tracking-[0.18em] text-cyan-100/70">Donation provider</div>
                        <select
                            value={supportProvider}
                            onChange={(e) => updateConfig({ supportProvider: e.target.value })}
                            className={inputClass}
                        >
                            <option value="">None</option>
                            <option value="givebutter">Givebutter</option>
                        </select>
                    </label>
                    <label className="block">
                        <div className="text-[11px] uppercase tracking-[0.18em] text-cyan-100/70">Support CTA label</div>
                        <input
                            value={eventCreditsConfig?.supportLabel || ''}
                            onChange={(e) => updateConfig({ supportLabel: e.target.value })}
                            placeholder="Support AAHF Festival"
                            className={inputClass}
                        />
                    </label>
                    <label className="block">
                        <div className="text-[11px] uppercase tracking-[0.18em] text-cyan-100/70">Support link URL</div>
                        <input
                            value={eventCreditsConfig?.supportUrl || ''}
                            onChange={(e) => updateConfig({ supportUrl: e.target.value })}
                            placeholder="https://givebutter.com/..."
                            className={inputClass}
                        />
                    </label>
                    <label className="block">
                        <div className="text-[11px] uppercase tracking-[0.18em] text-cyan-100/70">Room-wide points per purchase</div>
                        <input
                            type="number"
                            min="0"
                            value={numberValue(eventCreditsConfig?.supportPoints)}
                            onChange={(e) => updateConfig({ supportPoints: e.target.value })}
                            className={inputClass}
                        />
                    </label>
                </div>

                <div className="mt-4 rounded-2xl border border-emerald-400/25 bg-emerald-500/8 p-4">
                    <div className="text-[11px] uppercase tracking-[0.2em] text-emerald-100/75">Buyer reward</div>
                    <div className="mt-1 text-sm text-emerald-50/88">
                        Matching Givebutter purchases can light up the TV, boost the room, and tag the donor with the {MONEYBAGS_BADGE_LABEL} supporter moment.
                    </div>
                    <label className="mt-3 inline-flex items-center gap-2 text-sm text-zinc-100">
                        <input
                            type="checkbox"
                            checked={eventCreditsConfig?.supportBadge !== false}
                            onChange={(e) => updateConfig({ supportBadge: e.target.checked })}
                        />
                        Celebrate the buyer as {MONEYBAGS_BADGE_LABEL}
                    </label>
                </div>
            </div>

            <details className={cardClass}>
                <summary className="cursor-pointer list-none">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <div className="text-[11px] uppercase tracking-[0.2em] text-cyan-100/70">Advanced credits</div>
                            <div className="mt-1 text-sm font-semibold text-white">Attendee matching, ticket perks, and promo points</div>
                        </div>
                        <span className="rounded-full border border-white/10 bg-black/25 px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-zinc-400">
                            Open when needed
                        </span>
                    </div>
                </summary>
                <div className={`mt-4 grid gap-3 ${compact ? 'lg:grid-cols-1' : 'lg:grid-cols-2'}`}>
                    <label className="block">
                        <div className="text-[11px] uppercase tracking-[0.18em] text-cyan-100/70">Attendee source provider</div>
                        <select
                            value={eventCreditsConfig?.sourceProvider || ''}
                            onChange={(e) => updateConfig({ sourceProvider: e.target.value })}
                            className={inputClass}
                        >
                            <option value="">None</option>
                            <option value="givebutter">Givebutter</option>
                        </select>
                    </label>
                    <label className="block">
                        <div className="text-[11px] uppercase tracking-[0.18em] text-cyan-100/70">Event or campaign code</div>
                        <input
                            value={eventCreditsConfig?.sourceCampaignCode || ''}
                            onChange={(e) => updateConfig({ sourceCampaignCode: e.target.value })}
                            placeholder="givebutter campaign code"
                            className={inputClass}
                        />
                    </label>
                </div>
                {showAdvancedCredits ? (
                    <div className={`mt-4 grid gap-3 ${compact ? 'lg:grid-cols-2' : 'lg:grid-cols-4'}`}>
                        <label className="block">
                            <div className="text-[11px] uppercase tracking-[0.18em] text-cyan-100/70">Entry points</div>
                            <input
                                type="number"
                                min="0"
                                value={numberValue(eventCreditsConfig?.generalAdmissionPoints)}
                                onChange={(e) => updateConfig({ generalAdmissionPoints: e.target.value, creditEarningMode: CREDIT_EARNING_MODES.custom })}
                                className={inputClass}
                            />
                        </label>
                        <label className="block">
                            <div className="text-[11px] uppercase tracking-[0.18em] text-cyan-100/70">VIP bonus</div>
                            <input
                                type="number"
                                min="0"
                                value={numberValue(eventCreditsConfig?.vipBonusPoints)}
                                onChange={(e) => updateConfig({ vipBonusPoints: e.target.value })}
                                className={inputClass}
                            />
                        </label>
                        <label className="block">
                            <div className="text-[11px] uppercase tracking-[0.18em] text-cyan-100/70">Skip-line bonus</div>
                            <input
                                type="number"
                                min="0"
                                value={numberValue(eventCreditsConfig?.skipLineBonusPoints)}
                                onChange={(e) => updateConfig({ skipLineBonusPoints: e.target.value })}
                                className={inputClass}
                            />
                        </label>
                        <label className="block">
                            <div className="text-[11px] uppercase tracking-[0.18em] text-cyan-100/70">Promo points</div>
                            <input
                                type="number"
                                min="0"
                                value={numberValue(eventCreditsConfig?.socialPromoPoints)}
                                onChange={(e) => updateConfig({ socialPromoPoints: e.target.value })}
                                className={inputClass}
                            />
                        </label>
                    </div>
                ) : null}
            </details>

            <details className={cardClass}>
                <summary className="cursor-pointer list-none">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <div className="text-[11px] uppercase tracking-[0.2em] text-cyan-100/70">Advanced Givebutter routing</div>
                            <div className="mt-1 text-sm font-semibold text-white">Webhook campaign matching and embedded checkout</div>
                        </div>
                        <span className="rounded-full border border-white/10 bg-black/25 px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-zinc-400">
                            Open when needed
                        </span>
                    </div>
                </summary>
                <div className={`mt-4 grid gap-3 ${compact ? 'lg:grid-cols-1' : 'lg:grid-cols-2'}`}>
                    <label className="block">
                        <div className="text-[11px] uppercase tracking-[0.18em] text-cyan-100/70">Givebutter campaign code</div>
                        <input
                            value={eventCreditsConfig?.supportCampaignCode || ''}
                            onChange={(e) => updateConfig({ supportCampaignCode: e.target.value })}
                            placeholder="campaign or event code from webhook"
                            className={inputClass}
                        />
                    </label>
                    <label className="block">
                        <div className="text-[11px] uppercase tracking-[0.18em] text-cyan-100/70">Embed URL</div>
                        <input
                            value={eventCreditsConfig?.supportEmbedUrl || ''}
                            onChange={(e) => updateConfig({ supportEmbedUrl: e.target.value })}
                            placeholder="https://givebutter.com/embed/..."
                            className={inputClass}
                        />
                    </label>
                </div>
            </details>
        </div>
    );
};

export default EventCreditsConfigPanel;
