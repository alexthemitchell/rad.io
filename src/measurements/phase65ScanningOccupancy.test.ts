import { describe, expect, it } from 'vitest';
import {
  buildWidebandScanFrequencies,
  createEmptyWidebandOccupancyLog,
  exportWidebandOccupancyCsv,
  listHeldWidebandFrequencies,
  loadWidebandOccupancyLog,
  normalizeWidebandScanConfig,
  saveWidebandOccupancyLog,
  summarizeWidebandDetections,
  updateWidebandOccupancyLog,
  WIDEBAND_OCCUPANCY_STORAGE_KEY,
  type WidebandScanObservation
} from './phase65ScanningOccupancy';

const createMemoryStorage = () => {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    }
  };
};

describe('phase65ScanningOccupancy', () => {
  it('normalizes config and builds bounded frequency steps', () => {
    const config = normalizeWidebandScanConfig({
      startHz: 108_000_000,
      stopHz: 87_500_000,
      stepHz: 200_000
    });

    expect(config.startHz).toBe(87_500_000);
    expect(config.stopHz).toBe(108_000_000);

    const frequencies = buildWidebandScanFrequencies(config);
    expect(frequencies[0]).toBe(87_500_000);
    expect(frequencies[frequencies.length - 1]).toBe(108_000_000);
    expect(frequencies.length).toBeGreaterThan(10);
  });

  it('updates occupancy with hold/persistence and exports CSV', () => {
    const initial = createEmptyWidebandOccupancyLog();
    const observations: WidebandScanObservation[] = [
      {
        frequencyHz: 100_100_000,
        prominenceDb: 14,
        peakDb: -38,
        noiseFloorDb: -61,
        detected: true,
        measuredAtIso: '2026-02-25T00:00:00.000Z'
      },
      {
        frequencyHz: 100_300_000,
        prominenceDb: 4,
        peakDb: -52,
        noiseFloorDb: -56,
        detected: false,
        measuredAtIso: '2026-02-25T00:00:01.000Z'
      }
    ];

    const updated = updateWidebandOccupancyLog(initial, observations, '2026-02-25T00:00:02.000Z', 5_000);
    expect(updated.sweeps).toBe(1);

    const activeHold = listHeldWidebandFrequencies(updated, '2026-02-25T00:00:05.000Z');
    expect(activeHold).toHaveLength(1);
    expect(activeHold[0].frequencyHz).toBe(100_100_000);

    const csv = exportWidebandOccupancyCsv(updated);
    expect(csv).toContain('frequency_hz,sweeps,hits,occupancy_percent');
    expect(csv).toContain('100100000,1,1,100.00');
  });

  it('summarizes nearby detections and round-trips storage', () => {
    const observations: WidebandScanObservation[] = [
      {
        frequencyHz: 145_799_900,
        prominenceDb: 11,
        peakDb: -41,
        noiseFloorDb: -60,
        detected: true,
        measuredAtIso: '2026-02-25T00:01:00.000Z'
      },
      {
        frequencyHz: 145_800_050,
        prominenceDb: 13,
        peakDb: -39,
        noiseFloorDb: -60,
        detected: true,
        measuredAtIso: '2026-02-25T00:01:01.000Z'
      }
    ];

    const summary = summarizeWidebandDetections(observations, 300);
    expect(summary).toHaveLength(1);
    expect(summary[0].frequencyHz).toBe(145_800_050);
    expect(summary[0].hits).toBe(2);

    const storage = createMemoryStorage();
    const log = updateWidebandOccupancyLog(
      createEmptyWidebandOccupancyLog(),
      observations,
      '2026-02-25T00:01:10.000Z',
      2_000
    );

    saveWidebandOccupancyLog(storage, log);
    expect(storage.getItem(WIDEBAND_OCCUPANCY_STORAGE_KEY)).toBeTruthy();

    const restored = loadWidebandOccupancyLog(storage);
    expect(restored.sweeps).toBe(1);
    expect(restored.bins[0].frequencyHz).toBe(145_799_900);
  });
});
