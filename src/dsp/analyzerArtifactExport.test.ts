import { describe, expect, it } from 'vitest';
import { createAnalyzerArtifactExport } from './analyzerArtifactExport';

describe('createAnalyzerArtifactExport', () => {
  it('creates deterministic analyzer export payload when timestamp is supplied', () => {
    const artifact = createAnalyzerArtifactExport({
      sourceType: 'FILE',
      demodMode: 'WFM',
      tunedFrequencyHz: 101_100_000,
      fineTuneHz: 0,
      fftSize: 2048,
      fftAveragingMode: 'linear',
      fftAveragingValue: 12,
      fftReferenceLevelDb: -18,
      fftPeakHoldEnabled: true,
      sampleRateHzHint: 2_000_000,
      frequencyModel: {
        ppmCorrectionHz: 0,
        afcCorrectionHz: -12,
        totalCorrectionHz: -12,
        driftEstimateHzPerSec: -0.2,
        driftConfidence: 0.8,
        phaseErrorRms: 0.04
      },
      audioPll: {
        ratio: 1.0002,
        targetQueueMs: 120,
        queueErrorMs: -4
      },
      zoomLevel: 3,
      waterfallPalette: 'inferno',
      waterfallAutoScale: false,
      waterfallMinDb: -110,
      waterfallMaxDb: -20,
      marker: {
        active: true,
        frequencyHz: 101_090_500,
        powerDbfs: -41.5,
        inView: true
      },
      exportedAtUtc: '2026-02-23T00:00:00.000Z'
    });

    expect(artifact.schemaVersion).toBe('1.1.0');
    expect(artifact.fft.window).toBe('rectangular');
    expect(artifact.fft.enbwBins).toBe(1);
    expect(artifact.fft.averagingMode).toBe('linear');
    expect(artifact.fft.averagingValue).toBe(12);
    expect(artifact.fft.peakHoldEnabled).toBe(true);
    expect(artifact.fft.referenceLevelDb).toBe(-18);
    expect(artifact.pipeline.sourceType).toBe('FILE');
    expect(artifact.pipeline.frequencyModel.totalCorrectionHz).toBe(-12);
    expect(artifact.pipeline.audioPll.targetQueueMs).toBe(120);
    expect(artifact.visualization.waterfallPalette).toBe('inferno');
    expect(artifact.visualization.marker.active).toBe(true);
    expect(artifact.visualization.marker.frequencyHz).toBe(101_090_500);
    expect(artifact.exportedAtUtc).toBe('2026-02-23T00:00:00.000Z');
  });
});
