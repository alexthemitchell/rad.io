export interface IqPair {
  i: number;
  q: number;
}

export interface IqSummary {
  dcI: number;
  dcQ: number;
  rms: number;
  clipRatePercent: number;
  correlation: number;
  points: IqPair[];
}

const clampSample = (value: number) => Math.max(-1, Math.min(1, value));

const pairFromFallback = (samples: Float32Array, index: number): IqPair => {
  const phase = (index * Math.PI) / 2;
  return {
    i: clampSample(samples[index]),
    q: clampSample(samples[index] * Math.sin(phase))
  };
};

export function buildIqPairsFromSamples(samples: Float32Array, maxPoints = 512): IqPair[] {
  if (samples.length === 0 || maxPoints <= 0) {
    return [];
  }

  const pairCount = Math.min(Math.floor(samples.length / 2), maxPoints);
  if (pairCount <= 0) {
    return [pairFromFallback(samples, 0)];
  }

  const stride = Math.max(1, Math.floor((samples.length / 2) / pairCount));
  const points: IqPair[] = [];

  for (let pairIndex = 0; pairIndex < pairCount; pairIndex += 1) {
    const base = pairIndex * stride * 2;
    const i = clampSample(samples[base] ?? 0);
    const q = clampSample(samples[base + 1] ?? i);
    points.push({ i, q });
  }

  return points;
}

export function summarizeIqPairs(points: readonly IqPair[]): Omit<IqSummary, 'points'> {
  if (points.length === 0) {
    return {
      dcI: 0,
      dcQ: 0,
      rms: 0,
      clipRatePercent: 0,
      correlation: 0
    };
  }

  let sumI = 0;
  let sumQ = 0;
  let sumSq = 0;
  let clipCount = 0;
  let corrNumerator = 0;
  let corrDenominatorI = 0;
  let corrDenominatorQ = 0;

  for (const point of points) {
    sumI += point.i;
    sumQ += point.q;
    sumSq += point.i * point.i + point.q * point.q;
    if (Math.abs(point.i) >= 0.98 || Math.abs(point.q) >= 0.98) {
      clipCount += 1;
    }
  }

  const meanI = sumI / points.length;
  const meanQ = sumQ / points.length;

  for (const point of points) {
    const i = point.i - meanI;
    const q = point.q - meanQ;
    corrNumerator += i * q;
    corrDenominatorI += i * i;
    corrDenominatorQ += q * q;
  }

  const correlationDenominator = Math.sqrt(corrDenominatorI * corrDenominatorQ);

  return {
    dcI: meanI,
    dcQ: meanQ,
    rms: Math.sqrt(sumSq / (points.length * 2)),
    clipRatePercent: (clipCount / points.length) * 100,
    correlation: correlationDenominator > 1e-9 ? corrNumerator / correlationDenominator : 0
  };
}

export function deriveIqSummary(samples: Float32Array, maxPoints = 512): IqSummary {
  const points = buildIqPairsFromSamples(samples, maxPoints);
  const metrics = summarizeIqPairs(points);

  return {
    ...metrics,
    points
  };
}
