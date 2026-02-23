import { useState, useEffect, useMemo, useRef } from 'react';
import { AudioSink } from './audio/AudioSink';
import { AudioScopeCanvas } from './components/AudioScopeCanvas';
import { SpectrumCanvas } from './components/SpectrumCanvas';
import { WaterfallCanvas } from './components/WaterfallCanvas';
import {
  evaluateFmScanCandidate,
  isStationCandidate,
  mergeNearbyCandidates,
  type FmStationCandidate
} from './dsp/FmBandScanner';
import { HackRFDevice } from './devices/HackRFDevice';
import { MockDevice } from './devices/MockDevice';
import { RtlSdrDevice } from './devices/RtlSdrDevice';
import { ISDRDevice, SDRGainStage } from './devices/ISDRDevice';
import { normalizeDeviceError } from './devices/errors';

type ConnectionState = 'idle' | 'starting' | 'streaming' | 'recovering' | 'error';
type AudioState = 'suspended' | 'awaiting-user-gesture' | 'running' | 'degraded' | 'muted';
type ScanState = 'idle' | 'running' | 'completed' | 'cancelled' | 'error';
type HealthLevel = 'ok' | 'warn' | 'error';
type RuntimeTelemetry = {
  renderFps: number | null;
  lowFpsEvents: number;
  audioUnderruns: number;
  audioQueueAheadMs: number;
};

