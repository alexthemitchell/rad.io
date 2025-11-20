import { VendorRequest, TransceiverMode } from "../constants";
import { deriveSampleRateParams } from "../util";
import { type Transport } from "./transport";
import {
  UINT32_MAX,
  MHZ_IN_HZ,
  MIN_FREQUENCY_HZ,
  MAX_FREQUENCY_HZ,
  MIN_SAMPLE_RATE,
  MAX_SAMPLE_RATE,
} from "./types";

export function assertFiniteNonNegative(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${label} must be a non-negative finite number`);
  }
}

export function splitFrequencyComponents(frequencyHz: number): {
  mhz: number;
  hz: number;
} {
  assertFiniteNonNegative(frequencyHz, "Frequency");
  const rounded = Math.round(frequencyHz);
  const mhz = Math.floor(rounded / MHZ_IN_HZ);
  const hz = rounded - mhz * MHZ_IN_HZ;
  if (mhz > UINT32_MAX || hz > UINT32_MAX) {
    throw new Error("Frequency components exceed uint32 range");
  }
  return { mhz, hz };
}

export function createUint32LEBuffer(values: number[]): ArrayBuffer {
  const buffer = new ArrayBuffer(values.length * 4);
  const view = new DataView(buffer);
  values.forEach((value, index) => {
    assertFiniteNonNegative(value, "Control value");
    const rounded = Math.round(value);
    if (rounded > UINT32_MAX) {
      throw new Error("Control value exceeds uint32 range");
    }
    view.setUint32(index * 4, rounded >>> 0, true);
  });
  return buffer;
}

export interface StreamOps {
  isStreaming: boolean;
  stopRx: () => Promise<void>;
}

export class Config {
  private transport: Transport;
  private streamOps: StreamOps | null = null;

  public lastSampleRate: number | null = null;
  public configuredOnce = false;
  public lastFrequency: number | null = null;
  public lastBandwidth: number | null = null;
  public lastLNAGain: number | null = null;
  public lastAmpEnabled = false;

  constructor(transport: Transport) {
    this.transport = transport;
  }

  setStreamOps(ops: StreamOps): void {
    this.streamOps = ops;
  }

  async setTransceiverMode(value: TransceiverMode): Promise<void> {
    await this.transport.controlTransferOut({
      command: VendorRequest.SET_TRANSCEIVER_MODE,
      value,
    });
  }

  async setFrequency(frequency: number): Promise<void> {
    if (this.lastFrequency === frequency) {
      return;
    }
    if (!this.transport.usbDevice.opened && !this.transport.closing) {
      await this.transport.open(true);
    }
    if (frequency < MIN_FREQUENCY_HZ || frequency > MAX_FREQUENCY_HZ) {
      throw new Error(
        `Frequency ${frequency / 1e6} MHz out of range. ` +
          `HackRF One supports ${MIN_FREQUENCY_HZ / 1e6} MHz to ${MAX_FREQUENCY_HZ / 1e6} MHz`,
      );
    }

    if (process.env["NODE_ENV"] === "development") {
      console.debug("setFrequency", {
        frequency,
        frequencyMHz: (frequency / 1e6).toFixed(3),
      });
    }

    const wasStreaming = this.streamOps?.isStreaming ?? false;
    const shouldQuiesce = wasStreaming;

    if (shouldQuiesce) {
      try {
        await this.streamOps?.stopRx();
        await this.transport.delay(50);
      } catch {
        // best-effort
      }
    }

    try {
      const { mhz, hz } = splitFrequencyComponents(frequency);
      const payload = createUint32LEBuffer([mhz, hz]);

      await this.transport.controlTransferOut(
        {
          command: VendorRequest.SET_FREQ,
          data: payload,
        },
        {
          isSetFreq: true,
          wasStreaming,
          onFailure: (_err) => {
            // We might want to track error here or in Transport
          },
          performReset: async () => {
            await Promise.resolve();
            return false; // Placeholder
          },
        },
      );

      this.lastFrequency = frequency;
      await this.transport.delay(20);
    } finally {
      if (shouldQuiesce && !this.transport.closing) {
        try {
          await this.setTransceiverMode(TransceiverMode.RECEIVE);
        } catch {
          // ignore
        }
      }
    }
  }

  async setSampleRate(sampleRate: number): Promise<void> {
    if (this.lastSampleRate === sampleRate) {
      this.configuredOnce = true;
      return;
    }
    if (!this.transport.usbDevice.opened && !this.transport.closing) {
      await this.transport.open(true);
    }
    try {
      await this.setTransceiverMode(TransceiverMode.OFF);
      await this.transport.delay(50);
    } catch {
      // Non-fatal
    }
    if (sampleRate < MIN_SAMPLE_RATE || sampleRate > MAX_SAMPLE_RATE) {
      throw new Error(
        `Sample rate ${sampleRate / 1e6} MSPS out of range. ` +
          `HackRF One supports ${MIN_SAMPLE_RATE / 1e6} to ${MAX_SAMPLE_RATE / 1e6} MSPS`,
      );
    }

    if (process.env["NODE_ENV"] === "development") {
      console.debug("setSampleRate", {
        sampleRate,
        sampleRateMSPS: (sampleRate / 1e6).toFixed(3),
      });
    }

    const { freqHz, divider } = deriveSampleRateParams(sampleRate);
    const payload = createUint32LEBuffer([freqHz, divider]);
    await this.transport.delay(15);

    await this.transport.controlTransferOut(
      {
        command: VendorRequest.SAMPLE_RATE_SET,
        data: payload,
      },
      {
        isSampleRate: true,
      },
    );

    this.lastSampleRate = sampleRate;
    this.configuredOnce = true;
    await this.transport.delay(20);
  }

  async setBandwidth(bandwidthHz: number): Promise<void> {
    if (this.lastBandwidth === bandwidthHz) {
      return;
    }
    if (!this.transport.usbDevice.opened && !this.transport.closing) {
      await this.transport.open(true);
    }
    assertFiniteNonNegative(bandwidthHz, "Bandwidth");
    const rounded = Math.round(bandwidthHz);
    if (rounded > UINT32_MAX) {
      throw new Error("Bandwidth exceeds uint32 range");
    }
    const value = rounded & 0xffff;
    const index = (rounded >>> 16) & 0xffff;
    await this.transport.controlTransferOut({
      command: VendorRequest.BASEBAND_FILTER_BANDWIDTH_SET,
      value,
      index,
    });
    this.lastBandwidth = bandwidthHz;
  }

  async setLNAGain(gain: number): Promise<void> {
    if (this.lastLNAGain === gain) {
      return;
    }
    if (!this.transport.usbDevice.opened && !this.transport.closing) {
      await this.transport.open(true);
    }
    await this.transport.controlTransferOut({
      command: VendorRequest.SET_LNA_GAIN,
      value: gain,
      index: 0,
    });
    this.lastLNAGain = gain;
  }

  async setAmpEnable(enabled: boolean): Promise<void> {
    if (this.lastAmpEnabled === enabled) {
      return;
    }
    const value = Number(enabled);
    await this.transport.controlTransferOut({
      command: VendorRequest.AMP_ENABLE,
      value,
    });
    this.lastAmpEnabled = enabled;
  }

  async performInitializationSequence(): Promise<void> {
    if (this.configuredOnce) return;

    const sequence: Array<{ name: string; fn: () => Promise<void> }> = [];

    const applyTransceiverMode = async (): Promise<void> => {
      await this.setTransceiverMode(TransceiverMode.RECEIVE);
    };
    const applySampleRate = async (): Promise<void> => {
      if (this.lastSampleRate) {
        await this.setSampleRate(this.lastSampleRate);
      }
    };
    const applyBandwidth = async (): Promise<void> => {
      if (this.lastBandwidth) {
        await this.setBandwidth(this.lastBandwidth);
      }
    };
    const applyFrequency = async (): Promise<void> => {
      if (this.lastFrequency) {
        await this.setFrequency(this.lastFrequency);
      }
    };

    sequence.push({ name: "transceiver", fn: applyTransceiverMode });
    sequence.push({ name: "sampleRate", fn: applySampleRate });
    sequence.push({ name: "bandwidth", fn: applyBandwidth });
    sequence.push({ name: "frequency", fn: applyFrequency });

    for (const step of sequence) {
      try {
        await step.fn();
      } catch (err) {
        console.warn(`Initialization step failed: ${step.name}`, err);
        throw err;
      }
    }

    this.configuredOnce = true;
  }

  resetState(): void {
    this.lastFrequency = null;
    this.lastBandwidth = null;
    this.lastLNAGain = null;
    this.lastAmpEnabled = false;
    // Keep configuredOnce to reflect prior successful configuration
  }
}
