import { describe, expect, it } from 'vitest';
import {
  clampFrequencyToBandHz,
  defaultStepForModeHz,
  findBandForFrequencyHz,
  getBandById,
  snapFrequencyToRasterHz,
  stepForBandModeHz,
  validateBandMode
} from './bandPlans';

describe('bandPlans', () => {
  it('snaps to nearest raster from band anchor', () => {
    const snapped = snapFrequencyToRasterHz(99_949_000, 200_000, 87_500_000);
    expect(snapped).toBe(99_900_000);
  });

  it('finds regional band by frequency and validates mode', () => {
    const band = findBandForFrequencyHz('na', 121_500_000);
    expect(band?.id).toBe('airband');
    const modeCheck = validateBandMode(band ?? null, 'NFM');
    expect(modeCheck.valid).toBe(false);
    expect(modeCheck.warning).toContain('Airband');
  });

  it('provides per-band stepping and clamps to band edges', () => {
    const band = getBandById('eu', 'fm-broadcast');
    expect(stepForBandModeHz(band, 'WFM', defaultStepForModeHz('WFM'))).toBe(100_000);
    expect(clampFrequencyToBandHz(200_000_000, band!)).toBe(108_000_000);
    expect(clampFrequencyToBandHz(10_000_000, band!)).toBe(87_500_000);
  });
});
