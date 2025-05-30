import { Buffer } from "buffer";
import {
  BYTES_PER_BLOCK,
  MAX_SWEEP_RANGES,
  BoardId,
  RfPathFilter,
  OperacakePorts,
  SweepStyle,
  TransceiverMode,
  VendorRequest,
  ErrorCode,
} from "./constants";

import { StreamOptions } from "./StreamOptions";

import {
  HackrfError,
  checkU32,
  checkU16,
  checkU8,
  checkSpiflashAddress,
  checkIFreq,
  checkLoFreq,
  checkBasebandFilterBw,
  checkFreq,
  checkMax2837Reg,
  checkMax2837Value,
  checkSi5351cReg,
  checkSi5351cValue,
  checkRffc5071Reg,
  checkRffc5071Value,
  calcSampleRate,
  checkInLength,
} from "./util";

type DataCallbackHandler = (data: DataView<ArrayBufferLike>) => void;
type ReceiveDataProps = {
  device: USBDevice;
  endpointNumber: number;
  transferBufferSize: number;
  onData: DataCallbackHandler;
};

/**
 * Reference to an open HackRF device
 *
 * This is mostly a direct API to the USB interface. Call
 * [[close]] when no longer needed.
 *
 * Keep in mind some methods require a certain API version
 * to be implemented by your device's firmware; this is noted
 * in their documentation, and an `USB_API_VERSION` error will
 * be thrown if you attempt to use them. [[usbApiVersion]]
 * returns the version implemented by the firmware. It's
 * strongly recommended to upgrade your device's firmware to
 * the latest version to avoid problems and glitches.
 *
 * This API does strict validation of passed integers (they
 * should be integers and be in-range). Gains, in particular,
 * will be *rejected* instead of rounded down to the nearest
 * step.
 */
export class HackRFDevice {
  private readonly handle: USBDevice;
  private readonly iface: USBInterface;
  private readonly inEndpoint: USBEndpoint;
  private readonly outEndpoint: USBEndpoint;

  /**
   * Open the passed USB device
   *
   * This function does **not** validate the device,
   * it's recommended to use the `open` module function
   * instead of this function directly.
   *
   * @param device USB device (must not be open)
   * @category Main
   */
  static async openDevice(device: USBDevice) {
    try {
      await device.open();
      const { configuration } = device;
      if (!configuration) {
        throw new Error("No configurations available");
      }
      const [iface] = configuration.interfaces;
      if (!iface) {
        throw new Error("No interface found on standard configuration");
      }
      await device.claimInterface(iface.interfaceNumber);
      console.debug("Claimed interface");

      return new HackRFDevice(device, iface);
    } catch (e) {
      await device.close();
      throw e;
    }
  }

  private constructor(handle: USBDevice, iface: USBInterface) {
    this.handle = handle;
    this.iface = iface;
    this.setFrequency = this.setFrequency.bind(this);
    const outEndpoint = iface.alternate.endpoints.find(
      ({ direction }) => direction === "out",
    );
    if (!outEndpoint) {
      throw new Error("Unable to find endpoint with direction 'out'");
    }
    this.outEndpoint = outEndpoint;
    if (this.outEndpoint.type !== "bulk")
      throw new HackrfError(ErrorCode.LIBUSB);

    const inEndpoint = iface.alternate.endpoints.find(
      ({ direction }) => direction === "in",
    );
    if (!inEndpoint) {
      throw new Error("Unable to find endpoint with direction 'in'");
    }
    this.inEndpoint = inEndpoint;
    if (this.inEndpoint.type !== "bulk")
      throw new HackrfError(ErrorCode.LIBUSB);
  }

  get open() {
    return this.handle.opened;
  }

  /**
   * Release resources and close the USB device
   *
   * Unless the device is used until process exit, this **must** be
   * called once when it's no longer needed.
   *
   * There must be no pending promises or an active stream when
   * calling this. After return, no more methods should be called
   * on this object.
   *
   * @category Main
   */
  async close() {
    await this.handle.releaseInterface(this.iface.interfaceNumber);
    await this.handle.close();
  }

