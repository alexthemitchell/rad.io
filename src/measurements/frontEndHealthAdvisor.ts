export type FrontEndBand = 'hf' | 'vhf' | 'uhf' | 'shf';

export type FrontEndHealthInput = {
  frequencyHz: number;
  sourceType: 'MOCK' | 'HACKRF' | 'RTLSDR' | 'AIRSPY' | 'SDRPLAY' | 'PLUTO' | 'LIMESDR' | 'FILE';
  rfChainNotes: string;
  hasAttenuatorHint: boolean;
  hasPreampHint: boolean;
  overloadLikely: boolean;
};

export const classifyFrontEndBand = (frequencyHz: number): FrontEndBand => {
  if (frequencyHz < 30_000_000) {
    return 'hf';
  }

  if (frequencyHz < 300_000_000) {
    return 'vhf';
  }

  if (frequencyHz < 3_000_000_000) {
    return 'uhf';
  }

  return 'shf';
};

export const estimateEffectiveEnobBits = (snrEstimateDb: number): number => {
  if (!Number.isFinite(snrEstimateDb)) {
    return 0;
  }

  const enob = (snrEstimateDb - 1.76) / 6.02;
  return Math.max(0, Math.min(16, enob));
};

export const buildFrontEndHealthRecommendation = (input: FrontEndHealthInput): string => {
  if (!input.overloadLikely) {
    return 'Front-end appears stable; maintain current gain chain and verify antenna/feedline only if quality drops.';
  }

  const band = classifyFrontEndBand(input.frequencyHz);
  const steps: string[] = [];

  if (!input.hasAttenuatorHint) {
    steps.push('add 6-20 dB attenuation');
  }

  if (input.hasPreampHint) {
    steps.push('disable or reduce external preamp gain');
  }

  if (band === 'hf') {
    steps.push('enable a broadcast-band reject or high-pass filter for HF overload control');
  } else if (band === 'vhf') {
    steps.push('apply a VHF band-pass or FM-broadcast notch filter');
  } else if (band === 'uhf') {
    steps.push('use a narrower UHF preselector/band-pass filter');
  } else {
    steps.push('reduce front-end gain and use shorter low-loss feedline at SHF');
  }

  if (input.sourceType === 'HACKRF' || input.sourceType === 'RTLSDR') {
    steps.push('re-seat USB cable and avoid unpowered hubs to reduce transport-induced distortion symptoms');
  }

  if (input.rfChainNotes.trim().length > 0) {
    steps.push('confirm RF chain note assumptions still match this setup');
  }

  return `Overload likely: ${steps.join('; ')}.`;
};
