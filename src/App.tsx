import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
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
import { FileDevice } from './devices/FileDevice';
import { ISDRDevice, SDRGainStage } from './devices/ISDRDevice';
import { normalizeDeviceError } from './devices/errors';
import type { SDRStreamFrame } from './devices/streamFrame';
import { goldenToneFixtureBundle } from './fixtures/sigmf/goldenToneFixture';
import { createAnalyzerArtifactExport } from './dsp/analyzerArtifactExport';
import { createMeasurementCalibrationDisclosure } from './measurements/disclosure';
import { appendDiscontinuityTimelineEntry, type DiscontinuityTimelineEntry } from './measurements/discontinuityTimeline';
import { createRfAudioTimebaseAlignmentSnapshot } from './measurements/rfAudioTimebaseAlignment';
import { createFixtureInteropExportBundle } from './fixtures/sigmf/interopExport';
import { WorkerBridge } from './dsp/WorkerBridge';
import type { FilterProfile, InterferencePreset } from './dsp/AudioPostProcessor';
import type { DemodMode, DemodQualityMetrics, LockState } from './dsp/DemodMetrics';
import {
  MODE_CONTROL_CONTRACTS,
  clampFilterForMode,
  clampFineTuneHz,
  lockStateLabel,
  maxFineTuneHzForFilter
} from './dsp/controlGuardrails';
import {
  createDefaultRuntimeDspTelemetry,
  createDefaultRuntimeTelemetry,
  type RuntimeDspTelemetryV1,
  type RuntimeTelemetryV1
} from './telemetry/runtimeTelemetryContract';

type ConnectionState = 'idle' | 'starting' | 'streaming' | 'recovering' | 'error';
type AudioState = 'suspended' | 'awaiting-user-gesture' | 'running' | 'degraded' | 'muted';
type ScanState = 'idle' | 'running' | 'completed' | 'cancelled' | 'error';
type HealthLevel = 'ok' | 'warn' | 'error';
type RuntimeTelemetry = RuntimeTelemetryV1;

type DspFilterState = {
  lowCutHz: number;
  highCutHz: number;
  profile: FilterProfile;
  preset: InterferencePreset;
};

type DemodQualityState = {
  lockState: LockState;
  quality: number;
  snrEstimateDb: number;
  pilotLevel: number;
  carrierLevel: number;
  deviationEstimate: number;
};

type SourceType = 'MOCK' | 'HACKRF' | 'RTLSDR' | 'FILE';

type RuntimePrerequisites = {
  secureContext: boolean;
  webUsbAvailable: boolean;
  crossOriginIsolated: boolean;
};

type PermissionStateValue = 'granted' | 'denied' | 'prompt' | 'unknown';

type RuntimePermissionState = {
  usb: PermissionStateValue;
  microphone: PermissionStateValue;
};

