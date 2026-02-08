import { useEffect, useRef } from 'react';

const AudioVisualizer = ({ onVolume, isActive, externalCtx, mode = 'waveform', className = '' }) => {
    const canvasRef = useRef(null); 
    const onVolumeRef = useRef(onVolume);
    const modeRef = useRef(mode);
    const phaseRef = useRef(0);
    
    useEffect(() => { onVolumeRef.current = onVolume; }, [onVolume]);
    useEffect(() => { modeRef.current = mode; }, [mode]);
    
    useEffect(() => { 
        if(!isActive || !externalCtx) return; 
        
        let animationFrame;
        let analyser;
        let source;
        let stream;
        let dataArray;

        const init = async () => { 
            try { 
                if (externalCtx.state === 'suspended') {
                    await externalCtx.resume();
                }

                stream = await navigator.mediaDevices.getUserMedia({ audio: true }); 
                
                analyser = externalCtx.createAnalyser(); 
                analyser.fftSize = 256; 
                
                source = externalCtx.createMediaStreamSource(stream); 
                source.connect(analyser); 
                
                dataArray = new Uint8Array(analyser.frequencyBinCount); 
                
                const canvas = canvasRef.current; 
                const ctx = canvas ? canvas.getContext('2d') : null; 
                
                const render = () => { 
                    if (!canvasRef.current) return;
                    
                    analyser.getByteFrequencyData(dataArray); 
                    phaseRef.current += 0.015;
                    
                    let sum = 0; 
                    for(let i=0; i<dataArray.length; i++) sum += dataArray[i]; 
                    const avg = sum / dataArray.length;

                    if (onVolumeRef.current) onVolumeRef.current(avg); 
                    
                    if (ctx) {
                        const width = canvas.width; 
                        const height = canvas.height; 
                        const centerY = height / 2;
                        ctx.clearRect(0, 0, width, height);

                        const gradient = ctx.createLinearGradient(0, 0, width, 0);
                        gradient.addColorStop(0, '#ec4899'); 
                        gradient.addColorStop(0.5, '#00C4D9'); 
                        gradient.addColorStop(1, '#ec4899');

                        const bars = 72; 
                        const barWidth = width / bars; 

                        const drawWaveform = () => {
                            ctx.strokeStyle = gradient; 
                            ctx.lineWidth = 4; 
                            ctx.lineCap = 'round'; 
                            ctx.shadowBlur = 10; 
                            ctx.shadowColor = '#00C4D9';
                            ctx.beginPath(); 
                            
                            let x = 0;
                            for(let i = 0; i < bars; i++) {
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
                            for (let i = 0; i <= bars; i++) {
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
                            for (let i = 0; i <= bars; i++) {
                                const index = Math.floor(i * (dataArray.length / bars));
                                const val = dataArray[index] / 255.0;
                                const amp = val * height * 0.45;
                                const wave = Math.cos(i * 0.3 + phase * 1.4) * (height * 0.06);
                                const y = centerY + wave + amp * 0.3;
                                ctx.lineTo(i * barWidth, y);
                            }
                            ctx.strokeStyle = '#00C4D9';
                            ctx.lineWidth = 3;
                            ctx.shadowBlur = 14;
                            ctx.shadowColor = '#00C4D9';
                            ctx.stroke();
                            ctx.shadowBlur = 0;
                        };

                        const drawRings = () => {
                            const phase = phaseRef.current;
                            const base = Math.min(width, height) * 0.18;
                            ctx.translate(width / 2, height / 2);
                            for (let r = 0; r < 6; r++) {
                                const index = Math.floor((r / 6) * dataArray.length);
                                const val = dataArray[index] / 255.0;
                                const radius = base + r * 32 + val * 40;
                                ctx.beginPath();
                                ctx.strokeStyle = r % 2 === 0 ? '#00C4D9' : '#ec4899';
                                ctx.lineWidth = 6 - r * 0.6;
                                ctx.globalAlpha = 0.7 - r * 0.08;
                                ctx.shadowBlur = 20;
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
                            ctx.shadowBlur = 12;
                            ctx.shadowColor = '#ec4899';
                            for (let i = 0; i <= bars; i++) {
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

                        const activeMode = modeRef.current || 'waveform';
                        if (activeMode === 'ribbon') {
                            drawRibbon();
                        } else if (activeMode === 'rings') {
                            drawRings();
                        } else if (activeMode === 'spark') {
                            drawSparkline();
                        } else {
                            drawWaveform();
                        }
                    }
                    
                    animationFrame = requestAnimationFrame(render); 
                }; 
                render(); 
            } catch (e) { 
                console.error("Visualizer Init Error:", e);
            } 
        }; 
        
        init(); 
        
        return () => { 
            if (animationFrame) cancelAnimationFrame(animationFrame); 
            if (source) source.disconnect();
            if (stream) stream.getTracks().forEach(t => t.stop()); 
        }; 
    }, [isActive, externalCtx]);
    
    return <canvas ref={canvasRef} width={800} height={300} className={className || "w-full h-full opacity-90 mix-blend-screen"} />;
};

export default AudioVisualizer;
