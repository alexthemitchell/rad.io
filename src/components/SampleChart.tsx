import IQConstellation from "./IQConstellation";
import EmptyState from "./EmptyState";
import type { Sample } from "../utils/dsp";

type SampleChartProps = {
  samples?: Sample[];
  width?: number;
  height?: number;
};

function SampleChart({
  samples = [],
  width = 750,
  height = 400,
}: SampleChartProps): React.JSX.Element {
  const hasData = samples.length > 0;

  if (!hasData) {
    return (
      <EmptyState
        width={width}
        height={height}
        title="Waiting for signal data"
        message="Connect and start reception to view IQ constellation"
      />
    );
  }

  return <IQConstellation samples={samples} width={width} height={height} />;
}

export default SampleChart;
