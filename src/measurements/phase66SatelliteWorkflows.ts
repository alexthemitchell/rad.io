import {
  degreesToRadians,
  ecfToLookAngles,
  eciToEcf,
  gstime,
  propagate,
  radiansToDegrees,
  twoline2satrec,
  SatRecError,
  type GeodeticLocation,
  type SatRec
} from 'satellite.js';

const SPEED_OF_LIGHT_MPS = 299_792_458;

export type TleSatellite = {
  id: string;
  name: string;
  noradCatalogNumber: number;
  line1: string;
  line2: string;
  epochIso: string;
  inclinationDeg: number;
  raanDeg: number;
  eccentricity: number;
  argumentOfPerigeeDeg: number;
  meanAnomalyDeg: number;
  meanMotionRevPerDay: number;
};

export type TleParseResult = {
  satellites: TleSatellite[];
  errors: string[];
};

export type ObserverSite = {
  latDeg: number;
  lonDeg: number;
  altitudeM: number;
};

export type PredictedPass = {
  satelliteId: string;
  satelliteName: string;
  aosIso: string;
  tcaIso: string;
  losIso: string;
  maxElevationDeg: number;
  rangeRateMpsAtTca: number;
  dopplerShiftHzAtTca: number;
  model: 'sgp4';
};

export type RotatorPointingRequest = {
  azimuthDeg: number;
  elevationDeg: number;
};

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

const parseEpochIso = (line1: string): string => {
  const epochYear2 = Number.parseInt(line1.slice(18, 20).trim(), 10);
  const epochDay = Number.parseFloat(line1.slice(20, 32).trim());

  if (!Number.isFinite(epochYear2) || !Number.isFinite(epochDay) || epochDay <= 0) {
    return new Date(0).toISOString();
  }

  const year = epochYear2 >= 57 ? 1900 + epochYear2 : 2000 + epochYear2;
  const dayWhole = Math.floor(epochDay) - 1;
  const dayFrac = epochDay - Math.floor(epochDay);
  const millis = Date.UTC(year, 0, 1) + (dayWhole * 86_400_000) + Math.round(dayFrac * 86_400_000);
  return new Date(millis).toISOString();
};

const parseLine2Float = (line2: string, start: number, end: number): number => {
  const parsed = Number.parseFloat(line2.slice(start, end).trim());
  return Number.isFinite(parsed) ? parsed : 0;
};

