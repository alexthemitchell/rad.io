/**
 * Additional branch coverage for speechRecognition
 */

import {
  SpeechRecognitionProcessor,
  isSpeechRecognitionSupported,
  SpeechRecognitionErrorCode,
} from "../speechRecognition";
import type { AudioStreamResult } from "../audioStream";
import { DemodulationType } from "../audioStream";

// Minimal mock SpeechRecognition for standard (non-webkit) branch
class StdMockSpeechRecognition {
  lang = "en-US";
  continuous = false;
  interimResults = true;
  maxAlternatives = 1;

  onresult: ((e: any) => void) | null = null;
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  onerror: ((e: any) => void) | null = null;

  isStarted = false;

  start(): void {
    this.isStarted = true;
    setTimeout(() => {
      if (this.onstart) this.onstart();
    }, 1);
  }
  stop(): void {
    if (this.onend) this.onend();
    this.isStarted = false;
  }
  abort(): void {
    if (this.onerror) this.onerror({ error: "aborted" });
    if (this.onend) this.onend();
    this.isStarted = false;
  }
}

function makeAudio(): AudioStreamResult {
  const sampleRate = 48000;
  const audioData = new Float32Array(1024);
  const audioBuffer = new AudioContext().createBuffer(1, 1024, sampleRate);
  return {
    audioData,
    sampleRate,
    channels: 1,
    demodType: DemodulationType.FM,
    audioBuffer,
  };
}

describe("speechRecognition extra branches", () => {
  beforeAll(() => {
    // Ensure no webkit so the standard path is chosen
    delete (globalThis as any).webkitSpeechRecognition;
    // Standard constructor
    (globalThis as any).SpeechRecognition = StdMockSpeechRecognition;
    // Basic AudioContext mock (in case jest env lacks a real one)
    if (!(globalThis as any).AudioContext) {
      (globalThis as any).AudioContext = class {
        createBuffer(ch: number, len: number, sr: number) {
          return {
            numberOfChannels: ch,
            length: len,
            sampleRate: sr,
            getChannelData: () => new Float32Array(len),
          } as any;
        }
      } as any;
    }
  });

  afterAll(() => {
    delete (globalThis as any).SpeechRecognition;
  });

  it("supports standard SpeechRecognition without webkit", () => {
    expect(isSpeechRecognitionSupported()).toBe(true);
  });

  it("covers additional error code branches (not-allowed, language-not-supported)", async () => {
    const proc = new SpeechRecognitionProcessor();

    let seenErrors: string[] = [];
    proc.setCallbacks({
      onError: (e) => {
        seenErrors.push(e.error);
      },
    });

    // Patch underlying recognition to emit different errors
    const rec = (proc as any)["recognition"] as StdMockSpeechRecognition;
    rec.start = function () {
      this.isStarted = true;
      setTimeout(() => {
        if (this.onstart) this.onstart();
        setTimeout(() => {
          if (this.onerror) this.onerror({ error: "not-allowed" });
          setTimeout(() => {
            if (this.onerror) this.onerror({ error: "language-not-supported" });
            if (this.onend) this.onend();
          }, 2);
        }, 2);
      }, 1);
    };

    await proc.recognizeFromAudioStream(makeAudio()).catch(() => void 0);

    expect(seenErrors).toEqual(
      expect.arrayContaining([
        SpeechRecognitionErrorCode.NOT_ALLOWED,
        "language-not-supported",
      ]),
    );

    proc.cleanup();
  });
});
