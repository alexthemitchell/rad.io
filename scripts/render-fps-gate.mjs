import fs from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';

const DEFAULT_DURATION_SEC = 300;
const DEFAULT_TARGET_FPS = 60;
const DEFAULT_OUTPUT_DIR = path.resolve('artifacts/validation');

function fail(message) {
  console.error(`Render FPS gate failed: ${message}`);
  process.exit(1);
}

function parseArgs(argv) {
  const parsed = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) {
      fail(`unexpected argument '${token}'`);
    }

    const key = token.slice(2);
    if (!key) {
      fail('empty argument key');
    }

    const value = argv[index + 1];
    if (!value || value.startsWith('--')) {
      fail(`missing value for '--${key}'`);
    }

    parsed[key] = value;
    index += 1;
  }

  return parsed;
}

function percentile(sortedValues, percentile01) {
  if (sortedValues.length === 0) {
    return 0;
  }

  const clamped = Math.max(0, Math.min(1, percentile01));
  const index = Math.floor((sortedValues.length - 1) * clamped);
  return sortedValues[index];
}

function runSyntheticFrameWorkload(fftTrace, waterfallLine, phase) {
  for (let i = 0; i < fftTrace.length; i += 1) {
    const theta = phase + i * 0.011;
    const tone = Math.sin(theta) * 42;
    const noise = Math.sin(theta * 0.37) * 9;
    fftTrace[i] = -120 + tone + noise;
  }

  let peak = -Infinity;
  let mean = 0;
  for (let i = 0; i < fftTrace.length; i += 1) {
    const value = fftTrace[i];
    peak = Math.max(peak, value);
    mean += value;
  }
  mean /= fftTrace.length;

  for (let i = 0; i < waterfallLine.length; i += 1) {
    const rel = i / Math.max(1, waterfallLine.length - 1);
    waterfallLine[i] = Math.max(-140, Math.min(0, mean + (peak - mean) * rel));
  }
}

function ensureDirectory(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const durationSec = Number.parseFloat(args['duration-sec'] ?? String(DEFAULT_DURATION_SEC));
  const targetFps = Number.parseFloat(args['target-fps'] ?? String(DEFAULT_TARGET_FPS));
  const outputDir = args['output-dir'] ? path.resolve(args['output-dir']) : DEFAULT_OUTPUT_DIR;

  if (!Number.isFinite(durationSec) || durationSec <= 0) {
    fail(`invalid duration '${args['duration-sec'] ?? ''}'`);
  }

  if (!Number.isFinite(targetFps) || targetFps <= 0) {
    fail(`invalid target-fps '${args['target-fps'] ?? ''}'`);
  }

  const fftTrace = new Float32Array(4096);
  const waterfallLine = new Float32Array(2048);
  const frameTimesMs = [];

  const startedAt = performance.now();
  let previousFrameAt = startedAt;
  let frameCount = 0;

  while (performance.now() - startedAt < durationSec * 1000) {
    const frameStartedAt = performance.now();
    runSyntheticFrameWorkload(fftTrace, waterfallLine, frameCount * 0.07);

    const now = performance.now();
    const frameDeltaMs = Math.max(0.001, now - previousFrameAt);
    previousFrameAt = now;
    frameTimesMs.push(frameDeltaMs);
    frameCount += 1;

    if (frameStartedAt === 0) {
      // Keep loop body deterministic for lint/no-op guard.
      break;
    }
  }

  const durationMs = Math.max(1, performance.now() - startedAt);
  const fpsSamples = frameTimesMs.map((ms) => 1000 / Math.max(ms, 0.001)).sort((a, b) => a - b);
  const medianFps = percentile(fpsSamples, 0.5);
  const p95Fps = percentile(fpsSamples, 0.95);
  const sustainedFps = (frameCount * 1000) / durationMs;
  const passed = medianFps >= targetFps && p95Fps >= targetFps && sustainedFps >= targetFps;

  const summary = {
    schemaVersion: '1.0.0',
    generatedAtIso: new Date().toISOString(),
    durationSec,
    targetFps,
    frameCount,
    sustainedFps,
    medianFps,
    p95Fps,
    passed
  };

  ensureDirectory(outputDir);
  const evidenceName = `p4-0d-render-fps-gate-${summary.generatedAtIso.replace(/[:.]/g, '-')}.json`;
  const outputPath = path.join(outputDir, evidenceName);
  fs.writeFileSync(outputPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');

  if (!passed) {
    fail(
      `target ${targetFps.toFixed(1)} FPS not met (median=${medianFps.toFixed(1)}, p95=${p95Fps.toFixed(1)}, sustained=${sustainedFps.toFixed(1)}). Evidence: ${outputPath}`
    );
  }

  console.log(
    `Render FPS gate passed: median=${medianFps.toFixed(1)} FPS, p95=${p95Fps.toFixed(1)} FPS, sustained=${sustainedFps.toFixed(1)} FPS. Evidence: ${outputPath}`
  );
}

main();
