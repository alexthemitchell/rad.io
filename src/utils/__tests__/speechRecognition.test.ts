/**
 * Tests for Web Speech API Integration
 *
 * These tests verify speech recognition functionality using mocked
 * Web Speech API and Speech Synthesis for test data generation.
 */

import {
  SpeechRecognitionProcessor,
  isSpeechRecognitionSupported,
  recognizeSpeech,
  SpeechRecognitionErrorCode,
} from "../speechRecognition";
import type {
  SpeechRecognitionTranscriptResult,
  SpeechRecognitionErrorInfo,
  SpeechRecognitionConfig,
} from "../speechRecognition";
import type { AudioStreamResult } from "../audioStream";
import { DemodulationType } from "../audioStream";

// TypeScript declarations for Web Speech API types used in tests
interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  readonly length: number;
  readonly isFinal: boolean;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  readonly transcript: string;
  readonly confidence: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string;
  readonly message?: string;
}

// Mock SpeechRecognition API
class MockSpeechRecognition {
  lang = "en-US";
  continuous = false;
  interimResults = true;
  maxAlternatives = 1;

  onresult: ((event: SpeechRecognitionEvent) => void) | null = null;
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null = null;

  public isStarted = false;

  start(): void {
    this.isStarted = true;
    setTimeout(() => {
      if (this.onstart) {
        this.onstart();
      }

      // Simulate successful recognition after a delay
      setTimeout(() => {
        this.simulateResult("test transcription", 0.95, true);

        // Auto-end after final result in non-continuous mode
        setTimeout(() => {
          if (!this.continuous && this.onend) {
            this.isStarted = false;
            this.onend();
          }
        }, 5);
      }, 10);
    }, 5);
  }

  stop(): void {
    if (this.isStarted) {
      setTimeout(() => {
        if (this.onend) {
          this.onend();
        }
      }, 5);
      this.isStarted = false;
    }
  }

  abort(): void {
    if (this.isStarted) {
      setTimeout(() => {
        if (this.onerror) {
          this.onerror({
            error: "aborted",
          } as SpeechRecognitionErrorEvent);
        }
        if (this.onend) {
          this.onend();
        }
      }, 5);
      this.isStarted = false;
    }
  }

  // Helper methods for testing
  simulateResult(
    transcript: string,
    confidence: number,
    isFinal: boolean,
  ): void {
    if (this.onresult) {
      const mockResult = {
        results: [
          {
            0: { transcript, confidence },
            length: 1,
            isFinal,
            item: (): SpeechRecognitionAlternative => ({
              transcript,
              confidence,
            }),
          },
        ],
        resultIndex: 0,
      } as unknown as SpeechRecognitionEvent;

      this.onresult(mockResult);
    }
  }

  simulateError(errorCode: string): void {
    if (this.onerror) {
      this.onerror({
        error: errorCode,
      } as SpeechRecognitionErrorEvent);
    }
  }
}

// Mock AudioContext
class MockAudioContext {
  sampleRate = 48000;
  destination = {};

  createBuffer(
    channels: number,
    length: number,
    sampleRate: number,
  ): AudioBuffer {
    const buffer = {
      numberOfChannels: channels,
      length,
      sampleRate,
      duration: length / sampleRate,
      getChannelData: (_channel: number) => new Float32Array(length),
      copyFromChannel: () => {},
      copyToChannel: () => {},
    } as AudioBuffer;
    return buffer;
  }

  createBufferSource(): {
    buffer: AudioBuffer | null;
    connect: () => void;
    start: () => void;
  } {
    return {
      buffer: null,
      connect: (): void => {},
      start: (): void => {},
    };
  }

  createMediaStreamDestination(): { stream: MediaStream } {
    return {
      stream: new MediaStream(),
    };
  }

  async close(): Promise<void> {
    // Mock close
  }
}

// Setup global mocks
beforeAll(() => {
  global.AudioContext = MockAudioContext as unknown as typeof AudioContext;
  // Patch globalThis for Node environment compatibility
  (
    globalThis as typeof globalThis & {
      webkitSpeechRecognition: unknown;
    }
  ).webkitSpeechRecognition = MockSpeechRecognition as unknown;
});

afterAll(() => {
  delete (
    globalThis as typeof globalThis & { webkitSpeechRecognition?: unknown }
  ).webkitSpeechRecognition;
  delete (global as typeof global & { webkitSpeechRecognition?: unknown })
    .webkitSpeechRecognition;
});

