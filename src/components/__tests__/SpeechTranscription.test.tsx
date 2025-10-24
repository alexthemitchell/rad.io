/**
 * Tests for SpeechTranscription Component
 */

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import SpeechTranscription from "../SpeechTranscription";
import type { TranscriptionMode } from "../SpeechTranscription";

// Mock SpeechRecognition
class MockSpeechRecognition {
  lang = "en-US";
  continuous = false;
  interimResults = true;
  maxAlternatives = 1;

  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  onerror: ((event: { error: string }) => void) | null = null;
  onresult: ((event: unknown) => void) | null = null;

  start(): void {
    setTimeout(() => {
      if (this.onstart) this.onstart();
    }, 10);
  }

  stop(): void {
    setTimeout(() => {
      if (this.onend) this.onend();
    }, 10);
  }

  abort(): void {
    this.stop();
  }
}

// Mock SpeechSynthesisUtterance
class MockSpeechSynthesisUtterance {
  text = "";
  lang = "en-US";
  rate = 1.0;
  onstart: (() => void) | null = null;
  onerror: ((event: { error: string }) => void) | null = null;

  constructor(text?: string) {
    if (text) this.text = text;
  }
}

// Mock SpeechSynthesis
const mockSpeechSynthesis = {
  speak: jest.fn((utterance: MockSpeechSynthesisUtterance) => {
    setTimeout(() => {
      if (utterance.onstart) utterance.onstart();
    }, 10);
  }),
  cancel: jest.fn(),
  pause: jest.fn(),
  resume: jest.fn(),
  getVoices: jest.fn(() => []),
};

// Setup mocks
beforeAll(() => {
  // Mock window.SpeechRecognition
  (
    global as Window & {
      webkitSpeechRecognition?: typeof MockSpeechRecognition;
    }
  ).webkitSpeechRecognition =
    MockSpeechRecognition as unknown as typeof SpeechRecognition;

  // Mock window.speechSynthesis
  Object.defineProperty(window, "speechSynthesis", {
    value: mockSpeechSynthesis,
    writable: true,
  });

  // Mock SpeechSynthesisUtterance
  (
    global as Window & {
      SpeechSynthesisUtterance?: typeof MockSpeechSynthesisUtterance;
    }
  ).SpeechSynthesisUtterance =
    MockSpeechSynthesisUtterance as unknown as typeof SpeechSynthesisUtterance;
});

afterEach(() => {
  jest.clearAllMocks();
});

