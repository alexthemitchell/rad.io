/**
 * Contains validation logic and other computations
 * @module
 */

import {
  ErrorCode,
  LO_FREQ_HZ_MIN,
  LO_FREQ_HZ_MAX,
  FREQ_HZ_MIN,
  FREQ_HZ_MAX,
  IF_HZ_MIN,
  IF_HZ_MAX,
  BASEBAND_FILTER_BW_MAX,
  BASEBAND_FILTER_BW_MIN,
} from "./constants";

/** Promise with asynchronous abort semantics */
export class CancellablePromise<T> extends Promise<T> {
  _cancel: () => void;
  constructor(
    executor: (
      resolve: (value: T | PromiseLike<T>) => void,
      reject: (reason?: unknown) => void,
    ) => () => void,
  ) {
    let cancel: () => void = function () {
      // Empty function placeholder
    };
    super((resolve, reject) => (cancel = executor(resolve, reject)));
    this._cancel = cancel;
  }

  /**
   * Request a cancellation of this promise. Even if this
   * returns successfully, you still need to wait for the
   * promise to settle. Cancellation will result in rejection
   * with a special error, but it's also possible that the
   * promise resolves or rejects with another error.
   */
  cancel(): void {
    this._cancel();
  }
}

/** each entry is a uint32 (bandwidth in hz) */
export const max2837Ft = [
  1750000, 2500000, 3500000, 5000000, 5500000, 6000000, 7000000, 8000000,
  9000000, 10000000, 12000000, 14000000, 15000000, 20000000, 24000000, 28000000,
];

/**
 * Compute nearest baseband filter bandwidth by rounding down
 *
 * Finds the nearest MAX2837 filter bandwidth that is less than or equal to
 * the requested bandwidth. This is used for manual filter selection to ensure
 * the filter doesn't exceed the requested bandwidth.
 *
 * @param bandwidthHz - Desired bandwidth in Hz (must be valid uint32)
 * @returns Selected bandwidth from MAX2837 filter table, or undefined if invalid
 * @throws {HackrfError} If bandwidthHz is not a valid uint32 value
 *
 * @example
 * ```typescript
 * // Request 4 MHz bandwidth, gets 3.5 MHz (rounds down)
 * const bw = computeBasebandFilterBwRoundDownLt(4_000_000);
 * console.log(bw); // 3500000
 * ```
 */
export function computeBasebandFilterBwRoundDownLt(
  bandwidthHz: number,
): number | undefined {
  checkU32(bandwidthHz);
  let idx: number;
  for (idx = 0; idx < max2837Ft.length; idx++) {
    const entry = max2837Ft[idx];
    if (entry !== undefined && entry >= bandwidthHz) {
      break;
    }
  }
  // Round down (if no equal to first entry)
  idx = Math.max(idx - 1, 0);
  return max2837Ft[idx];
}

/**
 * Compute optimal baseband filter bandwidth for automatic filter selection
 *
 * Selects the best MAX2837 filter bandwidth based on the requested bandwidth.
 * Uses "intelligent rounding": if the next-higher available filter bandwidth exists and
 * is greater than or equal to the requested bandwidth, the function rounds down to the
 * next-lower available value. Otherwise, it uses the matching value. This approach helps
 * avoid excessive filtering and balances signal capture with noise rejection.
 *
 * This differs from {@link computeBasebandFilterBwRoundDownLt}, which always rounds down
 * to the nearest lower or equal filter bandwidth, regardless of the available options.
 *
 * This is the recommended function for automatic filter configuration.
 *
 * @param bandwidthHz - Desired bandwidth in Hz (must be valid uint32)
 * @returns Optimal bandwidth from MAX2837 filter table, or undefined if invalid
 * @throws {HackrfError} If bandwidthHz is not a valid uint32 value
 *
 * @example
 * ```typescript
 * // Request 5 MHz bandwidth, gets 3.5 MHz (auto-selected)
 * const bw = computeBasebandFilterBw(5_000_000);
 * console.log(bw); // 3500000
 * ```
 */
