import { describe, expect, it } from 'vitest';
import {
  SATELLITE_PROPAGATION_MODEL,
  buildRotctldSetPositionCommand,
  computeDopplerCorrectedFrequencyHz,
  computeDopplerShiftHz,
  parseTleCatalog,
  predictSatellitePasses
} from './phase66SatelliteWorkflows';

const ISS_TLE = `ISS (ZARYA)
1 25544U 98067A   26056.56059028  .00015491  00000+0  27972-3 0  9998
2 25544  51.6392  54.7132 0003570 269.2924 176.4382 15.49962661500457`;

describe('phase66SatelliteWorkflows', () => {
  it('parses TLE catalogs with metadata', () => {
    const parsed = parseTleCatalog(ISS_TLE);

    expect(parsed.errors).toEqual([]);
    expect(parsed.satellites).toHaveLength(1);
    expect(parsed.satellites[0].noradCatalogNumber).toBe(25544);
    expect(parsed.satellites[0].meanMotionRevPerDay).toBeGreaterThan(15);
  });

  it('computes doppler shift with expected sign convention', () => {
    const baseHz = 145_800_000;
    const towardObserverMps = -7_500;
    const awayFromObserverMps = 7_500;

    const towardShift = computeDopplerShiftHz(baseHz, towardObserverMps);
    const awayShift = computeDopplerShiftHz(baseHz, awayFromObserverMps);

    expect(towardShift).toBeGreaterThan(0);
    expect(awayShift).toBeLessThan(0);
    expect(computeDopplerCorrectedFrequencyHz(baseHz, towardObserverMps)).toBeGreaterThan(baseHz);
    expect(computeDopplerCorrectedFrequencyHz(baseHz, awayFromObserverMps)).toBeLessThan(baseHz);
  });

  it('predicts upcoming passes with SGP4 propagation model', () => {
    const parsed = parseTleCatalog(ISS_TLE);
    const passes = predictSatellitePasses({
      satellite: parsed.satellites[0],
      observer: {
        latDeg: 47.61,
        lonDeg: -122.33,
        altitudeM: 60
      },
      downlinkFrequencyHz: 145_800_000,
      windowStartIso: '2026-02-25T00:00:00.000Z',
      windowHours: 24,
      maxPasses: 8,
      stepSeconds: 45
    });

    expect(passes.length).toBeGreaterThan(0);
    expect(passes[0].model).toBe(SATELLITE_PROPAGATION_MODEL);
    expect(new Date(passes[0].aosIso).getTime()).toBeLessThanOrEqual(new Date(passes[0].tcaIso).getTime());
    expect(new Date(passes[0].tcaIso).getTime()).toBeLessThanOrEqual(new Date(passes[0].losIso).getTime());
    expect(passes[0].maxElevationDeg).toBeGreaterThan(0);
    expect(Math.abs(passes[0].rangeRateMpsAtTca)).toBeLessThan(12_000);
  });

  it('formats rotctld set-position commands with guardrails', () => {
    const command = buildRotctldSetPositionCommand({
      azimuthDeg: 720,
      elevationDeg: 210
    });

    expect(command).toBe('P 450.0 180.0');
  });
});