  /**
   * Version of the USB API implemented by the device's firmware
   *
   * In `0xAABB` form (`AA` = major, `BB` = minor).
   */
  get usbApiVersion() {
    const majorVersion = this.handle.deviceVersionMajor
      .toString()
      .padStart(2, "0");
    const minorVersion = this.handle.deviceVersionMinor
      .toString()
      .padStart(2, "0");
    const combinedFormat = `0x${majorVersion}${minorVersion}`;

    const combinedVersion = Number(combinedFormat);
    console.log({
      major: this.handle.deviceVersionMajor,
      minor: this.handle.deviceVersionMinor,
      combinedVersion,
      combinedFormat,
    });
    return combinedVersion;
  }

  private usbApiRequired(version: number) {
    if (this.usbApiVersion < version) {
      console.log({ version, has: this.usbApiVersion });
      throw new HackrfError(ErrorCode.USB_API_VERSION);
    }
  }

  // CONTROL TRANSFERS

  private controlTransferIn(
    bRequest: VendorRequest,
    wValue: number,
    wIndex: number,
    length: number,
  ): Promise<USBInTransferResult> {
    return this.handle.controlTransferIn(
      {
        requestType: "vendor",
        recipient: "device",
        request: bRequest,
        value: wValue,
        index: wIndex,
      },
      length,
    );
  }

  private controlTransferOut(
    bRequest: VendorRequest,
    wValue: number,
    wIndex: number,
    data: Buffer = Buffer.alloc(0),
  ): Promise<USBOutTransferResult> {
    return this.handle.controlTransferOut(
      {
        requestType: "vendor",
        recipient: "device",
        request: bRequest,
        value: wValue,
        index: wIndex,
      },
      data,
    );
  }

  protected async setTransceiverMode(value: TransceiverMode) {
    await this.controlTransferOut(VendorRequest.SET_TRANSCEIVER_MODE, value, 0);
  }

  /**
   * Query the firmware version
   *
   * @category Device info
   */
  async getVersionString() {
    const { data } = await this.controlTransferIn(
      VendorRequest.VERSION_STRING_READ,
      0,
      0,
      255,
    );
    return data?.toString();
  }

  /**
   * @category Device info
   */
  async getBoardId() {
    const { data } = await this.controlTransferIn(
      VendorRequest.BOARD_ID_READ,
      0,
      0,
      1,
    );
    if (!data) {
      throw new Error("No data returned from controlTransferIn");
    }
    return checkInLength(data, 1).getUint8(data.byteOffset) as BoardId;
  }

  /**
   * @category Device info
   */
  async getBoardPartIdSerialNo() {
    const { data } = await this.controlTransferIn(
      VendorRequest.BOARD_PARTID_SERIALNO_READ,
      0,
      0,
      24,
    );
    if (!data) {
      throw new Error("No data returned from controlTransferIn");
    }
    checkInLength(data, 24);
    const u32 = [0, 1, 2, 3, 4, 5].map((x) => data.getUint32(x * 4));
    return {
      partId: u32.slice(0, 2) as [number, number],
      serialNo: u32.slice(2, 6) as [number, number, number, number],
    };
  }
  async pollReceive(
    onData: DataCallbackHandler,
    { transferBufferSize = 262144 }: StreamOptions = {},
  ) {
    while (true) {
      console.debug("Receiving data", {
        transferBufferSize,
        endpointNumber: this.inEndpoint.endpointNumber,
        device: this.handle,
      });

      const { status, data } = await this.handle.transferIn(
        this.inEndpoint.endpointNumber,
        transferBufferSize,
      );

      // const { status, data } = await this.handle.controlTransferIn(
      //   {
      //     requestType: "vendor",
      //     recipient: "device",
      //     request: 0,
      //     value: 0,
      //     index: this.inEndpoint.endpointNumber,
      //   },
      //   transferBufferSize,
      // );
      console.debug("Received Data");
      if (status !== "ok") {
        throw new Error(`Unexpected status from transferIn: ${status}`);
      }
      if (!data) {
        throw new Error("Result data from transferIn is undefined");
      }
      console.debug("Passing data to callback");
      onData(data);
    }
    /*
    return receiveData({
      transferBufferSize,
      endpointNumber: this.inEndpoint.endpointNumber,
      device: this.handle,
      onData,
    });
    */
  }
  /**
   * @category IC
   */
  async max2837_read(register: number) {
    const { data } = await this.controlTransferIn(
      VendorRequest.MAX2837_READ,
      0,
      checkMax2837Reg(register),
      2,
    );
    if (!data) {
      throw new Error("No data returned from controlTransferIn");
    }
    return checkInLength(data, 2).getUint16(data.byteOffset);
  }

