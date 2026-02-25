import { describe, expect, it } from 'vitest';
import {
  PHASE64_WORKFLOW_STORAGE_KEY,
  advanceScanList,
  applyScanEntryLockout,
  createDefaultWorkflowState,
  createKnownGoodPreset,
  createMemoryEntry,
  createMemoriesFromCuratedPack,
  createScanList,
  exportMemoriesCsv,
  exportScanListsCsv,
  importMemoriesCsv,
  importScanListsCsv,
  loadWorkflowState,
  saveWorkflowState,
  validateKnownGoodPreset
} from './phase64Workflow';

describe('phase64Workflow', () => {
  it('loads/saves workflow state with schema handling', () => {
    const state = createDefaultWorkflowState();
    const written = new Map<string, string>();
    const storage = {
      getItem(key: string) {
        return written.get(key) ?? null;
      },
      setItem(key: string, value: string) {
        written.set(key, value);
      }
    };

    saveWorkflowState(storage, state);
    const loaded = loadWorkflowState(storage);

    expect(written.has(PHASE64_WORKFLOW_STORAGE_KEY)).toBe(true);
    expect(loaded.schemaVersion).toBe(1);
    expect(loaded.memoryBanks.length).toBeGreaterThan(0);
    expect(loaded.scanLists.length).toBeGreaterThan(0);
  });

  it('round-trips memories and scan lists CSV', () => {
    const memory = createMemoryEntry({
      label: 'NOAA',
      frequencyHz: 162_400_000,
      mode: 'NFM',
      bandwidthHz: 12_500,
      stepHz: 12_500,
      tags: ['weather'],
      note: 'broadcast',
      applyOnTune: true
    });
    const bank = {
      id: 'b1',
      name: 'Bank A',
      entries: [memory]
    };

    const memoryCsv = exportMemoriesCsv([bank]);
    const importedBanks = importMemoriesCsv(memoryCsv);

    expect(importedBanks).toHaveLength(1);
    expect(importedBanks[0].entries[0].label).toBe('NOAA');

    const scanList = createScanList('List A', 8);
    scanList.entries.push({
      id: 's1',
      memoryEntryId: importedBanks[0].entries[0].id,
      priority: 3,
      dwellMs: 1500,
      enabled: true,
      lockoutUntilIso: null
    });

    const scanCsv = exportScanListsCsv([scanList]);
    const importedScanLists = importScanListsCsv(scanCsv);
    expect(importedScanLists).toHaveLength(1);
    expect(importedScanLists[0].entries).toHaveLength(1);
    expect(importedScanLists[0].entries[0].priority).toBe(3);
  });

  it('advances scan list by priority and respects lockout', () => {
    const first = createMemoryEntry({
      label: 'A',
      frequencyHz: 100_000_000,
      mode: 'NFM',
      bandwidthHz: 12_500,
      stepHz: 12_500
    });
    const second = createMemoryEntry({
      label: 'B',
      frequencyHz: 200_000_000,
      mode: 'NFM',
      bandwidthHz: 12_500,
      stepHz: 12_500
    });

    const scanList = createScanList('Scan');
    scanList.entries = [
      { id: 'e1', memoryEntryId: first.id, priority: 1, dwellMs: 1000, enabled: true, lockoutUntilIso: null },
      { id: 'e2', memoryEntryId: second.id, priority: 5, dwellMs: 900, enabled: true, lockoutUntilIso: null }
    ];

    const memoryMap = new Map<string, ReturnType<typeof createMemoryEntry>>([
      [first.id, first],
      [second.id, second]
    ]);

    const step1 = advanceScanList(scanList, memoryMap, '2026-02-25T00:00:00.000Z', null);
    expect(step1.memory?.label).toBe('B');

    const locked = applyScanEntryLockout(scanList, 'e2', 60_000, '2026-02-25T00:00:00.000Z');
    const step2 = advanceScanList(locked, memoryMap, '2026-02-25T00:00:01.000Z', null);
    expect(step2.memory?.label).toBe('A');
  });

  it('validates known-good preset constraints', () => {
    const invalidPreset = createKnownGoodPreset({
      name: 'Invalid',
      sourceType: 'HACKRF',
      frequencyHz: 162_400_000,
      mode: 'WFM',
      bandwidthHz: 180_000,
      stepHz: 100_000,
      sampleRateHz: 250_000,
      gains: { lna: 16 }
    });

    const result = validateKnownGoodPreset(invalidPreset);
    expect(result.ok).toBe(false);
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it('creates memories from curated packs', () => {
    const bank = createMemoriesFromCuratedPack('na-public-safety-starter');
    expect(bank).not.toBeNull();
    expect(bank?.entries.length).toBeGreaterThan(0);
  });
});
