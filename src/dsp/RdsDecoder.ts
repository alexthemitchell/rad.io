const RDS_POLY = 0x5b9;
const BLOCK_OFFSETS: Record<number, 'A' | 'B' | 'C' | 'C_PRIME' | 'D'> = {
  0x034: 'A',
  0x0b4: 'B',
  0x0d4: 'C',
  0x154: 'C_PRIME',
  0x1b4: 'D'
};

const PTY_NAMES = [
  'None',
  'News',
  'Information',
  'Sports',
  'Talk',
  'Rock',
  'Classic Rock',
  'Adult Hits',
  'Soft Rock',
  'Top 40',
  'Country',
  'Oldies',
  'Soft',
  'Nostalgia',
  'Jazz',
  'Classical',
  'Rhythm and Blues',
  'Soft R&B',
  'Language',
  'Religious Music',
  'Religious Talk',
  'Personality',
  'Public',
  'College',
  'Spanish Talk',
  'Spanish Music',
  'Hip Hop',
  'Unassigned',
  'Unassigned',
  'Weather',
  'Emergency Test',
  'Emergency'
];

type GroupState = {
  a?: number;
  b?: number;
  c?: number;
  cPrime?: boolean;
};

export type RdsSnapshot = {
  synced: boolean;
  totalBlocks: number;
  totalGroups: number;
  blockErrorRate: number;
  piCode: number | null;
  callsignCandidate: string | null;
  ptyCode: number | null;
  ptyName: string | null;
  tp: boolean;
  ta: boolean;
  ms: boolean | null;
  ps: string;
  radiotext: string;
  latestGroup: string | null;
};

export class RdsDecoder {
  private readonly decimatedRate = 250_000;
  private readonly rdsRate = 1_187.5;
  private readonly decimationFactor = 8;

  private decimAccumulator = 0;
  private decimCount = 0;

  private mixerPhase = 0;
  private readonly mixerPhaseInc = (2 * Math.PI * 57_000) / this.decimatedRate;

  private lpI = 0;
  private lpQ = 0;
  private readonly lpAlpha = Math.min(0.2, (2 * Math.PI * 3_000) / this.decimatedRate);

  private costasPhase = 0;
  private costasFreq = 0;
  private readonly costasAlpha = 0.0015;
  private readonly costasBeta = 0.00001;

  private symbolPhase = 0;
  private readonly symbolPhaseInc = this.rdsRate / this.decimatedRate;
  private symbolAccumulator = 0;
  private symbolCount = 0;

  private previousRawBit = 0;
  private havePreviousRawBit = false;

  private bitCount = 0;
  private bitShiftRegister = 0;
  private readonly bitMask = (1 << 26) - 1;

  private totalBlocks = 0;
  private totalSyndromeMisses = 0;
  private totalGroups = 0;

  private currentGroup: GroupState = {};
  private psChars = Array.from({ length: 8 }, () => ' ');
  private radiotextChars = Array.from({ length: 64 }, () => ' ');
  private radiotextAbFlag = false;

  private piCode: number | null = null;
  private ptyCode: number | null = null;
  private tp = false;
  private ta = false;
  private ms: boolean | null = null;
  private latestGroup: string | null = null;

  private dirty = false;

  process(samples: Float32Array): RdsSnapshot | null {
    for (let i = 0; i < samples.length; i++) {
      this.decimAccumulator += samples[i];
      this.decimCount += 1;

      if (this.decimCount < this.decimationFactor) {
        continue;
      }

      const mpx = this.decimAccumulator / this.decimationFactor;
      this.decimAccumulator = 0;
      this.decimCount = 0;

      this.pushDecimatedSample(mpx);
    }

    if (!this.dirty) {
      return null;
    }

    this.dirty = false;
    return this.getSnapshot();
  }

