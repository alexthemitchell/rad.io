import { describe, expect, it } from 'vitest';
import { SsbDemodulator } from './SsbDemodulator';

describe('SsbDemodulator', () => {
  it('produces audio for USB input', () => {
    const demod = new SsbDemodulator();
    demod.setConfig('USB', 1500, 48_000);

    const len = 4096;
    const iq = new Float32Array(len * 2);
    const audio = new Float32Array(len);

    for (let i = 0; i < len; i += 1) {
      const ph = (2 * Math.PI * 1800 * i) / 48_000;
      iq[i * 2] = 120 * Math.cos(ph);
      iq[(i * 2) + 1] = 120 * Math.sin(ph);
    }

    demod.process(iq, audio);
    let peak = 0;
    for (let i = 0; i < audio.length; i += 1) peak = Math.max(peak, Math.abs(audio[i]));
    expect(peak).toBeGreaterThan(0.01);
  });

  it('produces a different waveform for LSB mode', () => {
    const len = 2048;
    const iq = new Float32Array(len * 2);
    for (let i = 0; i < len; i += 1) {
      const ph = (2 * Math.PI * 1200 * i) / 48_000;
      iq[i * 2] = 120 * Math.cos(ph);
      iq[(i * 2) + 1] = 120 * Math.sin(ph);
    }

    const usbDemod = new SsbDemodulator();
    usbDemod.setConfig('USB', 1500, 48_000);
    const lsbDemod = new SsbDemodulator();
    lsbDemod.setConfig('LSB', 1500, 48_000);

    const usb = new Float32Array(len);
    const lsb = new Float32Array(len);
    usbDemod.process(iq, usb);
    lsbDemod.process(iq, lsb);

    let diff = 0;
    for (let i = 0; i < len; i += 1) diff += Math.abs(usb[i] - lsb[i]);
    expect(diff / len).toBeGreaterThan(1e-4);
  });
});
