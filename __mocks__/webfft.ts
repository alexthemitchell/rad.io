// Mock implementation of webfft for testing
class MockWebFFT {
  constructor(public size: number) {}

  // Simple mock FFT that returns a Float32Array of the same size
  fft(input: Float32Array): Float32Array {
    const output = new Float32Array(this.size);
    
    // Simple DFT implementation for testing
    for (let k = 0; k < this.size; k++) {
      let real = 0;
      let imag = 0;
      
      for (let n = 0; n < this.size; n += 2) {
        const angle = (-2 * Math.PI * k * (n / 2)) / this.size;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        
        const realPart = input[n] || 0;
        const imagPart = input[n + 1] || 0;
        
        real += realPart * cos - imagPart * sin;
        imag += realPart * sin + imagPart * cos;
      }
      
      // Store magnitude (simplified for testing)
      output[k] = Math.sqrt(real * real + imag * imag);
    }
    
    return output;
  }
}

export default MockWebFFT;