  /**
   * @category IC
   */
  async max2837_write(register: number, value: number) {
    await this.controlTransferOut(
      VendorRequest.MAX2837_WRITE,
      checkMax2837Value(value),
      checkMax2837Reg(register),
    );
  }

  /**
   * @category IC
   */
  async si5351c_read(register: number) {
    const { data } = await this.controlTransferIn(
      VendorRequest.SI5351C_READ,
      0,
      checkSi5351cReg(register),
      1,
    );

    if (!data) {
      throw new Error("No data returned from controlTransferIn");
    }
    return checkInLength(data, 1).getUint8(data.byteOffset);
  }

  /**
   * @category IC
   */
  async si5351c_write(register: number, value: number) {
    await this.controlTransferOut(
      VendorRequest.SI5351C_WRITE,
      checkSi5351cValue(value),
      checkSi5351cReg(register),
    );
  }

  /**
   * @category IC
   */
  async rffc5071_read(register: number) {
    const { data } = await this.controlTransferIn(
      VendorRequest.RFFC5071_READ,
      0,
      checkRffc5071Reg(register),
      2,
    );

    if (!data) {
      throw new Error("No data returned from controlTransferIn");
    }
    return checkInLength(data, 2).getUint16(data.byteOffset);
  }

  /**
   * @category IC
   */
  async rffc5071_write(register: number, value: number) {
    await this.controlTransferOut(
      VendorRequest.RFFC5071_WRITE,
      checkRffc5071Value(value),
      checkRffc5071Reg(register),
    );
  }

  /**
   * @category Flash & CPLD
   */
  async spiflash_erase() {
    await this.controlTransferOut(VendorRequest.SPIFLASH_ERASE, 0, 0);
  }

  /**
   * @category Flash & CPLD
   */
  async spiflash_write(address: number, data: Buffer) {
    checkSpiflashAddress(address);
    await this.controlTransferOut(
      VendorRequest.SPIFLASH_WRITE,
      address >>> 16,
      address & 0xffff,
      data,
    );
  }

  /**
   * @category Flash & CPLD
   */
  async spiflash_read(address: number, length: number) {
    checkSpiflashAddress(address);
    const { data } = await this.controlTransferIn(
      VendorRequest.SPIFLASH_READ,
      address >>> 16,
      address & 0xffff,
      length,
    );
    if (!data) {
      throw new Error("No data returned from controlTransferIn");
    }
    return checkInLength(data, length);
  }

  /**
   * TODO
   *
   * Requires USB API 1.3.
   *
   * @category Flash & CPLD
   */
  async spiflash_getStatus() {
    this.usbApiRequired(0x0103);
    const { data } = await this.controlTransferIn(
      VendorRequest.SPIFLASH_STATUS,
      0,
      0,
      2,
    );
    if (!data) {
      throw new Error("No data returned from controlTransferIn");
    }
    return checkInLength(data, 1); // FIXME
  }

  /**
   * TODO
   *
   * Requires USB API 1.3.
   *
   * @category Flash & CPLD
   */
  async spiflash_clearStatus() {
    this.usbApiRequired(0x0103);
    await this.controlTransferOut(VendorRequest.SPIFLASH_CLEAR_STATUS, 0, 0);
  }

