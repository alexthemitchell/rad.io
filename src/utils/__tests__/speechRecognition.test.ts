/**
 * Tests for Speech Recognition Integration
 */

import {
  SpeechRecognitionProcessor,
  SpeechRecognitionError,
  SpeechRecognitionErrorType,
  createSpeechRecognizer,
  type SpeechRecognitionTranscript,
} from "../speechRecognition";
import type { AudioStreamResult } from "../audioStream";
import { DemodulationType } from "../audioStream";

/**
 * Mock SpeechRecognition implementation for testing
 */
class MockSpeechRecognition {
  lang = "";
  continuous = false;
  interimResults = false;
  maxAlternatives = 1;

  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  onresult: ((event: SpeechRecognitionEvent) => void) | null = null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null = null;
  onnomatch: (() => void) | null = null;

  private isStarted = false;

  start(): void {
    if (this.isStarted) {
      throw new Error("already started");
    }
    this.isStarted = true;
    setTimeout(() => {
      if (this.onstart) {
        this.onstart();
      }
    }, 10);
  }

  stop(): void {
    this.isStarted = false;
    setTimeout(() => {
      if (this.onend) {
        this.onend();
      }
    }, 10);
  }

  abort(): void {
    this.isStarted = false;
    setTimeout(() => {
      if (this.onerror) {
        this.onerror({
          error: "aborted",
          message: "Recognition aborted",
        } as SpeechRecognitionErrorEvent);
      }
    }, 10);
  }

  // Test helpers
  simulateResult(text: string, isFinal = true, confidence = 0.95): void {
    if (!this.onresult) {
      return;
    }

    const mockResult: any = {
      isFinal,
      length: 1,
      item: (index: number) => {
        if (index !== 0) {
          throw new Error("Index out of bounds");
        }
        return mockResult[0]!;
      },
      [Symbol.iterator]: function* () {
        yield mockResult[0]!;
      },
      [0]: {
        transcript: text,
        confidence,
      },
    };

    const mockEvent: any = {
      resultIndex: 0,
      results: {
        length: 1,
        item: (index: number) => {
          if (index !== 0) {
            throw new Error("Index out of bounds");
          }
          return mockEvent.results[0]!;
        },
        [Symbol.iterator]: function* () {
          yield mockEvent.results[0]!;
        },
        [0]: mockResult,
      },
    };

    this.onresult(mockEvent);
  }

  simulateError(error: string, message = ""): void {
    if (!this.onerror) {
      return;
    }

    this.onerror({
      error,
      message,
    } as any);
  }

  simulateNoMatch(): void {
    if (this.onnomatch) {
      this.onnomatch();
    }
  }
}

/**
 * Mock AudioContext for testing
 */
class MockAudioContext {
  sampleRate = 48000;
  destination = {};

  createBufferSource(): AudioBufferSourceNode {
    return {
      buffer: null,
      connect: jest.fn(),
      start: jest.fn(),
      stop: jest.fn(),
      disconnect: jest.fn(),
    } as unknown as AudioBufferSourceNode;
  }

  createMediaStreamDestination(): MediaStreamAudioDestinationNode {
    return {
      stream: new MediaStream(),
      numberOfInputs: 1,
      numberOfOutputs: 0,
      connect: jest.fn(),
      disconnect: jest.fn(),
    } as unknown as MediaStreamAudioDestinationNode;
  }

  createBuffer(
    channels: number,
    length: number,
    sampleRate: number,
  ): AudioBuffer {
    return {
      numberOfChannels: channels,
      length,
      sampleRate,
      duration: length / sampleRate,
      getChannelData: () => new Float32Array(length),
      copyFromChannel: jest.fn(),
      copyToChannel: jest.fn(),
    } as AudioBuffer;
  }

  async close(): Promise<void> {
    // Mock close
  }
}

// Store original globals
const originalSpeechRecognition = global.SpeechRecognition;
const originalWebkitSpeechRecognition = global.webkitSpeechRecognition;
const originalAudioContext = global.AudioContext;
const originalMediaStream = global.MediaStream;

