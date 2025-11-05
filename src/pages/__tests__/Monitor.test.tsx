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

  it("displays heading", () => {
    render(
      <BrowserRouter>
        <Monitor />
      </BrowserRouter>,
    );
    expect(
      screen.getByRole("heading", { name: /monitor/i }),
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
