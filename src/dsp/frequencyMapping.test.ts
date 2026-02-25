import { describe, expect, it } from 'vitest';
import {
  displayToTunerFrequencyHz,
  formatFrequencyModelSummary,
  tunerToDisplayFrequencyHz,
  type FrequencyMappingConfig
} from './frequencyMapping';

describe('frequencyMapping', () => {
  it('maps identity when transverter is off', () => {
    const config: FrequencyMappingConfig = {
      ifOffsetHz: 0,
      transverterEnabled: false,
      transverterLoHz: 125_000_000,
      transverterDirection: 'up'
    };

    expect(tunerToDisplayFrequencyHz(145_000_000, config)).toBe(145_000_000);
    expect(displayToTunerFrequencyHz(145_000_000, config)).toBe(145_000_000);
  });

  it('maps upconverter display and tuner frequencies', () => {
    const config: FrequencyMappingConfig = {
      ifOffsetHz: 10_700_000,
      transverterEnabled: true,
      transverterLoHz: 116_000_000,
      transverterDirection: 'up'
    };

    const displayHz = tunerToDisplayFrequencyHz(28_300_000, config);
    expect(displayHz).toBe(155_000_000);
    expect(displayToTunerFrequencyHz(displayHz, config)).toBe(28_300_000);
  });

  it('maps downconverter display and tuner frequencies', () => {
    const config: FrequencyMappingConfig = {
      ifOffsetHz: 0,
      transverterEnabled: true,
      transverterLoHz: 144_000_000,
      transverterDirection: 'down'
    };

    const displayHz = tunerToDisplayFrequencyHz(433_920_000, config);
    expect(displayHz).toBe(289_920_000);
    expect(displayToTunerFrequencyHz(displayHz, config)).toBe(433_920_000);
  });

  it('formats model summary with display and tuner frequencies', () => {
    const summary = formatFrequencyModelSummary(90_000_000, {
      ifOffsetHz: 100_000,
      transverterEnabled: true,
      transverterLoHz: 10_000_000,
      transverterDirection: 'up'
    });

    expect(summary).toContain('Display 100,100,000 Hz');
    expect(summary).toContain('Tuner 90,000,000 Hz');
  });
});