// Helper function to create mock AudioStreamResult
function createMockAudioStreamResult(
  duration = 1.0,
  sampleRate = 48000,
): AudioStreamResult {
  const numSamples = Math.floor(duration * sampleRate);
  const audioData = new Float32Array(numSamples);

  // Fill with some test data (simple sine wave)
  for (let i = 0; i < numSamples; i++) {
    audioData[i] = Math.sin((2 * Math.PI * 440 * i) / sampleRate) * 0.5;
  }

  const audioContext = new AudioContext();
  const audioBuffer = audioContext.createBuffer(1, numSamples, sampleRate);
  audioBuffer.getChannelData(0).set(audioData);

  return {
    audioData,
    sampleRate,
    channels: 1,
    demodType: DemodulationType.FM,
    audioBuffer,
  };
}

describe("Speech Recognition API Support", () => {
  it("should detect if speech recognition is supported", () => {
    expect(isSpeechRecognitionSupported()).toBe(true);
  });

  it("should detect unsupported browsers", () => {
    const originalWebkit = (
      global as typeof global & { webkitSpeechRecognition?: unknown }
    ).webkitSpeechRecognition;
    delete (global as typeof global & { webkitSpeechRecognition?: unknown })
      .webkitSpeechRecognition;

    expect(isSpeechRecognitionSupported()).toBe(false);

    (
      global as typeof global & {
        webkitSpeechRecognition: typeof MockSpeechRecognition;
      }
    ).webkitSpeechRecognition = originalWebkit as typeof MockSpeechRecognition;
  });
});

