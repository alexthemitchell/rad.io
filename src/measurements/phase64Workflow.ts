import type { DemodMode } from '../dsp/DemodMetrics';
import { MODE_CONTROL_CONTRACTS, clampFilterForMode, planStreamRateForMode } from '../dsp/controlGuardrails';

export const PHASE64_WORKFLOW_STORAGE_KEY = 'rad.io.phase64.workflow.v1';

export type MemoryEntry = {
  id: string;
  label: string;
  frequencyHz: number;
  mode: DemodMode;
  bandwidthHz: number;
  stepHz: number;
  tags: string[];
  note: string;
  applyOnTune: boolean;
  createdAtIso: string;
};

export type MemoryBank = {
  id: string;
  name: string;
  entries: MemoryEntry[];
};

export type ScanListEntry = {
  id: string;
  memoryEntryId: string;
  priority: number;
  dwellMs: number;
  enabled: boolean;
  lockoutUntilIso: string | null;
};

export type ScanList = {
  id: string;
  name: string;
  squelchThresholdDb: number;
  entries: ScanListEntry[];
};

export type KnownGoodPreset = {
  id: string;
  name: string;
  sourceType: string;
  frequencyHz: number;
  mode: DemodMode;
  bandwidthHz: number;
  stepHz: number;
  sampleRateHz: number;
  gains: Record<string, number>;
  createdAtIso: string;
};

export type WorkflowState = {
  schemaVersion: 1;
  memoryBanks: MemoryBank[];
  scanLists: ScanList[];
  presets: KnownGoodPreset[];
};

type StoredWorkflowState = WorkflowState;

export type KnownGoodPresetValidation = {
  ok: boolean;
  reasons: string[];
  recommendedSampleRateHz: number;
  clampedBandwidthHz: number;
};

export type ScanAdvanceResult = {
  nextEntry: ScanListEntry | null;
  memory: MemoryEntry | null;
  dwellMs: number;
};

export type CuratedPack = {
  id: string;
  name: string;
  entries: Array<{
    label: string;
    frequencyHz: number;
    mode: DemodMode;
    bandwidthHz: number;
    stepHz: number;
    tags: string[];
    note: string;
  }>;
};

const SCHEMA_VERSION = 1;

const makeId = (prefix: string): string => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const sanitizeLabel = (value: string, fallback: string): string => {
  const trimmed = value.trim().slice(0, 64);
  return trimmed.length > 0 ? trimmed : fallback;
};

const sanitizeFrequencyHz = (value: unknown, fallbackHz: number): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallbackHz;
  }

  return Math.max(0, Math.round(value));
};

const sanitizeStepHz = (value: unknown, fallbackHz: number): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallbackHz;
  }

  return Math.max(1, Math.round(value));
};

const sanitizeBandwidthHz = (mode: DemodMode, value: unknown): number => {
  const contract = MODE_CONTROL_CONTRACTS[mode];
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return Math.max(1, contract.defaultHighCutHz - contract.defaultLowCutHz);
  }

  return Math.max(1, Math.round(value));
};

const sanitizeMode = (value: unknown): DemodMode => {
  if (value === 'WFM' || value === 'AM' || value === 'NFM' || value === 'SAM' || value === 'USB' || value === 'LSB' || value === 'CW') {
    return value;
  }

  return 'NFM';
};

const sanitizeTags = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .slice(0, 10);
};

const sanitizeMemoryEntry = (entry: Partial<MemoryEntry>): MemoryEntry => {
  const mode = sanitizeMode(entry.mode);
  const contract = MODE_CONTROL_CONTRACTS[mode];
  const bandwidthHz = sanitizeBandwidthHz(mode, entry.bandwidthHz);

  return {
    id: typeof entry.id === 'string' && entry.id.length > 0 ? entry.id : makeId('mem'),
    label: sanitizeLabel(typeof entry.label === 'string' ? entry.label : '', 'Memory'),
    frequencyHz: sanitizeFrequencyHz(entry.frequencyHz, 145_000_000),
    mode,
    bandwidthHz,
    stepHz: sanitizeStepHz(entry.stepHz, contract.defaultHighCutHz),
    tags: sanitizeTags(entry.tags),
    note: typeof entry.note === 'string' ? entry.note.trim().slice(0, 280) : '',
    applyOnTune: Boolean(entry.applyOnTune),
    createdAtIso: typeof entry.createdAtIso === 'string' ? entry.createdAtIso : new Date().toISOString()
  };
};

