# Performance Profiling Guide

## Quick Start

### Enable Profiling
In your browser console, run:
```javascript
window.ENABLE_PROFILING = true
```

### Play a Game
- Join as a singer
- Play Flappy Bird or Vocal Challenge for at least 30 seconds
- Wait for profiling reports in the console (every 5 seconds)

### Disable Profiling
```javascript
window.ENABLE_PROFILING = false
```

---

## What You'll See

Every 5 seconds, you'll get a report like:

```
📊 [FlappyBird] Performance Report
FPS: 298/300 (expected 300 for 60fps over 5s)
Frames: 50

Game Loop: avg=12.45ms, max=18.92ms, min=8.34ms (300 samples)
Firebase Sync: avg=87.23ms, max=156.45ms, min=45.12ms (26 calls)
Voice Process: avg=2.34ms, max=5.67ms, min=0.89ms (300 samples)
Collision Detection: avg=0.45ms, max=1.23ms, min=0.12ms (300 samples)

💡 Tip: Set window.ENABLE_PROFILING=false to disable profiler
```

---

## Understanding the Metrics

### **FPS Counter**
- **Target**: 300/300 over 5 seconds = 60fps
- **Good**: 295+/300 (only dropped 1-2 frames)
- **Bad**: <280/300 (dropping lots of frames = laggy gameplay)

### **Game Loop**
- **What**: Time for each frame calculation
- **Target**: <16.67ms per frame (60fps threshold)
- **Red Flag**: max > 33ms (dropping frames)
- **Likely causes**: Too many obstacles, inefficient collision detection

### **Firebase Sync**
- **What**: Time to upload game state
- **Target**: <150ms per sync
- **Red Flag**: max > 300ms (network hanging)
- **Likely causes**: Network latency, batching multiple writes

### **Voice Process**
- **What**: Time to process pitch data from microphone
- **Target**: <5ms per frame
- **Red Flag**: avg > 10ms (audio lag)
- **Likely causes**: Complex audio analysis, or hardware limitation

### **Collision Detection**
- **What**: Time to check coin/obstacle hits
- **Target**: <1ms per frame
- **Red Flag**: max > 5ms (too many colliders)
- **Likely causes**: O(n²) comparisons, large array sizes

---

## Profiling Scenarios

### **Scenario 1: Check Initial Load**
```javascript
window.ENABLE_PROFILING = true
// Launch Flappy Bird, immediately check first report
// Look for: High voice process time = audio processing bottleneck
```

### **Scenario 2: Check Mid-Game Performance**
```javascript
window.ENABLE_PROFILING = true
// Play for 1 minute
// Check if game loop time increases over time = memory leak or object buildup
```

### **Scenario 3: Check Network Latency**
```javascript
// Open DevTools → Network tab
// Throttle to "Slow 3G"
window.ENABLE_PROFILING = true
// Play game, check Firebase Sync times
// If max Firebase Sync > 500ms, network is the bottleneck
```

### **Scenario 4: Check Spectator Performance**
```javascript
// Join as different user, set to spectator
window.ENABLE_PROFILING = true
// Should see NO game loop (spectator doesn't run physics)
// Should see only Firebase reads (onSnapshot calls)
```

---

## Interpreting Results

### **Fast Game, Slow Network**
```
Game Loop: avg=8ms, max=14ms ✅
Firebase Sync: avg=150ms, max=400ms ❌
```
**Action**: Reduce sync frequency (200ms → 300ms) or batch updates

### **Slow Game, Fast Network**
```
Game Loop: avg=22ms, max=35ms ❌
Firebase Sync: avg=50ms, max=120ms ✅
```
**Action**: Optimize collision detection, reduce objects, or extract game logic

### **Audio Lag**
```
Voice Process: avg=8ms, max=15ms ❌
```
**Action**: Move audio analysis to Web Worker or reduce sample size

### **Memory Growing**
```
Game Loop avg slowly increases: 10ms → 18ms → 25ms
```
**Action**: Memory leak - check for unmounted event listeners, refs not cleared

---

## Real Examples & Fixes

### **Example 1: Too Many Coins Collected**
```
Collision Detection: avg=0.45ms, max=45.23ms ❌
```
**Problem**: Array grows without limit
**Fix**: Cap coins/obstacles array to max 50 items
```javascript
if (itemsRef.current.length > 50) {
  itemsRef.current = itemsRef.current.slice(-50);
}
```

### **Example 2: Firebase Sync Blocking**
```
Firebase Sync: avg=120ms, max=400ms ❌
```
**Problem**: Multiple `updateDoc()` calls
**Fix**: Use `writeBatch()` to group updates

### **Example 3: Voice Processing Slow**
```
Voice Process: avg=12ms, max=18ms ❌
```
**Problem**: FFT analysis on main thread
**Fix**: Move to Web Worker (advanced)

---

## Tips for Best Results

1. **Close other tabs** - they affect performance
2. **Clear browser cache** - old code can interfere
3. **Test on mobile** - mobile is the real stress test
4. **Multiple runs** - run 3 times, results vary slightly
5. **Disable extensions** - ad blockers, debuggers affect results

---

## Console Commands

Quick helpers:
```javascript
// Check current profiler status
window.ENABLE_PROFILING

// Quick performance check
performance.now() // Current time in ms

// Check memory usage (Chrome only)
performance.memory.usedJSHeapSize / 1048576 // MB

// List all marks/measures
performance.getEntriesByType('measure')
```

---

## File Locations

- Profiler: [src/lib/profiler.js](src/lib/profiler.js)
- Flappy Bird: [src/games/FlappyBird/Game.jsx](src/games/FlappyBird/Game.jsx)
- Vocal Challenge: [src/games/VocalChallenge/Game.jsx](src/games/VocalChallenge/Game.jsx)

---

## Next Steps After Profiling

1. **Identify the slowest metric** (which one is the worst?)
2. **Find the root cause** (game logic? Firebase? Voice?)
3. **Implement fix** (optimize code? batch writes? reduce objects?)
4. **Re-profile** (does it improve?)
5. **Repeat** until FPS consistent at 60

Good luck! 🚀
