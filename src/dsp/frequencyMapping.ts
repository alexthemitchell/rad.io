export type TransverterDirection = 'up' | 'down';

export type FrequencyMappingConfig = {
  ifOffsetHz: number;
  transverterEnabled: boolean;
  transverterLoHz: number;
  transverterDirection: TransverterDirection;
};

const transverterContributionHz = (config: FrequencyMappingConfig): number => {
  if (!config.transverterEnabled) {
    return 0;
  }

  return config.transverterDirection === 'up'
    ? Math.abs(config.transverterLoHz)
    : -Math.abs(config.transverterLoHz);
};

export const tunerToDisplayFrequencyHz = (
  tunerFrequencyHz: number,
  config: FrequencyMappingConfig
): number => {
  return Math.round(tunerFrequencyHz + config.ifOffsetHz + transverterContributionHz(config));
};

export const displayToTunerFrequencyHz = (
  displayFrequencyHz: number,
  config: FrequencyMappingConfig
): number => {
  return Math.round(displayFrequencyHz - config.ifOffsetHz - transverterContributionHz(config));
};

export const formatFrequencyModelSummary = (
  tunerFrequencyHz: number,
  config: FrequencyMappingConfig
): string => {
  const displayHz = tunerToDisplayFrequencyHz(tunerFrequencyHz, config);
  const ifText = config.ifOffsetHz === 0 ? 'IF 0 Hz' : `IF ${config.ifOffsetHz >= 0 ? '+' : ''}${config.ifOffsetHz.toLocaleString()} Hz`;
  const transverterText = config.transverterEnabled
    ? `Transverter ${config.transverterDirection} ${Math.abs(config.transverterLoHz).toLocaleString()} Hz`
    : 'Transverter off';

  return `Display ${displayHz.toLocaleString()} Hz | Tuner ${Math.round(tunerFrequencyHz).toLocaleString()} Hz | ${ifText} | ${transverterText}`;
};