const sanitizeScanListEntry = (entry: Partial<ScanListEntry>): ScanListEntry => ({
  id: typeof entry.id === 'string' && entry.id.length > 0 ? entry.id : makeId('scan-entry'),
  memoryEntryId: typeof entry.memoryEntryId === 'string' ? entry.memoryEntryId : '',
  priority: typeof entry.priority === 'number' && Number.isFinite(entry.priority) ? Math.max(0, Math.round(entry.priority)) : 0,
  dwellMs: typeof entry.dwellMs === 'number' && Number.isFinite(entry.dwellMs) ? Math.max(100, Math.round(entry.dwellMs)) : 1000,
  enabled: entry.enabled !== false,
  lockoutUntilIso: typeof entry.lockoutUntilIso === 'string' ? entry.lockoutUntilIso : null
});

const sanitizeState = (input: Partial<StoredWorkflowState> | null | undefined): WorkflowState => {
  if (!input || input.schemaVersion !== SCHEMA_VERSION) {
    return createDefaultWorkflowState();
  }

  return {
    schemaVersion: 1,
    memoryBanks: Array.isArray(input.memoryBanks)
      ? input.memoryBanks.map((bank) => ({
        id: typeof bank.id === 'string' && bank.id.length > 0 ? bank.id : makeId('bank'),
        name: sanitizeLabel(typeof bank.name === 'string' ? bank.name : '', 'Memory Bank'),
        entries: Array.isArray(bank.entries) ? bank.entries.map((entry) => sanitizeMemoryEntry(entry)) : []
      }))
      : [],
    scanLists: Array.isArray(input.scanLists)
      ? input.scanLists.map((list) => ({
        id: typeof list.id === 'string' && list.id.length > 0 ? list.id : makeId('scan'),
        name: sanitizeLabel(typeof list.name === 'string' ? list.name : '', 'Scan List'),
        squelchThresholdDb: typeof list.squelchThresholdDb === 'number' && Number.isFinite(list.squelchThresholdDb)
          ? list.squelchThresholdDb
          : 10,
        entries: Array.isArray(list.entries)
          ? list.entries
            .map((entry) => sanitizeScanListEntry(entry))
            .filter((entry) => entry.memoryEntryId.length > 0)
          : []
      }))
      : [],
    presets: Array.isArray(input.presets)
      ? input.presets.map((preset) => ({
        id: typeof preset.id === 'string' && preset.id.length > 0 ? preset.id : makeId('preset'),
        name: sanitizeLabel(typeof preset.name === 'string' ? preset.name : '', 'Preset'),
        sourceType: typeof preset.sourceType === 'string' ? preset.sourceType : 'MOCK',
        frequencyHz: sanitizeFrequencyHz(preset.frequencyHz, 145_000_000),
        mode: sanitizeMode(preset.mode),
        bandwidthHz: sanitizeBandwidthHz(sanitizeMode(preset.mode), preset.bandwidthHz),
        stepHz: sanitizeStepHz(preset.stepHz, 12_500),
        sampleRateHz: sanitizeStepHz(preset.sampleRateHz, 2_000_000),
        gains: typeof preset.gains === 'object' && preset.gains !== null ? { ...preset.gains } : {},
        createdAtIso: typeof preset.createdAtIso === 'string' ? preset.createdAtIso : new Date().toISOString()
      }))
      : []
  };
};

