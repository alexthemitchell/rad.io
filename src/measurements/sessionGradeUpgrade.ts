export type SessionTrustGrade = 'measurement' | 'listening' | 'degraded';

export type SessionGradeCheckKey =
  | 'stability_window'
  | 'calibration_present'
  | 'isolation_ready'
  | 'known_good_profile';

export type SessionGradeCheck = {
  key: SessionGradeCheckKey;
  label: string;
  passed: boolean;
  detail: string;
};

export type SessionGradeEvaluationInput = {
  stableWindowSeconds: number;
  minStableWindowSeconds: number;
  hasCalibration: boolean;
  crossOriginIsolated: boolean;
  hasKnownGoodProfile: boolean;
  trustGrade: SessionTrustGrade;
};

export type SessionGradeEvaluation = {
  checks: SessionGradeCheck[];
  eligibleToLock: boolean;
  lockBlockedReason: string | null;
};

export const evaluateSessionGradeUpgrade = (
  input: SessionGradeEvaluationInput
): SessionGradeEvaluation => {
  const checks: SessionGradeCheck[] = [
    {
      key: 'stability_window',
      label: `Stability window >= ${Math.round(input.minStableWindowSeconds)} s with zero drops`,
      passed: input.stableWindowSeconds >= input.minStableWindowSeconds,
      detail: `${input.stableWindowSeconds.toFixed(1)} s observed`
    },
    {
      key: 'calibration_present',
      label: 'Calibration disclosure available',
      passed: input.hasCalibration,
      detail: input.hasCalibration ? 'calibration present' : 'calibration missing'
    },
    {
      key: 'isolation_ready',
      label: 'Cross-origin isolation enabled',
      passed: input.crossOriginIsolated,
      detail: input.crossOriginIsolated ? 'isolation ready' : 'isolation missing'
    },
    {
      key: 'known_good_profile',
      label: 'Known-good device profile available',
      passed: input.hasKnownGoodProfile,
      detail: input.hasKnownGoodProfile ? 'profile present' : 'profile missing'
    }
  ];

  const allChecksPass = checks.every((check) => check.passed);
  if (!allChecksPass) {
    return {
      checks,
      eligibleToLock: false,
      lockBlockedReason: 'Complete all session grade checks before locking.'
    };
  }

  if (input.trustGrade === 'degraded') {
    return {
      checks,
      eligibleToLock: false,
      lockBlockedReason: 'Session trust is degraded; resolve telemetry issues before locking.'
    };
  }

  return {
    checks,
    eligibleToLock: true,
    lockBlockedReason: null
  };
};

export const deriveSessionLockInvalidationReason = (
  trustGrade: SessionTrustGrade,
  trustReasons: string[]
): string | null => {
  if (trustGrade !== 'degraded') {
    return null;
  }

  if (trustReasons.length === 0) {
    return 'session trust degraded';
  }

  return `session trust degraded (${trustReasons.join(', ')})`;
};
