import { render, fireEvent } from "@testing-library/react";
import DSPStagePanel from "../DSPStagePanel";

describe("DSPStagePanel", () => {
  const mockStage: import("../DSPStagePanel").DSPStagePanelProps["stage"] = {
    id: "fft",
    name: "FFT Analysis",
    description: "Frequency-domain analysis and spectrogram",
    inputData: [],
    outputData: null,
    parameters: {
      fftSize: 1024,
      window: "Hann",
      overlap: 0,
      wasm: false,
    },
    metrics: {
      bins: 1024,
      duration: 12.5,
    },
  };

  it("renders metrics and controls", () => {
    const { getByText, getByLabelText } = render(
      <DSPStagePanel
        stage={mockStage}
        onParameterChange={jest.fn()}
        onReset={jest.fn()}
      />,
    );
    expect(getByText("FFT Analysis")).toBeInTheDocument();
    expect(
      getByText("Frequency-domain analysis and spectrogram"),
    ).toBeInTheDocument();
    expect(getByText("bins")).toBeInTheDocument();
    expect(getByLabelText("fftSize")).toBeInTheDocument();
    expect(getByLabelText("window")).toBeInTheDocument();
    expect(getByLabelText("wasm")).toBeInTheDocument();
  });

  it("calls onParameterChange when control is changed", () => {
    const onParameterChange = jest.fn();
    const { getByLabelText } = render(
      <DSPStagePanel
        stage={mockStage}
        onParameterChange={onParameterChange}
        onReset={jest.fn()}
      />,
    );
    const textInput = getByLabelText("window") as HTMLInputElement;
    fireEvent.change(textInput, { target: { value: "Blackman" } });
    expect(onParameterChange).toHaveBeenCalledWith("window", "Blackman");
  });

  it("calls onReset when reset button is clicked", () => {
    const onReset = jest.fn();
    const { getByText } = render(
      <DSPStagePanel
        stage={mockStage}
        onParameterChange={jest.fn()}
        onReset={onReset}
      />,
    );
    fireEvent.click(getByText("Reset to Default"));
    expect(onReset).toHaveBeenCalled();
  });
});