// Setup mocks
beforeAll(() => {
  global.SpeechRecognition = MockSpeechRecognition as any;
  global.webkitSpeechRecognition = MockSpeechRecognition as any;
  global.AudioContext = MockAudioContext as any;
  global.MediaStream = class MediaStream {} as any;

  // Add to window for browser compatibility checks
  if (typeof window !== "undefined") {
    (window as any).SpeechRecognition = MockSpeechRecognition;
    (window as any).webkitSpeechRecognition = MockSpeechRecognition;
  }
});

// Cleanup mocks
afterAll(() => {
  global.SpeechRecognition = originalSpeechRecognition;
  global.webkitSpeechRecognition = originalWebkitSpeechRecognition;
  global.AudioContext = originalAudioContext;
  global.MediaStream = originalMediaStream;
});

/**
 * Helper to create mock audio result
 */
function createMockAudioResult(): AudioStreamResult {
  const audioContext = new MockAudioContext();
  return {
    audioData: new Float32Array(4800), // 0.1 sec at 48kHz
    sampleRate: 48000,
    channels: 1,
    demodType: DemodulationType.FM,
    audioBuffer: audioContext.createBuffer(1, 4800, 48000),
  };
}

describe("SpeechRecognitionProcessor", () => {
  describe("Browser Support", () => {
    it("should detect Web Speech API support", () => {
      expect(SpeechRecognitionProcessor.isSupported()).toBe(true);
    });

    it("should detect lack of support when API is not available", () => {
      const originalSupport = global.SpeechRecognition;
      const originalWebkitSupport = global.webkitSpeechRecognition;

      delete (global as any).SpeechRecognition;
      delete (global as any).webkitSpeechRecognition;

      expect(SpeechRecognitionProcessor.isSupported()).toBe(false);

      // Restore
      global.SpeechRecognition = originalSupport;
      global.webkitSpeechRecognition = originalWebkitSupport;
    });
  });

  describe("Initialization", () => {
    it("should create processor with default config", () => {
      const processor = new SpeechRecognitionProcessor();
      expect(processor).toBeDefined();
      expect(processor.isActive()).toBe(false);
    });

    it("should create processor with custom config", () => {
      const processor = new SpeechRecognitionProcessor({
        lang: "es-ES",
        interimResults: false,
        maxAlternatives: 3,
        continuous: false,
      });
      expect(processor).toBeDefined();
    });

    it("should throw error if Web Speech API is not supported", async () => {
      const originalSupport = global.SpeechRecognition;
      const originalWebkitSupport = global.webkitSpeechRecognition;

      delete (global as any).SpeechRecognition;
      delete (global as any).webkitSpeechRecognition;

      const processor = new SpeechRecognitionProcessor();

      await expect(processor.start()).rejects.toThrow(SpeechRecognitionError);
      await expect(processor.start()).rejects.toThrow(
        "Web Speech API is not supported",
      );

      // Restore
      global.SpeechRecognition = originalSupport;
      global.webkitSpeechRecognition = originalWebkitSupport;
    });
  });

  describe("Start and Stop", () => {
    it("should start recognition successfully", async () => {
      const processor = new SpeechRecognitionProcessor();
      const startCallback = jest.fn();
      processor.onStart = startCallback;

      await processor.start();

      // Wait for async start event
      await new Promise((resolve) => setTimeout(resolve, 20));

      expect(processor.isActive()).toBe(true);
      expect(startCallback).toHaveBeenCalled();

      await processor.cleanup();
    });

    it("should stop recognition successfully", async () => {
      const processor = new SpeechRecognitionProcessor();
      const endCallback = jest.fn();
      processor.onEnd = endCallback;

      await processor.start();
      await new Promise((resolve) => setTimeout(resolve, 20));

      await processor.stop();
      await new Promise((resolve) => setTimeout(resolve, 20));

      expect(processor.isActive()).toBe(false);
      expect(endCallback).toHaveBeenCalled();

      await processor.cleanup();
    });
  });

  describe("Audio Processing", () => {
    it("should process audio from audio stream result", async () => {
      const processor = new SpeechRecognitionProcessor();
      await processor.start();

      const audioResult = createMockAudioResult();
      await expect(processor.processAudio(audioResult)).resolves.not.toThrow();

      await processor.cleanup();
    });

    it("should throw error if processing audio before start", async () => {
      const processor = new SpeechRecognitionProcessor();
      const audioResult = createMockAudioResult();

      await expect(processor.processAudio(audioResult)).rejects.toThrow(
        SpeechRecognitionError,
      );
      await expect(processor.processAudio(audioResult)).rejects.toThrow(
        "Recognition not started",
      );
    });

    it("should provide MediaStream for direct connection", async () => {
      const processor = new SpeechRecognitionProcessor();
      expect(processor.getMediaStream()).toBeNull();

      await processor.start();
      const stream = processor.getMediaStream();
      expect(stream).toBeInstanceOf(MediaStream);

      await processor.cleanup();
    });
  });

  describe("Transcription Results", () => {
    it("should receive final transcription results", async () => {
      const processor = new SpeechRecognitionProcessor();
      const transcripts: SpeechRecognitionTranscript[] = [];

      processor.onTranscript = (transcript) => {
        transcripts.push(transcript);
      };

      await processor.start();
      await new Promise((resolve) => setTimeout(resolve, 20));

      // Simulate recognition result
      const mockRecognition = (processor as any)
        .recognition as MockSpeechRecognition;
      mockRecognition.simulateResult("Hello world", true, 0.95);

      await new Promise((resolve) => setTimeout(resolve, 20));

      expect(transcripts.length).toBe(1);
      expect(transcripts[0]?.text).toBe("Hello world");
      expect(transcripts[0]?.confidence).toBe(0.95);
      expect(transcripts[0]?.isFinal).toBe(true);
      expect(transcripts[0]?.timestamp).toBeDefined();

      await processor.cleanup();
    });

    it("should receive interim transcription results", async () => {
      const processor = new SpeechRecognitionProcessor({
        interimResults: true,
      });
      const transcripts: SpeechRecognitionTranscript[] = [];

      processor.onTranscript = (transcript) => {
        transcripts.push(transcript);
      };

      await processor.start();
      await new Promise((resolve) => setTimeout(resolve, 20));

      const mockRecognition = (processor as any)
        .recognition as MockSpeechRecognition;

      // Simulate interim result
      mockRecognition.simulateResult("Hello", false, 0.8);
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Simulate final result
      mockRecognition.simulateResult("Hello world", true, 0.95);
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(transcripts.length).toBe(2);
      expect(transcripts[0]?.isFinal).toBe(false);
      expect(transcripts[1]?.isFinal).toBe(true);

      await processor.cleanup();
    });

    it("should handle multiple transcription results", async () => {
      const processor = new SpeechRecognitionProcessor();
      const transcripts: SpeechRecognitionTranscript[] = [];

      processor.onTranscript = (transcript) => {
        transcripts.push(transcript);
      };

      await processor.start();
      await new Promise((resolve) => setTimeout(resolve, 20));

      const mockRecognition = (processor as any)
        .recognition as MockSpeechRecognition;

      mockRecognition.simulateResult("First sentence", true, 0.9);
      await new Promise((resolve) => setTimeout(resolve, 10));

      mockRecognition.simulateResult("Second sentence", true, 0.85);
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(transcripts.length).toBe(2);
      expect(transcripts[0]?.text).toBe("First sentence");
      expect(transcripts[1]?.text).toBe("Second sentence");

      await processor.cleanup();
    });
  });

  describe("Error Handling", () => {
    it("should handle network errors", async () => {
      const processor = new SpeechRecognitionProcessor();
      const errors: SpeechRecognitionError[] = [];

      processor.onError = (error) => {
        errors.push(error);
      };

      await processor.start();
      await new Promise((resolve) => setTimeout(resolve, 20));

      const mockRecognition = (processor as any)
        .recognition as MockSpeechRecognition;
      mockRecognition.simulateError("network", "Network connection failed");

      await new Promise((resolve) => setTimeout(resolve, 20));

      expect(errors.length).toBe(1);
      expect(errors[0]?.errorType).toBe(SpeechRecognitionErrorType.NETWORK);
      expect(errors[0]?.message).toContain("network");

      await processor.cleanup();
    });

    it("should handle no-speech errors", async () => {
      const processor = new SpeechRecognitionProcessor();
      const errors: SpeechRecognitionError[] = [];

      processor.onError = (error) => {
        errors.push(error);
      };

      await processor.start();
      await new Promise((resolve) => setTimeout(resolve, 20));

      const mockRecognition = (processor as any)
        .recognition as MockSpeechRecognition;
      mockRecognition.simulateError("no-speech");

      await new Promise((resolve) => setTimeout(resolve, 20));

      expect(errors.length).toBe(1);
      expect(errors[0]?.errorType).toBe(SpeechRecognitionErrorType.NO_SPEECH);

      await processor.cleanup();
    });

    it("should handle not-allowed errors", async () => {
      const processor = new SpeechRecognitionProcessor();
      const errors: SpeechRecognitionError[] = [];

      processor.onError = (error) => {
        errors.push(error);
      };

      await processor.start();
      await new Promise((resolve) => setTimeout(resolve, 20));

      const mockRecognition = (processor as any)
        .recognition as MockSpeechRecognition;
      mockRecognition.simulateError("not-allowed", "Permission denied");

      await new Promise((resolve) => setTimeout(resolve, 20));

      expect(errors.length).toBe(1);
      expect(errors[0]?.errorType).toBe(SpeechRecognitionErrorType.NOT_ALLOWED);

      await processor.cleanup();
    });

    it("should handle no-match event", async () => {
      const processor = new SpeechRecognitionProcessor();
      const errors: SpeechRecognitionError[] = [];

      processor.onError = (error) => {
        errors.push(error);
      };

      await processor.start();
      await new Promise((resolve) => setTimeout(resolve, 20));

      const mockRecognition = (processor as any)
        .recognition as MockSpeechRecognition;
      mockRecognition.simulateNoMatch();

      await new Promise((resolve) => setTimeout(resolve, 20));

      expect(errors.length).toBe(1);
      expect(errors[0]?.errorType).toBe(SpeechRecognitionErrorType.NO_MATCH);

      await processor.cleanup();
    });

    it("should map unknown error codes correctly", async () => {
      const processor = new SpeechRecognitionProcessor();
      const errors: SpeechRecognitionError[] = [];

      processor.onError = (error) => {
        errors.push(error);
      };

      await processor.start();
      await new Promise((resolve) => setTimeout(resolve, 20));

      const mockRecognition = (processor as any)
        .recognition as MockSpeechRecognition;
      mockRecognition.simulateError("unknown-error-type");

      await new Promise((resolve) => setTimeout(resolve, 20));

      expect(errors.length).toBe(1);
      expect(errors[0]?.errorType).toBe(SpeechRecognitionErrorType.UNKNOWN);

      await processor.cleanup();
    });
  });

  describe("Configuration", () => {
    it("should apply language configuration", async () => {
      const processor = new SpeechRecognitionProcessor({
        lang: "es-ES",
      });

      await processor.start();
      await new Promise((resolve) => setTimeout(resolve, 20));

      const mockRecognition = (processor as any)
        .recognition as MockSpeechRecognition;
      expect(mockRecognition.lang).toBe("es-ES");

      await processor.cleanup();
    });

    it("should apply continuous mode configuration", async () => {
      const processor = new SpeechRecognitionProcessor({
        continuous: true,
      });

      await processor.start();
      await new Promise((resolve) => setTimeout(resolve, 20));

      const mockRecognition = (processor as any)
        .recognition as MockSpeechRecognition;
      expect(mockRecognition.continuous).toBe(true);

      await processor.cleanup();
    });

    it("should apply interim results configuration", async () => {
      const processor = new SpeechRecognitionProcessor({
        interimResults: true,
      });

      await processor.start();
      await new Promise((resolve) => setTimeout(resolve, 20));

      const mockRecognition = (processor as any)
        .recognition as MockSpeechRecognition;
      expect(mockRecognition.interimResults).toBe(true);

      await processor.cleanup();
    });

    it("should apply max alternatives configuration", async () => {
      const processor = new SpeechRecognitionProcessor({
        maxAlternatives: 5,
      });

      await processor.start();
      await new Promise((resolve) => setTimeout(resolve, 20));

      const mockRecognition = (processor as any)
        .recognition as MockSpeechRecognition;
      expect(mockRecognition.maxAlternatives).toBe(5);

      await processor.cleanup();
    });
  });

  describe("Cleanup", () => {
    it("should cleanup resources properly", async () => {
      const processor = new SpeechRecognitionProcessor();
      await processor.start();
      await processor.cleanup();

      expect(processor.isActive()).toBe(false);
      expect((processor as any).audioContext).toBeNull();
      expect((processor as any).onTranscript).toBeNull();
      expect((processor as any).onError).toBeNull();
    });

    it("should handle cleanup when not started", async () => {
      const processor = new SpeechRecognitionProcessor();
      await expect(processor.cleanup()).resolves.not.toThrow();
    });
  });
});

