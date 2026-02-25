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
      fftWindow: 'hann',
      fftEnbwBins: 1.5,
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
      markerB: {
        active: true,
        frequencyHz: 101_093_200,
        powerDbfs: -39.2,
        inView: true
      },
      analyzer: {
        semantics: {
          detectorMode: 'p95',
          traceMathMode: 'a-minus-b',
          rbwHz: 1464.8,
          vbwHz: 366.2,
          enbwBins: 1.5,
          noiseFloorEstimator: 'trimmed-mean-percentile',
          noiseFloorDbfs: -109.8
        },
        candidateStats: {
          strongestPeakDbfs: -39.2,
          strongestPeakSnrDb: 70.6,
          occupancy01: 0.12,
          persistence01: 0.34
        },
        traceSummary: {
          traceABinCount: 2048,
          traceBBinCount: 2048,
          stitchedSweepPointCount: 8192
        },
        markerTable: [
          {
            frequencyHz: 101_093_200,
            powerDbfs: -39.2,
            snrDb: 70.6,
            boundVfoId: 'main'
          }
        ],
        spurAnnotations: [
          {
            frequencyHz: 101_090_500,
            label: 'Clock spur',
            kind: 'device',
            masked: true
          }
        ]
      },
      exportedAtUtc: '2026-02-23T00:00:00.000Z'
    });

    expect(artifact.schemaVersion).toBe('1.3.0');
    expect(artifact.fft.window).toBe('hann');
    expect(artifact.fft.enbwBins).toBe(1.5);
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
    expect(artifact.visualization.markerB?.frequencyHz).toBe(101_093_200);
    expect(artifact.analyzer?.semantics.detectorMode).toBe('p95');
    expect(artifact.analyzer?.markerTable[0]?.boundVfoId).toBe('main');
    expect(artifact.exportedAtUtc).toBe('2026-02-23T00:00:00.000Z');
  });
});
