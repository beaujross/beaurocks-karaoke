#!/usr/bin/env node

/**
 * Quick Reference: Profiling Your Karaoke App
 * 
 * Copy-paste these commands into your browser console
 */

// ============================================
// STEP 1: Enable Profiling
// ============================================
window.ENABLE_PROFILING = true;
console.log('✅ Profiling enabled! Reports every 5 seconds.');


// ============================================
// STEP 2: Play a Game
// ============================================
// 1. Join as Singer
// 2. Choose Flappy Bird or Vocal Challenge
// 3. Play for 30+ seconds
// 4. Check console for reports


// ============================================
// STEP 3: Read the Report
// ============================================
// Expected output (every 5 seconds):
/*
📊 [FlappyBird] Performance Report
FPS: 298/300 (expected 300 for 60fps over 5s)
Frames: 50

Game Loop: avg=12.45ms, max=18.92ms, min=8.34ms (300 samples)
Firebase Sync: avg=87.23ms, max=156.45ms, min=45.12ms (26 calls)
Voice Process: avg=2.34ms, max=5.67ms, min=0.89ms (300 samples)
Collision Detection: avg=0.45ms, max=1.23ms, min=0.12ms (300 samples)

💡 Tip: Set window.ENABLE_PROFILING=false to disable profiler
*/


// ============================================
// STEP 4: Interpret Results
// ============================================
// Game Loop:        Should be < 16.67ms (60fps)
// Firebase Sync:    Should be < 150ms
// Voice Process:    Should be < 5ms
// Collision Det:    Should be < 1ms
// FPS:              Should be 295+ / 300


// ============================================
// STEP 5: Disable Profiling
// ============================================
window.ENABLE_PROFILING = false;
console.log('✅ Profiling disabled!');


// ============================================
// ADVANCED: One-Line Commands
// ============================================

// Profile Flappy for 1 min, then auto-disable
setTimeout(() => { window.ENABLE_PROFILING = true; }, 100);
setTimeout(() => { window.ENABLE_PROFILING = false; console.log('Done!'); }, 60000);

// Check memory usage
console.log('Memory:', (performance.memory.usedJSHeapSize / 1048576).toFixed(2), 'MB');

// Watch for memory growth
setInterval(() => console.log('Mem:', (performance.memory.usedJSHeapSize / 1048576).toFixed(2), 'MB'), 5000);


// ============================================
// TROUBLESHOOTING
// ============================================

// Q: No profiling output?
// A: Make sure you launched a game and it's PLAYING (not ready/gameover)

// Q: Profiling disabled but still seeing output?
// A: Profiles report every 5s, wait for next interval

// Q: Want to test spectator mode?
// A: Open game in 2 windows - singer + TV. TV should have no game loop metrics

// Q: Game feels slow - which metric is bad?
// A: Check this order: Game Loop → Firebase Sync → Voice Process

// Q: Want to test network throttling?
// A: DevTools → Network → Throttle to "Slow 3G" → check Firebase Sync times
