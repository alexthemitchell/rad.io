/**
 * Grid utilities shared across spectrum and waterfall renderers
 */

export const DEFAULT_MARGIN = {
  top: 60,
  bottom: 60,
  left: 80,
  right: 40,
} as const;
export const WATERFALL_MARGIN = {
  top: 70,
  bottom: 70,
  left: 80,
  right: 120,
} as const;

export function determineGridSpacing(
  bandwidth: number,
  chartWidth: number,
): { spacing: number; formatter: (freq: number) => string } {
  const niceSteps = [
    1e3, 2e3, 5e3, 10e3, 20e3, 50e3, 100e3, 200e3, 500e3, 1e6, 2e6, 5e6, 10e6,
    20e6, 50e6, 100e6,
  ];
  const maxLines = Math.max(4, Math.floor(chartWidth / 110));
  for (const step of niceSteps) {
    if (bandwidth / step <= maxLines) {
      return { spacing: step, formatter: getGridLabelFormatter(step) };
    }
  }
  const fallback = niceSteps[niceSteps.length - 1] ?? 1e6;
  return { spacing: fallback, formatter: getGridLabelFormatter(fallback) };
}

export function getGridLabelFormatter(step: number): (freq: number) => string {
  if (step >= 1e6) {
    const decimals = step >= 5e6 ? 0 : 1;
    return (freq: number) => `${(freq / 1e6).toFixed(decimals)} MHz`;
  }
  if (step >= 1e3) {
    const decimals = step >= 5e3 ? 0 : 1;
    return (freq: number) => `${(freq / 1e3).toFixed(decimals)} kHz`;
  }
  return (freq: number) => `${freq.toFixed(0)} Hz`;
}

export default {
  DEFAULT_MARGIN,
  WATERFALL_MARGIN,
  determineGridSpacing,
  getGridLabelFormatter,
};
