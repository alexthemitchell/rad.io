import { describe, expect, it } from 'vitest';
import { filterCommandPaletteEntries, type CommandPaletteEntry } from './commandPalette';

describe('filterCommandPaletteEntries', () => {
  const entries: CommandPaletteEntry[] = [
    { id: 'start', label: 'Start or Stop Stream', keywords: ['stream', 'run'] },
    { id: 'wfm', label: 'Mode: WFM', keywords: ['mode', 'broadcast'] },
    { id: 'export', label: 'Export Diagnostics', keywords: ['bundle', 'support'] }
  ];

  it('returns all entries when query is empty', () => {
    expect(filterCommandPaletteEntries(entries, '')).toHaveLength(3);
  });

  it('filters by label or keyword case-insensitively', () => {
    expect(filterCommandPaletteEntries(entries, 'mode')).toEqual([entries[1]]);
    expect(filterCommandPaletteEntries(entries, 'SUPPORT')).toEqual([entries[2]]);
  });
});
