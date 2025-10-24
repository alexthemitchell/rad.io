# ADR-0014: Automatic Frequency Scanning Implementation

## Status

Accepted

## Context

Users need automatic frequency scanning for:
- Band monitoring (find active frequencies)
- Spectrum survey (measure occupancy)
- Signal discovery (new transmission identification)
- Channel hopping (follow frequency-agile transmitters)

Scanning challenges:
- Balance speed vs. thoroughness
- Minimize settling time after frequency changes
- Handle multiple scan ranges
- Prioritize interesting frequencies
- Support continuous vs. one-shot scans

## Decision

Implement **adaptive frequency scanning** with multiple strategies.

### Scan Strategies

#### 1. Linear Scan
Sequential scan through frequency range.

```typescript
export class LinearScanner {
  async scan(
    device: SDRDevice,
    startFreq: FrequencyHz,
    endFreq: FrequencyHz,
    step: number,
    callback: (result: ScanResult) => void
  ): Promise<void> {
    for (let freq = startFreq; freq <= endFreq; freq += step) {
      await device.setFrequency(freq as FrequencyHz)
      await delay(50)  // Settling time
      
      const samples = await device.captureSamples(2048)
      const fft = await fftPool.computeFFT(samples, device.config.sampleRate)
      
      const result: ScanResult = {
        frequency: freq as FrequencyHz,
        timestamp: Date.now(),
        powerSpectrum: fft.magnitude,
        peakPower: Math.max(...fft.magnitude),
        avgPower: average(fft.magnitude)
      }
      
      callback(result)
    }
  }
}
```

#### 2. Binary Search Scan
Quickly find band edges of signals.

```typescript
export class BinarySearchScanner {
  async findBandEdges(
    device: SDRDevice,
    startFreq: FrequencyHz,
    endFreq: FrequencyHz,
    threshold: number
  ): Promise<{ low: FrequencyHz; high: FrequencyHz } | null> {
    const mid = (startFreq + endFreq) / 2
    
    await device.setFrequency(mid as FrequencyHz)
    const power = await this.measurePower(device)
    
    if (power < threshold) {
      return null  // No signal in range
    }
    
    // Find lower edge
    let low = await this.findEdge(device, startFreq, mid as FrequencyHz, threshold, 'lower')
    
    // Find upper edge
    let high = await this.findEdge(device, mid as FrequencyHz, endFreq, threshold, 'upper')
    
    return { low, high }
  }
  
  private async findEdge(
    device: SDRDevice,
    start: FrequencyHz,
    end: FrequencyHz,
    threshold: number,
    direction: 'lower' | 'upper'
  ): Promise<FrequencyHz> {
    if (end - start < 1000) {
      return direction === 'lower' ? start : end
    }
    
    const mid = ((start + end) / 2) as FrequencyHz
    await device.setFrequency(mid)
    const power = await this.measurePower(device)
    
    if (power > threshold) {
      return direction === 'lower'
        ? this.findEdge(device, start, mid, threshold, direction)
        : this.findEdge(device, mid, end, threshold, direction)
    } else {
      return direction === 'lower'
        ? this.findEdge(device, mid, end, threshold, direction)
        : this.findEdge(device, start, mid, threshold, direction)
    }
  }
  
  private async measurePower(device: SDRDevice): Promise<number> {
    const samples = await device.captureSamples(1024)
    const fft = await fftPool.computeFFT(samples, device.config.sampleRate)
    return average(fft.magnitude)
  }
}
```

#### 3. Adaptive Scan
Spend more time on interesting frequencies.

```typescript
export class AdaptiveScanner {
  private interestingFrequencies: Map<number, number> = new Map()
  
  async scan(
    device: SDRDevice,
    startFreq: FrequencyHz,
    endFreq: FrequencyHz,
    baseStep: number
  ): Promise<void> {
    const frequencies = this.generateAdaptiveSteps(startFreq, endFreq, baseStep)
    
    for (const freq of frequencies) {
      const dwellTime = this.calculateDwellTime(freq)
      
      await device.setFrequency(freq)
      await delay(dwellTime)
      
      const samples = await device.captureSamples(2048)
      const fft = await fftPool.computeFFT(samples, device.config.sampleRate)
      const power = Math.max(...fft.magnitude)
      
      // Update interest level
      this.updateInterest(freq, power)
    }
  }
  
  private generateAdaptiveSteps(
    start: FrequencyHz,
    end: FrequencyHz,
    baseStep: number
  ): FrequencyHz[] {
    const frequencies: FrequencyHz[] = []
    
    for (let freq = start; freq <= end; freq += baseStep) {
      frequencies.push(freq as FrequencyHz)
      
      // Add finer steps around interesting frequencies
      if (this.interestingFrequencies.has(freq)) {
        const fineStep = baseStep / 4
        for (let offset = fineStep; offset < baseStep; offset += fineStep) {
          frequencies.push((freq + offset) as FrequencyHz)
        }
      }
    }
    
    return frequencies
  }
  
  private calculateDwellTime(freq: number): number {
    const interest = this.interestingFrequencies.get(freq) || 0
    return 50 + interest * 200  // 50-250ms based on interest
  }
  
  private updateInterest(freq: number, power: number) {
    const threshold = -60  // dBm
    if (power > threshold) {
      this.interestingFrequencies.set(freq, Math.min(1, power / threshold))
    }
  }
}
```

#### 4. Priority Scan
Scan bookmarked frequencies first.

