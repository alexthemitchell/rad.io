import type { DisclosureCalibrationState } from './disclosure';
import type { SessionTrustGrade } from './sessionGradeUpgrade';

export type ExportIntegrityGrade = 'good' | 'warning' | 'degraded';

export type RecordingExportIntegrityInput = {
  lastFrameSequence: number | null;
  lastFrameSampleIndex: number | null;
  lastFrameTimestampNs: number | null;
  discontinuityEventTotal: number;
  calibrationState: DisclosureCalibrationState;
  trustGrade: SessionTrustGrade;
  sessionGradeLocked: boolean;
  droppedSamples: number;
  audioUnderruns: number;
};

export type RecordingExportIntegrityResult = {
  grade: ExportIntegrityGrade;
  warnings: string[];
};

export const validateRecordingExportIntegrity = (
  input: RecordingExportIntegrityInput
): RecordingExportIntegrityResult => {
  const warnings: string[] = [];

  if (input.lastFrameSequence === null || input.lastFrameSampleIndex === null || input.lastFrameTimestampNs === null) {
    warnings.push('missing continuity markers (sequence/sample-index/timestamp)');
  }

  if (input.discontinuityEventTotal > 0) {
    warnings.push(`discontinuities recorded (${input.discontinuityEventTotal})`);
  }

  if (input.calibrationState === 'uncalibrated') {
    warnings.push('calibration snapshot unavailable');
  }

  if (input.droppedSamples > 0 || input.audioUnderruns > 0) {
    warnings.push('runtime data loss detected (drops/underruns)');
  }

  if (!input.sessionGradeLocked) {
    warnings.push('session grade not locked for reproducibility');
  }

  if (input.trustGrade === 'degraded') {
    warnings.push('session trust degraded');
  }

  if (input.trustGrade === 'degraded' || warnings.some((warning) => warning.includes('missing continuity markers'))) {
    return {
      grade: 'degraded',
      warnings
    };
  }

  if (warnings.length > 0) {
    return {
      grade: 'warning',
      warnings
    };
  }

  return {
    grade: 'good',
    warnings: []
  };
};