export function computeBasebandFilterBw(
  bandwidthHz: number,
): number | undefined {
  checkU32(bandwidthHz);
  let idx: number;
  for (idx = 0; idx < max2837Ft.length; idx++) {
    const entry = max2837Ft[idx];
    if (entry !== undefined && entry >= bandwidthHz) {
      break;
    }
  }
  // Round down (if no equal to first entry) and if > bandwidthHz
  const selectedEntry = max2837Ft[idx];
  if (selectedEntry !== undefined && selectedEntry >= bandwidthHz) {
    idx = Math.max(idx - 1, 0);
  }
  return max2837Ft[idx];
}

// VALIDATION

export class HackrfError extends Error {
  code: ErrorCode;
  constructor(code: ErrorCode) {
    super(ErrorCode[code]);
    this.code = code;
    this.name = "HackrfError";
  }
}

/**
 * Validate that a number is a valid unsigned 32-bit integer
 *
 * @param x - Number to validate
 * @returns The input value if valid
 * @throws {HackrfError} If value is not a valid uint32 (negative, fractional, or > 2^32-1)
 *
 * @example
 * ```typescript
 * checkU32(100);        // OK: returns 100
 * checkU32(0xFFFFFFFF); // OK: returns 4294967295
 * checkU32(-1);         // Throws HackrfError
 * checkU32(2**33);      // Throws HackrfError
 * ```
 */
export function checkU32(x: number): number {
  if (x >>> 0 === x) {
    return x;
  }
  throw new HackrfError(ErrorCode.INVALID_PARAM);
}

/**
 * Create a validator function for n-bit unsigned integers
 *
 * Uses bitwise operations to efficiently validate that a number fits within
 * the specified bit range. The mask operation also ensures the value is a
 * valid int32.
 *
 * @param bits - Number of bits (must be <= 31)
 * @returns Validator function that checks if a number fits in the specified bits
 *
 * @internal
 */
export const bitChecker =
  (bits: number) =>
  (x: number): number => {
    const mask = (1 << bits) - 1;
    if ((x & mask) === x) {
      return x;
    }
    throw new HackrfError(ErrorCode.INVALID_PARAM);
  };

/**
 * Validate unsigned 8-bit integer (0-255)
 * @throws {HackrfError} If value exceeds uint8 range
 */
export const checkU8 = bitChecker(8);

/**
 * Validate unsigned 16-bit integer (0-65535)
 * @throws {HackrfError} If value exceeds uint16 range
 */
export const checkU16 = bitChecker(16);

/**
 * Validate MAX2837 register address (5-bit: 0-31)
 * @throws {HackrfError} If value exceeds 5-bit range
 */
export const checkMax2837Reg = bitChecker(5);

/**
 * Validate MAX2837 register value (10-bit: 0-1023)
 * @throws {HackrfError} If value exceeds 10-bit range
 */
export const checkMax2837Value = bitChecker(10);

/**
 * Validate Si5351C register address (8-bit: 0-255)
 * @throws {HackrfError} If value exceeds 8-bit range
 */
export const checkSi5351cReg = bitChecker(8);

/**
 * Validate Si5351C register value (8-bit: 0-255)
 * @throws {HackrfError} If value exceeds 8-bit range
 */
export const checkSi5351cValue = bitChecker(8);

/**
 * Validate RFFC5071 register address (must be < 31)
 *
 * @param x - Register address to validate
 * @returns The input value if valid
 * @throws {HackrfError} If value is >= 31
 */
export function checkRffc5071Reg(x: number): number {
  if (checkU32(x) < 31) {
    return x;
  }
  throw new HackrfError(ErrorCode.INVALID_PARAM);
}

/**
 * Validate RFFC5071 register value (16-bit: 0-65535)
 * @throws {HackrfError} If value exceeds 16-bit range
 */
export const checkRffc5071Value = bitChecker(16);

/**
 * Validate SPI flash memory address (20-bit: 0-1048575)
 * @throws {HackrfError} If value exceeds 20-bit range
 */
export const checkSpiflashAddress = bitChecker(20);

/**
 * Create a validator function for values within a specific range
 *
 * @param min - Minimum allowed value (inclusive)
 * @param max - Maximum allowed value (inclusive)
 * @returns Validator function that checks if a number is within the range
 *
 * @internal
 */
