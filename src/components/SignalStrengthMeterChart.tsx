import { useMemo } from "react";
import SignalStrengthMeter from "./SignalStrengthMeter";
import { testSamples } from "../hooks/__test__/testSamples";
import { convertToSamples } from "../utils/dsp";

/**
 * Chart wrapper for SignalStrengthMeter
 * Uses test samples for visualization
 */
function SignalStrengthMeterChart(): React.JSX.Element {
  const samples = useMemo(
    () => convertToSamples(testSamples.slice(0, 1024) as [number, number][]),
    [],
  );

  return <SignalStrengthMeter samples={samples} />;
}

export default SignalStrengthMeterChart;
