/**
 * Reed–Solomon RS(207,187) decoder over GF(256) with primitive poly 0x11D.
 *
 * ATSC uses a shortened RS from RS(255,235), t=10.
 * Generator roots: alpha^(120..139). We implement a general decoder that
 * computes 20 syndromes at these consecutive roots and performs BM + Chien + Forney.
 */

const PRIMITIVE = 0x11d;
const FIELD_SIZE = 256;
const GF_MAX = FIELD_SIZE - 1;

// Precompute log/antilog tables
const gf_exp: number[] = new Array(2 * GF_MAX).fill(0);
const gf_log: number[] = new Array(FIELD_SIZE).fill(0);

function gfInit(): void {
  let x = 1;
  for (let i = 0; i < GF_MAX; i++) {
    gf_exp[i] = x;
    gf_log[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= PRIMITIVE;
    x &= 0xff;
  }
  for (let i = GF_MAX; i < 2 * GF_MAX; i++) gf_exp[i] = gf_exp[i - GF_MAX] ?? 0;
  gf_log[0] = 0; // by convention
}
gfInit();

function gfAdd(a: number, b: number): number {
  return (a ^ b) & 0xff;
}
function gfSub(a: number, b: number): number {
  return (a ^ b) & 0xff;
}
function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  const la = gf_log[a] ?? 0;
  const lb = gf_log[b] ?? 0;
  const idx = (((la + lb) % GF_MAX) + GF_MAX) % GF_MAX;
  return (gf_exp[idx] ?? 0) | 0;
}
function gfDiv(a: number, b: number): number {
  if (b === 0) throw new Error("GF divide by zero");
  if (a === 0) return 0;
  let idx = (gf_log[a] ?? 0) - (gf_log[b] ?? 0);
  while (idx < 0) idx += GF_MAX;
  return (gf_exp[idx] ?? 0) | 0;
}
// gfPow not used

function polyScale(p: number[], x: number): number[] {
  const out = new Array<number>(p.length);
  for (let i = 0; i < p.length; i++) out[i] = gfMul((p[i] ?? 0) | 0, x);
  return out;
}

function polyAdd(a: number[], b: number[]): number[] {
  const len = Math.max(a.length, b.length);
  const out = new Array<number>(len).fill(0);
  for (let i = 0; i < len; i++) {
    const ai = i >= len - a.length ? a[i - (len - a.length)] : 0;
    const bi = i >= len - b.length ? b[i - (len - b.length)] : 0;
    out[i] = gfAdd(ai ?? 0, bi ?? 0);
  }
  return out;
}

function polyEval(p: number[], x: number): number {
  let y = 0;
  for (let i = 0; i < p.length; i++) y = gfAdd(gfMul(y, x), p[i] ?? 0);
  return y;
}

/** Compute syndromes S_0..S_{2t-1} at roots alpha^(firstRoot + i) */
function computeSyndromes(
  codeword: Uint8Array,
  syndCount: number,
  firstRoot: number,
): number[] {
  const S: number[] = new Array(syndCount).fill(0);
  for (let i = 0; i < syndCount; i++) {
    let sum = 0;
    const a = gf_exp[(firstRoot + i) % GF_MAX] ?? 0;
    for (let j = 0; j < codeword.length; j++) {
      sum = gfAdd(gfMul(sum, a), codeword[j] ?? 0);
    }
    S[i] = sum;
  }
  return S;
}