  /**
   * Set baseband filter bandwidth in Hz
   *
   * Possible values: 1.75/2.5/3.5/5/5.5/6/7/8/9/10/12/14/15/20/24/28MHz
   *
   * @category Radio control
   */
  async setBasebandFilterBandwidth(freqHz: number) {
    checkBasebandFilterBw(checkU32(freqHz));
    await this.controlTransferOut(
      VendorRequest.BASEBAND_FILTER_BANDWIDTH_SET,
      freqHz & 0xffff,
      freqHz >>> 16,
    );
  }

  /**
   * Set the tuning frequency
   *
   * @category Radio control
   */
  async setFrequency(freqHz: number) {
    checkFreq(freqHz);
    // convert Freq Hz 64bits to Freq MHz (32bits) & Freq Hz (32bits)
    const FREQ_ONE_MHZ = 1000 * 1000;
    const data = Buffer.alloc(8);
    data.writeUInt32LE(freqHz / FREQ_ONE_MHZ, 0);
    data.writeUInt32LE(freqHz % FREQ_ONE_MHZ, 4);
    await this.controlTransferOut(VendorRequest.SET_FREQ, 0, 0, data);
  }

  /**
   * Set the tuning frequency (raw version)
   *
   * @param iFreqHz intermediate frequency
   * @param loFreqHz front-end local oscillator frequency
   * @param path image rejection filter path
   * @category Radio control
   */
  async setFrequencyExplicit(
    iFreqHz: number,
    loFreqHz: number,
    path: RfPathFilter,
  ) {
    checkIFreq(iFreqHz);
    if (path !== RfPathFilter.BYPASS) checkLoFreq(loFreqHz);
    if (checkU32(path) > 2) throw new HackrfError(ErrorCode.INVALID_PARAM);

    const data = Buffer.alloc(8 + 8 + 1);
    data.writeBigUInt64LE(BigInt(iFreqHz), 0);
    data.writeBigUInt64LE(BigInt(loFreqHz), 8);
    data.writeUInt8(path, 16);
    await this.controlTransferOut(VendorRequest.SET_FREQ_EXPLICIT, 0, 0, data);
  }

  /**
   * Set the sample rate (raw version)
   *
   * You should probably use [[setSampleRate]] instead of this
   * function.
   *
   * For anti-aliasing, the baseband filter bandwidth is automatically set to the
   * widest available setting that is no more than 75% of the sample rate.  This
   * happens every time the sample rate is set.  If you want to override the
   * baseband filter selection, you must do so after setting the sample rate.
   *
   * 2-20Mhz - as a fraction, i.e. freq 20000000 divider 2 -> 10Mhz
   *
   * @category Radio control
   */
  async setSampleRateManual(freqHz: number, divider: number) {
    const data = Buffer.alloc(8);
    data.writeUInt32LE(freqHz, 0);
    data.writeUInt32LE(divider, 4);
    await this.controlTransferOut(VendorRequest.SAMPLE_RATE_SET, 0, 0, data);
  }

  /**
   * Set the sample rate
   *
   * For anti-aliasing, the baseband filter bandwidth is automatically set to the
   * widest available setting that is no more than 75% of the sample rate.  This
   * happens every time the sample rate is set.  If you want to override the
   * baseband filter selection, you must do so after setting the sample rate.
   *
   * @param freqHz frequency in Hz, 2-20MHz (double)
   *
   * @category Radio control
   */
  async setSampleRate(freqHz: number) {
    return this.setSampleRateManual(...calcSampleRate(freqHz));
  }

  /**
   * Enable / disable RX/TX RF external amplifier
   *
   * @category Radio control
   */
  async setAmpEnable(value: boolean) {
    await this.controlTransferOut(VendorRequest.AMP_ENABLE, Number(value), 0);
  }

  /**
   * Set RX LNA (IF) gain, 0-40dB in 8dB steps
   *
   * @category Radio control
   */
  async setLnaGain(gainDb: number) {
    if (checkU32(gainDb) > 40 || gainDb % 8)
      throw new HackrfError(ErrorCode.INVALID_PARAM);
    const { data } = await this.controlTransferIn(
      VendorRequest.SET_LNA_GAIN,
      0,
      gainDb,
      1,
    );
    if (!data) {
      throw new Error("No data returned from controlTransferIn");
    }
    if (data.byteLength != 1 || !data.getUint8(data.byteOffset))
      throw new HackrfError(ErrorCode.INVALID_PARAM);
  }

