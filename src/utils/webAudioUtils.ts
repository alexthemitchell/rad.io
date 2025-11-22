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
    const numFrames = Math.floor(samples.length / 2);
    const leftChannel = new Float32Array(numFrames);
    const rightChannel = new Float32Array(numFrames);

    for (let i = 0; i < numFrames; i++) {
      const leftIdx = i * 2;
      const rightIdx = i * 2 + 1;
      if (leftIdx < samples.length) {
        leftChannel[i] = samples[leftIdx];
      }
      if (rightIdx < samples.length) {
        rightChannel[i] = samples[rightIdx];
      }
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
  // Iterate only within bounds to avoid undefined access
  for (const buffer of buffers) {
    const len = Math.min(buffer.length, mixed.length);
    for (let i = 0; i < len; i++) {
      // Both arrays are Float32Array initialized with zeros
      // Indexing within bounds always returns a number
      const mixedVal = mixed[i];
      const bufferVal = buffer[i];
      if (mixedVal !== undefined && bufferVal !== undefined) {
        mixed[i] = mixedVal + bufferVal;
      }
    }
  }

  // Normalize by buffer count to prevent clipping
  const scale = 1 / buffers.length;
  for (let i = 0; i < mixed.length; i++) {
    const val = mixed[i];
    if (val !== undefined) {
      mixed[i] = val * scale;
    }
  }

  return mixed;
}
