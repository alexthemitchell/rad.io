import { useMemo } from "react";
import Spectrogram from "./Spectrogram";
import { testSamples } from "../hooks/__test__/testSamples";
import { convertToSamples, calculateSpectrogram, Sample } from "../utils/dsp";

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
  samples,
  width = 750,
  height = 800,
  fftSize = DEFAULT_FFT_SIZE,
  freqMin = 1000,
  freqMax = 1100,
}: FFTChartProps): React.JSX.Element {
  const fallbackSamples = useMemo(
    () => convertToSamples(testSamples as [number, number][]),
    [],
  );

  const spectrogramData = useMemo(() => {
    const sourceSamples =
      samples && samples.length > 0 ? samples : fallbackSamples;
    if (sourceSamples.length < fftSize) {
      return [];
    }
    const windowSize = fftSize * DEFAULT_FRAME_COUNT;
    const windowed = sourceSamples.slice(
      Math.max(0, sourceSamples.length - windowSize),
    );
    if (windowed.length < fftSize) {
      return [];
    }
    return calculateSpectrogram(windowed, fftSize);
  }, [samples, fallbackSamples, fftSize]);

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
