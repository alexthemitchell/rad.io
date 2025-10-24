# ADR-0013: Automatic Signal Detection System

## Status

Accepted

## Context

Users need automatic signal detection to:
- Identify active frequencies in band scans
- Catalog signals for later analysis
- Trigger recordings automatically
- Classify signal types (narrowband, wideband, pulsed)

Detection requirements:
- Real-time processing (< 100ms latency)
- Configurable thresholds
- False positive minimization
- Metadata extraction (bandwidth, center freq, power)

## Decision

Implement **multi-stage signal detection pipeline** with configurable algorithms.

### Detection Pipeline

```
FFT → Noise Floor Estimation → Threshold Detection → Peak Clustering → Signal Classification
```

### Noise Floor Estimation

```typescript
// src/lib/detection/noise-floor.ts

export class NoiseFloorEstimator {
  private history: Float32Array[] = []
  private historySize = 100
  
  estimate(spectrum: Float32Array): number {
    // Use median of recent spectra for robust estimation
    this.history.push(new Float32Array(spectrum))
    if (this.history.length > this.historySize) {
      this.history.shift()
    }
    
    // Compute median at each bin
    const medianSpectrum = new Float32Array(spectrum.length)
    for (let i = 0; i < spectrum.length; i++) {
      const values = this.history.map(h => h[i]).sort((a, b) => a - b)
      medianSpectrum[i] = values[Math.floor(values.length / 2)]
    }
    
    // Noise floor is median of lower 25% of bins
    const sorted = Array.from(medianSpectrum).sort((a, b) => a - b)
    const quarter = Math.floor(sorted.length * 0.25)
    return sorted[quarter]
  }
}
```

### Peak Detection

```typescript
// src/lib/detection/peak-detector.ts

export interface Peak {
  binIndex: number
  frequency: FrequencyHz
  power: number
  bandwidth: number
  snr: number
}

export class PeakDetector {
  constructor(
    private thresholdDB: number = 10,
    private minBandwidth: number = 1000,
    private maxBandwidth: number = 1_000_000
  ) {}
  
  detect(
    spectrum: Float32Array,
    noiseFloor: number,
    sampleRate: number,
    centerFreq: FrequencyHz
  ): Peak[] {
    const threshold = noiseFloor + this.thresholdDB
    const peaks: Peak[] = []
    
    let inPeak = false
    let peakStart = 0
    let peakMax = 0
    let peakMaxBin = 0
    
    for (let i = 0; i < spectrum.length; i++) {
      const power = spectrum[i]
      
      if (power > threshold) {
        if (!inPeak) {
          // Peak start
          inPeak = true
          peakStart = i
          peakMax = power
          peakMaxBin = i
        } else {
          // Continue peak
          if (power > peakMax) {
            peakMax = power
            peakMaxBin = i
          }
        }
      } else {
        if (inPeak) {
          // Peak end
          const peakEnd = i - 1
          const bandwidth = ((peakEnd - peakStart) / spectrum.length) * sampleRate
          
          // Validate bandwidth
          if (bandwidth >= this.minBandwidth && bandwidth <= this.maxBandwidth) {
            const frequency = this.binToFrequency(
              peakMaxBin,
              spectrum.length,
              sampleRate,
              centerFreq
            )
            
            peaks.push({
              binIndex: peakMaxBin,
              frequency,
              power: peakMax,
              bandwidth,
              snr: peakMax - noiseFloor
            })
          }
          
          inPeak = false
        }
      }
    }
    
    return peaks
  }
  
  private binToFrequency(
    bin: number,
    fftSize: number,
    sampleRate: number,
    centerFreq: FrequencyHz
  ): FrequencyHz {
    const offset = ((bin - fftSize / 2) / fftSize) * sampleRate
    return (centerFreq + offset) as FrequencyHz
  }
}
```

### Signal Classification

