import { describe, expect, it } from 'vitest';
import {
  deriveSessionLockInvalidationReason,
  evaluateSessionGradeUpgrade,
  type SessionGradeEvaluationInput
} from './sessionGradeUpgrade';

describe('sessionGradeUpgrade', () => {
  it('marks session lock eligible when all checks pass and trust is not degraded', () => {
    const input: SessionGradeEvaluationInput = {
      stableWindowSeconds: 45,
      minStableWindowSeconds: 30,
      hasCalibration: true,
      crossOriginIsolated: true,
      hasKnownGoodProfile: true,
      trustGrade: 'measurement'
    };

    const evaluation = evaluateSessionGradeUpgrade(input);

    expect(evaluation.eligibleToLock).toBe(true);
    expect(evaluation.lockBlockedReason).toBeNull();
    expect(evaluation.checks.every((check) => check.passed)).toBe(true);
  });

  it('blocks session lock when checks fail or trust is degraded', () => {
    const failedChecks = evaluateSessionGradeUpgrade({
      stableWindowSeconds: 10,
      minStableWindowSeconds: 30,
      hasCalibration: false,
      crossOriginIsolated: false,
      hasKnownGoodProfile: false,
      trustGrade: 'listening'
    });

    expect(failedChecks.eligibleToLock).toBe(false);
    expect(failedChecks.lockBlockedReason).toContain('Complete all session grade checks');

    const degradedTrust = evaluateSessionGradeUpgrade({
      stableWindowSeconds: 45,
      minStableWindowSeconds: 30,
      hasCalibration: true,
      crossOriginIsolated: true,
      hasKnownGoodProfile: true,
      trustGrade: 'degraded'
    });

    expect(degradedTrust.eligibleToLock).toBe(false);
    expect(degradedTrust.lockBlockedReason).toContain('Session trust is degraded');
  });

  it('derives lock invalidation reason from trust degradation', () => {
    expect(deriveSessionLockInvalidationReason('listening', [])).toBeNull();
    expect(deriveSessionLockInvalidationReason('degraded', [])).toBe('session trust degraded');
    expect(deriveSessionLockInvalidationReason('degraded', ['audio-underruns'])).toBe(
      'session trust degraded (audio-underruns)'
    );
  });
});
