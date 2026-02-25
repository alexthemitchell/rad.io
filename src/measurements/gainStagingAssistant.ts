import type { DemodMode } from '../dsp/DemodMetrics';
import type { SDRGainStage } from '../devices/ISDRDevice';

export type GainStagingBand = 'hf' | 'vhf' | 'uhf';

export type GainStagingAssistantInput = {
  frequencyHz: number;
  demodMode: DemodMode;
  gainStages: SDRGainStage[];
  currentGains: Record<string, number>;
  iqPeakLinear: number;
  audioClippingRatio: number;
  snrEstimateDb: number;
  overloadLikely: boolean;
};

export type GainStagingAssistantAssessment = {
  band: GainStagingBand;
  presetLabel: string;
  severity: 'ok' | 'warn';
  summary: string;
  actions: string[];
  recommendedGains: Record<string, number>;
};

const clamp01 = (value: number): number => {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(1, value));
};

const classifyBand = (frequencyHz: number): GainStagingBand => {
  if (!Number.isFinite(frequencyHz) || frequencyHz < 30_000_000) {
    return 'hf';
  }

  if (frequencyHz < 300_000_000) {
    return 'vhf';
  }

  return 'uhf';
};

const stepAlign = (value: number, min: number, max: number, step: number): number => {
  const normalizedStep = Number.isFinite(step) && step > 0 ? step : 1;
  const clamped = Math.max(min, Math.min(max, value));
  const ticks = Math.round((clamped - min) / normalizedStep);
  return min + (ticks * normalizedStep);
};

const stageWeight = (stageName: string): number => {
  const normalized = stageName.toLowerCase();
  if (normalized.includes('amp')) {
    return 0.15;
  }
  if (normalized.includes('lna') || normalized.includes('rf')) {
    return 0.7;
  }
  if (normalized.includes('if') || normalized.includes('vga') || normalized.includes('bb')) {
    return 1;
  }
  return 0.85;
};

export const assessGainStagingAssistant = (
  input: GainStagingAssistantInput
): GainStagingAssistantAssessment => {
  const band = classifyBand(input.frequencyHz);
  const baseTargetByBand: Record<GainStagingBand, number> = {
    hf: 0.35,
    vhf: 0.45,
    uhf: 0.5
  };

  let normalizedTarget = baseTargetByBand[band];
  if (input.overloadLikely || input.iqPeakLinear >= 0.99 || input.audioClippingRatio > 0.03) {
    normalizedTarget -= 0.2;
  } else if (input.snrEstimateDb < 12) {
    normalizedTarget += input.demodMode === 'WFM' ? 0.1 : 0.06;
  }
  normalizedTarget = clamp01(normalizedTarget);

  const recommendedGains: Record<string, number> = {};
  for (const stage of input.gainStages) {
    const current = input.currentGains[stage.name] ?? stage.value;
    const range = Math.max(0, stage.max - stage.min);
    const weight = stageWeight(stage.name);
    let targetValue = stage.min + (range * clamp01(normalizedTarget * weight));

    if (stage.name.toLowerCase().includes('amp') && (input.overloadLikely || input.iqPeakLinear > 0.97)) {
      targetValue = stage.min;
    }

    const quantized = stepAlign(targetValue, stage.min, stage.max, stage.step);
    recommendedGains[stage.name] = Number.isFinite(quantized) ? quantized : current;
  }

  const severity = input.overloadLikely || input.audioClippingRatio > 0.03 || input.iqPeakLinear >= 0.99
    ? 'warn'
    : 'ok';

  const actions: string[] = [];
  if (severity === 'warn') {
    actions.push('Apply conservative preset and watch IQ peak + audio clipping for 10-15 seconds.');
    actions.push('If clipping persists, reduce the earliest RF/LNA stage before baseband stages.');
  } else {
    actions.push('Use this preset as a baseline, then increase one stage at a time while preserving headroom.');
  }

  if (band === 'hf') {
    actions.push('HF preset prioritizes front-end margin; add preselection/notch filtering before increasing gain.');
  } else if (band === 'vhf') {
    actions.push('VHF preset balances sensitivity and overload resilience for mixed urban band conditions.');
  } else {
    actions.push('UHF preset keeps moderate gain to avoid intermod in dense high-band environments.');
  }

  const presetLabel = `${band.toUpperCase()} ${severity === 'warn' ? 'conservative' : 'balanced'} preset`;
  const summary = severity === 'warn'
    ? `${presetLabel}: clipping or overrange signals detected, favoring lower gain staging.`
    : `${presetLabel}: no hard overload indicators, keeping moderate headroom.`;

  return {
    band,
    presetLabel,
    severity,
    summary,
    actions,
    recommendedGains
  };
};
