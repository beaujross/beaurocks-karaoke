/**
 * Performance Profiler
 * Tracks metrics for game performance analysis
 * 
 * Enable with: window.ENABLE_PROFILING = true in console
 */

const ENABLE_PROFILING = typeof window !== 'undefined' && window.ENABLE_PROFILING === true;

class GameProfiler {
  constructor(gameName) {
    this.gameName = gameName;
    this.metrics = {
      loopCount: 0,
      loopTimes: [],
      firebaseSyncTimes: [],
      renderTimes: [],
      voiceProcessTimes: [],
      collisionDetectionTimes: []
    };
    this.lastReportTime = Date.now();
    this.frameCount = 0;
    this.droppedFrames = 0;
  }

  markStart(label) {
    if (!ENABLE_PROFILING) return null;
    return {
      label,
      startTime: performance.now(),
      startMark: `${this.gameName}-${label}-start`,
      endMark: `${this.gameName}-${label}-end`
    };
  }

  markEnd(mark) {
    if (!ENABLE_PROFILING || !mark) return;
    const duration = performance.now() - mark.startTime;
    
    // Store metric
    if (this.metrics[`${mark.label}Times`]) {
      this.metrics[`${mark.label}Times`].push(duration);
      // Keep only last 300 samples to avoid memory buildup
      if (this.metrics[`${mark.label}Times`].length > 300) {
        this.metrics[`${mark.label}Times`].shift();
      }
    }

    // Warn if slow
    const thresholds = {
      gameLoop: 16.67, // 60fps
      firebaseSync: 100,
      voiceProcess: 20,
      collisionDetection: 10,
      render: 16.67
    };

    if (duration > (thresholds[mark.label] || 50)) {
      console.warn(`⚠️ [${this.gameName}] ${mark.label} slow: ${duration.toFixed(2)}ms`);
    }
  }

  trackFrameComplete() {
    if (!ENABLE_PROFILING) return;
    this.frameCount++;
    this.metrics.loopCount++;

    // Report every 5 seconds
    const now = Date.now();
    if (now - this.lastReportTime > 5000) {
      this.report();
      this.lastReportTime = now;
    }
  }

  report() {
    if (!ENABLE_PROFILING) return;

    const calc = (arr) => {
      if (arr.length === 0) return { avg: 0, max: 0, min: 0 };
      const sum = arr.reduce((a, b) => a + b, 0);
      return {
        avg: (sum / arr.length).toFixed(2),
        max: Math.max(...arr).toFixed(2),
        min: Math.min(...arr).toFixed(2),
        count: arr.length
      };
    };

    const fps = this.frameCount * 5; // Count per second
    console.group(`📊 [${this.gameName}] Performance Report`);
    console.log(`FPS: ${fps}/300 (expected 300 for 60fps over 5s)`);
    console.log(`Frames: ${this.frameCount}`);
    
    if (this.metrics.loopTimes.length > 0) {
      const loopStats = calc(this.metrics.loopTimes);
      console.log(`Game Loop: avg=${loopStats.avg}ms, max=${loopStats.max}ms, min=${loopStats.min}ms (${loopStats.count} samples)`);
    }
    
    if (this.metrics.firebaseSyncTimes.length > 0) {
      const syncStats = calc(this.metrics.firebaseSyncTimes);
      console.log(`Firebase Sync: avg=${syncStats.avg}ms, max=${syncStats.max}ms, min=${syncStats.min}ms (${syncStats.count} calls)`);
    }
    
    if (this.metrics.voiceProcessTimes.length > 0) {
      const voiceStats = calc(this.metrics.voiceProcessTimes);
      console.log(`Voice Process: avg=${voiceStats.avg}ms, max=${voiceStats.max}ms, min=${voiceStats.min}ms (${voiceStats.count} samples)`);
    }

    if (this.metrics.collisionDetectionTimes.length > 0) {
      const collStats = calc(this.metrics.collisionDetectionTimes);
      console.log(`Collision Detection: avg=${collStats.avg}ms, max=${collStats.max}ms, min=${collStats.min}ms (${collStats.count} samples)`);
    }

    console.log('💡 Tip: Set window.ENABLE_PROFILING=false to disable profiler');
    console.groupEnd();

    // Reset for next report
    this.frameCount = 0;
    this.metrics.loopTimes = [];
    this.metrics.firebaseSyncTimes = [];
    this.metrics.voiceProcessTimes = [];
    this.metrics.collisionDetectionTimes = [];
  }

  // Simpler API for quick timing
  time(label, fn) {
    if (!ENABLE_PROFILING) return fn();
    const start = performance.now();
    const result = fn();
    const duration = performance.now() - start;
    
    if (this.metrics[`${label}Times`]) {
      this.metrics[`${label}Times`].push(duration);
      if (this.metrics[`${label}Times`].length > 300) {
        this.metrics[`${label}Times`].shift();
      }
    }

    return result;
  }
}

export const createProfiler = (gameName) => new GameProfiler(gameName);

// Add to window for console access
if (typeof window !== 'undefined') {
  window.ENABLE_PROFILING = false; // User can set to true in console
}
