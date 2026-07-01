/**
 * Video Performance Monitor
 * Tracks and reports on video processing performance metrics
 */

class VideoPerformanceMonitor {
  constructor() {
    this.metrics = {
      totalJobs: 0,
      successfulJobs: 0,
      failedJobs: 0,
      fallbackUsage: {
        level1: 0, // Advanced cinematic
        level2: 0, // Simple scene-based
        level3: 0, // Legacy composition
        level4: 0  // Hardcoded fallback
      },
      processingTimes: [],
      memoryUsage: [],
      errorsByType: {},
      startTime: Date.now()
    };
  }

  logJobStart(jobId, input) {
    this.metrics.totalJobs++;
    console.log(`[Monitor] Job ${jobId} started. Total jobs: ${this.metrics.totalJobs}`);

    return {
      jobId,
      startTime: Date.now(),
      startMemory: process.memoryUsage()
    };
  }

  logJobSuccess(jobContext, result) {
    const duration = Date.now() - jobContext.startTime;
    const endMemory = process.memoryUsage();

    this.metrics.successfulJobs++;
    this.metrics.processingTimes.push(duration);
    this.metrics.memoryUsage.push({
      heapUsed: endMemory.heapUsed - jobContext.startMemory.heapUsed,
      external: endMemory.external - jobContext.startMemory.external,
      duration: duration
    });

    console.log(`[Monitor] Job ${jobContext.jobId} completed successfully in ${duration}ms`);
    this.logMetrics();
  }

  logJobFailure(jobContext, error, fallbackLevel = 4) {
    const duration = Date.now() - jobContext.startTime;

    this.metrics.failedJobs++;
    this.metrics.fallbackUsage[`level${fallbackLevel}`]++;

    const errorType = error.name || 'UnknownError';
    this.metrics.errorsByType[errorType] = (this.metrics.errorsByType[errorType] || 0) + 1;

    console.log(`[Monitor] Job ${jobContext.jobId} failed after ${duration}ms using fallback level ${fallbackLevel}`);
    console.log(`[Monitor] Error: ${error.message}`);
    this.logMetrics();
  }

  logMetrics() {
    const uptime = Date.now() - this.metrics.startTime;
    const successRate = this.metrics.totalJobs > 0 ?
      (this.metrics.successfulJobs / this.metrics.totalJobs * 100).toFixed(2) : 0;

    const avgProcessingTime = this.metrics.processingTimes.length > 0 ?
      (this.metrics.processingTimes.reduce((a, b) => a + b, 0) / this.metrics.processingTimes.length).toFixed(0) : 0;

    const p95ProcessingTime = this.calculatePercentile(this.metrics.processingTimes, 95);

    console.log('\n📊 [VideoPerformanceMonitor] Current Metrics:');
    console.log(`   ⏱️  Uptime: ${Math.round(uptime / 1000)}s`);
    console.log(`   📈 Success Rate: ${successRate}%`);
    console.log(`   🎯 Jobs: ${this.metrics.successfulJobs}✅ / ${this.metrics.failedJobs}❌ / ${this.metrics.totalJobs}📊`);
    console.log(`   ⚡ Avg Processing Time: ${avgProcessingTime}ms`);
    console.log(`   📊 P95 Processing Time: ${p95ProcessingTime}ms`);
    console.log(`   🔄 Fallback Usage: L1:${this.metrics.fallbackUsage.level1} L2:${this.metrics.fallbackUsage.level2} L3:${this.metrics.fallbackUsage.level3} L4:${this.metrics.fallbackUsage.level4}`);

    if (Object.keys(this.metrics.errorsByType).length > 0) {
      console.log(`   ❌ Error Types:`, this.metrics.errorsByType);
    }
    console.log('');
  }

  calculatePercentile(arr, percentile) {
    if (arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[index] || 0;
  }

  getHealthStatus() {
    const successRate = this.metrics.totalJobs > 0 ?
      (this.metrics.successfulJobs / this.metrics.totalJobs) : 1;

    const avgProcessingTime = this.metrics.processingTimes.length > 0 ?
      (this.metrics.processingTimes.reduce((a, b) => a + b, 0) / this.metrics.processingTimes.length) : 0;

    const recentErrors = Object.values(this.metrics.errorsByType).reduce((a, b) => a + b, 0);

    return {
      status: successRate >= 0.95 && avgProcessingTime < 120000 && recentErrors < 5 ? 'HEALTHY' :
              successRate >= 0.85 && avgProcessingTime < 180000 ? 'WARNING' : 'CRITICAL',
      metrics: {
        successRate: (successRate * 100).toFixed(2) + '%',
        avgProcessingTime: avgProcessingTime.toFixed(0) + 'ms',
        totalJobs: this.metrics.totalJobs,
        recentErrors: recentErrors
      }
    };
  }

  // Method to integrate with existing Engine4
  wrapEngine4(originalEngine4) {
    return async (input) => {
      const jobContext = this.logJobStart(input.jobId || 'unknown', input);

      try {
        const result = await originalEngine4(input);

        if (result.success) {
          // Determine fallback level based on result
          let fallbackLevel = 1;
          if (result.data.video_url.includes('sample-videos.com')) {
            fallbackLevel = 4;
          }
          // Add more fallback detection logic as needed

          this.logJobSuccess(jobContext, result);
        } else {
          this.logJobFailure(jobContext, new Error(result.error || 'Unknown failure'), 4);
        }

        return result;
      } catch (error) {
        this.logJobFailure(jobContext, error, 4);
        throw error;
      }
    };
  }

  // Reset metrics (useful for testing)
  reset() {
    this.metrics = {
      totalJobs: 0,
      successfulJobs: 0,
      failedJobs: 0,
      fallbackUsage: { level1: 0, level2: 0, level3: 0, level4: 0 },
      processingTimes: [],
      memoryUsage: [],
      errorsByType: {},
      startTime: Date.now()
    };
  }
}

// Singleton instance
const performanceMonitor = new VideoPerformanceMonitor();

module.exports = {
  VideoPerformanceMonitor,
  performanceMonitor
};