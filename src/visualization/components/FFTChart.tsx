import { useMemo, useRef } from "react";
import { calculateSpectrogram, type Sample } from "../../utils/dsp";
import { Spectrogram } from "../index";
import EmptyState from "../../components/EmptyState";

const DEFAULT_FFT_SIZE = 1024;
const DEFAULT_FRAME_COUNT = 32;
const MIN_UPDATE_INTERVAL_MS = 100; // Throttle to max 10 updates/sec to reduce memory pressure

export type FFTChartProps = {
  samples?: Sample[];
  width?: number;
  height?: number;
  fftSize?: number;
  freqMin?: number;
  freqMax?: number;
  mode?: "spectrogram" | "waterfall";
  maxWaterfallFrames?: number;
};

function FFTChart({
  samples = [],
  width = 750,
  height = 800,
  fftSize = DEFAULT_FFT_SIZE,
  freqMin = 1000,
  freqMax = 1100,
  mode = "spectrogram",
  maxWaterfallFrames = 100,
}: FFTChartProps): React.JSX.Element {
  const lastUpdateRef = useRef<number>(0);
  const cachedDataRef = useRef<Float32Array[]>([]);

  const spectrogramData = useMemo(() => {
    if (samples.length < fftSize) {
      return [];
    }

    // Throttle recalculation to reduce memory churn
    const now = performance.now();
    if (now - lastUpdateRef.current < MIN_UPDATE_INTERVAL_MS) {
      return cachedDataRef.current;
    }

    const windowSize = fftSize * DEFAULT_FRAME_COUNT;
    const windowed = samples.slice(Math.max(0, samples.length - windowSize));
    if (windowed.length < fftSize) {
      return [];
    }

    lastUpdateRef.current = now;
    const result = calculateSpectrogram(windowed, fftSize);
    cachedDataRef.current = result;
    return result;
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
      mode={mode}
      maxWaterfallFrames={maxWaterfallFrames}
    />
  );
}

export default FFTChart;