/** Berlekamp–Massey to find error locator Λ and error evaluator Ω */
function berlekampMassey(synd: number[]): {
  Lambda: number[];
  Omega: number[];
} {
  // C is unused; keep simple arrays of numbers
  let B: number[] = [1];
  let Lambda: number[] = [1];
  let L = 0;
  let m = 1;
  let b = 1;

  for (let n = 0; n < synd.length; n++) {
    // discrepancy
    let d = synd[n] ?? 0;
    for (let i = 1; i <= L; i++) {
      const s = synd[n - i] ?? 0;
      const l = Lambda[Lambda.length - 1 - i] ?? 0;
      d = gfAdd(d, gfMul(l, s));
    }

    if (d === 0) {
      m++;
    } else if (2 * L <= n) {
      const T = Lambda.slice();
      // Lambda = Lambda - d/b * x^m * B
      const factor = gfDiv(d ?? 0, b ?? 0);
      const xPowmB: number[] = new Array(B.length + m).fill(0);
      for (let i = 0; i < B.length; i++) xPowmB[i] = (B[i] ?? 0) | 0;
      const scaled = polyScale(xPowmB, factor);
      Lambda = polyAdd(Lambda, scaled);
      L = n + 1 - L;
      B = T;
      b = d ?? 0;
      m = 1;
    } else {
      const factor = gfDiv(d ?? 0, b ?? 0);
      const xPowmB: number[] = new Array(B.length + m).fill(0);
      for (let i = 0; i < B.length; i++) xPowmB[i] = (B[i] ?? 0) | 0;
      const scaled = polyScale(xPowmB, factor);
      Lambda = polyAdd(Lambda, scaled);
      m++;
    }
  }

  // Omega = (S(x) * Lambda(x)) mod x^{synd.length}
  // Compute simple convolution and truncate
  const Sx = synd;
  const conv: number[] = new Array(Sx.length + Lambda.length - 1).fill(0);
  for (let i = 0; i < Sx.length; i++) {
    for (let j = 0; j < Lambda.length; j++) {
      const idx = i + j;
      conv[idx] = gfAdd(
        conv[idx] ?? 0,
        gfMul((Sx[i] ?? 0) | 0, Lambda[j] ?? 0),
      );
    }
  }
  const Omega = conv.slice(0, synd.length);
  return { Lambda, Omega };
}

/** Chien search to find error locations; returns {positions, Xinv} */
function chienSearch(
  Lambda: number[],
  n: number,
): { positions: number[]; Xinv: number[] } {
  const positions: number[] = [];
  const Xinv: number[] = [];
  for (let i = 0; i < n; i++) {
    const xinv = gf_exp[(GF_MAX - i) % GF_MAX] ?? 0; // alpha^{-i}
    const val = polyEval(Lambda, xinv);
    if (val === 0) {
      positions.push(n - 1 - i); // position from right (last symbol is i=0)
      Xinv.push(xinv);
    }
  }
  return { positions, Xinv };
}

/** Forney algorithm to compute error magnitudes */
function forney(Omega: number[], Lambda: number[], Xinv: number[]): number[] {
  // derivative of Lambda
  const Lp: number[] = [];
  for (let i = 1; i < Lambda.length; i += 2) {
    Lp.push(Lambda[i] ?? 0);
  }
  const magnitudes: number[] = [];
  for (let i = 0; i < Xinv.length; i++) {
    const xinv = Xinv[i] ?? 0;
    const num = polyEval(Omega, xinv);
    // Evaluate derivative: L'(x) at xinv
    let den = 0;
    let xp = 1;
    for (let j = 0; j < Lp.length; j++) {
      den = gfAdd(den, gfMul(Lp[j] ?? 0, xp));
      xp = gfMul(xp, gfMul(xinv ?? 0, xinv ?? 0)); // x^2 progression due to derivative on even terms omitted
    }
    magnitudes.push(gfDiv(num, den === 0 ? 1 : den));
  }
  return magnitudes;
}

/**
 * Decode a single RS(207,187) codeword in-place and return the corrected 187-byte payload.
 * If uncorrectable, returns an empty Uint8Array.
 */
export function reedSolomonDecode(codeword207: Uint8Array): Uint8Array {
  if (codeword207.length !== 207) return new Uint8Array(0);

  const SYND = computeSyndromes(codeword207, 20, 120);
  const allZero = SYND.every((v) => v === 0);
  if (allZero) {
    return codeword207.slice(0, 187);
  }

  const { Lambda, Omega } = berlekampMassey(SYND);
  const { positions, Xinv } = chienSearch(Lambda, 207);
  if (positions.length === 0) return new Uint8Array(0);
  if (positions.length > 10) return new Uint8Array(0);

  const magnitudes = forney(Omega, Lambda, Xinv);
  const corrected = codeword207.slice();
  for (let i = 0; i < positions.length; i++) {
    const pos = positions[i] ?? 0;
    corrected[pos] = gfSub(corrected[pos] ?? 0, magnitudes[i] ?? 0);
  }

  // Verify
  const SYND2 = computeSyndromes(corrected, 20, 120);
  if (!SYND2.every((v) => v === 0)) return new Uint8Array(0);
  return corrected.slice(0, 187);
}
