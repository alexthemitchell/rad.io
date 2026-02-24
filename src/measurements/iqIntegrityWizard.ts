export type IqIntegrityWizardFinding =
  | 'mapping-risk'
  | 'scaling-mismatch'
  | 'dc-offset'
  | 'clipping-risk'
  | 'sample-rate-mismatch';

export type IqIntegrityWizardFix =
  | 'enable-iq-correction'
  | 'reduce-front-end-gain'
  | 'set-latency-stable';

export type IqIntegrityWizardAssessment = {
  status: 'ok' | 'warn';
  findings: IqIntegrityWizardFinding[];
  fixes: IqIntegrityWizardFix[];
  summary: string;
};

export type IqIntegrityWizardInput = {
  imageRejectionDb: number;
  iqBalanceRatio: number;
  iqDcOffset01: number;
  iqPeakLinear: number;
  sampleRateMismatchRisk: 'nominal' | 'warn' | 'critical';
};

const dedupe = <T,>(values: T[]): T[] => Array.from(new Set(values));

export const assessIqIntegrityWizard = (input: IqIntegrityWizardInput): IqIntegrityWizardAssessment => {
  const findings: IqIntegrityWizardFinding[] = [];
  const fixes: IqIntegrityWizardFix[] = [];

  if (input.imageRejectionDb < 18) {
    findings.push('mapping-risk');
    fixes.push('enable-iq-correction');
  }

  if (input.iqBalanceRatio < 0.75 || input.iqBalanceRatio > 1.25) {
    findings.push('scaling-mismatch');
    fixes.push('enable-iq-correction');
  }

  if (input.iqDcOffset01 > 0.12) {
    findings.push('dc-offset');
    fixes.push('enable-iq-correction');
  }

  if (input.iqPeakLinear > 0.95) {
    findings.push('clipping-risk');
    fixes.push('reduce-front-end-gain');
  }

  if (input.sampleRateMismatchRisk !== 'nominal') {
    findings.push('sample-rate-mismatch');
    fixes.push('set-latency-stable');
  }

  const uniqueFindings = dedupe(findings);
  const uniqueFixes = dedupe(fixes);

  if (uniqueFindings.length === 0) {
    return {
      status: 'ok',
      findings: [],
      fixes: [],
      summary: 'IQ integrity checks look healthy for this session.'
    };
  }

  return {
    status: 'warn',
    findings: uniqueFindings,
    fixes: uniqueFixes,
    summary: `Detected ${uniqueFindings.length} IQ integrity risk signal(s). Apply guided fixes and persist profile if stable.`
  };
};
