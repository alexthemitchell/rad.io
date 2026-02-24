import fs from 'node:fs';
import path from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

const SCRIPT_PATH = path.resolve('scripts/render-fps-gate.mjs');

function runGate(args) {
  return spawnSync(process.execPath, [SCRIPT_PATH, ...args], {
    encoding: 'utf8'
  });
}

describe('render-fps-gate', () => {
  it('writes validation evidence and passes for synthetic workload', () => {
    const tempDir = mkdtempSync(path.join(tmpdir(), 'render-fps-gate-'));

    try {
      const result = runGate([
        '--duration-sec',
        '0.2',
        '--target-fps',
        '10',
        '--output-dir',
        tempDir
      ]);

      expect(result.status).toBe(0);
      expect(result.stdout).toContain('Render FPS gate passed');

      const files = fs.readdirSync(tempDir).filter((file) => file.startsWith('p4-0d-render-fps-gate-'));
      expect(files.length).toBe(1);

      const payload = JSON.parse(fs.readFileSync(path.join(tempDir, files[0]), 'utf8'));
      expect(payload.passed).toBe(true);
      expect(payload.medianFps).toBeGreaterThanOrEqual(10);
      expect(payload.p95Fps).toBeGreaterThanOrEqual(10);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('fails fast for invalid duration input', () => {
    const result = runGate(['--duration-sec', '-1']);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Render FPS gate failed');
  });
});
