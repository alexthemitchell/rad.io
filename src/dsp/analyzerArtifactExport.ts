export type AnalyzerArtifactExportV1 = {
  schemaVersion: '1.0.0';
  exportedAtUtc: string;
  fft: {
    size: number;
    window: 'rectangular';
    enbwBins: number;
    averagingMode: 'none';
    reference: 'dBFS';
  };
  visualization: {
    zoomLevel: number;
    waterfallPalette: 'cividis' | 'inferno';
    waterfallAutoScale: boolean;
    waterfallMinDb: number;
    waterfallMaxDb: number;
  };
  pipeline: {
    sourceType: 'MOCK' | 'HACKRF' | 'RTLSDR' | 'FILE';
    demodMode: 'WFM' | 'AM' | 'NFM' | 'SAM' | 'USB' | 'LSB' | 'CW';
    tunedFrequencyHz: number;
    fineTuneHz: number;
    sampleRateHzHint: number;
    frequencyModel: {
      ppmCorrectionHz: number;
      afcCorrectionHz: number;
      totalCorrectionHz: number;
      driftEstimateHzPerSec: number;
      driftConfidence: number;
      phaseErrorRms: number;
    };
    audioPll: {
      ratio: number;
      targetQueueMs: number;
      queueErrorMs: number;
    };
  };
};

export const createAnalyzerArtifactExport = (input: {
  sourceType: AnalyzerArtifactExportV1['pipeline']['sourceType'];
  demodMode: AnalyzerArtifactExportV1['pipeline']['demodMode'];
  tunedFrequencyHz: number;
  fineTuneHz: number;
  fftSize: number;
  sampleRateHzHint: number;
  frequencyModel: AnalyzerArtifactExportV1['pipeline']['frequencyModel'];
  audioPll: AnalyzerArtifactExportV1['pipeline']['audioPll'];
  zoomLevel: number;
  waterfallPalette: AnalyzerArtifactExportV1['visualization']['waterfallPalette'];
  waterfallAutoScale: boolean;
  waterfallMinDb: number;
  waterfallMaxDb: number;
  exportedAtUtc?: string;
}): AnalyzerArtifactExportV1 => {
  return {
    schemaVersion: '1.0.0',
    exportedAtUtc: input.exportedAtUtc ?? new Date().toISOString(),
    fft: {
      size: input.fftSize,
      window: 'rectangular',
      enbwBins: 1,
      averagingMode: 'none',
      reference: 'dBFS'
    },
    visualization: {
      zoomLevel: input.zoomLevel,
      waterfallPalette: input.waterfallPalette,
      waterfallAutoScale: input.waterfallAutoScale,
      waterfallMinDb: input.waterfallMinDb,
      waterfallMaxDb: input.waterfallMaxDb
    },
    pipeline: {
      sourceType: input.sourceType,
      demodMode: input.demodMode,
      tunedFrequencyHz: input.tunedFrequencyHz,
      fineTuneHz: input.fineTuneHz,
      sampleRateHzHint: input.sampleRateHzHint,
      frequencyModel: input.frequencyModel,
      audioPll: input.audioPll
    }
  };
};
