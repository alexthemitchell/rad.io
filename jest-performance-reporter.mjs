/**
 * Jest custom reporter for performance tracking
 * Logs performance metrics when TRACK_PERFORMANCE=1
 */

export default class PerformanceReporter {
  constructor(globalConfig, options) {
    this._globalConfig = globalConfig;
    this._options = options;
  }

  onRunComplete(contexts, results) {
    if (process.env.TRACK_PERFORMANCE !== "1") {
      return;
    }

    console.log("\n📊 Performance Test Summary:");
    console.log(`  Total tests: ${results.numTotalTests}`);
    console.log(`  Passed: ${results.numPassedTests}`);
    console.log(`  Failed: ${results.numFailedTests}`);
    console.log(`  Duration: ${(results.startTime - Date.now()) / 1000}s\n`);
  }
}
