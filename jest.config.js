/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: "jsdom",
  testTimeout: 30000, // 30 seconds per test
  moduleNameMapper: {
    "\\.(css|less|scss|sass)$": "identity-obj-proxy",
  },
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  testMatch: ["**/__tests__/**/*.ts?(x)", "**/?(*.)+(spec|test).ts?(x)"],
  testPathIgnorePatterns: ["/node_modules/", "/e2e/"],
  collectCoverageFrom: [
    "src/**/*.{ts,tsx}",
    "!src/**/*.d.ts",
    "!src/index.tsx",
    "!src/**/index.ts",
    "!src/workers/**",
  ],
  coverageThreshold: {
    // Global thresholds - prevent coverage regression
    global: {
      statements: 38,
      branches: 35,
      functions: 39,
      lines: 38,
    },
    // HackRF implementation - enforcing 80% patch coverage as per CodeCov
    "./src/hackrf/HackRFOne.ts": {
      statements: 72,
      branches: 53,
      functions: 94,
      lines: 71,
    },
    "./src/hackrf/HackRFOneAdapter.ts": {
      statements: 93,
      branches: 83,
      functions: 87,
      lines: 93,
    },
    // Critical DSP utilities - current baseline with improvement targets
    "./src/utils/dsp.ts": {
      statements: 70,
      branches: 63,
      functions: 82,
      lines: 69,
    },
    "./src/utils/testMemoryManager.ts": {
      statements: 95,
      branches: 70,
      functions: 100,
      lines: 95,
    },
    // Core utilities - current baseline
    "./src/utils/audioStream.ts": {
      statements: 93,
      branches: 78,
      functions: 93,
      lines: 93,
    },
    "./src/utils/iqRecorder.ts": {
      statements: 77,
      branches: 57,
      functions: 92,
      lines: 77,
    },
    "./src/utils/speechRecognition.ts": {
      statements: 78,
      branches: 68,
      functions: 87,
      lines: 77,
    },
    "./src/utils/p25decoder.ts": {
      statements: 96,
      branches: 85,
      functions: 100,
      lines: 96,
    },
    "./src/utils/rdsDecoder.ts": {
      statements: 57,
      branches: 32,
      functions: 64,
      lines: 57,
    },
    "./src/utils/dspProcessing.ts": {
      statements: 94,
      branches: 50,
      functions: 85,
      lines: 94,
    },
  },
  coverageReporters: ["text", "lcov", "json-summary"],
  transformIgnorePatterns: ["node_modules/(?!(webfft)/)"],
  transform: {
    "^.+\\.(t|j)sx?$": [
      "@swc/jest",
      {
        jsc: {
          parser: { syntax: "typescript", tsx: true },
          transform: { react: { runtime: "automatic" } },
          target: "es2020",
        },
        module: { type: "commonjs" },
        sourceMaps: true,
      },
    ],
  },
};