  getSnapshot(): RdsSnapshot {
    const ptyName = this.ptyCode === null ? null : (PTY_NAMES[this.ptyCode] ?? 'Unknown');
    const totalAttempts = this.totalBlocks + this.totalSyndromeMisses;
    const blockErrorRate = totalAttempts === 0 ? 1 : this.totalSyndromeMisses / totalAttempts;

    return {
      synced: this.totalGroups > 0,
      totalBlocks: this.totalBlocks,
      totalGroups: this.totalGroups,
      blockErrorRate,
      piCode: this.piCode,
      callsignCandidate: this.piCode === null ? null : this.piToCallsign(this.piCode),
      ptyCode: this.ptyCode,
      ptyName,
      tp: this.tp,
      ta: this.ta,
      ms: this.ms,
      ps: this.psChars.join('').trim(),
      radiotext: this.radiotextChars.join('').trim(),
      latestGroup: this.latestGroup
    };
  }

  applyDecodedGroup(blockA: number, blockB: number, blockC: number, blockD: number, cPrime: boolean): void {
    this.totalGroups += 1;
    this.piCode = blockA;

    const groupType = (blockB >> 12) & 0x0f;
    const versionB = ((blockB >> 11) & 0x01) === 1;
    this.latestGroup = `${groupType}${versionB ? 'B' : 'A'}`;

    this.tp = ((blockB >> 10) & 0x01) === 1;
    this.ptyCode = (blockB >> 5) & 0x1f;

    if (groupType === 0) {
      this.ta = ((blockB >> 4) & 0x01) === 1;
      this.ms = ((blockB >> 3) & 0x01) === 1;

      const segment = blockB & 0x03;
      const psIndex = segment * 2;

      this.psChars[psIndex] = this.decodeTextChar((blockD >> 8) & 0xff);
      this.psChars[psIndex + 1] = this.decodeTextChar(blockD & 0xff);
    }

    if (groupType === 2) {
      const abFlag = ((blockB >> 4) & 0x01) === 1;
      if (abFlag !== this.radiotextAbFlag) {
        this.radiotextAbFlag = abFlag;
        this.radiotextChars = Array.from({ length: 64 }, () => ' ');
      }

      if (!versionB && !cPrime) {
        const segment = blockB & 0x0f;
        const textIndex = segment * 4;

        this.radiotextChars[textIndex] = this.decodeTextChar((blockC >> 8) & 0xff);
        this.radiotextChars[textIndex + 1] = this.decodeTextChar(blockC & 0xff);
        this.radiotextChars[textIndex + 2] = this.decodeTextChar((blockD >> 8) & 0xff);
        this.radiotextChars[textIndex + 3] = this.decodeTextChar(blockD & 0xff);
      } else {
        const segment = blockB & 0x0f;
        const textIndex = segment * 2;

        this.radiotextChars[textIndex] = this.decodeTextChar((blockD >> 8) & 0xff);
        this.radiotextChars[textIndex + 1] = this.decodeTextChar(blockD & 0xff);
      }
    }

    this.dirty = true;
  }

  private pushDecimatedSample(sample: number): void {
    const cos = Math.cos(this.mixerPhase);
    const sin = Math.sin(this.mixerPhase);

    let i = sample * cos;
    let q = -sample * sin;

    this.mixerPhase += this.mixerPhaseInc;
    if (this.mixerPhase > Math.PI) {
      this.mixerPhase -= 2 * Math.PI;
    }

    this.lpI += this.lpAlpha * (i - this.lpI);
    this.lpQ += this.lpAlpha * (q - this.lpQ);

    i = this.lpI;
    q = this.lpQ;

    const costasCos = Math.cos(this.costasPhase);
    const costasSin = Math.sin(this.costasPhase);

    const iRot = i * costasCos + q * costasSin;
    const qRot = -i * costasSin + q * costasCos;

    const error = iRot * qRot;
    this.costasFreq += this.costasBeta * error;
    this.costasPhase += this.costasFreq + this.costasAlpha * error;
    if (this.costasPhase > Math.PI) {
      this.costasPhase -= 2 * Math.PI;
    } else if (this.costasPhase < -Math.PI) {
      this.costasPhase += 2 * Math.PI;
    }

    this.symbolAccumulator += iRot;
    this.symbolCount += 1;
    this.symbolPhase += this.symbolPhaseInc;

    if (this.symbolPhase < 1) {
      return;
    }

    const symbol = this.symbolCount === 0 ? 0 : this.symbolAccumulator / this.symbolCount;

    this.symbolAccumulator = 0;
    this.symbolCount = 0;
    this.symbolPhase -= 1;

    const rawBit = symbol >= 0 ? 1 : 0;
    if (!this.havePreviousRawBit) {
      this.havePreviousRawBit = true;
      this.previousRawBit = rawBit;
      return;
    }

    const diffBit = rawBit === this.previousRawBit ? 0 : 1;
    this.previousRawBit = rawBit;
    this.pushBit(diffBit);
  }

