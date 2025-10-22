import SignalStrengthMeter from "./SignalStrengthMeter";
import EmptyState from "./EmptyState";
import { Sample } from "../utils/dsp";

type SignalStrengthMeterChartProps = {
  samples?: Sample[];
};

/**
 * Chart wrapper for SignalStrengthMeter
 * Shows signal strength when data is available
 */
function SignalStrengthMeterChart({
  samples = [],
}: SignalStrengthMeterChartProps): React.JSX.Element {
  const hasData = samples.length > 0;

  if (!hasData) {
    return (
      <EmptyState
        width="100%"
        height="120px"
        title="Waiting for signal data"
        message="Connect and start reception to view signal strength"
      />
    );
  }

  return <SignalStrengthMeter samples={samples} />;
}

export default SignalStrengthMeterChart;
