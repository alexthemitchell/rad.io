/**
 * Tests for VisualizationDemo page
 */

import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import VisualizationDemo from "../VisualizationDemo";
import { SettingsProvider } from "../../contexts";

// Mock the visualization components
jest.mock("../../visualization/components/IQConstellation", () => {
  return function MockIQConstellation() {
    return <div data-testid="iq-constellation">IQ Constellation</div>;
  };
});

jest.mock("../../visualization/components/FFTChart", () => {
  return function MockFFTChart() {
    return <div data-testid="fft-chart">FFT Chart</div>;
  };
});

jest.mock("../../visualization/components/WaveformVisualizer", () => {
  return function MockWaveformVisualizer() {
    return <div data-testid="waveform-visualizer">Waveform Visualizer</div>;
  };
});

describe("VisualizationDemo", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  const renderComponent = () => {
    return render(
      <BrowserRouter>
        <SettingsProvider>
          <VisualizationDemo />
        </SettingsProvider>
      </BrowserRouter>,
    );
  };

  it("should render the page title and description", () => {
    renderComponent();
    expect(screen.getByText("Visualization Module Demo")).toBeInTheDocument();
    expect(
      screen.getByText(/new visualization module with/i),
    ).toBeInTheDocument();
  });

  it("should render all visualization components", () => {
    renderComponent();
    expect(screen.getByTestId("iq-constellation")).toBeInTheDocument();
    expect(screen.getByTestId("fft-chart")).toBeInTheDocument();
    expect(screen.getByTestId("waveform-visualizer")).toBeInTheDocument();
  });

  it("should render signal pattern selector with all options", () => {
    renderComponent();
    const select = screen.getByLabelText(/Signal Pattern/i);
    expect(select).toBeInTheDocument();

    const options = Array.from(select.querySelectorAll("option")).map(
      (opt) => opt.value,
    );
    expect(options).toEqual(["sine", "qpsk", "noise", "fm", "multi-tone"]);
  });

  it("should have start button initially", () => {
    renderComponent();
    const button = screen.getByRole("button", { name: /Start Streaming/i });
    expect(button).toBeInTheDocument();
  });

  it("should change button text when streaming starts", async () => {
    renderComponent();
    const button = screen.getByRole("button", { name: /Start Streaming/i });

    fireEvent.click(button);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /Stop Streaming/i }),
      ).toBeInTheDocument();
    });
  });

  it("should display metadata when streaming", async () => {
    renderComponent();
    const button = screen.getByRole("button", { name: /Start Streaming/i });

    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText(/Simulated Source/i)).toBeInTheDocument();
      expect(screen.getByText(/Sample Rate:/i)).toBeInTheDocument();
      expect(screen.getByText(/Center Frequency:/i)).toBeInTheDocument();
    });
  });

  it("should allow changing signal pattern when not streaming", () => {
    renderComponent();
    const select = screen.getByLabelText(
      /Signal Pattern/i,
    ) as HTMLSelectElement;

    fireEvent.change(select, { target: { value: "qpsk" } });
    expect(select.value).toBe("qpsk");

    fireEvent.change(select, { target: { value: "fm" } });
    expect(select.value).toBe("fm");
  });

  it("should disable pattern selection while streaming", async () => {
    renderComponent();
    const select = screen.getByLabelText(
      /Signal Pattern/i,
    ) as HTMLSelectElement;
    const button = screen.getByRole("button", { name: /Start Streaming/i });

    expect(select).not.toBeDisabled();

    fireEvent.click(button);

    await waitFor(() => {
      expect(select).toBeDisabled();
    });
  });

  it("should render architecture notes section", () => {
    renderComponent();
    expect(screen.getByText("Architecture Notes")).toBeInTheDocument();
    expect(screen.getByText(/DataSource Interface/i)).toBeInTheDocument();
    expect(screen.getByText(/Decoupled Components/i)).toBeInTheDocument();
    expect(screen.getByText(/Pattern Generation/i)).toBeInTheDocument();
  });

  it("should display visualization sections with descriptions", () => {
    renderComponent();

    const headings = screen.getAllByRole("heading", { level: 3 });
    const headingTexts = headings.map((h) => h.textContent);

    expect(headingTexts).toContain("IQ Constellation");
    expect(headingTexts).toContain("Waveform");
    expect(headingTexts).toContain("Spectrogram");

    expect(
      screen.getByText(/in-phase \(I\) and quadrature \(Q\)/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/amplitude envelope over time/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/frequency content over time/i),
    ).toBeInTheDocument();
  });

  it("should show sample count in metadata", async () => {
    renderComponent();
    const button = screen.getByRole("button", { name: /Start Streaming/i });

    fireEvent.click(button);

    // Fast-forward timers to trigger sample generation
    await act(async () => {
      jest.advanceTimersByTime(100);
    });

    await waitFor(() => {
      expect(screen.getByText(/Samples:/i)).toBeInTheDocument();
    });
  });
});
