import { AxisBottom, AxisLeft } from "@visx/axis";
import { GlyphCircle } from "@visx/glyph";
import { scaleLinear } from "@visx/scale";
import { Group } from "@visx/group";

import { testSamples } from "../hooks/__test__/testSamples";

type Sample = {
  I: number;
  Q: number;
};

const samples = testSamples.slice(1024).map(([i, q]) => {
  if (i === undefined || q === undefined) {
    throw new Error("invalid sample");
  }
  const sample: Sample = {
    I: i,
    Q: q,
  };
  return sample;
});
function SampleChart() {
  const width = 750;
  const height = 400;
  const margin = {
    top: 60,
    bottom: 60,
    left: 80,
    right: 80,
  };
  const xMax = width - margin.left - margin.right;
  const yMax = height - margin.top - margin.bottom;
  const x = (d: Sample) => d.I;
  const y = (d: Sample) => d.Q;

  const xScale = scaleLinear({
    range: [xMax, 0],
    domain: [-0.1, 0.1],
  });

  const yScale = scaleLinear({
    range: [yMax, 0],
    domain: [-0.1, 0.1],
  });
  return (
    <svg width={width} height={height}>
      <Group top={margin.top} left={margin.left}>
        <AxisLeft scale={yScale} left={xMax / 2} label={"Q"} />
        <AxisBottom scale={xScale} top={yMax / 2} label={"I"} />
        {samples.map((sample, index) => {
          const left = xScale(x(sample));
          const top = yScale(y(sample));
          return <GlyphCircle key={index} left={left} top={top} size={2} />;
        })}
      </Group>
    </svg>
  );
}

export default SampleChart;
