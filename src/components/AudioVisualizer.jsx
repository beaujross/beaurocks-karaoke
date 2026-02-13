import { useEffect, useRef } from 'react';
import { createLogger } from '../lib/logger';

const visualizerLogger = createLogger('AudioVisualizer');
const MAX_INIT_RETRIES = 5;
const mediaElementSourceCache = new WeakMap();

const PRESET_CONFIG = Object.freeze({
    calm: { colors: ['#67e8f9', '#93c5fd', '#a5b4fc'], speed: 0.75, intensity: 0.75, glow: 8 },
    club: { colors: ['#ec4899', '#f97316', '#22d3ee'], speed: 1.35, intensity: 1.35, glow: 20 },
    neon: { colors: ['#00C4D9', '#ec4899', '#a855f7'], speed: 1.05, intensity: 1.1, glow: 14 },
    retro: { colors: ['#fbbf24', '#86efac', '#22d3ee'], speed: 0.9, intensity: 0.95, glow: 12 },
    acid: { colors: ['#c7f924', '#92ff3e', '#d946ef'], speed: 1.15, intensity: 1.22, glow: 18 },
    mono: { colors: ['#f5f5f5', '#d4d4d8', '#71717a'], speed: 0.82, intensity: 0.85, glow: 10 },
    cyan_magenta: { colors: ['#22d3ee', '#e879f9', '#0ea5e9'], speed: 1.1, intensity: 1.08, glow: 16 },
    solar: { colors: ['#fde047', '#facc15', '#60a5fa'], speed: 1.12, intensity: 1.2, glow: 18 }
});

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const getPresetConfig = (preset = 'neon') => PRESET_CONFIG[preset] || PRESET_CONFIG.neon;

const getOrCreateMediaElementSource = (ctx, mediaElement) => {
    if (!ctx || !mediaElement) return null;
    const cached = mediaElementSourceCache.get(mediaElement);
    if (cached?.ctx === ctx && cached?.source) {
        return cached.source;
    }
    const source = ctx.createMediaElementSource(mediaElement);
    mediaElementSourceCache.set(mediaElement, { ctx, source });
    return source;
};