export const createDefaultWorkflowState = (): WorkflowState => ({
  schemaVersion: 1,
  memoryBanks: [
    {
      id: makeId('bank'),
      name: 'Primary Memories',
      entries: []
    }
  ],
  scanLists: [
    {
      id: makeId('scan'),
      name: 'Default Scan List',
      squelchThresholdDb: 10,
      entries: []
    }
  ],
  presets: []
});

export const loadWorkflowState = (storage: Pick<Storage, 'getItem'>): WorkflowState => {
  const raw = storage.getItem(PHASE64_WORKFLOW_STORAGE_KEY);
  if (!raw) {
    return createDefaultWorkflowState();
  }

  try {
    const parsed = JSON.parse(raw) as Partial<StoredWorkflowState>;
    return sanitizeState(parsed);
  } catch {
    return createDefaultWorkflowState();
  }
};

export const saveWorkflowState = (storage: Pick<Storage, 'setItem'>, state: WorkflowState): void => {
  storage.setItem(PHASE64_WORKFLOW_STORAGE_KEY, JSON.stringify(state));
};

export const createMemoryEntry = (input: {
  label: string;
  frequencyHz: number;
  mode: DemodMode;
  bandwidthHz: number;
  stepHz: number;
  tags?: string[];
  note?: string;
  applyOnTune?: boolean;
}): MemoryEntry => sanitizeMemoryEntry({
  id: makeId('mem'),
  label: input.label,
  frequencyHz: input.frequencyHz,
  mode: input.mode,
  bandwidthHz: input.bandwidthHz,
  stepHz: input.stepHz,
  tags: input.tags ?? [],
  note: input.note ?? '',
  applyOnTune: input.applyOnTune ?? true,
  createdAtIso: new Date().toISOString()
});

export const createScanList = (name: string, squelchThresholdDb = 10): ScanList => ({
  id: makeId('scan'),
  name: sanitizeLabel(name, 'Scan List'),
  squelchThresholdDb,
  entries: []
});

export const createKnownGoodPreset = (input: {
  name: string;
  sourceType: string;
  frequencyHz: number;
  mode: DemodMode;
  bandwidthHz: number;
  stepHz: number;
  sampleRateHz: number;
  gains: Record<string, number>;
}): KnownGoodPreset => ({
  id: makeId('preset'),
  name: sanitizeLabel(input.name, 'Known Good Preset'),
  sourceType: input.sourceType,
  frequencyHz: sanitizeFrequencyHz(input.frequencyHz, 145_000_000),
  mode: sanitizeMode(input.mode),
  bandwidthHz: sanitizeBandwidthHz(sanitizeMode(input.mode), input.bandwidthHz),
  stepHz: sanitizeStepHz(input.stepHz, 12_500),
  sampleRateHz: sanitizeStepHz(input.sampleRateHz, 2_000_000),
  gains: { ...input.gains },
  createdAtIso: new Date().toISOString()
});

export const validateKnownGoodPreset = (preset: KnownGoodPreset): KnownGoodPresetValidation => {
  const reasons: string[] = [];
  const contract = MODE_CONTROL_CONTRACTS[preset.mode];
  const lowCutHz = contract.defaultLowCutHz;
  const highCutHz = lowCutHz + preset.bandwidthHz;
  const streamPlan = planStreamRateForMode(preset.mode, highCutHz);
  const clamped = clampFilterForMode(preset.mode, lowCutHz, highCutHz, preset.sampleRateHz);
  const clampedBandwidthHz = clamped.highCutHz - clamped.lowCutHz;

  if (preset.sampleRateHz < streamPlan.minInputSampleRateHz) {
    reasons.push(`Sample rate ${preset.sampleRateHz} Hz is below required ${streamPlan.minInputSampleRateHz} Hz.`);
  }

  if (clampedBandwidthHz !== preset.bandwidthHz) {
    reasons.push(`Bandwidth clamped from ${preset.bandwidthHz} Hz to ${clampedBandwidthHz} Hz for ${preset.mode}.`);
  }

  if (preset.stepHz <= 0) {
    reasons.push('Tuning step must be positive.');
  }

  return {
    ok: reasons.length === 0,
    reasons,
    recommendedSampleRateHz: streamPlan.sampleRateHz,
    clampedBandwidthHz
  };
};

