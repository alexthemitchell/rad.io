import { describe, expect, it } from 'vitest';
import { validateRecordingExportIntegrity } from './recordingExportIntegrityValidator';

describe('validateRecordingExportIntegrity', () => {
  it('returns good when required integrity signals are present', () => {
    const result = validateRecordingExportIntegrity({
      lastFrameSequence: 1024,
      lastFrameSampleIndex: 2_048_000,
      lastFrameTimestampNs: 1_772_809_600_123,
      discontinuityEventTotal: 0,
      calibrationState: 'calibrated',
      trustGrade: 'measurement',
      sessionGradeLocked: true,
      droppedSamples: 0,
      audioUnderruns: 0
    });

    expect(result.grade).toBe('good');
    expect(result.warnings).toEqual([]);
  });

  it('returns warning for non-critical integrity gaps', () => {
    const result = validateRecordingExportIntegrity({
      lastFrameSequence: 2048,
      lastFrameSampleIndex: 3_072_000,
      lastFrameTimestampNs: 1_772_809_601_123,
      discontinuityEventTotal: 2,
      calibrationState: 'approximate',
      trustGrade: 'listening',
      sessionGradeLocked: false,
      droppedSamples: 0,
      audioUnderruns: 0
    });

    expect(result.grade).toBe('warning');
    expect(result.warnings.join(' | ')).toContain('discontinuities recorded (2)');
    expect(result.warnings.join(' | ')).toContain('session grade not locked');
  });

  it('returns degraded when continuity markers are missing or trust is degraded', () => {
    const missingMarkers = validateRecordingExportIntegrity({
      lastFrameSequence: null,
      lastFrameSampleIndex: null,
      lastFrameTimestampNs: null,
      discontinuityEventTotal: 0,
      calibrationState: 'calibrated',
      trustGrade: 'measurement',
      sessionGradeLocked: true,
      droppedSamples: 0,
      audioUnderruns: 0
    });

    expect(missingMarkers.grade).toBe('degraded');
    expect(missingMarkers.warnings.join(' | ')).toContain('missing continuity markers');

    const degradedTrust = validateRecordingExportIntegrity({
      lastFrameSequence: 1,
      lastFrameSampleIndex: 1,
      lastFrameTimestampNs: 1,
      discontinuityEventTotal: 0,
      calibrationState: 'calibrated',
      trustGrade: 'degraded',
      sessionGradeLocked: true,
      droppedSamples: 0,
      audioUnderruns: 0
    });

    expect(degradedTrust.grade).toBe('degraded');
    expect(degradedTrust.warnings.join(' | ')).toContain('session trust degraded');
  });
});