describe("createSpeechRecognizer", () => {
  it("should create speech recognizer with callback", () => {
    const callback = jest.fn();
    const recognizer = createSpeechRecognizer(callback, {
      lang: "en-US",
    });

    expect(recognizer).toBeInstanceOf(SpeechRecognitionProcessor);
    expect(recognizer.onTranscript).toBe(callback);
  });

  it("should create recognizer with default config", () => {
    const callback = jest.fn();
    const recognizer = createSpeechRecognizer(callback);

    expect(recognizer).toBeInstanceOf(SpeechRecognitionProcessor);
  });

  it("should invoke callback on transcription", async () => {
    const transcripts: SpeechRecognitionTranscript[] = [];
    const recognizer = createSpeechRecognizer((transcript) => {
      transcripts.push(transcript);
    });

    await recognizer.start();
    await new Promise((resolve) => setTimeout(resolve, 20));

    const mockRecognition = (recognizer as any)
      .recognition as MockSpeechRecognition;
    mockRecognition.simulateResult("Test transcript", true, 0.9);

    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(transcripts.length).toBe(1);
    expect(transcripts[0]?.text).toBe("Test transcript");

    await recognizer.cleanup();
  });
});

describe("Integration with Audio Stream", () => {
  it("should integrate with audio stream processor", async () => {
    const transcripts: SpeechRecognitionTranscript[] = [];
    const recognizer = new SpeechRecognitionProcessor({
      lang: "en-US",
      interimResults: true,
    });

    recognizer.onTranscript = (transcript) => {
      transcripts.push(transcript);
    };

    await recognizer.start();
    await new Promise((resolve) => setTimeout(resolve, 20));

    // Simulate processing multiple audio chunks
    const audioResult1 = createMockAudioResult();
    const audioResult2 = createMockAudioResult();

    await recognizer.processAudio(audioResult1);
    await recognizer.processAudio(audioResult2);

    // Simulate recognition from the audio
    const mockRecognition = (recognizer as any)
      .recognition as MockSpeechRecognition;
    mockRecognition.simulateResult("Radio transmission received", true, 0.88);

    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(transcripts.length).toBe(1);
    expect(transcripts[0]?.text).toBe("Radio transmission received");

    await recognizer.cleanup();
  });

  it("should handle different demodulation types", async () => {
    const recognizer = new SpeechRecognitionProcessor();
    await recognizer.start();

    // FM demodulated audio
    const fmAudio: AudioStreamResult = {
      ...createMockAudioResult(),
      demodType: DemodulationType.FM,
    };

    // AM demodulated audio
    const amAudio: AudioStreamResult = {
      ...createMockAudioResult(),
      demodType: DemodulationType.AM,
    };

    await expect(recognizer.processAudio(fmAudio)).resolves.not.toThrow();
    await expect(recognizer.processAudio(amAudio)).resolves.not.toThrow();

    await recognizer.cleanup();
  });
});
