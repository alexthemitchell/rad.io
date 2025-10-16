import { useMemo } from "react";
import WaterfallDisplay from "./WaterfallDisplay";
import { testSamples } from "../hooks/__test__/testSamples";
import { convertToSamples, calculateSpectrogram } from "../utils/dsp";

const fftSize = 1024;

function WaterfallChart(): React.JSX.Element {
  const spectrogramData = useMemo(() => {
    const samples = convertToSamples(testSamples as [number, number][]);
    return calculateSpectrogram(samples, fftSize);
  }, []);

  return (
    <WaterfallDisplay
      fftData={spectrogramData}
      width={750}
      height={800}
      freqMin={1000}
      freqMax={1100}
      scrollSpeed={2}
      maxHistory={800}
    />
  );
}

export default WaterfallChart;
