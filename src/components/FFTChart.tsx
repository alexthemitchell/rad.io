import { AxisBottom, AxisLeft } from "@visx/axis";
import { scaleLinear, scaleTime } from "@visx/scale";
import { Group } from "@visx/group";
import { HeatmapRect } from "@visx/heatmap";
import webfft from "webfft";
import { interpolateTurbo } from "d3-scale-chromatic";

import { testSamples } from "../hooks/__test__/testSamples";

type Sample = {
  I: number;
  Q: number;
};

const samples = testSamples.map(([i, q]) => {
  if (i === undefined || q === undefined) {
    throw new Error("invalid sample");
  }
  const sample: Sample = {
    I: i,
    Q: q,
  };
  return sample;
});

// Spectogram is a 2D array with rows of length fftsize
const fftSize = 1024;
const rowCount = Math.floor(samples.length / fftSize);

function calculateSpectrogramRow(rowNumber: number) {
  // Get Samples
  const startIndex = rowNumber * fftSize;
  const endIndex = startIndex + fftSize;
  const rowSamples = samples.slice(startIndex, endIndex);

  // Apply fft to samples
  // Interleave samples as float32
  const interleavedSamples: number[] = rowSamples.flatMap((sample) => [
    sample.I,
    sample.Q,
  ]);

  const input = new Float32Array(interleavedSamples);

  const fft = new webfft(fftSize);
  const out = fft.fft(input);

  // Shift fft
  // Index N/2 should become 0
  const middleElementIndex = out.length / 2;
  const positiveFrequencies = out.slice(0, middleElementIndex);
  const negativeFrequencies = out.slice(middleElementIndex);
  const shiftedFFT = new Float32Array(out.length);
  shiftedFFT.set(negativeFrequencies);
  shiftedFFT.set(positiveFrequencies, negativeFrequencies.length);
  // Take absolute values
  const absolutedValues = shiftedFFT.map(Math.abs);
  // Square
  const squaredValues = absolutedValues.map((val) => val ** 2);

  // Convert values to dB
  // log base 10
  const logValues = squaredValues.map(Math.log10);
  //
  const amplifiedValues = logValues.map((val) => val * 10);
  return amplifiedValues;
}

const spectrogramData: Float32Array[] = Array.from(
  { length: rowCount },
  (_, index) => calculateSpectrogramRow(index),
);

function FFTChart() {
  const width = 750;
  const height = 800;
  const margin = {
    top: 60,
    bottom: 60,
    left: 80,
    right: 80,
  };
  const xMax = width - margin.left - margin.right;
  const yMax = height - margin.top - margin.bottom;

  const xScale = scaleTime({
    range: [0, xMax],
    domain: [0, 30],
  });

  const yScale = scaleLinear({
    range: [0, yMax],
    //domain: [0, 2048],
    domain: [1000, 1100],
  });

  const colorScale = scaleLinear({
    range: [0, 1],
    domain: [-50, 50],
  });
  const getBins = (column: Float32Array) => {
    return Array.from(column).map((value, index) => ({
      count: value,
      bin: index,
    }));
  };

  console.log(spectrogramData);
  return (
    <svg width={width} height={height}>
      <Group top={margin.top} left={margin.left}>
        <AxisBottom scale={xScale} label="Time [s]" />
        <AxisLeft scale={yScale} label="Frequency [Hz]" />
        <HeatmapRect
          data={spectrogramData}
          xScale={xScale}
          yScale={yScale}
          binWidth={20}
          binHeight={20}
          gap={0}
          bins={getBins}
          colorScale={(value) => {
            return interpolateTurbo(colorScale(value?.valueOf() ?? 0));
          }}
        />
      </Group>
    </svg>
  );
}

export default FFTChart;
