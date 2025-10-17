import { useMemo } from "react";
import IQConstellation from "./IQConstellation";
import { testSamples } from "../hooks/__test__/testSamples";
import { convertToSamples, Sample } from "../utils/dsp";

type SampleChartProps = {
  samples?: Sample[];
  width?: number;
  height?: number;
};

function SampleChart({
  samples,
  width = 750,
  height = 400,
}: SampleChartProps): React.JSX.Element {
  const fallbackSamples = useMemo(
    () => convertToSamples(testSamples.slice(1024) as [number, number][]),
    [],
  );

  const displaySamples = useMemo(() => {
    if (samples && samples.length > 0) {
      return samples;
    }
    return fallbackSamples;
  }, [samples, fallbackSamples]);

  return (
    <IQConstellation samples={displaySamples} width={width} height={height} />
  );
}

export default SampleChart;
