import { describe, expect, it } from 'vitest';
import { assessIqIntegrityWizard } from './iqIntegrityWizard';

describe('assessIqIntegrityWizard', () => {
  it('reports healthy state when all IQ signals are nominal', () => {
    const assessment = assessIqIntegrityWizard({
      imageRejectionDb: 32,
      iqBalanceRatio: 1.02,
      iqDcOffset01: 0.02,
      iqPeakLinear: 0.68,
      sampleRateMismatchRisk: 'nominal'
    });

    expect(assessment.status).toBe('ok');
    expect(assessment.findings).toHaveLength(0);
    expect(assessment.fixes).toHaveLength(0);
  });

  it('flags multiple issues and dedupes suggested fixes', () => {
    const assessment = assessIqIntegrityWizard({
      imageRejectionDb: 12,
      iqBalanceRatio: 1.35,
      iqDcOffset01: 0.19,
      iqPeakLinear: 0.98,
      sampleRateMismatchRisk: 'critical'
    });

    expect(assessment.status).toBe('warn');
    expect(assessment.findings).toEqual([
      'mapping-risk',
      'scaling-mismatch',
      'dc-offset',
      'clipping-risk',
      'sample-rate-mismatch'
    ]);
    expect(assessment.fixes).toEqual([
      'enable-iq-correction',
      'reduce-front-end-gain',
      'set-latency-stable'
    ]);
  });
});
