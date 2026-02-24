import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

const SCRIPT_PATH = path.resolve('scripts/browser-regression-gate.mjs');

function runGate(args) {
  return spawnSync(process.execPath, [SCRIPT_PATH, ...args], {
    encoding: 'utf8',
  });
}

describe('browser-regression-gate', () => {
  it('passes for an allowed browser/channel pair', () => {
    const result = runGate(['--browser', 'chrome', '--channel', 'stable']);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Browser regression gate passed');
  });

  it('fails for a disallowed browser/channel pair', () => {
    const result = runGate(['--browser', 'firefox', '--channel', 'stable']);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Browser regression gate failed');
    expect(result.stderr).toContain('unsupported browser/channel');
  });

  it('fails for malformed config', () => {
    const tempDir = mkdtempSync(path.join(tmpdir(), 'browser-gate-'));
    const badConfigPath = path.join(tempDir, 'bad-config.json');

    try {
      writeFileSync(badConfigPath, JSON.stringify({ allowedMatrix: [] }), 'utf8');

      const result = runGate([
        '--browser',
        'chrome',
        '--channel',
        'stable',
        '--config',
        badConfigPath,
      ]);

      expect(result.status).toBe(1);
      expect(result.stderr).toContain('allowedMatrix must be a non-empty array');
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
