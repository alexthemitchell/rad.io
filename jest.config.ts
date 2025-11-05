import type { Config } from "jest";

const config: Config = {
  testEnvironment: "jsdom",
  testTimeout: 30000, // 30 seconds per test
  maxWorkers: "50%", // Use half of available CPU cores for parallel execution
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
    // Global thresholds - updated to match current coverage levels
    global: {
      statements: 64,
      branches: 52,
      functions: 67,
      lines: 64,
    },
    // HackRF implementation - updated to current coverage
    "./src/hackrf/HackRFOne.ts": {
      statements: 76,
      branches: 60,
      functions: 95,
      lines: 75,
    },
    "./src/hackrf/HackRFOneAdapter.ts": {
      statements: 96,
      branches: 83,
      functions: 93,
      lines: 96,
    },
    // Critical DSP utilities - updated to current coverage
    "./src/utils/dsp.ts": {
      statements: 87,
      branches: 75,
      functions: 100,
      lines: 86,
    },
    "./src/utils/testMemoryManager.ts": {
      statements: 100,
      branches: 83,
      functions: 100,
      lines: 100,
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
    "./src/utils/p25decoder.ts": {
      // Adjusted to current stable coverage baseline
      statements: 87,
      branches: 64,
      functions: 100,
      lines: 88,
    },
    "./src/utils/rdsDecoder.ts": {
      statements: 57,
      branches: 32,
      functions: 64,
      lines: 57,
    },
    "./src/utils/dspProcessing.ts": {
      // Adjusted to current stable coverage baseline
      statements: 88,
      branches: 50,
      functions: 85,
      lines: 88,
    },
  },
  coverageReporters: ["text", "lcov", "json-summary", "html"],
  // Custom reporters for performance tracking
  reporters: [
    "default",
    ...(process.env["TRACK_PERFORMANCE"] === "1"
      ? ["<rootDir>/jest-performance-reporter.mjs"]
      : []),
  ],
  transformIgnorePatterns: ["node_modules/(?!(webfft)/)"],
  transform: {
    "^.+\\.(t|j)sx?$": [
      "@swc/jest",
      {
        jsc: {
          parser: { syntax: "typescript", tsx: true },
          transform: { react: { runtime: "automatic" } },
        },
        module: { type: "commonjs" },
        sourceMaps: true,
      },
    ],
  },
};

export default config;
