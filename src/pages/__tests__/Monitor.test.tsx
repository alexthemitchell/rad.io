import { render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";

// Mock the worker pool to avoid Worker initialization errors in Jest
jest.mock("../../workers/dspWorkerPool", () => ({
  dspWorkerPool: {
    postMessage: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  },
}));

// Mock WebGL renderers to avoid WebGL initialization errors in Jest
jest.mock("../../visualization", () => ({
  WebGLSpectrum: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(false),
    cleanup: jest.fn(),
  })),
  WebGLWaterfall: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(false),
    cleanup: jest.fn(),
  })),
}));

// Mock the store hooks
jest.mock("../../store", () => ({
  useDevice: jest.fn(() => ({
    primaryDevice: null,
  })),
  useFrequency: jest.fn(() => ({
    frequencyHz: 50000000,
    setFrequencyHz: jest.fn(),
  })),
  useSettings: jest.fn(() => ({
    settings: {
      sampleRate: 2000000,
      gainMode: "automatic",
      gain: 0,
    },
    updateSettings: jest.fn(),
  })),
  useDiagnostics: jest.fn(() => ({
    events: [],
    demodulatorMetrics: null,
    tsParserMetrics: null,
    videoDecoderMetrics: null,
    audioDecoderMetrics: null,
    captionDecoderMetrics: null,
    overlayVisible: false,
    addDiagnosticEvent: jest.fn(),
    updateDemodulatorMetrics: jest.fn(),
    updateTSParserMetrics: jest.fn(),
    updateVideoDecoderMetrics: jest.fn(),
    updateAudioDecoderMetrics: jest.fn(),
    updateCaptionDecoderMetrics: jest.fn(),
    clearDiagnosticEvents: jest.fn(),
    resetDiagnostics: jest.fn(),
    setOverlayVisible: jest.fn(),
  })),
}));

// DeviceContext is removed; Zustand store requires no provider or mocking here

import Monitor from "../Monitor";

describe("Monitor", () => {
  it("renders the monitor page", () => {
    // No providers needed with Zustand - state is global
    render(
      <BrowserRouter>
        <Monitor />
      </BrowserRouter>,
    );
    expect(screen.getByRole("main")).toBeInTheDocument();
  });

  it("displays frequency control", () => {
    render(
      <BrowserRouter>
        <Monitor />
      </BrowserRouter>,
    );
    // The Monitor page now leads with FrequencyDisplay instead of a page title
    expect(
      screen.getByRole("heading", { name: /frequency control/i }),
    ).toBeInTheDocument();
  });

  it("shows spectrum section", () => {
    render(
      <BrowserRouter>
        <Monitor />
      </BrowserRouter>,
    );
    expect(
      screen.getByLabelText(/spectrum visualization/i),
    ).toBeInTheDocument();
  });

  it("shows audio controls section", () => {
    render(
      <BrowserRouter>
        <Monitor />
      </BrowserRouter>,
    );
    expect(screen.getByLabelText(/audio controls/i)).toBeInTheDocument();
  });

  it("shows signal info section", () => {
    render(
      <BrowserRouter>
        <Monitor />
      </BrowserRouter>,
    );
    expect(screen.getByLabelText(/signal information/i)).toBeInTheDocument();
  });
});
