import { describe, expect, it } from 'vitest';
import {
  decodeShareableSessionState,
  encodeShareableSessionState,
  type ShareableSessionStateV1
} from './shareableSessionState';

describe('shareableSessionState', () => {
  it('round-trips a valid shareable state payload', () => {
    const state: ShareableSessionStateV1 = {
      version: 1,
      frequencyHz: 102_300_000,
      demodMode: 'NFM',
      fineFreqHz: 1_250,
      ppmCorrection: -12.5,
      streamSampleRateHz: 2_000_000,
      bandwidthHz: 12_500,
      latencyPolicy: 'stable',
      zoomLevel: 2
    };

    const encoded = encodeShareableSessionState(state);
    const decoded = decodeShareableSessionState(encoded);

    expect(decoded).toEqual(state);
  });

  it('rejects malformed and out-of-range payloads', () => {
    expect(decodeShareableSessionState('')).toBeNull();
    expect(decodeShareableSessionState('not-base64url')).toBeNull();

    const invalidEncoded = btoa(JSON.stringify({
      version: 1,
      frequencyHz: 90_000_000,
      demodMode: 'WFM',
      fineFreqHz: 0,
      ppmCorrection: 0,
      streamSampleRateHz: 1_234_567,
      bandwidthHz: 180_000,
      latencyPolicy: 'stable',
      zoomLevel: 1
    }))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '');

    expect(decodeShareableSessionState(invalidEncoded)).toBeNull();
  });
});
