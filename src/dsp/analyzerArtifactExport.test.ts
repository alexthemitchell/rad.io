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
      sampleRateHzHint: 2_000_000,
      zoomLevel: 3,
      waterfallPalette: 'inferno',
      waterfallAutoScale: false,
      waterfallMinDb: -110,
      waterfallMaxDb: -20,
      exportedAtUtc: '2026-02-23T00:00:00.000Z'
    });

    expect(artifact.schemaVersion).toBe('1.0.0');
    expect(artifact.fft.window).toBe('rectangular');
    expect(artifact.fft.enbwBins).toBe(1);
    expect(artifact.pipeline.sourceType).toBe('FILE');
    expect(artifact.visualization.waterfallPalette).toBe('inferno');
    expect(artifact.exportedAtUtc).toBe('2026-02-23T00:00:00.000Z');
  });
});
