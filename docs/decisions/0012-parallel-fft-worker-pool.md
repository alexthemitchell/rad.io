# ADR-0012: Parallel FFT Worker Pool for Multi-Range Processing

## Status

Accepted

## Context

Advanced SDR features require processing multiple frequency ranges simultaneously:
- Band scanning (sweep multiple ranges)
- Multi-device monitoring
- Spectrum stitching (wideband analysis)
- Real-time signal detection across bands

Single FFT worker insufficient for:
- Scanning 50 MHz range at 2 MHz/step = 25 FFTs
- Processing 4 simultaneous devices
- Real-time waterfall + spectrum analyzer + peak detection

## Decision

Implement **parallel FFT worker pool** with work-stealing scheduler.

### Architecture

```typescript
// src/lib/dsp/fft-worker-pool.ts

interface FFTTask {
  id: string
  priority: number
  samples: Float32Array
  sampleRate: number
  resolve: (result: FFTResult) => void
  reject: (error: Error) => void
}

export class FFTWorkerPool {
  private workers: Worker[] = []
  private taskQueue: PriorityQueue<FFTTask>
  private workerLoad: Map<Worker, number> = new Map()
  
  constructor(size: number = navigator.hardwareConcurrency || 4) {
    for (let i = 0; i < size; i++) {
      const worker = new Worker('/src/workers/fft-worker.ts', { type: 'module' })
      worker.onmessage = (e) => this.handleResult(worker, e.data)
      this.workers.push(worker)
      this.workerLoad.set(worker, 0)
    }
  }
  
  async computeFFT(
    samples: Float32Array,
    sampleRate: number,
    priority: number = 0
  ): Promise<FFTResult> {
    return new Promise((resolve, reject) => {
      const task: FFTTask = {
        id: ulid(),
        priority,
        samples,
        sampleRate,
        resolve,
        reject
      }
      
      this.taskQueue.enqueue(task)
      this.scheduleNext()
    })
  }
  
  private scheduleNext() {
    if (this.taskQueue.isEmpty()) return
    
    // Find least loaded worker
    const worker = this.getLeastLoadedWorker()
    const task = this.taskQueue.dequeue()
    
    if (!task) return
    
    // Transfer samples to worker
    worker.postMessage({
      id: task.id,
      samples: task.samples,
      sampleRate: task.sampleRate
    }, [task.samples.buffer])
    
    this.workerLoad.set(worker, (this.workerLoad.get(worker) || 0) + 1)
  }
  
  private getLeastLoadedWorker(): Worker {
    let minLoad = Infinity
    let leastLoaded = this.workers[0]
    
    for (const [worker, load] of this.workerLoad.entries()) {
      if (load < minLoad) {
        minLoad = load
        leastLoaded = worker
      }
    }
    
    return leastLoaded
  }
  
  private handleResult(worker: Worker, result: FFTResult) {
    this.workerLoad.set(worker, Math.max(0, (this.workerLoad.get(worker) || 0) - 1))
    // Resolve promise...
    this.scheduleNext()
  }
}
```

### Priority Queue for Task Scheduling

```typescript
class PriorityQueue<T extends { priority: number }> {
  private heap: T[] = []
  
  enqueue(item: T) {
    this.heap.push(item)
    this.bubbleUp(this.heap.length - 1)
  }
  
  dequeue(): T | undefined {
    if (this.isEmpty()) return undefined
    
    const result = this.heap[0]
    const end = this.heap.pop()
    
    if (this.heap.length > 0 && end) {
      this.heap[0] = end
      this.bubbleDown(0)
    }
    
    return result
  }
  
  private bubbleUp(index: number) {
    const item = this.heap[index]
    while (index > 0) {
      const parentIndex = Math.floor((index - 1) / 2)
      const parent = this.heap[parentIndex]
      
      if (item.priority <= parent.priority) break
      
      this.heap[index] = parent
      index = parentIndex
    }
    this.heap[index] = item
  }
  
  private bubbleDown(index: number) {
    const length = this.heap.length
    const item = this.heap[index]
    
    while (true) {
      const leftIndex = 2 * index + 1
      const rightIndex = 2 * index + 2
      let swapIndex = -1
      
      if (leftIndex < length && this.heap[leftIndex].priority > item.priority) {
        swapIndex = leftIndex
      }
      
      if (
        rightIndex < length &&
        this.heap[rightIndex].priority > (swapIndex === -1 ? item : this.heap[leftIndex]).priority
      ) {
        swapIndex = rightIndex
      }
      
      if (swapIndex === -1) break
      
      this.heap[index] = this.heap[swapIndex]
      index = swapIndex
    }
    
    this.heap[index] = item
  }
  
  isEmpty(): boolean {
    return this.heap.length === 0
  }
}
```

### Batch Processing for Band Scanning

```typescript
export async function scanBand(
  device: SDRDevice,
  startFreq: FrequencyHz,
  endFreq: FrequencyHz,
  step: number,
  pool: FFTWorkerPool
): Promise<ScanResult[]> {
  const frequencies: FrequencyHz[] = []
  
  for (let freq = startFreq; freq <= endFreq; freq += step) {
    frequencies.push(freq as FrequencyHz)
  }
  
  // Process all frequencies in parallel
  const results = await Promise.all(
    frequencies.map(async (freq, index) => {
      await device.setFrequency(freq)
      await delay(10)  // Settling time
      
      const samples = await device.captureSamples(2048)
      const fft = await pool.computeFFT(
        samples,
        device.config.sampleRate,
        index  // Priority = order in scan
      )
      
      return {
        frequency: freq,
        powerSpectrum: fft.magnitude,
        peakPower: Math.max(...fft.magnitude)
      }
    })
  )
  
  return results
}
```

## Consequences

### Positive
- Parallel processing utilizes multi-core CPUs
- Priority-based scheduling for responsive UI
- Work-stealing balances load dynamically
- Scales with hardware capabilities

### Negative
- More complex than single worker
- Memory overhead for multiple worker contexts
- Coordination overhead between workers

## Performance Targets
- 4-core CPU: 4x FFT throughput vs single worker
- Band scan (100 steps): < 5 seconds
- Sustained throughput: 200+ FFTs/second

## References

#### Parallel Processing Algorithms
* Lea, Doug. "A Java Fork/Join Framework." Java Grande Conference (2000). [Paper](http://gee.cs.oswego.edu/dl/papers/fj.pdf) - Work-stealing scheduler design patterns
* IEEE Signal Processing Magazine. "Parallel FFT Algorithms." - Parallel DSP implementation strategies

#### Performance Research (from ADR-0002)
* IEEE (2015). "Performance Scalability Analysis of JavaScript Applications with Web Workers." [Research](https://ieeexplore.ieee.org/document/7307120) - Worker pool scaling analysis
* fft.js benchmark: 47,511 ops/sec at 2048 points - fastest JavaScript FFT implementation

#### Related ADRs
* ADR-0002: Web Worker DSP Architecture (foundational worker pool design)
* ADR-0004: Signal Processing Library Selection (FFT library choice)