type RuntimeEnvironment = {
  browserName: 'chrome' | 'edge' | 'other';
  browserVersion: string;
  osFamily: 'windows' | 'macos' | 'linux' | 'other';
  sharedArrayBufferAvailable: boolean;
  audioWorkletAvailable: boolean;
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
  sourceType: SourceType;
  connectionState: ConnectionState;
  audioState: AudioState;
  frequencyHz: number;
  demodMode: 'WFM' | 'AM' | 'NFM';
  demodQuality: DemodQualityState;
  filterState: DspFilterState;
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

const fnv1a32 = (bytes: Uint8Array): number => {
  let hash = 0x811c9dc5;

  for (let i = 0; i < bytes.length; i += 1) {
    hash ^= bytes[i];
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }

  return hash >>> 0;
};

const copyDataViewToArrayBuffer = (view: DataView): ArrayBuffer => {
  const copied = new Uint8Array(view.byteLength);
  copied.set(new Uint8Array(view.buffer, view.byteOffset, view.byteLength));
  return copied.buffer;
};

const decodeSignedCi8Byte = (value: number): number => (value < 128 ? value : value - 256);

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

const defaultFilterStateForMode = (mode: DemodMode): DspFilterState => {
  const contract = MODE_CONTROL_CONTRACTS[mode];

  return {
    lowCutHz: contract.defaultLowCutHz,
    highCutHz: contract.defaultHighCutHz,
    profile: contract.defaultFilterProfile,
    preset: contract.defaultInterferencePreset
  };
};

const emptyDemodQuality = (): DemodQualityState => ({
  lockState: 'searching',
  quality: 0,
  snrEstimateDb: -60,
  pilotLevel: 0,
  carrierLevel: 0,
  deviationEstimate: 0
});

const detectRuntimePrerequisites = (): RuntimePrerequisites => {
  const secureContext = typeof window !== 'undefined' && window.isSecureContext;
  const crossOriginIsolated = typeof window !== 'undefined' && window.crossOriginIsolated;
  const webUsbAvailable = typeof navigator !== 'undefined' && 'usb' in navigator;

  return {
    secureContext,
    webUsbAvailable,
    crossOriginIsolated
  };
};

const detectRuntimeEnvironment = (): RuntimeEnvironment => {
  const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '';

  const browserName: RuntimeEnvironment['browserName'] = userAgent.includes('Edg/')
    ? 'edge'
    : userAgent.includes('Chrome/')
      ? 'chrome'
      : 'other';

  let browserVersion = 'unknown';
  if (browserName === 'edge') {
    browserVersion = userAgent.match(/Edg\/([\d.]+)/)?.[1] ?? 'unknown';
  } else if (browserName === 'chrome') {
    browserVersion = userAgent.match(/Chrome\/([\d.]+)/)?.[1] ?? 'unknown';
  }

  const osFamily: RuntimeEnvironment['osFamily'] = userAgent.includes('Windows')
    ? 'windows'
    : userAgent.includes('Mac OS X')
      ? 'macos'
      : userAgent.includes('Linux')
        ? 'linux'
        : 'other';

  return {
    browserName,
    browserVersion,
    osFamily,
    sharedArrayBufferAvailable: typeof SharedArrayBuffer === 'function',
    audioWorkletAvailable: typeof AudioWorkletNode !== 'undefined'
  };
};

const unknownPermissionState = (): RuntimePermissionState => ({
  usb: 'unknown',
  microphone: 'unknown'
});

const queryPermissionState = async (name: 'usb' | 'microphone'): Promise<PermissionStateValue> => {
  if (typeof navigator === 'undefined' || !navigator.permissions?.query) {
    return 'unknown';
  }

  try {
    const result = await navigator.permissions.query({ name: name as PermissionName });
    return result.state;
  } catch {
    return 'unknown';
  }
};

declare global {
  interface Window {
    __radIoDebug?: {
      getSnapshot: () => RadioDebugSnapshot;
    };
  }
}

export default function App() {
  const runtimePrerequisites = useMemo(() => detectRuntimePrerequisites(), []);
  const runtimeEnvironment = useMemo(() => detectRuntimeEnvironment(), []);
  const [isRunning, setIsRunning] = useState(false);
  const [sourceType, setSourceType] = useState<SourceType>('MOCK');
  const [fftData, setFftData] = useState<Float32Array>(new Float32Array(2048));
  const [scopeData, setScopeData] = useState<Float32Array>(new Float32Array(256));
  
  const [frequency, setFrequency] = useState<number>(90_000_000);
  // Gains: Map<StageName, Value>
  const [gains, setGains] = useState<Record<string, number>>({});
  const [gainStages, setGainStages] = useState<SDRGainStage[]>([]);

  const [demodMode, setDemodMode] = useState<DemodMode>('WFM');
  const [fineFreq, setFineFreq] = useState<number>(0);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
    const [isMuted, setIsMuted] = useState(true);
    const [audioOutputLevel, setAudioOutputLevel] = useState(MODE_CONTROL_CONTRACTS.WFM.defaultOutputLevel);
    const [audioMaxOutputLevel, setAudioMaxOutputLevel] = useState(MODE_CONTROL_CONTRACTS.WFM.defaultMaxOutputLevel);
    const [applyModeAudioDefaults, setApplyModeAudioDefaults] = useState(true);
    const [waterfallPalette, setWaterfallPalette] = useState<'cividis' | 'inferno'>('cividis');
    const [waterfallAutoScale, setWaterfallAutoScale] = useState(true);
    const [waterfallMinDb, setWaterfallMinDb] = useState(-125);
    const [waterfallMaxDb, setWaterfallMaxDb] = useState(-35);

    const [connectionState, setConnectionState] = useState<ConnectionState>('idle');
    const [audioState, setAudioState] = useState<AudioState>('suspended');
    const [statusMessage, setStatusMessage] = useState('Ready. Select a source and start streaming.');
    const [diagnosticEvents, setDiagnosticEvents] = useState<string[]>([]);
    const [runtimeTelemetry, setRuntimeTelemetry] = useState<RuntimeTelemetry>(createDefaultRuntimeTelemetry('direct'));
    const [filterState, setFilterState] = useState<DspFilterState>(() => defaultFilterStateForMode('WFM'));
    const [demodQuality, setDemodQuality] = useState<DemodQualityState>(emptyDemodQuality);
    const [usbIqRms, setUsbIqRms] = useState(0);
    const [usbIqMeanAbs, setUsbIqMeanAbs] = useState(0);
    const [usbTransferBytes, setUsbTransferBytes] = useState(0);
    const [usbTransferCount, setUsbTransferCount] = useState(0);
    const [streamSampleRateHz, setStreamSampleRateHz] = useState(2_000_000);
    const [rdsTelemetry, setRdsTelemetry] = useState<RdsTelemetry>(emptyRdsTelemetry);
    const [scanState, setScanState] = useState<ScanState>('idle');
    const [scanProgress, setScanProgress] = useState(0);
    const [scanStepLabel, setScanStepLabel] = useState('Idle');
    const [scanResults, setScanResults] = useState<FmScanResult[]>([]);
    const [permissionState, setPermissionState] = useState<RuntimePermissionState>(unknownPermissionState());
  
  const workerRef = useRef<Worker | null>(null);
  const workerBridgeRef = useRef<WorkerBridge | null>(null);
  const deviceRef = useRef<ISDRDevice | null>(null);
  const audioRef = useRef<AudioSink | null>(null);
  const usbIqRmsRef = useRef(0);
  const usbIqMeanAbsRef = useRef(0);
  const usbTransferBytesRef = useRef(0);
  const usbTransferCountRef = useRef(0);
  const fftDataRef = useRef<Float32Array>(new Float32Array(2048));
  const rdsTelemetryRef = useRef<RdsTelemetry>(emptyRdsTelemetry());
  const scanAbortRef = useRef(false);
  const streamSessionStartedAtRef = useRef<Date | null>(null);
  const discontinuityTimelineRef = useRef<DiscontinuityTimelineEntry[]>([]);
  const streamSampleRateHzRef = useRef(2_000_000);

    const pushDiagnosticEvent = useCallback((message: string) => {
        const timestamp = new Date().toISOString();
        setDiagnosticEvents((prev) => [`${timestamp} ${message}`, ...prev].slice(0, 100));
    }, []);

    const refreshPermissionState = useCallback(async () => {
      const [usb, microphone] = await Promise.all([
        queryPermissionState('usb'),
        queryPermissionState('microphone')
      ]);
      setPermissionState({ usb, microphone });
    }, []);

    const tryResumeAudio = useCallback(async (reason: 'startup' | 'user-action' | 'visibility') => {
      try {
        await audioRef.current?.start();
        const state = audioRef.current?.getState();

        if (state === 'running') {
          const resolvedAudioState: AudioState = isMuted ? 'muted' : 'running';
          setAudioState(resolvedAudioState);
          if (reason !== 'startup') {
            setStatusMessage(resolvedAudioState === 'muted' ? 'Audio resumed (muted).' : 'Audio resumed.');
          }
          pushDiagnosticEvent(`Audio resume succeeded (${reason}).`);
          return true;
        }

        setAudioState('awaiting-user-gesture');
        setStatusMessage('Audio requires user gesture. Use Enable Audio.');
        pushDiagnosticEvent(`Audio resume blocked (${reason}); user gesture required.`);
        return false;
      } catch {
        setAudioState('awaiting-user-gesture');
        setStatusMessage('Audio start blocked by browser policy. Use Enable Audio.');
        pushDiagnosticEvent(`Audio resume threw (${reason}); user gesture required.`);
        return false;
      }
    }, [isMuted, pushDiagnosticEvent]);

  const postToWorker = useCallback((message: unknown, transfer: Transferable[] = []) => {
    workerBridgeRef.current?.postMessage(message, transfer);
  }, []);

  useEffect(() => {
    workerRef.current = new Worker(new URL('./dsp/worker.ts', import.meta.url), { type: 'module' });
    const fallbackMode = !runtimePrerequisites.crossOriginIsolated || !runtimeEnvironment.sharedArrayBufferAvailable;
    workerBridgeRef.current = new WorkerBridge(workerRef.current, {
      preferMessageChannelFallback: fallbackMode
    });
    audioRef.current = new AudioSink(50000); // 50k from worker
    audioRef.current.setMuted(true);
    audioRef.current.setOutputLevel(MODE_CONTROL_CONTRACTS.WFM.defaultOutputLevel);
    audioRef.current.setMaxOutputLevel(MODE_CONTROL_CONTRACTS.WFM.defaultMaxOutputLevel);
    audioRef.current.setSafetyConfig({ maxOutputLevel: MODE_CONTROL_CONTRACTS.WFM.defaultMaxOutputLevel });

    setRuntimeTelemetry((prev) => ({
      ...prev,
      workerTransportMode: workerBridgeRef.current?.getMode() ?? 'direct'
    }));
    pushDiagnosticEvent(`Worker transport mode: ${workerBridgeRef.current?.getMode() ?? 'direct'}.`);

    workerRef.current.onmessage = (e) => {
      if (e.data.type === 'FFT_DATA') {
        setFftData(e.data.data);
      } else if (e.data.type === 'SCOPE_DATA') {
        setScopeData(e.data.data);
      } else if (e.data.type === 'AUDIO_DATA') {
        const audioData = new Float32Array(e.data.data as ArrayBuffer);
        audioRef.current?.push(audioData);
      } else if (e.data.type === 'FILTER_STATE') {
        const state = e.data.data as DspFilterState;
        setFilterState(state);
      } else if (e.data.type === 'DEMOD_METRICS') {
        const metrics = e.data.data as DemodQualityMetrics;
        setDemodQuality({
          lockState: metrics.lockState,
          quality: metrics.quality,
          snrEstimateDb: metrics.snrEstimateDb,
          pilotLevel: metrics.pilotLevel,
          carrierLevel: metrics.carrierLevel,
          deviationEstimate: metrics.deviationEstimate
        });
      } else if (e.data.type === 'DSP_TELEMETRY') {
        const telemetry = e.data.data as RuntimeDspTelemetryV1;
        setRuntimeTelemetry((prev) => ({
          ...prev,
          dsp: telemetry
        }));
      } else if (e.data.type === 'RDS_DATA') {
        setRdsTelemetry(e.data.data as RdsTelemetry);
      } else if (e.data.type === 'STREAM_FRAME_META') {
        const frame = e.data.data as SDRStreamFrame;
        const isDropEvent = frame.discontinuity?.cause === 'dropped_samples' || frame.droppedSamples > 0;

        discontinuityTimelineRef.current = appendDiscontinuityTimelineEntry(
          discontinuityTimelineRef.current,
          frame,
          streamSessionStartedAtRef.current?.valueOf() ?? null
        );

        setRuntimeTelemetry((prev) => ({
          ...prev,
          streamDiscontinuities: frame.discontinuity ? prev.streamDiscontinuities + 1 : prev.streamDiscontinuities,
          droppedFrameEvents: isDropEvent ? prev.droppedFrameEvents + 1 : prev.droppedFrameEvents,
          totalDroppedSamples: prev.totalDroppedSamples + Math.max(0, frame.droppedSamples),
          lastDiscontinuityCause: frame.discontinuity?.cause ?? prev.lastDiscontinuityCause,
          lastFrameSequence: frame.sequence,
          lastFrameSampleIndex: frame.sampleIndex,
          lastFrameTimestampNs: frame.timestampNs,
          lastFrameSampleRate: frame.sampleRate,
          lastFrameWallClockMs: frame.discontinuity?.wallClockMs ?? prev.lastFrameWallClockMs,
          lastClockTruthMode: frame.sampleClock?.truthMode ?? prev.lastClockTruthMode
        }));
      }
    };

        pushDiagnosticEvent('DSP worker initialized.');

    return () => {
        workerBridgeRef.current?.dispose();
        workerBridgeRef.current = null;
        workerRef.current?.terminate();
        workerRef.current = null;
        audioRef.current?.stop();
        audioRef.current = null;
    };
  }, [pushDiagnosticEvent, runtimeEnvironment.sharedArrayBufferAvailable, runtimePrerequisites.crossOriginIsolated]);

    useEffect(() => {
      void refreshPermissionState();
    }, [refreshPermissionState]);

    useEffect(() => {
        const onVisibilityChange = () => {
            if (!isRunning) return;

            if (document.visibilityState === 'hidden') {
                setAudioState('degraded');
                setStatusMessage('Tab is in the background. Audio timing may degrade.');
                pushDiagnosticEvent('Page hidden while streaming; degraded audio state flagged.');
            } else {
              void (async () => {
                await tryResumeAudio('visibility');
              })();
              void refreshPermissionState();
              setStatusMessage('Streaming restored in foreground.');
                pushDiagnosticEvent('Page returned to foreground.');
            }
        };

        document.addEventListener('visibilitychange', onVisibilityChange);
        return () => document.removeEventListener('visibilitychange', onVisibilityChange);
    }, [isRunning, refreshPermissionState, pushDiagnosticEvent, tryResumeAudio]);

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
            audioQueueAheadMs: stats.queueAheadMs,
            audioConcealmentEvents: stats.concealmentEvents,
            audioPopSuppressionEvents: stats.popSuppressionEvents,
            audioLimiterEvents: stats.limiterEvents
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
          demodQuality,
          filterState,
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
    }, [audioState, connectionState, demodMode, demodQuality, fftData, filterState, frequency, isRunning, rdsTelemetry, runtimeTelemetry, scopeData, sourceType, usbIqMeanAbs, usbIqRms, usbTransferBytes, usbTransferCount]);

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
                  setAudioState(nextMuted ? 'muted' : isRunning ? 'running' : audioState);
                    setStatusMessage(nextMuted ? 'Audio muted.' : 'Audio unmuted.');
                    pushDiagnosticEvent(nextMuted ? 'Audio muted by keyboard.' : 'Audio unmuted by keyboard.');
                    return nextMuted;
                });
            }

                if (event.key === 'p' || event.key === 'P') {
                  event.preventDefault();
                  setIsMuted(true);
                  audioRef.current?.setMuted(true);
                  setAudioState('muted');
                  setStatusMessage('Panic mute engaged.');
                  pushDiagnosticEvent('Panic mute engaged by keyboard.');
                }

            if (event.key === 'ArrowRight') {
                event.preventDefault();
                setFrequency((prev) => prev + 1_000);
            }

            if (event.key === 'ArrowLeft') {
                event.preventDefault();
                setFrequency((prev) => Math.max(0, prev - 1_000));
            }

            if (event.key === 'ArrowUp') {
              event.preventDefault();
              setFineFreq((prev) => clampFineTuneHz(prev + 1_000, filterState.highCutHz));
            }

            if (event.key === 'ArrowDown') {
              event.preventDefault();
              setFineFreq((prev) => clampFineTuneHz(prev - 1_000, filterState.highCutHz));
            }
        };

        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [audioState, filterState.highCutHz, isRunning, pushDiagnosticEvent]);

  // Update Device Frequency when controls change
  useEffect(() => {
    if (deviceRef.current && isRunning) {
        deviceRef.current.setFrequency(frequency);
        postToWorker({ command: 'RESET_RDS' });
    }
  }, [frequency, isRunning, postToWorker]);

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
    postToWorker({ command: 'SET_MODE', value: demodMode });
    const modeDefaults = defaultFilterStateForMode(demodMode);
    setFilterState(modeDefaults);

    if (applyModeAudioDefaults) {
      const contract = MODE_CONTROL_CONTRACTS[demodMode];
      setAudioOutputLevel(contract.defaultOutputLevel);
      setAudioMaxOutputLevel(contract.defaultMaxOutputLevel);
      pushDiagnosticEvent(`Applied ${demodMode} audio defaults for safe monitoring.`);
    }
  }, [applyModeAudioDefaults, demodMode, postToWorker, pushDiagnosticEvent]);

  useEffect(() => {
    const clamped = clampFilterForMode(demodMode, filterState.lowCutHz, filterState.highCutHz);
    if (clamped.lowCutHz !== filterState.lowCutHz || clamped.highCutHz !== filterState.highCutHz) {
      setFilterState((prev) => ({
        ...prev,
        lowCutHz: clamped.lowCutHz,
        highCutHz: clamped.highCutHz
      }));
    }
  }, [demodMode, filterState.highCutHz, filterState.lowCutHz]);

  const maxFineTuneHz = useMemo(
    () => maxFineTuneHzForFilter(filterState.highCutHz),
    [filterState.highCutHz]
  );

  useEffect(() => {
    setFineFreq((prev) => clampFineTuneHz(prev, filterState.highCutHz));
  }, [filterState.highCutHz]);

  // Update Fine Freq
  useEffect(() => {
    postToWorker({ command: 'SET_FINE_FREQ', value: fineFreq });
  }, [fineFreq, postToWorker]);

  useEffect(() => {
    audioRef.current?.setOutputLevel(audioOutputLevel);
  }, [audioOutputLevel]);

  useEffect(() => {
    audioRef.current?.setMaxOutputLevel(audioMaxOutputLevel);
    audioRef.current?.setSafetyConfig({ maxOutputLevel: audioMaxOutputLevel });
  }, [audioMaxOutputLevel]);

  useEffect(() => {
    postToWorker({
      command: 'SET_FILTER_CONFIG',
      lowCutHz: filterState.lowCutHz,
      highCutHz: filterState.highCutHz
    });
  }, [filterState.highCutHz, filterState.lowCutHz, postToWorker]);

  useEffect(() => {
    postToWorker({ command: 'SET_FILTER_PROFILE', value: filterState.profile });
  }, [filterState.profile, postToWorker]);

  useEffect(() => {
    postToWorker({ command: 'SET_INTERFERENCE_PRESET', value: filterState.preset });
  }, [filterState.preset, postToWorker]);

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
        postToWorker({ command: 'STOP' });
        audioRef.current?.stop();
        setIsRunning(false);
        streamSampleRateHzRef.current = 2_000_000;
        setStreamSampleRateHz(2_000_000);
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
        setRuntimeTelemetry((prev) => ({
          ...prev,
          renderFps: null,
          audioQueueAheadMs: 0,
          audioLimiterEvents: 0,
          audioConcealmentEvents: 0,
          audioPopSuppressionEvents: 0,
          droppedFrameEvents: 0,
          totalDroppedSamples: 0,
          lastDiscontinuityCause: null,
          lastFrameSequence: null,
          lastFrameSampleIndex: null,
          lastFrameTimestampNs: null,
          lastFrameSampleRate: null,
          lastFrameWallClockMs: null,
          lastClockTruthMode: null,
          dsp: createDefaultRuntimeDspTelemetry(),
          streamDiscontinuities: 0
        }));
        streamSessionStartedAtRef.current = null;
    } else {
        // START
        setConnectionState('starting');
        setStatusMessage('Starting stream and opening selected source...');
        try {
            await tryResumeAudio('startup');
          audioRef.current?.resetStats();
            audioRef.current?.setMuted(isMuted);
            audioRef.current?.setOutputLevel(audioOutputLevel);
            audioRef.current?.setMaxOutputLevel(audioMaxOutputLevel);
            audioRef.current?.setSafetyConfig({ maxOutputLevel: audioMaxOutputLevel });
            const state = audioRef.current?.getState();
            if (state !== 'running') {
                setAudioState('awaiting-user-gesture');
                setStatusMessage('Audio requires user gesture. Use Enable Audio if blocked.');
            }

            let dev: ISDRDevice;
            switch (sourceType) {
                case 'HACKRF': dev = new HackRFDevice(); break;
                case 'RTLSDR': dev = new RtlSdrDevice(); break;
              case 'FILE': dev = new FileDevice(goldenToneFixtureBundle); break;
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
            await dev.setSampleRate(streamSampleRateHzRef.current);
            await dev.setFrequency(frequency);
            for (const stage of stages) {
                await dev.setGain(stage.name, stage.value);
            }
    
            // Start Worker
            postToWorker({ command: 'START_USB_MODE' });
            postToWorker({ command: 'SET_MODE', value: demodMode });
            postToWorker({ command: 'SET_FINE_FREQ', value: fineFreq });

            usbIqRmsRef.current = 0;
            usbIqMeanAbsRef.current = 0;
            usbTransferBytesRef.current = 0;
            usbTransferCountRef.current = 0;
            streamSessionStartedAtRef.current = new Date();
            discontinuityTimelineRef.current = [];
            setRuntimeTelemetry((prev) => ({
              ...prev,
              lowFpsEvents: 0,
              audioLimiterEvents: 0,
              audioConcealmentEvents: 0,
              audioPopSuppressionEvents: 0,
              streamDiscontinuities: 0,
              droppedFrameEvents: 0,
              totalDroppedSamples: 0,
              lastDiscontinuityCause: null,
              lastFrameSequence: null,
              lastFrameSampleIndex: null,
              lastFrameTimestampNs: null,
              lastFrameSampleRate: null,
              lastFrameWallClockMs: null,
              lastClockTruthMode: null,
              dsp: createDefaultRuntimeDspTelemetry()
            }));
    
            // Start Stream
            void dev.start((dataView, frame) => {
              usbTransferBytesRef.current = dataView.byteLength;
              usbTransferCountRef.current += 1;

              const iqBytes = new Uint8Array(dataView.buffer, dataView.byteOffset, dataView.byteLength);
              const metricSampleSize = Math.min(iqBytes.length, 4096);

              if (metricSampleSize > 0) {
                let sumSq = 0;
                let sumAbs = 0;

                for (let i = 0; i < metricSampleSize; i++) {
                  const centered = decodeSignedCi8Byte(iqBytes[i]);
                  sumSq += centered * centered;
                  sumAbs += Math.abs(centered);
                }

                usbIqRmsRef.current = Math.sqrt(sumSq / metricSampleSize);
                usbIqMeanAbsRef.current = sumAbs / metricSampleSize;
              }

              if (frame) {
                if (frame.sampleRate !== streamSampleRateHzRef.current) {
                  streamSampleRateHzRef.current = frame.sampleRate;
                  setStreamSampleRateHz(frame.sampleRate);
                  postToWorker({ command: 'SET_SAMPLE_RATE', value: frame.sampleRate });
                }

                postToWorker({
                  type: 'STREAM_FRAME',
                  frame
                });
              }

                const buf = copyDataViewToArrayBuffer(dataView);
                const transportMode = workerBridgeRef.current?.getMode() ?? 'direct';
                if (transportMode === 'message-channel') {
                  postToWorker({
                    type: 'USB_DATA',
                    data: buf
                  });
                } else {
                  postToWorker({
                    type: 'USB_DATA',
                    data: buf
                  }, [buf]);
                }
              }).catch(async (streamError) => {
                if (deviceRef.current !== dev) {
                  return;
                }

                console.error('Stream loop failed:', streamError);
                const streamErr = normalizeDeviceError(streamError);

                postToWorker({ command: 'STOP' });
                setIsRunning(false);
                setConnectionState('error');
                setAudioState('awaiting-user-gesture');
                setStatusMessage(`Stream failed: ${streamErr.message}`);
                pushDiagnosticEvent(`Stream runtime error [${streamErr.code}]: ${streamErr.message}`);

                try {
                  await dev.close();
                } catch (closeError) {
                  console.debug('Cleanup after stream failure raised an error:', closeError);
                }

                if (deviceRef.current === dev) {
                  deviceRef.current = null;
                }
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

    const panicMute = (trigger: 'ui' | 'keyboard-shortcut') => {
      setIsMuted(true);
      audioRef.current?.setMuted(true);
      setAudioState('muted');
      setStatusMessage('Panic mute engaged.');
      pushDiagnosticEvent(`Panic mute engaged by ${trigger}.`);
    };

    const toggleMute = () => {
        setIsMuted((prev) => {
            const nextMuted = !prev;
            audioRef.current?.setMuted(nextMuted);
        setAudioState(nextMuted ? 'muted' : isRunning ? 'running' : audioState);
            setStatusMessage(nextMuted ? 'Audio muted.' : 'Audio unmuted.');
            pushDiagnosticEvent(nextMuted ? 'Audio muted by UI.' : 'Audio unmuted by UI.');
            return nextMuted;
        });
    };

    const exportDiagnostics = async () => {
        const latestPermissionState: RuntimePermissionState = {
          usb: await queryPermissionState('usb'),
          microphone: await queryPermissionState('microphone')
        };
        setPermissionState(latestPermissionState);

        const activeFixtureMetadata = sourceType === 'FILE'
          ? (deviceRef.current instanceof FileDevice ? deviceRef.current.getFixtureMetadata() : goldenToneFixtureBundle.metadata)
          : undefined;
        const calibrationDisclosure = createMeasurementCalibrationDisclosure(activeFixtureMetadata);
        const analyzerArtifact = createAnalyzerArtifactExport({
          sourceType,
          demodMode,
          tunedFrequencyHz: frequency,
          fineTuneHz: fineFreq,
          fftSize: fftDataRef.current.length,
          sampleRateHzHint: streamSampleRateHz,
          zoomLevel,
          waterfallPalette,
          waterfallAutoScale,
          waterfallMinDb,
          waterfallMaxDb
        });
        const interopFixtureExport = sourceType === 'FILE'
          ? createFixtureInteropExportBundle(goldenToneFixtureBundle)
          : null;

        const sessionStartedAtIso = streamSessionStartedAtRef.current?.toISOString() ?? null;
        const sessionStartedUnixMs = streamSessionStartedAtRef.current?.valueOf() ?? null;
        const timebaseAlignment = createRfAudioTimebaseAlignmentSnapshot({
          streamSessionStartedUnixMs: sessionStartedUnixMs,
          exportUnixMs: Date.now(),
          lastFrameSequence: runtimeTelemetry.lastFrameSequence,
          lastFrameSampleIndex: runtimeTelemetry.lastFrameSampleIndex,
          lastFrameTimestampNs: runtimeTelemetry.lastFrameTimestampNs,
          lastFrameSampleRate: runtimeTelemetry.lastFrameSampleRate,
          audioQueueAheadMs: runtimeTelemetry.audioQueueAheadMs,
          audioUnderruns: runtimeTelemetry.audioUnderruns,
              audioConcealmentEvents: runtimeTelemetry.audioConcealmentEvents,
              audioPopSuppressionEvents: runtimeTelemetry.audioPopSuppressionEvents,
          sampleClockTruthMode: runtimeTelemetry.lastClockTruthMode
        });

        const payload = {
            exportedAt: new Date().toISOString(),
            environment: {
              browserUserAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
              browserName: runtimeEnvironment.browserName,
              browserVersion: runtimeEnvironment.browserVersion,
              osFamily: runtimeEnvironment.osFamily,
              secureContext: runtimePrerequisites.secureContext,
              crossOriginIsolated: runtimePrerequisites.crossOriginIsolated,
              sharedArrayBufferAvailable: runtimeEnvironment.sharedArrayBufferAvailable,
              audioWorkletAvailable: runtimeEnvironment.audioWorkletAvailable,
              webUsbAvailable: runtimePrerequisites.webUsbAvailable,
              permissionState: latestPermissionState
            },
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
            filterState,
            demodQuality,
            runtimeTelemetry,
            dspTelemetry: runtimeTelemetry.dsp,
            runtimePrerequisites,
            permissionState: latestPermissionState,
            fmScan: {
              state: scanState,
              progress: scanProgress,
              stepLabel: scanStepLabel,
              results: scanResults
            },
            recordingTimeline: {
              sessionStartedAtIso,
              sessionStartedUnixMs,
              lastFrameSequence: runtimeTelemetry.lastFrameSequence,
              lastFrameSampleIndex: runtimeTelemetry.lastFrameSampleIndex,
              lastFrameTimestampNs: runtimeTelemetry.lastFrameTimestampNs,
              lastFrameSampleRate: runtimeTelemetry.lastFrameSampleRate,
              lastFrameWallClockMs: runtimeTelemetry.lastFrameWallClockMs,
              discontinuityTimeline: discontinuityTimelineRef.current,
              discontinuityEventTotal: discontinuityTimelineRef.current.length,
              rfAudioTimebaseAlignment: timebaseAlignment,
              exportUnixMs: Date.now()
            },
            measurementProvenance: {
              levelReadoutPoint: 'post-ddc',
              audioReadoutPoint: 'post-demod',
              sourceIqFormat: 'ci8-interleaved',
              exportedFromSourceType: sourceType,
              sampleClockTruthMode: runtimeTelemetry.lastClockTruthMode ?? 'unknown',
              timeAlignmentExtensions: activeFixtureMetadata?.timeAlignment ?? null
            },
            calibrationDisclosure,
            analyzerArtifact,
            interopFixtureExport: interopFixtureExport
              ? {
                  fixtureId: interopFixtureExport.fixtureId,
                  sigmfMetaFilename: interopFixtureExport.sigmfMetaFilename,
                  sigmfDataFilename: interopFixtureExport.sigmfDataFilename,
                  wavFilename: interopFixtureExport.wavFilename,
                  sigmfMetaLength: interopFixtureExport.sigmfMetaJson.length,
                  rawIqChecksumFnv1a32: `0x${fnv1a32(interopFixtureExport.rawIqSidecar).toString(16)}`,
                  wavChecksumFnv1a32: `0x${fnv1a32(interopFixtureExport.wavAudioRender).toString(16)}`
                }
              : null,
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
    
    setFineFreq(clampFineTuneHz(Math.round(offsetHz), filterState.highCutHz));
  };

    const measurementDisclosure = useMemo(() => {
      if (sourceType === 'FILE') {
        return createMeasurementCalibrationDisclosure(goldenToneFixtureBundle.metadata);
      }

      return createMeasurementCalibrationDisclosure();
    }, [sourceType]);

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

      if (connectionState === 'streaming') {
        if (demodQuality.lockState === 'locked') {
          items.push({
            key: 'demod-locked',
            level: 'ok',
            label: `${demodMode} lock acquired`,
            recommendation: `Quality ${(demodQuality.quality * 100).toFixed(0)}%, SNR ${demodQuality.snrEstimateDb.toFixed(1)} dB.`
          });
        } else if (demodQuality.lockState === 'degraded') {
          items.push({
            key: 'demod-degraded',
            level: 'warn',
            label: `${demodMode} lock degraded`,
            recommendation: 'Adjust fine tune, bandwidth profile, or gain staging to improve lock quality.'
          });
        } else {
          items.push({
            key: 'demod-searching',
            level: 'warn',
            label: `${demodMode} lock searching`,
            recommendation: 'Tune onto a stronger signal or widen high-cut temporarily to assist lock.'
          });
        }
      }

      if (runtimeTelemetry.totalDroppedSamples > 0) {
        items.push({
          key: 'stream-drops',
          level: 'warn',
          label: `Dropped samples detected (${runtimeTelemetry.totalDroppedSamples})`,
          recommendation: 'Investigate host load and source backpressure; exported diagnostics include drop counters and timeline.'
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

      if (!runtimePrerequisites.secureContext) {
        items.push({
          key: 'runtime-insecure-context',
          level: 'error',
          label: 'Secure context required',
          recommendation: 'Use https://localhost (or another secure origin) before attempting hardware access.'
        });
      }

      const requiresWebUsb = sourceType === 'HACKRF' || sourceType === 'RTLSDR';

      if (requiresWebUsb && !runtimePrerequisites.webUsbAvailable) {
        items.push({
          key: 'runtime-webusb-unavailable',
          level: 'error',
          label: 'WebUSB unavailable',
          recommendation: 'Use a Chromium browser with WebUSB support and serve the app from a secure context.'
        });
      }

      if (!runtimePrerequisites.crossOriginIsolated) {
        items.push({
          key: 'runtime-not-isolated',
          level: 'warn',
          label: 'Cross-origin isolation disabled',
          recommendation: 'Enable COOP/COEP headers for best performance and SharedArrayBuffer mode.'
        });
      }

      if (requiresWebUsb && permissionState.usb === 'denied') {
        items.push({
          key: 'runtime-webusb-permission-denied',
          level: 'error',
          label: 'WebUSB permission denied',
          recommendation: 'Re-pair the device and approve browser permission prompts.'
        });
      }

      if (permissionState.microphone === 'denied') {
        items.push({
          key: 'runtime-microphone-permission-denied',
          level: 'warn',
          label: 'Microphone permission denied',
          recommendation: 'Not required for SDR receive path, but diagnostics include this for runtime policy context.'
        });
      }

      return items;
    }, [
      audioState,
      connectionState,
      fftData,
      runtimePrerequisites.crossOriginIsolated,
      runtimePrerequisites.secureContext,
      runtimePrerequisites.webUsbAvailable,
      permissionState.microphone,
      permissionState.usb,
      runtimeTelemetry.audioUnderruns,
      runtimeTelemetry.totalDroppedSamples,
      runtimeTelemetry.renderFps,
      sourceType,
      demodMode,
      demodQuality.lockState,
      demodQuality.quality,
      demodQuality.snrEstimateDb
    ]);

  const modeContract = MODE_CONTROL_CONTRACTS[demodMode];
  const displayedBandwidthHz = Math.max(0, filterState.highCutHz - filterState.lowCutHz);
  const demodLockLabel = lockStateLabel(demodMode, demodQuality.lockState);

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1 className="app-title">rad.io MVP Preview</h1>
        <div className={`status-pill status-${connectionState}`} aria-live="polite">
          Connection: {connectionState}
        </div>
      </header>

      <p className="status-text" aria-live="polite">{statusMessage}</p>
      <p className="status-subtext">Audio: {audioState} | Keyboard: Left/Right tune 1 kHz, Up/Down fine tune, M mute toggle, P panic mute</p>
      
      <div className="visual-grid">
        <section className="panel panel-wide">
            <h2 className="panel-title">RF Waterfall</h2>
            <WaterfallCanvas
              data={fftData}
              minDb={waterfallMinDb}
              maxDb={waterfallMaxDb}
              zoom={zoomLevel}
              centerFrequencyHz={frequency}
              sampleRateHz={streamSampleRateHz}
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
              sampleRateHz={streamSampleRateHz}
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
                onChange={(e) => setSourceType(e.target.value as SourceType)}
                disabled={isRunning}
                className="control-input"
            >
                <option value="MOCK">Mock Source</option>
                <option value="FILE">File Fixture (SigMF)</option>
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

        <button onClick={toggleMute} className="action-btn btn-secondary">
          {isMuted ? 'Unmute' : 'Mute'}
        </button>

        <button onClick={() => panicMute('ui')} className="action-btn btn-stop">
          Panic Mute
        </button>

        <button onClick={exportDiagnostics} className="action-btn btn-secondary">
          Export Diagnostics
        </button>

        {(audioState === 'awaiting-user-gesture' || audioState === 'suspended') && (
          <button
            onClick={() => {
              void tryResumeAudio('user-action');
            }}
            className="action-btn btn-secondary"
          >
            Enable Audio
          </button>
        )}

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
          <label className="control-label">Output Level ({Math.round(audioOutputLevel * 100)}%)</label>
          <input
            type="range" min="0" max="1" step="0.01"
            value={audioOutputLevel}
            onChange={(e) => setAudioOutputLevel(parseFloat(e.target.value))}
            className="control-range"
          />
        </div>

        <div className="control-group">
          <label className="control-label">Max Output ({Math.round(audioMaxOutputLevel * 100)}%)</label>
          <input
            type="range" min="0.2" max="1" step="0.01"
            value={audioMaxOutputLevel}
            onChange={(e) => {
              const next = parseFloat(e.target.value);
              setAudioMaxOutputLevel(next);
              setAudioOutputLevel((prev) => Math.min(prev, next));
            }}
            className="control-range"
          />
        </div>

        <div className="control-group">
          <label className="control-label">Auto Mode Audio Defaults</label>
          <input
            type="checkbox"
            checked={applyModeAudioDefaults}
            onChange={(e) => setApplyModeAudioDefaults(e.target.checked)}
            className="control-check"
          />
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
            type="range" min={-maxFineTuneHz} max={maxFineTuneHz} step="1000"
                value={fineFreq}
            onChange={(e) => setFineFreq(clampFineTuneHz(parseInt(e.target.value), filterState.highCutHz))}
                className="control-range"
            />
          <div className="control-note">Alias-safe fine tune limit: +/-{maxFineTuneHz.toLocaleString()} Hz</div>
        </div>

        <div className="control-group">
            <label className="control-label">Mode</label>
            <select 
                value={demodMode}
                onChange={(e) => setDemodMode(e.target.value as DemodMode)}
                className="control-input compact"
            >
                <option value="WFM">WFM</option>
                <option value="NFM">NFM</option>
                <option value="AM">AM</option>
            </select>
        </div>

        <div className="control-group">
          <label className="control-label">Filter Shape</label>
          <select
            value={filterState.profile}
            onChange={(e) => setFilterState((prev) => ({ ...prev, profile: e.target.value as FilterProfile }))}
            className="control-input compact"
          >
            <option value="sharp">Sharp</option>
            <option value="low-ringing">Low Ringing</option>
            <option value="low-latency">Low Latency</option>
          </select>
        </div>

        <div className="control-group">
          <label className="control-label">Interference Helper</label>
          <select
            value={filterState.preset}
            onChange={(e) => setFilterState((prev) => ({ ...prev, preset: e.target.value as InterferencePreset }))}
            className="control-input compact"
          >
            <option value="off">Off</option>
            <option value="dc-spike-reduction">DC Spike Reduction</option>
            <option value="heterodyne-notch">Heterodyne Notch</option>
            <option value="hum-notch">Hum Notch</option>
          </select>
        </div>

        <div className="control-group">
          <label className="control-label">Bandwidth ({displayedBandwidthHz} Hz)</label>
          <input
            type="range"
            min={Math.max(400, modeContract.highCutMinHz - modeContract.lowCutMinHz)}
            max={modeContract.highCutMaxHz - modeContract.lowCutMinHz}
            step="100"
            value={displayedBandwidthHz}
            onChange={(e) => {
              const bandwidth = parseInt(e.target.value);
              const clamped = clampFilterForMode(demodMode, filterState.lowCutHz, filterState.lowCutHz + bandwidth);
              setFilterState((prev) => ({ ...prev, ...clamped }));
            }}
            className="control-range"
          />
        </div>

        <div className="control-group">
          <label className="control-label">Low Cut ({filterState.lowCutHz} Hz)</label>
          <input
            type="range"
            min={modeContract.lowCutMinHz}
            max={modeContract.lowCutMaxHz}
            step="10"
            value={filterState.lowCutHz}
            onChange={(e) => {
              const nextLow = parseInt(e.target.value);
              const clamped = clampFilterForMode(demodMode, nextLow, filterState.highCutHz);
              setFilterState((prev) => ({ ...prev, ...clamped }));
            }}
            className="control-range"
          />
        </div>

        <div className="control-group">
          <label className="control-label">High Cut ({filterState.highCutHz} Hz)</label>
          <input
            type="range"
            min={modeContract.highCutMinHz}
            max={modeContract.highCutMaxHz}
            step="50"
            value={filterState.highCutHz}
            onChange={(e) => {
              const nextHigh = parseInt(e.target.value);
              const clamped = clampFilterForMode(demodMode, filterState.lowCutHz, nextHigh);
              setFilterState((prev) => ({ ...prev, ...clamped }));
            }}
            className="control-range"
          />
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
                onChange={(e) => {
                  const parsed = parseFloat(e.target.value);
                  if (!Number.isFinite(parsed)) {
                    return;
                  }
                  setFrequency(Math.max(0, Math.floor(parsed * 1_000_000)));
                }}
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
          <li className={`health-item ${runtimeTelemetry.audioConcealmentEvents > 0 ? 'health-warn' : 'health-ok'}`}>
            <strong>Concealment Events</strong>
            <span>{runtimeTelemetry.audioConcealmentEvents}</span>
          </li>
          <li className={`health-item ${runtimeTelemetry.audioPopSuppressionEvents > 0 ? 'health-warn' : 'health-ok'}`}>
            <strong>Pop Suppression Events</strong>
            <span>{runtimeTelemetry.audioPopSuppressionEvents}</span>
          </li>
          <li className={`health-item ${runtimeTelemetry.audioLimiterEvents > 0 ? 'health-warn' : 'health-ok'}`}>
            <strong>Limiter Events</strong>
            <span>{runtimeTelemetry.audioLimiterEvents}</span>
          </li>
          <li className={`health-item ${runtimeTelemetry.totalDroppedSamples > 0 ? 'health-warn' : 'health-ok'}`}>
            <strong>Dropped Samples</strong>
            <span>{runtimeTelemetry.totalDroppedSamples} ({runtimeTelemetry.droppedFrameEvents} events)</span>
          </li>
          <li className="health-item health-ok">
            <strong>Worker Transport</strong>
            <span>{runtimeTelemetry.workerTransportMode}</span>
          </li>
          <li className="health-item health-ok">
            <strong>Last Clock Truth Mode</strong>
            <span>{runtimeTelemetry.lastClockTruthMode ?? 'unknown'}</span>
          </li>
        </ul>
      </section>

      <section className="health-panel" aria-live="polite">
        <h2 className="panel-title">Demod Lock & Quality</h2>
        <ul>
          <li className={`health-item ${demodQuality.lockState === 'locked' ? 'health-ok' : demodQuality.lockState === 'degraded' ? 'health-warn' : 'health-error'}`}>
            <strong>Lock State</strong>
            <span>{demodMode} {demodQuality.lockState} ({demodLockLabel})</span>
          </li>
          <li className="health-item health-ok">
            <strong>Quality</strong>
            <span>{(demodQuality.quality * 100).toFixed(0)}%</span>
          </li>
          <li className="health-item health-ok">
            <strong>SNR Estimate</strong>
            <span>{demodQuality.snrEstimateDb.toFixed(1)} dB</span>
          </li>
          <li className="health-item health-ok">
            <strong>Pilot / Carrier</strong>
            <span>{demodQuality.pilotLevel.toFixed(2)} / {demodQuality.carrierLevel.toFixed(2)}</span>
          </li>
          <li className="health-item health-ok">
            <strong>Deviation Estimate</strong>
            <span>{demodQuality.deviationEstimate.toFixed(3)}</span>
          </li>
        </ul>
      </section>

      <section className="health-panel" aria-live="polite">
        <h2 className="panel-title">Measurement Disclosure</h2>
        <ul>
          <li className={`health-item ${measurementDisclosure.disclosureText.uiBadgeShort === 'Calibrated' ? 'health-ok' : 'health-warn'}`}>
            <strong>Calibration Confidence</strong>
            <span>{measurementDisclosure.disclosureText.uiBadgeShort}</span>
          </li>
          <li className="health-item health-ok">
            <strong>Frequency Confidence</strong>
            <span>
              {measurementDisclosure.frequency.state}
              {measurementDisclosure.frequency.residualUncertaintyPpm === null
                ? ''
                : ` (+/-${measurementDisclosure.frequency.residualUncertaintyPpm.toFixed(2)} ppm)`}
            </span>
          </li>
          <li className="health-item health-ok">
            <strong>Level Confidence</strong>
            <span>
              {measurementDisclosure.level.state}
              {measurementDisclosure.level.residualUncertaintyDb === null
                ? ' (relative dBFS)'
                : ` (+/-${measurementDisclosure.level.residualUncertaintyDb.toFixed(2)} dB)`}
            </span>
          </li>
        </ul>
      </section>

      <section className="health-panel" aria-live="polite">
        <h2 className="panel-title">Runtime Prerequisites</h2>
        <ul>
          <li className={`health-item ${runtimePrerequisites.secureContext ? 'health-ok' : 'health-error'}`}>
            <strong>Secure Context</strong>
            <span>{runtimePrerequisites.secureContext ? 'ready' : 'missing'}</span>
          </li>
          <li className={`health-item ${runtimePrerequisites.webUsbAvailable ? 'health-ok' : 'health-error'}`}>
            <strong>WebUSB API</strong>
            <span>{runtimePrerequisites.webUsbAvailable ? 'available' : 'unavailable'}</span>
          </li>
          <li className={`health-item ${runtimePrerequisites.crossOriginIsolated ? 'health-ok' : 'health-warn'}`}>
            <strong>Cross-Origin Isolation</strong>
            <span>{runtimePrerequisites.crossOriginIsolated ? 'enabled' : 'disabled'}</span>
          </li>
          <li className={`health-item ${permissionState.usb === 'denied' ? 'health-error' : 'health-ok'}`}>
            <strong>USB Permission</strong>
            <span>{permissionState.usb}</span>
          </li>
          <li className={`health-item ${permissionState.microphone === 'denied' ? 'health-warn' : 'health-ok'}`}>
            <strong>Microphone Permission</strong>
            <span>{permissionState.microphone}</span>
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
