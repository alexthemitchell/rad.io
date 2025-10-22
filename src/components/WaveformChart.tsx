import WaveformVisualizer from "./WaveformVisualizer";
import EmptyState from "./EmptyState";
import { Sample } from "../utils/dsp";

type WaveformChartProps = {
  samples?: Sample[];
  width?: number;
  height?: number;
};

function WaveformChart({
  samples = [],
  width = 750,
  height = 300,
}: WaveformChartProps): React.JSX.Element {
  const hasData = samples.length > 0;

  if (!hasData) {
    return (
      <EmptyState
        width={width}
        height={height}
        title="Waiting for signal data"
        message="Connect and start reception to view amplitude waveform"
      />
    );
  }

  return <WaveformVisualizer samples={samples} width={width} height={height} />;
}

export default WaveformChart;