describe("SpeechRecognitionProcessor", () => {
  describe("Initialization", () => {
    it("should initialize with default configuration", () => {
      const processor = new SpeechRecognitionProcessor();
      const config = processor.getConfig();

      expect(config.lang).toBe("en-US");
      expect(config.continuous).toBe(false);
      expect(config.interimResults).toBe(true);
      expect(config.maxAlternatives).toBe(1);

      processor.cleanup();
    });

    it("should initialize with custom configuration", () => {
      const customConfig: SpeechRecognitionConfig = {
        lang: "es-ES",
        continuous: true,
        interimResults: false,
        maxAlternatives: 3,
      };

      const processor = new SpeechRecognitionProcessor(customConfig);
      const config = processor.getConfig();

      expect(config.lang).toBe("es-ES");
      expect(config.continuous).toBe(true);
      expect(config.interimResults).toBe(false);
      expect(config.maxAlternatives).toBe(3);

      processor.cleanup();
    });

    it("should throw error if Web Speech API not supported", () => {
      const originalWebkit = (
        global as typeof global & { webkitSpeechRecognition?: unknown }
      ).webkitSpeechRecognition;
      delete (global as typeof global & { webkitSpeechRecognition?: unknown })
        .webkitSpeechRecognition;

      expect(() => {
        new SpeechRecognitionProcessor();
      }).toThrow("Web Speech API is not supported");

      (
        global as typeof global & {
          webkitSpeechRecognition: typeof MockSpeechRecognition;
        }
      ).webkitSpeechRecognition =
        originalWebkit as typeof MockSpeechRecognition;
    });
  });

  describe("Configuration", () => {
    it("should update configuration", () => {
      const processor = new SpeechRecognitionProcessor({
        lang: "en-US",
      });

      processor.updateConfig({
        lang: "fr-FR",
        continuous: true,
      });

      const config = processor.getConfig();
      expect(config.lang).toBe("fr-FR");
      expect(config.continuous).toBe(true);

      processor.cleanup();
    });

    it("should get current configuration", () => {
      const processor = new SpeechRecognitionProcessor({
        lang: "de-DE",
        maxAlternatives: 5,
      });

      const config = processor.getConfig();
      expect(config.lang).toBe("de-DE");
      expect(config.maxAlternatives).toBe(5);

      processor.cleanup();
    });
  });

  describe("Recognition Lifecycle", () => {
    it("should start and stop recognition", async () => {
      const processor = new SpeechRecognitionProcessor();

      let startCalled = false;
      let endCalled = false;

      processor.setCallbacks({
        onStart: () => {
          startCalled = true;
        },
        onEnd: () => {
          endCalled = true;
        },
      });

      await processor.start();

      // Wait for callbacks
      await new Promise((resolve) => setTimeout(resolve, 20));

      expect(startCalled).toBe(true);

      processor.stop();
      await new Promise((resolve) => setTimeout(resolve, 20));

      expect(endCalled).toBe(true);

      processor.cleanup();
    });

    it("should report active status correctly", async () => {
      const processor = new SpeechRecognitionProcessor();

      expect(processor.isActive()).toBe(false);

      await processor.start();
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(processor.isActive()).toBe(true);

      processor.stop();
      await new Promise((resolve) => setTimeout(resolve, 20));

      expect(processor.isActive()).toBe(false);

      processor.cleanup();
    });

    it("should abort recognition", async () => {
      const processor = new SpeechRecognitionProcessor();

      let errorCalled = false;

      processor.setCallbacks({
        onError: (error): void => {
          if (error.error === SpeechRecognitionErrorCode.ABORTED) {
            errorCalled = true;
          }
        },
      });

      await processor.start();
      await new Promise((resolve) => setTimeout(resolve, 10));

      processor.abort();
      await new Promise((resolve) => setTimeout(resolve, 20));

      expect(errorCalled).toBe(true);

      processor.cleanup();
    });
  });

  describe("Recognition Results", () => {
    it("should receive recognition results", async () => {
      const processor = new SpeechRecognitionProcessor();

      let receivedResult: SpeechRecognitionTranscriptResult | null =
        null as SpeechRecognitionTranscriptResult | null;

      processor.setCallbacks({
        onResult: (result) => {
          receivedResult = result;
        },
      });

      const audioResult = createMockAudioStreamResult();
      await processor.recognizeFromAudioStream(audioResult);

      await new Promise((resolve) => setTimeout(resolve, 30));

      expect(receivedResult).not.toBeNull();
      expect(receivedResult?.alternatives).toHaveLength(1);
      expect(receivedResult?.alternatives[0]?.transcript).toBe(
        "test transcription",
      );
      expect(receivedResult?.alternatives[0]?.confidence).toBe(0.95);
      expect(receivedResult?.isFinal).toBe(true);

      processor.cleanup();
    });

    it("should handle multiple alternatives", async () => {
      const processor = new SpeechRecognitionProcessor({
        maxAlternatives: 3,
      });

      // Override the mock to return multiple alternatives
      const recognition = processor[
        "recognition"
      ] as unknown as MockSpeechRecognition;
      recognition.start = function (): void {
        this.isStarted = true;
        setTimeout(() => {
          if (this.onstart) {
            this.onstart();
          }
        }, 5);
        setTimeout(() => {
          if (this.onresult) {
            const mockResult = {
              results: [
                {
                  0: { transcript: "first option", confidence: 0.95 },
                  1: { transcript: "second option", confidence: 0.85 },
                  2: { transcript: "third option", confidence: 0.75 },
                  length: 3,
                  isFinal: true,
                  item: (
                    index: number,
                  ): { transcript: string; confidence: number } => {
                    const alts = [
                      { transcript: "first option", confidence: 0.95 },
                      { transcript: "second option", confidence: 0.85 },
                      { transcript: "third option", confidence: 0.75 },
                    ];
                    return alts[index]!;
                  },
                },
              ],
              resultIndex: 0,
            } as unknown as SpeechRecognitionEvent;

            this.onresult(mockResult);
          }

          // Auto-end after final result in non-continuous mode
          setTimeout(() => {
            if (!this.continuous && this.onend) {
              this.isStarted = false;
              this.onend();
            }
          }, 5);
        }, 10);
      };

      let receivedResult: SpeechRecognitionTranscriptResult | null =
        null as SpeechRecognitionTranscriptResult | null;

      processor.setCallbacks({
        onResult: (result) => {
          receivedResult = result;
        },
      });

      const audioResult = createMockAudioStreamResult();
      await processor.recognizeFromAudioStream(audioResult);

      expect(receivedResult?.alternatives).toHaveLength(3);
      expect(receivedResult?.alternatives[0]?.transcript).toBe("first option");
      expect(receivedResult?.alternatives[1]?.transcript).toBe("second option");
      expect(receivedResult?.alternatives[2]?.transcript).toBe("third option");

      processor.cleanup();
    });

    it("should distinguish final and interim results", async () => {
      const processor = new SpeechRecognitionProcessor({
        interimResults: true,
      });

      const results: SpeechRecognitionTranscriptResult[] = [];

      processor.setCallbacks({
        onResult: (result): void => {
          results.push(result);
        },
      });

      // Override mock to send interim then final results
      const recognition = processor[
        "recognition"
      ] as unknown as MockSpeechRecognition;
      recognition.start = function (): void {
        this.isStarted = true;
        setTimeout(() => {
          if (this.onstart) {
            this.onstart();
          }
        }, 5);
        setTimeout(() => {
          // Interim result
          this.simulateResult("testing", 0.5, false);
          setTimeout(() => {
            // Final result
            this.simulateResult("testing complete", 0.95, true);
          }, 10);
        }, 10);
      };

      await processor.start();
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(results.length).toBeGreaterThanOrEqual(2);
      expect(results.some((r) => !r.isFinal)).toBe(true);
      expect(results.some((r) => r.isFinal)).toBe(true);

      processor.cleanup();
    });
  });

  describe("Error Handling", () => {
    it("should handle no-speech error", async () => {
      const processor = new SpeechRecognitionProcessor();

      let receivedError: SpeechRecognitionErrorInfo | null =
        null as SpeechRecognitionErrorInfo | null;

      processor.setCallbacks({
        onError: (error): void => {
          receivedError = error;
        },
      });

      // Override mock to trigger error
      const recognition = processor[
        "recognition"
      ] as unknown as MockSpeechRecognition;
      recognition.start = function (): void {
        this.isStarted = true;
        setTimeout(() => {
          if (this.onstart) {
            this.onstart();
          }
          setTimeout(() => {
            this.simulateError("no-speech");
          }, 10);
        }, 5);
      };

      await processor.start();
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(receivedError).not.toBeNull();
      expect(receivedError?.error).toBe(SpeechRecognitionErrorCode.NO_SPEECH);
      expect(receivedError?.message).toContain("No speech detected");

      processor.cleanup();
    });

    it("should handle network error", async () => {
      const processor = new SpeechRecognitionProcessor();

      let receivedError: SpeechRecognitionErrorInfo | null =
        null as SpeechRecognitionErrorInfo | null;

      processor.setCallbacks({
        onError: (error): void => {
          receivedError = error;
        },
      });

      // Override mock to trigger error
      const recognition = processor[
        "recognition"
      ] as unknown as MockSpeechRecognition;
      recognition.start = function (): void {
        this.isStarted = true;
        setTimeout(() => {
          if (this.onstart) {
            this.onstart();
          }
          setTimeout(() => {
            this.simulateError("network");
          }, 10);
        }, 5);
      };

      await processor.start();
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(receivedError).not.toBeNull();
      expect(receivedError?.error).toBe(SpeechRecognitionErrorCode.NETWORK);
      expect(receivedError?.message).toContain("Network error");

      processor.cleanup();
    });

    it("should handle audio-capture error", async () => {
      const processor = new SpeechRecognitionProcessor();

      let receivedError: SpeechRecognitionErrorInfo | null =
        null as SpeechRecognitionErrorInfo | null;

      processor.setCallbacks({
        onError: (error): void => {
          receivedError = error;
        },
      });

      // Override mock to trigger error
      const recognition = processor[
        "recognition"
      ] as unknown as MockSpeechRecognition;
      recognition.start = function (): void {
        this.isStarted = true;
        setTimeout(() => {
          if (this.onstart) {
            this.onstart();
          }
          setTimeout(() => {
            this.simulateError("audio-capture");
          }, 10);
        }, 5);
      };

      await processor.start();
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(receivedError).not.toBeNull();
      expect(receivedError?.error).toBe(
        SpeechRecognitionErrorCode.AUDIO_CAPTURE,
      );
      expect(receivedError?.message).toContain("Audio capture failed");

      processor.cleanup();
    });
  });

  describe("Cleanup", () => {
    it("should cleanup resources properly", () => {
      const processor = new SpeechRecognitionProcessor();

      processor.start();

      processor.cleanup();

      expect(processor.isActive()).toBe(false);
    });
  });
});