export const rangeChecker =
  (min: number, max: number) =>
  (x: number): number => {
    if (x >= min && x <= max) {
      return x;
    }
    throw new HackrfError(ErrorCode.INVALID_PARAM);
  };

/**
 * Validate baseband filter bandwidth (1.75 MHz - 28 MHz)
 * @throws {HackrfError} If value is outside valid range
 */
export const checkBasebandFilterBw = rangeChecker(
  BASEBAND_FILTER_BW_MIN,
  BASEBAND_FILTER_BW_MAX,
);

/**
 * Validate local oscillator frequency (84.375 MHz - 5.4 GHz)
 * @throws {HackrfError} If value is outside valid range
 */
export const checkLoFreq = rangeChecker(LO_FREQ_HZ_MIN, LO_FREQ_HZ_MAX);

/**
 * Validate RF frequency (0 Hz - 7.25 GHz)
 * @throws {HackrfError} If value is outside valid range
 */
export const checkFreq = rangeChecker(FREQ_HZ_MIN, FREQ_HZ_MAX);

/**
 * Validate intermediate frequency (2.15 GHz - 2.75 GHz)
 * @throws {HackrfError} If value is outside valid range
 */
export const checkIFreq = rangeChecker(IF_HZ_MIN, IF_HZ_MAX);

/**
 * Validate that a DataView has sufficient length
 *
 * Used to verify USB transfer responses contain the expected amount of data
 * before attempting to read from them.
 *
 * @param view - DataView to validate
 * @param minLength - Minimum required length in bytes
 * @returns The input DataView if valid
 * @throws {HackrfError} If DataView is shorter than minLength
 *
 * @example
 * ```typescript
 * const response = await device.transferIn(...);
 * const view = checkInLength(response.data, 4);
 * const value = view.getUint32(0, true);
 * ```
 */
export function checkInLength(view: DataView, minLength: number): DataView {
  if (view.byteLength >= minLength) {
    return view;
  }
  throw new HackrfError(ErrorCode.LIBUSB);
}

// SAMPLE RATE CALCULATION

const f64toU = (x: number): bigint | undefined => {
  const f64a = Float64Array.of(x);
  return new BigUint64Array(f64a.buffer, f64a.byteOffset)[0];
};

function chooseDivider(n: number): number {
  const n1 = BigInt(1),
    mask = (n1 << BigInt(52)) - n1;

  const nBits = f64toU(n);
  if (nBits === undefined) {
    return 1; // Fallback
  }
  const e = Number(nBits >> BigInt(52)) - 1023;
  const fracN = 1 + n - Math.floor(n);
  const fracBits = f64toU(fracN);
  if (fracBits === undefined) {
    return 1; // Fallback
  }
  const frac = fracBits & mask;

  const round = (x: bigint): bigint => (x + (n1 << BigInt(51))) & ~mask;
  const roundError = (x: bigint): number => Math.abs(Number(x - round(x)));

  for (let divider = 1; divider <= 31; divider++) {
    if (roundError(BigInt(divider) * frac) < 2 ** (e + 4)) {
      return divider;
    }
  }
  return 1;
}

/**
 * Calculate optimal sample rate parameters for HackRF device
 *
 * Computes the best frequency and divider combination to achieve a target
 * sample rate with minimal rounding error. The HackRF uses a programmable
 * clock divider to achieve various sample rates from a base frequency.
 *
 * @param freqHz - Target sample rate in Hz
 * @returns Tuple of [frequency, divider] where actual_rate = frequency / divider
 *
 * @example
 * ```typescript
 * // Calculate parameters for 20 MSPS
 * const [freq, div] = calcSampleRate(20_000_000);
 * console.log(`Base frequency: ${freq} Hz, Divider: ${div}`);
 * console.log(`Actual rate: ${freq / div} Hz`);
 * ```
 *
 * @remarks
 * The divider ranges from 1 to 31, and the algorithm selects the combination
 * that minimizes rounding error when achieving the target sample rate.
 */
export function calcSampleRate(freqHz: number): [number, number] {
  const divider = chooseDivider(freqHz);
  return [Math.round(freqHz * divider), divider];
}