```typescript
// src/lib/detection/signal-classifier.ts

export type SignalType = 
  | 'narrowband-fm'
  | 'wideband-fm'
  | 'am'
  | 'digital'
  | 'pulsed'
  | 'unknown'

export interface ClassifiedSignal extends Peak {
  type: SignalType
  confidence: number
}

export class SignalClassifier {
  classify(peak: Peak, spectrum: Float32Array): ClassifiedSignal {
    let type: SignalType = 'unknown'
    let confidence = 0
    
    // FM: bandwidth ~10-25 kHz (narrowband) or ~200 kHz (wideband)
    if (peak.bandwidth >= 8_000 && peak.bandwidth <= 30_000) {
      type = 'narrowband-fm'
      confidence = 0.8
    } else if (peak.bandwidth >= 150_000 && peak.bandwidth <= 250_000) {
      type = 'wideband-fm'
      confidence = 0.9
    }
    
    // AM: bandwidth 5-10 kHz
    else if (peak.bandwidth >= 4_000 && peak.bandwidth <= 12_000) {
      type = 'am'
      confidence = 0.7
    }
    
    // Digital: Often narrowband with sharp edges
    else if (peak.bandwidth >= 1_000 && peak.bandwidth <= 5_000) {
      const sharpness = this.measureEdgeSharpness(peak, spectrum)
      if (sharpness > 0.7) {
        type = 'digital'
        confidence = 0.6
      }
    }
    
    return {
      ...peak,
      type,
      confidence
    }
  }
  
  private measureEdgeSharpness(peak: Peak, spectrum: Float32Array): number {
    // Measure how sharply power drops at peak edges
    const binIndex = peak.binIndex
    const power = spectrum[binIndex]
    
    let leftEdge = binIndex
    while (leftEdge > 0 && spectrum[leftEdge] > power * 0.5) {
      leftEdge--
    }
    
    let rightEdge = binIndex
    while (rightEdge < spectrum.length - 1 && spectrum[rightEdge] > power * 0.5) {
      rightEdge++
    }
    
    const edgeWidth = rightEdge - leftEdge
    const rolloff = power / edgeWidth
    
    return Math.min(rolloff / 10, 1)  // Normalize to [0, 1]
  }
}
```

### Real-Time Detection Worker

```typescript
// src/workers/signal-detection-worker.ts

import { NoiseFloorEstimator } from '../lib/detection/noise-floor'
import { PeakDetector } from '../lib/detection/peak-detector'
import { SignalClassifier } from '../lib/detection/signal-classifier'

const noiseFloorEstimator = new NoiseFloorEstimator()
const peakDetector = new PeakDetector()
const signalClassifier = new SignalClassifier()

self.onmessage = async (event) => {
  const { id, spectrum, sampleRate, centerFreq } = event.data
  
  // Estimate noise floor
  const noiseFloor = noiseFloorEstimator.estimate(spectrum)
  
  // Detect peaks
  const peaks = peakDetector.detect(spectrum, noiseFloor, sampleRate, centerFreq)
  
  // Classify signals
  const signals = peaks.map(peak => signalClassifier.classify(peak, spectrum))
  
  self.postMessage({
    id,
    signals,
    noiseFloor,
    processingTime: performance.now()
  })
}
```

### Integration with Main App

```typescript
// src/lib/detection/detection-manager.ts

export class DetectionManager {
  private worker: Worker
  private onSignalsDetected?: (signals: ClassifiedSignal[]) => void
  
  constructor() {
    this.worker = new Worker('/src/workers/signal-detection-worker.ts', {
      type: 'module'
    })
    
    this.worker.onmessage = (event) => {
      if (this.onSignalsDetected) {
        this.onSignalsDetected(event.data.signals)
      }
    }
  }
  
  detectSignals(
    spectrum: Float32Array,
    sampleRate: number,
    centerFreq: FrequencyHz
  ) {
    this.worker.postMessage(
      {
        id: ulid(),
        spectrum,
        sampleRate,
        centerFreq
      },
      [spectrum.buffer]
    )
  }
  
  onDetection(callback: (signals: ClassifiedSignal[]) => void) {
    this.onSignalsDetected = callback
  }
}
```

## Consequences

### Positive
- Automatic discovery of signals
- Reduces manual scanning effort
- Enables intelligent recording triggers
- Provides signal metadata

### Negative
- False positives require tuning
- Classification accuracy limited
- CPU overhead for real-time detection

## Performance Targets
- Detection latency: < 50ms
- False positive rate: < 5%
- Detection rate: > 95% for SNR > 10 dB

## References

#### Academic Research on Signal Detection
* IEEE Transactions on Signal Processing. "Automatic Modulation Classification: A Review." - Machine learning approaches to signal classification
* IEEE Communications Surveys & Tutorials. "Energy Detection in Spectrum Sensing: Overview and Challenges." - Statistical detection methods
* MATLAB Documentation. "Peak Detection Algorithms." Signal Processing Toolbox. [Documentation](https://www.mathworks.com/help/signal/ref/findpeaks.html) - Algorithm reference

#### DSP Fundamentals  
* Proakis, John G., and Manolakis, Dimitris G. "Digital Signal Processing: Principles, Algorithms, and Applications." Pearson, 4th edition (2006). - Standard DSP textbook

#### Related ADRs
* ADR-0002: Web Worker DSP Architecture (detection runs in workers)
* ADR-0004: Signal Processing Library Selection (detection algorithms)