export const advanceScanList = (
  scanList: ScanList,
  memories: Map<string, MemoryEntry>,
  nowIso: string,
  lastEntryId: string | null
): ScanAdvanceResult => {
  const now = Date.parse(nowIso);
  const eligible = scanList.entries
    .filter((entry) => entry.enabled)
    .filter((entry) => {
      if (!entry.lockoutUntilIso) {
        return true;
      }

      const lockedUntil = Date.parse(entry.lockoutUntilIso);
      return Number.isNaN(lockedUntil) || lockedUntil <= now;
    })
    .sort((a, b) => {
      if (b.priority !== a.priority) {
        return b.priority - a.priority;
      }

      return a.id.localeCompare(b.id);
    });

  if (eligible.length === 0) {
    return {
      nextEntry: null,
      memory: null,
      dwellMs: 0
    };
  }

  let chosen = eligible[0];
  if (lastEntryId) {
    const index = eligible.findIndex((entry) => entry.id === lastEntryId);
    if (index >= 0) {
      chosen = eligible[(index + 1) % eligible.length];
    }
  }

  const memory = memories.get(chosen.memoryEntryId) ?? null;
  return {
    nextEntry: chosen,
    memory,
    dwellMs: chosen.dwellMs
  };
};

export const applyScanEntryLockout = (
  scanList: ScanList,
  entryId: string,
  lockoutMs: number,
  nowIso: string
): ScanList => {
  const now = Date.parse(nowIso);
  const lockUntil = Number.isFinite(now) ? new Date(now + Math.max(0, lockoutMs)).toISOString() : null;

  return {
    ...scanList,
    entries: scanList.entries.map((entry) => {
      if (entry.id !== entryId) {
        return entry;
      }

      return {
        ...entry,
        lockoutUntilIso: lockUntil
      };
    })
  };
};

const csvEscape = (value: string): string => {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.split('"').join('""')}"`;
  }

  return value;
};

const parseCsvLine = (line: string): string[] => {
  const out: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (ch === ',' && !inQuotes) {
      out.push(current);
      current = '';
      continue;
    }

    current += ch;
  }

  out.push(current);
  return out;
};

export const exportMemoriesCsv = (banks: MemoryBank[]): string => {
  const header = 'bank,label,frequencyHz,mode,bandwidthHz,stepHz,applyOnTune,tags,note';
  const rows = banks.flatMap((bank) => bank.entries.map((entry) => [
    bank.name,
    entry.label,
    String(entry.frequencyHz),
    entry.mode,
    String(entry.bandwidthHz),
    String(entry.stepHz),
    entry.applyOnTune ? '1' : '0',
    entry.tags.join('|'),
    entry.note
  ].map(csvEscape).join(',')));

  return [header, ...rows].join('\n');
};

export const importMemoriesCsv = (csv: string): MemoryBank[] => {
  const lines = csv.split(/\r?\n/).map((line) => line.trim()).filter((line) => line.length > 0);
  if (lines.length <= 1) {
    return [];
  }

  const banks = new Map<string, MemoryBank>();
  for (const line of lines.slice(1)) {
    const [bankNameRaw, label, frequencyRaw, modeRaw, bandwidthRaw, stepRaw, applyRaw, tagsRaw, noteRaw] = parseCsvLine(line);
    const bankName = sanitizeLabel(bankNameRaw ?? '', 'Imported Memories');
    const bank = banks.get(bankName) ?? {
      id: makeId('bank'),
      name: bankName,
      entries: []
    };

    const mode = sanitizeMode(modeRaw);
    bank.entries.push(createMemoryEntry({
      label,
      frequencyHz: Number(frequencyRaw),
      mode,
      bandwidthHz: Number(bandwidthRaw),
      stepHz: Number(stepRaw),
      applyOnTune: applyRaw === '1' || applyRaw?.toLowerCase() === 'true',
      tags: (tagsRaw ?? '').split('|').map((part) => part.trim()).filter((part) => part.length > 0),
      note: noteRaw ?? ''
    }));

    banks.set(bankName, bank);
  }

  return Array.from(banks.values());
};

