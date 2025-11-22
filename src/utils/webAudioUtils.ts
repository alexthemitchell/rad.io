/**
 * Web Audio API Utilities
 *
 * Helper functions for working with the Web Audio API.
 */

/**
 * Create or reuse AudioContext
 */
let globalAudioContext: AudioContext | null = null;

export function createAudioContext(): AudioContext | null {
  // AudioContext is not available in test/Node environment
  if (typeof AudioContext === "undefined") {
    console.warn("AudioContext is not available in this environment");
    return null;
  }

  globalAudioContext ??= new AudioContext({ sampleRate: 48000 });
  return globalAudioContext;
}

/**
 * Get the global AudioContext
 */
export function getAudioContext(): AudioContext | null {
  return globalAudioContext;
}

/**
 * Play audio buffer through Web Audio API
 */
export async function playAudioBuffer(
  context: AudioContext | null,
  samples: Float32Array,
  sampleRate: number,
): Promise<void> {
  if (!context) {
    // Audio context not available, skip playback
    return;
  }

  return new Promise((resolve, reject) => {
    try {
      // Resume context if suspended
      if (context.state === "suspended") {
        void context.resume();
      }

      // Create buffer
      const buffer = context.createBuffer(1, samples.length, sampleRate);
      buffer.copyToChannel(samples, 0);

      // Create source
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.connect(context.destination);

      // Play
      source.onended = (): void => resolve();
      source.start();
    } catch (error) {
      reject(error instanceof Error ? error : new Error(String(error)));
    }
  });
}

/**
 * Create a gain node for volume control
 */
export function createGainNode(
  context: AudioContext,
  gainValue: number,
): GainNode {
  const gainNode = context.createGain();
  gainNode.gain.value = gainValue;
  return gainNode;
}

/**
 * Convert Float32Array audio to AudioBuffer
 */
export function createAudioBufferFromSamples(
  context: AudioContext,
  samples: Float32Array,
  sampleRate: number,
  channels = 1,
): AudioBuffer {
  const buffer = context.createBuffer(channels, samples.length, sampleRate);

  if (channels === 1) {
    buffer.copyToChannel(samples, 0);
  } else if (channels === 2) {
    // For stereo, split samples into left and right
    const leftChannel = new Float32Array(samples.length / 2);
    const rightChannel = new Float32Array(samples.length / 2);

    for (let i = 0; i < samples.length / 2; i++) {
      leftChannel[i] = samples[i * 2] ?? 0;
      rightChannel[i] = samples[i * 2 + 1] ?? 0;
    }

    buffer.copyToChannel(leftChannel, 0);
    buffer.copyToChannel(rightChannel, 1);
  }

  return buffer;
}

/**
 * Mix multiple audio buffers
 */
export function mixAudioBuffers(
  context: AudioContext,
  buffers: Float32Array[],
): Float32Array {
  if (buffers.length === 0) {
    return new Float32Array(0);
  }

  if (buffers.length === 1 && buffers[0]) {
    return buffers[0];
  }

  // Find max length
  const maxLength = Math.max(...buffers.map((b) => b.length));
  const mixed = new Float32Array(maxLength);

  // Simple sum with normalization
  for (const buffer of buffers) {
    for (let i = 0; i < buffer.length; i++) {
      mixed[i] = (mixed[i] ?? 0) + (buffer[i] ?? 0);
    }
  }

  // Normalize by buffer count to prevent clipping
  const scale = 1 / buffers.length;
  for (let i = 0; i < mixed.length; i++) {
    mixed[i] = (mixed[i] ?? 0) * scale;
  }

  return mixed;
}