```typescript
export class PriorityScanner {
  async scan(
    device: SDRDevice,
    ranges: ScanRange[],
    bookmarks: FrequencyHz[]
  ): Promise<void> {
    // Scan bookmarks first
    for (const freq of bookmarks) {
      await this.scanFrequency(device, freq)
    }
    
    // Then scan ranges
    for (const range of ranges) {
      await new LinearScanner().scan(
        device,
        range.start,
        range.end,
        range.step,
        (result) => this.handleResult(result)
      )
    }
  }
}
```

### Scan Manager

```typescript
export class ScanManager {
  private activeScans: Map<string, AbortController> = new Map()
  private results: Map<string, ScanResult[]> = new Map()
  
  async startScan(
    config: ScanConfig,
    device: SDRDevice
  ): Promise<string> {
    const scanId = ulid()
    const abortController = new AbortController()
    
    this.activeScans.set(scanId, abortController)
    this.results.set(scanId, [])
    
    // Select scanner based on strategy
    const scanner = this.createScanner(config.strategy)
    
    // Run scan in background
    this.runScan(scanId, scanner, config, device, abortController.signal)
    
    return scanId
  }
  
  stopScan(scanId: string) {
    const controller = this.activeScans.get(scanId)
    controller?.abort()
    this.activeScans.delete(scanId)
  }
  
  getResults(scanId: string): ScanResult[] {
    return this.results.get(scanId) || []
  }
  
  private async runScan(
    scanId: string,
    scanner: IScanner,
    config: ScanConfig,
    device: SDRDevice,
    signal: AbortSignal
  ) {
    try {
      await scanner.scan(
        device,
        config.startFreq,
        config.endFreq,
        config.step,
        (result) => {
          if (signal.aborted) return
          
          this.results.get(scanId)?.push(result)
          this.emitProgress(scanId, result)
        }
      )
      
      this.emitComplete(scanId)
    } catch (error) {
      if (!signal.aborted) {
        this.emitError(scanId, error)
      }
    } finally {
      this.activeScans.delete(scanId)
    }
  }
  
  private createScanner(strategy: ScanStrategy): IScanner {
    switch (strategy) {
      case 'linear':
        return new LinearScanner()
      case 'binary':
        return new BinarySearchScanner()
      case 'adaptive':
        return new AdaptiveScanner()
      case 'priority':
        return new PriorityScanner()
      default:
        return new LinearScanner()
    }
  }
  
  private emitProgress(scanId: string, result: ScanResult) {
    window.dispatchEvent(new CustomEvent('scan:progress', {
      detail: { scanId, result }
    }))
  }
  
  private emitComplete(scanId: string) {
    window.dispatchEvent(new CustomEvent('scan:complete', {
      detail: { scanId, results: this.results.get(scanId) }
    }))
  }
  
  private emitError(scanId: string, error: any) {
    window.dispatchEvent(new CustomEvent('scan:error', {
      detail: { scanId, error }
    }))
  }
}
```

### React Integration

```typescript
export function useScan(device: SDRDevice | null) {
  const [scanId, setScanId] = useState<string | null>(null)
  const [results, setResults] = useState<ScanResult[]>([])
  const [isScanning, setIsScanning] = useState(false)
  
  const startScan = async (config: ScanConfig) => {
    if (!device) return
    
    setIsScanning(true)
    const id = await scanManager.startScan(config, device)
    setScanId(id)
  }
  
  const stopScan = () => {
    if (scanId) {
      scanManager.stopScan(scanId)
      setScanId(null)
      setIsScanning(false)
    }
  }
  
  useEffect(() => {
    const handleProgress = (event: CustomEvent) => {
      if (event.detail.scanId === scanId) {
        setResults((prev) => [...prev, event.detail.result])
      }
    }
    
    const handleComplete = (event: CustomEvent) => {
      if (event.detail.scanId === scanId) {
        setIsScanning(false)
      }
    }
    
    window.addEventListener('scan:progress', handleProgress as EventListener)
    window.addEventListener('scan:complete', handleComplete as EventListener)
    
    return () => {
      window.removeEventListener('scan:progress', handleProgress as EventListener)
      window.removeEventListener('scan:complete', handleComplete as EventListener)
    }
  }, [scanId])
  
  return {
    startScan,
    stopScan,
    isScanning,
    results
  }
}
```

## Consequences

### Positive
- Multiple strategies for different use cases
- Adaptive scanning optimizes for interesting signals
- Abortable scans
- Real-time progress updates
- Efficient band surveys

### Negative
- Settling time limits scan speed
- Multiple strategies increase complexity
- May miss fast-hopping signals

## Performance Targets
- Linear scan: 10-20 steps/second
- Adaptive scan: 15-30 steps/second (varies)
- Full VHF band (144-148 MHz, 25 kHz steps): < 30 seconds

## References

#### Academic and Industry Research
* IEEE Communications Magazine. "Spectrum Sensing Techniques for Cognitive Radio Systems." - Survey of scanning strategies
* GNU Radio Conference Proceedings. "Fast Frequency Scanning for Software Defined Radio." - Practical SDR scanning implementation
* SDR Academy. "Adaptive Step Size in Frequency Scanning." - Optimization techniques

#### SDR Resources
* [GNU Radio](https://www.gnuradio.org/) - Open source SDR framework with scanning examples
* [LiquidSDR](https://liquidsdr.org/) - DSP library with spectrum sensing primitives

#### Related ADRs
* ADR-0013: Automatic Signal Detection System (detection during scan)
* ADR-0012: Parallel FFT Worker Pool (parallel spectrum analysis)