const parseLine2Eccentricity = (line2: string): number => {
  const raw = line2.slice(26, 33).trim();
  if (!/^\d+$/.test(raw)) {
    return 0;
  }
  const parsed = Number.parseFloat(`0.${raw}`);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const parseTleCatalog = (input: string): TleParseResult => {
  const lines = input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const satellites: TleSatellite[] = [];
  const errors: string[] = [];
  let index = 0;

  while (index < lines.length) {
    const first = lines[index];
    let name = 'Unnamed Satellite';
    let line1 = '';
    let line2 = '';

    if (first.startsWith('1 ') && lines[index + 1]?.startsWith('2 ')) {
      line1 = first;
      line2 = lines[index + 1];
      index += 2;
    } else if (lines[index + 1]?.startsWith('1 ') && lines[index + 2]?.startsWith('2 ')) {
      name = first;
      line1 = lines[index + 1];
      line2 = lines[index + 2];
      index += 3;
    } else {
      errors.push(`Unrecognized TLE block near line ${index + 1}.`);
      index += 1;
      continue;
    }

    if (line1.length < 32 || line2.length < 63) {
      errors.push(`Malformed TLE lines for ${name}.`);
      continue;
    }

    const noradCatalogNumber = Number.parseInt(line1.slice(2, 7).trim(), 10);
    const inclinationDeg = parseLine2Float(line2, 8, 16);
    const raanDeg = parseLine2Float(line2, 17, 25);
    const eccentricity = parseLine2Eccentricity(line2);
    const argumentOfPerigeeDeg = parseLine2Float(line2, 34, 42);
    const meanAnomalyDeg = parseLine2Float(line2, 43, 51);
    const meanMotionRevPerDay = parseLine2Float(line2, 52, 63);

    if (!Number.isFinite(noradCatalogNumber) || noradCatalogNumber <= 0 || meanMotionRevPerDay <= 0) {
      errors.push(`Invalid NORAD/mean-motion for ${name}.`);
      continue;
    }

    const id = `${noradCatalogNumber}-${name.replace(/\s+/g, '-').toLowerCase()}`;
    satellites.push({
      id,
      name,
      noradCatalogNumber,
      line1,
      line2,
      epochIso: parseEpochIso(line1),
      inclinationDeg,
      raanDeg,
      eccentricity,
      argumentOfPerigeeDeg,
      meanAnomalyDeg,
      meanMotionRevPerDay
    });
  }

  return {
    satellites,
    errors
  };
};

const toMillis = (iso: string): number => {
  const parsed = Date.parse(iso);
  return Number.isFinite(parsed) ? parsed : 0;
};

const buildObserverGeodetic = (observer: ObserverSite): GeodeticLocation => ({
  latitude: degreesToRadians(clamp(observer.latDeg, -90, 90)),
  longitude: degreesToRadians(clamp(observer.lonDeg, -180, 180)),
  height: Math.max(0, observer.altitudeM) / 1000
});

const propagateLookAngles = (
  satrec: SatRec,
  observerGeodetic: GeodeticLocation,
  date: Date
): { elevationDeg: number; rangeM: number } | null => {
  const propagated = propagate(satrec, date);
  if (!propagated || !propagated.position || !propagated.velocity || satrec.error !== SatRecError.None) {
    return null;
  }

  const gmst = gstime(date);
  const satelliteEcf = eciToEcf(propagated.position, gmst);
  const lookAngles = ecfToLookAngles(observerGeodetic, satelliteEcf);

  return {
    elevationDeg: radiansToDegrees(lookAngles.elevation),
    rangeM: lookAngles.rangeSat * 1000
  };
};

const RANGE_RATE_DELTA_SECONDS = 1;

const estimateRangeRateMps = (
  satrec: SatRec,
  observerGeodetic: GeodeticLocation,
  atMs: number
): number => {
  const before = propagateLookAngles(
    satrec,
    observerGeodetic,
    new Date(atMs - (RANGE_RATE_DELTA_SECONDS * 1000))
  );
  const after = propagateLookAngles(
    satrec,
    observerGeodetic,
    new Date(atMs + (RANGE_RATE_DELTA_SECONDS * 1000))
  );

  if (!before || !after) {
    return 0;
  }

  const rate = (after.rangeM - before.rangeM) / (2 * RANGE_RATE_DELTA_SECONDS);
  return clamp(rate, -12_000, 12_000);
};

export const computeDopplerShiftHz = (baseFrequencyHz: number, relativeVelocityMps: number): number => {
  if (!Number.isFinite(baseFrequencyHz) || baseFrequencyHz <= 0 || !Number.isFinite(relativeVelocityMps)) {
    return 0;
  }

  return -(relativeVelocityMps / SPEED_OF_LIGHT_MPS) * baseFrequencyHz;
};

export const computeDopplerCorrectedFrequencyHz = (
  baseFrequencyHz: number,
  relativeVelocityMps: number
): number => {
  return Math.round(baseFrequencyHz + computeDopplerShiftHz(baseFrequencyHz, relativeVelocityMps));
};

export const predictSatellitePasses = (input: {
  satellite: TleSatellite;
  observer: ObserverSite;
  downlinkFrequencyHz: number;
  windowStartIso: string;
  windowHours: number;
  maxPasses?: number;
  stepSeconds?: number;
}): PredictedPass[] => {
  const maxPasses = Math.max(1, Math.min(48, Math.round(input.maxPasses ?? 12)));
  const stepSeconds = Math.max(10, Math.min(300, Math.round(input.stepSeconds ?? 30)));
  const startMs = toMillis(input.windowStartIso);
  const windowMs = clamp(Math.round(input.windowHours * 60 * 60 * 1000), 5 * 60_000, 7 * 24 * 60 * 60 * 1000);
  const endMs = startMs + windowMs;
  const satrec = twoline2satrec(input.satellite.line1, input.satellite.line2);
  if (satrec.error !== SatRecError.None) {
    return [];
  }

  const observerGeodetic = buildObserverGeodetic(input.observer);

  const passes: PredictedPass[] = [];
  let inPass = false;
  let aosMs = 0;
  let tcaMs = 0;
  let tcaElevation = -90;
  let tcaRangeRate = 0;

  for (let t = startMs; t <= endMs; t += stepSeconds * 1000) {
    const sample = propagateLookAngles(satrec, observerGeodetic, new Date(t));
    if (!sample) {
      continue;
    }

    const elevationDeg = clamp(sample.elevationDeg, -90, 90);
    const rangeRateMps = estimateRangeRateMps(satrec, observerGeodetic, t);

    if (elevationDeg > 0 && !inPass) {
      inPass = true;
      aosMs = t;
      tcaMs = t;
      tcaElevation = elevationDeg;
      tcaRangeRate = rangeRateMps;
    }

    if (inPass && elevationDeg > tcaElevation) {
      tcaMs = t;
      tcaElevation = elevationDeg;
      tcaRangeRate = rangeRateMps;
    }

    if (inPass && elevationDeg <= 0) {
      const pass: PredictedPass = {
        satelliteId: input.satellite.id,
        satelliteName: input.satellite.name,
        aosIso: new Date(aosMs).toISOString(),
        tcaIso: new Date(tcaMs).toISOString(),
        losIso: new Date(t).toISOString(),
        maxElevationDeg: tcaElevation,
        rangeRateMpsAtTca: tcaRangeRate,
        dopplerShiftHzAtTca: computeDopplerShiftHz(input.downlinkFrequencyHz, tcaRangeRate),
        model: 'sgp4'
      };
      passes.push(pass);
      inPass = false;
      if (passes.length >= maxPasses) {
        break;
      }
    }
  }

  if (inPass && passes.length < maxPasses) {
    passes.push({
      satelliteId: input.satellite.id,
      satelliteName: input.satellite.name,
      aosIso: new Date(aosMs).toISOString(),
      tcaIso: new Date(tcaMs).toISOString(),
      losIso: new Date(endMs).toISOString(),
      maxElevationDeg: tcaElevation,
      rangeRateMpsAtTca: tcaRangeRate,
      dopplerShiftHzAtTca: computeDopplerShiftHz(input.downlinkFrequencyHz, tcaRangeRate),
      model: 'sgp4'
    });
  }

  return passes;
};

export const clampRotatorPointing = (request: RotatorPointingRequest): RotatorPointingRequest => ({
  azimuthDeg: clamp(request.azimuthDeg, 0, 450),
  elevationDeg: clamp(request.elevationDeg, -10, 180)
});

export const buildRotctldSetPositionCommand = (request: RotatorPointingRequest): string => {
  const clamped = clampRotatorPointing(request);
  return `P ${clamped.azimuthDeg.toFixed(1)} ${clamped.elevationDeg.toFixed(1)}`;
};

export const SATELLITE_PROPAGATION_MODEL = 'sgp4';
export const SATELLITE_PROPAGATION_BLOCKER = '';