describe("SpeechTranscription Component", () => {
  const defaultProps = {
    mode: "off" as TranscriptionMode,
    isAvailable: true,
    signalType: "FM" as const,
    language: "en-US",
    onModeChange: jest.fn(),
    onLanguageChange: jest.fn(),
  };

  describe("Rendering", () => {
    it("should render component", () => {
      render(<SpeechTranscription {...defaultProps} />);
      expect(
        screen.getByLabelText(/speech transcription controls/i),
      ).toBeInTheDocument();
    });

    it("should render mode selector", () => {
      render(<SpeechTranscription {...defaultProps} />);
      expect(screen.getByLabelText(/mode/i)).toBeInTheDocument();
    });

    it("should render language selector", () => {
      render(<SpeechTranscription {...defaultProps} />);
      expect(screen.getByLabelText(/language/i)).toBeInTheDocument();
    });

    it("should render clear button", () => {
      render(<SpeechTranscription {...defaultProps} />);
      expect(screen.getByTitle(/clear all transcripts/i)).toBeInTheDocument();
    });

    it("should show empty state when no transcripts", () => {
      render(<SpeechTranscription {...defaultProps} />);
      expect(screen.getByText(/no transcriptions yet/i)).toBeInTheDocument();
    });
  });

  describe("Mode Selection", () => {
    it("should display off mode by default", () => {
      render(<SpeechTranscription {...defaultProps} />);
      const select = screen.getByLabelText(/mode/i) as HTMLSelectElement;
      expect(select.value).toBe("off");
    });

    it("should call onModeChange when mode changes", () => {
      const onModeChange = jest.fn();
      render(
        <SpeechTranscription {...defaultProps} onModeChange={onModeChange} />,
      );

      const select = screen.getByLabelText(/mode/i);
      fireEvent.change(select, { target: { value: "demo" } });

      expect(onModeChange).toHaveBeenCalledWith("demo");
    });

    it("should show demo info when in demo mode", () => {
      render(<SpeechTranscription {...defaultProps} mode="demo" />);
      expect(screen.getByText(/demo mode/i)).toBeInTheDocument();
    });

    it("should show manual info when in manual mode", async () => {
      render(<SpeechTranscription {...defaultProps} mode="manual" />);

      await waitFor(() => {
        expect(
          screen.getByText(/microphone-based transcription/i),
        ).toBeInTheDocument();
      });
    });
  });

  describe("Language Selection", () => {
    it("should display default language", () => {
      render(<SpeechTranscription {...defaultProps} />);
      const select = screen.getByLabelText(/language/i) as HTMLSelectElement;
      expect(select.value).toBe("en-US");
    });

    it("should call onLanguageChange when language changes", () => {
      const onLanguageChange = jest.fn();
      render(
        <SpeechTranscription
          {...defaultProps}
          onLanguageChange={onLanguageChange}
        />,
      );

      const select = screen.getByLabelText(/language/i);
      fireEvent.change(select, { target: { value: "es-ES" } });

      expect(onLanguageChange).toHaveBeenCalledWith("es-ES");
    });

    it("should disable language selector when mode is off", () => {
      render(<SpeechTranscription {...defaultProps} mode="off" />);
      const select = screen.getByLabelText(/language/i);
      expect(select).toBeDisabled();
    });

    it("should enable language selector when mode is active", () => {
      render(<SpeechTranscription {...defaultProps} mode="demo" />);
      const select = screen.getByLabelText(/language/i);
      expect(select).not.toBeDisabled();
    });
  });

  describe("Demo Mode", () => {
    it("should use speech synthesis in demo mode", async () => {
      render(
        <SpeechTranscription {...defaultProps} mode="demo" signalType="FM" />,
      );

      await waitFor(() => {
        expect(mockSpeechSynthesis.speak).toHaveBeenCalled();
      });
    });

    it("should add demo transcript", async () => {
      render(
        <SpeechTranscription {...defaultProps} mode="demo" signalType="FM" />,
      );

      await waitFor(() => {
        expect(
          screen.getByText(/DEMO MODE.*FM radio broadcast/i),
        ).toBeInTheDocument();
      });
    });

    it("should use correct phrase for signal type", async () => {
      render(
        <SpeechTranscription {...defaultProps} mode="demo" signalType="AM" />,
      );

      await waitFor(() => {
        expect(screen.getByText(/AM radio broadcast/i)).toBeInTheDocument();
      });
    });
  });

  describe("Clear Functionality", () => {
    it("should disable clear button when no transcripts", () => {
      render(<SpeechTranscription {...defaultProps} />);
      const clearButton = screen.getByTitle(/clear all transcripts/i);
      expect(clearButton).toBeDisabled();
    });

    it("should enable clear button when transcripts exist", async () => {
      render(<SpeechTranscription {...defaultProps} mode="demo" />);

      await waitFor(() => {
        const clearButton = screen.getByTitle(/clear all transcripts/i);
        expect(clearButton).not.toBeDisabled();
      });
    });

    it("should clear transcripts when clicked", async () => {
      render(<SpeechTranscription {...defaultProps} mode="demo" />);

      // Wait for demo transcript
      await waitFor(() => {
        expect(screen.getByText(/DEMO MODE/i)).toBeInTheDocument();
      });

      // Click clear
      const clearButton = screen.getByTitle(/clear all transcripts/i);
      fireEvent.click(clearButton);

      // Should show empty state
      expect(screen.getByText(/no transcriptions yet/i)).toBeInTheDocument();
    });
  });

  describe("Callbacks", () => {
    it("should call onStart when recognition starts", async () => {
      const onStart = jest.fn();
      render(
        <SpeechTranscription
          {...defaultProps}
          mode="manual"
          onStart={onStart}
        />,
      );

      await waitFor(
        () => {
          expect(onStart).toHaveBeenCalled();
        },
        { timeout: 200 },
      );
    });

    it("should call onStop when mode changes to off", async () => {
      const onStop = jest.fn();
      const { rerender } = render(
        <SpeechTranscription {...defaultProps} mode="manual" onStop={onStop} />,
      );

      // Wait for recognition to start
      await waitFor(() => {
        expect(screen.getByText(/listening/i)).toBeInTheDocument();
      });

      // Change mode to off
      rerender(
        <SpeechTranscription {...defaultProps} mode="off" onStop={onStop} />,
      );

      await waitFor(() => {
        expect(onStop).toHaveBeenCalled();
      });
    });
  });

  describe("Accessibility", () => {
    it("should have proper ARIA labels", () => {
      render(<SpeechTranscription {...defaultProps} />);
      expect(
        screen.getByLabelText(/speech transcription controls/i),
      ).toBeInTheDocument();
    });

    it("should have live region for transcripts", () => {
      render(<SpeechTranscription {...defaultProps} />);
      const liveRegion = screen.getByRole("log");
      expect(liveRegion).toHaveAttribute("aria-live", "polite");
      expect(liveRegion).toHaveAttribute("aria-atomic", "false");
      expect(liveRegion).toHaveAttribute("aria-relevant", "additions");
    });

    it("should have descriptive labels for selects", () => {
      render(<SpeechTranscription {...defaultProps} />);
      expect(screen.getByLabelText(/mode/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/language/i)).toBeInTheDocument();
    });
  });

  describe("Educational Notes", () => {
    it("should show educational note in manual mode", async () => {
      render(<SpeechTranscription {...defaultProps} mode="manual" />);

      await waitFor(() => {
        expect(
          screen.getByText(/Web Speech API uses your microphone/i),
        ).toBeInTheDocument();
      });
    });

    it("should not show educational note in off mode", () => {
      render(<SpeechTranscription {...defaultProps} mode="off" />);
      expect(
        screen.queryByText(/Web Speech API uses your microphone/i),
      ).not.toBeInTheDocument();
    });

    it("should not show educational note in demo mode", () => {
      render(<SpeechTranscription {...defaultProps} mode="demo" />);
      expect(
        screen.queryByText(/Web Speech API uses your microphone/i),
      ).not.toBeInTheDocument();
    });
  });

  describe("Availability", () => {
    it("should disable mode selector when not available and mode is off", () => {
      render(
        <SpeechTranscription
          {...defaultProps}
          isAvailable={false}
          mode="off"
        />,
      );
      const select = screen.getByLabelText(/mode/i);
      expect(select).toBeDisabled();
    });

    it("should not disable mode selector when mode is active", () => {
      render(
        <SpeechTranscription
          {...defaultProps}
          isAvailable={false}
          mode="demo"
        />,
      );
      const select = screen.getByLabelText(/mode/i);
      expect(select).not.toBeDisabled();
    });
  });
});
