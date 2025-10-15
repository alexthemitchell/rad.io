import '@testing-library/jest-dom';

// Mock canvas methods for testing
HTMLCanvasElement.prototype.getContext = function() {
  return {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: '',
    textAlign: 'left',
    textBaseline: 'top',
    globalAlpha: 1,
    fillRect: jest.fn(),
    strokeRect: jest.fn(),
    clearRect: jest.fn(),
    fillText: jest.fn(),
    strokeText: jest.fn(),
    beginPath: jest.fn(),
    moveTo: jest.fn(),
    lineTo: jest.fn(),
    closePath: jest.fn(),
    stroke: jest.fn(),
    fill: jest.fn(),
    arc: jest.fn(),
    rect: jest.fn(),
    scale: jest.fn(),
    translate: jest.fn(),
    rotate: jest.fn(),
    save: jest.fn(),
    restore: jest.fn(),
    measureText: jest.fn(() => ({ width: 0 })),
    createLinearGradient: jest.fn(() => ({
      addColorStop: jest.fn(),
    })),
    createRadialGradient: jest.fn(() => ({
      addColorStop: jest.fn(),
    })),
  } as any;
};

// Mock Web Audio API for testing
class MockAudioContext {
  sampleRate: number;
  destination: any;
  currentTime: number = 0;

  constructor() {
    this.sampleRate = 48000;
    this.destination = {};
  }

  createOscillator() {
    return new MockOscillatorNode(this);
  }

  createGain() {
    return new MockGainNode();
  }

  createBuffer(numberOfChannels: number, length: number, sampleRate: number) {
    return new MockAudioBuffer(numberOfChannels, length, sampleRate);
  }

  createBufferSource() {
    return new MockAudioBufferSourceNode();
  }

  createPeriodicWave(real: Float32Array, imag: Float32Array) {
    return new MockPeriodicWave(real, imag);
  }
}

class MockOfflineAudioContext extends MockAudioContext {
  length: number;

  constructor(numberOfChannels: number, length: number, sampleRate: number) {
    super();
    this.sampleRate = sampleRate;
    this.length = length;
  }

  startRendering() {
    return Promise.resolve(new MockAudioBuffer(2, this.length, this.sampleRate));
  }

  createAnalyser() {
    return new MockAnalyserNode();
  }
}

class MockOscillatorNode {
  context: MockAudioContext;
  type: OscillatorType = 'sine';
  frequency: { value: number } = { value: 440 };
  private _periodicWave: MockPeriodicWave | null = null;

  constructor(context: MockAudioContext) {
    this.context = context;
  }

  connect(destination: any) {
    return destination;
  }

  disconnect() {}

  start(when?: number) {}

  stop(when?: number) {}

  setPeriodicWave(wave: MockPeriodicWave) {
    this._periodicWave = wave;
  }
}

class MockGainNode {
  gain: { value: number } = { value: 1 };

  connect(destination: any) {
    return destination;
  }

  disconnect() {}
}

class MockAudioBuffer {
  numberOfChannels: number;
  length: number;
  sampleRate: number;
  private channels: Float32Array[];

  constructor(numberOfChannels: number, length: number, sampleRate: number) {
    this.numberOfChannels = numberOfChannels;
    this.length = length;
    this.sampleRate = sampleRate;
    this.channels = Array.from({ length: numberOfChannels }, () => new Float32Array(length));
  }

  getChannelData(channel: number): Float32Array {
    return this.channels[channel] || new Float32Array(this.length);
  }
}

class MockAudioBufferSourceNode {
  buffer: MockAudioBuffer | null = null;

  connect(destination: any) {
    return destination;
  }

  disconnect() {}

  start(when?: number) {}

  stop(when?: number) {}
}

class MockPeriodicWave {
  real: Float32Array;
  imag: Float32Array;

  constructor(real: Float32Array, imag: Float32Array) {
    this.real = real;
    this.imag = imag;
  }
}

class MockAnalyserNode {
  fftSize: number = 2048;
  frequencyBinCount: number = 1024;
  smoothingTimeConstant: number = 0.8;

  connect(destination: any) {
    return destination;
  }

  disconnect() {}

  getFloatFrequencyData(array: Float32Array) {
    // Fill with mock FFT data (simulating noise floor)
    for (let i = 0; i < array.length; i++) {
      array[i] = -100 + Math.random() * 10;
    }
  }
}

// Assign mocks to global
(global as any).AudioContext = MockAudioContext;
(global as any).OfflineAudioContext = MockOfflineAudioContext;

