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
 * Play audio buffer through Web Audio API.
 *
 * WARNING: This function plays the buffer immediately and may result in overlapping audio
 * if called rapidly or concurrently (e.g., in multi-VFO contexts). This is intentional for
 * mixing, but may cause audio artifacts if buffers are small or not synchronized.
 *
 * The function is fire-and-forget - it does not wait for playback to complete.
 */
export function playAudioBuffer(
  context: AudioContext | null,
  samples: Float32Array,
  sampleRate: number,
): void {
  if (!context) {
    // Audio context not available, skip playback
    return;
  }

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

  // Play (fire-and-forget)
  source.start();
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
  const numFrames =
    channels === 2 ? Math.floor(samples.length / 2) : samples.length;
  const buffer = context.createBuffer(channels, numFrames, sampleRate);

  if (channels === 1) {
    buffer.copyToChannel(samples, 0);
  } else if (channels === 2) {
    // For stereo, split samples into left and right
    const leftChannel = new Float32Array(numFrames);
    const rightChannel = new Float32Array(numFrames);

    // Handle odd-length arrays where rightIdx may exceed length
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
export function mixAudioBuffers(buffers: Float32Array[]): Float32Array {
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
    const len = Math.min(buffer.length, mixed.length);
    for (let i = 0; i < len; i++) {
      // Float32Array elements are initialized to 0 and accessed within bounds
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
