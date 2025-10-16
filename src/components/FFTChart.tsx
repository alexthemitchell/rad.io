import { useMemo } from "react";
import Spectrogram from "./Spectrogram";
import { testSamples } from "../hooks/__test__/testSamples";
import { convertToSamples, calculateSpectrogram } from "../utils/dsp";

const fftSize = 1024;

function FFTChart(): React.JSX.Element {
  const spectrogramData = useMemo(() => {
    const samples = convertToSamples(testSamples as [number, number][]);
    return calculateSpectrogram(samples, fftSize);
  }, []);

  return (
    <Spectrogram
      fftData={spectrogramData}
      width={750}
      height={800}
      freqMin={1000}
      freqMax={1100}
    />
  );
}

export default FFTChart;
