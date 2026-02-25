export type RestoreSafetySnapshot = {
  sourceType: 'MOCK' | 'HACKRF' | 'RTLSDR' | 'FILE';
  demodMode: 'WFM' | 'NFM' | 'AM' | 'SAM' | 'USB' | 'LSB' | 'CW';
  frequencyHz: number;
  fineFreqHz: number;
  ppmCorrection: number;
};

export type RestoreSafetyAssessment = {
  requiresConfirmation: boolean;
  severity: 'none' | 'warn';
  reasons: string[];
  summary: string;
};

export const assessRestoreSafety = (snapshot: RestoreSafetySnapshot): RestoreSafetyAssessment => {
  const reasons: string[] = [];

  if (Math.abs(snapshot.ppmCorrection) > 15) {
    reasons.push(`PPM correction ${snapshot.ppmCorrection.toFixed(1)} is outside the typical stability range`);
  }

  if (Math.abs(snapshot.fineFreqHz) > 150_000) {
    reasons.push(`Fine tune offset ${Math.round(snapshot.fineFreqHz).toLocaleString()} Hz is unusually large`);
  }

  if (!Number.isFinite(snapshot.frequencyHz) || snapshot.frequencyHz < 100_000 || snapshot.frequencyHz > 6_000_000_000) {
    reasons.push('Restored frequency looks out of expected SDR tuning range');
  }

  if (snapshot.sourceType !== 'FILE' && snapshot.demodMode === 'WFM' && snapshot.frequencyHz < 30_000_000) {
    reasons.push('WFM mode in HF range may be accidental for this restore');
  }

  if (reasons.length === 0) {
    return {
      requiresConfirmation: false,
      severity: 'none',
      reasons: [],
      summary: 'Restore settings look low-risk and can be applied directly.'
    };
  }

  return {
    requiresConfirmation: true,
    severity: 'warn',
    reasons,
    summary: 'Restore includes potentially risky settings. Confirm before applying.'
  };
};
