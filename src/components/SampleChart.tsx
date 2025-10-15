import { useMemo } from "react";
import IQConstellation from "./IQConstellation";
import { testSamples } from "../hooks/__test__/testSamples";
import { convertToSamples } from "../utils/dsp";

function SampleChart() {
  const samples = useMemo(
    () => convertToSamples(testSamples.slice(1024) as [number, number][]),
    [],
  );

  return <IQConstellation samples={samples} width={750} height={400} />;
}

export default SampleChart;
