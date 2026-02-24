export type HardwareSanitySelfTestInput = {
  sampleFormatOk: boolean;
  iqOrderingOk: boolean;
  dcOffset01: number;
  clockOffsetPpm: number;
  gainStepEffective: boolean;
  continuityOk: boolean;
};

export type HardwareSanityCheckResult = {
  key: 'sample-format' | 'iq-ordering' | 'dc-offset' | 'clock-offset' | 'gain-step' | 'stream-continuity';
  passed: boolean;
  detail: string;
};

export type HardwareSanitySelfTestReport = {
  passed: boolean;
  checks: HardwareSanityCheckResult[];
  summary: string;
};

export const runHardwareSanitySelfTest = (
  input: HardwareSanitySelfTestInput
): HardwareSanitySelfTestReport => {
  const checks: HardwareSanityCheckResult[] = [
    {
      key: 'sample-format',
      passed: input.sampleFormatOk,
      detail: input.sampleFormatOk
        ? 'Sample format and stream framing look valid.'
        : 'Sample format/framing failed basic sanity checks.'
    },
    {
      key: 'iq-ordering',
      passed: input.iqOrderingOk,
      detail: input.iqOrderingOk
        ? 'IQ ordering/sign checks are within expected bounds.'
        : 'IQ ordering/sign risk detected; run IQ wizard fixes.'
    },
    {
      key: 'dc-offset',
      passed: input.dcOffset01 <= 0.12,
      detail: `DC offset indicator ${(input.dcOffset01 * 100).toFixed(1)}% (target <= 12%).`
    },
    {
      key: 'clock-offset',
      passed: Math.abs(input.clockOffsetPpm) <= 220,
      detail: `Clock offset ${input.clockOffsetPpm.toFixed(1)} ppm (target <= 220 ppm).`
    },
    {
      key: 'gain-step',
      passed: input.gainStepEffective,
      detail: input.gainStepEffective
        ? 'Gain-step response observed in live IQ amplitude.'
        : 'Gain-step effect was weak; verify front-end gain path.'
    },
    {
      key: 'stream-continuity',
      passed: input.continuityOk,
      detail: input.continuityOk
        ? 'No continuity failures detected during self-test window.'
        : 'Dropped samples/discontinuities observed during self-test window.'
    }
  ];

  const passed = checks.every((check) => check.passed);
  return {
    passed,
    checks,
    summary: passed
      ? 'Hardware sanity self-test passed.'
      : `Hardware sanity self-test failed (${checks.filter((check) => !check.passed).length} checks).`
  };
};
