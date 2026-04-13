import React from 'react';
import {
    EVENT_CREDITS_PRESET_OPTIONS,
    applyEventCreditsPreset,
} from '../hostLaunchHelpers';
import { MONEYBAGS_BADGE_LABEL } from '../../../lib/roomMonetization';

const cardClass = 'rounded-2xl border border-white/10 bg-black/18 p-4';
const inputClass = 'mt-2 w-full rounded-xl border border-cyan-400/20 bg-black/25 px-3 py-3 text-sm text-white outline-none transition focus:border-cyan-300/45';

const numberValue = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

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

    return (
        <div className="space-y-4">
            <div className={cardClass}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <div className="text-[11px] uppercase tracking-[0.2em] text-cyan-100/70">Event credits</div>
                        <div className="mt-1 text-lg font-black text-white">Per-room credits and external monetization</div>
                        <div className="mt-1 text-sm text-cyan-100/68">
                            Configure ticket-linked credits, promo entry points, and Givebutter support flows on this room.
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
                            placeholder="AAHF Karaoke Kick-Off"
                            className={inputClass}
                        />
                    </label>
                </div>
            </div>

            <div className={cardClass}>
                <div className="text-[11px] uppercase tracking-[0.2em] text-cyan-100/70">Attendee matching</div>
                <div className="mt-1 text-sm text-cyan-100/68">
                    Use Givebutter ticket or campaign data to seed entry credits when a signed-in email matches the attendee record.
                </div>
                <div className={`mt-4 grid gap-3 ${compact ? 'lg:grid-cols-1' : 'lg:grid-cols-2'}`}>
                    <label className="block">
                        <div className="text-[11px] uppercase tracking-[0.18em] text-cyan-100/70">Source provider</div>
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
                                onChange={(e) => updateConfig({ generalAdmissionPoints: e.target.value })}
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
            </div>

            <div className={cardClass}>
                <div className="text-[11px] uppercase tracking-[0.2em] text-cyan-100/70">Givebutter support flow</div>
                <div className="mt-1 text-sm text-cyan-100/68">
                    Set a per-room or per-event support link. Matching webhook purchases can trigger a room-wide points burst and a {MONEYBAGS_BADGE_LABEL} celebration moment.
                </div>
                <div className={`mt-4 grid gap-3 ${compact ? 'lg:grid-cols-1' : 'lg:grid-cols-2'}`}>
                    <label className="block">
                        <div className="text-[11px] uppercase tracking-[0.18em] text-cyan-100/70">Support provider</div>
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
                        <div className="text-[11px] uppercase tracking-[0.18em] text-cyan-100/70">Support label</div>
                        <input
                            value={eventCreditsConfig?.supportLabel || ''}
                            onChange={(e) => updateConfig({ supportLabel: e.target.value })}
                            placeholder="Support this room"
                            className={inputClass}
                        />
                    </label>
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
                        <div className="text-[11px] uppercase tracking-[0.18em] text-cyan-100/70">Room-wide points per purchase</div>
                        <input
                            type="number"
                            min="0"
                            value={numberValue(eventCreditsConfig?.supportPoints)}
                            onChange={(e) => updateConfig({ supportPoints: e.target.value })}
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
                        <div className="text-[11px] uppercase tracking-[0.18em] text-cyan-100/70">Embed URL</div>
                        <input
                            value={eventCreditsConfig?.supportEmbedUrl || ''}
                            onChange={(e) => updateConfig({ supportEmbedUrl: e.target.value })}
                            placeholder="https://givebutter.com/embed/..."
                            className={inputClass}
                        />
                    </label>
                </div>
                <label className="mt-4 inline-flex items-center gap-2 text-sm text-zinc-200">
                    <input
                        type="checkbox"
                        checked={eventCreditsConfig?.supportBadge !== false}
                        onChange={(e) => updateConfig({ supportBadge: e.target.checked })}
                    />
                    Celebrate the buyer as {MONEYBAGS_BADGE_LABEL}
                </label>
            </div>
        </div>
    );
};

export default EventCreditsConfigPanel;
