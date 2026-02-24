import { describe, expect, it, vi } from 'vitest';
import { AudioSink } from './AudioSink';

class MockGainParam {
  value = 1;

  cancelScheduledValues(): void {}

  setValueAtTime(value: number): void {
    this.value = value;
  }

  linearRampToValueAtTime(value: number): void {
    this.value = value;
  }
}

class MockAudioContext {
  currentTime = 0;
  destination = {};
  sinkId = 'default';

  createGain() {
    return {
      gain: new MockGainParam(),
      connect: () => {}
    };
  }

  createBuffer(_channels: number, length: number, sampleRate: number) {
    const data = new Float32Array(length);
    return {
      duration: length / sampleRate,
      getChannelData: () => data
    };
  }

  createBufferSource() {
    return {
      buffer: null as unknown,
      connect: () => {},
      start: () => {}
    };
  }

  setSinkId(nextSinkId: string): Promise<void> {
    this.sinkId = nextSinkId;
    return Promise.resolve();
  }

  resume(): Promise<void> {
    return Promise.resolve();
  }

  close(): Promise<void> {
    return Promise.resolve();
  }
}

describe('AudioSink', () => {
  it('tracks limiter activity for hot samples and concealment for underruns', async () => {
    vi.useFakeTimers();
    const originalAudioContext = (globalThis as { AudioContext?: unknown }).AudioContext;
    (globalThis as { AudioContext?: unknown }).AudioContext = MockAudioContext;

    const sink = new AudioSink(50_000);
    sink.setSafetyConfig({ maxOutputLevel: 0.45, limiterDrive: 2.2 });
    await sink.start();

    const loud = new Float32Array(1_024);
    loud.fill(1.6);
    sink.push(loud);

    ((sink as unknown as { ctx?: { currentTime: number } }).ctx as { currentTime: number }).currentTime = 1;
    sink.push(new Float32Array(1_024));

    const stats = sink.getStats();
    expect(stats.limiterEvents).toBeGreaterThan(0);
    expect(stats.concealmentEvents).toBeGreaterThan(0);
    expect(stats.popSuppressionEvents).toBeGreaterThan(0);

    sink.stop();
    (globalThis as { AudioContext?: unknown }).AudioContext = originalAudioContext;
    vi.useRealTimers();
  });

  it('applies requested output device when sink selection is available', async () => {
    const originalAudioContext = (globalThis as { AudioContext?: unknown }).AudioContext;
    (globalThis as { AudioContext?: unknown }).AudioContext = MockAudioContext;

    const sink = new AudioSink(50_000);
    await sink.start();

    const applied = await sink.setOutputDevice('device-usb-dac');
    expect(applied).toBe(true);
    expect(sink.getOutputDeviceId()).toBe('device-usb-dac');

    sink.stop();
    (globalThis as { AudioContext?: unknown }).AudioContext = originalAudioContext;
  });

  it('stores output device preference when sink selection is unavailable', async () => {
    const originalAudioContext = (globalThis as { AudioContext?: unknown }).AudioContext;

    class NoSinkAudioContext {
      currentTime = 0;
      destination = {};

      createGain() {
        return {
          gain: new MockGainParam(),
          connect: () => {}
        };
      }

      createBuffer(_channels: number, length: number, sampleRate: number) {
        const data = new Float32Array(length);
        return {
          duration: length / sampleRate,
          getChannelData: () => data
        };
      }

      createBufferSource() {
        return {
          buffer: null as unknown,
          connect: () => {},
          start: () => {}
        };
      }

      resume(): Promise<void> {
        return Promise.resolve();
      }

      close(): Promise<void> {
        return Promise.resolve();
      }
    }

    (globalThis as { AudioContext?: unknown }).AudioContext = NoSinkAudioContext;

    const sink = new AudioSink(50_000);
    await sink.start();

    const applied = await sink.setOutputDevice('device-speaker');
    expect(applied).toBe(false);
    expect(sink.getOutputDeviceId()).toBe('device-speaker');

    sink.stop();
    (globalThis as { AudioContext?: unknown }).AudioContext = originalAudioContext;
  });
});
