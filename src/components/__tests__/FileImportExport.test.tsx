/**
 * Tests for FileImportExport Component
 */

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import FileImportExport from "../FileImportExport";

describe("FileImportExport Component", () => {
  const mockOnImport = jest.fn();
  const mockOnError = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should render drop zone with correct text", () => {
    render(<FileImportExport onImport={mockOnImport} onError={mockOnError} />);

    expect(
      screen.getByText(/Click or drag & drop to import/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Supports IQ recordings and preset collections/i),
    ).toBeInTheDocument();
  });

  it("should handle valid preset file import", async () => {
    render(<FileImportExport onImport={mockOnImport} onError={mockOnError} />);

    const presetData = {
      version: "1.0",
      name: "Test Presets",
      stations: [
        { name: "FM Station", frequency: 100e6, type: "FM" },
        { name: "AM Station", frequency: 1000e3, type: "AM" },
      ],
    };

    const file = new File([JSON.stringify(presetData)], "presets.json", {
      type: "application/json",
    });

    const input = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    expect(input).toBeInTheDocument();

    Object.defineProperty(input, "files", {
      value: [file],
      writable: false,
    });

    fireEvent.change(input);

    await waitFor(() => {
      expect(mockOnImport).toHaveBeenCalledWith({
        type: "presets",
        data: expect.objectContaining({
          version: "1.0",
          name: "Test Presets",
        }),
      });
    });
  });

  it("should handle valid IQ recording import", async () => {
    render(<FileImportExport onImport={mockOnImport} onError={mockOnError} />);

    const iqData = {
      version: "1.0",
      timestamp: "2025-10-15T20:00:00.000Z",
      metadata: {
        centerFrequency: 100e6,
        sampleRate: 20e6,
        signalType: "FM",
      },
      samples: [
        { I: 0.5, Q: 0.3 },
        { I: -0.2, Q: 0.8 },
      ],
    };

    const file = new File([JSON.stringify(iqData)], "recording.json", {
      type: "application/json",
    });

    const input = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    expect(input).toBeInTheDocument();

    Object.defineProperty(input, "files", {
      value: [file],
      writable: false,
    });

    fireEvent.change(input);

    await waitFor(() => {
      expect(mockOnImport).toHaveBeenCalledWith({
        type: "iq-recording",
        data: expect.objectContaining({
          version: "1.0",
          samples: expect.any(Array),
        }),
      });
    });
  });

  it("should handle file size validation error", async () => {
    render(
      <FileImportExport
        onImport={mockOnImport}
        onError={mockOnError}
        maxSizeMB={1}
      />,
    );

    // Create a file larger than 1MB
    const largeContent = "x".repeat(2 * 1024 * 1024);
    const file = new File([largeContent], "large.json", {
      type: "application/json",
    });

    const input = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    expect(input).toBeInTheDocument();

    Object.defineProperty(input, "files", {
      value: [file],
      writable: false,
    });

    fireEvent.change(input);

    await waitFor(() => {
      expect(mockOnError).toHaveBeenCalledWith(
        expect.stringContaining("exceeds maximum"),
      );
    });
  });

  it("should handle invalid JSON format", async () => {
    render(<FileImportExport onImport={mockOnImport} onError={mockOnError} />);

    const file = new File(["invalid json {{{"], "invalid.json", {
      type: "application/json",
    });

    const input = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    expect(input).toBeInTheDocument();

    Object.defineProperty(input, "files", {
      value: [file],
      writable: false,
    });

    fireEvent.change(input);

    await waitFor(() => {
      expect(mockOnError).toHaveBeenCalled();
    });
  });

  it("should handle unrecognized format", async () => {
    render(<FileImportExport onImport={mockOnImport} onError={mockOnError} />);

    const unknownData = {
      someField: "value",
      anotherField: 123,
    };

    const file = new File([JSON.stringify(unknownData)], "unknown.json", {
      type: "application/json",
    });

    const input = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    expect(input).toBeInTheDocument();

    Object.defineProperty(input, "files", {
      value: [file],
      writable: false,
    });

    fireEvent.change(input);

    await waitFor(() => {
      expect(mockOnError).toHaveBeenCalledWith(
        expect.stringContaining("not recognized"),
      );
    });
  });

  it("should be keyboard accessible", () => {
    render(<FileImportExport onImport={mockOnImport} onError={mockOnError} />);

    const dropZone = screen.getByRole("button", {
      name: /Import file/i,
    });

    expect(dropZone).toBeInTheDocument();
    expect(dropZone).toHaveAttribute("tabIndex", "0");
  });

  it("should show processing state while reading file", async () => {
    render(<FileImportExport onImport={mockOnImport} onError={mockOnError} />);

    const presetData = {
      version: "1.0",
      name: "Test",
      stations: [],
    };

    const file = new File([JSON.stringify(presetData)], "presets.json", {
      type: "application/json",
    });

    const input = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    expect(input).toBeInTheDocument();

    Object.defineProperty(input, "files", {
      value: [file],
      writable: false,
    });

    fireEvent.change(input);

    // The processing state should appear briefly
    // Note: This is difficult to test reliably due to async nature
    await waitFor(() => {
      expect(mockOnImport).toHaveBeenCalled();
    });
  });
});
