import React, { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import { ASSETS } from '../../../lib/assets';
import {
    DEFAULT_AUDIENCE_BRAND_THEME,
    normalizeAudienceBrandTheme,
    withAudienceBrandAlpha,
} from '../../../lib/audienceBrandTheme';

const resolveBrandTheme = (theme = null) => normalizeAudienceBrandTheme(theme || DEFAULT_AUDIENCE_BRAND_THEME);

const JoinPosterQr = ({ value = '', size = 420, alt = 'Join QR code' }) => {
    const [src, setSrc] = useState('');

    useEffect(() => {
        let active = true;
        if (!value) {
            return undefined;
        }
        QRCode.toDataURL(value, {
            width: size,
            margin: 1,
            errorCorrectionLevel: 'H',
            color: {
                dark: '#05060B',
                light: '#FFFFFF',
            },
        }).then((dataUrl) => {
            if (active) setSrc(dataUrl);
        }).catch(() => {
            if (active) setSrc('');
        });
        return () => {
            active = false;
        };
    }, [size, value]);

    if (!src) {
        return (
            <div
                className="flex items-center justify-center rounded-[2.25rem] border border-white/20 bg-white text-3xl font-black tracking-[0.22em] text-zinc-800"
                style={{ width: `${size}px`, height: `${size}px` }}
            >
                QR
            </div>
        );
    }

    return (
        <img
            src={src}
            alt={alt}
            className="rounded-[2.25rem] bg-white object-cover shadow-[0_30px_90px_rgba(0,0,0,0.42)]"
            style={{ width: `${size}px`, height: `${size}px` }}
        />
    );
};

const buildPrintHtml = ({
    audienceUrl = '',
    instructions = [],
    logoUrl = '',
    roomCode = '',
    roomName = '',
    theme = DEFAULT_AUDIENCE_BRAND_THEME,
}) => {
    const safeTheme = resolveBrandTheme(theme);
    const safeLogoUrl = String(logoUrl || '').trim() || ASSETS.logo;
    const safeRoomCode = String(roomCode || '').trim().toUpperCase();
    const safeRoomName = String(roomName || '').trim() || 'Join the room';
    const safeAudienceUrl = String(audienceUrl || '').trim();
    const safeInstructions = Array.isArray(instructions) ? instructions.slice(0, 4) : [];
    const esc = (value = '') => String(value || '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;');
    const instructionMarkup = safeInstructions.map((instruction, index) => `
        <div class="instruction">
            <span class="instruction-index">${index + 1}</span>
            <span>${esc(instruction)}</span>
        </div>
    `).join('');

    return `<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8" />
    <title>${esc(safeRoomName)} Poster</title>
    <style>
        :root {
            --primary: ${safeTheme.primaryColor};
            --secondary: ${safeTheme.secondaryColor};
            --accent: ${safeTheme.accentColor};
            --ink: #F8FAFC;
            --bg: #05060B;
            --panel: #0C1018;
        }
        * { box-sizing: border-box; }
        body {
            margin: 0;
            min-height: 100vh;
            background:
                radial-gradient(circle at top left, color-mix(in srgb, var(--secondary) 28%, transparent) 0%, transparent 34%),
                radial-gradient(circle at 85% 12%, color-mix(in srgb, var(--primary) 26%, transparent) 0%, transparent 36%),
                linear-gradient(135deg, #05060B 0%, #0A0E16 46%, #11111C 100%);
            color: var(--ink);
            font-family: Inter, Arial, sans-serif;
            padding: 28px;
        }
        .poster {
            width: 100%;
            max-width: 1200px;
            margin: 0 auto;
            border-radius: 40px;
            border: 2px solid rgba(255,255,255,0.1);
            background: linear-gradient(145deg, rgba(8,11,18,0.96), rgba(18,14,26,0.96));
            overflow: hidden;
            box-shadow: 0 40px 120px rgba(0,0,0,0.45);
        }
        .poster-top {
            padding: 36px 40px 28px;
            display: grid;
            grid-template-columns: minmax(0, 1.2fr) minmax(280px, 420px);
            gap: 28px;
            align-items: center;
        }
        .logo-wrap {
            display: flex;
            align-items: center;
            gap: 20px;
        }
        .logo {
            width: 200px;
            max-height: 200px;
            object-fit: contain;
            border-radius: 28px;
            background: rgba(0,0,0,0.18);
            padding: 12px;
            box-shadow: 0 20px 50px rgba(0,0,0,0.35);
        }
        .eyebrow {
            font-size: 18px;
            font-weight: 900;
            letter-spacing: 0.32em;
            text-transform: uppercase;
            color: var(--secondary);
        }
        h1 {
            margin: 12px 0 10px;
            font-size: 88px;
            line-height: 0.95;
        }
        .room-code {
            display: inline-flex;
            align-items: center;
            margin-top: 18px;
            padding: 16px 24px;
            border-radius: 999px;
            border: 2px solid color-mix(in srgb, var(--primary) 48%, white 10%);
            background: color-mix(in srgb, var(--primary) 18%, black 82%);
            font-family: "IBM Plex Mono", "Courier New", monospace;
            font-size: 42px;
            font-weight: 800;
            letter-spacing: 0.18em;
            color: var(--ink);
        }
        .subtitle {
            font-size: 28px;
            line-height: 1.35;
            color: rgba(248,250,252,0.82);
        }
        .qr-shell {
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
            border-radius: 34px;
            background: rgba(255,255,255,0.08);
            border: 2px solid rgba(255,255,255,0.08);
        }
        .qr-shell img {
            width: 100%;
            height: auto;
            display: block;
            border-radius: 26px;
            background: white;
        }
        .poster-bottom {
            border-top: 2px solid rgba(255,255,255,0.08);
            padding: 30px 40px 38px;
            display: grid;
            grid-template-columns: 1.2fr 1fr;
            gap: 28px;
            align-items: start;
        }
        .join-url {
            padding: 22px 24px;
            border-radius: 28px;
            background: rgba(255,255,255,0.05);
            border: 2px solid rgba(255,255,255,0.08);
        }
        .join-url-label {
            font-size: 16px;
            font-weight: 900;
            letter-spacing: 0.24em;
            text-transform: uppercase;
            color: var(--primary);
        }
        .join-url-value {
            margin-top: 12px;
            font-size: 34px;
            font-weight: 900;
            line-height: 1.18;
            word-break: break-word;
        }
        .instructions {
            padding: 22px 24px;
            border-radius: 28px;
            background: rgba(255,255,255,0.05);
            border: 2px solid rgba(255,255,255,0.08);
        }
        .instructions-label {
            font-size: 16px;
            font-weight: 900;
            letter-spacing: 0.24em;
            text-transform: uppercase;
            color: var(--accent);
        }
        .instruction {
            display: flex;
            gap: 14px;
            align-items: flex-start;
            margin-top: 16px;
            font-size: 28px;
            font-weight: 800;
            line-height: 1.22;
        }
        .instruction-index {
            min-width: 42px;
            color: var(--secondary);
        }
        @media print {
            body { padding: 0; }
            .poster {
                max-width: none;
                border-radius: 0;
                border: none;
                box-shadow: none;
            }
        }
    </style>
</head>
<body>
    <main class="poster">
        <section class="poster-top">
            <div>
                <div class="logo-wrap">
                    <img class="logo" src="${esc(safeLogoUrl)}" alt="Event logo" />
                </div>
                <div class="eyebrow">Scan To Join</div>
                <h1>${esc(safeRoomName)}</h1>
                <div class="subtitle">Check in at the door, scan the code, pick your emoji, and request songs from your phone.</div>
                <div class="room-code">${esc(safeRoomCode)}</div>
            </div>
            <div class="qr-shell" id="qr-target"></div>
        </section>
        <section class="poster-bottom">
            <div class="join-url">
                <div class="join-url-label">Join URL</div>
                <div class="join-url-value">${esc(safeAudienceUrl)}</div>
            </div>
            <div class="instructions">
                <div class="instructions-label">How It Works</div>
                ${instructionMarkup}
            </div>
        </section>
    </main>
    <script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.4/build/qrcode.min.js"></script>
    <script>
        window.addEventListener('load', function () {
            var target = document.getElementById('qr-target');
            if (!target || !window.QRCode) return;
            window.QRCode.toCanvas(document.createElement('canvas'), ${JSON.stringify(safeAudienceUrl)}, {
                width: 520,
                margin: 1,
                errorCorrectionLevel: 'H',
                color: { dark: '#05060B', light: '#FFFFFF' }
            }, function (err, canvas) {
                if (err) return;
                target.appendChild(canvas);
                window.print();
            });
        });
    </script>
</body>
</html>`;
};

const RoomJoinPosterModal = ({
    roomCode = '',
    roomName = '',
    audienceUrl = '',
    logoUrl = '',
    audienceBrandTheme = null,
    onClose,
}) => {
    const safeRoomCode = String(roomCode || '').trim().toUpperCase();
    const safeRoomName = String(roomName || '').trim() || (safeRoomCode ? `${safeRoomCode} Join` : 'Join The Room');
    const safeAudienceUrl = String(audienceUrl || '').trim();
    const safeLogoUrl = String(logoUrl || '').trim() || ASSETS.logo;
    const theme = useMemo(() => resolveBrandTheme(audienceBrandTheme), [audienceBrandTheme]);
    const instructions = useMemo(() => ([
        'Check in at the front door.',
        'Scan the QR code with your phone.',
        'Pick your emoji and join the room.',
        'Request songs and watch the queue live.',
    ]), []);

    const copyJoinUrl = async () => {
        if (!safeAudienceUrl || typeof navigator === 'undefined' || !navigator.clipboard?.writeText) return;
        try {
            await navigator.clipboard.writeText(safeAudienceUrl);
        } catch {
            // noop
        }
    };

    const printPoster = () => {
        if (typeof window === 'undefined') return;
        const popup = window.open('', '_blank', 'noopener,noreferrer,width=1240,height=1680');
        if (!popup) return;
        popup.document.open();
        popup.document.write(buildPrintHtml({
            audienceUrl: safeAudienceUrl,
            instructions,
            logoUrl: safeLogoUrl,
            roomCode: safeRoomCode,
            roomName: safeRoomName,
            theme,
        }));
        popup.document.close();
    };

    const primaryGlow = withAudienceBrandAlpha(theme.primaryColor, 0.26);
    const secondaryGlow = withAudienceBrandAlpha(theme.secondaryColor, 0.2);
    const accentGlow = withAudienceBrandAlpha(theme.accentColor, 0.24);

    return (
        <div className="fixed inset-0 z-[450] flex items-center justify-center bg-black/82 p-4 backdrop-blur-sm">
            <div className="relative w-full max-w-[1400px] overflow-hidden rounded-[2.2rem] border border-white/10 bg-[#070912] shadow-[0_40px_120px_rgba(0,0,0,0.6)]">
                <div
                    className="absolute inset-0"
                    style={{
                        backgroundImage: [
                            `radial-gradient(circle at top left, ${secondaryGlow} 0%, transparent 30%)`,
                            `radial-gradient(circle at 82% 12%, ${primaryGlow} 0%, transparent 34%)`,
                            `linear-gradient(145deg, rgba(8,11,18,0.96), rgba(17,13,27,0.96))`,
                        ].join(', '),
                    }}
                />
                <div className="relative border-b border-white/10 px-5 py-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <div className="text-[11px] font-black uppercase tracking-[0.28em] text-cyan-100/72">Join Poster</div>
                            <div className="mt-1 text-2xl font-black text-white">{safeRoomName}</div>
                            <div className="mt-1 text-sm text-cyan-100/74">{safeRoomCode} · {safeAudienceUrl}</div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <button
                                type="button"
                                onClick={copyJoinUrl}
                                className="rounded-full border border-cyan-300/28 bg-cyan-500/12 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.18em] text-cyan-100"
                            >
                                Copy URL
                            </button>
                            <button
                                type="button"
                                onClick={printPoster}
                                className="rounded-full border border-fuchsia-300/28 bg-fuchsia-500/12 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.18em] text-fuchsia-100"
                            >
                                Print Poster
                            </button>
                            <button
                                type="button"
                                onClick={onClose}
                                className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-100"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>

                <div className="relative grid gap-6 p-6 xl:grid-cols-[minmax(0,1.12fr)_460px]">
                    <div className="rounded-[2rem] border border-white/10 bg-black/26 p-8 shadow-[0_24px_90px_rgba(0,0,0,0.28)]">
                        <div className="flex items-start gap-6">
                            <div
                                className="flex h-[180px] w-[180px] shrink-0 items-center justify-center rounded-[2rem] border border-white/10 bg-black/24 p-4"
                                style={{ boxShadow: `0 20px 60px ${accentGlow}` }}
                            >
                                <img src={safeLogoUrl} alt={safeRoomName} className="max-h-full max-w-full object-contain" />
                            </div>
                            <div className="min-w-0">
                                <div className="text-[18px] font-black uppercase tracking-[0.34em]" style={{ color: theme.secondaryColor }}>
                                    Check In · Scan · Join
                                </div>
                                <div className="mt-4 text-[86px] font-black uppercase leading-[0.9] text-white">
                                    {safeRoomCode}
                                </div>
                                <div className="mt-5 max-w-3xl text-[32px] font-bold leading-[1.15] text-white/90">
                                    Scan the code, pick your emoji, and request songs from your phone.
                                </div>
                            </div>
                        </div>

                        <div className="mt-8 rounded-[1.8rem] border border-white/10 bg-white/[0.04] p-6">
                            <div className="text-[15px] font-black uppercase tracking-[0.26em]" style={{ color: theme.primaryColor }}>
                                Join URL
                            </div>
                            <div className="mt-3 break-words text-[34px] font-black leading-[1.15] text-white">
                                {safeAudienceUrl}
                            </div>
                        </div>

                        <div className="mt-8 grid gap-3">
                            {instructions.map((instruction, index) => (
                                <div key={instruction} className="flex items-start gap-4 rounded-[1.4rem] border border-white/10 bg-white/[0.04] px-5 py-4">
                                    <div
                                        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-xl font-black text-black"
                                        style={{ background: index % 2 === 0 ? theme.primaryColor : theme.secondaryColor }}
                                    >
                                        {index + 1}
                                    </div>
                                    <div className="text-[24px] font-bold leading-[1.18] text-white">
                                        {instruction}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="rounded-[2rem] border border-white/10 bg-white/[0.05] p-6">
                        <div className="text-[16px] font-black uppercase tracking-[0.28em]" style={{ color: theme.accentColor }}>
                            Scan Here
                        </div>
                        <div className="mt-4 flex justify-center">
                            <JoinPosterQr value={safeAudienceUrl} size={420} />
                        </div>
                        <div className="mt-5 rounded-[1.6rem] border border-white/10 bg-black/24 px-5 py-5">
                            <div className="text-[14px] font-black uppercase tracking-[0.26em]" style={{ color: theme.secondaryColor }}>
                                Event Notes
                            </div>
                            <div className="mt-3 text-[24px] font-bold leading-[1.22] text-white">
                                Ticket check happens at the door. Once admitted, guests scan this poster to join the live room.
                            </div>
                        </div>
                        <div className="mt-5 rounded-[1.6rem] border border-white/10 bg-black/24 px-5 py-5">
                            <div className="text-[14px] font-black uppercase tracking-[0.26em]" style={{ color: theme.primaryColor }}>
                                Room Code
                            </div>
                            <div className="mt-3 font-mono text-[42px] font-black uppercase tracking-[0.22em] text-white">
                                {safeRoomCode}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RoomJoinPosterModal;
