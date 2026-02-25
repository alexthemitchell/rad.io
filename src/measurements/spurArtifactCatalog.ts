export type SpurArtifactKind = 'dc' | 'lo-leakage' | 'image' | 'spur';

export type SpurArtifactEntry = {
  id: string;
  label: string;
  kind: SpurArtifactKind;
  frequencyHz: number;
  sampleRateHz: number;
  gainSignature: string;
  createdAtUtc: string;
  notes: string[];
};

type SpurCatalogStore = {
  byDevice: Record<string, SpurArtifactEntry[]>;
};

const SPUR_CATALOG_STORAGE_KEY = 'rad.io.spurArtifactCatalog.v1';

const parseJson = <T>(raw: string | null, fallback: T): T => {
  if (!raw) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(raw) as T;
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
};

const readStore = (): SpurCatalogStore => {
  if (typeof localStorage === 'undefined') {
    return { byDevice: {} };
  }

  return parseJson(localStorage.getItem(SPUR_CATALOG_STORAGE_KEY), { byDevice: {} });
};

const writeStore = (store: SpurCatalogStore): void => {
  if (typeof localStorage === 'undefined') {
    return;
  }

  try {
    localStorage.setItem(SPUR_CATALOG_STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Best effort persistence only.
  }
};

export const listSpurArtifactEntries = (deviceProfileKey: string): SpurArtifactEntry[] => {
  const store = readStore();
  return [...(store.byDevice[deviceProfileKey] ?? [])].sort((a, b) => a.frequencyHz - b.frequencyHz);
};

export const upsertSpurArtifactEntries = (
  deviceProfileKey: string,
  entries: SpurArtifactEntry[]
): SpurArtifactEntry[] => {
  const store = readStore();
  const existing = store.byDevice[deviceProfileKey] ?? [];
  const mergedById = new Map<string, SpurArtifactEntry>();

  for (const entry of existing) {
    mergedById.set(entry.id, entry);
  }

  for (const entry of entries) {
    mergedById.set(entry.id, entry);
  }

  const merged = [...mergedById.values()];
  store.byDevice[deviceProfileKey] = merged;
  writeStore(store);
  return merged;
};

export const findSpurCatalogMatches = (input: {
  deviceProfileKey: string;
  sampleRateHz: number;
  gainSignature: string;
  candidateFrequencyHz: number;
  toleranceHz: number;
}): SpurArtifactEntry[] => {
  const entries = listSpurArtifactEntries(input.deviceProfileKey);
  return entries.filter((entry) => {
    if (entry.sampleRateHz !== input.sampleRateHz) {
      return false;
    }

    if (entry.gainSignature !== input.gainSignature) {
      return false;
    }

    return Math.abs(entry.frequencyHz - input.candidateFrequencyHz) <= Math.max(1, input.toleranceHz);
  });
};

export const buildCatalogEntriesFromAnnotations = (input: {
  sampleRateHz: number;
  gainSignature: string;
  annotations: Array<{
    frequencyHz: number;
    label: string;
    kind: SpurArtifactKind;
  }>;
}): SpurArtifactEntry[] => {
  const now = new Date().toISOString();
  return input.annotations.map((annotation) => ({
    id: `${annotation.kind}:${Math.round(annotation.frequencyHz)}:${input.sampleRateHz}:${input.gainSignature}`,
    label: annotation.label,
    kind: annotation.kind,
    frequencyHz: annotation.frequencyHz,
    sampleRateHz: input.sampleRateHz,
    gainSignature: input.gainSignature,
    createdAtUtc: now,
    notes: []
  }));
};
