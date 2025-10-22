import { useMemo } from "react";
import Spectrogram from "./Spectrogram";
import EmptyState from "./EmptyState";
import { calculateSpectrogram, Sample } from "../utils/dsp";

const DEFAULT_FFT_SIZE = 1024;
const DEFAULT_FRAME_COUNT = 32;

type FFTChartProps = {
  samples?: Sample[];
  width?: number;
  height?: number;
  fftSize?: number;
  freqMin?: number;
  freqMax?: number;
};

function FFTChart({
  samples = [],
  width = 750,
  height = 800,
  fftSize = DEFAULT_FFT_SIZE,
  freqMin = 1000,
  freqMax = 1100,
}: FFTChartProps): React.JSX.Element {
  const spectrogramData = useMemo(() => {
    if (samples.length < fftSize) {
      return [];
    }
    const windowSize = fftSize * DEFAULT_FRAME_COUNT;
    const windowed = samples.slice(Math.max(0, samples.length - windowSize));
    if (windowed.length < fftSize) {
      return [];
    }
    return calculateSpectrogram(windowed, fftSize);
  }, [samples, fftSize]);

  const hasData = spectrogramData.length > 0;

  if (!hasData) {
    return (
      <EmptyState
        width={width}
        height={height}
        title="Waiting for signal data"
        message="Connect and start reception to view spectrogram"
      />
    );
  }

  return (
    <Spectrogram
      fftData={spectrogramData}
      width={width}
      height={height}
      freqMin={freqMin}
      freqMax={freqMax}
    />
  );
}

export default FFTChart;
