// Active SFX registry
const activeSounds = [];
let sfxMasterVolume = 0.5;

export const setSfxMasterVolume = (volume = 0.5) => {
    sfxMasterVolume = Math.max(0, Math.min(1, volume));
    activeSounds.forEach(audio => {
        audio.volume = sfxMasterVolume;
    });
};

export const playSfx = (url, volume = null) => { 
    try { 
        const a = new Audio(url); 
        const finalVolume = volume === null || volume === undefined ? sfxMasterVolume : volume;
        a.volume = Math.max(0, Math.min(1, finalVolume));
        
        // Track the sound
        activeSounds.push(a);
        
        // Clean up when done
        a.onended = () => {
            const index = activeSounds.indexOf(a);
            if (index > -1) activeSounds.splice(index, 1);
        };

        a.play().catch(e => console.warn("SFX Play Error (Autoplay blocked?):", e)); 
    } catch(e) {
        console.error("Audio Error:", e);
    } 
};

export const stopAllSfx = () => {
    activeSounds.forEach(audio => {
        audio.pause();
        audio.currentTime = 0;
    });
    activeSounds.length = 0; // Clear array
};

export const shuffleArray = (array) => {
    const newArr = [...array];
    for (let i = newArr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
    }
    return newArr;
};

export const averageBand = (data, startHz, endHz, sampleRate) => {
    if (!data || !data.length || !sampleRate) return 0;
    const nyquist = sampleRate / 2;
    const startIdx = Math.max(0, Math.floor((startHz / nyquist) * data.length));
    const endIdx = Math.min(data.length, Math.ceil((endHz / nyquist) * data.length));
    if (endIdx <= startIdx) return 0;
    let sum = 0;
    for (let i = startIdx; i < endIdx; i += 1) sum += data[i];
    return sum / (endIdx - startIdx);
};

// Formatting helpers
export const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
};
