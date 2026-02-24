import { describe, expect, it } from 'vitest';
import {
  createDefaultRuntimeTelemetry,
  computeDemodQualityTelemetry,
  computeDspAmplitudeTelemetry,
  createAgcTelemetryBaseline
} from './runtimeTelemetryContract';

describe('runtimeTelemetryContract', () => {
  it('computes amplitude metrics for deterministic IQ and audio windows', () => {
    const shiftedIq = new Float32Array([
      64, 0,
      0, 64,
      -64, 0,
      0, -64
    ]);

    const audio = new Float32Array([0.2, -0.2, 0.1, -0.1, 0.05, -0.05]);
    const metrics = computeDspAmplitudeTelemetry(shiftedIq, audio);

    expect(metrics.sampleCount).toBe(audio.length);
    expect(metrics.iqPeakLinear).toBeCloseTo(0.5, 6);
    expect(metrics.iqRmsLinear).toBeCloseTo(0.5, 6);
    expect(metrics.iqCrestFactor).toBeCloseTo(1, 6);
    expect(metrics.audioRmsLinear).toBeGreaterThan(0.09);
    expect(metrics.audioPeakLinear).toBeCloseTo(0.2, 6);
    expect(metrics.audioClippingRatio).toBe(0);
  });

  it('flags clipping and low quality in demod quality metrics', () => {
    const shiftedIq = new Float32Array([
      2, 2,
      2, 2,
      2, 2,
      2, 2
    ]);
    const audio = new Float32Array([1, -1, 0.99, -0.99, 1, -1]);

    const amplitude = computeDspAmplitudeTelemetry(shiftedIq, audio);
    const quality = computeDemodQualityTelemetry({
      mode: 'NFM',
      lockState: 'degraded',
      quality: 0.4,
      snrEstimateDb: 6,
      pilotLevel: 0,
      carrierLevel: 0,
      deviationEstimate: 0.2
    }, amplitude, null);

    expect(quality.signalPresent).toBe(true);
    expect(quality.reasons).toContain('audio_clipping');
    expect(quality.qualityScore01).toBeLessThan(0.5);
    expect(quality.rdsSynced).toBeNull();
    expect(quality.rdsBlockErrorRate).toBeNull();
  });

  it('boosts WFM quality when RDS is synchronized', () => {
    const shiftedIq = new Float32Array([
      32, 0,
      0, 32,
      -32, 0,
      0, -32
    ]);
    const audio = new Float32Array([0.2, -0.18, 0.16, -0.14, 0.12, -0.1]);

    const amplitude = computeDspAmplitudeTelemetry(shiftedIq, audio);
    const demodMetrics = {
      mode: 'WFM' as const,
      lockState: 'locked' as const,
      quality: 0.8,
      snrEstimateDb: 18,
      pilotLevel: 0.65,
      carrierLevel: 0,
      deviationEstimate: 0.15
    };

    const withRds = computeDemodQualityTelemetry(demodMetrics, amplitude, {
      synced: true,
      totalBlocks: 128,
      totalGroups: 48,
      blockErrorRate: 0.05,
      piCode: 0x2047,
      callsignCandidate: 'KEXP',
      ptyCode: 10,
      ptyName: 'Pop Music',
      tp: true,
      ta: false,
      ms: true,
      ps: 'KEXP FM',
      radiotext: 'Now playing test vectors',
      latestGroup: '0A'
    });

    const withoutRds = computeDemodQualityTelemetry(demodMetrics, amplitude, null);

    expect(withRds.rdsSynced).toBe(true);
    expect(withRds.rdsBlockErrorRate).toBeCloseTo(0.05, 6);
    expect(withRds.qualityScore01).toBeGreaterThanOrEqual(withoutRds.qualityScore01);
  });

  it('exposes AGC baseline contract as not yet implemented', () => {
    const agc = createAgcTelemetryBaseline();

    expect(agc.implemented).toBe(false);
    expect(agc.mode).toBe('none');
    expect(agc.state).toBe('not_available');
    expect(agc.targetLevelDbfs).toBeNull();
    expect(agc.estimatedGainDb).toBeNull();
  });

  it('creates a default runtime telemetry envelope with schema and subcontracts', () => {
    const telemetry = createDefaultRuntimeTelemetry('direct');

    expect(telemetry.telemetrySchemaVersion).toBe('1.1.0');
    expect(telemetry.workerTransportMode).toBe('direct');
    expect(telemetry.dsp.amplitude.contractVersion).toBe('1.0.0');
    expect(telemetry.dsp.demodQuality.contractVersion).toBe('1.0.0');
    expect(telemetry.dsp.pipelineTiming.contractVersion).toBe('1.0.0');
    expect(telemetry.agc.implemented).toBe(false);
  });
});