export const exportScanListsCsv = (scanLists: ScanList[]): string => {
  const header = 'scanList,memoryEntryId,priority,dwellMs,enabled,lockoutUntilIso,squelchThresholdDb';
  const rows = scanLists.flatMap((list) => list.entries.map((entry) => [
    list.name,
    entry.memoryEntryId,
    String(entry.priority),
    String(entry.dwellMs),
    entry.enabled ? '1' : '0',
    entry.lockoutUntilIso ?? '',
    String(list.squelchThresholdDb)
  ].map(csvEscape).join(',')));

  return [header, ...rows].join('\n');
};

export const importScanListsCsv = (csv: string): ScanList[] => {
  const lines = csv.split(/\r?\n/).map((line) => line.trim()).filter((line) => line.length > 0);
  if (lines.length <= 1) {
    return [];
  }

  const lists = new Map<string, ScanList>();

  for (const line of lines.slice(1)) {
    const [scanListNameRaw, memoryEntryId, priorityRaw, dwellRaw, enabledRaw, lockoutUntilIsoRaw, squelchRaw] = parseCsvLine(line);
    const scanListName = sanitizeLabel(scanListNameRaw ?? '', 'Imported Scan List');

    const list = lists.get(scanListName) ?? {
      id: makeId('scan'),
      name: scanListName,
      squelchThresholdDb: Number(squelchRaw) || 10,
      entries: []
    };

    list.entries.push({
      id: makeId('scan-entry'),
      memoryEntryId,
      priority: Math.max(0, Number(priorityRaw) || 0),
      dwellMs: Math.max(100, Number(dwellRaw) || 1000),
      enabled: enabledRaw === '1' || enabledRaw.toLowerCase() === 'true',
      lockoutUntilIso: lockoutUntilIsoRaw && lockoutUntilIsoRaw.length > 0 ? lockoutUntilIsoRaw : null
    });

    lists.set(scanListName, list);
  }

  return Array.from(lists.values());
};

export const CURATED_BANDPLAN_PACKS: CuratedPack[] = [
  {
    id: 'na-public-safety-starter',
    name: 'North America Public Safety Starter',
    entries: [
      {
        label: 'NOAA WX 162.400',
        frequencyHz: 162_400_000,
        mode: 'NFM',
        bandwidthHz: 12_500,
        stepHz: 12_500,
        tags: ['weather', 'na'],
        note: 'NOAA weather broadcast channel 1'
      },
      {
        label: 'Airband Guard 121.500',
        frequencyHz: 121_500_000,
        mode: 'AM',
        bandwidthHz: 8_330,
        stepHz: 25_000,
        tags: ['airband', 'guard'],
        note: 'International VHF emergency frequency'
      }
    ]
  },
  {
    id: 'eu-utility-starter',
    name: 'EU Utility Starter',
    entries: [
      {
        label: 'PMR446 Ch1',
        frequencyHz: 446_006_250,
        mode: 'NFM',
        bandwidthHz: 12_500,
        stepHz: 12_500,
        tags: ['pmr', 'eu'],
        note: 'PMR446 analog channel 1'
      },
      {
        label: 'Airband Guard 121.500',
        frequencyHz: 121_500_000,
        mode: 'AM',
        bandwidthHz: 8_330,
        stepHz: 8_333,
        tags: ['airband', 'guard'],
        note: 'International VHF emergency frequency'
      }
    ]
  }
];

export const createMemoriesFromCuratedPack = (packId: string, bankName?: string): MemoryBank | null => {
  const pack = CURATED_BANDPLAN_PACKS.find((entry) => entry.id === packId);
  if (!pack) {
    return null;
  }

  return {
    id: makeId('bank'),
    name: sanitizeLabel(bankName ?? pack.name, pack.name),
    entries: pack.entries.map((entry) => createMemoryEntry(entry))
  };
};
