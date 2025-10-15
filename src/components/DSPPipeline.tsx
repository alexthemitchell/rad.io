type DSPStage = {
  title: string;
  description: string;
};

const DSP_STAGES: DSPStage[] = [
  {
    title: "RF Input",
    description: "Antenna signal",
  },
  {
    title: "Tuner",
    description: "Frequency selection",
  },
  {
    title: "I/Q Sampling",
    description: "Digital conversion",
  },
  {
    title: "FFT",
    description: "Frequency analysis",
  },
  {
    title: "Demodulation",
    description: "Signal extraction",
  },
  {
    title: "Audio Output",
    description: "Speaker/headphones",
  },
];

export default function DSPPipeline() {
  return (
    <div className="card">
      <div className="card-title">Digital Signal Processing Pipeline</div>
      <div className="card-subtitle">
        Visual representation of how your radio signal is processed
      </div>
      <div className="dsp-pipeline">
        {DSP_STAGES.map((stage, index) => (
          <div key={stage.title} style={{ display: "flex", alignItems: "center" }}>
            <div className="dsp-stage">
              <div className="dsp-stage-title">{stage.title}</div>
              <div className="dsp-stage-desc">{stage.description}</div>
            </div>
            {index < DSP_STAGES.length - 1 && (
              <div className="dsp-arrow">→</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
