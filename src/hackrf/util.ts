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
 * Compute nearest freq for bw filter (manual filter)
 *
 * Return final bw round down and less than expected bw.
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
 * Compute best default value depending on sample rate (auto filter)
 *
 * Return final bw
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

export function checkU32(x: number): number {
  if (x >>> 0 === x) {
    return x;
  }
  throw new HackrfError(ErrorCode.INVALID_PARAM);
}

// We do it with & because this also makes sure the passed
// number is a valid int32. bits must be <= 31
export const bitChecker =
  (bits: number) =>
  (x: number): number => {
    const mask = (1 << bits) - 1;
    if ((x & mask) === x) {
      return x;
    }
    throw new HackrfError(ErrorCode.INVALID_PARAM);
  };
export const checkU8 = bitChecker(8);
export const checkU16 = bitChecker(16);

export const checkMax2837Reg = bitChecker(5);
export const checkMax2837Value = bitChecker(10);
export const checkSi5351cReg = bitChecker(8);
export const checkSi5351cValue = bitChecker(8);
export function checkRffc5071Reg(x: number): number {
  if (checkU32(x) < 31) {
    return x;
  }
  throw new HackrfError(ErrorCode.INVALID_PARAM);
}
export const checkRffc5071Value = bitChecker(16);
export const checkSpiflashAddress = bitChecker(20);

export const rangeChecker =
  (min: number, max: number) =>
  (x: number): number => {
    if (x >= min && x <= max) {
      return x;
    }
    throw new HackrfError(ErrorCode.INVALID_PARAM);
  };
export const checkBasebandFilterBw = rangeChecker(
  BASEBAND_FILTER_BW_MIN,
  BASEBAND_FILTER_BW_MAX,
);
export const checkLoFreq = rangeChecker(LO_FREQ_HZ_MIN, LO_FREQ_HZ_MAX);
export const checkFreq = rangeChecker(FREQ_HZ_MIN, FREQ_HZ_MAX);
export const checkIFreq = rangeChecker(IF_HZ_MIN, IF_HZ_MAX);

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

export function calcSampleRate(freqHz: number): [number, number] {
  const divider = chooseDivider(freqHz);
  return [Math.round(freqHz * divider), divider];
}
