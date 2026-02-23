const FFT_MAG_EPSILON = 1e-20;

export function magnitudeSquaredToDbfs(magnitudeSquared: number, fftSize: number): number {
  const safeFftSize = Math.max(1, fftSize);
  const fftScaleDb = 20 * Math.log10(safeFftSize);
  const safeMagnitudeSquared = Math.max(FFT_MAG_EPSILON, magnitudeSquared);
  return 10 * Math.log10(safeMagnitudeSquared) - fftScaleDb;
}
