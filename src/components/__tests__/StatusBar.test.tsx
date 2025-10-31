import { render, screen, fireEvent } from "@testing-library/react";
import StatusBar, { RenderTier } from "../StatusBar";

describe("StatusBar", () => {
  it("renders without crashing", () => {
    render(<StatusBar />);
    const statusBar = screen.getByRole("status");
    expect(statusBar).toBeInTheDocument();
  });

  it("displays device connection status", () => {
    const { rerender } = render(<StatusBar deviceConnected={true} />);
    expect(screen.getByText("Connected")).toBeInTheDocument();

    rerender(<StatusBar deviceConnected={false} />);
    expect(screen.getByText("Disconnected")).toBeInTheDocument();
  });

  it("displays render tier", () => {
    const { rerender } = render(<StatusBar renderTier={RenderTier.WebGPU} />);
    expect(screen.getByText("WebGPU")).toBeInTheDocument();

    rerender(<StatusBar renderTier={RenderTier.WebGL2} />);
    expect(screen.getByText("WebGL2")).toBeInTheDocument();

    rerender(<StatusBar renderTier={RenderTier.Canvas2D} />);
    expect(screen.getByText("Canvas2D")).toBeInTheDocument();
  });

  it("displays FPS", () => {
    render(<StatusBar fps={58.7} />);
    expect(screen.getByText("59")).toBeInTheDocument();
  });

  it("formats sample rate correctly", () => {
    const { rerender } = render(<StatusBar sampleRate={2048000} />);
    expect(screen.getByText("2.05 MS/s")).toBeInTheDocument();

    rerender(<StatusBar sampleRate={48000} />);
    expect(screen.getByText("48 kS/s")).toBeInTheDocument();

    rerender(<StatusBar sampleRate={800} />);
    expect(screen.getByText("800 S/s")).toBeInTheDocument();

    rerender(<StatusBar sampleRate={0} />);
    expect(screen.getByTitle("0 samples/second")).toBeInTheDocument();
  });

  it("displays buffer health percentage", () => {
    render(<StatusBar bufferHealth={87.5} />);
    expect(screen.getByText("88%")).toBeInTheDocument();
  });

  it("formats storage correctly", () => {
    const { rerender } = render(
      <StatusBar storageUsed={52428800} storageQuota={104857600} />,
    );
    expect(screen.getByText(/50.0 \/ 100 MB \(50%\)/)).toBeInTheDocument();

    rerender(<StatusBar storageUsed={0} storageQuota={0} />);
    expect(screen.getByTitle("Storage used / quota")).toBeInTheDocument();
  });

  it("applies correct color for render tier", () => {
    const { rerender } = render(<StatusBar renderTier={RenderTier.WebGPU} />);
    let tierElement = screen.getByText("WebGPU");
    expect(tierElement).toHaveStyle({ color: "var(--rad-success)" });

    rerender(<StatusBar renderTier={RenderTier.WebGL2} />);
    tierElement = screen.getByText("WebGL2");
    expect(tierElement).toHaveStyle({ color: "var(--rad-fg)" });

    rerender(<StatusBar renderTier={RenderTier.WebGL1} />);
    tierElement = screen.getByText("WebGL1");
    expect(tierElement).toHaveStyle({ color: "var(--rad-warning)" });

    rerender(<StatusBar renderTier={RenderTier.Canvas2D} />);
    tierElement = screen.getByText("Canvas2D");
    expect(tierElement).toHaveStyle({ color: "var(--rad-danger)" });

    rerender(<StatusBar renderTier={RenderTier.Unknown} />);
    tierElement = screen.getByText("Unknown");
    expect(tierElement).toHaveStyle({ color: "var(--rad-fg-muted)" });
  });

  it("applies correct class for FPS", () => {
    const { rerender } = render(<StatusBar fps={60} />);
    let fpsElement = screen.getByText("60");
    expect(fpsElement).toHaveClass("status-ok"); // Good

    rerender(<StatusBar fps={45} />);
    fpsElement = screen.getByText("45");
    expect(fpsElement).toHaveClass("status-warn"); // Warning

    rerender(<StatusBar fps={20} />);
    fpsElement = screen.getByText("20");
    expect(fpsElement).toHaveClass("status-crit"); // Critical
  });

  it("applies correct class for buffer health", () => {
    const { rerender } = render(<StatusBar bufferHealth={95} />);
    let bufferElement = screen.getByText("95%");
    expect(bufferElement).toHaveClass("status-ok"); // Good

    rerender(<StatusBar bufferHealth={65} />);
    bufferElement = screen.getByText("65%");
    expect(bufferElement).toHaveClass("status-warn"); // Warning

    rerender(<StatusBar bufferHealth={35} />);
    bufferElement = screen.getByText("35%");
    expect(bufferElement).toHaveClass("status-crit"); // Critical
  });

  it("applies correct class for storage quota", () => {
    const { rerender } = render(
      <StatusBar
        storageUsed={50 * 1024 * 1024}
        storageQuota={100 * 1024 * 1024}
      />,
    );
    let storageElement = screen.getByText(/50.0 \/ 100 MB/);
    expect(storageElement).toHaveClass("status-ok"); // Good (<70%)

    rerender(
      <StatusBar
        storageUsed={75 * 1024 * 1024}
        storageQuota={100 * 1024 * 1024}
      />,
    );
    storageElement = screen.getByText(/75.0 \/ 100 MB/);
    expect(storageElement).toHaveClass("status-warn"); // Warning (>=70%)

    rerender(
      <StatusBar
        storageUsed={95 * 1024 * 1024}
        storageQuota={100 * 1024 * 1024}
      />,
    );
    storageElement = screen.getByText(/95.0 \/ 100 MB/);
    expect(storageElement).toHaveClass("status-crit"); // Critical (>=90%)
  });

  it("displays current time", () => {
    render(<StatusBar />);
    // Time is displayed in HH:MM:SS format
    const timeRegex = /\d{1,2}:\d{2}:\d{2}/;
    const timeElements = screen.getAllByText(timeRegex);
    expect(timeElements.length).toBeGreaterThan(0);
  });

  it("applies custom className", () => {
    const { container } = render(<StatusBar className="custom-status-bar" />);
    const statusBar = container.querySelector(".status-bar");
    expect(statusBar).toHaveClass("custom-status-bar");
  });

  it("has proper ARIA attributes", () => {
    render(<StatusBar />);
    const statusBar = screen.getByRole("status");
    expect(statusBar).toHaveAttribute("aria-live", "polite");
    expect(statusBar).toHaveAttribute("aria-atomic", "false");
  });

  it("renders audio state, volume and clipping indicator", () => {
    render(
      <StatusBar audioState="playing" audioVolume={42} audioClipping={true} />,
    );
    expect(screen.getByText(/Audio/i)).toBeInTheDocument();
    expect(screen.getByText(/Playing/i)).toBeInTheDocument();
    expect(screen.getByText(/42%/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Audio clipping/i)).toBeInTheDocument();
  });

  it("toggles buffer details when info button is clicked", () => {
    render(
      <StatusBar
        bufferHealth={73}
        bufferDetails={{ currentSamples: 12345, maxSamples: 67890 }}
      />,
    );
    // Hidden before click
    expect(screen.queryByText(/12,345\s*\/\s*67,890/)).not.toBeInTheDocument();
    const infoButton = screen.getByRole("button", {
      name: /Show buffer details/i,
    });
    fireEvent.click(infoButton);
    expect(screen.getByText(/12,345\s*\/\s*67,890/)).toBeInTheDocument();
  });

  it("has tooltips for key metrics", () => {
    render(
      <StatusBar
        renderTier={RenderTier.WebGL2}
        fps={58}
        sampleRate={2048000}
        bufferHealth={85}
        storageUsed={50 * 1024 * 1024}
        storageQuota={100 * 1024 * 1024}
      />,
    );

    expect(screen.getByTitle("Rendering with WebGL2")).toBeInTheDocument();
    expect(screen.getByTitle("Frames per second")).toBeInTheDocument();
    expect(screen.getByTitle("2048000 samples/second")).toBeInTheDocument();
    expect(screen.getByTitle("Buffer health: 85%")).toBeInTheDocument();
    expect(screen.getByTitle("Storage used / quota")).toBeInTheDocument();
  });

  it("updates time display every second", () => {
    jest.useFakeTimers();
    render(<StatusBar />);

    // Verify time is displayed initially
    expect(screen.getByText(/\d{1,2}:\d{2}:\d{2}/)).toBeInTheDocument();

    // Advance time by 1 second
    jest.advanceTimersByTime(1000);

    // Time should still be displayed (component re-renders)
    expect(screen.getByText(/\d{1,2}:\d{2}:\d{2}/)).toBeInTheDocument();

    jest.useRealTimers();
  });
});
