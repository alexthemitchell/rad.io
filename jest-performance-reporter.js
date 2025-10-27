/**
 * Test Performance Reporter
 *
 * Custom Jest reporter to track test execution times and identify slow tests.
 * This helps maintain test suite performance and catch regressions.
 *
 * Usage: Add to jest.config.ts:
 *   reporters: ['default', '<rootDir>/jest-performance-reporter.js']
 */

const fs = require('fs');
const path = require('path');

// Thresholds for test categorization (in milliseconds)
const THRESHOLDS = {
  unit: {
    slow: 100,
    verySlow: 500,
  },
  integration: {
    slow: 1000,
    verySlow: 5000,
  },
};

class PerformanceReporter {
  constructor(globalConfig, options) {
    this._globalConfig = globalConfig;
    this._options = options || {};
    this._slowTests = [];
    this._testMetrics = {
      totalTests: 0,
      totalTime: 0,
      slowTests: 0,
      verySlowTests: 0,
      averageTime: 0,
    };
  }

  onRunComplete(contexts, results) {
    const { testResults, startTime } = results;
    
    // Process each test suite
    testResults.forEach((suiteResult) => {
      const suitePath = suiteResult.testFilePath;
      const isIntegration = suitePath.includes('integration');

      suiteResult.testResults.forEach((testResult) => {
        const duration = testResult.duration || 0;
        const threshold = isIntegration ? THRESHOLDS.integration : THRESHOLDS.unit;

        this._testMetrics.totalTests++;
        this._testMetrics.totalTime += duration;

        // Track slow tests
        if (duration > threshold.slow) {
          this._testMetrics.slowTests++;
          
          if (duration > threshold.verySlow) {
            this._testMetrics.verySlowTests++;
          }

          this._slowTests.push({
            name: testResult.fullName,
            file: path.relative(process.cwd(), suitePath),
            duration,
            type: isIntegration ? 'integration' : 'unit',
            threshold: threshold.slow,
          });
        }
      });
    });

    // Calculate metrics
    this._testMetrics.averageTime = 
      this._testMetrics.totalTime / this._testMetrics.totalTests;

    // Sort slow tests by duration (descending)
    this._slowTests.sort((a, b) => b.duration - a.duration);

    // Print report
    this._printReport(results);

    // Save to file if in CI
    if (process.env.CI) {
      this._saveReport();
    }
  }

  _printReport(results) {
    const { _slowTests, _testMetrics } = this;

    console.log('\n\n📊 Test Performance Report\n');
    console.log('─'.repeat(80));
    
    // Summary
    console.log('\n📈 Summary:');
    console.log(`  Total tests: ${_testMetrics.totalTests}`);
    console.log(`  Total time: ${(_testMetrics.totalTime / 1000).toFixed(2)}s`);
    console.log(`  Average time per test: ${_testMetrics.averageTime.toFixed(2)}ms`);
    console.log(`  Slow tests (>${THRESHOLDS.unit.slow}ms): ${_testMetrics.slowTests}`);
    console.log(`  Very slow tests (>${THRESHOLDS.unit.verySlow}ms): ${_testMetrics.verySlowTests}`);

    // Top slow tests
    if (_slowTests.length > 0) {
      console.log('\n🐌 Top 10 Slowest Tests:\n');
      
      const top10 = _slowTests.slice(0, 10);
      top10.forEach((test, index) => {
        const emoji = test.duration > test.threshold * 5 ? '🔴' : 
                     test.duration > test.threshold * 2 ? '🟡' : '🟢';
        console.log(`  ${index + 1}. ${emoji} ${test.duration.toFixed(0)}ms - ${test.name}`);
        console.log(`     📁 ${test.file}`);
      });

      // Recommendations
      if (_testMetrics.verySlowTests > 0) {
        console.log('\n💡 Recommendations:');
        console.log('  • Consider splitting very slow tests into smaller units');
        console.log('  • Check for missing mocks (WebUSB, WebGL, WASM)');
        console.log('  • Profile with: npm test -- --logHeapUsage --maxWorkers=1');
        console.log('  • Consider moving integration tests to separate suite');
      }
    } else {
      console.log('\n✅ All tests are performing well!');
    }

    console.log('\n' + '─'.repeat(80) + '\n');
  }

  _saveReport() {
    const { _slowTests, _testMetrics } = this;
    
    const report = {
      timestamp: new Date().toISOString(),
      metrics: _testMetrics,
      slowTests: _slowTests,
      thresholds: THRESHOLDS,
    };

    const reportPath = path.join(process.cwd(), 'test-performance-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    console.log(`📄 Performance report saved to: ${reportPath}\n`);
  }
}

module.exports = PerformanceReporter;