  private pushBit(bit: number): void {
    this.bitShiftRegister = ((this.bitShiftRegister << 1) | (bit & 1)) & this.bitMask;
    this.bitCount += 1;

    if (this.bitCount < 26) {
      return;
    }

    const syndrome = this.computeSyndrome(this.bitShiftRegister);
    const blockType = BLOCK_OFFSETS[syndrome];

    if (!blockType) {
      this.totalSyndromeMisses += 1;
      return;
    }

    this.totalBlocks += 1;

    const data = (this.bitShiftRegister >> 10) & 0xffff;
    this.ingestBlock(blockType, data);
  }

  private ingestBlock(blockType: 'A' | 'B' | 'C' | 'C_PRIME' | 'D', data: number): void {
    if (blockType === 'A') {
      this.currentGroup = { a: data };
      return;
    }

    if (blockType === 'B') {
      if (this.currentGroup.a === undefined) {
        this.currentGroup = {};
        return;
      }
      this.currentGroup.b = data;
      return;
    }

    if (blockType === 'C' || blockType === 'C_PRIME') {
      if (this.currentGroup.a === undefined || this.currentGroup.b === undefined) {
        this.currentGroup = {};
        return;
      }

      this.currentGroup.c = data;
      this.currentGroup.cPrime = blockType === 'C_PRIME';
      return;
    }

    if (this.currentGroup.a === undefined || this.currentGroup.b === undefined || this.currentGroup.c === undefined) {
      this.currentGroup = {};
      return;
    }

    this.applyDecodedGroup(
      this.currentGroup.a,
      this.currentGroup.b,
      this.currentGroup.c,
      data,
      this.currentGroup.cPrime === true
    );

    this.currentGroup = {};
  }

  private computeSyndrome(word: number): number {
    let reg = word;

    for (let bit = 25; bit >= 10; bit--) {
      if (((reg >> bit) & 1) === 1) {
        reg ^= RDS_POLY << (bit - 10);
      }
    }

    return reg & 0x03ff;
  }

  private piToCallsign(piCode: number): string | null {
    if (piCode < 0x1000 || piCode > 0xbfff) {
      return null;
    }

    // Heuristic for North American PI->callsign mapping. This is best-effort and not guaranteed.
    const kBase = 0x1000;
    const wBase = 0x54a8;
    const alphabetSize = 26;
    const blockSize = alphabetSize * alphabetSize * alphabetSize;

    let prefix = 'K';
    let offset = piCode - kBase;

    if (piCode >= wBase) {
      prefix = 'W';
      offset = piCode - wBase;
    }

    if (offset < 0 || offset >= blockSize) {
      return null;
    }

    const a = Math.floor(offset / (alphabetSize * alphabetSize));
    const b = Math.floor((offset / alphabetSize) % alphabetSize);
    const c = offset % alphabetSize;

    return `${prefix}${String.fromCharCode(65 + a)}${String.fromCharCode(65 + b)}${String.fromCharCode(65 + c)}`;
  }

  private decodeTextChar(code: number): string {
    // Keep PS/radiotext readable; treat non-printable bytes as whitespace.
    if (code >= 0x20 && code <= 0x7e) {
      return String.fromCharCode(code);
    }

    return ' ';
  }
}