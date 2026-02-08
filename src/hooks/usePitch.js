import { useState, useEffect, useRef } from 'react';
import { NOTE_NAMES } from '../lib/assets';

const clamp = (val, min, max) => Math.max(min, Math.min(max, val));

export const usePitch = (isActive, options = {}) => {
    const [pitch, setPitch] = useState(0);
    const [volume, setVolume] = useState(0);
    const [note, setNote] = useState('-');
    const [confidence, setConfidence] = useState(0);
    const [volumeNormalized, setVolumeNormalized] = useState(0);
    const [stableNote, setStableNote] = useState('-');
    const [stability, setStability] = useState(0);
    const [calibrating, setCalibrating] = useState(false);
    const [noiseFloor, setNoiseFloor] = useState(0);
    const [isSinging, setIsSinging] = useState(false);

    const opts = {
        minVolumeThreshold: 0.02,
        noiseGateMultiplier: 1.6,
        smoothingFactor: 0.6,
        minFrequency: 80,
        maxFrequency: 1200,
        calibrationMs: 1200,
        confidenceThreshold: 0.6,
        singingThreshold: 0.08,
        stableNoteMs: 350,
        uiUpdateIntervalMs: 50,
        ...options
    };

    // Internal refs to maintain state without re-render thrashing inside the audio loop
    const audioCtx = useRef(null);
    const streamRef = useRef(null);
    const prevPitchRef = useRef(0);
    const currentNoteRef = useRef('-');
    const noteChangeAtRef = useRef(0);
    const noiseFloorRef = useRef(0);
    const calibrateRef = useRef({ start: 0, samples: [] });
    const lastUiUpdateRef = useRef(0);

    useEffect(() => {
        if(!isActive) { 
            if(audioCtx.current) { audioCtx.current.close(); audioCtx.current = null; } 
            if(streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; } 
            setTimeout(() => {
                setPitch(0);
                setVolume(0);
                setNote('-');
                setConfidence(0);
                setVolumeNormalized(0);
                setStableNote('-');
                setStability(0);
                setCalibrating(false);
                setNoiseFloor(0);
                setIsSinging(false);
            }, 0);
            return; 
        }

        let analyser, source, raf; 
        const buf = new Float32Array(2048);
        
        // Robust Autocorrelation Algorithm
        const autoCorrelate = (buf, sampleRate) => { 
            let SIZE = buf.length;
            let rms = 0; 
            
            // 1. Calculate RMS (Volume)
            for (let i=0; i<SIZE; i++) { 
                const val = buf[i]; 
                rms += val * val; 
            } 
            rms = Math.sqrt(rms/SIZE); 
            
            // Noise Gate Check
            if (rms < opts.minVolumeThreshold) return { pitch: -1, volume: rms, confidence: 0 }; 
            
            // 2. Trim buffer to signal (optimization)
            let r1 = 0, r2 = SIZE - 1, thres = 0.2; 
            for (let i=0; i<SIZE/2; i++) if (Math.abs(buf[i]) < thres) { r1=i; break; } 
            for (let i=1; i<SIZE/2; i++) if (Math.abs(buf[SIZE-i]) < thres) { r2=SIZE-i; break; } 
            
            const trimmedBuf = buf.slice(r1, r2); 
            SIZE = trimmedBuf.length; 
            if (SIZE < 2) return { pitch: -1, volume: rms, confidence: 0 };
            
            // 3. Autocorrelation
            const c = new Array(SIZE).fill(0); 
            for (let i=0; i<SIZE; i++) {
                for (let j=0; j<SIZE-i; j++) {
                    c[i] = c[i] + trimmedBuf[j] * trimmedBuf[j+i]; 
                }
            }
            
            // 4. Find Peak
            let d = 0; 
            while (c[d] > c[d+1]) d++; // Skip initial drop
            
            let maxval = -1, maxpos = -1; 
            for (let i=d; i<SIZE; i++) {
                if (c[i] > maxval) { 
                    maxval = c[i]; 
                    maxpos = i; 
                } 
            } 
            
            let T0 = maxpos;
            if (T0 <= 0) return { pitch: -1, volume: rms, confidence: 0 };
            
            // 5. Parabolic Interpolation (Higher Accuracy)
            // This estimates the true peak between samples for better pitch precision
            if (T0 > 0 && T0 < SIZE - 1) {
                const x1 = c[T0 - 1], x2 = c[T0], x3 = c[T0 + 1];
                const a = (x1 + x3 - 2 * x2) / 2;
                const b = (x3 - x1) / 2;
                if (a) T0 = T0 - b / (2 * a);
            }

            const calculatedPitch = sampleRate / T0;
            const confidence = c[0] ? clamp(maxval / c[0], 0, 1) : 0;
            
            // Filter out-of-bounds frequencies (Voice Range only)
            if (calculatedPitch < opts.minFrequency || calculatedPitch > opts.maxFrequency) {
                return { pitch: -1, volume: rms, confidence };
            }

            return { pitch: calculatedPitch, volume: rms, confidence }; 
        };
        
        const start = async () => { 
            try { 
                const stream = await navigator.mediaDevices.getUserMedia({ 
                    audio: { 
                        echoCancellation: true, 
                        autoGainControl: true, 
                        noiseSuppression: true 
                    } 
                }); 
                streamRef.current = stream; 
                
                audioCtx.current = new (window.AudioContext || window.webkitAudioContext)(); 
                
                // Robust resume handling
                if (audioCtx.current.state === 'suspended') {
                    await audioCtx.current.resume();
                }
                
                analyser = audioCtx.current.createAnalyser(); 
                analyser.fftSize = 2048; 
                
                source = audioCtx.current.createMediaStreamSource(stream); 
                source.connect(analyser); 
                
                calibrateRef.current = { start: performance.now(), samples: [] };
                noiseFloorRef.current = 0;
                setCalibrating(true);

                const update = () => { 
                    if (!analyser) return;
                    analyser.getFloatTimeDomainData(buf); 
                    
                    const { pitch: rawPitch, volume: rawVol, confidence: rawConfidence } = autoCorrelate(buf, audioCtx.current.sampleRate); 
                    const now = performance.now();
                    
                    if (calibrating) {
                        calibrateRef.current.samples.push(rawVol);
                        if (now - calibrateRef.current.start >= opts.calibrationMs) {
                            const samples = calibrateRef.current.samples.sort((a,b) => a - b);
                            const mid = Math.floor(samples.length / 2);
                            const median = samples.length ? samples[mid] : 0;
                            noiseFloorRef.current = clamp(median * opts.noiseGateMultiplier, opts.minVolumeThreshold, 0.2);
                            setNoiseFloor(noiseFloorRef.current);
                            setCalibrating(false);
                        }
                    }

                    const gate = Math.max(noiseFloorRef.current, opts.minVolumeThreshold);
                    const volNorm = clamp((rawVol - gate) / (1 - gate), 0, 1);
                    const hasPitch = rawPitch !== -1 && rawConfidence >= opts.confidenceThreshold;
                    const singing = volNorm >= opts.singingThreshold && rawConfidence >= opts.confidenceThreshold;
                    let nextPitch = prevPitchRef.current;
                    let nextNote = currentNoteRef.current;

                    if (hasPitch) {
                        const smoothed = (prevPitchRef.current * opts.smoothingFactor) + (rawPitch * (1 - opts.smoothingFactor));
                        prevPitchRef.current = smoothed;
                        nextPitch = smoothed;
                        const noteNum = 12 * (Math.log(smoothed / 440) / Math.log(2)) + 69;
                        const noteIndex = Math.round(noteNum) % 12;
                        nextNote = NOTE_NAMES[noteIndex >= 0 ? noteIndex : 0];

                        if (nextNote !== currentNoteRef.current) {
                            currentNoteRef.current = nextNote;
                            noteChangeAtRef.current = now;
                        }
                    }

                    const stableMs = currentNoteRef.current !== '-' ? now - noteChangeAtRef.current : 0;
                    const stableRatio = clamp(stableMs / opts.stableNoteMs, 0, 1);
                    const stable = stableRatio >= 1 ? currentNoteRef.current : '-';

                    if (now - lastUiUpdateRef.current >= opts.uiUpdateIntervalMs) {
                        lastUiUpdateRef.current = now;
                        setPitch(nextPitch);
                        setVolume(rawVol);
                        setNote(nextNote);
                        setConfidence(rawConfidence);
                        setVolumeNormalized(volNorm);
                        setStableNote(stable);
                        setStability(stableRatio);
                        setIsSinging(singing);
                    }
                    
                    raf = requestAnimationFrame(update); 
                }; 
                update(); 
            } catch(e) { 
                console.error("Mic Error", e); 
                setNote("ERR");
            } 
        }; 
        start(); 
        
        return () => { 
            if(raf) cancelAnimationFrame(raf); 
            if(source) source.disconnect(); 
            if(audioCtx.current) audioCtx.current.close(); 
            if(streamRef.current) streamRef.current.getTracks().forEach(t=>t.stop()); 
        };
    }, [isActive]);

    return { pitch, volume, note, confidence, volumeNormalized, stableNote, stability, calibrating, noiseFloor, isSinging };
};
