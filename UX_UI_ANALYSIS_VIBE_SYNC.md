# UX/UI Analysis: Vibe Sync Modes & TV Takeovers

## Executive Summary
Analysis of the Singer App and TV display's Vibe Sync modes reveals **several critical layout issues** where overlays can block the primary video content, text readability issues, and inconsistent z-index layering. This document provides specific recommendations for fixing layout blocking, improving element positioning, and ensuring primary content visibility.

---

## Overview of Vibe Sync Modes

The app supports **5 major vibe sync takeover modes** on both Singer (mobile) and TV (display):

1. **Storm** - Realistic lightning & rain effects
2. **Guitar** - Interactive strumming with guitar hero UI
3. **Strobe** - Beat drop tap interaction
4. **Banger** - Pulsing bass kick effects
5. **Ballad** - Flame effects with sway mode

Plus **Doodle-oke** which is a full-screen mode (separate from normal video).

---

## Critical Issues Found

### 🔴 ISSUE 1: TV STROBE MODE - Modal overlays completely block video

**Location**: [PublicTV.jsx#L1306-L1334](src/apps/TV/PublicTV.jsx#L1306-L1334)

**Problem**:
```jsx
{room?.lightMode === 'strobe' && (
    <div className="absolute inset-0 z-[160] pointer-events-none">
        <div className="absolute inset-0 vibe-strobe opacity-60 mix-blend-screen bg-white"></div>
        <div className="absolute inset-0 bg-gradient-to-b from-pink-500/25 via-transparent to-cyan-400/20"></div>
        
        {/* This top-10 section works fine */}
        <div className="absolute top-10 left-1/2 -translate-x-1/2 text-center">
            ...
        </div>
        
        {/* PROBLEM: Bottom area - leaders list spans entire width */}
        {strobePhase === 'active' && (
            <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex gap-3">
                {/* Max width cards here can overflow and block stage area */}
            </div>
        )}
    </div>
)}
```

**Impact**: 
- The white flashing strobe overlay (`vibe-strobe opacity-60`) creates a 60% opacity wash across entire screen
- Bottom leaderboard cards at `bottom-10` can extend into stage area
- No horizontal constraints on leader cards - they can spread across full width
- Stage area with performers becomes difficult to see during active phase

**Severity**: 🔴 HIGH - Obscures primary performance area

**Recommendation**:
```jsx
// FIXED VERSION
{room?.lightMode === 'strobe' && (
    <div className="absolute inset-0 z-[160] pointer-events-none">
        {/* Reduce opacity of strobe effect - make it 40% instead of 60% */}
        <div className="absolute inset-0 vibe-strobe opacity-40 mix-blend-screen bg-white"></div>
        <div className="absolute inset-0 bg-gradient-to-b from-pink-500/15 via-transparent to-cyan-400/10"></div>
        
        {strobePhase === 'active' && (
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-3 max-w-[85vw] overflow-x-auto px-4">
                {strobeLeaders.map((u, idx) => (
                    <div key={u.uid || idx} className="bg-black/60 border border-white/20 rounded-full px-4 py-2 text-white text-sm font-bold flex items-center gap-2 whitespace-nowrap flex-shrink-0">
                        <span className="text-xl">{u.avatar || EMOJI.sparkle}</span>
                        <span className="truncate max-w-[120px]">{u.name || 'Guest'}</span>
                        <span className="text-cyan-300 font-mono">{u.strobeTaps || 0}</span>
                    </div>
                ))}
            </div>
        )}
    </div>
)}
```

---

### 🟡 ISSUE 2: TV GUITAR MODE - Giant text overlay obscures stage

**Location**: [PublicTV.jsx#L1403-L1435](src/apps/TV/PublicTV.jsx#L1403-L1435)

**Problem**:
```jsx
{room?.lightMode === 'guitar' && (
    <>
        {/* These create a 3-layer dark background */}
        <div className="absolute inset-0 z-[80] pointer-events-none bg-gradient-to-b from-black via-black/90 to-red-900/70"></div>
        <div className="absolute inset-0 z-[81] pointer-events-none">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,59,120,0.25),transparent_55%)]"></div>
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom,rgba(255,140,0,0.2),transparent_60%)]"></div>
        </div>
        
        {/* PROBLEM: Giant 12rem text blocks entire center */}
        <div className="absolute inset-0 z-[85] pointer-events-none flex flex-col items-center justify-center">
            <div className="text-[12rem] font-bebas text-transparent bg-clip-text bg-gradient-to-t from-yellow-400 via-orange-500 to-red-600 drop-shadow-[0_0_30px_rgba(255,100,0,0.8)] animate-pulse">
                GUITAR SOLO!
            </div>
            
            {/* Leaderboard positioned at 30% of screen height - blocks performer area */}
            <div className="absolute inset-x-0 top-[30%] flex justify-center pointer-events-none">
                <div className="bg-black/60 border border-white/10 rounded-3xl px-8 py-6 backdrop-blur-md min-w-[60%]">
                    {/* Top Strummers cards */}
                </div>
            </div>
        </div>
    </>
)}
```

**Impact**:
- Text `GUITAR SOLO!` at 12rem (192px) takes up ~33% of vertical screen
- Top strummers leaderboard positioned at `top-[30%]` with `min-w-[60%]` blocks performers
- 3 dark overlays (z-80, z-81) combined darken stage too much - barely visible
- No safe area for video content

**Severity**: 🔴 HIGH - Destroys video visibility

**Recommendation**:
```jsx
{room?.lightMode === 'guitar' && (
    <>
        {/* Reduce dark overlay - make it more transparent so stage shows through */}
        <div className="absolute inset-0 z-[80] pointer-events-none bg-gradient-to-b from-black/60 via-black/70 to-red-900/50"></div>
        <div className="absolute inset-0 z-[81] pointer-events-none">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,59,120,0.15),transparent_55%)]"></div>
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom,rgba(255,140,0,0.1),transparent_60%)]"></div>
        </div>
        
        {/* Reposition elements: title at TOP not center, leaderboard at BOTTOM */}
        <div className="absolute inset-0 z-[85] pointer-events-none flex flex-col items-center justify-between py-8">
            {/* Move title to top - smaller size */}
            <div className="text-8xl font-bebas text-transparent bg-clip-text bg-gradient-to-t from-yellow-400 via-orange-500 to-red-600 drop-shadow-[0_0_30px_rgba(255,100,0,0.8)] animate-pulse">
                GUITAR SOLO!
            </div>
            
            {/* Move leaderboard to BOTTOM - out of performer area */}
            <div className="flex justify-center pointer-events-none">
                <div className="bg-black/60 border border-white/10 rounded-3xl px-8 py-6 backdrop-blur-md min-w-[60%] max-w-[80vw]">
                    {/* Top Strummers cards */}
                </div>
            </div>
        </div>
    </>
)}
```

---

### 🟡 ISSUE 3: TV BALLAD MODE - Multiple overlay layers reduce visibility

**Location**: [PublicTV.jsx#L1363-L1401](src/apps/TV/PublicTV.jsx#L1363-L1401)

**Problem**:
```jsx
{room?.lightMode === 'ballad' && (
    <div className="absolute inset-0 z-[200] pointer-events-none overflow-hidden">
        {/* Layer 1: Haze */}
        <div className="absolute inset-0 ballad-haze"></div>
        
        {/* Layer 2: Glow */}
        <div className="absolute inset-x-0 bottom-0 h-[75%] ballad-glow"></div>
        
        {/* Layer 3: Fire overlay at opacity-90 - VERY opaque! */}
        <div className="absolute inset-0 fire-overlay opacity-90"></div>
        
        {/* Layer 4-15: 12 fire particle emojis spawning everywhere */}
        {[...Array(12)].map((_, i) => (
            <div
                key={`ballad-fire-${i}`}
                className="fire-particle"
                style={{...}}
            >
                {EMOJI.fire}
            </div>
        ))}
        
        {/* Layer 16: Orbs */}
        {balladLights.map((light, idx) => (
            <div className="absolute ballad-orb" style={{...}} ></div>
        ))}
    </div>
)}
```

**Impact**:
- Z-index is `200` - VERY high, sits above stage
- `fire-overlay opacity-90` creates near-opaque particle container
- 12 fire emojis + animated orbs create visual clutter
- Combined with `ballad-haze` and `ballad-glow`, stage is significantly darkened
- No content safety areas defined

**Severity**: 🟡 MEDIUM - Stage visible but heavily obscured

**CSS Issues** ([index.css#L345-370](src/index.css#L345-L370)):
```css
.ballad-haze {
    /* No definition in CSS - defaults to invisible, but conceptually should be a glow */
}
.fire-overlay {
    position: absolute;
    bottom: 0;
    width: 100%;
    height: 100%;
    /* opacity-90 makes this VERY visible */
}
```

**Recommendation**:
```jsx
{room?.lightMode === 'ballad' && (
    <div className="absolute inset-0 z-[140] pointer-events-none overflow-hidden">
        {/* Reduce z-index from 200 to 140 - let stage show through more */}
        
        {/* Layer 1: Very subtle haze */}
        <div className="absolute inset-0 ballad-haze opacity-30"></div>
        
        {/* Layer 2: Only bottom 40% glow instead of 75% */}
        <div className="absolute inset-x-0 bottom-0 h-[40%] ballad-glow opacity-60"></div>
        
        {/* Layer 3: Fire overlay - reduce opacity from 90 to 40 */}
        <div className="absolute inset-0 fire-overlay opacity-40"></div>
        
        {/* Reduce particle count from 12 to 6 */}
        {[...Array(6)].map((_, i) => (
            <div
                key={`ballad-fire-${i}`}
                className="fire-particle"
                style={{
                    left: `${Math.random() * 100}%`,
                    animationDelay: `${Math.random() * 2.5}s`,
                    animationDuration: `${1.8 + Math.random() * 1.6}s`,
                    fontSize: '2rem', // Reduced from 3rem
                    opacity: 0.6 // Reduced from 0.85
                }}
            >
                {EMOJI.fire}
            </div>
        ))}
        
        {/* Orbs - keep but reduce count/opacity */}
        {balladLights.slice(0, 4).map((light, idx) => (
            <div
                key={idx}
                className="absolute ballad-orb"
                style={{
                    ...light,
                    '--orb-alpha': Math.min(light.opacity, 0.5)
                }}
            ></div>
        ))}
    </div>
)}
```

---

### 🟡 ISSUE 4: TV STORM MODE - Overlay too opaque

**Location**: [PublicTV.jsx#L1340-L1349](src/apps/TV/PublicTV.jsx#L1340-L1349)

**Problem**:
```jsx
{room?.lightMode === 'storm' && (
    <div className={`absolute inset-0 z-[140] pointer-events-none storm-overlay storm-phase-${stormPhase}`}>
        <div className="absolute inset-0 storm-clouds mix-blend-multiply"></div>
        {/* Lightning flashes - infrequent but when they hit, very bright */}
        <div className="absolute inset-0 vibe-lightning mix-blend-screen"></div>
        <div className="rain"></div>
        <div className={`absolute inset-0 storm-flash ${stormFlash ? 'storm-flash-active' : ''}`}></div>
        <div className="absolute inset-0 storm-glow mix-blend-screen"></div>
    </div>
)}
```

**Impact** (from CSS):
```css
.storm-overlay,
.storm-screen { background: radial-gradient(circle at 50% 20%, rgba(148,163,184,0.25), rgba(15,23,42,0.85)); }
.storm-glow { background: radial-gradient(circle at 50% 30%, rgba(56,189,248,0.25), transparent 60%); opacity: 0.6; }
```

- `rgba(15,23,42,0.85)` on storm-overlay = 85% opacity bottom darkening - stage barely visible
- `storm-glow opacity: 0.6` adds another layer of opacity
- Rain at `opacity: 0.7` (approach phase) adds more obscuring
- Multiple mix-blend modes (multiply, screen) compound the darkening effect

**Severity**: 🟡 MEDIUM-HIGH - Stage significantly darkened

**Recommendation**:
```css
/* In index.css - update storm-overlay styles */
.storm-overlay,
.storm-screen { 
    background: radial-gradient(circle at 50% 20%, rgba(148,163,184,0.15), rgba(15,23,42,0.5)); 
    /* Reduced from 0.25/0.85 to 0.15/0.5 */
}

.storm-glow { 
    background: radial-gradient(circle at 50% 30%, rgba(56,189,248,0.2), transparent 60%); 
    opacity: 0.4; /* Reduced from 0.6 */
}

/* Keep approach/peak/pass/clear phases but reduce their opacity */
.storm-phase-approach .vibe-lightning { opacity: 0.2; } /* was 0.3 */
.storm-phase-peak .vibe-lightning { opacity: 0.7; } /* was 0.9 */
.storm-phase-pass .vibe-lightning { opacity: 0.2; } /* was 0.25 */
.storm-phase-clear .vibe-lightning { opacity: 0.1; } /* was 0.12 */
```

---

### 🟡 ISSUE 5: SINGER APP - Strobe mode text hard to read

**Location**: [SingerApp.jsx#L2548-L2600](src/apps/Mobile/SingerApp.jsx#L2548-L2600)

**Problem**:
```jsx
if (room?.lightMode === 'strobe') {
    return (
        <div className="h-screen w-full vibe-strobe flex flex-col items-center justify-center text-black relative overflow-hidden">
            <div className="absolute inset-0 bg-white/60 mix-blend-screen"></div>
            {/* Text color is BLACK but background is white/60 - low contrast during strobe animation */}
            <div className="relative z-10 w-full max-w-sm px-6 text-center">
                <div className="text-7xl font-black">{countdown || 0}</div>
                <div className="text-sm font-bold mb-4">Keep the crowd meter alive</div>
                <button onClick={handleBeatTap} className="w-56 h-56 rounded-full bg-black text-white ...">
                    TAP
                </button>
            </div>
        </div>
    );
}
```

**Impact**:
- Text is black with white/60 background + strobe animation = flickering text
- Countdown number hard to read during rapid strobe
- "TAP" button gets lost in white glare

**Severity**: 🟡 MEDIUM - Readability issue

**Recommendation**:
```jsx
if (room?.lightMode === 'strobe') {
    return (
        <div className="h-screen w-full vibe-strobe flex flex-col items-center justify-center text-white relative overflow-hidden">
            {/* Reduce background opacity and add text shadow */}
            <div className="absolute inset-0 bg-white/40 mix-blend-screen"></div>
            <div className="relative z-10 w-full max-w-sm px-6 text-center">
                <div className="text-7xl font-black drop-shadow-[0_0_20px_rgba(0,0,0,0.8)]">{countdown || 0}</div>
                <div className="text-sm font-bold mb-4 drop-shadow-lg">Keep the crowd meter alive</div>
                <button onClick={handleBeatTap} className="w-56 h-56 rounded-full bg-black text-white border-4 border-cyan-400 drop-shadow-2xl ...">
                    TAP
                </button>
            </div>
        </div>
    );
}
```

---

### 🟡 ISSUE 6: TV MAIN STAGE - Z-index layering confusion

**Location**: [PublicTV.jsx#L1440-L1490](src/apps/TV/PublicTV.jsx#L1440-L1490)

**Problem**:
The stage area has complex nested z-indices:
```jsx
<div className={`relative z-10 h-full grid grid-cols-12 gap-6 p-4 md:p-6 ...`}>
    {/* STAGE AREA */}
    <div className={`${isCinema ? 'col-span-12' : 'col-span-8'} flex flex-col transition-all duration-500`}>
        <div className={`flex-1 ... min-h-[50vh]`}>
            {/* Content here at z-10 */}
        </div>
    </div>
</div>
```

While overlays are at:
- `z-[80]` - Storm gradient
- `z-[85]` - Guitar UI
- `z-[140]` - Storm overlay
- `z-[160]` - Strobe overlay
- `z-[200]` - Ballad overlay

**Impact**:
- Stage area at `z-10` can be hidden by overlays at higher z-indices
- Overlays are positioned `absolute inset-0` which covers everything
- No safe area for video content that overlays respect
- Text in overlays uses `pointer-events-none` but takes visual space anyway

**Severity**: 🟡 MEDIUM - Architectural issue

**Recommendation**:
Create a **safe zone system**:
```jsx
// Define safe areas as a const
const VIBE_SAFE_ZONES = {
    strobe: {
        topArea: 'top-0 left-0 right-0 h-[12%]', // For title
        bottomArea: 'bottom-0 left-0 right-0 h-[15%]', // For leaderboard
        stageArea: 'top-[12%] left-0 right-0 bottom-[15%]' // Protected
    },
    guitar: {
        topArea: 'top-0 left-0 right-0 h-[18%]', // For "GUITAR SOLO!" title
        bottomArea: 'bottom-0 left-0 right-0 h-[20%]', // For leaderboard
        stageArea: 'top-[18%] left-0 right-0 bottom-[20%]' // Protected
    },
    storm: {
        topArea: 'top-0 left-0 right-0 h-[10%]',
        stageArea: 'top-[10%] left-0 right-0 bottom-0 opacity-80' // Slight darkening ok
    },
    ballad: {
        topArea: 'top-0 left-0 right-0 h-[15%]',
        bottomArea: 'bottom-0 left-0 right-0 h-[10%]',
        stageArea: 'top-[15%] left-0 right-0 bottom-[10%] opacity-75'
    }
};
```

---

## Layout Analysis: Current Grid

### TV Display (Normal Mode)
```
┌─────────────────────────────────────────────────────────────┐
│ LOGO (top-8 left-8, z-50)                                   │
├──────────────────────┬────────────────────────────────────────┤
│                      │  QR CODE + RULES                       │
│   STAGE AREA         │  (col-span-4)                          │
│   (col-span-8)       │                                        │
│   - Lyrics/Video     │  SPOTLIGHT                             │
│   - HypeBar top-12   │  (if active)                          │
│   - Points top-right │                                        │
│                      │  UP NEXT / QUEUE                       │
│                      │  (flex-1 scrollable)                   │
└──────────────────────┴────────────────────────────────────────┘
```

### During Strobe Takeover (CURRENT - PROBLEMATIC)
```
┌─────────────────────────────────────────────────────────────┐
│ ▓▓▓▓▓▓▓▓▓ STROBE OVERLAY z-[160] - 60% opacity ▓▓▓▓▓▓▓▓▓▓▓  │
│ ▓                                                            ▓
│ ▓    "TAP THE BEAT" (top-10)                               ▓
│ ▓                                                            ▓
│ ▓    TIMER + PROGRESS BAR (center)  ← BLOCKS STAGE        ▓
│ ▓                                                            ▓
│ ▓    [Player1] [Player2] [Player3]  ← BLOCKS BOTTOM       ▓
│ ▓                                                            ▓
│ └─────────────────────────────────────────────────────────── ▓
│   ▓ Stage content completely hidden by strobe wash          ▓
└─────────────────────────────────────────────────────────────┘
```

### Recommended Layout (FIXED)
```
┌─────────────────────────────────────────────────────────────┐
│ ▓ STROBE OVERLAY z-[160] - 40% opacity ▓                   │
│ ▓ "TAP THE BEAT"                      ▓                    │
│ ├──────────────────────────────────────┤                    │
│ │  STAGE AREA - NOW VISIBLE!          │                   │
│ │  - Can see performers singing       │                   │
│ │  - Hype bar visible at top          │                   │
│ │  - Points counter visible at right  │                   │
│ │  - All essential info readable      │                   │
│ ├──────────────────────────────────────┤                    │
│ ▓ [Player1] [Player2] [Player3]      ▓                    │
│ └──────────────────────────────────────┘                    │
```

---

## Recommendations Summary

### Priority 1: CRITICAL (Fix ASAP)
1. **Strobe overlay** - Reduce opacity from 60% to 40%, constrain leaderboard width
2. **Guitar overlay** - Darken background too much, reposition title/leaderboard to top/bottom
3. **Ballad overlay** - Too many particles and overlays, reduce z-index and opacity

### Priority 2: IMPORTANT (Fix soon)
1. **Storm overlay** - Reduce bottom darkening gradient
2. **Singer app strobe** - Add text shadows, reduce background opacity
3. **Z-index architecture** - Define safe zones for video content

### Priority 3: NICE-TO-HAVE (Polish)
1. Add subtle safe area guides during development mode
2. Create responsive sizing for elements based on screen size
3. Add option to toggle effect intensity (guest mode vs performance mode)

---

## Specific Code Changes

### Change 1: Update TV Strobe Overlay [PublicTV.jsx]
```diff
  {room?.lightMode === 'strobe' && (
-     <div className="absolute inset-0 z-[160] pointer-events-none">
-         <div className="absolute inset-0 vibe-strobe opacity-60 mix-blend-screen bg-white"></div>
-         <div className="absolute inset-0 bg-gradient-to-b from-pink-500/25 via-transparent to-cyan-400/20"></div>
+     <div className="absolute inset-0 z-[160] pointer-events-none">
+         <div className="absolute inset-0 vibe-strobe opacity-40 mix-blend-screen bg-white"></div>
+         <div className="absolute inset-0 bg-gradient-to-b from-pink-500/15 via-transparent to-cyan-400/10"></div>
```

### Change 2: Update TV Guitar Overlay [PublicTV.jsx]
```diff
  {room?.lightMode === 'guitar' && (
      <>
-         <div className="absolute inset-0 z-[80] pointer-events-none bg-gradient-to-b from-black via-black/90 to-red-900/70"></div>
+         <div className="absolute inset-0 z-[80] pointer-events-none bg-gradient-to-b from-black/60 via-black/70 to-red-900/50"></div>
          
-         <div className="text-[12rem] font-bebas ...">GUITAR SOLO!</div>
+         <div className="text-8xl font-bebas ...">GUITAR SOLO!</div>
```

### Change 3: Update TV Ballad Overlay [PublicTV.jsx]
```diff
  {room?.lightMode === 'ballad' && (
-     <div className="absolute inset-0 z-[200] pointer-events-none overflow-hidden">
+     <div className="absolute inset-0 z-[140] pointer-events-none overflow-hidden">
          <div className="absolute inset-0 ballad-haze"></div>
-         <div className="absolute inset-x-0 bottom-0 h-[75%] ballad-glow"></div>
-         <div className="absolute inset-0 fire-overlay opacity-90"></div>
-         {[...Array(12)].map((_, i) => (
+         <div className="absolute inset-x-0 bottom-0 h-[40%] ballad-glow opacity-60"></div>
+         <div className="absolute inset-0 fire-overlay opacity-40"></div>
+         {[...Array(6)].map((_, i) => (
```

### Change 4: Update CSS Storm Overlays [index.css]
```diff
  .storm-overlay,
- .storm-screen { background: radial-gradient(circle at 50% 20%, rgba(148,163,184,0.25), rgba(15,23,42,0.85)); }
+ .storm-screen { background: radial-gradient(circle at 50% 20%, rgba(148,163,184,0.15), rgba(15,23,42,0.5)); }
  
- .storm-glow { background: radial-gradient(circle at 50% 30%, rgba(56,189,248,0.25), transparent 60%); opacity: 0.6; }
+ .storm-glow { background: radial-gradient(circle at 50% 30%, rgba(56,189,248,0.2), transparent 60%); opacity: 0.4; }
```

---

## Testing Recommendations

After making changes, test on:

1. **TV Display** (16:9 landscape)
   - [ ] All 5 vibe modes
   - [ ] With various queue lengths
   - [ ] With spotlight active
   - [ ] With minimal UI mode
   - [ ] With cinema mode

2. **Singer App** (Mobile portrait 9:16)
   - [ ] Strobe mode countdown readability
   - [ ] Guitar mode button visibility
   - [ ] Storm mode text contrast
   - [ ] Ballad mode particle distractibility

3. **Edge Cases**
   - [ ] Large screens (4K TVs)
   - [ ] Small phones (iPhone SE)
   - [ ] Rotating between modes quickly
   - [ ] With/without sidebar (cinema toggle)

---

## Performance Considerations

**Current Issues**:
- 12 fire particles animating simultaneously in ballad mode = expensive
- Multiple mix-blend-mode layers create GPU load
- Lightning animations on 5s loop = constant animation
- Strobe at 0.18s animation = very CPU intensive

**Optimizations**:
1. Reduce particle counts as proposed (12 → 6 for ballad, etc.)
2. Use `will-change: transform` on animated elements
3. Consider using `requestAnimationFrame` instead of CSS animations for vibe effects
4. Add GPU acceleration hints: `transform: translateZ(0)`

---

## Accessibility Concerns

⚠️ **Issues Found**:
- Strobe effect can trigger photosensitive epilepsy - add warning
- Text contrast during overlays may not meet WCAG AA standards
- No pause/reduce motion option for vibe sync
- Fire/lightning animations too intense for some users

**Recommendations**:
```jsx
// Add to vibe sync headers
<div className="text-xs text-yellow-300 bg-black/70 px-3 py-1 rounded-full border border-yellow-400/50">
    ⚠️ Strobe effect - may affect sensitivity
</div>

// Add prefers-reduced-motion support
@media (prefers-reduced-motion: reduce) {
    .vibe-strobe { animation: none; opacity: 0.1; }
    .fire-particle { animation: none; opacity: 0.3; }
    .ballad-orb { animation: none; }
}
```

---

## Summary

The Vibe Sync modes create exciting, immersive experiences but currently suffer from:
- **Heavy overlay opacity** blocking primary content
- **Poor positioning** of UI elements (top-center blocking stage)
- **Too many visual effects** adding clutter
- **Z-index conflicts** between overlays and stage content

All issues are **fixable** with the adjustments outlined above. Most changes are **CSS tweaks** and **opacity reductions** - no major architectural changes needed.

**Estimated effort**: 2-3 hours to implement all changes + 1 hour testing.
