import { useMemo } from "react";
import WaveformVisualizer from "./WaveformVisualizer";
import { testSamples } from "../hooks/__test__/testSamples";
import { convertToSamples, Sample } from "../utils/dsp";

type WaveformChartProps = {
  samples?: Sample[];
  width?: number;
  height?: number;
};

function WaveformChart({
  samples,
  width = 750,
  height = 300,
}: WaveformChartProps): React.JSX.Element {
  const fallbackSamples = useMemo(
    () => convertToSamples(testSamples.slice(0, 2048) as [number, number][]),
    [],
  );

  const displaySamples = useMemo(() => {
    if (samples && samples.length > 0) {
      return samples;
    }
    return fallbackSamples;
  }, [samples, fallbackSamples]);

  return (
    <WaveformVisualizer
      samples={displaySamples}
      width={width}
      height={height}
    />
  );
}

export default WaveformChart;
