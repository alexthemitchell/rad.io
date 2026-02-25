import { describe, expect, it } from 'vitest';
import {
  VFO_PRESETS_STORE_KEY,
  createVfoPreset,
  loadVfoPresets,
  saveVfoPresets,
  updateVfoPreset
} from './vfoPresetsStore';

const createMemoryStorage = () => {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    }
  };
};

describe('vfoPresetsStore', () => {
  it('round-trips versioned presets and sanitizes fields', () => {
    const storage = createMemoryStorage();
    const preset = createVfoPreset(' NOAA ', {
      secondaryVfoEnabled: true,
      secondaryVfoOffsetHz: 190_000,
      activeVfoId: 'aux',
      audioRoute: 'mix'
    });

    saveVfoPresets(storage, [preset]);
    const loaded = loadVfoPresets(storage);

    expect(loaded).toHaveLength(1);
    expect(loaded[0].name).toBe('NOAA');
    expect(loaded[0].secondaryVfoOffsetHz).toBe(150_000);
    expect(loaded[0].audioRoute).toBe('mix');
  });

  it('updates preset state safely', () => {
    const preset = createVfoPreset('Base', {
      secondaryVfoEnabled: false,
      secondaryVfoOffsetHz: 12_500,
      activeVfoId: 'main',
      audioRoute: 'main'
    });

    const updated = updateVfoPreset(preset, {
      name: ' Patrol ',
      activeVfoId: 'aux',
      audioRoute: 'aux',
      secondaryVfoEnabled: true
    });

    expect(updated.id).toBe(preset.id);
    expect(updated.name).toBe('Patrol');
    expect(updated.activeVfoId).toBe('aux');
    expect(updated.audioRoute).toBe('aux');
    expect(updated.secondaryVfoEnabled).toBe(true);
  });

  it('returns empty list for invalid payloads', () => {
    const storage = createMemoryStorage();
    storage.setItem(VFO_PRESETS_STORE_KEY, JSON.stringify({ version: 99, presets: [{}] }));
    expect(loadVfoPresets(storage)).toEqual([]);
  });
});
