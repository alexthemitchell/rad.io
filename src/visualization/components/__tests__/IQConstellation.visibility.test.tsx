import { render } from "@testing-library/react";
import IQConstellation, { type Sample } from "../IQConstellation";

// Mock visibility hooks to exercise early-return branches
jest.mock("../../../hooks/usePageVisibility", () => ({
  usePageVisibility: () => false,
}));

jest.mock("../../../hooks/useIntersectionObserver", () => ({
  useIntersectionObserver: () => false,
}));

// Mock interaction hook to avoid side effects
jest.mock("../../../hooks/useVisualizationInteraction", () => ({
  useVisualizationInteraction: () => ({
    transform: { offsetX: 0, offsetY: 0, scale: 1 },
    handlers: {},
    canvasRef: () => {},
    resetTransform: () => {},
  }),
}));

// Mock heavy render helpers (webgpu/webgl) to force fallback path later tests could add
jest.mock("../../../utils/webgpu", () => ({
  isWebGPUSupported: () => false,
}));
jest.mock("../../../utils/webgl", () => ({
  getGL: () => ({ gl: null }),
  createProgram: () => null,
}));

describe("IQConstellation visibility optimizations", () => {
  it("early returns when not visible and background disabled", () => {
    const samples: Sample[] = [
      { I: 0.01, Q: 0.02 },
      { I: -0.01, Q: -0.02 },
    ];
    const { container } = render(
      <IQConstellation samples={samples} continueInBackground={false} />,
    );
    const canvas = container.querySelector("canvas");
    expect(canvas).toBeInTheDocument();
    // Because visibility hooks return false and continueInBackground=false, effect should early exit
    // Canvas width/height style defaults should still be applied synchronously in render cycle by effect guard.
  });

  it("renders when forced to continue in background despite not visible", () => {
    const samples: Sample[] = [
      { I: 0, Q: 0 },
      { I: 0.05, Q: -0.05 },
    ];
    const { container } = render(
      <IQConstellation samples={samples} continueInBackground={true} />,
    );
    const canvas = container.querySelector("canvas");
    expect(canvas).toBeInTheDocument();
  });
});