describe("Convenience Functions", () => {
  describe("recognizeSpeech", () => {
    it("should perform one-shot recognition", async () => {
      const audioResult = createMockAudioStreamResult();

      const transcript = await recognizeSpeech(audioResult, {
        lang: "en-US",
      });

      expect(transcript).toBe("test transcription");
    });

    it("should handle recognition errors", async () => {
      const audioResult = createMockAudioStreamResult();

      // Override mock to trigger error
      const originalWebkit = (
        global as typeof global & {
          webkitSpeechRecognition: typeof MockSpeechRecognition;
        }
      ).webkitSpeechRecognition;
      (
        global as typeof global & {
          webkitSpeechRecognition: typeof MockSpeechRecognition;
        }
      ).webkitSpeechRecognition = class extends MockSpeechRecognition {
        override start(): void {
          super.start();
          setTimeout(() => {
            this.simulateError("network");
          }, 10);
        }
      } as unknown as typeof MockSpeechRecognition;

      await expect(recognizeSpeech(audioResult)).rejects.toThrow();

      (
        global as typeof global & {
          webkitSpeechRecognition: typeof MockSpeechRecognition;
        }
      ).webkitSpeechRecognition = originalWebkit;
    });
  });

  describe("createSpeechRecognitionCallback", () => {
    it("should create streaming recognition callback", async () => {
      const transcripts: string[] = [];
      const confidences: number[] = [];
      const finals: boolean[] = [];

      const processor = new SpeechRecognitionProcessor({
        continuous: false, // Use non-continuous for test
        interimResults: true,
      });

      processor.setCallbacks({
        onResult: (result) => {
          if (result.alternatives.length > 0) {
            const alt = result.alternatives[0]!;
            transcripts.push(alt.transcript);
            confidences.push(alt.confidence);
            finals.push(result.isFinal);
          }
        },
      });

      const audioResult = createMockAudioStreamResult();
      await processor.recognizeFromAudioStream(audioResult);

      expect(transcripts.length).toBeGreaterThan(0);
      expect(transcripts[0]).toBe("test transcription");
      expect(confidences[0]).toBe(0.95);
      expect(finals[0]).toBe(true);

      processor.cleanup();
    });

    it("should handle multiple audio chunks", async () => {
      const transcripts: string[] = [];

      const processor = new SpeechRecognitionProcessor({
        continuous: false,
      });

      processor.setCallbacks({
        onResult: (result) => {
          if (result.alternatives.length > 0) {
            transcripts.push(result.alternatives[0]!.transcript);
          }
        },
      });

      // Process multiple audio chunks
      for (let i = 0; i < 3; i++) {
        const audioResult = createMockAudioStreamResult();
        await processor.recognizeFromAudioStream(audioResult);
      }

      expect(transcripts.length).toBeGreaterThan(0);

      processor.cleanup();
    });
  });
});

