import { describe, expect, it } from 'vitest';
import {
  buildFrontEndHealthRecommendation,
  classifyFrontEndBand,
  estimateEffectiveEnobBits
} from './frontEndHealthAdvisor';

describe('frontEndHealthAdvisor', () => {
  it('classifies operating bands and ENOB estimates', () => {
    expect(classifyFrontEndBand(7_100_000)).toBe('hf');
    expect(classifyFrontEndBand(162_550_000)).toBe('vhf');
    expect(classifyFrontEndBand(915_000_000)).toBe('uhf');
    expect(classifyFrontEndBand(5_800_000_000)).toBe('shf');

    expect(estimateEffectiveEnobBits(49.9)).toBeCloseTo(8.0, 1);
    expect(estimateEffectiveEnobBits(Number.NaN)).toBe(0);
  });

  it('builds band-aware overload recommendations', () => {
    const recommendation = buildFrontEndHealthRecommendation({
      frequencyHz: 98_100_000,
      sourceType: 'HACKRF',
      rfChainNotes: 'masthead lna',
      hasAttenuatorHint: false,
      hasPreampHint: true,
      overloadLikely: true
    });

    expect(recommendation).toContain('add 6-20 dB attenuation');
    expect(recommendation).toContain('FM-broadcast notch filter');
    expect(recommendation).toContain('USB cable');
  });

  it('returns stable message when overload is not likely', () => {
    const recommendation = buildFrontEndHealthRecommendation({
      frequencyHz: 14_200_000,
      sourceType: 'MOCK',
      rfChainNotes: '',
      hasAttenuatorHint: false,
      hasPreampHint: false,
      overloadLikely: false
    });

    expect(recommendation).toContain('appears stable');
  });
});