const AudioVisualizer = ({
    onVolume,
    isActive,
    externalCtx,
    mode = 'waveform',
    className = '',
    mediaElement = null,
    inputMode = 'mic',
    simulatedLevel = 0,
    preset = 'neon',
    sensitivity = 1,
    smoothing = 0.35
}) => {
    const canvasRef = useRef(null);
    const onVolumeRef = useRef(onVolume);
    const modeRef = useRef(mode);
    const phaseRef = useRef(0);
    const simulatedLevelRef = useRef(simulatedLevel);
    const presetRef = useRef(preset);
    const sensitivityRef = useRef(sensitivity);
    const smoothingRef = useRef(smoothing);
    const warnedInitErrorRef = useRef(false);
    const warnedMediaSourceErrorRef = useRef(false);

    useEffect(() => { onVolumeRef.current = onVolume; }, [onVolume]);
    useEffect(() => { modeRef.current = mode; }, [mode]);
    useEffect(() => { simulatedLevelRef.current = simulatedLevel; }, [simulatedLevel]);
    useEffect(() => { presetRef.current = preset; }, [preset]);
    useEffect(() => { sensitivityRef.current = sensitivity; }, [sensitivity]);
    useEffect(() => { smoothingRef.current = smoothing; }, [smoothing]);

    useEffect(() => {
        if (!isActive || !externalCtx) return undefined;

        let animationFrame = null;
        let retryTimer = null;
        let retryCount = 0;
        let retriesExhausted = false;
        let destroyed = false;
        let analyser = null;
        let source = null;
        let stream = null;
        let dataArray = new Uint8Array(128);
        let smoothData = new Float32Array(128);

        const resetSmoothData = (nextLength) => {
            smoothData = new Float32Array(nextLength);
            dataArray = new Uint8Array(nextLength);
        };

        const teardownInput = () => {
            if (source && analyser) {
                try {
                    source.disconnect(analyser);
                } catch (_error) {
                    // noop
                }
            }
            if (stream) {
                stream.getTracks().forEach((track) => track.stop());
            }
            stream = null;
            analyser = null;
            source = null;
        };

        const render = () => {
            if (destroyed || !canvasRef.current) return;

            const presetConfig = getPresetConfig(presetRef.current);
            const safeSensitivity = clamp(Number(sensitivityRef.current) || 1, 0.5, 2.5);
            const safeSmoothing = clamp(Number(smoothingRef.current) || 0.35, 0, 0.95);
            const smoothingAlpha = 1 - safeSmoothing;

            if (analyser) {
                analyser.getByteFrequencyData(dataArray);
            } else {
                const safeLevel = Math.max(0, Math.min(100, Number(simulatedLevelRef.current) || 0)) / 100;
                for (let i = 0; i < dataArray.length; i += 1) {
                    const wave = (Math.sin(phaseRef.current * 2 + i * 0.18) + 1) / 2;
                    const ripple = (Math.cos(phaseRef.current * 1.4 + i * 0.07) + 1) / 2;
                    const value = safeLevel * (0.3 + 0.5 * wave + 0.2 * ripple);
                    dataArray[i] = Math.round(Math.max(0, Math.min(255, value * 255)));
                }
            }

            for (let i = 0; i < dataArray.length; i += 1) {
                const boosted = clamp(dataArray[i] * safeSensitivity * presetConfig.intensity, 0, 255);
                smoothData[i] += (boosted - smoothData[i]) * smoothingAlpha;
                dataArray[i] = Math.round(smoothData[i]);
            }
            phaseRef.current += 0.015 * presetConfig.speed;

            let sum = 0;
            for (let i = 0; i < dataArray.length; i += 1) sum += dataArray[i];
            const avg = sum / dataArray.length;

            if (onVolumeRef.current) onVolumeRef.current(avg);

            const canvas = canvasRef.current;
            const ctx = canvas ? canvas.getContext('2d') : null;
            if (ctx) {
                const width = canvas.width;
                const height = canvas.height;
                const centerY = height / 2;
                ctx.clearRect(0, 0, width, height);

                const [colorA, colorB, colorC] = presetConfig.colors;
                const gradient = ctx.createLinearGradient(0, 0, width, 0);
                gradient.addColorStop(0, colorA);
                gradient.addColorStop(0.5, colorB);
                gradient.addColorStop(1, colorC);

                const bars = 72;
                const barWidth = width / bars;

                const drawWaveform = () => {
                    ctx.strokeStyle = gradient;
                    ctx.lineWidth = 4;
                    ctx.lineCap = 'round';
                    ctx.shadowBlur = presetConfig.glow;
                    ctx.shadowColor = colorB;
                    ctx.beginPath();

                    let x = 0;
                    for (let i = 0; i < bars; i += 1) {
                        const index = Math.floor(i * (dataArray.length / bars));
                        const val = dataArray[index] / 255.0;
                        const h = val * height * 0.8;
                        ctx.moveTo(x, centerY - h / 2);
                        ctx.lineTo(x, centerY + h / 2);
                        x += barWidth;
                    }
                    ctx.stroke();
                    ctx.shadowBlur = 0;
                };

                const drawRibbon = () => {
                    const phase = phaseRef.current;
                    ctx.fillStyle = 'rgba(8, 12, 24, 0.35)';
                    ctx.fillRect(0, 0, width, height);
                    ctx.beginPath();
                    ctx.moveTo(0, centerY);
                    for (let i = 0; i <= bars; i += 1) {
                        const index = Math.floor(i * (dataArray.length / bars));
                        const val = dataArray[index] / 255.0;
                        const amp = val * height * 0.35;
                        const wave = Math.sin(i * 0.35 + phase) * (height * 0.08);
                        const y = centerY + wave - amp * 0.6;
                        ctx.lineTo(i * barWidth, y);
                    }
                    ctx.lineTo(width, height);
                    ctx.lineTo(0, height);
                    ctx.closePath();
                    ctx.fillStyle = gradient;
                    ctx.globalAlpha = 0.75;
                    ctx.fill();
                    ctx.globalAlpha = 1;

                    ctx.beginPath();
                    for (let i = 0; i <= bars; i += 1) {
                        const index = Math.floor(i * (dataArray.length / bars));
                        const val = dataArray[index] / 255.0;
                        const amp = val * height * 0.45;
                        const wave = Math.cos(i * 0.3 + phase * 1.4) * (height * 0.06);
                        const y = centerY + wave + amp * 0.3;
                        ctx.lineTo(i * barWidth, y);
                    }
                    ctx.strokeStyle = colorB;
                    ctx.lineWidth = 3;
                    ctx.shadowBlur = presetConfig.glow;
                    ctx.shadowColor = colorB;
                    ctx.stroke();
                    ctx.shadowBlur = 0;
                };

                const drawRings = () => {
                    const phase = phaseRef.current;
                    const base = Math.min(width, height) * 0.18;
                    ctx.translate(width / 2, height / 2);
                    for (let r = 0; r < 6; r += 1) {
                        const index = Math.floor((r / 6) * dataArray.length);
                        const val = dataArray[index] / 255.0;
                        const radius = base + r * 32 + val * 40;
                        ctx.beginPath();
                        ctx.strokeStyle = r % 2 === 0 ? colorB : colorA;
                        ctx.lineWidth = 6 - r * 0.6;
                        ctx.globalAlpha = 0.7 - r * 0.08;
                        ctx.shadowBlur = presetConfig.glow + 6;
                        ctx.shadowColor = ctx.strokeStyle;
                        ctx.arc(0, 0, radius, phase * 0.4 + r, phase * 0.4 + r + Math.PI * 1.5);
                        ctx.stroke();
                    }
                    ctx.setTransform(1, 0, 0, 1, 0, 0);
                    ctx.globalAlpha = 1;
                    ctx.shadowBlur = 0;
                };

                const drawSparkline = () => {
                    ctx.beginPath();
                    ctx.strokeStyle = gradient;
                    ctx.lineWidth = 3;
                    ctx.shadowBlur = presetConfig.glow + 2;
                    ctx.shadowColor = colorA;
                    for (let i = 0; i <= bars; i += 1) {
                        const index = Math.floor(i * (dataArray.length / bars));
                        const val = dataArray[index] / 255.0;
                        const y = height - (val * height * 0.7) - 20;
                        const x = i * barWidth;
                        if (i === 0) ctx.moveTo(x, y);
                        else ctx.lineTo(x, y);
                    }
                    ctx.stroke();
                    ctx.shadowBlur = 0;
                };

                const drawOrbBands = () => {
                    const phase = phaseRef.current;
                    const cx = width / 2;
                    const cy = height / 2;
                    const radius = Math.min(width, height) * 0.34;

                    const shellGrad = ctx.createRadialGradient(
                        cx - (radius * 0.2),
                        cy - (radius * 0.32),
                        radius * 0.08,
                        cx,
                        cy,
                        radius
                    );
                    shellGrad.addColorStop(0, 'rgba(255,255,255,0.18)');
                    shellGrad.addColorStop(0.5, 'rgba(15,23,42,0.3)');
                    shellGrad.addColorStop(1, 'rgba(2,6,23,0.72)');
                    ctx.fillStyle = shellGrad;
                    ctx.beginPath();
                    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
                    ctx.fill();

                    const bands = 16;
                    for (let i = 0; i < bands; i += 1) {
                        const t = i / (bands - 1);
                        const yRatio = (t * 2) - 1;
                        const ringWidth = Math.sqrt(Math.max(0, 1 - (yRatio * yRatio)));
                        const y = cy + (yRatio * radius * 0.9) + Math.sin((i * 0.38) + phase) * 2.4;
                        const halfW = ringWidth * radius;
                        const sample = dataArray[Math.floor((i / bands) * dataArray.length)] / 255;
                        const lineW = 4 + (sample * 10);
                        const mix = 0.2 + (0.8 * (i / Math.max(1, bands - 1)));
                        const stroke = i % 2 === 0 ? colorA : colorB;
                        ctx.strokeStyle = stroke;
                        ctx.globalAlpha = mix;
                        ctx.lineWidth = lineW;
                        ctx.shadowBlur = presetConfig.glow + (sample * 16);
                        ctx.shadowColor = stroke;
                        ctx.beginPath();
                        ctx.ellipse(cx, y, halfW, lineW * 0.7, 0, 0, Math.PI * 2);
                        ctx.stroke();
                    }
                    ctx.globalAlpha = 1;
                    ctx.shadowBlur = 0;
                };

                const drawHaloPulse = () => {
                    const phase = phaseRef.current;
                    const cx = width / 2;
                    const cy = height / 2;
                    const avgNorm = avg / 255;
                    const radius = Math.min(width, height) * (0.3 + (avgNorm * 0.12));
                    const thickness = 16 + (avgNorm * 18);
                    const spin = phase * 0.55;

                    ctx.lineCap = 'round';
                    ctx.strokeStyle = colorB;
                    ctx.lineWidth = thickness;
                    ctx.shadowBlur = presetConfig.glow + 18;
                    ctx.shadowColor = colorB;
                    ctx.beginPath();
                    ctx.arc(cx, cy, radius, spin, spin + (Math.PI * 1.7));
                    ctx.stroke();

                    ctx.strokeStyle = colorA;
                    ctx.lineWidth = Math.max(6, thickness * 0.45);
                    ctx.shadowBlur = presetConfig.glow + 8;
                    ctx.shadowColor = colorA;
                    ctx.beginPath();
                    ctx.arc(cx, cy, radius * 0.56, -spin * 1.2, (-spin * 1.2) + (Math.PI * 1.4));
                    ctx.stroke();

                    ctx.shadowBlur = 0;
                };

                const drawSonarSpikes = () => {
                    const phase = phaseRef.current;
                    const cx = width / 2;
                    const cy = height / 2;
                    const base = Math.min(width, height) * 0.26;
                    const spikes = 120;

                    ctx.beginPath();
                    for (let i = 0; i <= spikes; i += 1) {
                        const p = i / spikes;
                        const angle = (p * Math.PI * 2) + (phase * 0.35);
                        const sample = dataArray[Math.floor(p * (dataArray.length - 1))] / 255;
                        const spike = base + (sample * 70);
                        const x = cx + (Math.cos(angle) * spike);
                        const y = cy + (Math.sin(angle) * spike);
                        if (i === 0) ctx.moveTo(x, y);
                        else ctx.lineTo(x, y);
                    }
                    ctx.closePath();
                    ctx.strokeStyle = colorA;
                    ctx.lineWidth = 3;
                    ctx.shadowBlur = presetConfig.glow + 10;
                    ctx.shadowColor = colorA;
                    ctx.stroke();

                    ctx.beginPath();
                    ctx.arc(cx, cy, base * 0.72, 0, Math.PI * 2);
                    ctx.strokeStyle = colorC;
                    ctx.globalAlpha = 0.7;
                    ctx.lineWidth = 2;
                    ctx.shadowBlur = presetConfig.glow + 4;
                    ctx.shadowColor = colorC;
                    ctx.stroke();
                    ctx.globalAlpha = 1;
                    ctx.shadowBlur = 0;
                };

                const drawKaleidoBurst = () => {
                    const phase = phaseRef.current;
                    const cx = width / 2;
                    const cy = height / 2;
                    const wedges = 18;
                    const base = Math.min(width, height) * 0.16;

                    ctx.save();
                    ctx.translate(cx, cy);
                    ctx.rotate(phase * 0.12);

                    for (let i = 0; i < wedges; i += 1) {
                        const p = i / wedges;
                        const sample = dataArray[Math.floor(p * (dataArray.length - 1))] / 255;
                        const len = base + (sample * Math.min(width, height) * 0.32);
                        const spread = (Math.PI * 2 / wedges) * 0.38;
                        ctx.beginPath();
                        ctx.moveTo(0, 0);
                        ctx.lineTo(Math.cos(-spread) * len, Math.sin(-spread) * len);
                        ctx.lineTo(Math.cos(spread) * len, Math.sin(spread) * len);
                        ctx.closePath();
                        ctx.fillStyle = i % 2 === 0 ? colorA : colorC;
                        ctx.globalAlpha = 0.28 + (sample * 0.65);
                        ctx.shadowBlur = presetConfig.glow + 6;
                        ctx.shadowColor = i % 2 === 0 ? colorA : colorC;
                        ctx.fill();
                        ctx.rotate((Math.PI * 2) / wedges);
                    }

                    ctx.restore();
                    ctx.globalAlpha = 1;
                    ctx.shadowBlur = 0;
                };

                const drawHexTunnel = () => {
                    const phase = phaseRef.current;
                    const cx = width / 2;
                    const cy = height / 2;
                    const maxR = Math.min(width, height) * 0.52;
                    const rings = 8;
                    const drawHex = (radius) => {
                        ctx.beginPath();
                        for (let i = 0; i < 6; i += 1) {
                            const a = -Math.PI / 2 + (i * Math.PI / 3);
                            const x = cx + (Math.cos(a) * radius);
                            const y = cy + (Math.sin(a) * radius);
                            if (i === 0) ctx.moveTo(x, y);
                            else ctx.lineTo(x, y);
                        }
                        ctx.closePath();
                    };

                    for (let i = 0; i < rings; i += 1) {
                        const loop = (((i * 0.18) + (phase * 0.08)) % 1);
                        const sample = dataArray[Math.floor((i / rings) * (dataArray.length - 1))] / 255;
                        const radius = maxR * Math.max(0.12, 1 - loop);
                        drawHex(radius + (sample * 14));
                        ctx.strokeStyle = i % 2 === 0 ? colorA : colorB;
                        ctx.globalAlpha = 0.14 + ((1 - loop) * 0.75);
                        ctx.lineWidth = 2 + (sample * 4);
                        ctx.shadowBlur = presetConfig.glow + 4;
                        ctx.shadowColor = i % 2 === 0 ? colorA : colorB;
                        ctx.stroke();
                    }

                    ctx.globalAlpha = 1;
                    ctx.shadowBlur = 0;
                };

                const drawOrbitArcs = () => {
                    const phase = phaseRef.current;
                    const cx = width / 2;
                    const cy = height / 2;
                    const outer = Math.min(width, height) * 0.35;
                    const inner = outer * 0.52;
                    const avgNorm = avg / 255;

                    ctx.lineCap = 'round';
                    ctx.strokeStyle = colorA;
                    ctx.lineWidth = 16 + (avgNorm * 10);
                    ctx.shadowBlur = presetConfig.glow + 8;
                    ctx.shadowColor = colorA;
                    ctx.beginPath();
                    ctx.arc(cx, cy, outer, phase * 0.4, phase * 0.4 + Math.PI * 1.55);
                    ctx.stroke();

                    ctx.strokeStyle = colorB;
                    ctx.lineWidth = 12 + (avgNorm * 9);
                    ctx.shadowBlur = presetConfig.glow + 8;
                    ctx.shadowColor = colorB;
                    ctx.beginPath();
                    ctx.arc(cx, cy, inner, -phase * 0.8, -phase * 0.8 + Math.PI * 1.45);
                    ctx.stroke();

                    ctx.shadowBlur = 0;
                };

                const drawCometSweep = () => {
                    const phase = phaseRef.current;
                    const avgNorm = avg / 255;
                    const y = (height * 0.2) + (Math.sin(phase * 0.45) * height * 0.2);
                    const startX = width * 0.55;
                    const tail = width * (0.45 + (avgNorm * 0.25));

                    const beam = ctx.createLinearGradient(startX, y, Math.min(width, startX + tail), y);
                    beam.addColorStop(0, colorA);
                    beam.addColorStop(0.6, colorB);
                    beam.addColorStop(1, 'rgba(255,255,255,0)');

                    ctx.strokeStyle = beam;
                    ctx.lineWidth = 8 + (avgNorm * 14);
                    ctx.shadowBlur = presetConfig.glow + 18;
                    ctx.shadowColor = colorA;
                    ctx.beginPath();
                    ctx.moveTo(startX, y);
                    ctx.lineTo(Math.min(width, startX + tail), y - (height * 0.1 * avgNorm));
                    ctx.stroke();

                    ctx.lineWidth = 3;
                    ctx.shadowBlur = presetConfig.glow + 6;
                    ctx.beginPath();
                    ctx.moveTo(startX, y + 6);
                    ctx.lineTo(Math.min(width, startX + tail * 0.75), y + (height * 0.06 * avgNorm));
                    ctx.stroke();
                    ctx.shadowBlur = 0;
                };

                const activeMode = modeRef.current || 'waveform';
                if (activeMode === 'ribbon') drawRibbon();
                else if (activeMode === 'rings') drawRings();
                else if (activeMode === 'spark') drawSparkline();
                else if (activeMode === 'orb') drawOrbBands();
                else if (activeMode === 'halo') drawHaloPulse();
                else if (activeMode === 'sonar') drawSonarSpikes();
                else if (activeMode === 'kaleido') drawKaleidoBurst();
                else if (activeMode === 'hex') drawHexTunnel();
                else if (activeMode === 'orbit') drawOrbitArcs();
                else if (activeMode === 'comet') drawCometSweep();
                else drawWaveform();
            }

            animationFrame = requestAnimationFrame(render);
        };

        const scheduleRetry = () => {
            if (destroyed || retryTimer || retriesExhausted) return;
            if (retryCount >= MAX_INIT_RETRIES) {
                retriesExhausted = true;
                visualizerLogger.warnOnce(
                    'init-retries-exhausted',
                    `[visualizer] init retries exhausted (${MAX_INIT_RETRIES}); using simulated fallback until remount`
                );
                if (!animationFrame) render();
                return;
            }
            const delayMs = Math.min(5000, 300 * (2 ** retryCount));
            retryCount += 1;
            retryTimer = setTimeout(() => {
                retryTimer = null;
                init();
            }, delayMs);
        };

        const init = async () => {
            try {
                if (externalCtx.state === 'suspended') {
                    await externalCtx.resume();
                }

                teardownInput();

                const wantsMediaElement = inputMode === 'media' || (inputMode === 'auto' && !!mediaElement);
                const wantsMic = inputMode === 'mic' || inputMode === 'auto';

                if (wantsMediaElement && mediaElement) {
                    try {
                        analyser = externalCtx.createAnalyser();
                        analyser.fftSize = 256;
                        source = getOrCreateMediaElementSource(externalCtx, mediaElement);
                        if (source) source.connect(analyser);
                    } catch (mediaErr) {
                        analyser = null;
                        source = null;
                        warnedMediaSourceErrorRef.current = true;
                        visualizerLogger.warnOnce(
                            'media-element-init-failed',
                            '[visualizer] media-element analyser init failed; using fallback signal',
                            mediaErr
                        );
                    }
                }

                if (!analyser && wantsMic) {
                    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                    analyser = externalCtx.createAnalyser();
                    analyser.fftSize = 256;
                    source = externalCtx.createMediaStreamSource(stream);
                    source.connect(analyser);
                }

                resetSmoothData(analyser ? analyser.frequencyBinCount : 128);
                warnedInitErrorRef.current = false;
                retryCount = 0;
                retriesExhausted = false;

                if (!animationFrame) render();
            } catch (error) {
                teardownInput();
                resetSmoothData(128);
                if (!warnedInitErrorRef.current) {
                    warnedInitErrorRef.current = true;
                    visualizerLogger.warn('[visualizer] init failed; retrying with fallback', error);
                }
                scheduleRetry();
            }
        };

        init();

        return () => {
            destroyed = true;
            if (retryTimer) clearTimeout(retryTimer);
            if (animationFrame) cancelAnimationFrame(animationFrame);
            teardownInput();
        };
    }, [isActive, externalCtx, mediaElement, inputMode]);

    return <canvas ref={canvasRef} width={800} height={300} className={className || 'w-full h-full opacity-90 mix-blend-screen'} />;
};

export default AudioVisualizer;