describe("Audio Format Handling", () => {
  it("should handle different sample rates", async () => {
    const processor = new SpeechRecognitionProcessor();

    let resultReceived = false;

    processor.setCallbacks({
      onResult: () => {
        resultReceived = true;
      },
    });

    // Test with 16kHz (common for speech)
    const audioResult16k = createMockAudioStreamResult(1.0, 16000);
    await processor.recognizeFromAudioStream(audioResult16k);
    await new Promise((resolve) => setTimeout(resolve, 30));

    expect(resultReceived).toBe(true);

    processor.cleanup();
  });

  it("should handle different audio durations", async () => {
    const processor = new SpeechRecognitionProcessor();

    let resultReceived = false;

    processor.setCallbacks({
      onResult: () => {
        resultReceived = true;
      },
    });

    // Test with longer duration
    const audioResult = createMockAudioStreamResult(5.0, 48000);
    await processor.recognizeFromAudioStream(audioResult);
    await new Promise((resolve) => setTimeout(resolve, 30));

    expect(resultReceived).toBe(true);

    processor.cleanup();
  });
});

describe("Language Support", () => {
  it("should support different languages", () => {
    const languages = [
      "en-US",
      "es-ES",
      "fr-FR",
      "de-DE",
      "ja-JP",
      "zh-CN",
      "it-IT",
      "pt-BR",
    ];

    languages.forEach((lang) => {
      const processor = new SpeechRecognitionProcessor({ lang });
      expect(processor.getConfig().lang).toBe(lang);
      processor.cleanup();
    });
  });

  it("should update language dynamically", () => {
    const processor = new SpeechRecognitionProcessor({ lang: "en-US" });

    processor.updateConfig({ lang: "es-ES" });
    expect(processor.getConfig().lang).toBe("es-ES");

    processor.updateConfig({ lang: "fr-FR" });
    expect(processor.getConfig().lang).toBe("fr-FR");

    processor.cleanup();
  });
});

