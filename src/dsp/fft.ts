// Simple Coole-Tukey FFT (Iterative)
// Based on standard implementations.
// Input: Float32Array (Real), Output: Float32Array (Complex [r, i, r, i...])

export class SimpleFFT {
    size: number;
    reverseTable: Uint32Array;
    sinTable: Float32Array;
    cosTable: Float32Array;
  
    constructor(size: number) {
      this.size = size;
      this.reverseTable = new Uint32Array(size);
      this.sinTable = new Float32Array(size);
      this.cosTable = new Float32Array(size);
  
      let limit = 1;
      let bit = size >> 1;
  
      while (limit < size) {
        for (let i = 0; i < limit; i++) {
          this.reverseTable[i + limit] = this.reverseTable[i] + bit;
        }
        limit = limit << 1;
        bit = bit >> 1;
      }
  
      for (let i = 0; i < size; i++) {
        this.sinTable[i] = Math.sin(-Math.PI / i);
        this.cosTable[i] = Math.cos(-Math.PI / i);
      }
    }
  
    // Transforms IQ interleaved data [i0, q0, i1, q1...] into [re0, im0, re1, im1...]
    // Note: This is a complex-to-complex FFT, but for this mock we treat input as
    // complex (IQ).
    transform(out: Float32Array, input: Float32Array) {
        const size = this.size;
        
        // Bit-reverse copy
        // Input is interleaved IQ [r, i, r, i]
        for (let i = 0; i < size; i++) {
            const rev = this.reverseTable[i];
            out[rev * 2] = input[i * 2];
            out[rev * 2 + 1] = input[i * 2 + 1];
        }

        // Cooley-Tukey
        let halfSize = 1;
        while (halfSize < size) {
            const phaseShiftStepReal = Math.cos(-Math.PI / halfSize);
            const phaseShiftStepImag = Math.sin(-Math.PI / halfSize);
            
            let currentPhaseShiftReal = 1.0;
            let currentPhaseShiftImag = 0.0;

            for (let fftStep = 0; fftStep < halfSize; fftStep++) {
                for (let i = fftStep; i < size; i += 2 * halfSize) {
                    const off = i * 2;
                    const next = (i + halfSize) * 2;
                    
                    const tr = currentPhaseShiftReal * out[next] - currentPhaseShiftImag * out[next + 1];
                    const ti = currentPhaseShiftReal * out[next + 1] + currentPhaseShiftImag * out[next];

                    out[next] = out[off] - tr;
                    out[next + 1] = out[off + 1] - ti;
                    out[off] += tr;
                    out[off + 1] += ti;
                }
                
                const tmpReal = currentPhaseShiftReal;
                currentPhaseShiftReal = tmpReal * phaseShiftStepReal - currentPhaseShiftImag * phaseShiftStepImag;
                currentPhaseShiftImag = tmpReal * phaseShiftStepImag + currentPhaseShiftImag * phaseShiftStepReal;
            }
            halfSize <<= 1;
        }
    }
}