  /**
   * Set RX VGA (baseband) gain, 0-62dB in 2dB steps
   *
   * @category Radio control
   */
  async setVgaGain(gainDb: number) {
    if (checkU32(gainDb) > 62 || gainDb % 2)
      throw new HackrfError(ErrorCode.INVALID_PARAM);
    const { data } = await this.controlTransferIn(
      VendorRequest.SET_VGA_GAIN,
      0,
      gainDb,
      1,
    );
    if (!data) {
      throw new Error("No data returned from controlTransferIn");
    }
    if (data.byteLength != 1 || !data.getUint8(data.byteOffset))
      throw new HackrfError(ErrorCode.INVALID_PARAM);
  }

  /**
   * Set TX VGA (IF) gain, 0-47dB in 1dB steps
   *
   * @category Radio control
   */
  async setTxVgaGain(gainDb: number) {
    if (checkU32(gainDb) > 47) throw new HackrfError(ErrorCode.INVALID_PARAM);
    const { data } = await this.controlTransferIn(
      VendorRequest.SET_TXVGA_GAIN,
      0,
      gainDb,
      1,
    );
    if (!data) {
      throw new Error("No data returned from controlTransferIn");
    }
    if (data.byteLength != 1 || !data.getUint8(data.byteOffset))
      throw new HackrfError(ErrorCode.INVALID_PARAM);
  }

  /**
   * Antenna port power control
   *
   * @category Radio control
   */
  async setAntennaEnable(value: boolean) {
    await this.controlTransferOut(
      VendorRequest.ANTENNA_ENABLE,
      Number(value),
      0,
    );
  }

  /**
   * Enable / disable hardware sync
   *
   * Multiple boards can be made to syncronize
   * their USB transfers through a GPIO connection
   * between them.
   *
   * Requires USB API 1.2.
   *
   * @category Radio control
   */
  async setHwSyncMode(value: boolean) {
    this.usbApiRequired(0x0102);
    await this.controlTransferOut(
      VendorRequest.SET_HW_SYNC_MODE,
      Number(value),
      0,
    );
  }

  /**
   * Reset the device
   *
   * Requires USB API 1.2.
   *
   * @category Main
   */
  async reset() {
    this.usbApiRequired(0x0102);
    await this.controlTransferOut(VendorRequest.RESET, 0, 0);
  }

  /**
   * Initialize sweep mode
   *
   * Requires USB API 1.2.
   *
   * @param ranges is a list of `[start, stop]` pairs of frequencies in MHz,
   *     no more than [[MAX_SWEEP_RANGES]] entries.
   * @param numBytes the number of sample bytes to capture after each tuning.
   * @param stepWidth the width in Hz of the tuning step.
   * @param offset number of Hz added to every tuning frequency.
   *     Use to select center frequency based on the expected usable bandwidth.
   * @category Radio control
   */
  async initSweep(
    ranges: [number, number][],
    numBytes: number,
    stepWidth: number,
    offset: number,
    style: SweepStyle,
  ) {
    this.usbApiRequired(0x0102);

    if (!(ranges.length >= 1 && ranges.length <= MAX_SWEEP_RANGES))
      throw new HackrfError(ErrorCode.INVALID_PARAM);

    if (numBytes % BYTES_PER_BLOCK || numBytes < BYTES_PER_BLOCK)
      throw new HackrfError(ErrorCode.INVALID_PARAM);

    if (stepWidth < 1) throw new HackrfError(ErrorCode.INVALID_PARAM);

    if (checkU32(style) > 1) throw new HackrfError(ErrorCode.INVALID_PARAM);

    const data = Buffer.alloc(9 + ranges.length * 4);
    data.writeUInt32LE(checkU32(stepWidth), 0);
    data.writeUInt32LE(checkU32(offset), 4);
    data.writeUInt8(style, 8);
    ranges.forEach(([start, stop], i) => {
      data.writeUInt16LE(checkU16(start), 9 + i * 4);
      data.writeUInt16LE(checkU16(stop), 9 + i * 4 + 2);
    });

    checkU32(numBytes);
    await this.controlTransferOut(
      VendorRequest.INIT_SWEEP,
      numBytes & 0xffff,
      (numBytes >>> 16) & 0xffff,
      data,
    );
  }

