export type SupportedSampleFormat = 'u8-iq-interleaved' | 'i8-iq-interleaved';

export type SampleFormatNormalizationResult = {
  normalizedIq: Float32Array;
  format: SupportedSampleFormat;
};

const normalizeU8 = (bytes: Uint8Array): Float32Array => {
  const out = new Float32Array(bytes.length);
  for (let i = 0; i < bytes.length; i += 1) {
    out[i] = (bytes[i] - 128) / 128;
  }
  return out;
};

const normalizeI8 = (bytes: Int8Array): Float32Array => {
  const out = new Float32Array(bytes.length);
  for (let i = 0; i < bytes.length; i += 1) {
    out[i] = bytes[i] / 128;
  }
  return out;
};

export const normalizeInterleavedIq = (
  input: Uint8Array | Int8Array,
  format: SupportedSampleFormat
): SampleFormatNormalizationResult => {
  const normalizedIq = format === 'u8-iq-interleaved' ? normalizeU8(input as Uint8Array) : normalizeI8(input as Int8Array);
  return {
    normalizedIq,
    format
  };
};