type RdsTelemetry = {
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

type RadioDebugSnapshot = {
  isRunning: boolean;
  sourceType: 'MOCK' | 'HACKRF' | 'RTLSDR';
  connectionState: ConnectionState;
  audioState: AudioState;
  frequencyHz: number;
  demodMode: 'WFM' | 'AM' | 'NFM';
  fftPeakDb: number;
  fftNonDcPeakDb: number;
  scopeRms: number;
  scopeMeanAbs: number;
  usbIqRms: number;
  usbIqMeanAbs: number;
  usbTransferBytes: number;
  usbTransferCount: number;
  runtimeTelemetry: RuntimeTelemetry;
  rds: RdsTelemetry;
};

type FmScanResult = FmStationCandidate & {
  scannedAt: string;
};

const emptyRdsTelemetry = (): RdsTelemetry => ({
  synced: false,
  totalBlocks: 0,
  totalGroups: 0,
  blockErrorRate: 1,
  piCode: null,
  callsignCandidate: null,
  ptyCode: null,
  ptyName: null,
  tp: false,
  ta: false,
  ms: null,
  ps: '',
  radiotext: '',
  latestGroup: null
});

declare global {
  interface Window {
    __radIoDebug?: {
      getSnapshot: () => RadioDebugSnapshot;
    };
  }
}

export default function App() {
  const [isRunning, setIsRunning] = useState(false);
  const [sourceType, setSourceType] = useState<'MOCK' | 'HACKRF' | 'RTLSDR'>('MOCK');
  const [fftData, setFftData] = useState<Float32Array>(new Float32Array(2048));
  const [scopeData, setScopeData] = useState<Float32Array>(new Float32Array(256));
  
  const [frequency, setFrequency] = useState<number>(90_000_000);
  // Gains: Map<StageName, Value>
  const [gains, setGains] = useState<Record<string, number>>({});
  const [gainStages, setGainStages] = useState<SDRGainStage[]>([]);

  const [demodMode, setDemodMode] = useState<'WFM' | 'AM' | 'NFM'>('WFM');
  const [fineFreq, setFineFreq] = useState<number>(0);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
    const [isMuted, setIsMuted] = useState(false);
    const [waterfallPalette, setWaterfallPalette] = useState<'cividis' | 'inferno'>('cividis');
    const [waterfallAutoScale, setWaterfallAutoScale] = useState(true);
    const [waterfallMinDb, setWaterfallMinDb] = useState(-125);
    const [waterfallMaxDb, setWaterfallMaxDb] = useState(-35);

    const [connectionState, setConnectionState] = useState<ConnectionState>('idle');
    const [audioState, setAudioState] = useState<AudioState>('suspended');
    const [statusMessage, setStatusMessage] = useState('Ready. Select a source and start streaming.');
    const [diagnosticEvents, setDiagnosticEvents] = useState<string[]>([]);
    const [runtimeTelemetry, setRuntimeTelemetry] = useState<RuntimeTelemetry>({
      renderFps: null,
      lowFpsEvents: 0,
      audioUnderruns: 0,
      audioQueueAheadMs: 0
    });
    const [usbIqRms, setUsbIqRms] = useState(0);
    const [usbIqMeanAbs, setUsbIqMeanAbs] = useState(0);
    const [usbTransferBytes, setUsbTransferBytes] = useState(0);
    const [usbTransferCount, setUsbTransferCount] = useState(0);
    const [rdsTelemetry, setRdsTelemetry] = useState<RdsTelemetry>(emptyRdsTelemetry);
    const [scanState, setScanState] = useState<ScanState>('idle');
    const [scanProgress, setScanProgress] = useState(0);
    const [scanStepLabel, setScanStepLabel] = useState('Idle');
    const [scanResults, setScanResults] = useState<FmScanResult[]>([]);
  
  const workerRef = useRef<Worker | null>(null);
  const deviceRef = useRef<ISDRDevice | null>(null);
  const audioRef = useRef<AudioSink | null>(null);
  const usbIqRmsRef = useRef(0);
  const usbIqMeanAbsRef = useRef(0);
  const usbTransferBytesRef = useRef(0);
  const usbTransferCountRef = useRef(0);
  const fftDataRef = useRef<Float32Array>(new Float32Array(2048));
  const rdsTelemetryRef = useRef<RdsTelemetry>(emptyRdsTelemetry());
  const scanAbortRef = useRef(false);

    const pushDiagnosticEvent = (message: string) => {
        const timestamp = new Date().toISOString();
        setDiagnosticEvents((prev) => [`${timestamp} ${message}`, ...prev].slice(0, 100));
    };

  useEffect(() => {
    workerRef.current = new Worker(new URL('./dsp/worker.ts', import.meta.url), { type: 'module' });
    audioRef.current = new AudioSink(50000); // 50k from worker
        audioRef.current.setMuted(false);

    workerRef.current.onmessage = (e) => {
      if (e.data.type === 'FFT_DATA') {
        setFftData(e.data.data);
      } else if (e.data.type === 'SCOPE_DATA') {
        setScopeData(e.data.data);
      } else if (e.data.type === 'AUDIO_DATA') {
        const audioData = new Float32Array(e.data.data as ArrayBuffer);
        audioRef.current?.push(audioData);
      } else if (e.data.type === 'RDS_DATA') {
        setRdsTelemetry(e.data.data as RdsTelemetry);
      }
    };

        pushDiagnosticEvent('DSP worker initialized.');

    return () => {
        workerRef.current?.terminate();
        audioRef.current?.stop();
    };
  }, []);

    useEffect(() => {
        const onVisibilityChange = () => {
            if (!isRunning) return;

            if (document.visibilityState === 'hidden') {
                setAudioState('degraded');
                setStatusMessage('Tab is in the background. Audio timing may degrade.');
                pushDiagnosticEvent('Page hidden while streaming; degraded audio state flagged.');
            } else {
                setAudioState(isMuted ? 'muted' : 'running');
                setStatusMessage('Streaming restored in foreground.');
                pushDiagnosticEvent('Page returned to foreground.');
            }
        };

        document.addEventListener('visibilitychange', onVisibilityChange);
        return () => document.removeEventListener('visibilitychange', onVisibilityChange);
    }, [isRunning, isMuted]);

      useEffect(() => {
        if (!isRunning) {
          setRuntimeTelemetry((prev) => ({
            ...prev,
            renderFps: null,
            audioQueueAheadMs: 0
          }));
          return;
        }

        let frameCount = 0;
        let bucketStart = performance.now();
        let rafId = 0;

        const tick = (now: number) => {
          frameCount += 1;
          const elapsed = now - bucketStart;

          if (elapsed >= 1000) {
            const fps = (frameCount * 1000) / elapsed;
            setRuntimeTelemetry((prev) => ({
              ...prev,
              renderFps: fps,
              lowFpsEvents: fps < 45 ? prev.lowFpsEvents + 1 : prev.lowFpsEvents
            }));

            frameCount = 0;
            bucketStart = now;
          }

          rafId = window.requestAnimationFrame(tick);
        };

        rafId = window.requestAnimationFrame(tick);
        return () => window.cancelAnimationFrame(rafId);
      }, [isRunning]);

      useEffect(() => {
        if (!isRunning) return;

        const intervalId = window.setInterval(() => {
          const stats = audioRef.current?.getStats();
          if (!stats) return;

          setRuntimeTelemetry((prev) => ({
            ...prev,
            audioUnderruns: stats.underruns,
            audioQueueAheadMs: stats.queueAheadMs
          }));

          // Sample high-rate USB metrics at UI cadence to avoid per-transfer rerenders.
          setUsbIqRms(usbIqRmsRef.current);
          setUsbIqMeanAbs(usbIqMeanAbsRef.current);
          setUsbTransferBytes(usbTransferBytesRef.current);
          setUsbTransferCount(usbTransferCountRef.current);
        }, 500);

        return () => window.clearInterval(intervalId);
      }, [isRunning]);

    useEffect(() => {
      fftDataRef.current = fftData;
    }, [fftData]);

    useEffect(() => {
      rdsTelemetryRef.current = rdsTelemetry;
    }, [rdsTelemetry]);

    useEffect(() => {
      const fftPeakDb = fftData.length > 0
        ? fftData.reduce((max, value) => Math.max(max, value), -Infinity)
        : -Infinity;

      let fftNonDcPeakDb = -Infinity;
      if (fftData.length > 0) {
        const center = Math.floor(fftData.length / 2);
        const dcGuard = 16;
        for (let i = 0; i < fftData.length; i++) {
          if (Math.abs(i - center) <= dcGuard) {
            continue;
          }
          if (fftData[i] > fftNonDcPeakDb) {
            fftNonDcPeakDb = fftData[i];
          }
        }
      }

      let scopeEnergy = 0;
      let scopeAbs = 0;
      if (scopeData.length > 0) {
        for (let i = 0; i < scopeData.length; i++) {
          const sample = scopeData[i];
          scopeEnergy += sample * sample;
          scopeAbs += Math.abs(sample);
        }
      }

      const scopeRms = scopeData.length > 0 ? Math.sqrt(scopeEnergy / scopeData.length) : 0;
      const scopeMeanAbs = scopeData.length > 0 ? scopeAbs / scopeData.length : 0;

      window.__radIoDebug = {
        getSnapshot: () => ({
          isRunning,
          sourceType,
          connectionState,
          audioState,
          frequencyHz: frequency,
          demodMode,
          fftPeakDb,
          fftNonDcPeakDb,
          scopeRms,
          scopeMeanAbs,
          usbIqRms,
          usbIqMeanAbs,
          usbTransferBytes,
          usbTransferCount,
          runtimeTelemetry,
          rds: rdsTelemetry
        })
      };

      return () => {
        if (window.__radIoDebug) {
          delete window.__radIoDebug;
        }
      };
    }, [audioState, connectionState, demodMode, fftData, frequency, isRunning, rdsTelemetry, runtimeTelemetry, scopeData, sourceType, usbIqMeanAbs, usbIqRms, usbTransferBytes, usbTransferCount]);

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            const target = event.target as HTMLElement | null;
            const isTyping = target?.tagName === 'INPUT' || target?.tagName === 'SELECT' || target?.tagName === 'TEXTAREA';
            if (isTyping) return;

            if (event.key === 'm' || event.key === 'M') {
                event.preventDefault();
                setIsMuted((prev) => {
                    const nextMuted = !prev;
                    audioRef.current?.setMuted(nextMuted);
                    setAudioState(nextMuted ? 'muted' : 'running');
                    setStatusMessage(nextMuted ? 'Audio muted.' : 'Audio unmuted.');
                    pushDiagnosticEvent(nextMuted ? 'Audio muted by keyboard.' : 'Audio unmuted by keyboard.');
                    return nextMuted;
                });
            }

            if (event.key === 'ArrowRight') {
                event.preventDefault();
                setFrequency((prev) => prev + 1_000);
            }

            if (event.key === 'ArrowLeft') {
                event.preventDefault();
                setFrequency((prev) => Math.max(0, prev - 1_000));
            }
        };

        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, []);

  // Update Device Frequency when controls change
  useEffect(() => {
    if (deviceRef.current && isRunning) {
        deviceRef.current.setFrequency(frequency);
        workerRef.current?.postMessage({ command: 'RESET_RDS' });
    }
  }, [frequency, isRunning]);

  // Update Device Gains when state changes
  useEffect(() => {
    if (deviceRef.current && isRunning) {
        for (const [name, val] of Object.entries(gains)) {
            deviceRef.current.setGain(name, val);
        }
    }
  }, [gains, isRunning]);

  // Update Mode
  useEffect(() => {
    workerRef.current?.postMessage({ command: 'SET_MODE', value: demodMode });
  }, [demodMode]);

  // Update Fine Freq
  useEffect(() => {
    workerRef.current?.postMessage({ command: 'SET_FINE_FREQ', value: fineFreq });
  }, [fineFreq]);

  const waitFor = (ms: number) => new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });

  const sampleFmMeasurement = async () => {
    let best = evaluateFmScanCandidate(fftDataRef.current, rdsTelemetryRef.current);

    for (let i = 0; i < 2; i += 1) {
      await waitFor(140);
      const next = evaluateFmScanCandidate(fftDataRef.current, rdsTelemetryRef.current);
      if (next.score > best.score) {
        best = next;
      }
    }

    return best;
  };

  const cancelFmBandScan = () => {
    if (scanState !== 'running') {
      return;
    }

    scanAbortRef.current = true;
    setScanStepLabel('Cancelling...');
    setStatusMessage('Stopping FM band scan...');
  };

  const runFmBandScan = async () => {
    if (!isRunning || !deviceRef.current) {
      setStatusMessage('Start streaming before running FM scan.');
      pushDiagnosticEvent('FM scan skipped: stream not active.');
      return;
    }

    if (scanState === 'running') {
      return;
    }

    const originalFrequency = frequency;
    const originalDemodMode = demodMode;
    const originalFineFreq = fineFreq;

    const startHz = 87_500_000;
    const stopHz = 108_000_000;
    const stepHz = 200_000;
    const frequencies: number[] = [];

    for (let hz = startHz; hz <= stopHz; hz += stepHz) {
      frequencies.push(hz);
    }

    scanAbortRef.current = false;
    setScanState('running');
    setScanProgress(0);
    setScanStepLabel('Preparing scan...');
    setScanResults([]);
    setStatusMessage('Running FM band scan (87.5-108.0 MHz)...');
    pushDiagnosticEvent(`FM scan started: ${frequencies.length} channels.`);

    const candidates: FmStationCandidate[] = [];

    try {
      if (originalDemodMode !== 'WFM') {
        setDemodMode('WFM');
      }
      if (originalFineFreq !== 0) {
        setFineFreq(0);
      }

      for (let i = 0; i < frequencies.length; i += 1) {
        if (scanAbortRef.current) {
          break;
        }

        const freqHz = frequencies[i];
        setScanStepLabel(`Tuning ${(freqHz / 1_000_000).toFixed(1)} MHz`);
        setFrequency(freqHz);

        // Give RF front-end and FFT estimates time to settle after retune.
        await waitFor(320);
        const measurement = await sampleFmMeasurement();

        if (isStationCandidate(measurement)) {
          const rds = rdsTelemetryRef.current;
          candidates.push({
            frequencyHz: freqHz,
            measurement,
            ps: rds.ps,
            callsignCandidate: rds.callsignCandidate,
            piCode: rds.piCode
          });
        }

        setScanProgress((i + 1) / frequencies.length);
      }

      const merged = mergeNearbyCandidates(candidates).map((candidate) => ({
        ...candidate,
        scannedAt: new Date().toISOString()
      }));

      setScanResults(merged);

      if (scanAbortRef.current) {
        setScanState('cancelled');
        setScanStepLabel('Cancelled');
        setStatusMessage(`FM scan cancelled. Captured ${merged.length} candidate stations.`);
        pushDiagnosticEvent(`FM scan cancelled with ${merged.length} candidates.`);
      } else {
        setScanState('completed');
        setScanStepLabel('Completed');
        setStatusMessage(`FM scan complete. Found ${merged.length} candidate stations.`);
        pushDiagnosticEvent(`FM scan completed with ${merged.length} candidates.`);
      }
    } catch (error) {
      const normalized = normalizeDeviceError(error);
      setScanState('error');
      setScanStepLabel('Error');
      setStatusMessage(`FM scan failed: ${normalized.message}`);
      pushDiagnosticEvent(`FM scan error [${normalized.code}]: ${normalized.message}`);
    } finally {
      setFrequency(originalFrequency);
      setFineFreq(originalFineFreq);
      setDemodMode(originalDemodMode);
      scanAbortRef.current = false;
    }
  };

  const toggleStream = async () => {
    if (isRunning) {
        // STOP
        scanAbortRef.current = true;
        setConnectionState('recovering');
        setStatusMessage('Stopping stream...');
        if (deviceRef.current) {
            await deviceRef.current.close();
            deviceRef.current = null;
        }
        workerRef.current?.postMessage({ command: 'STOP' });
        audioRef.current?.stop();
        setIsRunning(false);
        setGainStages([]); // Clear UI
        usbIqRmsRef.current = 0;
        usbIqMeanAbsRef.current = 0;
        usbTransferBytesRef.current = 0;
        usbTransferCountRef.current = 0;
        setUsbIqRms(0);
        setUsbIqMeanAbs(0);
        setUsbTransferBytes(0);
        setUsbTransferCount(0);
        setRdsTelemetry(emptyRdsTelemetry());
        setScanState('idle');
        setScanProgress(0);
        setScanStepLabel('Idle');
        setConnectionState('idle');
        setAudioState('suspended');
        setStatusMessage('Stream stopped.');
        pushDiagnosticEvent('Stream stopped by user.');
        setRuntimeTelemetry((prev) => ({ ...prev, renderFps: null, audioQueueAheadMs: 0 }));
    } else {
        // START
        setConnectionState('starting');
        setStatusMessage('Starting stream and opening selected source...');
        try {
            await audioRef.current?.start(); // Resume AudioContext
          audioRef.current?.resetStats();
            audioRef.current?.setMuted(isMuted);
            const state = audioRef.current?.getState();
            if (state !== 'running') {
                setAudioState('awaiting-user-gesture');
                setStatusMessage('Audio requires user gesture. Click Start again if blocked.');
            }

            let dev: ISDRDevice;
            switch (sourceType) {
                case 'HACKRF': dev = new HackRFDevice(); break;
                case 'RTLSDR': dev = new RtlSdrDevice(); break;
                case 'MOCK': default: dev = new MockDevice(); break;
            }

            await dev.open();
            deviceRef.current = dev;
            pushDiagnosticEvent(`${dev.name} opened.`);

            // Initialize Gain UI from Device Capabilities
            const stages = dev.getGainStages();
            setGainStages(stages);
            
            const initialGains: Record<string, number> = {};
            for (const stage of stages) {
                initialGains[stage.name] = stage.value;
            }
            setGains(initialGains);
    
            // Apply initial state to Device
            await dev.setFrequency(frequency);
            for (const stage of stages) {
                await dev.setGain(stage.name, stage.value);
            }
    
            // Start Worker
            workerRef.current?.postMessage({ command: 'START_USB_MODE' });
            workerRef.current?.postMessage({ command: 'SET_MODE', value: demodMode });
            workerRef.current?.postMessage({ command: 'SET_FINE_FREQ', value: fineFreq });

            usbIqRmsRef.current = 0;
            usbIqMeanAbsRef.current = 0;
            usbTransferBytesRef.current = 0;
            usbTransferCountRef.current = 0;
    
            // Start Stream
            dev.start((dataView) => {
              usbTransferBytesRef.current = dataView.byteLength;
              usbTransferCountRef.current += 1;

              const iqBytes = new Uint8Array(dataView.buffer, dataView.byteOffset, dataView.byteLength);
              const metricSampleSize = Math.min(iqBytes.length, 4096);

              if (metricSampleSize > 0) {
                let sumSq = 0;
                let sumAbs = 0;

                for (let i = 0; i < metricSampleSize; i++) {
                  const centered = iqBytes[i] - 127.5;
                  sumSq += centered * centered;
                  sumAbs += Math.abs(centered);
                }

                usbIqRmsRef.current = Math.sqrt(sumSq / metricSampleSize);
                usbIqMeanAbsRef.current = sumAbs / metricSampleSize;
              }

                const buf = dataView.buffer.slice(0); 
                workerRef.current?.postMessage({ 
                    type: 'USB_DATA', 
                    data: buf 
                }, [buf]); 
            });
    
            setIsRunning(true);
                        setConnectionState('streaming');
                        setAudioState(isMuted ? 'muted' : 'running');
                        setStatusMessage(`Streaming from ${dev.name}.`);
                        pushDiagnosticEvent(`Streaming started from ${dev.name}.`);
        } catch (e) {
            console.error("Failed to open device:", e);
          const err = normalizeDeviceError(e);

                        setConnectionState('error');
                        setAudioState('awaiting-user-gesture');
          setStatusMessage(err.message);
          pushDiagnosticEvent(`Stream start error [${err.code}]: ${err.message}`);
        }
    }
  };

    const toggleMute = () => {
        setIsMuted((prev) => {
            const nextMuted = !prev;
            audioRef.current?.setMuted(nextMuted);
            setAudioState(nextMuted ? 'muted' : 'running');
            setStatusMessage(nextMuted ? 'Audio muted.' : 'Audio unmuted.');
            pushDiagnosticEvent(nextMuted ? 'Audio muted by UI.' : 'Audio unmuted by UI.');
            return nextMuted;
        });
    };

    const exportDiagnostics = () => {
        const payload = {
            exportedAt: new Date().toISOString(),
            sourceType,
            frequency,
            demodMode,
            fineFreq,
            zoomLevel,
            waterfallPalette,
            waterfallAutoScale,
            waterfallMinDb,
            waterfallMaxDb,
            connectionState,
            audioState,
            muted: isMuted,
            gainStages,
            gains,
            runtimeTelemetry,
            fmScan: {
              state: scanState,
              progress: scanProgress,
              stepLabel: scanStepLabel,
              results: scanResults
            },
            statusMessage,
            events: diagnosticEvents
        };

        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `rad-io-diagnostics-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        pushDiagnosticEvent('Diagnostics bundle exported.');
    };

  const handleGainChange = (name: string, val: number) => {
      setGains(prev => ({ ...prev, [name]: val }));
  };

  const handleSpectrumClick = (binIndex: number) => {
    // FFT Size 2048
    // Bin 0 = -Fs/2 (-1MHz)
    // Bin 1024 = 0 (DC)
    // Bin 2047 = +Fs/2 (+1MHz)
    // Fs = 2_000_000
    
    // Offset from DC in bins
    const offsetBins = binIndex - 1024;
    // Offset in Hz
    // Bin Width = 2000000 / 2048 = 976.5625 Hz
    const offsetHz = offsetBins * (2_000_000 / 2048);
    
    // Update Fine Tune
    // Note: NCO Mix uses Positive frequency to shift DOWN.
    // If signal is at +200kHz, we want to shift it DOWN by 200kHz to reach DC.
    // So NCO Frequency should be +200kHz.
    // So logic is direct: fineFreq = offsetHz.
    
    setFineFreq(Math.round(offsetHz));
  };

    const healthItems = useMemo(() => {
      const items: Array<{ key: string; level: HealthLevel; label: string; recommendation: string }> = [];

      if (connectionState === 'error') {
        items.push({
          key: 'connection-error',
          level: 'error',
          label: 'Connection failed',
          recommendation: 'Retry stream start and export diagnostics if it repeats.'
        });
      } else if (connectionState === 'recovering') {
        items.push({
          key: 'connection-recovering',
          level: 'warn',
          label: 'Connection recovering',
          recommendation: 'Keep this tab active and reconnect the selected source.'
        });
      } else if (connectionState === 'streaming') {
        items.push({
          key: 'connection-ok',
          level: 'ok',
          label: 'Connection healthy',
          recommendation: 'No action required.'
        });
      }

      if (audioState === 'awaiting-user-gesture') {
        items.push({
          key: 'audio-gesture',
          level: 'warn',
          label: 'Audio needs user action',
          recommendation: 'Click Start again or unmute to resume playback.'
        });
      } else if (audioState === 'degraded') {
        items.push({
          key: 'audio-degraded',
          level: 'warn',
          label: 'Audio may be degraded',
          recommendation: 'Return to foreground and reduce zoom/load if stutter persists.'
        });
      } else if (audioState === 'running') {
        items.push({
          key: 'audio-running',
          level: 'ok',
          label: 'Audio running',
          recommendation: 'No action required.'
        });
      }

      if (connectionState === 'streaming' && fftData.length > 0) {
        const peakDb = fftData.reduce((max, value) => Math.max(max, value), -Infinity);
        if (peakDb > 1) {
          items.push({
            key: 'fft-saturated',
            level: 'warn',
            label: 'FFT scaling or clipping suspected',
            recommendation: 'Lower RF gain and verify DSP scaling if this persists above 0 dBFS.'
          });
        } else if (peakDb < -80) {
          items.push({
            key: 'weak-signal',
            level: 'warn',
            label: 'Weak or no signal detected',
            recommendation: 'Retune, increase gain, or verify antenna path.'
          });
        } else {
          items.push({
            key: 'signal-ok',
            level: 'ok',
            label: 'Signal energy detected',
            recommendation: 'Use click-to-tune for best channel alignment.'
          });
        }
      }

      if (runtimeTelemetry.audioUnderruns > 0) {
        items.push({
          key: 'audio-underruns',
          level: 'warn',
          label: `Audio underruns detected (${runtimeTelemetry.audioUnderruns})`,
          recommendation: 'Use Stable settings, lower sample load, or keep tab foregrounded.'
        });
      }

      if (runtimeTelemetry.renderFps !== null && runtimeTelemetry.renderFps < 45) {
        items.push({
          key: 'render-fps-low',
          level: 'warn',
          label: `Render cadence low (${runtimeTelemetry.renderFps.toFixed(1)} FPS)`,
          recommendation: 'Reduce zoom and keep only one heavy app active while monitoring.'
        });
      }

      return items;
    }, [audioState, connectionState, fftData, runtimeTelemetry.audioUnderruns, runtimeTelemetry.renderFps]);

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1 className="app-title">rad.io MVP Preview</h1>
        <div className={`status-pill status-${connectionState}`} aria-live="polite">
          Connection: {connectionState}
        </div>
      </header>

      <p className="status-text" aria-live="polite">{statusMessage}</p>
      <p className="status-subtext">Audio: {audioState} | Keyboard: Left/Right tune 1 kHz, M mute</p>
      
      <div className="visual-grid">
        <section className="panel panel-wide">
            <h2 className="panel-title">RF Waterfall</h2>
            <WaterfallCanvas
              data={fftData}
              minDb={waterfallMinDb}
              maxDb={waterfallMaxDb}
              zoom={zoomLevel}
              centerFrequencyHz={frequency}
              sampleRateHz={2_000_000}
              autoScale={waterfallAutoScale}
              palette={waterfallPalette}
            />
        </section>
        <section className="panel">
            <h2 className="panel-title">RF Spectrum (FFT)</h2>
            <SpectrumCanvas
              data={fftData}
              zoom={zoomLevel}
              onPointClick={handleSpectrumClick}
              centerFrequencyHz={frequency}
              sampleRateHz={2_000_000}
              tunedOffsetHz={fineFreq}
            />
        </section>
        <section className="panel">
            <h2 className="panel-title">Demod Audio (Scope)</h2>
            <AudioScopeCanvas samples={scopeData} sampleRateHz={50_000} />
        </section>
      </div>

      <div className="controls-shell">
        {/* Source Selector */}
        <div className="control-group">
            <label className="control-label">Source</label>
            <select 
                value={sourceType}
                onChange={(e) => setSourceType(e.target.value as 'MOCK' | 'HACKRF' | 'RTLSDR')}
                disabled={isRunning}
                className="control-input"
            >
                <option value="MOCK">Mock Source</option>
                <option value="HACKRF">HackRF One</option>
                <option value="RTLSDR">RTL-SDR (Exp)</option>
            </select>
        </div>

        {/* Connection Control */}
        <button 
            onClick={toggleStream}
            className={`action-btn ${isRunning ? 'btn-stop' : 'btn-start'}`}
        >
            {isRunning ? 'Stop' : 'Start'}
        </button>

        <button onClick={toggleMute} className="action-btn btn-secondary" disabled={!isRunning}>
          {isMuted ? 'Unmute' : 'Mute'}
        </button>

        <button onClick={exportDiagnostics} className="action-btn btn-secondary">
          Export Diagnostics
        </button>

        <button
          onClick={scanState === 'running' ? cancelFmBandScan : runFmBandScan}
          className="action-btn btn-secondary"
          disabled={!isRunning}
        >
          {scanState === 'running' ? 'Stop FM Scan' : 'Run FM Scan'}
        </button>

        <div className="control-group">
          <label className="control-label">Scan Progress</label>
          <div className="control-note">
            {scanStepLabel} ({Math.round(scanProgress * 100)}%)
          </div>
        </div>

        <div className="control-group">
            <label className="control-label">Zoom ({zoomLevel}x)</label>
            <input 
                type="range" min="1" max="8" step="1"
                value={zoomLevel}
                onChange={(e) => setZoomLevel(parseInt(e.target.value))}
                className="control-range"
            />
        </div>

        {/* Frequency Control */}
        <div className="control-group">
            <label className="control-label">Fine Tune ({fineFreq} Hz)</label>
            <input 
                type="range" min="-100000" max="100000" step="1000"
                value={fineFreq}
                onChange={(e) => setFineFreq(parseInt(e.target.value))}
                className="control-range"
            />
        </div>

        <div className="control-group">
            <label className="control-label">Mode</label>
            <select 
                value={demodMode}
                onChange={(e) => setDemodMode(e.target.value as 'WFM' | 'AM' | 'NFM')}
                className="control-input compact"
            >
                <option value="WFM">WFM</option>
                <option value="NFM">NFM</option>
                <option value="AM">AM</option>
            </select>
        </div>

        <div className="control-group">
          <label className="control-label">Waterfall Palette</label>
          <select
            value={waterfallPalette}
            onChange={(e) => setWaterfallPalette(e.target.value as 'cividis' | 'inferno')}
            className="control-input compact"
          >
            <option value="cividis">Cividis</option>
            <option value="inferno">Inferno</option>
          </select>
        </div>

        <div className="control-group">
          <label className="control-label">Waterfall Autoscale</label>
          <input
            type="checkbox"
            checked={waterfallAutoScale}
            onChange={(e) => setWaterfallAutoScale(e.target.checked)}
            className="control-check"
          />
        </div>

        {!waterfallAutoScale && (
          <>
          <div className="control-group">
            <label className="control-label">Waterfall Min ({waterfallMinDb} dB)</label>
            <input
              type="range" min="-140" max="-40" step="1"
              value={waterfallMinDb}
                    onChange={(e) => {
                      const nextMin = parseInt(e.target.value);
                      setWaterfallMinDb(Math.min(nextMin, waterfallMaxDb - 5));
                    }}
              className="control-range"
            />
          </div>

          <div className="control-group">
            <label className="control-label">Waterfall Max ({waterfallMaxDb} dB)</label>
            <input
              type="range" min="-100" max="10" step="1"
              value={waterfallMaxDb}
                    onChange={(e) => {
                      const nextMax = parseInt(e.target.value);
                      setWaterfallMaxDb(Math.max(nextMax, waterfallMinDb + 5));
                    }}
              className="control-range"
            />
          </div>
          </>
        )}

        <div className="control-group">
            <label className="control-label">Frequency (MHz)</label>
            <input 
                type="number" 
                value={(frequency / 1_000_000).toFixed(3)}
                onChange={(e) => setFrequency(Math.floor(parseFloat(e.target.value) * 1_000_000))}
                className="control-input compact"
                step="0.1"
            />
        </div>

        {/* Dynamic Gain Controls */}
        {gainStages.map(stage => (
            <div key={stage.name} className="control-group">
                <label className="control-label">{stage.label}: {gains[stage.name]} dB</label>
                <input 
                    type="range" 
                    min={stage.min} 
                    max={stage.max} 
                    step={stage.step}
                    value={gains[stage.name] || 0}
                    onChange={(e) => handleGainChange(stage.name, parseInt(e.target.value))}
                    className="control-range"
                />
            </div>
        ))}
        {gainStages.length === 0 && isRunning && (
            <div className="control-note">No gain controls available for this source.</div>
        )}
      </div>

      <details className="diagnostics-log">
        <summary>Recent Diagnostic Events ({diagnosticEvents.length})</summary>
        <ul>
          {diagnosticEvents.slice(0, 12).map((event, idx) => (
            <li key={`${event}-${idx}`}>{event}</li>
          ))}
        </ul>
      </details>

      <section className="health-panel" aria-live="polite">
        <h2 className="panel-title">Health Checks</h2>
        <ul>
          {healthItems.length === 0 ? (
            <li className="health-item health-ok">Waiting for active stream diagnostics.</li>
          ) : (
            healthItems.map((item) => (
              <li key={item.key} className={`health-item health-${item.level}`}>
                <strong>{item.label}</strong>
                <span>{item.recommendation}</span>
              </li>
            ))
          )}
        </ul>
      </section>

      <section className="health-panel" aria-live="polite">
        <h2 className="panel-title">Runtime Metrics</h2>
        <ul>
          <li className="health-item health-ok">
            <strong>Render FPS</strong>
            <span>{runtimeTelemetry.renderFps === null ? 'n/a' : runtimeTelemetry.renderFps.toFixed(1)}</span>
          </li>
          <li className={`health-item ${runtimeTelemetry.audioUnderruns > 0 ? 'health-warn' : 'health-ok'}`}>
            <strong>Audio Underruns</strong>
            <span>{runtimeTelemetry.audioUnderruns}</span>
          </li>
          <li className={`health-item ${runtimeTelemetry.audioQueueAheadMs > 250 ? 'health-warn' : 'health-ok'}`}>
            <strong>Audio Queue Ahead</strong>
            <span>{runtimeTelemetry.audioQueueAheadMs.toFixed(1)} ms</span>
          </li>
        </ul>
      </section>

      <section className="health-panel" aria-live="polite">
        <h2 className="panel-title">RDS Metadata</h2>
        <ul>
          <li className={`health-item ${rdsTelemetry.synced ? 'health-ok' : 'health-warn'}`}>
            <strong>Sync</strong>
            <span>{rdsTelemetry.synced ? `locked (${rdsTelemetry.totalGroups} groups)` : 'searching'}</span>
          </li>
          <li className="health-item health-ok">
            <strong>Program Service</strong>
            <span>{rdsTelemetry.ps || 'n/a'}</span>
          </li>
          <li className="health-item health-ok">
            <strong>Callsign Candidate</strong>
            <span>{rdsTelemetry.callsignCandidate || 'n/a'}</span>
          </li>
          <li className="health-item health-ok">
            <strong>PI / PTY</strong>
            <span>{rdsTelemetry.piCode === null ? 'n/a' : `0x${rdsTelemetry.piCode.toString(16).toUpperCase()}`} / {rdsTelemetry.ptyName || 'n/a'}</span>
          </li>
          <li className="health-item health-ok">
            <strong>Traffic Flags</strong>
            <span>TP {rdsTelemetry.tp ? '1' : '0'} | TA {rdsTelemetry.ta ? '1' : '0'}</span>
          </li>
          <li className="health-item health-ok">
            <strong>Radiotext</strong>
            <span>{rdsTelemetry.radiotext || 'n/a'}</span>
          </li>
        </ul>
      </section>

      <section className="health-panel" aria-live="polite">
        <h2 className="panel-title">FM Scan Results</h2>
        <ul>
          {scanResults.length === 0 ? (
            <li className="health-item health-ok">No scan candidates yet. Start streaming, then run FM Scan.</li>
          ) : (
            scanResults.map((result) => (
              <li key={`${result.frequencyHz}-${result.scannedAt}`} className="health-item health-ok">
                <strong>{(result.frequencyHz / 1_000_000).toFixed(1)} MHz</strong>
                <span>
                  {result.measurement.quality} | prominence {result.measurement.prominenceDb.toFixed(1)} dB | RDS {result.measurement.rdsSynced ? 'lock' : 'none'}
                  {result.ps ? ` | ${result.ps}` : ''}
                  {result.callsignCandidate ? ` | ${result.callsignCandidate}` : ''}
                </span>
                <button
                  className="action-btn btn-secondary"
                  onClick={() => {
                    setFrequency(result.frequencyHz);
                    setFineFreq(0);
                    setDemodMode('WFM');
                    setStatusMessage(`Tuned to ${(result.frequencyHz / 1_000_000).toFixed(1)} MHz from FM scan results.`);
                    pushDiagnosticEvent(`Tuned to scan result ${(result.frequencyHz / 1_000_000).toFixed(1)} MHz.`);
                  }}
                >
                  Tune
                </button>
              </li>
            ))
          )}
        </ul>
      </section>
    </div>
  );
}
