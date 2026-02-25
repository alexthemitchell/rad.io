import type { VfoBindingId } from './markerVfoBinding';
import type { VfoAudioRoute } from '../dsp/multiVfoCore';

const VFO_PRESETS_STORAGE_KEY = 'rad.io.vfoPresets.v1';
const SCHEMA_VERSION = 1;

export type VfoPreset = {
  id: string;
  name: string;
  createdAtIso: string;
  updatedAtIso: string;
  secondaryVfoEnabled: boolean;
  secondaryVfoOffsetHz: number;
  activeVfoId: VfoBindingId;
  audioRoute: VfoAudioRoute;
};

type StoredVfoPresetsV1 = {
  version: 1;
  presets: VfoPreset[];
};

const sanitizeName = (name: string): string => name.trim().slice(0, 48);

const asSafeRoute = (value: unknown): VfoAudioRoute => {
  if (value === 'main' || value === 'aux' || value === 'mix' || value === 'mute') {
    return value;
  }

  return 'main';
};

const asSafeVfoId = (value: unknown): VfoBindingId => value === 'aux' ? 'aux' : 'main';

const sanitizeOffsetHz = (value: unknown): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 12_500;
  }

  return Math.max(-150_000, Math.min(150_000, Math.round(value)));
};

const makeId = (): string => `vfo-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const parsePayload = (raw: string | null): VfoPreset[] => {
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as Partial<StoredVfoPresetsV1>;
    if (parsed.version !== SCHEMA_VERSION || !Array.isArray(parsed.presets)) {
      return [];
    }

    return parsed.presets
      .filter((entry): entry is VfoPreset => typeof entry === 'object' && entry !== null && typeof entry.name === 'string')
      .map((entry) => ({
        id: typeof entry.id === 'string' && entry.id.length > 0 ? entry.id : makeId(),
        name: sanitizeName(entry.name) || 'Preset',
        createdAtIso: typeof entry.createdAtIso === 'string' ? entry.createdAtIso : new Date().toISOString(),
        updatedAtIso: typeof entry.updatedAtIso === 'string' ? entry.updatedAtIso : new Date().toISOString(),
        secondaryVfoEnabled: Boolean(entry.secondaryVfoEnabled),
        secondaryVfoOffsetHz: sanitizeOffsetHz(entry.secondaryVfoOffsetHz),
        activeVfoId: asSafeVfoId(entry.activeVfoId),
        audioRoute: asSafeRoute(entry.audioRoute)
      }));
  } catch {
    return [];
  }
};

const serializePayload = (presets: VfoPreset[]): string => JSON.stringify({
  version: SCHEMA_VERSION,
  presets
} satisfies StoredVfoPresetsV1);

export const loadVfoPresets = (storage: Pick<Storage, 'getItem'>): VfoPreset[] => parsePayload(storage.getItem(VFO_PRESETS_STORAGE_KEY));

export const saveVfoPresets = (storage: Pick<Storage, 'setItem'>, presets: VfoPreset[]): void => {
  storage.setItem(VFO_PRESETS_STORAGE_KEY, serializePayload(presets));
};

export const createVfoPreset = (
  name: string,
  state: Omit<VfoPreset, 'id' | 'name' | 'createdAtIso' | 'updatedAtIso'>
): VfoPreset => {
  const nowIso = new Date().toISOString();
  return {
    id: makeId(),
    name: sanitizeName(name) || 'Preset',
    createdAtIso: nowIso,
    updatedAtIso: nowIso,
    secondaryVfoEnabled: state.secondaryVfoEnabled,
    secondaryVfoOffsetHz: sanitizeOffsetHz(state.secondaryVfoOffsetHz),
    activeVfoId: asSafeVfoId(state.activeVfoId),
    audioRoute: asSafeRoute(state.audioRoute)
  };
};

export const updateVfoPreset = (preset: VfoPreset, patch: Partial<Omit<VfoPreset, 'id' | 'createdAtIso'>>): VfoPreset => ({
  ...preset,
  name: patch.name ? sanitizeName(patch.name) || preset.name : preset.name,
  updatedAtIso: new Date().toISOString(),
  secondaryVfoEnabled: typeof patch.secondaryVfoEnabled === 'boolean' ? patch.secondaryVfoEnabled : preset.secondaryVfoEnabled,
  secondaryVfoOffsetHz: patch.secondaryVfoOffsetHz === undefined ? preset.secondaryVfoOffsetHz : sanitizeOffsetHz(patch.secondaryVfoOffsetHz),
  activeVfoId: patch.activeVfoId === undefined ? preset.activeVfoId : asSafeVfoId(patch.activeVfoId),
  audioRoute: patch.audioRoute === undefined ? preset.audioRoute : asSafeRoute(patch.audioRoute)
});

export const VFO_PRESETS_STORE_KEY = VFO_PRESETS_STORAGE_KEY;
