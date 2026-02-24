export const computePpmCorrectionHz = (tunedFrequencyHz: number, ppm: number): number => {
  if (!Number.isFinite(tunedFrequencyHz) || !Number.isFinite(ppm)) {
    return 0;
  }

  // Negative sign compensates positive LO error by shifting DSP mixer opposite.
  return -(tunedFrequencyHz * ppm) / 1_000_000;
};