  /**
   * Retrieve list of Opera Cake board addresses (uint8, terminated by 0)
   *
   * Requires USB API 1.2.
   *
   * @category Opera Cake
   */
  async getOperacakeBoards() {
    this.usbApiRequired(0x0102);
    const { data } = await this.controlTransferIn(
      VendorRequest.OPERACAKE_GET_BOARDS,
      0,
      0,
      8,
    );
    if (!data) {
      throw new Error("No data returned from controlTransferIn");
    }
    return checkInLength(data, 8);
  }

  /**
   * Set Opera Cake ports
   *
   * Requires USB API 1.2.
   *
   * @category Opera Cake
   */
  async setOperacakePorts(
    address: number,
    portA: OperacakePorts,
    portB: OperacakePorts,
  ) {
    this.usbApiRequired(0x0102);

    if (
      checkU32(portA) > OperacakePorts.PB4 ||
      checkU32(portB) > OperacakePorts.PB4
    )
      throw new HackrfError(ErrorCode.INVALID_PARAM);

    // Check which side PA and PB are on
    if (
      (portA <= OperacakePorts.PA4 && portB <= OperacakePorts.PA4) ||
      (portA > OperacakePorts.PA4 && portB > OperacakePorts.PA4)
    )
      throw new HackrfError(ErrorCode.INVALID_PARAM);

    await this.controlTransferOut(
      VendorRequest.OPERACAKE_SET_PORTS,
      checkU8(address),
      portA | (portB << 8),
    );
  }

  /**
   * Set Opera Cake [frequency-antenna ranges](https://github.com/mossmann/hackrf/wiki/Opera-Cake#opera-glasses)
   *
   * Requires USB API 1.3.
   *
   * @category Opera Cake
   */
  async setOperacakeRanges(ranges: Buffer) {
    this.usbApiRequired(0x0103);
    await this.controlTransferOut(
      VendorRequest.OPERACAKE_SET_RANGES,
      0,
      0,
      ranges,
    );
  }

  /**
   * Test GPIO functionality of an Opera Cake
   *
   * Returns test result (uint16)
   *
   * Requires USB API 1.3.
   *
   * @category Opera Cake
   */
  async operacakeGpioTest(address: number) {
    this.usbApiRequired(0x0103);
    const { data } = await this.controlTransferIn(
      VendorRequest.OPERACAKE_GPIO_TEST,
      address,
      0,
      2,
    );
    if (!data) {
      throw new Error("No data returned from controlTransferIn");
    }
    return checkInLength(data, 1); // FIXME
  }

  /**
   * Enable / disable clock output through CLKOUT
   *
   * Requires USB API 1.3.
   *
   * @category Radio control
   */
  async setClkoutEnable(value: boolean) {
    this.usbApiRequired(0x0103);
    await this.controlTransferOut(
      VendorRequest.CLKOUT_ENABLE,
      Number(value),
      0,
    );
  }

  // Disabled for now, see https://github.com/mossmann/hackrf/issues/609
  // /**
  //  * Returns crc32 (uint32)
  //  *
  //  * Requires USB API 1.3.
  //  *
  //  * @category Flash & CPLD
  //  */
  // async cpld_checksum() {
  // 	this.usbApiRequired(0x0103)
  // 	const buf = await this.controlTransferIn(VendorRequest.CPLD_CHECKSUM, 0, 0, 4)
  // 	return checkInLength(buf, 4).readUInt32LE()
  // }

  /**
   * Enable / disable PortaPack display
   *
   * Requires USB API 1.4.
   *
   * @category Radio control
   */
  async setUiEnable(value: boolean) {
    this.usbApiRequired(0x0104);
    await this.controlTransferOut(VendorRequest.UI_ENABLE, Number(value), 0);
  }

