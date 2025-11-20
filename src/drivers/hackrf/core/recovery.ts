import { DeviceErrorHandler } from "../../../models/DeviceError";
import { useStore } from "../../../store";
import { TransceiverMode, VendorRequest } from "../constants";
import { deriveSampleRateParams } from "../util";
import {
  type Config,
  createUint32LEBuffer,
  splitFrequencyComponents,
} from "./config";
import { type Transport } from "./transport";

export class Recovery {
  private transport: Transport;
  private config: Config;
  public wasCleanClosed = true;

  constructor(transport: Transport, config: Config) {
    this.transport = transport;
    this.config = config;
  }

  trackError(error: unknown, context?: Record<string, unknown>): void {
    try {
      const errorState = DeviceErrorHandler.mapError(error, context);
      const store = useStore.getState();
      store.addDeviceError(errorState);
    } catch (err) {
      console.warn("Failed to track device error", err);
    }
  }

  async reset(): Promise<void> {
    console.warn("Recovery.reset: Skipping vendor reset (disabled)", {
      deviceState: {
        opened: this.transport.usbDevice.opened,
        sampleRate: this.config.lastSampleRate,
        frequency: this.config.lastFrequency,
      },
    });

    try {
      await this.config.setTransceiverMode(TransceiverMode.OFF);
    } catch (err) {
      console.warn("Recovery.reset: Failed to set OFF during reset", err);
    }

    this.config.resetState();
  }

  async fastRecovery(): Promise<void> {
    const savedState = {
      sampleRate: this.config.lastSampleRate,
      frequency: this.config.lastFrequency,
      bandwidth: this.config.lastBandwidth,
      lnaGain: this.config.lastLNAGain,
      ampEnabled: this.config.lastAmpEnabled,
    };

    if (this.transport.closing) {
      throw new Error("Cannot perform fastRecovery while device is closing");
    }

    if (
      !this.transport.usbDevice.opened ||
      this.transport.interfaceNumber === null
    ) {
      try {
        await this.transport.open(true);
      } catch {
        // ignore
      }
    }

    await this.reset();

    if (savedState.sampleRate !== null) {
      const { freqHz, divider } = deriveSampleRateParams(savedState.sampleRate);
      const payload = createUint32LEBuffer([freqHz, divider]);
      await this.transport.controlTransferOut({
        command: VendorRequest.SAMPLE_RATE_SET,
        data: payload,
      });
    }

    if (savedState.frequency !== null) {
      const { mhz, hz } = splitFrequencyComponents(savedState.frequency);
      const payload = createUint32LEBuffer([mhz, hz]);
      await this.transport.controlTransferOut({
        command: VendorRequest.SET_FREQ,
        data: payload,
      });
    }

    if (savedState.bandwidth !== null) {
      const rounded = Math.round(savedState.bandwidth);
      const value = rounded & 0xffff;
      const index = (rounded >>> 16) & 0xffff;
      await this.transport.controlTransferOut({
        command: VendorRequest.BASEBAND_FILTER_BANDWIDTH_SET,
        value,
        index,
      });
    }

    if (savedState.lnaGain !== null) {
      await this.transport.controlTransferOut({
        command: VendorRequest.SET_LNA_GAIN,
        value: savedState.lnaGain,
        index: 0,
      });
    }

    await this.transport.controlTransferOut({
      command: VendorRequest.AMP_ENABLE,
      value: Number(savedState.ampEnabled),
    });

    await this.config.setTransceiverMode(TransceiverMode.RECEIVE);

    this.config.lastSampleRate = savedState.sampleRate;
    this.config.lastFrequency = savedState.frequency;
    this.config.lastBandwidth = savedState.bandwidth;
    this.config.lastLNAGain = savedState.lnaGain;
    this.config.lastAmpEnabled = savedState.ampEnabled;
    if (savedState.sampleRate !== null) {
      this.config.configuredOnce = true;
    }
  }
}
