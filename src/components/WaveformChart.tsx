import { useMemo } from "react";
import WaveformVisualizer from "./WaveformVisualizer";
import { testSamples } from "../hooks/__test__/testSamples";
import { convertToSamples } from "../utils/dsp";

function WaveformChart(): React.JSX.Element {
  const samples = useMemo(
    () => convertToSamples(testSamples.slice(0, 2048) as [number, number][]),
    [],
  );

  return <WaveformVisualizer samples={samples} width={750} height={300} />;
}

export default WaveformChart;