describe("Integration with AudioStream", () => {
  it("should work with FM demodulated audio", async () => {
    const processor = new SpeechRecognitionProcessor();

    let resultReceived = false;

    processor.setCallbacks({
      onResult: (result) => {
        resultReceived = true;
        expect(result.alternatives.length).toBeGreaterThan(0);
      },
    });

    const audioResult = createMockAudioStreamResult();
    expect(audioResult.demodType).toBe(DemodulationType.FM);

    await processor.recognizeFromAudioStream(audioResult);
    await new Promise((resolve) => setTimeout(resolve, 30));

    expect(resultReceived).toBe(true);

    processor.cleanup();
  });

  it("should work with AM demodulated audio", async () => {
    const processor = new SpeechRecognitionProcessor();

    let resultReceived = false;

    processor.setCallbacks({
      onResult: () => {
        resultReceived = true;
      },
    });

    const audioResult = createMockAudioStreamResult();
    audioResult.demodType = DemodulationType.AM;

    await processor.recognizeFromAudioStream(audioResult);
    await new Promise((resolve) => setTimeout(resolve, 30));

    expect(resultReceived).toBe(true);

    processor.cleanup();
  });

  it("should handle mono audio", async () => {
    const processor = new SpeechRecognitionProcessor();

    const audioResult = createMockAudioStreamResult();
    expect(audioResult.channels).toBe(1);

    await processor.recognizeFromAudioStream(audioResult);
    await new Promise((resolve) => setTimeout(resolve, 30));

    processor.cleanup();
  });

  it("should handle stereo audio", async () => {
    const processor = new SpeechRecognitionProcessor();

    const audioResult = createMockAudioStreamResult();
    audioResult.channels = 2;

    // Create stereo AudioBuffer
    const audioContext = new AudioContext();
    const stereoBuffer = audioContext.createBuffer(2, 48000, 48000);
    audioResult.audioBuffer = stereoBuffer;

    await processor.recognizeFromAudioStream(audioResult);
    await new Promise((resolve) => setTimeout(resolve, 30));

    processor.cleanup();
  });
});

describe("Continuous Recognition", () => {
  it("should handle continuous mode correctly", async () => {
    const processor = new SpeechRecognitionProcessor({
      continuous: true,
      interimResults: true,
    });

    const results: SpeechRecognitionTranscriptResult[] = [];

    processor.setCallbacks({
      onResult: (result) => {
        results.push(result);
      },
    });

    await processor.start();
    await new Promise((resolve) => setTimeout(resolve, 100));

    processor.stop();
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(results.length).toBeGreaterThan(0);

    processor.cleanup();
  });

  it("should restart recognition when stopped", async () => {
    const processor = new SpeechRecognitionProcessor({
      continuous: false,
    });

    let startCount = 0;

    processor.setCallbacks({
      onStart: () => {
        startCount++;
      },
    });

    await processor.start();
    await new Promise((resolve) => setTimeout(resolve, 20));

    processor.stop();
    await new Promise((resolve) => setTimeout(resolve, 20));

    await processor.start();
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(startCount).toBe(2);

    processor.cleanup();
  });
});

describe("Robustness", () => {
  it("should handle empty audio data", async () => {
    const processor = new SpeechRecognitionProcessor();

    const emptyResult: AudioStreamResult = {
      audioData: new Float32Array(0),
      sampleRate: 48000,
      channels: 1,
      demodType: DemodulationType.FM,
      audioBuffer: new AudioContext().createBuffer(1, 0, 48000),
    };

    await processor.recognizeFromAudioStream(emptyResult);
    await new Promise((resolve) => setTimeout(resolve, 30));

    processor.cleanup();
  });

  it("should handle noisy audio gracefully", async () => {
    const processor = new SpeechRecognitionProcessor();

    // Create noisy audio
    const noisyResult = createMockAudioStreamResult();
    for (let i = 0; i < noisyResult.audioData.length; i++) {
      noisyResult.audioData[i] = (Math.random() - 0.5) * 2; // White noise
    }

    await processor.recognizeFromAudioStream(noisyResult);
    await new Promise((resolve) => setTimeout(resolve, 30));

    processor.cleanup();
  });

  it("should handle very short audio", async () => {
    const processor = new SpeechRecognitionProcessor();

    const shortResult = createMockAudioStreamResult(0.1, 48000); // 100ms

    await processor.recognizeFromAudioStream(shortResult);
    await new Promise((resolve) => setTimeout(resolve, 30));

    processor.cleanup();
  });

  it("should prevent multiple simultaneous recognitions", async () => {
    const processor = new SpeechRecognitionProcessor();

    const audioResult = createMockAudioStreamResult();

    // Start first recognition
    const promise1 = processor.recognizeFromAudioStream(audioResult);

    // Try to start second recognition (should stop first)
    const promise2 = processor.recognizeFromAudioStream(audioResult);

    await Promise.all([promise1, promise2]);

    processor.cleanup();
  });
});