  // DATA TRANSFERS

  private _streaming: boolean = false;

  /**
   * Returns `true` if there's an active stream.
   */
  get streaming() {
    return this._streaming;
  }

  private async _lockStream(callback: () => Promise<void>) {
    if (this._streaming) throw new HackrfError(ErrorCode.BUSY);
    try {
      this._streaming = true;
      await callback();
    } finally {
      this._streaming = false;
    }
  }

  private _stopRequested: boolean = false;

  /**
   * Requests stopping the active stream (if there is one)
   *
   * Calling this has the same effect as returning `false`
   * the next time the callback gets called. Note that the
   * stream doesn't finish instantly, you still need to
   * wait for the promise to end. This is merely a convenience
   * function.
   *
   * @category Main
   */
  requestStop() {
    // FIXME: this waits till the next callback; for RX we could do a bit better
    this._stopRequested = true;
  }

  private async _stream(onData: DataCallbackHandler, mode: TransceiverMode) {
    await this._lockStream(async () => {
      this._stopRequested = false;
      try {
        console.debug("Starting stream", { mode });
        this.setTransceiverMode(mode);
        await this.pollReceive(onData);
      } finally {
        await this.setTransceiverMode(TransceiverMode.OFF);
      }
    });
  }

  /**
   * Put the radio in TX mode and stream I/Q samples
   *
   * The supplied callback will be regularly called with an
   * `Int8Array` buffer to fill before return. Every two
   * values of the buffer form an I/Q sample. Different
   * buffers may be passed or reused, so avoid storing
   * references to them after return.
   *
   * To request ending the stream, return `false` from the
   * callback or use [[requestStop]] (the callback will no
   * longer be called and the current buffer will not be
   * transmitted). Any transfer / callback error rejects
   * the promise and cancels all transfers. The promise won't
   * settle until all transfers are finished, regardless of
   * whether the stream is ended or errored.
   *
   * This throws if there's another stream in progress.
   *
   * @category Main
   */
  async transmit(onData: DataCallbackHandler) {
    await this._stream(onData, TransceiverMode.TRANSMIT);
  }

  /**
   * Put the radio in RX mode and stream I/Q samples
   *
   * The supplied callback will be regularly called with an
   * `Int8Array` buffer. Every two values of the buffer
   * form an I/Q sample. The buffer may be overwritten
   * later, so avoid storing any reference to it; instead
   * make a copy of the data if needed.
   *
   * To request ending the stream, return `false` from the
   * callback or use [[requestStop]] (the callback will no
   * longer be called). Any transfer / callback error rejects
   * the promise and cancels all transfers. The promise won't
   * settle until all transfers are finished, regardless of
   * whether the stream is ended or errored.
   *
   * This throws if there's another stream in progress.
   *
   * @category Main
   */
  async receive(onData: DataCallbackHandler) {
    await this._stream(onData, TransceiverMode.RECEIVE);
  }

  /**
   * Put the radio in sweep RX mode and stream I/Q samples
   *
   * Like [[receive]], but with frequency sweep active.
   * You should call [[initSweep]] first.
   *
   * Requires USB API 1.4.
   *
   * @category Main
   */
  async sweepReceive(onData: DataCallbackHandler) {
    this.usbApiRequired(0x0104);
    await this._stream(onData, TransceiverMode.RX_SWEEP);
  }

  /**
   * Put the radio in CPLD firmware upgrade mode and
   * write the payload
   *
   * This throws if there's another stream in progress.
   *
   * The device will need to be reset after this.
   *
   * @category Flash & CPLD
   */
  /*
	async cpld_write(data: Buffer, chunkSize: number = 512) { // FIXME: make it a stream
		await this._lockStream(async () => {
			await this.setTransceiverMode(TransceiverMode.CPLD_UPDATE)
			for (let i = 0; i < data.length; i += chunkSize)
				await this.outEndpoint.transfer(
					data.subarray(i, i + chunkSize), cb as any) )()
		})
	}
		*/
}
