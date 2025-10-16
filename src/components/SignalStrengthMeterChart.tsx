import { useMemo } from "react";
import SignalStrengthMeter from "./SignalStrengthMeter";
import { testSamples } from "../hooks/__test__/testSamples";
import { convertToSamples, Sample } from "../utils/dsp";

type SignalStrengthMeterChartProps = {
  samples?: Sample[];
};

/**
 * Chart wrapper for SignalStrengthMeter
 * Uses live samples when available, falls back to test data otherwise
 */
function SignalStrengthMeterChart({
  samples,
}: SignalStrengthMeterChartProps): React.JSX.Element {
  const fallbackSamples = useMemo(
    () => convertToSamples(testSamples.slice(0, 1024) as [number, number][]),
    [],
  );

  const displaySamples = useMemo(() => {
    if (samples && samples.length > 0) {
      return samples;
    }
    return fallbackSamples;
  }, [samples, fallbackSamples]);

  return <SignalStrengthMeter samples={displaySamples} />;
}

export default SignalStrengthMeterChart;
