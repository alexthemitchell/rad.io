import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { AudioSink } from './audio/AudioSink';
import { AudioScopeCanvas } from './components/AudioScopeCanvas';
import { ConstellationCanvas } from './components/ConstellationCanvas';
import { IqScopeCanvas } from './components/IqScopeCanvas';
import { SpectrumCanvas } from './components/SpectrumCanvas';
import { WaterfallCanvas, type WaterfallCursorReadout } from './components/WaterfallCanvas';
import { Button } from './components/ui/Button';
import { Card } from './components/ui/Card';
import { Slider } from './components/ui/Slider';
import {
  evaluateFmScanCandidate,
  isStationCandidate,
  mergeNearbyCandidates,
  type FmStationCandidate
} from './dsp/FmBandScanner';
import { HackRFDevice } from './devices/HackRFDevice';
import { MockDevice } from './devices/MockDevice';
import { RtlSdrDevice } from './devices/RtlSdrDevice';
import { AirspyBridgeDevice } from './devices/AirspyBridgeDevice';
import { SdrplayBridgeDevice } from './devices/SdrplayBridgeDevice';
import { PlutoSdrBridgeDevice } from './devices/PlutoSdrBridgeDevice';
import { LimeSdrBridgeDevice } from './devices/LimeSdrBridgeDevice';
import { FileDevice } from './devices/FileDevice';
import { DeviceDebugSnapshot, ISDRDevice, SDRGainStage } from './devices/ISDRDevice';
import { getStabilityProfile, profileKeyFor, upsertStabilityProfile, type StabilityProfile } from './devices/deviceProfileStore';
import { deriveStableDeviceIdentity } from './devices/deviceIdentity';
import { buildHackrfFirmwareRecoveryPlan } from './devices/hackrfFirmwareRecovery';
import { buildSweepExecutionPlan } from './devices/hackrfSweepFallbackPlan';
import {
  probeHackrfSweepHostBridge,
  runHackrfSweepViaHostBridge,
  type HackrfSweepHostResponse
} from './devices/hackrfSweepHostBridge';
import { normalizeDeviceError } from './devices/errors';
import type { SDRStreamFrame } from './devices/streamFrame';
import { goldenToneFixtureBundle } from './fixtures/sigmf/goldenToneFixture';
import { createAnalyzerArtifactExport } from './dsp/analyzerArtifactExport';
import { createMeasurementCalibrationDisclosure } from './measurements/disclosure';
import { appendDiscontinuityTimelineEntry, type DiscontinuityTimelineEntry } from './measurements/discontinuityTimeline';
import {
  appendSessionParameterChangeEntry,
  type SessionParameterChangeEntry
} from './measurements/sessionProvenanceTimeline';
import {
  decodeShareableSessionState,
  encodeShareableSessionState,
  type ShareableSessionStateV1
} from './measurements/shareableSessionState';
import {
  consumeSessionInterrupted,
  markSessionInterrupted
} from './measurements/sessionResilience';
import {
  deriveSessionLockInvalidationReason,
  evaluateSessionGradeUpgrade
} from './measurements/sessionGradeUpgrade';
import {
  buildFrontEndHealthRecommendation,
  estimateEffectiveEnobBits
} from './measurements/frontEndHealthAdvisor';
import { assessFrontEndOverloadTriage } from './measurements/frontEndOverloadTriage';
import { assessExternalReferenceStability } from './measurements/externalReferenceStability';
import { assessRestoreSafety } from './measurements/sessionRestoreSafety';
import {
  CALIBRATION_SOURCE_CATALOG,
  buildFrequencyCalibrationResult,
  canApplySuggestedPpm,
  runFrequencyCalibrationWizard,
  type CalibrationSourceId
} from './measurements/frequencyCalibrationWizard';
import {
  createDefaultBandCalibrationProfile,
  exportCalibrationBundle,
  getAmplitudeCalibration,
  getBandCalibrationProfile,
  resolveCalibrationBandId,
  upsertAmplitudeCalibration,
  upsertBandCalibrationProfile
} from './measurements/amplitudeCalibrationStore';
import { runLevelCalibrationWizard } from './measurements/levelCalibrationWizard';
import { assessGainStagingAssistant } from './measurements/gainStagingAssistant';
import { deriveReferenceClockVisibility } from './measurements/referenceClockVisibility';
import {
  deriveReferenceClockSupportModel,
  evaluateReferenceLockProof,
  type ReferenceLockProofSample
} from './measurements/referenceClockModel';
import {
  deriveTargetQueueMs,
  describeClockSyncPolicy,
  type ClockSyncPolicy
} from './measurements/clockSyncPolicy';
import { buildTimebaseModelState } from './measurements/timebaseModel';
import { assessSampleRateMismatchStrategy } from './measurements/sampleRateMismatchStrategy';
import { buildSignalIdTuningAdvisor } from './measurements/signalIdTuningAdvisor';
import {
  clampFrequencyToBandHz,
  defaultStepForModeHz,
  findBandForFrequencyHz,
  getBandById,
  getBandRegionPlan,
  listBandRegionPlans,
  snapFrequencyToRasterHz,
  stepForBandModeHz,
  validateBandMode,
  type BandRegionId,
  type InteractionDemodMode
} from './measurements/bandPlans';
import {
  appendHeardHistory,
  appendTuneHistory,
  swapRecallPair,
  type HeardHistoryEntry,
  type TuneHistoryEntry
} from './measurements/interactionHistory';
import { resolveSecondaryOffsetFromMarkerHz, resolveVfoDisplayFrequencyHz, type VfoBindingId } from './measurements/markerVfoBinding';
import {
  createVfoPreset,
  loadVfoPresets,
  saveVfoPresets,
  type VfoPreset
} from './measurements/vfoPresetsStore';
import { evaluateVfoResourceBudget } from './measurements/vfoResourceBudget';
import { assessBufferTelemetry, buildAsciiOccupancyTrend } from './measurements/bufferTelemetry';
import { assessIqIntegrityWizard } from './measurements/iqIntegrityWizard';
import { assessTimebaseDriftTelemetry } from './measurements/timebaseDriftTelemetry';
import {
  applyRfChainProfileToFrequencyMapping,
  buildRfChainProfileFromContext,
  createDefaultAntennaFrontEndContext,
  listAntennaFrontEndProfiles,
  listRfChainProfiles,
  upsertAntennaFrontEndProfile,
  upsertRfChainProfile,
  type AntennaFrontEndContext,
  type AntennaFrontEndProfile,
  type RfChainProfile
} from './measurements/rfContextProfiles';
import {
  buildCatalogEntriesFromAnnotations,
  findSpurCatalogMatches,
  listSpurArtifactEntries,
  upsertSpurArtifactEntries
} from './measurements/spurArtifactCatalog';
import {
  recommendUsbStreamingProfile,
  scoreUsbProfileWindow,
  USB_STREAMING_PROFILES,
  type UsbStreamingProfileName
} from './measurements/usbStreamingPolicy';
import {
  runHardwareSanitySelfTest,
  type HardwareSanitySelfTestReport
} from './measurements/hardwareSanitySelfTest';
import { validateRecordingExportIntegrity } from './measurements/recordingExportIntegrityValidator';
import { createRfAudioTimebaseAlignmentSnapshot } from './measurements/rfAudioTimebaseAlignment';
import { createFixtureInteropExportBundle } from './fixtures/sigmf/interopExport';
import {
  appendRecorderChunk,
  buildSigmfMetadataDraft,
  createAudioExport,
  createBookmark,
  createBrowserRecordingStore,
  createRecorderSession,
  createRecordingFromSession,
  createReproBundle,
  createStructuredAnnotation,
  createTrustStamp,
  createWorkspaceStateBundle,
  deterministicReplay,
  enforceRetentionPolicy,
  quickTapExportFromRingBuffer,
  renderOfflineDeterministicDemod,
  validateInteropRequiredMetadataChecklist,
  type RecorderSession,
  type RecordingRecord,
  type StructuredAnnotation,
  type WorkspaceStateBundle
} from './measurements/recordingPersistence';
import { WorkerBridge } from './dsp/WorkerBridge';
import type { VfoAudioRoute, VfoRuntimeMetric } from './dsp/multiVfoCore';
import {
  displayToTunerFrequencyHz,
  formatFrequencyModelSummary,
  tunerToDisplayFrequencyHz,
  type FrequencyMappingConfig
} from './dsp/frequencyMapping';
import type { FilterProfile, InterferencePreset } from './dsp/AudioPostProcessor';
import type { DemodMode, DemodQualityMetrics, LockState } from './dsp/DemodMetrics';
import type { NfmAudioPreset, NfmOutputPath } from './dsp/NfmDemodulator';
import {
  MODE_CONTROL_CONTRACTS,
  aliasSafeHighCutMaxHz,
  clampFilterForMode,
  clampFineTuneHz,
  lockStateLabel,
  maxFineTuneHzForFilter,
  planStreamRateForMode
} from './dsp/controlGuardrails';
import {
  estimateOccupiedBandwidthHz,
  binIndexToFrequencyHz,
  findNearestQualifiedPeak,
  listStrongestPeaks,
  findStrongestPeakInRange,
  frequencyHzToBinIndex,
  getWindowEnbwBins,
  getVisibleSpectrumBinRange,
  resolveMarkerReadout,
  type AnalyzerAveragingMode,
  type AnalyzerPeakHoldMode,
  type AnalyzerWindowMode
} from './dsp/analyzerControls';
import {
  applyArtifactMaskToPeaks,
  applyDetectorMode,
  applyTraceMath,
  buildCandidateSignalStats,
  computeAnalyzerSemantics,
  deriveSignalWarnings,
  stitchSweepSegments,
  type AnalyzerDetectorMode,
  type AnalyzerTraceMathMode,
  type SpurArtifactAnnotation,
  type SweepSegment,
  type SweptPoint
} from './dsp/analyzerSemantics';
import {
  createDefaultRuntimeDspTelemetry,
  createDefaultRuntimeTelemetry,
  type RuntimeDspTelemetryV1,
  type RuntimeTelemetryV1
} from './telemetry/runtimeTelemetryContract';

type ConnectionState = 'idle' | 'pairing' | 'connected' | 'streaming' | 'recovering' | 'error';
type AudioState = 'suspended' | 'awaiting-user-gesture' | 'running' | 'degraded' | 'muted';
type ScanState = 'idle' | 'running' | 'completed' | 'cancelled' | 'error';
type HealthLevel = 'ok' | 'warn' | 'error';
type RuntimeTelemetry = RuntimeTelemetryV1;

type DspFilterState = {
  lowCutHz: number;
  highCutHz: number;
  notchHz: number | null;
  notchQ: number;
  profile: FilterProfile;
  preset: InterferencePreset;
};
type NoiseSquelchState = {
  enabled: boolean;
  thresholdDb: number;
  hysteresisDb: number;
  hangMs: number;
  tailMs: number;
  hangRemainingMs: number;
  open: boolean;
  gain: number;
  snrDb: number;
};

type ToneDecodeState = {
  mode: 'off' | 'ctcss' | 'dcs';
  ctcssHz: number | null;
  dcsDetected: boolean;
  dcsCode: number | null;
  confidence: number;
  active: boolean;
};

type AgcState = {
  enabled: boolean;
  mode: DemodMode;
  state: 'idle' | 'tracking' | 'hold';
  targetLevelDbfs: number;
  estimatedGainDb: number;
};

type ImpulseBlankerState = {
  enabled: boolean;
  blankedSamples: number;
  blankingRatio: number;
  estimatedImpulseEnergy: number;
};

type FrequencyModelState = {
  afcEnabled: boolean;
  afcCorrectionHz: number;
  driftEstimateHzPerSec: number;
  driftConfidence: number;
  ppmCorrectionHz: number;
  totalCorrectionHz: number;
  stabilityMode: boolean;
  phaseErrorRms: number;
};

type AudioPllState = {
  ratio: number;
  targetQueueMs: number;
  queueErrorMs: number;
};

type VfoRuntimeState = {
  activeVfoCount: number;
  audioRoute: VfoAudioRoute;
  vfos: VfoRuntimeMetric[];
};

type WfmStereoState = {
  locked: boolean;
  pilotLevel: number;
  separationDb: number;
};

type ToneDecodeMode = 'OFF' | 'CTCSS' | 'DCS' | 'AUTO';

type AudioLevelerState = {
  enabled: boolean;
  gainLinear: number;
  gainDb: number;
  targetRms: number;
};

type DemodQualityState = {
  lockState: LockState;
  quality: number;
  snrEstimateDb: number;
  pilotLevel: number;
  carrierLevel: number;
  deviationEstimate: number;
};

type SourceType = 'MOCK' | 'HACKRF' | 'RTLSDR' | 'AIRSPY' | 'SDRPLAY' | 'PLUTO' | 'LIMESDR' | 'FILE';

type AnalyzerMarkerState = {
  frequencyHz: number;
  placedAtIso: string;
};

type MarkerBindingState = {
  enabled: boolean;
  boundVfoId: VfoBindingId;
  followVfo: boolean;
};

type MarkerTableSortMode = 'power' | 'frequency' | 'snr';
type AnalyzerSweepState = 'idle' | 'running' | 'completed' | 'error';
type SweepRunExecutor = 'software-stitch' | 'host-bridge-hackrf-sweep';

type SweepRunEvidence = {
  executor: SweepRunExecutor;
  startedAtIso: string;
  completedAtIso: string;
  segmentCount: number;
  stitchedPointCount: number;
  providerLabel?: string;
  elapsedMs?: number;
  diagnostics: string[];
};

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

type WakeLockSentinelLike = {
  released: boolean;
  release: () => Promise<void>;
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
  demodMode: DemodMode;
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

type DiagnosticLogLevel = 'debug' | 'info' | 'warn' | 'error';

type DiagnosticLogEntry = {
  ts: string;
  level: DiagnosticLogLevel;
  source: string;
  message: string;
};

type LatencyPolicy = 'low-latency' | 'stable';

type TelemetryWindowSample = {
  ts: string;
  renderFps: number | null;
  audioUnderruns: number;
  audioQueueAheadMs: number;
  audioSafetyMuteEvents: number;
  totalDroppedSamples: number;
  droppedFrameEvents: number;
  streamDiscontinuities: number;
  workerTransportMode: RuntimeTelemetry['workerTransportMode'];
};

type AudioOutputDeviceOption = {
  deviceId: string;
  label: string;
};

type SafeModeSnapshot = {
  sourceType: SourceType;
  frequencyHz: number;
  demodMode: DemodMode;
  fineFreqHz: number;
  ppmCorrection: number;
  latencyPolicy: LatencyPolicy;
  clockSyncPolicy: ClockSyncPolicy;
  afcEnabled: boolean;
  stabilityModeEnabled: boolean;
  secondaryVfoEnabled: boolean;
  secondaryVfoOffsetHz: number;
  vfoAudioRoute: VfoAudioRoute;
};

type SafeModeMarker = {
  triggeredAtIso: string;
  reason: string;
  snapshot: SafeModeSnapshot;
};

type PendingSafeRestoreConfirmation = {
  snapshot: SafeModeSnapshot;
  reasons: string[];
  summary: string;
};

type SessionParameterSnapshot = {
  frequencyHz: number;
  demodMode: DemodMode;
  fineTuneHz: number;
  ppmCorrection: number;
  bandwidthHz: number;
  gainProfile: string;
  latencyPolicy: LatencyPolicy;
  clockSyncPolicy: ClockSyncPolicy;
};

const APP_VERSION = '0.0.1';
const LATENCY_POLICY_STORAGE_KEY = 'rad.io.latencyPolicy.v1';
const CLOCK_SYNC_POLICY_STORAGE_KEY = 'rad.io.clockSyncPolicy.v1';
const RF_ENV_CONTEXT_STORAGE_KEY = 'rad.io.rfEnvironmentContext.v1';
const AUDIO_OUTPUT_DEVICE_STORAGE_KEY = 'rad.io.audioOutputDevice.v1';
const SAFE_MODE_MARKER_STORAGE_KEY = 'rad.io.safeModeBoot.v1';
const USB_STREAMING_PROFILE_STORAGE_KEY = 'rad.io.usbStreamingProfile.v1';
const SHAREABLE_SESSION_QUERY_PARAM = 'session';
const SESSION_GRADE_MIN_STABILITY_WINDOW_SECONDS = 30;
const REFERENCE_LOCK_PROOF_WINDOW_SECONDS = 30;
const WEBUSB_CONTENTION_CHANNEL = 'rad.io.webusb.contention.v1';
const BIAS_TEE_DEFAULT_AUTO_OFF_SECONDS = 90;
const BIAS_TEE_MIN_AUTO_OFF_SECONDS = 15;
const BIAS_TEE_MAX_AUTO_OFF_SECONDS = 300;
const DEFAULT_GPIO_OUTPUTS: Record<string, boolean> = {
  GPIO0: false,
  GPIO1: false
};

const DEFAULT_RF_ENVIRONMENT_CONTEXT: AntennaFrontEndContext = createDefaultAntennaFrontEndContext();

const isWebUsbSource = (source: SourceType): boolean => source === 'HACKRF' || source === 'RTLSDR';

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
    notchHz: null,
    notchQ: 10,
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
const defaultNoiseSquelchState = (): NoiseSquelchState => ({
  enabled: false,
  thresholdDb: 10,
  hysteresisDb: 1.5,
  hangMs: 120,
  tailMs: 140,
  hangRemainingMs: 0,
  open: true,
  gain: 1,
  snrDb: -120
});

const defaultToneDecodeState = (): ToneDecodeState => ({
  mode: 'off',
  ctcssHz: null,
  dcsDetected: false,
  dcsCode: null,
  confidence: 0,
  active: false
});

const defaultAgcState = (): AgcState => ({
  enabled: false,
  mode: 'WFM',
  state: 'idle',
  targetLevelDbfs: -18,
  estimatedGainDb: 0
});

const defaultImpulseBlankerState = (): ImpulseBlankerState => ({
  enabled: false,
  blankedSamples: 0,
  blankingRatio: 0,
  estimatedImpulseEnergy: 0
});

const defaultAudioLevelerState = (): AudioLevelerState => ({
  enabled: false,
  gainLinear: 1,
  gainDb: 0,
  targetRms: 0.22
});

const defaultFrequencyModelState = (): FrequencyModelState => ({
  afcEnabled: false,
  afcCorrectionHz: 0,
  driftEstimateHzPerSec: 0,
  driftConfidence: 0,
  ppmCorrectionHz: 0,
  totalCorrectionHz: 0,
  stabilityMode: false,
  phaseErrorRms: 0
});

const defaultAudioPllState = (): AudioPllState => ({
  ratio: 1,
  targetQueueMs: 120,
  queueErrorMs: 0
});

const defaultVfoRuntimeState = (): VfoRuntimeState => ({
  activeVfoCount: 0,
  audioRoute: 'main',
  vfos: []
});

const defaultWfmStereoState = (): WfmStereoState => ({
  locked: false,
  pilotLevel: 0,
  separationDb: 0
});

const defaultFrequencyMappingState = (): FrequencyMappingConfig => ({
  ifOffsetHz: 0,
  transverterEnabled: false,
  transverterLoHz: 125_000_000,
  transverterDirection: 'up'
});

const defaultMarkerBindingState = (): MarkerBindingState => ({
  enabled: false,
  boundVfoId: 'main',
  followVfo: false
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
    __RADIO_FORCE_NO_SAB?: boolean;
    __RADIO_HOST_BRIDGE__?: unknown;
    __radIoDebug?: {
      getSnapshot: () => RadioDebugSnapshot;
    };
  }
}

export default function App() {
  const runtimePrerequisites = useMemo(() => detectRuntimePrerequisites(), []);
  const runtimeEnvironment = useMemo(() => detectRuntimeEnvironment(), []);
  const forceNoSab = useMemo(
    () => typeof window !== 'undefined' && window.__RADIO_FORCE_NO_SAB === true,
    []
  );
  const preferMessageChannelFallback = useMemo(
    () => forceNoSab || !runtimePrerequisites.crossOriginIsolated || !runtimeEnvironment.sharedArrayBufferAvailable,
    [forceNoSab, runtimeEnvironment.sharedArrayBufferAvailable, runtimePrerequisites.crossOriginIsolated]
  );
  const streamRateCandidates = useMemo<readonly number[]>(
    () => (preferMessageChannelFallback ? [250_000, 500_000, 1_000_000] : [250_000, 500_000, 1_000_000, 2_000_000, 2_400_000]),
    [preferMessageChannelFallback]
  );
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
  const [ppmCorrection, setPpmCorrection] = useState<number>(0);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [analyzerReferenceLevelDb, setAnalyzerReferenceLevelDb] = useState(-20);
  const [analyzerAveragingMode, setAnalyzerAveragingMode] = useState<AnalyzerAveragingMode>('off');
  const [analyzerAveragingValue, setAnalyzerAveragingValue] = useState(0.25);
  const [analyzerLinearAveragingFrames, setAnalyzerLinearAveragingFrames] = useState(8);
  const [analyzerWindowMode, setAnalyzerWindowMode] = useState<AnalyzerWindowMode>('hann');
  const [analyzerPeakHoldEnabled, setAnalyzerPeakHoldEnabled] = useState(true);
  const [analyzerPeakHoldMode, setAnalyzerPeakHoldMode] = useState<AnalyzerPeakHoldMode>('decay');
  const [analyzerPeakHoldResetToken, setAnalyzerPeakHoldResetToken] = useState(0);
  const [analyzerDetectorMode, setAnalyzerDetectorMode] = useState<AnalyzerDetectorMode>('sample');
  const [analyzerVbwFrames, setAnalyzerVbwFrames] = useState(4);
  const [analyzerTraceMathMode, setAnalyzerTraceMathMode] = useState<AnalyzerTraceMathMode>('a');
  const [traceB, setTraceB] = useState<Float32Array | null>(null);
  const [markerTableSortMode, setMarkerTableSortMode] = useState<MarkerTableSortMode>('power');
  const [markerTableSnrMinDb, setMarkerTableSnrMinDb] = useState(6);
  const [spurAnnotations, setSpurAnnotations] = useState<SpurArtifactAnnotation[]>([]);
  const [artifactMaskEnabled, setArtifactMaskEnabled] = useState(false);
  const [sweepState, setSweepState] = useState<AnalyzerSweepState>('idle');
  const [sweepStatus, setSweepStatus] = useState('No sweep run yet.');
  const [sweepStitchedPoints, setSweepStitchedPoints] = useState<SweptPoint[]>([]);
  const [sweepRunEvidence, setSweepRunEvidence] = useState<SweepRunEvidence | null>(null);
  const [showIqScopeView, setShowIqScopeView] = useState(true);
  const [showConstellationView, setShowConstellationView] = useState(true);
  const [analyzerMarker, setAnalyzerMarker] = useState<AnalyzerMarkerState | null>(null);
  const [analyzerSecondaryMarker, setAnalyzerSecondaryMarker] = useState<AnalyzerMarkerState | null>(null);
  const [activeVfoId, setActiveVfoId] = useState<VfoBindingId>('main');
  const [markerBindingState, setMarkerBindingState] = useState<MarkerBindingState>(defaultMarkerBindingState);
  const [bandRegionId, setBandRegionId] = useState<BandRegionId>('na');
  const [selectedBandId, setSelectedBandId] = useState<string>('fm-broadcast');
  const [bandRasterSnapEnabled, setBandRasterSnapEnabled] = useState(false);
  const [autoApplyBandDefaults, setAutoApplyBandDefaults] = useState(false);
  const [enforceBandLimits, setEnforceBandLimits] = useState(false);
  const [bandGuardrailWarning, setBandGuardrailWarning] = useState<string | null>(null);
  const [bandGuardrailPromptDismissed, setBandGuardrailPromptDismissed] = useState(false);
  const [frequencyMapping, setFrequencyMapping] = useState<FrequencyMappingConfig>(defaultFrequencyMappingState);
  const [tuneHistory, setTuneHistory] = useState<TuneHistoryEntry[]>([]);
  const [heardHistory, setHeardHistory] = useState<HeardHistoryEntry[]>([]);
  const [recallSlotAHz, setRecallSlotAHz] = useState<number | null>(null);
  const [recallSlotBHz, setRecallSlotBHz] = useState<number | null>(null);
  const [tuningStepHz, setTuningStepHz] = useState(1_000);
  const [fineTuningStepHz, setFineTuningStepHz] = useState(1_000);
  const [lastLockFrequencyHz, setLastLockFrequencyHz] = useState<number | null>(null);
    const [isMuted, setIsMuted] = useState(true);
    const [audioOutputLevel, setAudioOutputLevel] = useState(MODE_CONTROL_CONTRACTS.WFM.defaultOutputLevel);
    const [audioMaxOutputLevel, setAudioMaxOutputLevel] = useState(MODE_CONTROL_CONTRACTS.WFM.defaultMaxOutputLevel);
    const [applyModeAudioDefaults, setApplyModeAudioDefaults] = useState(true);
    const [waterfallPalette, setWaterfallPalette] = useState<'cividis' | 'inferno'>('cividis');
    const [waterfallAutoScale, setWaterfallAutoScale] = useState(true);
    const [waterfallFrozen, setWaterfallFrozen] = useState(false);
    const [waterfallCursorReadout, setWaterfallCursorReadout] = useState<WaterfallCursorReadout | null>(null);
    const [waterfallMinDb, setWaterfallMinDb] = useState(-125);
    const [waterfallMaxDb, setWaterfallMaxDb] = useState(-35);

    const [connectionState, setConnectionState] = useState<ConnectionState>('idle');
    const [audioState, setAudioState] = useState<AudioState>('suspended');
    const [statusMessage, setStatusMessage] = useState('Ready. Select a source and start streaming.');
    const [webUsbContention, setWebUsbContention] = useState<'clear' | 'contended'>('clear');
    const [diagnosticEvents, setDiagnosticEvents] = useState<string[]>([]);
    const [diagnosticLogs, setDiagnosticLogs] = useState<DiagnosticLogEntry[]>([]);
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
    const [scanDwellMs, setScanDwellMs] = useState(900);
    const [permissionState, setPermissionState] = useState<RuntimePermissionState>(unknownPermissionState());
    const [noiseSquelchState, setNoiseSquelchState] = useState<NoiseSquelchState>(defaultNoiseSquelchState);
    const [toneDecodeState, setToneDecodeState] = useState<ToneDecodeState>(defaultToneDecodeState);
    const [toneDecodeMode, setToneDecodeMode] = useState<ToneDecodeMode>('CTCSS');
    const [agcState, setAgcState] = useState<AgcState>(defaultAgcState);
    const [impulseBlankerState, setImpulseBlankerState] = useState<ImpulseBlankerState>(defaultImpulseBlankerState);
    const [audioLevelerState, setAudioLevelerState] = useState<AudioLevelerState>(defaultAudioLevelerState);
    const [nfmAudioPreset, setNfmAudioPreset] = useState<NfmAudioPreset>('voice-na-75us');
    const [nfmOutputPath, setNfmOutputPath] = useState<NfmOutputPath>('voice');
    const [iqCorrectionEnabled, setIqCorrectionEnabled] = useState(true);
    const [afcEnabled, setAfcEnabled] = useState(false);
    const [stabilityModeEnabled, setStabilityModeEnabled] = useState(false);
    const [frequencyModelState, setFrequencyModelState] = useState<FrequencyModelState>(defaultFrequencyModelState);
    const [audioPllState, setAudioPllState] = useState<AudioPllState>(defaultAudioPllState);
    const [vfoState, setVfoState] = useState<VfoRuntimeState>(defaultVfoRuntimeState);
    const [wfmStereoState, setWfmStereoState] = useState<WfmStereoState>(defaultWfmStereoState);
    const [secondaryVfoEnabled, setSecondaryVfoEnabled] = useState(false);
    const [secondaryVfoOffsetHz, setSecondaryVfoOffsetHz] = useState(12_500);
    const [vfoAudioRoute, setVfoAudioRoute] = useState<VfoAudioRoute>('main');
    const [vfoPresetNameDraft, setVfoPresetNameDraft] = useState('');
    const [vfoPresets, setVfoPresets] = useState<VfoPreset[]>(() => {
      try {
        return loadVfoPresets(localStorage);
      } catch {
        return [];
      }
    });
    const [recordingRecords, setRecordingRecords] = useState<RecordingRecord[]>([]);
    const [selectedRecordingId, setSelectedRecordingId] = useState('');
    const [recordingActive, setRecordingActive] = useState(false);
    const [recorderSession, setRecorderSession] = useState<RecorderSession | null>(null);
    const [recordingBookmarks, setRecordingBookmarks] = useState<Array<{ id: string; label: string; frequencyHz: number; createdAtIso: string }>>([]);
    const [bookmarkNameDraft, setBookmarkNameDraft] = useState('');
    const [recordingAnnotations, setRecordingAnnotations] = useState<StructuredAnnotation[]>([]);
    const [annotationDraft, setAnnotationDraft] = useState('');
    
    const [workspaceImportDraft] = useState('');
    const [recordingScheduledStartIso] = useState('');
    const [recordingChunkDurationMs] = useState(5_000);
    const [replayWindowMs] = useState(15_000);    const [stabilityProfile, setStabilityProfile] = useState<StabilityProfile | null>(null);
    const [sessionGradeLockedAtIso, setSessionGradeLockedAtIso] = useState<string | null>(null);
    const [sessionGradeLockInvalidatedReason, setSessionGradeLockInvalidatedReason] = useState<string | null>(null);
    const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
    const [commandPaletteQuery, setCommandPaletteQuery] = useState('');
    const [shortcutsHelpOpen, setShortcutsHelpOpen] = useState(false);
    const [diagnosticsLogOpen, setDiagnosticsLogOpen] = useState(false);
    const [frequencyInputDraftMhz, setFrequencyInputDraftMhz] = useState((90_000_000 / 1_000_000).toFixed(3));
    const [deviceDebugSnapshot, setDeviceDebugSnapshot] = useState<DeviceDebugSnapshot | null>(null);
    const [latencyPolicy, setLatencyPolicy] = useState<LatencyPolicy>(() => {
      try {
        const stored = localStorage.getItem(LATENCY_POLICY_STORAGE_KEY);
        return stored === 'low-latency' || stored === 'stable' ? stored : 'stable';
      } catch {
        return 'stable';
      }
    });
    const [clockSyncPolicy, setClockSyncPolicy] = useState<ClockSyncPolicy>(() => {
      try {
        const stored = localStorage.getItem(CLOCK_SYNC_POLICY_STORAGE_KEY);
        return stored === 'rf-accurate' || stored === 'audio-stable' ? stored : 'audio-stable';
      } catch {
        return 'audio-stable';
      }
    });
    const [rfEnvironmentContext, setRfEnvironmentContext] = useState<AntennaFrontEndContext>(() => {
      try {
        const raw = localStorage.getItem(RF_ENV_CONTEXT_STORAGE_KEY);
        if (!raw) {
          return DEFAULT_RF_ENVIRONMENT_CONTEXT;
        }

        const parsed = JSON.parse(raw) as Partial<AntennaFrontEndContext>;
        return {
          antennaName: typeof parsed.antennaName === 'string' ? parsed.antennaName : '',
          preampNote: typeof parsed.preampNote === 'string' ? parsed.preampNote : '',
          attenuatorNote: typeof parsed.attenuatorNote === 'string' ? parsed.attenuatorNote : '',
          filterNote: typeof parsed.filterNote === 'string' ? parsed.filterNote : '',
          chainNotes: typeof parsed.chainNotes === 'string' ? parsed.chainNotes : '',
          biasTeeEnabled: typeof parsed.biasTeeEnabled === 'boolean' ? parsed.biasTeeEnabled : false
        };
      } catch {
        return DEFAULT_RF_ENVIRONMENT_CONTEXT;
      }
    });
    const [biasTeeAutoOffSeconds, setBiasTeeAutoOffSeconds] = useState(BIAS_TEE_DEFAULT_AUTO_OFF_SECONDS);
    const [biasTeeArmedUntilMs, setBiasTeeArmedUntilMs] = useState<number | null>(null);
    const [biasTeeSecondsRemaining, setBiasTeeSecondsRemaining] = useState(0);
    const [gpioOutputs, setGpioOutputs] = useState<Record<string, boolean>>(DEFAULT_GPIO_OUTPUTS);
    const [audioOutputDeviceId, setAudioOutputDeviceId] = useState(() => {
      try {
        const stored = localStorage.getItem(AUDIO_OUTPUT_DEVICE_STORAGE_KEY);
        return typeof stored === 'string' && stored.length > 0 ? stored : 'default';
      } catch {
        return 'default';
      }
    });
    const [audioOutputDevices, setAudioOutputDevices] = useState<AudioOutputDeviceOption[]>([
      { deviceId: 'default', label: 'System default' }
    ]);
    const [audioOutputSelectionSupported, setAudioOutputSelectionSupported] = useState(false);
    const [safeModeMarker, setSafeModeMarker] = useState<SafeModeMarker | null>(null);
    const [pendingSafeRestoreConfirmation, setPendingSafeRestoreConfirmation] = useState<PendingSafeRestoreConfirmation | null>(null);
    const [adaptiveStreamingEnabled, setAdaptiveStreamingEnabled] = useState(true);
    const [usbStreamingProfile, setUsbStreamingProfile] = useState<UsbStreamingProfileName | 'custom'>(() => {
      try {
        const stored = localStorage.getItem(USB_STREAMING_PROFILE_STORAGE_KEY);
        return stored === 'low-latency' || stored === 'balanced' || stored === 'stable' ? stored : 'balanced';
      } catch {
        return 'balanced';
      }
    });
    const [usbAutoTuneRunning, setUsbAutoTuneRunning] = useState(false);
    const [hardwareSelfTestReport, setHardwareSelfTestReport] = useState<HardwareSanitySelfTestReport | null>(null);
    const [calibrationWizardSourceId, setCalibrationWizardSourceId] = useState<CalibrationSourceId>('wfm-pilot-19khz');
    const [levelCalibrationReferenceDbm, setLevelCalibrationReferenceDbm] = useState(-67);
    const [calibrationStoreRevision, setCalibrationStoreRevision] = useState(0);
    const [rfContextProfileNameDraft, setRfContextProfileNameDraft] = useState('Default Context');
    const [rfChainProfileNameDraft, setRfChainProfileNameDraft] = useState('Default RF Chain');
    const [selectedAntennaContextProfileId, setSelectedAntennaContextProfileId] = useState('');
    const [selectedRfChainProfileId, setSelectedRfChainProfileId] = useState('');
    const [antennaContextProfiles, setAntennaContextProfiles] = useState<AntennaFrontEndProfile[]>([]);
    const [rfChainProfiles, setRfChainProfiles] = useState<RfChainProfile[]>([]);
    const [spurCatalogRevision, setSpurCatalogRevision] = useState(0);

  const bandRegionPlans = useMemo(() => listBandRegionPlans(), []);

  const selectedBand = useMemo(
    () => getBandById(bandRegionId, selectedBandId) ?? null,
    [bandRegionId, selectedBandId]
  );

  const tunedTunerFrequencyHz = useMemo(() => frequency + fineFreq, [fineFreq, frequency]);

  const displayCenterFrequencyHz = useMemo(
    () => tunerToDisplayFrequencyHz(frequency, frequencyMapping),
    [frequency, frequencyMapping]
  );

  const tunedDisplayFrequencyHz = useMemo(
    () => tunerToDisplayFrequencyHz(tunedTunerFrequencyHz, frequencyMapping),
    [frequencyMapping, tunedTunerFrequencyHz]
  );

  const inferredBandAtTunedFrequency = useMemo(
    () => findBandForFrequencyHz(bandRegionId, tunedDisplayFrequencyHz),
    [bandRegionId, tunedDisplayFrequencyHz]
  );

  const activeVfoDisplayFrequencyHz = useMemo(
    () => resolveVfoDisplayFrequencyHz(activeVfoId, tunedDisplayFrequencyHz, secondaryVfoEnabled, secondaryVfoOffsetHz),
    [activeVfoId, secondaryVfoEnabled, secondaryVfoOffsetHz, tunedDisplayFrequencyHz]
  );

  const effectiveVfoAudioRoute = useMemo<VfoAudioRoute>(() => {
    if (!secondaryVfoEnabled && vfoAudioRoute === 'aux') {
      return 'main';
    }
    return vfoAudioRoute;
  }, [secondaryVfoEnabled, vfoAudioRoute]);

  const vfoOverlayDescriptors = useMemo(() => {
    const overlays = [
      {
        id: 'main',
        label: 'MAIN',
        frequencyHz: tunedDisplayFrequencyHz,
        active: activeVfoId === 'main'
      }
    ];

    if (secondaryVfoEnabled) {
      overlays.push({
        id: 'aux',
        label: 'AUX',
        frequencyHz: tunedDisplayFrequencyHz + secondaryVfoOffsetHz,
        active: activeVfoId === 'aux'
      });
    }

    return overlays;
  }, [activeVfoId, secondaryVfoEnabled, secondaryVfoOffsetHz, tunedDisplayFrequencyHz]);

  const vfoResourceBudget = useMemo(() => evaluateVfoResourceBudget({
    activeVfoCount: vfoState.activeVfoCount,
    vfos: vfoState.vfos,
    pipelineTotalMs: runtimeTelemetry.dsp.pipelineTiming.totalMs,
    audioUnderruns: runtimeTelemetry.audioUnderruns,
    audioRoute: effectiveVfoAudioRoute,
    secondaryVfoEnabled
  }), [effectiveVfoAudioRoute, runtimeTelemetry.audioUnderruns, runtimeTelemetry.dsp.pipelineTiming.totalMs, secondaryVfoEnabled, vfoState.activeVfoCount, vfoState.vfos]);

  const activeCalibrationBandId = useMemo(
    () => resolveCalibrationBandId(tunedDisplayFrequencyHz),
    [tunedDisplayFrequencyHz]
  );
  
  const workerRef = useRef<Worker | null>(null);
  const workerBridgeRef = useRef<WorkerBridge | null>(null);
  const deviceRef = useRef<ISDRDevice | null>(null);
  const audioRef = useRef<AudioSink | null>(null);
  const usbIqRmsRef = useRef(0);
  const usbIqMeanAbsRef = useRef(0);
  const usbTransferBytesRef = useRef(0);
  const usbTransferCountRef = useRef(0);
  const fftDataRef = useRef<Float32Array>(new Float32Array(2048));
  const detectorHistoryRef = useRef<Float32Array[]>([]);
  const lastHeardCaptureAtMsRef = useRef(0);
  const rdsTelemetryRef = useRef<RdsTelemetry>(emptyRdsTelemetry());
  const scanAbortRef = useRef(false);
  const streamSessionStartedAtRef = useRef<Date | null>(null);
  const discontinuityTimelineRef = useRef<DiscontinuityTimelineEntry[]>([]);
  const parameterChangeTimelineRef = useRef<SessionParameterChangeEntry[]>([]);
  const previousSessionSnapshotRef = useRef<SessionParameterSnapshot | null>(null);
  const streamSampleRateHzRef = useRef(2_000_000);
  const lastProfilePersistAtRef = useRef<number>(0);
  const telemetryWindowRef = useRef<TelemetryWindowSample[]>([]);
  const referenceLockSamplesRef = useRef<ReferenceLockProofSample[]>([]);
  const runtimeTelemetryRef = useRef<RuntimeTelemetry>(createDefaultRuntimeTelemetry('direct'));
  const lastAudioQueueAheadMsRef = useRef<number | null>(null);
  const queueJitterEwmaMsRef = useRef(0);
  const lastAudioPllRatioRef = useRef<number | null>(null);
  const logThrottleStateRef = useRef<Record<string, number>>({});
  const throttledLogDropsRef = useRef(0);
  const tabIdRef = useRef(`tab-${Math.random().toString(36).slice(2, 10)}`);
  const contentionChannelRef = useRef<BroadcastChannel | null>(null);
  const isRunningRef = useRef(false);
  const commandPaletteInputRef = useRef<HTMLInputElement | null>(null);
  const commandPaletteInvokerRef = useRef<HTMLElement | null>(null);
  const shortcutsHelpInvokerRef = useRef<HTMLElement | null>(null);
  const frequencyInputRef = useRef<HTMLInputElement | null>(null);
  const wakeLockRef = useRef<WakeLockSentinelLike | null>(null);
  const previousFrequencyRef = useRef<number | null>(null);
  const previousFineFreqRef = useRef<number | null>(null);
  const previousBandwidthRef = useRef<number | null>(null);
  const streamToggleShortcutRef = useRef<(() => void) | null>(null);
  const exportDiagnosticsShortcutRef = useRef<(() => void) | null>(null);
  const startRecordingRef = useRef<(() => void) | null>(null);
  const stopRecordingRef = useRef<(() => void) | null>(null);
  const replayRecordingRef = useRef<(() => Promise<void>) | null>(null);
  const exportRecordingBundleRef = useRef<(() => Promise<void>) | null>(null);
  const appendRecordingCaptureChunkRef = useRef<(iqData: Uint8Array, audioData: Float32Array) => void>(() => undefined);
  const recordingStoreRef = useRef(createBrowserRecordingStore());
  const recordingSessionRef = useRef<RecorderSession | null>(null);
  const [backgroundAudioGuardActive, setBackgroundAudioGuardActive] = useState(false);

  const downloadJsonBlob = useCallback((filename: string, payload: unknown) => {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }, []);

  const activeDeviceProfileKey = useMemo(() => {
    const deviceName = deviceRef.current?.name ?? null;
    if (!deviceName) {
      return profileKeyFor(sourceType, null);
    }

    return deriveStableDeviceIdentity(sourceType, deviceName, deviceDebugSnapshot).key;
  }, [deviceDebugSnapshot, sourceType]);

  const activeCapabilityModel = deviceRef.current?.getCapabilityModel?.() ?? null;

  useEffect(() => {
    const contextProfiles = listAntennaFrontEndProfiles(activeDeviceProfileKey);
    const chainProfiles = listRfChainProfiles(activeDeviceProfileKey);

    setAntennaContextProfiles(contextProfiles);
    setRfChainProfiles(chainProfiles);

    if (contextProfiles.length > 0 && selectedAntennaContextProfileId.length === 0) {
      setSelectedAntennaContextProfileId(contextProfiles[0].id);
      setRfContextProfileNameDraft(contextProfiles[0].name);
    }

    if (chainProfiles.length > 0 && selectedRfChainProfileId.length === 0) {
      setSelectedRfChainProfileId(chainProfiles[0].profileId);
      setRfChainProfileNameDraft(chainProfiles[0].profileName);
    }
  }, [activeDeviceProfileKey, selectedAntennaContextProfileId.length, selectedRfChainProfileId.length]);

  const sweepHostBridgeProbe = probeHackrfSweepHostBridge();

  const sweepExecutionPlan = useMemo(() => {
    return buildSweepExecutionPlan({
      sourceType,
      isStreaming: isRunning,
      capability: deviceDebugSnapshot?.sweep ?? null,
      hostBridge: {
        available: sweepHostBridgeProbe.available,
        providerLabel: sweepHostBridgeProbe.providerLabel,
        reason: sweepHostBridgeProbe.reason
      }
    });
  }, [
    deviceDebugSnapshot?.sweep,
    isRunning,
    sourceType,
    sweepHostBridgeProbe.available,
    sweepHostBridgeProbe.providerLabel,
    sweepHostBridgeProbe.reason
  ]);

    const pushDiagnosticEvent = useCallback((
      message: string,
      level: DiagnosticLogLevel = 'info',
      source = 'app'
    ) => {
        const now = Date.now();
        const throttleKey = `${level}:${source}:${message}`;
        const previousTs = logThrottleStateRef.current[throttleKey];

        // Drop repeated identical logs inside a short window to avoid diagnostics spam.
        if (typeof previousTs === 'number' && now - previousTs < 2000) {
          throttledLogDropsRef.current += 1;
          return;
        }

        logThrottleStateRef.current[throttleKey] = now;

        const timestamp = new Date(now).toISOString();
        const formatted = `${timestamp} [${level.toUpperCase()}] [${source}] ${message}`;
        setDiagnosticEvents((prev) => [formatted, ...prev].slice(0, 100));
        setDiagnosticLogs((prev) => [{ ts: timestamp, level, source, message }, ...prev].slice(0, 200));
    }, []);

    const applyRfPowerState = useCallback(async (patch: { biasTeeEnabled?: boolean; ampEnabled?: boolean }) => {
      const activeDevice = deviceRef.current;
      if (!activeDevice?.setRfPowerState) {
        return;
      }

      try {
        await activeDevice.setRfPowerState(patch);
        setDeviceDebugSnapshot(activeDevice.getDebugSnapshot?.() ?? null);
      } catch (error) {
        const normalized = normalizeDeviceError(error);
        setStatusMessage(`RF power update failed: ${normalized.message}`);
        pushDiagnosticEvent(`RF power update failed [${normalized.code}]: ${normalized.message}`, 'warn', 'device');
      }
    }, [pushDiagnosticEvent]);

    const applyGpioOutputs = useCallback(async (nextOutputs: Record<string, boolean>) => {
      const activeDevice = deviceRef.current;
      if (
        !activeDevice?.setGpioState
        || activeCapabilityModel?.rfPower.gpioControl !== 'supported'
      ) {
        return;
      }

      try {
        await activeDevice.setGpioState({ outputPins: nextOutputs });
        setDeviceDebugSnapshot(activeDevice.getDebugSnapshot?.() ?? null);
        const activePins = Object.entries(nextOutputs)
          .filter(([, enabled]) => enabled)
          .map(([pin]) => pin);
        setStatusMessage(activePins.length > 0
          ? `GPIO outputs active: ${activePins.join(', ')}.`
          : 'GPIO outputs all low.');
      } catch (error) {
        const normalized = normalizeDeviceError(error);
        setStatusMessage(`GPIO update failed: ${normalized.message}`);
        pushDiagnosticEvent(`GPIO update failed [${normalized.code}]: ${normalized.message}`, 'warn', 'device');
      }
    }, [activeCapabilityModel?.rfPower.gpioControl, pushDiagnosticEvent]);

    const armBiasTeeSafetyWindow = useCallback(() => {
      const now = Date.now();
      const safeSeconds = Math.max(BIAS_TEE_MIN_AUTO_OFF_SECONDS, Math.min(BIAS_TEE_MAX_AUTO_OFF_SECONDS, Math.round(biasTeeAutoOffSeconds)));
      setBiasTeeAutoOffSeconds(safeSeconds);
      setBiasTeeArmedUntilMs(now + (safeSeconds * 1000));
      setStatusMessage(`Bias-tee safety armed for ${safeSeconds} seconds.`);
      pushDiagnosticEvent(`Bias-tee safety armed for ${safeSeconds}s.`, 'info', 'safety');
    }, [biasTeeAutoOffSeconds, pushDiagnosticEvent]);

    const refreshPermissionState = useCallback(async () => {
      const [usb, microphone] = await Promise.all([
        queryPermissionState('usb'),
        queryPermissionState('microphone')
      ]);
      setPermissionState({ usb, microphone });
    }, []);

    const refreshAudioOutputDevices = useCallback(async () => {
      const mediaDevices = navigator.mediaDevices;
      if (!mediaDevices?.enumerateDevices) {
        setAudioOutputDevices([{ deviceId: 'default', label: 'System default' }]);
        return;
      }

      try {
        const devices = await mediaDevices.enumerateDevices();
        const outputOptions: AudioOutputDeviceOption[] = devices
          .filter((device) => device.kind === 'audiooutput')
          .map((device, index) => ({
            deviceId: device.deviceId || `audio-output-${index}`,
            label: device.label || `Audio output ${index + 1}`
          }));

        const dedupedById = new Map<string, AudioOutputDeviceOption>();
        dedupedById.set('default', { deviceId: 'default', label: 'System default' });
        for (const option of outputOptions) {
          dedupedById.set(option.deviceId, option);
        }

        setAudioOutputDevices(Array.from(dedupedById.values()));
      } catch {
        setAudioOutputDevices([{ deviceId: 'default', label: 'System default' }]);
      }
    }, []);

    const applySelectedAudioOutput = useCallback(async (reason: 'startup' | 'selection' | 'device-change') => {
      const sink = audioRef.current;
      if (!sink) {
        return;
      }

      try {
        const applied = await sink.setOutputDevice(audioOutputDeviceId);
        if (applied && reason !== 'startup' && isRunningRef.current) {
          sink.prepareTransitionRamp();
          setRuntimeTelemetry((prev) => ({
            ...prev,
            streamDiscontinuities: prev.streamDiscontinuities + 1,
            lastDiscontinuityCause: 'output-device-change',
            lastFrameWallClockMs: Date.now()
          }));
          pushDiagnosticEvent('Reconfiguration discontinuity recorded (output-device-change) with click-safe ramp.');
        }
        if (!applied && reason === 'selection' && audioOutputDeviceId !== 'default') {
          setStatusMessage('Output device selection is not supported in this browser. Using default output.');
          pushDiagnosticEvent('Audio output device selection requested but not supported by this browser.', 'warn');
        }
      } catch {
        if (audioOutputDeviceId !== 'default') {
          setAudioOutputDeviceId('default');
        }
        setStatusMessage('Failed to switch audio output device. Reverted to system default.');
        pushDiagnosticEvent(`Audio output device switch failed for ${audioOutputDeviceId}. Reverted to default.`, 'warn');
      }
    }, [audioOutputDeviceId, pushDiagnosticEvent]);

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

  const recordReconfigurationDiscontinuity = useCallback((cause: string) => {
    setRuntimeTelemetry((prev) => ({
      ...prev,
      streamDiscontinuities: prev.streamDiscontinuities + 1,
      lastDiscontinuityCause: cause,
      lastFrameWallClockMs: Date.now()
    }));
    pushDiagnosticEvent(`Reconfiguration discontinuity recorded (${cause}) with click-safe ramp.`);
  }, [pushDiagnosticEvent]);

  const applyClickFreeReconfiguration = useCallback((cause: string) => {
    audioRef.current?.prepareTransitionRamp();
    recordReconfigurationDiscontinuity(cause);
  }, [recordReconfigurationDiscontinuity]);

  const tuneToDisplayFrequency = useCallback((displayFrequencyHz: number) => {
    const tunerHz = Math.max(0, displayToTunerFrequencyHz(displayFrequencyHz, frequencyMapping));
    setFrequency(Math.round(tunerHz));
    setFineFreq(0);
    return tunerToDisplayFrequencyHz(tunerHz, frequencyMapping);
  }, [frequencyMapping]);

  const applyUsbStreamingProfile = useCallback(async (profileName: UsbStreamingProfileName | 'custom') => {
    const activeDevice = deviceRef.current;
    if (!activeDevice?.setStreamingProfile) {
      return;
    }

    if (profileName === 'custom') {
      return;
    }

    const profile = USB_STREAMING_PROFILES[profileName];
    await activeDevice.setStreamingProfile({
      transferSizeBytes: profile.transferSizeBytes,
      retryDelayMs: profile.retryDelayMs,
      maxConsecutiveFailures: profile.maxConsecutiveFailures,
      profileName: profile.name
    });
    setUsbStreamingProfile(profileName);
    pushDiagnosticEvent(`USB streaming profile applied: ${profileName}.`);
  }, [pushDiagnosticEvent]);

  const serializeGainProfile = useCallback((input: Record<string, number>) => {
    return Object.keys(input)
      .sort((a, b) => a.localeCompare(b))
      .map((key) => `${key}:${input[key]}`)
      .join('|');
  }, []);

  const buildSessionParameterSnapshot = useCallback((): SessionParameterSnapshot => ({
    frequencyHz: frequency,
    demodMode,
    fineTuneHz: fineFreq,
    ppmCorrection,
    bandwidthHz: Math.max(0, filterState.highCutHz - filterState.lowCutHz),
    gainProfile: serializeGainProfile(gains),
    latencyPolicy,
    clockSyncPolicy
  }), [clockSyncPolicy, demodMode, filterState.highCutHz, filterState.lowCutHz, fineFreq, frequency, gains, latencyPolicy, ppmCorrection, serializeGainProfile]);

  const buildSafeModeSnapshot = useCallback((): SafeModeSnapshot => ({
    sourceType,
    frequencyHz: frequency,
    demodMode,
    fineFreqHz: fineFreq,
    ppmCorrection,
    latencyPolicy,
    clockSyncPolicy,
    afcEnabled,
    stabilityModeEnabled,
    secondaryVfoEnabled,
    secondaryVfoOffsetHz,
    vfoAudioRoute: effectiveVfoAudioRoute
  }), [
    afcEnabled,
    clockSyncPolicy,
    demodMode,
    fineFreq,
    frequency,
    latencyPolicy,
    ppmCorrection,
    effectiveVfoAudioRoute,
    secondaryVfoEnabled,
    secondaryVfoOffsetHz,
    sourceType,
    stabilityModeEnabled
  ]);

  const applySafeModeDefaults = useCallback(() => {
    setLatencyPolicy('stable');
    setClockSyncPolicy('audio-stable');
    setAfcEnabled(false);
    setStabilityModeEnabled(false);
    setSecondaryVfoEnabled(false);
    setSecondaryVfoOffsetHz(12_500);
    setVfoAudioRoute('main');
    setToneDecodeMode('OFF');
  }, []);

  const clearSafeModeMarker = useCallback(() => {
    setSafeModeMarker(null);
    setPendingSafeRestoreConfirmation(null);
    try {
      localStorage.removeItem(SAFE_MODE_MARKER_STORAGE_KEY);
    } catch {
      // Non-fatal in private/incognito contexts.
    }
  }, []);

  const persistSafeModeMarker = useCallback((reason: string) => {
    const marker: SafeModeMarker = {
      triggeredAtIso: new Date().toISOString(),
      reason,
      snapshot: buildSafeModeSnapshot()
    };

    setSafeModeMarker(marker);

    try {
      localStorage.setItem(SAFE_MODE_MARKER_STORAGE_KEY, JSON.stringify(marker));
    } catch {
      // Non-fatal in private/incognito contexts.
    }
  }, [buildSafeModeSnapshot]);

  const triggerCrashOnlyRecovery = useCallback((cause: string) => {
    persistSafeModeMarker(cause);
    pushDiagnosticEvent(`Crash-only recovery triggered (${cause}). Restarting into safe mode.`, 'error');
    setStatusMessage('Pipeline fault detected. Restarting in safe mode...');
    setIsRunning(false);
    setConnectionState('recovering');
    setAudioState('awaiting-user-gesture');

    workerBridgeRef.current?.postMessage({ command: 'STOP' });
    audioRef.current?.stop();

    if (typeof window !== 'undefined') {
      window.setTimeout(() => {
        window.location.reload();
      }, 150);
    }
  }, [persistSafeModeMarker, pushDiagnosticEvent]);

  const restoreFromSafeModeSnapshot = useCallback((snapshot: SafeModeSnapshot) => {
    setSourceType(snapshot.sourceType);
    setFrequency(Math.round(snapshot.frequencyHz));
    setDemodMode(snapshot.demodMode);
    setFineFreq(Math.round(snapshot.fineFreqHz));
    setPpmCorrection(snapshot.ppmCorrection);
    setLatencyPolicy(snapshot.latencyPolicy);
    setClockSyncPolicy(snapshot.clockSyncPolicy);
    setAfcEnabled(snapshot.afcEnabled);
    setStabilityModeEnabled(snapshot.stabilityModeEnabled);
    setSecondaryVfoEnabled(snapshot.secondaryVfoEnabled);
    setSecondaryVfoOffsetHz(snapshot.secondaryVfoOffsetHz);
    setVfoAudioRoute(snapshot.vfoAudioRoute === 'aux' || snapshot.vfoAudioRoute === 'mix' || snapshot.vfoAudioRoute === 'mute' ? snapshot.vfoAudioRoute : 'main');
  }, []);

  const requestSafeRestoreConfirmation = useCallback((snapshot: SafeModeSnapshot) => {
    const assessment = assessRestoreSafety({
      sourceType: snapshot.sourceType,
      demodMode: snapshot.demodMode,
      frequencyHz: snapshot.frequencyHz,
      fineFreqHz: snapshot.fineFreqHz,
      ppmCorrection: snapshot.ppmCorrection
    });

    if (!assessment.requiresConfirmation) {
      restoreFromSafeModeSnapshot(snapshot);
      clearSafeModeMarker();
      setStatusMessage('Restored previous session settings from safe-mode snapshot.');
      pushDiagnosticEvent('Safe mode dismissed and previous settings restored.');
      return;
    }

    setPendingSafeRestoreConfirmation({
      snapshot,
      reasons: assessment.reasons,
      summary: assessment.summary
    });
    setStatusMessage('Safe-mode restore has risky settings. Review and confirm before applying.');
  }, [clearSafeModeMarker, pushDiagnosticEvent, restoreFromSafeModeSnapshot]);

  useEffect(() => {
    try {
      localStorage.setItem(RF_ENV_CONTEXT_STORAGE_KEY, JSON.stringify(rfEnvironmentContext));
    } catch {
      // Non-fatal in private/incognito contexts.
    }
  }, [rfEnvironmentContext]);

  useEffect(() => {
    if (biasTeeArmedUntilMs === null) {
      setBiasTeeSecondsRemaining(0);
      return;
    }

    const updateRemaining = () => {
      const remaining = Math.max(0, Math.ceil((biasTeeArmedUntilMs - Date.now()) / 1000));
      setBiasTeeSecondsRemaining(remaining);
      if (remaining <= 0) {
        setBiasTeeArmedUntilMs(null);
      }
    };

    updateRemaining();
    const intervalId = window.setInterval(updateRemaining, 1000);
    return () => {
      window.clearInterval(intervalId);
    };
  }, [biasTeeArmedUntilMs]);

  useEffect(() => {
    if (isRunning && rfEnvironmentContext.biasTeeEnabled && biasTeeArmedUntilMs === null) {
      setRfEnvironmentContext((prev) => ({
        ...prev,
        biasTeeEnabled: false
      }));
      setStatusMessage('Bias-tee disabled automatically after safety timeout.');
      pushDiagnosticEvent('Bias-tee auto-disabled after safety timeout.', 'warn', 'safety');
      void applyRfPowerState({ biasTeeEnabled: false });
    }
  }, [applyRfPowerState, biasTeeArmedUntilMs, isRunning, pushDiagnosticEvent, rfEnvironmentContext.biasTeeEnabled]);

  useEffect(() => {
    if (!isRunning) {
      return;
    }

    void applyRfPowerState({ biasTeeEnabled: rfEnvironmentContext.biasTeeEnabled });
  }, [applyRfPowerState, isRunning, rfEnvironmentContext.biasTeeEnabled]);

  useEffect(() => {
    if (!isRunning) {
      return;
    }

    void applyGpioOutputs(gpioOutputs);
  }, [applyGpioOutputs, gpioOutputs, isRunning]);

  useEffect(() => {
    try {
      localStorage.setItem(AUDIO_OUTPUT_DEVICE_STORAGE_KEY, audioOutputDeviceId);
    } catch {
      // Non-fatal in private/incognito contexts.
    }
  }, [audioOutputDeviceId]);

  useEffect(() => {
    try {
      localStorage.setItem(USB_STREAMING_PROFILE_STORAGE_KEY, usbStreamingProfile);
    } catch {
      // Non-fatal in private/incognito contexts.
    }
  }, [usbStreamingProfile]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SAFE_MODE_MARKER_STORAGE_KEY);
      if (!raw) {
        return;
      }

      const parsed = JSON.parse(raw) as SafeModeMarker;
      if (!parsed || typeof parsed.reason !== 'string' || !parsed.snapshot) {
        return;
      }

      setSafeModeMarker(parsed);
      applySafeModeDefaults();
      setStatusMessage('Safe mode active after last unstable session. Review guidance and restore when ready.');
      pushDiagnosticEvent(`Safe mode boot activated (${parsed.reason}) from ${parsed.triggeredAtIso}.`, 'warn');
    } catch {
      // Non-fatal in private/incognito contexts.
    }
  }, [applySafeModeDefaults, pushDiagnosticEvent]);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.sessionStorage === 'undefined') {
      return;
    }

    try {
      const interruptedAt = consumeSessionInterrupted(window.sessionStorage);
      if (interruptedAt) {
        setStatusMessage('Previous session ended unexpectedly. Safe defaults restored (no auto-connect).');
        pushDiagnosticEvent(`Recovered from interrupted session marker (${interruptedAt}).`, 'warn');
      }
    } catch {
      // Non-fatal in private/incognito contexts.
    }
  }, [pushDiagnosticEvent]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const shareToken = new URL(window.location.href).searchParams.get(SHAREABLE_SESSION_QUERY_PARAM);
    if (!shareToken) {
      return;
    }

    const sharedState = decodeShareableSessionState(shareToken);
    if (!sharedState) {
      pushDiagnosticEvent('Ignored invalid shareable session state from URL.', 'warn');
      return;
    }

    setFrequency(Math.round(sharedState.frequencyHz));
    setDemodMode(sharedState.demodMode);
    setFineFreq(Math.round(sharedState.fineFreqHz));
    setPpmCorrection(sharedState.ppmCorrection);
    setStreamSampleRateHz(sharedState.streamSampleRateHz);
    setLatencyPolicy(sharedState.latencyPolicy);
    setZoomLevel(sharedState.zoomLevel);

    const halfBandwidthHz = Math.max(1, Math.round(sharedState.bandwidthHz / 2));
    const clampedFilter = clampFilterForMode(
      sharedState.demodMode,
      -halfBandwidthHz,
      halfBandwidthHz,
      sharedState.streamSampleRateHz
    );
    setFilterState({
      ...defaultFilterStateForMode(sharedState.demodMode),
      ...clampedFilter
    });

    setStatusMessage('Loaded shareable session state from URL.');
    pushDiagnosticEvent('Loaded shareable session state from URL.');
  }, [pushDiagnosticEvent]);

  useEffect(() => {
    const snapshot = buildSessionParameterSnapshot();

    if (!isRunning) {
      previousSessionSnapshotRef.current = snapshot;
      return;
    }

    const previous = previousSessionSnapshotRef.current;
    if (!previous) {
      previousSessionSnapshotRef.current = snapshot;
      return;
    }

    const sessionStartedUnixMs = streamSessionStartedAtRef.current?.valueOf() ?? null;
    let nextTimeline = parameterChangeTimelineRef.current;

    if (previous.frequencyHz !== snapshot.frequencyHz) {
      nextTimeline = appendSessionParameterChangeEntry(
        nextTimeline,
        'frequency_hz',
        previous.frequencyHz,
        snapshot.frequencyHz,
        sessionStartedUnixMs
      );
    }

    if (previous.demodMode !== snapshot.demodMode) {
      nextTimeline = appendSessionParameterChangeEntry(
        nextTimeline,
        'demod_mode',
        previous.demodMode,
        snapshot.demodMode,
        sessionStartedUnixMs
      );
    }

    if (previous.fineTuneHz !== snapshot.fineTuneHz) {
      nextTimeline = appendSessionParameterChangeEntry(
        nextTimeline,
        'fine_tune_hz',
        previous.fineTuneHz,
        snapshot.fineTuneHz,
        sessionStartedUnixMs
      );
    }

    if (previous.ppmCorrection !== snapshot.ppmCorrection) {
      nextTimeline = appendSessionParameterChangeEntry(
        nextTimeline,
        'ppm_correction',
        previous.ppmCorrection,
        snapshot.ppmCorrection,
        sessionStartedUnixMs
      );
    }

    if (previous.bandwidthHz !== snapshot.bandwidthHz) {
      nextTimeline = appendSessionParameterChangeEntry(
        nextTimeline,
        'bandwidth_hz',
        previous.bandwidthHz,
        snapshot.bandwidthHz,
        sessionStartedUnixMs
      );
    }

    if (previous.gainProfile !== snapshot.gainProfile) {
      nextTimeline = appendSessionParameterChangeEntry(
        nextTimeline,
        'gain_profile',
        previous.gainProfile,
        snapshot.gainProfile,
        sessionStartedUnixMs
      );
    }

    if (previous.latencyPolicy !== snapshot.latencyPolicy) {
      nextTimeline = appendSessionParameterChangeEntry(
        nextTimeline,
        'latency_policy',
        previous.latencyPolicy,
        snapshot.latencyPolicy,
        sessionStartedUnixMs
      );
    }

    if (previous.clockSyncPolicy !== snapshot.clockSyncPolicy) {
      nextTimeline = appendSessionParameterChangeEntry(
        nextTimeline,
        'clock_sync_policy',
        previous.clockSyncPolicy,
        snapshot.clockSyncPolicy,
        sessionStartedUnixMs
      );
    }

    parameterChangeTimelineRef.current = nextTimeline;
    previousSessionSnapshotRef.current = snapshot;
  }, [buildSessionParameterSnapshot, isRunning]);

  useEffect(() => {
    const previous = previousFrequencyRef.current;
    previousFrequencyRef.current = frequency;

    if (!isRunning || previous === null || previous === frequency) {
      return;
    }

    applyClickFreeReconfiguration('retune-frequency');
  }, [applyClickFreeReconfiguration, frequency, isRunning]);

  useEffect(() => {
    const previous = previousFineFreqRef.current;
    previousFineFreqRef.current = fineFreq;

    if (!isRunning || previous === null || previous === fineFreq) {
      return;
    }

    applyClickFreeReconfiguration('retune-fine');
  }, [applyClickFreeReconfiguration, fineFreq, isRunning]);

  useEffect(() => {
    const bandwidthHz = Math.max(0, filterState.highCutHz - filterState.lowCutHz);
    const previous = previousBandwidthRef.current;
    previousBandwidthRef.current = bandwidthHz;

    if (!isRunning || previous === null || previous === bandwidthHz) {
      return;
    }

    applyClickFreeReconfiguration('bandwidth-change');
  }, [applyClickFreeReconfiguration, filterState.highCutHz, filterState.lowCutHz, isRunning]);

  useEffect(() => {
    workerRef.current = new Worker(new URL('./dsp/worker.ts', import.meta.url), { type: 'module' });
    workerBridgeRef.current = new WorkerBridge(workerRef.current, {
      preferMessageChannelFallback
    });
    audioRef.current = new AudioSink(50000); // 50k from worker
    setAudioOutputSelectionSupported(audioRef.current.supportsOutputDeviceSelection());
    audioRef.current.setMuted(true);
    audioRef.current.setOutputLevel(MODE_CONTROL_CONTRACTS.WFM.defaultOutputLevel);
    audioRef.current.setMaxOutputLevel(MODE_CONTROL_CONTRACTS.WFM.defaultMaxOutputLevel);
    audioRef.current.setSafetyConfig({ maxOutputLevel: MODE_CONTROL_CONTRACTS.WFM.defaultMaxOutputLevel });

    setRuntimeTelemetry((prev) => ({
      ...prev,
      workerTransportMode: workerBridgeRef.current?.getMode() ?? 'direct'
    }));
    if (forceNoSab) {
      pushDiagnosticEvent('SharedArrayBuffer transport forced off by __RADIO_FORCE_NO_SAB; running in degraded compatibility mode.');
    }
    pushDiagnosticEvent(`Worker transport mode: ${workerBridgeRef.current?.getMode() ?? 'direct'}.`);

    workerRef.current.onmessage = (e) => {
      if (e.data.type === 'FFT_DATA') {
        setFftData(e.data.data);
      } else if (e.data.type === 'SCOPE_DATA') {
        setScopeData(e.data.data);
      } else if (e.data.type === 'AUDIO_DATA') {
        try {
          const audioData = new Float32Array(e.data.data as ArrayBuffer);
          audioRef.current?.push(audioData);
          appendRecordingCaptureChunkRef.current(new Uint8Array(0), audioData);
        } catch {
          triggerCrashOnlyRecovery('audio-pipeline-fault');
        }
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
      } else if (e.data.type === 'SQUELCH_STATE') {
        setNoiseSquelchState(e.data.data as NoiseSquelchState);
      } else if (e.data.type === 'TONE_DECODE_STATE') {
        setToneDecodeState(e.data.data as ToneDecodeState);
      } else if (e.data.type === 'AUDIO_LEVELER_STATE') {
        setAudioLevelerState(e.data.data as AudioLevelerState);
      } else if (e.data.type === 'AGC_STATE') {
        const state = e.data.data as AgcState;
        setAgcState(state);
        setRuntimeTelemetry((prev) => ({
          ...prev,
          agc: {
            contractVersion: prev.agc.contractVersion,
            implemented: true,
            mode: 'bb',
            state: state.state,
            targetLevelDbfs: state.targetLevelDbfs,
            estimatedGainDb: state.estimatedGainDb
          }
        }));
      } else if (e.data.type === 'IMPULSE_BLANKER_STATE') {
        setImpulseBlankerState(e.data.data as ImpulseBlankerState);
      } else if (e.data.type === 'FREQUENCY_MODEL_STATE') {
        setFrequencyModelState(e.data.data as FrequencyModelState);
      } else if (e.data.type === 'AUDIO_PLL_STATE') {
        setAudioPllState(e.data.data as AudioPllState);
      } else if (e.data.type === 'VFO_STATE') {
        setVfoState(e.data.data as VfoRuntimeState);
      } else if (e.data.type === 'WFM_STEREO_STATE') {
        setWfmStereoState(e.data.data as WfmStereoState);
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

    workerRef.current.onerror = (event) => {
      const reason = typeof event.message === 'string' && event.message.length > 0
        ? `worker-error:${event.message}`
        : 'worker-error:unknown';
      triggerCrashOnlyRecovery(reason);
    };

    workerRef.current.onmessageerror = () => {
      triggerCrashOnlyRecovery('worker-message-deserialize-fault');
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
  }, [forceNoSab, preferMessageChannelFallback, pushDiagnosticEvent, triggerCrashOnlyRecovery]);

  useEffect(() => {
    try {
      localStorage.setItem(LATENCY_POLICY_STORAGE_KEY, latencyPolicy);
      localStorage.setItem(CLOCK_SYNC_POLICY_STORAGE_KEY, clockSyncPolicy);
    } catch {
      // Non-fatal in private/incognito contexts.
    }

    const targetQueueMs = deriveTargetQueueMs(latencyPolicy, clockSyncPolicy);
    postToWorker({ command: 'SET_AUDIO_PLL_TARGET_QUEUE_MS', value: targetQueueMs });
  }, [clockSyncPolicy, latencyPolicy, postToWorker]);

  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }

    let keepAliveIntervalId: number | null = null;

    const releaseWakeLock = async () => {
      const lock = wakeLockRef.current;
      if (!lock) {
        return;
      }

      try {
        await lock.release();
      } catch {
        // Ignore release races.
      }
      wakeLockRef.current = null;
      setBackgroundAudioGuardActive(false);
    };

    const acquireWakeLock = async () => {
      if (document.visibilityState !== 'hidden') {
        return;
      }

      const nav = navigator as Navigator & {
        wakeLock?: { request: (type: 'screen') => Promise<WakeLockSentinelLike> };
      };
      if (!nav.wakeLock?.request) {
        setBackgroundAudioGuardActive(false);
        return;
      }

      try {
        wakeLockRef.current = await nav.wakeLock.request('screen');
        setBackgroundAudioGuardActive(true);
      } catch {
        setBackgroundAudioGuardActive(false);
      }
    };

    if (isRunning) {
      void acquireWakeLock();
      keepAliveIntervalId = window.setInterval(() => {
        if (document.visibilityState !== 'hidden') {
          return;
        }

        postToWorker({ command: 'PING' });
        void tryResumeAudio('visibility');
      }, 15_000);
    } else {
      void releaseWakeLock();
    }

    return () => {
      if (keepAliveIntervalId !== null) {
        window.clearInterval(keepAliveIntervalId);
      }
      void releaseWakeLock();
    };
  }, [isRunning, postToWorker, tryResumeAudio]);

    useEffect(() => {
      void refreshPermissionState();
    }, [refreshPermissionState]);

    useEffect(() => {
      if (typeof navigator === 'undefined') {
        return;
      }

      const mediaDevices = navigator.mediaDevices;
      if (!mediaDevices) {
        setAudioOutputSelectionSupported(false);
        return;
      }

      const sinkSupportProbe = new AudioSink();
      setAudioOutputSelectionSupported(sinkSupportProbe.supportsOutputDeviceSelection());

      void refreshAudioOutputDevices();

      const onDeviceChange = () => {
        void refreshAudioOutputDevices();
      };

      mediaDevices.addEventListener?.('devicechange', onDeviceChange);

      return () => {
        mediaDevices.removeEventListener?.('devicechange', onDeviceChange);
      };
    }, [refreshAudioOutputDevices]);

    useEffect(() => {
      if (!audioOutputDevices.some((device) => device.deviceId === audioOutputDeviceId)) {
        setAudioOutputDeviceId('default');
      }
    }, [audioOutputDeviceId, audioOutputDevices]);

    useEffect(() => {
      void applySelectedAudioOutput('selection');
    }, [applySelectedAudioOutput]);

    useEffect(() => {
      if (typeof window === 'undefined' || typeof window.sessionStorage === 'undefined') {
        return;
      }

      const markInterrupted = () => {
        if (!isRunningRef.current) {
          return;
        }

        try {
          markSessionInterrupted(window.sessionStorage, new Date().toISOString());
        } catch {
          // Non-fatal in private/incognito contexts.
        }

        persistSafeModeMarker('unexpected-page-unload');
      };

      window.addEventListener('beforeunload', markInterrupted);
      window.addEventListener('pagehide', markInterrupted);

      return () => {
        window.removeEventListener('beforeunload', markInterrupted);
        window.removeEventListener('pagehide', markInterrupted);
      };
    }, [persistSafeModeMarker]);

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

        const onWindowFocus = () => {
          if (!isRunning) return;

          void (async () => {
            await tryResumeAudio('visibility');
          })();
        };

        const onPageShow = () => {
          if (!isRunning) {
            return;
          }

          setStatusMessage('Session resumed after page restore; verifying audio/device state...');
          void (async () => {
            await tryResumeAudio('visibility');
          })();
          void refreshPermissionState();
        };

        document.addEventListener('visibilitychange', onVisibilityChange);
        window.addEventListener('focus', onWindowFocus);
        window.addEventListener('pageshow', onPageShow);
        return () => {
          document.removeEventListener('visibilitychange', onVisibilityChange);
          window.removeEventListener('focus', onWindowFocus);
          window.removeEventListener('pageshow', onPageShow);
        };
    }, [isRunning, refreshPermissionState, pushDiagnosticEvent, tryResumeAudio]);

    useEffect(() => {
      if (typeof navigator === 'undefined' || !('usb' in navigator) || typeof navigator.usb.addEventListener !== 'function') {
        return;
      }

      const onUsbConnect = (event: Event) => {
        if (!isWebUsbSource(sourceType) || isRunningRef.current) {
          return;
        }

        const usbEvent = event as unknown as { device?: USBDevice };
        const product = usbEvent.device?.productName ?? 'USB device';

        setStatusMessage(`${product} detected. Press Start to resume streaming.`);
        pushDiagnosticEvent(`USB connect detected for ${product}; resume-ready.`, 'info', 'webusb');
        void refreshPermissionState();
      };

      const onUsbDisconnect = (event: Event) => {
        if (!isRunningRef.current || !isWebUsbSource(sourceType)) {
          return;
        }

        const usbEvent = event as unknown as { device?: USBDevice };
        const product = usbEvent.device?.productName ?? 'active device';

        setIsRunning(false);
        setConnectionState('error');
        setAudioState('awaiting-user-gesture');
        setStatusMessage(`${product} disconnected. Reconnect the device and press Start.`);
        pushDiagnosticEvent(`USB disconnect detected for ${product}; stream halted.`, 'warn', 'webusb');
        persistSafeModeMarker('mid-stream-usb-disconnect');
        postToWorker({ command: 'STOP' });
        audioRef.current?.stop();

        const active = deviceRef.current;
        deviceRef.current = null;
        if (active) {
          void active.close().catch((closeError) => {
            console.debug('Cleanup after USB disconnect failed:', closeError);
          });
        }
      };

      navigator.usb.addEventListener('connect', onUsbConnect as EventListener);
      navigator.usb.addEventListener('disconnect', onUsbDisconnect as EventListener);
      return () => {
        navigator.usb.removeEventListener('connect', onUsbConnect as EventListener);
        navigator.usb.removeEventListener('disconnect', onUsbDisconnect as EventListener);
      };
    }, [persistSafeModeMarker, postToWorker, pushDiagnosticEvent, refreshPermissionState, sourceType]);

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
      }, [isRunning, postToWorker]);

      useEffect(() => {
        if (!isRunning) return;

        const intervalId = window.setInterval(() => {
          const stats = audioRef.current?.getStats();
          if (!stats) return;

          if (lastAudioQueueAheadMsRef.current === null) {
            lastAudioQueueAheadMsRef.current = stats.queueAheadMs;
          }

          const queueDeltaMs = Math.abs(stats.queueAheadMs - (lastAudioQueueAheadMsRef.current ?? stats.queueAheadMs));
          queueJitterEwmaMsRef.current = queueJitterEwmaMsRef.current <= 0
            ? queueDeltaMs
            : (queueJitterEwmaMsRef.current * 0.9) + (queueDeltaMs * 0.1);
          lastAudioQueueAheadMsRef.current = stats.queueAheadMs;

          const previousRatio = lastAudioPllRatioRef.current;
          const currentRatio = audioPllState.ratio;
          let ratioDeltaPpm = 0;
          if (typeof previousRatio === 'number' && previousRatio > 0) {
            ratioDeltaPpm = Math.abs((currentRatio - previousRatio) / previousRatio) * 1_000_000;
          }
          lastAudioPllRatioRef.current = currentRatio;

          setRuntimeTelemetry((prev) => ({
            ...prev,
            audioUnderruns: stats.underruns,
            audioQueueAheadMs: stats.queueAheadMs,
            audioQueueJitterMs: queueJitterEwmaMsRef.current,
            audioResamplerRatio: currentRatio,
            audioResamplerRatioDeltaPpm: ratioDeltaPpm,
            audioConcealmentEvents: stats.concealmentEvents,
            audioPopSuppressionEvents: stats.popSuppressionEvents,
            audioLimiterEvents: stats.limiterEvents,
            audioSafetyMuteEvents: stats.safetyMuteEvents
          }));

          telemetryWindowRef.current = [
            ...telemetryWindowRef.current,
            {
              ts: new Date().toISOString(),
              renderFps: runtimeTelemetryRef.current.renderFps,
              audioUnderruns: stats.underruns,
              audioQueueAheadMs: stats.queueAheadMs,
              audioSafetyMuteEvents: stats.safetyMuteEvents,
              totalDroppedSamples: runtimeTelemetryRef.current.totalDroppedSamples,
              droppedFrameEvents: runtimeTelemetryRef.current.droppedFrameEvents,
              streamDiscontinuities: runtimeTelemetryRef.current.streamDiscontinuities,
              workerTransportMode: runtimeTelemetryRef.current.workerTransportMode
            }
          ].slice(-120);

          referenceLockSamplesRef.current = [
            ...referenceLockSamplesRef.current,
            {
              tsIso: new Date().toISOString(),
              driftConfidence01: frequencyModelState.driftConfidence,
              phaseErrorRms: frequencyModelState.phaseErrorRms,
              audioResamplerRatioDeltaPpm: ratioDeltaPpm,
              usbTransferJitterMs: deviceRef.current?.getDebugSnapshot?.().counters?.transferIntervalMsJitter ?? 0,
              usbErrorCount: deviceRef.current?.getDebugSnapshot?.().counters?.bulkInErrorCount ?? 0
            }
          ].slice(-240);

          postToWorker({ command: 'SET_AUDIO_QUEUE_AHEAD_MS', value: stats.queueAheadMs });

          // Sample high-rate USB metrics at UI cadence to avoid per-transfer rerenders.
          setUsbIqRms(usbIqRmsRef.current);
          setUsbIqMeanAbs(usbIqMeanAbsRef.current);
          setUsbTransferBytes(usbTransferBytesRef.current);
          setUsbTransferCount(usbTransferCountRef.current);

          const debugSnapshot = deviceRef.current?.getDebugSnapshot?.();
          if (debugSnapshot) {
            setDeviceDebugSnapshot(debugSnapshot);
          }
        }, 500);

        return () => window.clearInterval(intervalId);
        }, [audioPllState.ratio, frequencyModelState.driftConfidence, frequencyModelState.phaseErrorRms, isRunning, postToWorker]);

      useEffect(() => {
        if (!isRunning || !adaptiveStreamingEnabled) {
          return;
        }

        const intervalId = window.setInterval(() => {
          const snapshot = deviceRef.current?.getDebugSnapshot?.();
          const counters = snapshot?.counters;
          if (!counters || !deviceRef.current?.setStreamingProfile || sourceType !== 'HACKRF') {
            return;
          }

          const recommended = recommendUsbStreamingProfile({
            transferIntervalMsAvg: counters.transferIntervalMsAvg,
            transferIntervalMsJitter: counters.transferIntervalMsJitter,
            shortPacketRatio: counters.shortPacketRatio,
            retryCount: counters.retryCount,
            bulkInErrorCount: counters.bulkInErrorCount,
            audioUnderruns: runtimeTelemetryRef.current.audioUnderruns,
            droppedFrameEvents: runtimeTelemetryRef.current.droppedFrameEvents
          });

          if (recommended === usbStreamingProfile) {
            return;
          }

          void applyUsbStreamingProfile(recommended)
            .then(() => {
              pushDiagnosticEvent(`Adaptive streaming policy moved to ${recommended} profile.`);
            })
            .catch(() => {
              pushDiagnosticEvent(`Adaptive streaming policy failed to apply ${recommended} profile.`, 'warn');
            });
        }, 4_000);

        return () => {
          window.clearInterval(intervalId);
        };
      }, [adaptiveStreamingEnabled, applyUsbStreamingProfile, isRunning, pushDiagnosticEvent, sourceType, usbStreamingProfile]);

    useEffect(() => {
      fftDataRef.current = fftData;
      detectorHistoryRef.current = [...detectorHistoryRef.current, fftData.slice()].slice(-32);
    }, [fftData]);

    useEffect(() => {
      runtimeTelemetryRef.current = runtimeTelemetry;
    }, [runtimeTelemetry]);

    useEffect(() => {
      isRunningRef.current = isRunning;
    }, [isRunning]);

    useEffect(() => {
      if (typeof BroadcastChannel === 'undefined') {
        return;
      }

      const channel = new BroadcastChannel(WEBUSB_CONTENTION_CHANNEL);
      contentionChannelRef.current = channel;

      const onMessage = (event: MessageEvent<unknown>) => {
        const payload = event.data as { type?: string; source?: SourceType; from?: string };
        if (!payload || typeof payload !== 'object' || payload.from === tabIdRef.current) {
          return;
        }

        if (payload.type === 'webusb-claim-probe' && isRunningRef.current && isWebUsbSource(sourceType)) {
          channel.postMessage({
            type: 'webusb-claim-active',
            source: sourceType,
            from: tabIdRef.current
          });
        }
      };

      channel.addEventListener('message', onMessage as EventListener);
      return () => {
        channel.removeEventListener('message', onMessage as EventListener);
        contentionChannelRef.current = null;
        channel.close();
      };
    }, [sourceType]);

    const checkWebUsbContention = useCallback(async () => {
      if (!isWebUsbSource(sourceType) || !contentionChannelRef.current) {
        return false;
      }

      const channel = contentionChannelRef.current;
      const contenders = new Set<string>();
      const collect = (event: MessageEvent<unknown>) => {
        const payload = event.data as { type?: string; from?: string };
        if (payload?.type === 'webusb-claim-active' && payload.from && payload.from !== tabIdRef.current) {
          contenders.add(payload.from);
        }
      };

      channel.addEventListener('message', collect as EventListener);
      channel.postMessage({
        type: 'webusb-claim-probe',
        source: sourceType,
        from: tabIdRef.current
      });

      await new Promise<void>((resolve) => {
        window.setTimeout(() => resolve(), 220);
      });

      channel.removeEventListener('message', collect as EventListener);

      const hasContention = contenders.size > 0;
      setWebUsbContention(hasContention ? 'contended' : 'clear');
      return hasContention;
    }, [sourceType]);

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

    const openCommandPalette = useCallback(() => {
      commandPaletteInvokerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setShortcutsHelpOpen(false);
      setCommandPaletteOpen(true);
    }, []);

    const closeCommandPalette = useCallback(() => {
      const invoker = commandPaletteInvokerRef.current;
      setCommandPaletteOpen(false);
      setCommandPaletteQuery('');
      window.setTimeout(() => {
        invoker?.focus();
      }, 0);
    }, []);

    const openShortcutsHelp = useCallback(() => {
      shortcutsHelpInvokerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setCommandPaletteOpen(false);
      setCommandPaletteQuery('');
      setShortcutsHelpOpen(true);
      pushDiagnosticEvent('shortcut_help_opened', 'info', 'shortcut');
    }, [pushDiagnosticEvent]);

    const closeShortcutsHelp = useCallback(() => {
      const invoker = shortcutsHelpInvokerRef.current;
      setShortcutsHelpOpen(false);
      window.setTimeout(() => {
        invoker?.focus();
      }, 0);
    }, []);

    const commitFrequencyInputDraft = useCallback(() => {
      const parsedMhz = parseFloat(frequencyInputDraftMhz);
      if (!Number.isFinite(parsedMhz)) {
        setFrequencyInputDraftMhz((tunedDisplayFrequencyHz / 1_000_000).toFixed(3));
        setStatusMessage('Frequency edit is invalid. Restored last tuned value.');
        pushDiagnosticEvent('shortcut_blocked_due_to_focus:freq-commit-invalid', 'warn', 'shortcut');
        return;
      }

      const nextDisplayFrequencyHz = Math.max(0, Math.floor(parsedMhz * 1_000_000));
      const appliedDisplayHz = tuneToDisplayFrequency(nextDisplayFrequencyHz);
      setFrequencyInputDraftMhz((appliedDisplayHz / 1_000_000).toFixed(3));
      setStatusMessage(`Display frequency set to ${(appliedDisplayHz / 1_000_000).toFixed(3)} MHz.`);
      pushDiagnosticEvent('shortcut_invoked:freq-commit', 'info', 'shortcut');
    }, [frequencyInputDraftMhz, pushDiagnosticEvent, tuneToDisplayFrequency, tunedDisplayFrequencyHz]);

    const cancelFrequencyInputDraft = useCallback(() => {
      setFrequencyInputDraftMhz((tunedDisplayFrequencyHz / 1_000_000).toFixed(3));
      setStatusMessage('Frequency edit canceled.');
      pushDiagnosticEvent('shortcut_invoked:freq-cancel', 'info', 'shortcut');
    }, [pushDiagnosticEvent, tunedDisplayFrequencyHz]);

    useEffect(() => {
      const focusedElement = typeof document !== 'undefined' ? document.activeElement : null;
      if (focusedElement !== frequencyInputRef.current) {
        setFrequencyInputDraftMhz((tunedDisplayFrequencyHz / 1_000_000).toFixed(3));
      }
    }, [tunedDisplayFrequencyHz]);

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            const target = event.target as HTMLElement | null;
            const isTyping = target?.tagName === 'INPUT' || target?.tagName === 'SELECT' || target?.tagName === 'TEXTAREA';
            const frequencyInputFocused = typeof document !== 'undefined' && document.activeElement === frequencyInputRef.current;

            if (frequencyInputFocused && event.key === 'Enter') {
              event.preventDefault();
              commitFrequencyInputDraft();
              frequencyInputRef.current?.blur();
              return;
            }

            if (frequencyInputFocused && (event.key === 'Escape' || event.key === 'Esc')) {
              event.preventDefault();
              cancelFrequencyInputDraft();
              frequencyInputRef.current?.blur();
              return;
            }

            const openHelpOverlay = event.key === 'F1' || event.key === '?';
            if (openHelpOverlay) {
              event.preventDefault();
              openShortcutsHelp();
              return;
            }

            const openPalette = (event.ctrlKey || event.metaKey) && (event.key === 'k' || event.key === 'K');
            if (openPalette) {
              event.preventDefault();
              openCommandPalette();
              pushDiagnosticEvent('shortcut_invoked:command-palette', 'info', 'shortcut');
              return;
            }

            if (shortcutsHelpOpen) {
              if (event.key === 'Escape' || event.key === 'Esc') {
                event.preventDefault();
                closeShortcutsHelp();
              }
              return;
            }

            if (commandPaletteOpen) {
              if (event.key === 'Escape' || event.key === 'Esc') {
                event.preventDefault();
                closeCommandPalette();
              }
              return;
            }

            const primaryModifier = event.ctrlKey || event.metaKey;

            if (primaryModifier && event.shiftKey && (event.key === 'D' || event.key === 'd')) {
              event.preventDefault();
              exportDiagnosticsShortcutRef.current?.();
              pushDiagnosticEvent('shortcut_invoked:export-diagnostics', 'info', 'shortcut');
              return;
            }

            if (primaryModifier && event.key === '/') {
              event.preventDefault();
              setDiagnosticsLogOpen((prev) => !prev);
              pushDiagnosticEvent('shortcut_invoked:toggle-diagnostics-log', 'info', 'shortcut');
              return;
            }

            if ((primaryModifier || event.altKey) && (event.key === 'l' || event.key === 'L')) {
              event.preventDefault();
              frequencyInputRef.current?.focus();
              frequencyInputRef.current?.select();
              pushDiagnosticEvent('shortcut_invoked:focus-frequency-input', 'info', 'shortcut');
              return;
            }

            if (primaryModifier && (event.key === 'r' || event.key === 'R')) {
              event.preventDefault();
              if (!isRunning || connectionState === 'error') {
                streamToggleShortcutRef.current?.();
                setStatusMessage('Reconnect requested.');
                pushDiagnosticEvent('shortcut_invoked:reconnect', 'info', 'shortcut');
              } else {
                pushDiagnosticEvent('shortcut_conflict_fallback_used:reconnect-ignored-running', 'info', 'shortcut');
              }
              return;
            }

            if (primaryModifier && (event.key === 'e' || event.key === 'E')) {
              event.preventDefault();
              if (connectionState === 'error') {
                streamToggleShortcutRef.current?.();
                setStatusMessage('Retrying last failed stream action.');
                pushDiagnosticEvent('shortcut_invoked:retry-last-failure', 'info', 'shortcut');
              } else {
                pushDiagnosticEvent('shortcut_conflict_fallback_used:retry-no-error-state', 'info', 'shortcut');
              }
              return;
            }

            if (isTyping) {
              return;
            }

            if (event.key === ' ') {
              event.preventDefault();
              streamToggleShortcutRef.current?.();
              pushDiagnosticEvent('shortcut_invoked:stream-toggle', 'info', 'shortcut');
              return;
            }

            if (event.key === 'm' || event.key === 'M') {
                event.preventDefault();
                setIsMuted((prev) => {
                    const nextMuted = !prev;
                    audioRef.current?.setMuted(nextMuted);
                    setAudioState(nextMuted ? 'muted' : isRunning ? 'running' : audioState);
                    setStatusMessage(nextMuted ? 'Audio muted.' : 'Audio unmuted.');
                    pushDiagnosticEvent(nextMuted ? 'Audio muted by keyboard.' : 'Audio unmuted by keyboard.');
                    pushDiagnosticEvent('shortcut_invoked:mute-toggle', 'info', 'shortcut');
                    return nextMuted;
                });
                return;
            }

            if (event.key === 'p' || event.key === 'P') {
              event.preventDefault();
              setIsMuted(true);
              audioRef.current?.setMuted(true);
              setAudioState('muted');
              setStatusMessage('Panic mute engaged.');
              pushDiagnosticEvent('Panic mute engaged by keyboard.');
              pushDiagnosticEvent('shortcut_invoked:panic-mute', 'info', 'shortcut');
              return;
            }

            if (event.key === 'ArrowRight') {
                event.preventDefault();

                if (event.shiftKey) {
                  const stepHz = tuningStepHz * 10;
                  tuneToDisplayFrequency(tunedDisplayFrequencyHz + stepHz);
                  setStatusMessage(`Large tune step +${stepHz.toLocaleString()} Hz.`);
                  pushDiagnosticEvent(`Keyboard tune step +${stepHz} Hz (large).`, 'info', 'analyzer');
                  return;
                }

                if (event.altKey) {
                  const fineStepHz = Math.max(1, Math.floor(fineTuningStepHz / 10));
                  setFineFreq((prev) => clampFineTuneHz(prev + fineStepHz, filterState.highCutHz, streamSampleRateHz));
                  setStatusMessage(`Fine tune step +${fineStepHz.toLocaleString()} Hz.`);
                  pushDiagnosticEvent(`Keyboard fine tune +${fineStepHz} Hz (alt).`, 'info', 'analyzer');
                  return;
                }

                tuneToDisplayFrequency(tunedDisplayFrequencyHz + tuningStepHz);
                setStatusMessage(`Tune step +${tuningStepHz.toLocaleString()} Hz.`);
                pushDiagnosticEvent(`Keyboard tune step +${tuningStepHz} Hz.`, 'info', 'analyzer');
                return;
            }

            if (event.key === 'ArrowLeft') {
                event.preventDefault();

                if (event.shiftKey) {
                  const stepHz = tuningStepHz * 10;
                  tuneToDisplayFrequency(Math.max(0, tunedDisplayFrequencyHz - stepHz));
                  setStatusMessage(`Large tune step -${stepHz.toLocaleString()} Hz.`);
                  pushDiagnosticEvent(`Keyboard tune step -${stepHz} Hz (large).`, 'info', 'analyzer');
                  return;
                }

                if (event.altKey) {
                  const fineStepHz = Math.max(1, Math.floor(fineTuningStepHz / 10));
                  setFineFreq((prev) => clampFineTuneHz(prev - fineStepHz, filterState.highCutHz, streamSampleRateHz));
                  setStatusMessage(`Fine tune step -${fineStepHz.toLocaleString()} Hz.`);
                  pushDiagnosticEvent(`Keyboard fine tune -${fineStepHz} Hz (alt).`, 'info', 'analyzer');
                  return;
                }

                tuneToDisplayFrequency(Math.max(0, tunedDisplayFrequencyHz - tuningStepHz));
                setStatusMessage(`Tune step -${tuningStepHz.toLocaleString()} Hz.`);
                pushDiagnosticEvent(`Keyboard tune step -${tuningStepHz} Hz.`, 'info', 'analyzer');
                return;
            }

            if (event.key === 'ArrowUp') {
              event.preventDefault();
              setFineFreq((prev) => clampFineTuneHz(prev + fineTuningStepHz, filterState.highCutHz, streamSampleRateHz));
              setStatusMessage(`Fine tune +${fineTuningStepHz.toLocaleString()} Hz.`);
              pushDiagnosticEvent(`Keyboard fine tune +${fineTuningStepHz} Hz.`, 'info', 'analyzer');
              return;
            }

            if (event.key === 'ArrowDown') {
              event.preventDefault();
              setFineFreq((prev) => clampFineTuneHz(prev - fineTuningStepHz, filterState.highCutHz, streamSampleRateHz));
              setStatusMessage(`Fine tune -${fineTuningStepHz.toLocaleString()} Hz.`);
              pushDiagnosticEvent(`Keyboard fine tune -${fineTuningStepHz} Hz.`, 'info', 'analyzer');
            }
        };

        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [
      audioState,
      closeCommandPalette,
      closeShortcutsHelp,
      commitFrequencyInputDraft,
      commandPaletteOpen,
      connectionState,
      cancelFrequencyInputDraft,
      fineTuningStepHz,
      filterState.highCutHz,
      isRunning,
      openCommandPalette,
      openShortcutsHelp,
      pushDiagnosticEvent,
      shortcutsHelpOpen,
      streamSampleRateHz,
      tuneToDisplayFrequency,
      tunedDisplayFrequencyHz,
      tuningStepHz
    ]);

  // Update Device Frequency when controls change
  useEffect(() => {
    if (deviceRef.current && isRunning) {
        deviceRef.current.setFrequency(frequency);
        postToWorker({ command: 'RESET_RDS' });
    }
    postToWorker({ command: 'SET_TUNED_FREQUENCY', value: frequency });
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
    if (activeVfoId === 'aux' && !secondaryVfoEnabled) {
      setActiveVfoId('main');
    }
  }, [activeVfoId, secondaryVfoEnabled]);

  useEffect(() => {
    if (!secondaryVfoEnabled && vfoAudioRoute === 'aux') {
      setVfoAudioRoute('main');
    }
  }, [secondaryVfoEnabled, vfoAudioRoute]);

  useEffect(() => {
    const region = getBandRegionPlan(bandRegionId);
    if (region.bands.length === 0) {
      return;
    }

    const existing = region.bands.some((band) => band.id === selectedBandId);
    if (!existing) {
      setSelectedBandId(region.bands[0].id);
    }
  }, [bandRegionId, selectedBandId]);

  useEffect(() => {
    const validation = validateBandMode(selectedBand, demodMode as InteractionDemodMode);
    setBandGuardrailWarning(validation.warning);
    setBandGuardrailPromptDismissed(false);
  }, [demodMode, selectedBand]);

  useEffect(() => {
    if (!autoApplyBandDefaults || !selectedBand) {
      return;
    }

    const validation = validateBandMode(selectedBand, demodMode as InteractionDemodMode);
    if (!validation.valid) {
      setDemodMode(selectedBand.defaultMode as DemodMode);
      setStatusMessage(`Band defaults applied: mode -> ${selectedBand.defaultMode}.`);
    }

    const suggestedStepHz = stepForBandModeHz(
      selectedBand,
      demodMode as InteractionDemodMode,
      defaultStepForModeHz(demodMode as InteractionDemodMode)
    );
    setTuningStepHz(suggestedStepHz);
    setFineTuningStepHz(Math.max(50, Math.min(1_000, Math.floor(suggestedStepHz / 10) || 50)));

    if (selectedBand.preferredNfmPreset && demodMode === 'NFM' && nfmAudioPreset !== selectedBand.preferredNfmPreset) {
      setNfmAudioPreset(selectedBand.preferredNfmPreset);
      setStatusMessage(`Band defaults applied: NFM preset -> ${selectedBand.preferredNfmPreset}.`);
    }
  }, [autoApplyBandDefaults, demodMode, nfmAudioPreset, selectedBand]);

  useEffect(() => {
    if (!selectedBand) {
      return;
    }

    let constrainedDisplayHz = tunedDisplayFrequencyHz;
    if (enforceBandLimits) {
      constrainedDisplayHz = clampFrequencyToBandHz(constrainedDisplayHz, selectedBand);
    }

    if (bandRasterSnapEnabled) {
      constrainedDisplayHz = snapFrequencyToRasterHz(constrainedDisplayHz, selectedBand.rasterHz, selectedBand.startHz);
    }

    if (Math.round(constrainedDisplayHz) !== Math.round(tunedDisplayFrequencyHz)) {
      const appliedDisplayHz = tuneToDisplayFrequency(constrainedDisplayHz);
      setFrequencyInputDraftMhz((appliedDisplayHz / 1_000_000).toFixed(3));
    }
  }, [bandRasterSnapEnabled, enforceBandLimits, selectedBand, tuneToDisplayFrequency, tunedDisplayFrequencyHz]);

  useEffect(() => {
    if (!markerBindingState.enabled || !markerBindingState.followVfo) {
      return;
    }

    const boundMarkerHz = resolveVfoDisplayFrequencyHz(
      markerBindingState.boundVfoId,
      tunedDisplayFrequencyHz,
      secondaryVfoEnabled,
      secondaryVfoOffsetHz
    );

    setAnalyzerMarker((prev) => {
      if (prev && Math.round(prev.frequencyHz) === Math.round(boundMarkerHz)) {
        return prev;
      }

      return {
        frequencyHz: boundMarkerHz,
        placedAtIso: prev?.placedAtIso ?? new Date().toISOString()
      };
    });
  }, [
    markerBindingState.boundVfoId,
    markerBindingState.enabled,
    markerBindingState.followVfo,
    secondaryVfoEnabled,
    secondaryVfoOffsetHz,
    tunedDisplayFrequencyHz
  ]);

  useEffect(() => {
    if (!isRunning) {
      return;
    }

    setTuneHistory((prev) => appendTuneHistory(prev, {
      tunedAtIso: new Date().toISOString(),
      displayFrequencyHz: Math.round(tunedDisplayFrequencyHz),
      tunerFrequencyHz: Math.round(tunedTunerFrequencyHz),
      demodMode: demodMode as InteractionDemodMode
    }, 12, Math.max(20, Math.floor(tuningStepHz / 4))));
  }, [demodMode, isRunning, tunedDisplayFrequencyHz, tunedTunerFrequencyHz, tuningStepHz]);

  useEffect(() => {
    if (!isRunning) {
      return;
    }

    const isHeard = noiseSquelchState.open || demodQuality.lockState !== 'searching';
    if (!isHeard) {
      return;
    }

    const nowMs = Date.now();
    if (nowMs - lastHeardCaptureAtMsRef.current < 1500) {
      return;
    }

    lastHeardCaptureAtMsRef.current = nowMs;
    setHeardHistory((prev) => appendHeardHistory(prev, {
      heardAtIso: new Date(nowMs).toISOString(),
      displayFrequencyHz: Math.round(tunedDisplayFrequencyHz),
      demodMode: demodMode as InteractionDemodMode,
      snrEstimateDb: demodQuality.snrEstimateDb,
      lockState: demodQuality.lockState
    }, 12, Math.max(500, tuningStepHz)));
  }, [
    demodMode,
    demodQuality.lockState,
    demodQuality.snrEstimateDb,
    isRunning,
    noiseSquelchState.open,
    tunedDisplayFrequencyHz,
    tuningStepHz
  ]);

  useEffect(() => {
    postToWorker({ command: 'SET_NFM_AUDIO_PRESET', value: nfmAudioPreset });
  }, [nfmAudioPreset, postToWorker]);

  useEffect(() => {
    postToWorker({ command: 'SET_NFM_OUTPUT_PATH', value: nfmOutputPath });
  }, [nfmOutputPath, postToWorker]);

  useEffect(() => {
    postToWorker({ command: 'SET_TONE_DECODE_MODE', value: toneDecodeMode });
  }, [postToWorker, toneDecodeMode]);

  useEffect(() => {
    const clamped = clampFilterForMode(demodMode, filterState.lowCutHz, filterState.highCutHz, streamSampleRateHz);
    if (clamped.lowCutHz !== filterState.lowCutHz || clamped.highCutHz !== filterState.highCutHz) {
      setFilterState((prev) => ({
        ...prev,
        lowCutHz: clamped.lowCutHz,
        highCutHz: clamped.highCutHz
      }));
    }
  }, [demodMode, filterState.highCutHz, filterState.lowCutHz, streamSampleRateHz]);

  const streamRatePlan = useMemo(
    () => planStreamRateForMode(demodMode, filterState.highCutHz, streamRateCandidates),
    [demodMode, filterState.highCutHz, streamRateCandidates]
  );

  const aliasSafeHighCutHz = useMemo(
    () => aliasSafeHighCutMaxHz(streamSampleRateHz),
    [streamSampleRateHz]
  );

  const maxFineTuneHz = useMemo(
    () => maxFineTuneHzForFilter(filterState.highCutHz, streamSampleRateHz),
    [filterState.highCutHz, streamSampleRateHz]
  );

  useEffect(() => {
    setFineFreq((prev) => clampFineTuneHz(prev, filterState.highCutHz, streamSampleRateHz));
  }, [filterState.highCutHz, streamSampleRateHz]);

  useEffect(() => {
    if (isRunning || streamSampleRateHzRef.current === streamRatePlan.sampleRateHz) {
      return;
    }

    streamSampleRateHzRef.current = streamRatePlan.sampleRateHz;
    setStreamSampleRateHz(streamRatePlan.sampleRateHz);
  }, [isRunning, streamRatePlan.sampleRateHz]);

  useEffect(() => {
    if (!isRunning || !deviceRef.current) {
      return;
    }

    const requestedRate = streamRatePlan.sampleRateHz;
    if (requestedRate === streamSampleRateHzRef.current) {
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        await deviceRef.current?.setSampleRate(requestedRate);
        if (cancelled) {
          return;
        }

        streamSampleRateHzRef.current = requestedRate;
        setStreamSampleRateHz(requestedRate);
        postToWorker({ command: 'SET_SAMPLE_RATE', value: requestedRate });
        pushDiagnosticEvent(`Auto sample-rate plan applied: ${(requestedRate / 1_000).toFixed(0)} kHz (decim ${streamRatePlan.decimationFactor} -> ${(streamRatePlan.outputSampleRateHz / 1_000).toFixed(1)} kHz).`);
      } catch {
        if (!cancelled) {
          pushDiagnosticEvent('Auto sample-rate plan could not be applied by source; keeping current rate.');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    isRunning,
    postToWorker,
    pushDiagnosticEvent,
    streamRatePlan.decimationFactor,
    streamRatePlan.outputSampleRateHz,
    streamRatePlan.sampleRateHz
  ]);

  // Update Fine Freq
  useEffect(() => {
    postToWorker({ command: 'SET_FINE_FREQ', value: fineFreq });
  }, [fineFreq, postToWorker]);

  useEffect(() => {
    postToWorker({ command: 'SET_PPM_CORRECTION', value: ppmCorrection });
  }, [ppmCorrection, postToWorker]);

  useEffect(() => {
    postToWorker({ command: 'SET_AUDIO_LEVELER_ENABLED', value: audioLevelerState.enabled });
  }, [audioLevelerState.enabled, postToWorker]);

  useEffect(() => {
    postToWorker({ command: 'SET_AGC_ENABLED', value: agcState.enabled });
  }, [agcState.enabled, postToWorker]);

  useEffect(() => {
    postToWorker({ command: 'SET_IMPULSE_BLANKER_ENABLED', value: impulseBlankerState.enabled });
  }, [impulseBlankerState.enabled, postToWorker]);

  useEffect(() => {
    postToWorker({ command: 'SET_IQ_CORRECTION_ENABLED', value: iqCorrectionEnabled });
  }, [iqCorrectionEnabled, postToWorker]);

  useEffect(() => {
    postToWorker({ command: 'SET_AFC_ENABLED', value: afcEnabled });
  }, [afcEnabled, postToWorker]);

  useEffect(() => {
    postToWorker({ command: 'SET_STABILITY_MODE', value: stabilityModeEnabled });
  }, [postToWorker, stabilityModeEnabled]);

  useEffect(() => {
    setStabilityProfile(getStabilityProfile(activeDeviceProfileKey));
  }, [activeDeviceProfileKey]);

  useEffect(() => {
    if (!isRunning || !stabilityModeEnabled) {
      return;
    }

    if (frequencyModelState.driftConfidence < 0.2) {
      return;
    }

    const now = Date.now();
    if (now - lastProfilePersistAtRef.current < 5_000) {
      return;
    }
    lastProfilePersistAtRef.current = now;

    const profileKey = activeDeviceProfileKey;
    const existing = getStabilityProfile(profileKey);
    const next = upsertStabilityProfile({
      sourceType,
      profileKey,
      updatedAtUtc: new Date(now).toISOString(),
      driftEstimateHzPerSec: frequencyModelState.driftEstimateHzPerSec,
      driftConfidence: frequencyModelState.driftConfidence,
      phaseErrorRms: frequencyModelState.phaseErrorRms,
      ppmCorrectionHz: frequencyModelState.ppmCorrectionHz,
      iqIntegrityLastReport: existing?.iqIntegrityLastReport,
      applyOnConnect: existing?.applyOnConnect,
      calibrationSeed: existing?.calibrationSeed,
      frequencyCalibration: existing?.frequencyCalibration
    });
    setStabilityProfile(next);
  }, [
    activeDeviceProfileKey,
    frequencyModelState.driftConfidence,
    frequencyModelState.driftEstimateHzPerSec,
    frequencyModelState.phaseErrorRms,
    frequencyModelState.ppmCorrectionHz,
    isRunning,
    sourceType,
    stabilityModeEnabled
  ]);

  useEffect(() => {
    const vfos = [
      { id: 'main', offsetHz: 0 },
      ...(secondaryVfoEnabled ? [{ id: 'aux', offsetHz: secondaryVfoOffsetHz }] : [])
    ];
    postToWorker({ command: 'SET_VFOS', value: vfos });
  }, [postToWorker, secondaryVfoEnabled, secondaryVfoOffsetHz]);

  useEffect(() => {
    postToWorker({ command: 'SET_VFO_AUDIO_ROUTE', value: effectiveVfoAudioRoute });
  }, [effectiveVfoAudioRoute, postToWorker]);

  useEffect(() => {
    try {
      saveVfoPresets(localStorage, vfoPresets);
    } catch {
      // Best effort local persistence for reusable VFO preset sets.
    }
  }, [vfoPresets]);

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
      highCutHz: filterState.highCutHz,
      notchHz: filterState.notchHz,
      notchQ: filterState.notchQ
    });
  }, [filterState.highCutHz, filterState.lowCutHz, filterState.notchHz, filterState.notchQ, postToWorker]);

  useEffect(() => {
    postToWorker({ command: 'SET_FILTER_PROFILE', value: filterState.profile });
  }, [filterState.profile, postToWorker]);

  useEffect(() => {
    postToWorker({ command: 'SET_INTERFERENCE_PRESET', value: filterState.preset });
  }, [filterState.preset, postToWorker]);

  useEffect(() => {
    postToWorker({
      command: 'SET_NOISE_SQUELCH',
      enabled: noiseSquelchState.enabled,
      thresholdDb: noiseSquelchState.thresholdDb,
      hysteresisDb: noiseSquelchState.hysteresisDb,
      hangMs: noiseSquelchState.hangMs,
      tailMs: noiseSquelchState.tailMs
    });
  }, [noiseSquelchState.enabled, noiseSquelchState.hangMs, noiseSquelchState.hysteresisDb, noiseSquelchState.tailMs, noiseSquelchState.thresholdDb, postToWorker]);

  const waitFor = (ms: number) => new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });

  const waitForOrAbort = async (ms: number): Promise<boolean> => {
    const start = performance.now();

    while (!scanAbortRef.current) {
      const elapsed = performance.now() - start;
      if (elapsed >= ms) {
        return true;
      }
      await waitFor(Math.min(80, ms - elapsed));
    }

    return false;
  };

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

          if (scanDwellMs > 0) {
            setScanStepLabel(`Dwelling ${(freqHz / 1_000_000).toFixed(1)} MHz`);
            const completed = await waitForOrAbort(scanDwellMs);
            if (!completed) {
              break;
            }
          }
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

  const toggleStream = useCallback(async () => {
    if (isRunning) {
        // STOP
      applyClickFreeReconfiguration('stream-stop');
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
        streamSampleRateHzRef.current = streamRatePlan.sampleRateHz;
        setStreamSampleRateHz(streamRatePlan.sampleRateHz);
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
          audioQueueJitterMs: 0,
          audioResamplerRatio: 1,
          audioResamplerRatioDeltaPpm: 0,
          audioLimiterEvents: 0,
          audioSafetyMuteEvents: 0,
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
        telemetryWindowRef.current = [];
        referenceLockSamplesRef.current = [];
        parameterChangeTimelineRef.current = [];
        previousSessionSnapshotRef.current = buildSessionParameterSnapshot();
        lastAudioQueueAheadMsRef.current = null;
        queueJitterEwmaMsRef.current = 0;
        lastAudioPllRatioRef.current = null;
        setFrequencyModelState(defaultFrequencyModelState());
        setAudioPllState(defaultAudioPllState());
        setVfoState(defaultVfoRuntimeState());
        setWfmStereoState(defaultWfmStereoState());
        setSessionGradeLockedAtIso(null);
        setSessionGradeLockInvalidatedReason(null);
        setDeviceDebugSnapshot(null);
        streamSessionStartedAtRef.current = null;
    } else {
        // START
        setConnectionState('pairing');
        setStatusMessage('Pairing and opening selected source...');
        try {
            const hasContention = await checkWebUsbContention();
            if (hasContention) {
              setConnectionState('error');
              setAudioState('awaiting-user-gesture');
              setStatusMessage('Device appears to be claimed by another tab/session. Close it and retry.');
              pushDiagnosticEvent('WebUSB contention detected before start; launch blocked.', 'warn', 'webusb');
              return;
            }

            await tryResumeAudio('startup');
          audioRef.current?.resetStats();
            audioRef.current?.setMuted(isMuted);
            audioRef.current?.setOutputLevel(audioOutputLevel);
            audioRef.current?.setMaxOutputLevel(audioMaxOutputLevel);
            audioRef.current?.setSafetyConfig({ maxOutputLevel: audioMaxOutputLevel });
            await applySelectedAudioOutput('startup');
            const state = audioRef.current?.getState();
            if (state !== 'running') {
                setAudioState('awaiting-user-gesture');
                setStatusMessage('Audio requires user gesture. Use Enable Audio if blocked.');
            }

            let dev: ISDRDevice;
            switch (sourceType) {
                case 'HACKRF': dev = new HackRFDevice(); break;
                case 'RTLSDR': dev = new RtlSdrDevice(); break;
                case 'AIRSPY': dev = new AirspyBridgeDevice(); break;
                case 'SDRPLAY': dev = new SdrplayBridgeDevice(); break;
                case 'PLUTO': dev = new PlutoSdrBridgeDevice(); break;
                case 'LIMESDR': dev = new LimeSdrBridgeDevice(); break;
              case 'FILE': dev = new FileDevice(goldenToneFixtureBundle); break;
                case 'MOCK': default: dev = new MockDevice(); break;
            }

            await dev.open();
            deviceRef.current = dev;
            setDeviceDebugSnapshot(dev.getDebugSnapshot?.() ?? null);
            setConnectionState('connected');
            setStatusMessage(`Connected to ${dev.name}. Configuring stream...`);
            pushDiagnosticEvent(`${dev.name} opened.`);

            // Initialize Gain UI from Device Capabilities
            const stages = dev.getGainStages();
            setGainStages(stages);
            
            const initialGains: Record<string, number> = {};
            for (const stage of stages) {
                initialGains[stage.name] = stage.value;
            }

            const profileIdentity = deriveStableDeviceIdentity(sourceType, dev.name, dev.getDebugSnapshot?.() ?? null);
            const persistedProfile = getStabilityProfile(profileIdentity.key);
            const applyOnConnect = persistedProfile?.applyOnConnect;
            let nextPpmCorrection = ppmCorrection;
            let nextSampleRateHz = streamRatePlan.sampleRateHz;
            const nextGains: Record<string, number> = { ...initialGains };

            if (applyOnConnect?.enabled) {
              if (typeof applyOnConnect.sampleRateHz === 'number' && Number.isFinite(applyOnConnect.sampleRateHz) && applyOnConnect.sampleRateHz > 0) {
                nextSampleRateHz = Math.round(applyOnConnect.sampleRateHz);
              }

              if (typeof applyOnConnect.ppmCorrection === 'number' && Number.isFinite(applyOnConnect.ppmCorrection)) {
                nextPpmCorrection = applyOnConnect.ppmCorrection;
              }

              if (applyOnConnect.gains) {
                for (const stage of stages) {
                  const candidate = applyOnConnect.gains[stage.name];
                  if (typeof candidate === 'number' && Number.isFinite(candidate)) {
                    const clamped = Math.max(stage.min, Math.min(stage.max, candidate));
                    nextGains[stage.name] = clamped;
                  }
                }
              }
            }

            setGains(nextGains);
            if (nextPpmCorrection !== ppmCorrection) {
              setPpmCorrection(nextPpmCorrection);
            }
    
            // Apply initial state to Device
            streamSampleRateHzRef.current = nextSampleRateHz;
            setStreamSampleRateHz(nextSampleRateHz);
            await dev.setSampleRate(nextSampleRateHz);
            await dev.setFrequency(frequency);
            for (const stage of stages) {
                await dev.setGain(stage.name, nextGains[stage.name]);
            }

            if (dev.setRfPowerState) {
              await dev.setRfPowerState({ biasTeeEnabled: rfEnvironmentContext.biasTeeEnabled }).catch((error) => {
                const normalized = normalizeDeviceError(error);
                pushDiagnosticEvent(`RF power init skipped [${normalized.code}]: ${normalized.message}`, 'warn', 'device');
              });
            }

            if (dev.setGpioState) {
              await dev.setGpioState({ outputPins: gpioOutputs }).catch((error) => {
                const normalized = normalizeDeviceError(error);
                pushDiagnosticEvent(`GPIO init skipped [${normalized.code}]: ${normalized.message}`, 'warn', 'device');
              });
            }

            if (applyOnConnect?.enabled) {
              pushDiagnosticEvent(`Applied per-device connect profile (${profileIdentity.key}).`);
            }

            if (dev.setStreamingProfile && (usbStreamingProfile === 'low-latency' || usbStreamingProfile === 'balanced' || usbStreamingProfile === 'stable')) {
              const profile = USB_STREAMING_PROFILES[usbStreamingProfile];
              await dev.setStreamingProfile({
                transferSizeBytes: profile.transferSizeBytes,
                retryDelayMs: profile.retryDelayMs,
                maxConsecutiveFailures: profile.maxConsecutiveFailures,
                profileName: profile.name
              });
            }
    
            // Start Worker
            postToWorker({ command: 'START_USB_MODE' });
            postToWorker({ command: 'SET_MODE', value: demodMode });
            postToWorker({ command: 'SET_FINE_FREQ', value: fineFreq });
            postToWorker({ command: 'SET_TUNED_FREQUENCY', value: frequency });
            postToWorker({ command: 'SET_PPM_CORRECTION', value: nextPpmCorrection });
            postToWorker({ command: 'SET_SAMPLE_RATE', value: nextSampleRateHz });
            postToWorker({ command: 'SET_AFC_ENABLED', value: afcEnabled });
            postToWorker({ command: 'SET_STABILITY_MODE', value: stabilityModeEnabled });
            postToWorker({
              command: 'SET_VFOS',
              value: [
                { id: 'main', offsetHz: 0 },
                ...(secondaryVfoEnabled ? [{ id: 'aux', offsetHz: secondaryVfoOffsetHz }] : [])
              ]
            });

            usbIqRmsRef.current = 0;
            usbIqMeanAbsRef.current = 0;
            usbTransferBytesRef.current = 0;
            usbTransferCountRef.current = 0;
            streamSessionStartedAtRef.current = new Date();
            discontinuityTimelineRef.current = [];
            parameterChangeTimelineRef.current = [];
            previousSessionSnapshotRef.current = buildSessionParameterSnapshot();
            setSessionGradeLockedAtIso(null);
            setSessionGradeLockInvalidatedReason(null);
            lastAudioQueueAheadMsRef.current = null;
            queueJitterEwmaMsRef.current = 0;
            lastAudioPllRatioRef.current = null;
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
              appendRecordingCaptureChunkRef.current(iqBytes, new Float32Array(0));
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
                setConnectionState('recovering');
                setAudioState('awaiting-user-gesture');
                setStatusMessage(`Stream failed: ${streamErr.message}. Attempting safe recovery...`);
                pushDiagnosticEvent(`Stream runtime error [${streamErr.code}]: ${streamErr.message}`);
                persistSafeModeMarker(`stream-failure:${streamErr.code}`);

                try {
                  await dev.close();
                } catch (closeError) {
                  console.debug('Cleanup after stream failure raised an error:', closeError);
                }

                if (deviceRef.current === dev) {
                  deviceRef.current = null;
                }

                setDeviceDebugSnapshot(null);

                setConnectionState('error');
              });
    
            setIsRunning(true);
                        applyClickFreeReconfiguration('stream-start');
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
  }, [
    afcEnabled,
    applyClickFreeReconfiguration,
    applySelectedAudioOutput,
    audioMaxOutputLevel,
    audioOutputLevel,
    buildSessionParameterSnapshot,
    checkWebUsbContention,
    demodMode,
    fineFreq,
    frequency,
    isMuted,
    isRunning,
    persistSafeModeMarker,
    postToWorker,
    ppmCorrection,
    pushDiagnosticEvent,
    gpioOutputs,
    rfEnvironmentContext.biasTeeEnabled,
    secondaryVfoEnabled,
    secondaryVfoOffsetHz,
    sourceType,
    stabilityModeEnabled,
    streamRatePlan.sampleRateHz,
    tryResumeAudio,
    usbStreamingProfile
  ]);

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

    const applyIqWizardFixes = async () => {
      if (iqIntegrityAssessment.fixes.includes('enable-iq-correction')) {
        setIqCorrectionEnabled(true);
      }

      if (iqIntegrityAssessment.fixes.includes('set-latency-stable')) {
        setLatencyPolicy('stable');
      }

      if (iqIntegrityAssessment.fixes.includes('reduce-front-end-gain')) {
        const activeDevice = deviceRef.current;
        const nextGains: Record<string, number> = { ...gains };

        for (const stage of gainStages) {
          const current = nextGains[stage.name] ?? stage.value;
          nextGains[stage.name] = Math.max(stage.min, current - 6);
        }

        setGains(nextGains);

        if (activeDevice) {
          for (const stage of gainStages) {
            try {
              await activeDevice.setGain(stage.name, nextGains[stage.name]);
            } catch {
              pushDiagnosticEvent(`IQ wizard could not apply gain change for ${stage.name}.`, 'warn');
            }
          }
        }
      }

      setStatusMessage('Applied IQ wizard guided fixes.');
      pushDiagnosticEvent(`IQ wizard fixes applied: ${iqIntegrityAssessment.fixes.join(', ') || 'none'}.`);
    };

    const saveIqWizardProfile = () => {
      const key = activeDeviceProfileKey;
      const existing = getStabilityProfile(key);
      const persisted = upsertStabilityProfile({
        sourceType,
        profileKey: key,
        updatedAtUtc: new Date().toISOString(),
        driftEstimateHzPerSec: existing?.driftEstimateHzPerSec ?? frequencyModelState.driftEstimateHzPerSec,
        driftConfidence: existing?.driftConfidence ?? frequencyModelState.driftConfidence,
        phaseErrorRms: existing?.phaseErrorRms ?? frequencyModelState.phaseErrorRms,
        ppmCorrectionHz: existing?.ppmCorrectionHz ?? ppmCorrection,
        applyOnConnect: existing?.applyOnConnect,
        calibrationSeed: existing?.calibrationSeed,
        frequencyCalibration: existing?.frequencyCalibration,
        iqIntegrityLastReport: {
          recordedAtUtc: new Date().toISOString(),
          status: iqIntegrityAssessment.status,
          findings: [...iqIntegrityAssessment.findings],
          fixes: [...iqIntegrityAssessment.fixes],
          summary: iqIntegrityAssessment.summary
        }
      });

      setStabilityProfile(persisted);
      setStatusMessage('Saved IQ integrity wizard results to device profile.');
      pushDiagnosticEvent(`IQ wizard profile saved for ${key}.`);
    };

    const runUsbStreamingAutoTuner = async () => {
      const activeDevice = deviceRef.current;
      if (!isRunning || sourceType !== 'HACKRF' || !activeDevice?.setStreamingProfile || !activeDevice.getDebugSnapshot) {
        setStatusMessage('USB auto-tuner requires active HackRF streaming.');
        return;
      }

      setUsbAutoTuneRunning(true);
      setAdaptiveStreamingEnabled(false);
      pushDiagnosticEvent('USB auto-tuner started.');

      try {
        const candidates: UsbStreamingProfileName[] = ['low-latency', 'balanced', 'stable'];
        let bestProfile: UsbStreamingProfileName = 'balanced';
        let bestScore = Number.NEGATIVE_INFINITY;

        for (const candidate of candidates) {
          const profile = USB_STREAMING_PROFILES[candidate];
          await activeDevice.setStreamingProfile({
            transferSizeBytes: profile.transferSizeBytes,
            retryDelayMs: profile.retryDelayMs,
            maxConsecutiveFailures: profile.maxConsecutiveFailures,
            profileName: profile.name
          });

          const before = activeDevice.getDebugSnapshot().counters;
          if (!before) {
            continue;
          }

          await new Promise<void>((resolve) => {
            window.setTimeout(resolve, 450);
          });

          const after = activeDevice.getDebugSnapshot().counters;
          if (!after) {
            continue;
          }

          const score = scoreUsbProfileWindow(
            {
              bulkInErrorCount: before.bulkInErrorCount,
              retryCount: before.retryCount,
              transferIntervalMsJitter: before.transferIntervalMsJitter,
              shortPacketRatio: before.shortPacketRatio,
              droppedFrameEvents: runtimeTelemetryRef.current.droppedFrameEvents,
              audioUnderruns: runtimeTelemetryRef.current.audioUnderruns
            },
            {
              bulkInErrorCount: after.bulkInErrorCount,
              retryCount: after.retryCount,
              transferIntervalMsJitter: after.transferIntervalMsJitter,
              shortPacketRatio: after.shortPacketRatio,
              droppedFrameEvents: runtimeTelemetryRef.current.droppedFrameEvents,
              audioUnderruns: runtimeTelemetryRef.current.audioUnderruns
            }
          );

          pushDiagnosticEvent(`USB auto-tuner candidate ${candidate} scored ${score.toFixed(2)}.`);

          if (score > bestScore) {
            bestScore = score;
            bestProfile = candidate;
          }
        }

        await applyUsbStreamingProfile(bestProfile);
        setStatusMessage(`USB auto-tuner selected ${bestProfile} profile.`);
        pushDiagnosticEvent(`USB auto-tuner selected ${bestProfile} profile (score ${bestScore.toFixed(2)}).`);
      } finally {
        setUsbAutoTuneRunning(false);
      }
    };

    const runHardwareSanitySelfTestFlow = async () => {
      const activeDevice = deviceRef.current;
      if (!isRunning || !activeDevice || !isWebUsbSource(sourceType)) {
        setStatusMessage('Hardware self-test requires active WebUSB streaming.');
        return;
      }

      const gainStage = activeDevice.getGainStages().find((stage) => stage.name !== 'AMP' && stage.step > 0);
      let gainStepEffective = false;

      if (gainStage) {
        const original = gains[gainStage.name] ?? gainStage.value;
        const stepped = Math.min(gainStage.max, original + gainStage.step);
        const baseline = usbIqRmsRef.current;

        if (stepped !== original) {
          try {
            await activeDevice.setGain(gainStage.name, stepped);
            await new Promise<void>((resolve) => {
              window.setTimeout(resolve, 180);
            });
            const delta = Math.abs(usbIqRmsRef.current - baseline);
            gainStepEffective = baseline > 0 ? (delta / baseline) > 0.02 : delta > 0.25;
          } finally {
            await activeDevice.setGain(gainStage.name, original).catch(() => {
              // Ignore restore failures; report still includes gain-step outcome.
            });
          }
        }
      }

      const report = runHardwareSanitySelfTest({
        sampleFormatOk: runtimeTelemetry.lastFrameSampleRate !== null && runtimeTelemetry.lastFrameSampleRate > 0,
        iqOrderingOk: !iqIntegrityAssessment.findings.includes('mapping-risk'),
        dcOffset01: Math.max(0, Math.min(1, (runtimeTelemetry.dsp.rfImpurity.dcSpurLevelDbfs + 80) / 80)),
        clockOffsetPpm: Math.abs(runtimeTelemetry.audioResamplerRatioDeltaPpm),
        gainStepEffective,
        continuityOk: runtimeTelemetry.totalDroppedSamples === 0 && runtimeTelemetry.droppedFrameEvents === 0
      });

      setHardwareSelfTestReport(report);
      setStatusMessage(report.summary);
      pushDiagnosticEvent(`Hardware sanity self-test completed: ${report.summary}`);
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
          fftWindow: analyzerWindowMode,
          fftEnbwBins: getWindowEnbwBins(analyzerWindowMode),
          fftAveragingMode: analyzerAveragingMode,
          fftAveragingValue: analyzerAveragingMode === 'off'
            ? null
            : analyzerAveragingMode === 'linear'
              ? analyzerLinearAveragingFrames
              : analyzerAveragingValue,
          fftReferenceLevelDb: analyzerReferenceLevelDb,
          fftPeakHoldEnabled: analyzerPeakHoldEnabled,
          sampleRateHzHint: streamSampleRateHz,
          frequencyModel: {
            ppmCorrectionHz: frequencyModelState.ppmCorrectionHz,
            afcCorrectionHz: frequencyModelState.afcCorrectionHz,
            totalCorrectionHz: frequencyModelState.totalCorrectionHz,
            driftEstimateHzPerSec: frequencyModelState.driftEstimateHzPerSec,
            driftConfidence: frequencyModelState.driftConfidence,
            phaseErrorRms: frequencyModelState.phaseErrorRms
          },
          audioPll: {
            ratio: audioPllState.ratio,
            targetQueueMs: audioPllState.targetQueueMs,
            queueErrorMs: audioPllState.queueErrorMs
          },
          zoomLevel,
          waterfallPalette,
          waterfallAutoScale,
          waterfallMinDb,
          waterfallMaxDb,
          marker: markerReadout
            ? {
                active: true,
                frequencyHz: markerReadout.frequencyHz,
                powerDbfs: markerReadout.powerDbfs,
                inView: markerReadout.inView
              }
            : {
                active: false,
                frequencyHz: null,
                powerDbfs: null,
                inView: false
              },
          markerB: secondaryMarkerReadout
            ? {
                active: true,
                frequencyHz: secondaryMarkerReadout.frequencyHz,
                powerDbfs: secondaryMarkerReadout.powerDbfs,
                inView: secondaryMarkerReadout.inView
              }
            : {
                active: false,
                frequencyHz: null,
                powerDbfs: null,
                inView: false
              },
          analyzer: {
            semantics: {
              detectorMode: analyzerDetectorMode,
              traceMathMode: analyzerTraceMathMode,
              rbwHz: analyzerSemantics.rbwHz,
              vbwHz: analyzerSemantics.vbwHz,
              enbwBins: analyzerSemantics.enbwBins,
              noiseFloorEstimator: 'trimmed-mean-percentile',
              noiseFloorDbfs: candidateSignalStats.noiseFloorDbfs
            },
            candidateStats: {
              strongestPeakDbfs: candidateSignalStats.strongestPeakDbfs,
              strongestPeakSnrDb: candidateSignalStats.strongestPeakSnrDb,
              occupancy01: candidateSignalStats.occupancy01,
              persistence01: candidateSignalStats.persistence01
            },
            traceSummary: {
              traceABinCount: analyzerTrace.length,
              traceBBinCount: traceB?.length ?? 0,
              stitchedSweepPointCount: sweepStitchedPoints.length
            },
            markerTable: markerTableRows.map((row) => ({
              frequencyHz: row.frequencyHz,
              powerDbfs: row.powerDbfs,
              snrDb: row.snrDb,
              boundVfoId: row.boundVfoId
            })),
            spurAnnotations: spurAnnotations.map((annotation) => ({
              frequencyHz: annotation.frequencyHz,
              label: annotation.label,
              kind: annotation.kind,
              masked: annotation.masked
            }))
          }
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
            app: {
              name: 'rad.io',
              version: APP_VERSION
            },
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
            rfEnvironmentContext,
            sweep: {
              plan: sweepExecutionPlan,
              hostBridge: {
                available: sweepHostBridgeProbe.available,
                providerLabel: sweepHostBridgeProbe.providerLabel ?? null,
                reason: sweepHostBridgeProbe.reason ?? null
              },
              lastRun: sweepRunEvidence
            },
            device: {
              selectedSource: sourceType,
              activeName: deviceRef.current?.name ?? null,
              gainStages,
              gains,
              sampleRateHz: streamSampleRateHz,
              supportsWebUsb: sourceType === 'HACKRF' || sourceType === 'RTLSDR'
            },
            usbDebug: deviceDebugSnapshot,
            reproBundle: {
              settingsSnapshot: {
                sourceType,
                frequency,
                demodMode,
                fineFreq,
                streamSampleRateHz,
                filterState,
                gains,
                latencyPolicy,
                clockSyncPolicy,
                afcEnabled,
                stabilityModeEnabled,
                secondaryVfoEnabled,
                secondaryVfoOffsetHz,
                rfEnvironmentContext
              },
              deviceIdentityAndCaps: {
                activeName: deviceRef.current?.name ?? null,
                gainStages,
                streamSampleRateHz,
                supportsWebUsb: sourceType === 'HACKRF' || sourceType === 'RTLSDR',
                capabilityModel: deviceRef.current?.getCapabilityModel?.() ?? null,
                iqControlState: deviceRef.current?.getIqControlState?.() ?? null,
                frontEndCorrectionState: deviceRef.current?.getFrontEndCorrectionState?.() ?? null,
                stateMachine: deviceRef.current?.getStateMachineSnapshot?.() ?? null,
                streamContinuityContract: deviceRef.current?.getStreamContinuityContract?.() ?? null,
                descriptor: deviceDebugSnapshot?.descriptor ?? null,
                streamingProfile: deviceDebugSnapshot?.streamingProfile ?? null
              },
              discontinuityTimeline: discontinuityTimelineRef.current,
              usbTraceSlice: (deviceDebugSnapshot?.recentTrace ?? []).slice(-60),
              sweepExecution: {
                plan: sweepExecutionPlan,
                lastRun: sweepRunEvidence
              }
            },
            shareableSessionState: {
              queryParam: SHAREABLE_SESSION_QUERY_PARAM,
              version: 1
            },
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
            pipelineConfig: {
              workerTransportMode: runtimeTelemetry.workerTransportMode,
              latencyPolicy,
              clockSyncPolicy,
              clockSyncPolicyDescription: describeClockSyncPolicy(clockSyncPolicy),
              audioOutputDeviceId,
              audioOutputDeviceLabel: selectedAudioOutputLabel,
              safeMode: safeModeMarker
                ? {
                    active: true,
                    reason: safeModeMarker.reason,
                    triggeredAtIso: safeModeMarker.triggeredAtIso
                  }
                : {
                    active: false
                  },
              streamRatePlan,
              filterState,
              demodMode,
              toneDecodeMode,
              nfmAudioPreset,
              nfmOutputPath,
              iqCorrectionEnabled,
              afcEnabled,
              stabilityModeEnabled,
              secondaryVfoEnabled,
              secondaryVfoOffsetHz,
              vfoAudioRoute: effectiveVfoAudioRoute
            },
            filterState,
            audioLevelerState,
            frequencyModelState,
            audioPllState,
            vfoState,
            stabilityProfile,
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
            latencyPolicy,
            clockSyncPolicy,
            sessionTrust: trustAssessment,
            sessionGradeUpgrade: {
              minStableWindowSeconds: SESSION_GRADE_MIN_STABILITY_WINDOW_SECONDS,
              stableWindowSeconds: sessionGradeStabilityWindowSeconds,
              checks: sessionGradeEvaluation.checks,
              eligibleToLock: sessionGradeEvaluation.eligibleToLock,
              lockBlockedReason: sessionGradeEvaluation.lockBlockedReason,
              lockedAtIso: sessionGradeLockedAtIso,
              lockInvalidatedReason: sessionGradeLockInvalidatedReason
            },
            recordingExportIntegrity: recordingExportIntegrityPreview,
            frontEndTriage: frontEndOverloadAssessment,
            overloadClippingTelemetry,
            timebaseDrift: timebaseDriftAssessment,
            timebaseModel: timebaseModelState,
            externalReferenceStability: externalReferenceAssessment,
            referenceClockVisibility,
            referenceClockSupportModel,
            referenceLockProof,
            firmwareRecoveryPlan,
            frequencyCalibrationWizard: calibrationWizardAssessment,
            levelCalibrationWizard: levelCalibrationAssessment,
            activeBandCalibrationProfile,
            activeAmplitudeCalibration,
            calibrationBundle: exportCalibrationBundle(activeDeviceProfileKey),
            sampleRateMismatch: sampleRateMismatchAssessment,
            iqIntegrityWizard: iqIntegrityAssessment,
            signalIdAdvisor,
            antennaFrontEndProfiles: antennaContextProfiles,
            rfChainProfiles,
            activeAntennaFrontEndProfileId: selectedAntennaContextProfileId,
            activeRfChainProfileId: selectedRfChainProfileId,
            spurArtifactCatalog: {
              totalEntries: listSpurArtifactEntries(activeDeviceProfileKey).length,
              matchesAtMarker: spurCatalogMatches
            },
            bufferTelemetry: {
              ...bufferTelemetryAssessment,
              audioQueueTrend
            },
            usbSchedulingTelemetry: {
              transferCadenceExpectedMs: deviceDebugSnapshot?.counters?.transferCadenceExpectedMs ?? null,
              transferIntervalMsAvg: deviceDebugSnapshot?.counters?.transferIntervalMsAvg ?? null,
              transferIntervalMsJitter: deviceDebugSnapshot?.counters?.transferIntervalMsJitter ?? null,
              transferBurstiness01: deviceDebugSnapshot?.counters?.transferBurstiness01 ?? null,
              longGapCount: deviceDebugSnapshot?.counters?.longGapCount ?? null,
              activeProfile: usbStreamingProfile,
              adaptivePolicyEnabled: adaptiveStreamingEnabled
            },
            backgroundAudioReliability: {
              guardActive: backgroundAudioGuardActive,
              visibilityState: typeof document !== 'undefined' ? document.visibilityState : 'unknown'
            },
            hardwareSelfTest: hardwareSelfTestReport,
            rollingTelemetryWindow: telemetryWindowRef.current,
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
              sessionParameterChanges: parameterChangeTimelineRef.current,
              parameterChangeEventTotal: parameterChangeTimelineRef.current.length,
              rfEnvironmentContext,
              rfAudioTimebaseAlignment: timebaseAlignment,
              exportUnixMs: Date.now()
            },
            sessionProvenance: {
              parameterChangeTimeline: parameterChangeTimelineRef.current,
              discontinuityTimeline: discontinuityTimelineRef.current
            },
            measurementProvenance: {
              levelReadoutPoint: 'post-ddc',
              audioReadoutPoint: 'post-demod',
              sourceIqFormat: 'ci8-interleaved',
              exportedFromSourceType: sourceType,
              sampleClockTruthMode: runtimeTelemetry.lastClockTruthMode ?? 'unknown',
              rfEnvironmentContext,
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
            events: diagnosticEvents,
            structuredLogs: diagnosticLogs,
            logThrottling: {
              throttleWindowMs: 2000,
              droppedRepeats: throttledLogDropsRef.current
            }
        };

        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `rad-io-diagnostics-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        const integrityGrade = recordingExportIntegrityPreview.grade;
        setStatusMessage(`Diagnostics bundle exported (integrity: ${integrityGrade}).`);
        pushDiagnosticEvent(`Diagnostics bundle exported (integrity: ${integrityGrade}).`);
    };

    streamToggleShortcutRef.current = () => {
      void toggleStream();
    };
    exportDiagnosticsShortcutRef.current = () => {
      void exportDiagnostics();
    };

    const forgetUsbDevices = async () => {
      if (typeof navigator === 'undefined' || !('usb' in navigator)) {
        setStatusMessage('WebUSB is unavailable in this browser context.');
        return;
      }

      try {
        const pairedDevices = await navigator.usb.getDevices();

        if (pairedDevices.length === 0) {
          setStatusMessage('No paired WebUSB devices to forget.');
          return;
        }

        let forgottenCount = 0;
        for (const usbDevice of pairedDevices) {
          try {
            await usbDevice.forget();
            forgottenCount += 1;
          } catch (forgetError) {
            pushDiagnosticEvent(`USB forget failed for ${usbDevice.productName ?? 'unknown device'}: ${forgetError instanceof Error ? forgetError.message : String(forgetError)}`);
          }
        }

        void refreshPermissionState();
        setStatusMessage(`Forgot ${forgottenCount} paired WebUSB device${forgottenCount === 1 ? '' : 's'}. Re-pair on next Start.`);
        pushDiagnosticEvent(`Forgot ${forgottenCount} paired WebUSB device${forgottenCount === 1 ? '' : 's'}.`);
      } catch (error) {
        setStatusMessage('Unable to forget paired WebUSB devices.');
        pushDiagnosticEvent(`USB forget action failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    };

    const copyShareableSessionLink = async () => {
      if (typeof window === 'undefined') {
        return;
      }

      const shareState: ShareableSessionStateV1 = {
        version: 1,
        frequencyHz: Math.round(frequency),
        demodMode,
        fineFreqHz: Math.round(fineFreq),
        ppmCorrection,
        streamSampleRateHz,
        bandwidthHz: Math.max(1_000, Math.round(displayedBandwidthHz)),
        latencyPolicy,
        zoomLevel: Math.max(1, Math.round(zoomLevel))
      };

      const encodedState = encodeShareableSessionState(shareState);
      const shareUrl = new URL(window.location.href);
      shareUrl.searchParams.set(SHAREABLE_SESSION_QUERY_PARAM, encodedState);
      shareUrl.hash = '';

      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(shareUrl.toString());
          setStatusMessage('Share link copied to clipboard.');
          pushDiagnosticEvent('Shareable session link copied to clipboard.');
          return;
        }
      } catch {
        // Fall through to manual copy fallback.
      }

      const textarea = document.createElement('textarea');
      textarea.value = shareUrl.toString();
      textarea.setAttribute('readonly', 'true');
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      document.body.appendChild(textarea);
      textarea.select();

      try {
        const copied = document.execCommand('copy');
        if (copied) {
          setStatusMessage('Share link copied to clipboard.');
          pushDiagnosticEvent('Shareable session link copied via fallback copy command.');
        } else {
          setStatusMessage('Unable to copy share link.');
          pushDiagnosticEvent('Shareable session link copy command failed.', 'warn');
        }
      } finally {
        document.body.removeChild(textarea);
      }
    };

    type CommandPaletteAction = {
      id: string;
      label: string;
      keywords: string[];
      run: () => void | Promise<void>;
    };

    const commandPaletteActions: CommandPaletteAction[] = (() => {
      const setBandwidthPreset = (targetBandwidthHz: number) => {
        const halfBandwidth = Math.max(500, Math.round(targetBandwidthHz / 2));
        const clamped = clampFilterForMode(demodMode, -halfBandwidth, halfBandwidth, streamSampleRateHz);
        setFilterState((prev) => ({ ...prev, ...clamped }));
      };

      return [
        {
          id: 'stream-toggle',
          label: isRunning ? 'Stop Stream' : 'Start Stream',
          keywords: ['start', 'stop', 'stream', 'run'],
          run: () => {
            void toggleStream();
          }
        },
        {
          id: 'mute-toggle',
          label: isMuted ? 'Unmute Audio' : 'Mute Audio',
          keywords: ['mute', 'audio', 'sound'],
          run: () => {
            toggleMute();
          }
        },
        {
          id: 'panic-mute',
          label: 'Panic Mute',
          keywords: ['panic', 'safety', 'mute'],
          run: () => {
            panicMute('keyboard-shortcut');
          }
        },
        {
          id: 'mode-wfm',
          label: 'Mode: WFM',
          keywords: ['mode', 'wfm', 'broadcast'],
          run: () => setDemodMode('WFM')
        },
        {
          id: 'mode-nfm',
          label: 'Mode: NFM',
          keywords: ['mode', 'nfm', 'narrow'],
          run: () => setDemodMode('NFM')
        },
        {
          id: 'mode-am',
          label: 'Mode: AM',
          keywords: ['mode', 'am', 'amplitude'],
          run: () => setDemodMode('AM')
        },
        {
          id: 'bandwidth-wide',
          label: 'Bandwidth Preset: Wide',
          keywords: ['bandwidth', 'wide', 'filter'],
          run: () => setBandwidthPreset(180_000)
        },
        {
          id: 'bandwidth-narrow',
          label: 'Bandwidth Preset: Narrow',
          keywords: ['bandwidth', 'narrow', 'filter'],
          run: () => setBandwidthPreset(12_500)
        },
        {
          id: 'tune-up',
          label: `Tune +${(tuningStepHz / 1000).toFixed(1)} kHz`,
          keywords: ['tune', 'frequency', 'up'],
          run: () => tuneToDisplayFrequency(tunedDisplayFrequencyHz + tuningStepHz)
        },
        {
          id: 'tune-down',
          label: `Tune -${(tuningStepHz / 1000).toFixed(1)} kHz`,
          keywords: ['tune', 'frequency', 'down'],
          run: () => tuneToDisplayFrequency(Math.max(0, tunedDisplayFrequencyHz - tuningStepHz))
        },
        {
          id: 'vfo-active-main',
          label: 'Active VFO: Main',
          keywords: ['vfo', 'main', 'focus'],
          run: () => setActiveVfoId('main')
        },
        {
          id: 'vfo-active-aux',
          label: 'Active VFO: Aux',
          keywords: ['vfo', 'aux', 'focus'],
          run: () => {
            setSecondaryVfoEnabled(true);
            setActiveVfoId('aux');
          }
        },
        {
          id: 'vfo-route-main',
          label: 'VFO Audio Route: Main',
          keywords: ['vfo', 'audio', 'route', 'main', 'solo'],
          run: () => setVfoAudioRoute('main')
        },
        {
          id: 'vfo-route-aux',
          label: 'VFO Audio Route: Aux',
          keywords: ['vfo', 'audio', 'route', 'aux', 'solo'],
          run: () => {
            setSecondaryVfoEnabled(true);
            setVfoAudioRoute('aux');
          }
        },
        {
          id: 'vfo-route-mix',
          label: 'VFO Audio Route: Mix',
          keywords: ['vfo', 'audio', 'route', 'mix'],
          run: () => {
            setSecondaryVfoEnabled(true);
            setVfoAudioRoute('mix');
          }
        },
        {
          id: 'export-diagnostics',
          label: 'Export Diagnostics',
          keywords: ['export', 'diagnostics', 'bundle', 'support'],
          run: () => {
            void exportDiagnostics();
          }
        },
        {
          id: 'copy-share-link',
          label: 'Copy Share Link',
          keywords: ['share', 'link', 'session'],
          run: () => {
            void copyShareableSessionLink();
          }
        },
        {
          id: 'record-toggle',
          label: recordingActive ? 'Stop Recording' : 'Start Recording',
          keywords: ['record', 'capture', 'audio', 'iq', 'sigmf', 'indexeddb'],
          run: () => {
            if (recordingActive) {
              stopRecordingRef.current?.();
            } else {
              startRecordingRef.current?.();
            }
          }
        },
        {
          id: 'record-replay',
          label: 'Replay Last Recording',
          keywords: ['record', 'replay', 'deterministic'],
          run: () => {
            void replayRecordingRef.current?.();
          }
        },
        {
          id: 'record-export',
          label: 'Export Repro Bundle',
          keywords: ['export', 'repro', 'manifest', 'scene', 'sigmf'],
          run: () => {
            void exportRecordingBundleRef.current?.();
          }
        }
      ];
    })();

    const filteredCommandPaletteActions = (() => {
      const trimmedQuery = commandPaletteQuery.trim().toLowerCase();
      if (trimmedQuery.length === 0) {
        return commandPaletteActions;
      }

      return commandPaletteActions.filter((action) => {
        if (action.label.toLowerCase().includes(trimmedQuery)) {
          return true;
        }

        return action.keywords.some((keyword) => keyword.toLowerCase().includes(trimmedQuery));
      });
    })();

    const runCommandPaletteAction = (action: CommandPaletteAction) => {
      try {
        const result = action.run();
        if (result instanceof Promise) {
          void result.catch((error: unknown) => {
            pushDiagnosticEvent(`Command palette action failed (${action.id}): ${error instanceof Error ? error.message : String(error)}`, 'warn');
          });
        }
      } finally {
        closeCommandPalette();
      }
    };

    useEffect(() => {
      if (!commandPaletteOpen) {
        return;
      }

      const timeoutId = window.setTimeout(() => {
        commandPaletteInputRef.current?.focus();
      }, 0);

      return () => window.clearTimeout(timeoutId);
    }, [commandPaletteOpen]);

  const handleGainChange = (name: string, val: number) => {
      setGains(prev => ({ ...prev, [name]: val }));
  };

  const analyzerVisibleBinRange = useMemo(
    () => getVisibleSpectrumBinRange(fftData.length, zoomLevel),
    [fftData.length, zoomLevel]
  );

  const analyzerSemantics = useMemo(() => computeAnalyzerSemantics({
    sampleRateHz: streamSampleRateHz,
    fftSize: fftData.length,
    vbwAveragingFrames: analyzerVbwFrames,
    windowMode: analyzerWindowMode
  }), [analyzerVbwFrames, analyzerWindowMode, fftData.length, streamSampleRateHz]);

  const detectorTrace = useMemo(
    () => applyDetectorMode(detectorHistoryRef.current, analyzerDetectorMode),
    [analyzerDetectorMode]
  );

  const analyzerTrace = useMemo(
    () => applyTraceMath(detectorTrace.length > 0 ? detectorTrace : fftData, traceB, analyzerTraceMathMode),
    [analyzerTraceMathMode, detectorTrace, fftData, traceB]
  );

  const markerReadout = useMemo(
    () => resolveMarkerReadout(
      analyzerMarker?.frequencyHz ?? null,
      analyzerTrace,
      displayCenterFrequencyHz,
      streamSampleRateHz,
      analyzerVisibleBinRange
    ),
    [analyzerMarker?.frequencyHz, analyzerTrace, analyzerVisibleBinRange, displayCenterFrequencyHz, streamSampleRateHz]
  );

  const secondaryMarkerReadout = useMemo(
    () => resolveMarkerReadout(
      analyzerSecondaryMarker?.frequencyHz ?? null,
      analyzerTrace,
      displayCenterFrequencyHz,
      streamSampleRateHz,
      analyzerVisibleBinRange
    ),
    [analyzerSecondaryMarker?.frequencyHz, analyzerTrace, analyzerVisibleBinRange, displayCenterFrequencyHz, streamSampleRateHz]
  );

  const occupiedBandwidth = useMemo(
    () => estimateOccupiedBandwidthHz(
      analyzerTrace,
      analyzerVisibleBinRange,
      displayCenterFrequencyHz,
      streamSampleRateHz,
      0.99
    ),
    [analyzerTrace, analyzerVisibleBinRange, displayCenterFrequencyHz, streamSampleRateHz]
  );

  const rawStrongestPeaks = useMemo(
    () => listStrongestPeaks(analyzerTrace, analyzerVisibleBinRange, 6, 8),
    [analyzerTrace, analyzerVisibleBinRange]
  );

  const strongestPeaks = useMemo(
    () => artifactMaskEnabled
      ? applyArtifactMaskToPeaks(
          rawStrongestPeaks,
          spurAnnotations,
          analyzerTrace.length,
          displayCenterFrequencyHz,
          streamSampleRateHz,
          Math.max(500, analyzerSemantics.rbwHz * 2)
        )
      : rawStrongestPeaks,
    [
      analyzerSemantics.rbwHz,
      analyzerTrace.length,
      artifactMaskEnabled,
      displayCenterFrequencyHz,
      rawStrongestPeaks,
      spurAnnotations,
      streamSampleRateHz
    ]
  );

  const candidateSignalStats = useMemo(() => buildCandidateSignalStats({
    trace: analyzerTrace,
    peaks: strongestPeaks,
    enbwBins: analyzerSemantics.enbwBins,
    persistenceHistory: detectorHistoryRef.current
  }), [analyzerSemantics.enbwBins, analyzerTrace, strongestPeaks]);

  const signalWarnings = useMemo(() => deriveSignalWarnings({
    trace: analyzerTrace,
    centerFrequencyHz: displayCenterFrequencyHz,
    sampleRateHz: streamSampleRateHz,
    peaks: strongestPeaks,
    noiseFloorDbfs: candidateSignalStats.noiseFloorDbfs,
    spurDensity01: runtimeTelemetry.dsp.rfImpurity.spurDensity01
  }), [
    analyzerTrace,
    candidateSignalStats.noiseFloorDbfs,
    displayCenterFrequencyHz,
    runtimeTelemetry.dsp.rfImpurity.spurDensity01,
    streamSampleRateHz,
    strongestPeaks
  ]);

  const markerTableRows = useMemo(() => {
    const rows = strongestPeaks
      .map((peak) => {
        const frequencyHz = Math.round(binIndexToFrequencyHz(
          peak.binIndex,
          analyzerTrace.length,
          displayCenterFrequencyHz,
          streamSampleRateHz
        ));
        const snrDb = peak.powerDbfs - candidateSignalStats.noiseFloorDbfs;
        return {
          frequencyHz,
          powerDbfs: peak.powerDbfs,
          snrDb,
          boundVfoId:
            markerBindingState.enabled
            && Math.round(resolveVfoDisplayFrequencyHz(
              markerBindingState.boundVfoId,
              tunedDisplayFrequencyHz,
              secondaryVfoEnabled,
              secondaryVfoOffsetHz
            )) === frequencyHz
              ? markerBindingState.boundVfoId
              : null
        };
      })
      .filter((row) => row.snrDb >= markerTableSnrMinDb);

    rows.sort((a, b) => {
      if (markerTableSortMode === 'frequency') {
        return a.frequencyHz - b.frequencyHz;
      }
      if (markerTableSortMode === 'snr') {
        return b.snrDb - a.snrDb;
      }
      return b.powerDbfs - a.powerDbfs;
    });
    return rows;
  }, [
    candidateSignalStats.noiseFloorDbfs,
    displayCenterFrequencyHz,
    markerBindingState.boundVfoId,
    markerBindingState.enabled,
    markerTableSnrMinDb,
    markerTableSortMode,
    secondaryVfoEnabled,
    secondaryVfoOffsetHz,
    streamSampleRateHz,
    strongestPeaks,
    tunedDisplayFrequencyHz,
    analyzerTrace.length
  ]);

  const markerDeltaReadout = useMemo(() => {
    if (!markerReadout || !secondaryMarkerReadout) {
      return null;
    }

    const deltaFrequencyHz = secondaryMarkerReadout.frequencyHz - markerReadout.frequencyHz;
    const deltaPowerDb = secondaryMarkerReadout.powerDbfs - markerReadout.powerDbfs;
    return {
      deltaFrequencyHz,
      deltaPowerDb
    };
  }, [markerReadout, secondaryMarkerReadout]);

  const runCenterOnPeak = useCallback((trigger: 'ui' | 'keyboard') => {
    const strongestPeak = findStrongestPeakInRange(analyzerTrace, analyzerVisibleBinRange);
    if (!strongestPeak) {
      setStatusMessage('Center-on-peak found no valid peak in the visible span.');
      pushDiagnosticEvent(`Center-on-peak (${trigger}) found no qualifying peak.`, 'warn', 'analyzer');
      return;
    }

    const targetFrequencyHz = Math.round(
      binIndexToFrequencyHz(strongestPeak.binIndex, analyzerTrace.length, displayCenterFrequencyHz, streamSampleRateHz)
    );
    tuneToDisplayFrequency(targetFrequencyHz);
    setLastLockFrequencyHz(targetFrequencyHz);
    setStatusMessage(`Centered on peak at ${targetFrequencyHz.toLocaleString()} Hz.`);
    pushDiagnosticEvent(
      `Center-on-peak (${trigger}) tuned to ${targetFrequencyHz} Hz (peak ${strongestPeak.powerDbfs.toFixed(1)} dBFS).`,
      'info',
      'analyzer'
    );
  }, [analyzerTrace, analyzerVisibleBinRange, displayCenterFrequencyHz, pushDiagnosticEvent, streamSampleRateHz, tuneToDisplayFrequency]);

  const runSnapToSignal = useCallback((trigger: 'ui' | 'keyboard') => {
    if (analyzerTrace.length === 0) {
      setStatusMessage('Snap-to-signal is unavailable without spectrum data.');
      return;
    }

    const focusFrequencyHz = analyzerMarker?.frequencyHz ?? tunedDisplayFrequencyHz;
    const focusBin = frequencyHzToBinIndex(focusFrequencyHz, analyzerTrace.length, displayCenterFrequencyHz, streamSampleRateHz);
    const nearestPeak = findNearestQualifiedPeak(
      analyzerTrace,
      focusBin,
      analyzerVisibleBinRange,
      6
    );

    if (!nearestPeak) {
      setStatusMessage('Snap-to-signal found no qualifying peak near focus.');
      pushDiagnosticEvent(`Snap-to-signal (${trigger}) found no qualifying peak.`, 'warn', 'analyzer');
      return;
    }

    const centerBin = Math.floor(analyzerTrace.length / 2);
    const offsetBins = nearestPeak.binIndex - centerBin;
    const offsetHz = Math.round(offsetBins * (streamSampleRateHz / analyzerTrace.length));
    const clampedFineHz = clampFineTuneHz(offsetHz, filterState.highCutHz, streamSampleRateHz);

    setFineFreq(clampedFineHz);
    setLastLockFrequencyHz(Math.round(tunedDisplayFrequencyHz));
    setStatusMessage(`Snapped to nearest signal at dTune ${clampedFineHz.toLocaleString()} Hz.`);
    pushDiagnosticEvent(
      `Snap-to-signal (${trigger}) set fine tune to ${clampedFineHz} Hz (peak ${nearestPeak.powerDbfs.toFixed(1)} dBFS).`,
      'info',
      'analyzer'
    );
  }, [
    analyzerMarker?.frequencyHz,
    analyzerTrace,
    analyzerVisibleBinRange,
    filterState.highCutHz,
    displayCenterFrequencyHz,
    pushDiagnosticEvent,
    streamSampleRateHz,
    tunedDisplayFrequencyHz
  ]);

  const placeMarkerAtPeak = useCallback((trigger: 'ui' | 'keyboard') => {
    const strongestPeak = findStrongestPeakInRange(analyzerTrace, analyzerVisibleBinRange);
    if (!strongestPeak) {
      setStatusMessage('Unable to place marker: no qualifying peak in view.');
      pushDiagnosticEvent(`Marker place (${trigger}) failed: no qualifying peak.`, 'warn', 'analyzer');
      return;
    }

    const markerFrequencyHz = binIndexToFrequencyHz(strongestPeak.binIndex, analyzerTrace.length, displayCenterFrequencyHz, streamSampleRateHz);
    setAnalyzerMarker({
      frequencyHz: markerFrequencyHz,
      placedAtIso: new Date().toISOString()
    });
    setStatusMessage(`Marker placed at ${Math.round(markerFrequencyHz).toLocaleString()} Hz.`);
    pushDiagnosticEvent(
      `Marker placed (${trigger}) at ${Math.round(markerFrequencyHz)} Hz (${strongestPeak.powerDbfs.toFixed(1)} dBFS).`,
      'info',
      'analyzer'
    );
  }, [analyzerTrace, analyzerVisibleBinRange, displayCenterFrequencyHz, pushDiagnosticEvent, streamSampleRateHz]);

  const clearMarker = useCallback((trigger: 'ui' | 'keyboard') => {
    setAnalyzerMarker(null);
    setAnalyzerSecondaryMarker(null);
    setMarkerBindingState(defaultMarkerBindingState());
    setStatusMessage('Marker cleared.');
    pushDiagnosticEvent(`Marker cleared (${trigger}).`, 'info', 'analyzer');
  }, [pushDiagnosticEvent]);

  const placeSecondaryMarkerAtPeak = useCallback((trigger: 'ui' | 'keyboard') => {
    const strongestPeak = findStrongestPeakInRange(analyzerTrace, analyzerVisibleBinRange);
    if (!strongestPeak) {
      setStatusMessage('Unable to place marker B: no qualifying peak in view.');
      pushDiagnosticEvent(`Marker B place (${trigger}) failed: no qualifying peak.`, 'warn', 'analyzer');
      return;
    }

    const markerFrequencyHz = binIndexToFrequencyHz(strongestPeak.binIndex, analyzerTrace.length, displayCenterFrequencyHz, streamSampleRateHz);
    setAnalyzerSecondaryMarker({
      frequencyHz: markerFrequencyHz,
      placedAtIso: new Date().toISOString()
    });
    setStatusMessage(`Marker B placed at ${Math.round(markerFrequencyHz).toLocaleString()} Hz.`);
    pushDiagnosticEvent(
      `Marker B placed (${trigger}) at ${Math.round(markerFrequencyHz)} Hz (${strongestPeak.powerDbfs.toFixed(1)} dBFS).`,
      'info',
      'analyzer'
    );
  }, [analyzerTrace, analyzerVisibleBinRange, displayCenterFrequencyHz, pushDiagnosticEvent, streamSampleRateHz]);

  const clearSecondaryMarker = useCallback((trigger: 'ui' | 'keyboard') => {
    setAnalyzerSecondaryMarker(null);
    setStatusMessage('Marker B cleared.');
    pushDiagnosticEvent(`Marker B cleared (${trigger}).`, 'info', 'analyzer');
  }, [pushDiagnosticEvent]);

  const bindMarkerToActiveVfo = useCallback((followVfo: boolean) => {
    const nextMarkerHz = resolveVfoDisplayFrequencyHz(
      activeVfoId,
      tunedDisplayFrequencyHz,
      secondaryVfoEnabled,
      secondaryVfoOffsetHz
    );
    setAnalyzerMarker({
      frequencyHz: nextMarkerHz,
      placedAtIso: new Date().toISOString()
    });
    setMarkerBindingState({
      enabled: true,
      boundVfoId: activeVfoId,
      followVfo
    });
    setStatusMessage(`Marker bound to ${activeVfoId.toUpperCase()} VFO${followVfo ? ' (follow enabled)' : ''}.`);
    pushDiagnosticEvent(`Marker bound to ${activeVfoId} VFO${followVfo ? ' with follow mode' : ''}.`, 'info', 'analyzer');
  }, [activeVfoId, pushDiagnosticEvent, secondaryVfoEnabled, secondaryVfoOffsetHz, tunedDisplayFrequencyHz]);

  const tuneActiveVfoToMarker = useCallback(() => {
    if (!analyzerMarker) {
      setStatusMessage('Tune active VFO to marker requires an active marker.');
      return;
    }

    if (activeVfoId === 'main') {
      tuneToDisplayFrequency(analyzerMarker.frequencyHz);
      setStatusMessage(`Main VFO tuned to marker ${Math.round(analyzerMarker.frequencyHz).toLocaleString()} Hz.`);
      return;
    }

    const nextOffsetHz = resolveSecondaryOffsetFromMarkerHz(analyzerMarker.frequencyHz, tunedDisplayFrequencyHz);
    setSecondaryVfoEnabled(true);
    setSecondaryVfoOffsetHz(nextOffsetHz);
    setStatusMessage(`Aux VFO offset set to ${nextOffsetHz.toLocaleString()} Hz from marker.`);
  }, [activeVfoId, analyzerMarker, tuneToDisplayFrequency, tunedDisplayFrequencyHz]);

  const applyVfoPreset = useCallback((preset: VfoPreset) => {
    setSecondaryVfoEnabled(preset.secondaryVfoEnabled);
    setSecondaryVfoOffsetHz(preset.secondaryVfoOffsetHz);
    setActiveVfoId(preset.secondaryVfoEnabled ? preset.activeVfoId : 'main');
    setVfoAudioRoute(preset.secondaryVfoEnabled ? preset.audioRoute : preset.audioRoute === 'aux' ? 'main' : preset.audioRoute);
    setStatusMessage(`Applied VFO preset: ${preset.name}.`);
    pushDiagnosticEvent(`Applied VFO preset ${preset.name}.`, 'info', 'vfo');
  }, [pushDiagnosticEvent]);

  const saveCurrentVfoPreset = useCallback(() => {
    const draft = vfoPresetNameDraft.trim();
    if (!draft) {
      setStatusMessage('Enter a preset name before saving.');
      return;
    }

    const preset = createVfoPreset(draft, {
      secondaryVfoEnabled,
      secondaryVfoOffsetHz,
      activeVfoId: secondaryVfoEnabled ? activeVfoId : 'main',
      audioRoute: effectiveVfoAudioRoute
    });
    setVfoPresets((prev) => [preset, ...prev].slice(0, 24));
    setVfoPresetNameDraft('');
    setStatusMessage(`Saved VFO preset: ${preset.name}.`);
    pushDiagnosticEvent(`Saved VFO preset ${preset.name}.`, 'info', 'vfo');
  }, [activeVfoId, effectiveVfoAudioRoute, pushDiagnosticEvent, secondaryVfoEnabled, secondaryVfoOffsetHz, vfoPresetNameDraft]);

  const deleteVfoPreset = useCallback((id: string) => {
    setVfoPresets((prev) => prev.filter((preset) => preset.id !== id));
    setStatusMessage('VFO preset removed.');
  }, []);

  const refreshRecordingList = useCallback(async () => {
    const list = await recordingStoreRef.current.listRecordings();
    setRecordingRecords(list);
    if (list.length > 0 && !selectedRecordingId) {
      setSelectedRecordingId(list[0].id);
    }
  }, [selectedRecordingId]);

  useEffect(() => {
    void refreshRecordingList();
    void recordingStoreRef.current.getWorkspaceBundle().then((bundle) => {
      if (!bundle) {
        return;
      }
      setRecordingBookmarks(bundle.bookmarks);
      setRecordingAnnotations(bundle.annotations);
    });
  }, [refreshRecordingList]);

  function appendRecordingCaptureChunk(iqData: Uint8Array, audioData: Float32Array): void {
    if (!recordingActive || !recordingSessionRef.current) {
      return;
    }

    const next = appendRecorderChunk(recordingSessionRef.current, iqData, audioData);
    recordingSessionRef.current = next;
    setRecorderSession(next);
  }

  const startRecordingSession = () => {
    const session = createRecorderSession({
      chunkDurationMs: recordingChunkDurationMs,
      replayWindowMs: replayWindowMs,
      scheduledStartIso: recordingScheduledStartIso.trim() || undefined
    });
    recordingSessionRef.current = session;
    setRecorderSession(session);
    setRecordingActive(true);
    setStatusMessage('Phase 6.2 recording started.');
  };

  const stopRecordingSession = async () => {
    const session = recordingSessionRef.current;
    if (!session) {
      setStatusMessage('No active Phase 6.2 recording session.');
      return;
    }

    const trustStamp = createTrustStamp({
      sessionGrade: trustAssessment.grade,
      calibrationState: measurementDisclosure.frequency.state === 'uncalibrated' ? 'uncalibrated' : 'calibrated',
      droppedSamples: runtimeTelemetry.totalDroppedSamples,
      audioUnderruns: runtimeTelemetry.audioUnderruns,
      rfChainAssumptions: [rfEnvironmentContext.chainNotes || 'unspecified-rf-chain']
    });

    const manifest = {
      appVersion: '0.0.1',
      sourceType,
      demodMode,
      sampleRateHz: streamSampleRateHz,
      centerFrequencyHz: frequency,
      tunedFrequencyHz: tunedTunerFrequencyHz,
      ppmCorrection,
      driftEstimateHzPerSec: frequencyModelState.driftEstimateHzPerSec,
      driftConfidence: frequencyModelState.driftConfidence,
      afcEnabled,
      lockState: demodQuality.lockState,
      calibrationOffsetHz: 0,
      calibrationOffsetDb: activeAmplitudeCalibration?.dbfsToDbmOffset,
      loOffsetHz: frequencyMapping.transverterLoHz,
      ifOffsetHz: frequencyMapping.ifOffsetHz,
      discontinuityTimeline: discontinuityTimelineRef.current.map((entry) => ({
        sequence: entry.sequence,
        sampleIndex: entry.sampleIndex,
        droppedSamples: entry.droppedSamples,
        cause: entry.cause,
        wallClockMs: entry.wallClockMs ?? undefined
      }))
    };

    const metadata = buildSigmfMetadataDraft({
      description: `Recorded from ${sourceType} ${demodMode}`,
      sampleRateHz: streamSampleRateHz,
      centerFrequencyHz: frequency,
      displayFrequencyHz: tunedDisplayFrequencyHz,
      ppmCorrection,
      loOffsetHz: frequencyMapping.transverterLoHz,
      ifOffsetHz: frequencyMapping.ifOffsetHz,
      gainStages: gains,
      rfChainSnapshot: rfEnvironmentContext.chainNotes || 'unspecified-rf-chain',
      replay: manifest,
      trustStamp,
      annotations: recordingAnnotations
    });

    const hardGate = validateInteropRequiredMetadataChecklist(metadata);
    if (!hardGate.ok) {
      setStatusMessage(`Recording blocked by metadata hard gate: ${hardGate.missing.join(', ')}`);
      return;
    }

    const record = createRecordingFromSession({
      session,
      metadata,
      manifest,
      trustStamp,
      bookmarks: recordingBookmarks,
      devicePreset: {
        id: `preset-${Date.now().toString(36)}`,
        name: `${sourceType}-${demodMode}`,
        sampleRateHz: streamSampleRateHz,
        gains,
        ppmCorrection,
        loOffsetHz: frequencyMapping.transverterLoHz,
        ifOffsetHz: frequencyMapping.ifOffsetHz,
        vfoPresetRef: vfoPresets[0]?.id
      },
      expiresAtIso: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
    });

    await recordingStoreRef.current.putRecording(record);
    await enforceRetentionPolicy({
      store: recordingStoreRef.current,
      maxRecordings: 25,
      maxBytes: 300 * 1024 * 1024
    });

    recordingSessionRef.current = null;
    setRecorderSession(null);
    setRecordingActive(false);
    setSelectedRecordingId(record.id);
    await refreshRecordingList();
    setStatusMessage(`Recording saved (${record.id}).`);
  };

  const replaySelectedRecording = async () => {
    const id = selectedRecordingId || recordingRecords[0]?.id;
    if (!id) {
      setStatusMessage('No recording available for replay.');
      return;
    }

    const record = await recordingStoreRef.current.getRecording(id);
    if (!record) {
      setStatusMessage('Selected recording no longer exists.');
      return;
    }

    const replay = deterministicReplay(record);
    setStatusMessage(`Deterministic replay ready (${replay.digest}).`);
  };

  const exportSelectedRecordingBundle = async () => {
    const id = selectedRecordingId || recordingRecords[0]?.id;
    if (!id) {
      setStatusMessage('No recording available for export.');
      return;
    }

    const record = await recordingStoreRef.current.getRecording(id);
    if (!record) {
      setStatusMessage('Selected recording no longer exists.');
      return;
    }

    const bundle = createReproBundle({
      record,
      iqProfile: 'cf32_le',
      audioFormat: 'wav'
    });

    const tap = recorderSession ? quickTapExportFromRingBuffer(recorderSession, record.metadata) : null;
    const offlineAudio = renderOfflineDeterministicDemod(record);
    const flacPreview = createAudioExport({
      filenameBase: `${record.id}-offline`,
      samples: offlineAudio,
      sampleRateHz: record.manifest.sampleRateHz,
      format: 'flac',
      metadata: {
        replay: record.manifest,
        trust: record.trustStamp,
        note: 'Deterministic offline render'
      }
    });

    downloadJsonBlob(`${record.id}.manifest.json`, JSON.parse(bundle.manifestJson) as unknown);
    downloadJsonBlob(`${record.id}.replay-entrypoint.json`, JSON.parse(bundle.replayEntrypointJson) as unknown);
    downloadJsonBlob(`${record.id}.scene.json`, JSON.parse(bundle.sceneJson) as unknown);
    downloadJsonBlob(`${record.id}.sigmf-meta.json`, JSON.parse(bundle.sigmfMetaJson) as unknown);
    if (tap) {
      downloadJsonBlob(`${record.id}.quick-tap.json`, {
        iqBytes: tap.postDdcIq.length,
        audioSamples: tap.postDemodAudio.length,
        metadata: JSON.parse(tap.metadataJson) as unknown
      });
    }
    downloadJsonBlob(`${record.id}.audio-flac-preview.json`, {
      filename: flacPreview.filename,
      bytes: flacPreview.bytes.byteLength,
      mimeType: flacPreview.mimeType,
      metadata: JSON.parse(flacPreview.metadataJson) as unknown
    });
    setStatusMessage(`Repro bundle exported for ${record.id}.`);
  };

  const saveWorkspaceStateBundle = async () => {
    const bundle = createWorkspaceStateBundle({
      vfos: [
        { id: 'main', offsetHz: 0, enabled: true },
        { id: 'aux', offsetHz: secondaryVfoOffsetHz, enabled: secondaryVfoEnabled }
      ],
      markers: [
        ...(analyzerMarker ? [{ id: 'a', frequencyHz: analyzerMarker.frequencyHz, label: 'Marker A' }] : []),
        ...(analyzerSecondaryMarker ? [{ id: 'b', frequencyHz: analyzerSecondaryMarker.frequencyHz, label: 'Marker B' }] : [])
      ],
      selectedBandPlan: `${bandRegionId}:${selectedBandId}`,
      calibrationProfiles: {
        active: {
          offsetHz: 0,
          offsetDb: activeAmplitudeCalibration?.dbfsToDbmOffset ?? 0
        }
      },
      uiState: {
        zoom: zoomLevel,
        palette: waterfallPalette,
        panelLayout: 'default'
      },
      bookmarks: recordingBookmarks,
      annotations: recordingAnnotations,
      devicePresets: recordingRecords.slice(0, 8).map((record) => record.devicePreset)
    });

    await recordingStoreRef.current.putWorkspaceBundle(bundle);
    const json = JSON.stringify(bundle, null, 2);
    setStatusMessage('Workspace state bundle saved (' + json.length + ' chars).');
  };

  const importWorkspaceStateBundle = () => {
    try {
      const parsed = JSON.parse(workspaceImportDraft) as WorkspaceStateBundle;
      if (parsed.schemaVersion !== 1) {
        throw new Error('Unsupported workspace schema version.');
      }
      setRecordingBookmarks(parsed.bookmarks ?? []);
      setRecordingAnnotations(parsed.annotations ?? []);
      setStatusMessage('Workspace state imported.');
    } catch (error) {
      setStatusMessage(`Workspace import failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const addBookmark = () => {
    const bookmark = createBookmark(bookmarkNameDraft || 'Bookmark', tunedDisplayFrequencyHz);
    setRecordingBookmarks((prev) => [bookmark, ...prev].slice(0, 128));
    setBookmarkNameDraft('');
    setStatusMessage(`Bookmark saved at ${Math.round(bookmark.frequencyHz).toLocaleString()} Hz.`);
  };

  const addAnnotation = () => {
    const annotation = createStructuredAnnotation({
      startMs: 0,
      endMs: Math.max(1, replayWindowMs),
      centerFrequencyHz: tunedDisplayFrequencyHz,
      bandwidthHz: Math.max(1_000, Math.round(filterState.highCutHz - filterState.lowCutHz)),
      tags: [demodMode.toLowerCase()],
      note: annotationDraft || 'Session annotation'
    });
    setRecordingAnnotations((prev) => [annotation, ...prev].slice(0, 256));
    setAnnotationDraft('');
    setStatusMessage('Annotation added to RF notebook.');
  };

  void saveWorkspaceStateBundle;
  void importWorkspaceStateBundle;
  startRecordingRef.current = startRecordingSession;
  stopRecordingRef.current = () => {
    void stopRecordingSession();
  };
  replayRecordingRef.current = replaySelectedRecording;
  exportRecordingBundleRef.current = exportSelectedRecordingBundle;
  appendRecordingCaptureChunkRef.current = appendRecordingCaptureChunk;
  void addBookmark;
  void addAnnotation;
  appendRecordingCaptureChunkRef.current = appendRecordingCaptureChunk;
  const applyVfoResourceAction = useCallback((action: 'route-main' | 'route-aux' | 'route-mix' | 'mute' | 'disable-aux') => {
    if (action === 'route-main') {
      setVfoAudioRoute('main');
      return;
    }
    if (action === 'route-aux') {
      setSecondaryVfoEnabled(true);
      setVfoAudioRoute('aux');
      return;
    }
    if (action === 'route-mix') {
      setSecondaryVfoEnabled(true);
      setVfoAudioRoute('mix');
      return;
    }
    if (action === 'mute') {
      setVfoAudioRoute('mute');
      return;
    }
    setSecondaryVfoEnabled(false);
    setVfoAudioRoute('main');
  }, []);

  const applySignalWarningMitigation = useCallback((warningId: string) => {
    const warning = signalWarnings.find((entry) => entry.id === warningId);
    if (!warning) {
      return;
    }

    if (warning.mitigation === 'lo-shift') {
      setFrequencyMapping((prev) => ({
        ...prev,
        ifOffsetHz: Math.max(-25_000_000, Math.min(25_000_000, prev.ifOffsetHz + 12_500))
      }));
      setStatusMessage('Applied LO shift mitigation (+12.5 kHz IF shift).');
      return;
    }

    if (warning.mitigation === 'bandwidth-clamp') {
      setFilterState((prev) => {
        const clamped = clampFilterForMode(demodMode, prev.lowCutHz, prev.highCutHz, streamSampleRateHz);
        return {
          ...prev,
          ...clamped
        };
      });
      setStatusMessage('Applied bandwidth clamp mitigation.');
      return;
    }

    if (warning.mitigation === 'notch-preset') {
      setFilterState((prev) => ({
        ...prev,
        preset: 'heterodyne-notch',
        notchHz: 0,
        notchQ: 20
      }));
      setStatusMessage('Applied notch preset mitigation (heterodyne).');
    }
  }, [demodMode, signalWarnings, streamSampleRateHz]);

  const captureTraceB = useCallback(() => {
    if (analyzerTrace.length === 0) {
      setStatusMessage('Trace B capture unavailable: no analyzer trace yet.');
      return;
    }
    setTraceB(analyzerTrace.slice());
    setStatusMessage(`Captured Trace B (${analyzerTrace.length} bins).`);
  }, [analyzerTrace]);

  const clearTraceB = useCallback(() => {
    setTraceB(null);
    setStatusMessage('Cleared Trace B.');
  }, []);

  const tuneToMarkerTableFrequency = useCallback((frequencyHz: number) => {
    tuneToDisplayFrequency(frequencyHz);
    setAnalyzerMarker({
      frequencyHz,
      placedAtIso: new Date().toISOString()
    });
    setStatusMessage(`Tuned to marker table frequency ${Math.round(frequencyHz).toLocaleString()} Hz.`);
  }, [tuneToDisplayFrequency]);

  const addSpurAnnotationFromMarker = useCallback(() => {
    if (!markerReadout) {
      setStatusMessage('Add spur annotation requires marker A.');
      return;
    }

    const next: SpurArtifactAnnotation = {
      id: `spur-${Date.now()}`,
      frequencyHz: Math.round(markerReadout.frequencyHz),
      label: 'User annotation',
      kind: 'device',
      masked: false
    };
    setSpurAnnotations((prev) => [next, ...prev].slice(0, 64));
    setStatusMessage(`Added spur annotation at ${next.frequencyHz.toLocaleString()} Hz.`);
  }, [markerReadout]);

  const exportAnalyzerSnapshot = useCallback(() => {
    const payload = {
      schemaVersion: 'analyzer-export.v1',
      exportedAtUtc: new Date().toISOString(),
      settings: {
        detectorMode: analyzerDetectorMode,
        traceMathMode: analyzerTraceMathMode,
        vbwFrames: analyzerVbwFrames,
        rbwHz: analyzerSemantics.rbwHz,
        vbwHz: analyzerSemantics.vbwHz,
        enbwBins: analyzerSemantics.enbwBins,
        referenceLevelDb: analyzerReferenceLevelDb,
        windowMode: analyzerWindowMode,
        peakHoldEnabled: analyzerPeakHoldEnabled,
        peakHoldMode: analyzerPeakHoldMode,
        artifactMaskEnabled
      },
      traces: {
        traceA: Array.from(analyzerTrace),
        traceB: traceB ? Array.from(traceB) : null,
        stitchedSweep: sweepStitchedPoints
      },
      markerTable: markerTableRows,
      markers: {
        markerA: markerReadout,
        markerB: secondaryMarkerReadout
      },
      candidateStats: candidateSignalStats,
      signalWarnings,
      spurAnnotations
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rad-io-analyzer-export-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setStatusMessage('Analyzer export created.');
  }, [
    analyzerDetectorMode,
    analyzerPeakHoldEnabled,
    analyzerPeakHoldMode,
    analyzerReferenceLevelDb,
    analyzerSemantics.enbwBins,
    analyzerSemantics.rbwHz,
    analyzerSemantics.vbwHz,
    analyzerTrace,
    analyzerTraceMathMode,
    analyzerVbwFrames,
    analyzerWindowMode,
    artifactMaskEnabled,
    candidateSignalStats,
    markerReadout,
    markerTableRows,
    secondaryMarkerReadout,
    signalWarnings,
    spurAnnotations,
    sweepStitchedPoints,
    traceB
  ]);

  const quickCaptureMarkerOrVfo = useCallback(() => {
    const captureFrequencyHz = markerReadout?.frequencyHz ?? activeVfoDisplayFrequencyHz;
    const trace = analyzerTrace;
    if (!Number.isFinite(captureFrequencyHz) || trace.length === 0) {
      setStatusMessage('Quick capture unavailable: analyzer trace not ready.');
      return;
    }

    const centerBin = frequencyHzToBinIndex(captureFrequencyHz, trace.length, displayCenterFrequencyHz, streamSampleRateHz);
    const start = Math.max(0, centerBin - 64);
    const end = Math.min(trace.length, centerBin + 65);

    const payload = {
      schemaVersion: 'marker-vfo-quick-capture.v1',
      capturedAtUtc: new Date().toISOString(),
      captureTarget: markerReadout ? 'marker' : 'active-vfo',
      frequencyHz: Math.round(captureFrequencyHz),
      sampleRateHz: streamSampleRateHz,
      ppmCorrection: ppmCorrection,
      fineTuneHz: fineFreq,
      centerFrequencyHz: displayCenterFrequencyHz,
      secondaryVfoEnabled,
      secondaryVfoOffsetHz,
      discontinuities: discontinuityTimelineRef.current.slice(-20),
      traceWindow: {
        startBin: start,
        endBinExclusive: end,
        valuesDbfs: Array.from(trace.slice(start, end))
      }
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rad-io-marker-quick-capture-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setStatusMessage('Marker/VFO quick capture exported.');
  }, [
    activeVfoDisplayFrequencyHz,
    analyzerTrace,
    displayCenterFrequencyHz,
    fineFreq,
    markerReadout,
    ppmCorrection,
    secondaryVfoEnabled,
    secondaryVfoOffsetHz,
    streamSampleRateHz
  ]);

  const runSweepStitch = useCallback(async () => {
    if (!sweepExecutionPlan.canRun) {
      setSweepStatus(sweepExecutionPlan.status);
      setStatusMessage(sweepExecutionPlan.status);
      return;
    }

    if (sweepState === 'running') {
      return;
    }

    const hostBridgeProbe = sweepHostBridgeProbe;
    setSweepState('running');
    setSweepStatus(
      sweepExecutionPlan.mode === 'hardware' || sweepExecutionPlan.mode === 'hardware-host-assisted'
        ? 'Running hardware sweep...'
        : 'Running software sweep/stitch...'
    );
    const originalHz = tunedDisplayFrequencyHz;
    const spanHz = Math.max(streamSampleRateHz, 2_000_000);
    const stepHz = Math.max(50_000, Math.round(spanHz / 4));
    const startHz = Math.round(originalHz - spanHz / 2);
    const stopHz = Math.round(originalHz + spanHz / 2);
    const segments: SweepSegment[] = [];
    const startedAtIso = new Date().toISOString();

    try {
      if (sweepExecutionPlan.mode === 'hardware-host-assisted') {
        if (!hostBridgeProbe.available || !hostBridgeProbe.bridge) {
          throw new Error(hostBridgeProbe.reason ?? 'Host bridge is not available for hackrf_sweep.');
        }

        const hostResponse: HackrfSweepHostResponse = await runHackrfSweepViaHostBridge({
          bridge: hostBridgeProbe.bridge,
          request: {
            startFrequencyHz: startHz,
            stopFrequencyHz: stopHz,
            stepHz,
            sampleRateHz: streamSampleRateHz,
            timeoutMs: 20_000
          }
        });

        setSweepStitchedPoints(hostResponse.points);
        setSweepState('completed');
        setSweepStatus(
          `Hardware sweep complete (${hostResponse.points.length} points via ${hostBridgeProbe.providerLabel ?? 'host bridge'}).`
        );
        setSweepRunEvidence({
          executor: 'host-bridge-hackrf-sweep',
          startedAtIso,
          completedAtIso: new Date().toISOString(),
          segmentCount: 0,
          stitchedPointCount: hostResponse.points.length,
          providerLabel: hostBridgeProbe.providerLabel,
          elapsedMs: hostResponse.elapsedMs,
          diagnostics: hostResponse.diagnostics ?? []
        });
        pushDiagnosticEvent(
          `Host hardware sweep completed (${hostResponse.points.length} points, ${Math.round(hostResponse.elapsedMs)} ms).`,
          'info',
          'analyzer'
        );
        return;
      }

      for (let freqHz = startHz; freqHz <= stopHz; freqHz += stepHz) {
        tuneToDisplayFrequency(freqHz);
        setSweepStatus(`Sweep capture at ${(freqHz / 1_000_000).toFixed(3)} MHz`);
        await new Promise<void>((resolve) => {
          window.setTimeout(resolve, 220);
        });
        const trace = fftDataRef.current.slice();
        segments.push({
          centerFrequencyHz: freqHz,
          sampleRateHz: streamSampleRateHz,
          trace
        });
      }

      tuneToDisplayFrequency(originalHz);
      const stitched = stitchSweepSegments(segments);
      setSweepStitchedPoints(stitched);
      setSweepState('completed');
      setSweepStatus(`Sweep complete (${segments.length} segments, ${stitched.length} stitched points).`);
      setSweepRunEvidence({
        executor: 'software-stitch',
        startedAtIso,
        completedAtIso: new Date().toISOString(),
        segmentCount: segments.length,
        stitchedPointCount: stitched.length,
        diagnostics: ['Executed software tune/settle/stitch sweep in browser WebUSB path.']
      });
      pushDiagnosticEvent(
        `Software sweep/stitch completed (${segments.length} segments, ${stitched.length} points).`,
        'info',
        'analyzer'
      );
    } catch (error) {
      tuneToDisplayFrequency(originalHz);
      setSweepState('error');
      const message = error instanceof Error ? error.message : String(error);
      setSweepStatus(`Sweep failed: ${message}`);
      setSweepRunEvidence({
        executor: sweepExecutionPlan.mode === 'hardware-host-assisted' ? 'host-bridge-hackrf-sweep' : 'software-stitch',
        startedAtIso,
        completedAtIso: new Date().toISOString(),
        segmentCount: segments.length,
        stitchedPointCount: 0,
        providerLabel: hostBridgeProbe.providerLabel,
        diagnostics: [message]
      });
      pushDiagnosticEvent(`Sweep failed: ${message}`, 'warn', 'analyzer');
    }
  }, [
    pushDiagnosticEvent,
    streamSampleRateHz,
    sweepHostBridgeProbe,
    sweepExecutionPlan.canRun,
    sweepExecutionPlan.mode,
    sweepExecutionPlan.status,
    sweepState,
    tuneToDisplayFrequency,
    tunedDisplayFrequencyHz
  ]);

  const recallDisplayFrequency = useCallback((slot: 'A' | 'B') => {
    const target = slot === 'A' ? recallSlotAHz : recallSlotBHz;
    if (target === null) {
      setStatusMessage(`Recall slot ${slot} is empty.`);
      return;
    }

    const appliedDisplayHz = tuneToDisplayFrequency(target);
    setStatusMessage(`Recalled slot ${slot} at ${(appliedDisplayHz / 1_000_000).toFixed(3)} MHz.`);
  }, [recallSlotAHz, recallSlotBHz, tuneToDisplayFrequency]);

  const applyBandGuardrailSuggestedDefaults = useCallback(() => {
    if (!selectedBand) {
      return;
    }

    setDemodMode(selectedBand.defaultMode as DemodMode);
    const suggestedStepHz = stepForBandModeHz(
      selectedBand,
      selectedBand.defaultMode,
      defaultStepForModeHz(selectedBand.defaultMode)
    );
    setTuningStepHz(suggestedStepHz);
    setFineTuningStepHz(Math.max(50, Math.min(1_000, Math.floor(suggestedStepHz / 10) || 50)));

    if (selectedBand.preferredNfmPreset && selectedBand.defaultMode === 'NFM') {
      setNfmAudioPreset(selectedBand.preferredNfmPreset);
    }

    setBandGuardrailPromptDismissed(true);
    setStatusMessage(`Applied ${selectedBand.label} defaults (${selectedBand.defaultMode}).`);
  }, [selectedBand]);

  const tuneToMarker = useCallback((trigger: 'ui' | 'keyboard') => {
    if (!analyzerMarker) {
      setStatusMessage('Tune-to-marker requires an active marker.');
      pushDiagnosticEvent(`Tune-to-marker (${trigger}) ignored: no marker active.`, 'warn', 'analyzer');
      return;
    }

    const nextFrequencyHz = Math.round(analyzerMarker.frequencyHz);
    tuneToDisplayFrequency(nextFrequencyHz);
    setLastLockFrequencyHz(nextFrequencyHz);
    setStatusMessage(`Tuned to marker at ${nextFrequencyHz.toLocaleString()} Hz.`);
    pushDiagnosticEvent(`Tune-to-marker (${trigger}) tuned to ${nextFrequencyHz} Hz.`, 'info', 'analyzer');
  }, [analyzerMarker, pushDiagnosticEvent, tuneToDisplayFrequency]);

  const returnToLastLock = useCallback((trigger: 'ui' | 'keyboard') => {
    if (lastLockFrequencyHz === null) {
      setStatusMessage('Retune assist unavailable: no previous lock candidate.');
      pushDiagnosticEvent(`Retune assist (${trigger}) ignored: no lock candidate.`, 'warn', 'analyzer');
      return;
    }

    tuneToDisplayFrequency(lastLockFrequencyHz);
    setStatusMessage(`Retune assist returned to ${lastLockFrequencyHz.toLocaleString()} Hz.`);
    pushDiagnosticEvent(`Retune assist (${trigger}) returned to ${lastLockFrequencyHz} Hz.`, 'info', 'analyzer');
  }, [lastLockFrequencyHz, pushDiagnosticEvent, tuneToDisplayFrequency]);

  useEffect(() => {
    if (!isRunning || !afcEnabled || lastLockFrequencyHz === null) {
      return;
    }

    const driftLikelyUnstable = frequencyModelState.driftConfidence < 0.25 && Math.abs(frequencyModelState.phaseErrorRms) > 0.1;
    if (!driftLikelyUnstable) {
      return;
    }

    setStatusMessage('Retune assist ready: drift lock degraded, press R to return to last lock.');
    pushDiagnosticEvent(
      `Retune assist armed after drift degradation (confidence ${frequencyModelState.driftConfidence.toFixed(2)}).`,
      'warn',
      'analyzer'
    );
  }, [
    afcEnabled,
    frequencyModelState.driftConfidence,
    frequencyModelState.phaseErrorRms,
    isRunning,
    lastLockFrequencyHz,
    pushDiagnosticEvent
  ]);

  useEffect(() => {
    const onAnalyzerKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) {
        return;
      }

      const target = event.target as HTMLElement | null;
      const isTyping = target?.tagName === 'INPUT' || target?.tagName === 'SELECT' || target?.tagName === 'TEXTAREA';
      if (isTyping || commandPaletteOpen || shortcutsHelpOpen) {
        return;
      }

      if (event.key === 'c' || event.key === 'C') {
        event.preventDefault();
        runCenterOnPeak('keyboard');
        return;
      }

      if (event.key === 's' || event.key === 'S') {
        event.preventDefault();
        runSnapToSignal('keyboard');
        return;
      }

      if (event.key === 't' || event.key === 'T') {
        event.preventDefault();
        tuneToMarker('keyboard');
        return;
      }

      if (event.key === 'x' || event.key === 'X') {
        event.preventDefault();
        clearMarker('keyboard');
        return;
      }

      if (event.key === 'r' || event.key === 'R') {
        event.preventDefault();
        returnToLastLock('keyboard');
      }
    };

    window.addEventListener('keydown', onAnalyzerKeyDown);
    return () => window.removeEventListener('keydown', onAnalyzerKeyDown);
  }, [clearMarker, commandPaletteOpen, returnToLastLock, runCenterOnPeak, runSnapToSignal, shortcutsHelpOpen, tuneToMarker]);

  const handleSpectrumClick = (binIndex: number) => {
    const fftSize = fftDataRef.current.length > 0 ? fftDataRef.current.length : 2048;
    const centerBin = Math.floor(fftSize / 2);
    const offsetBins = binIndex - centerBin;
    const offsetHz = offsetBins * (streamSampleRateHz / fftSize);
    
    // Update Fine Tune
    // Note: NCO Mix uses Positive frequency to shift DOWN.
    // If signal is at +200kHz, we want to shift it DOWN by 200kHz to reach DC.
    // So NCO Frequency should be +200kHz.
    // So logic is direct: fineFreq = offsetHz.
    
    setFineFreq(clampFineTuneHz(Math.round(offsetHz), filterState.highCutHz, streamSampleRateHz));
  };

    const measurementDisclosure = useMemo(() => {
      if (sourceType === 'FILE') {
        return createMeasurementCalibrationDisclosure(goldenToneFixtureBundle.metadata);
      }

      return createMeasurementCalibrationDisclosure();
    }, [sourceType]);

  const frontEndOverloadAssessment = useMemo(() => {
    if (connectionState !== 'streaming' || fftData.length === 0) {
      return null;
    }

    const peakDb = fftData.reduce((max, value) => Math.max(max, value), -Infinity);
    const meanDb = fftData.reduce((sum, value) => sum + value, 0) / fftData.length;
    let elevatedBinCount = 0;
    for (let i = 0; i < fftData.length; i += 1) {
      if (fftData[i] > meanDb + 18) {
        elevatedBinCount += 1;
      }
    }

    const clipRisk01 = Math.max(
      0,
      Math.min(1, (runtimeTelemetry.dsp.amplitude.iqPeakLinear - 0.92) / 0.08)
    );

    const assessment = assessFrontEndOverloadTriage({
      frequencyHz: frequency,
      fftPeakDb: peakDb,
      fftMeanDb: meanDb,
      elevatedBinCount,
      totalBinCount: fftData.length,
      clipRisk01,
      snrEstimateDb: demodQuality.snrEstimateDb,
      hasAttenuatorHint: rfEnvironmentContext.attenuatorNote.trim().length > 0,
      hasPreampHint: rfEnvironmentContext.preampNote.trim().length > 0
    });

    return {
      ...assessment,
      peakDb,
      meanDb,
      elevatedBinCount,
      guidance: buildFrontEndHealthRecommendation({
        frequencyHz: frequency,
        sourceType,
        rfChainNotes: rfEnvironmentContext.chainNotes,
        hasAttenuatorHint: rfEnvironmentContext.attenuatorNote.trim().length > 0,
        hasPreampHint: rfEnvironmentContext.preampNote.trim().length > 0,
        overloadLikely: assessment.overloadLikely
      })
    };
  }, [
    connectionState,
    demodQuality.snrEstimateDb,
    fftData,
    frequency,
    rfEnvironmentContext.attenuatorNote,
    rfEnvironmentContext.chainNotes,
    rfEnvironmentContext.preampNote,
    runtimeTelemetry.dsp.amplitude.iqPeakLinear,
    sourceType
  ]);

  const sessionGradeStabilityWindowSeconds = (() => {
    const samples = telemetryWindowRef.current;
    if (samples.length < 2) {
      return 0;
    }

    let stableWindowStartIndex = 0;
    for (let i = samples.length - 1; i >= 0; i -= 1) {
      const sample = samples[i];
      const unstable = sample.audioUnderruns > 0
        || sample.totalDroppedSamples > 0
        || sample.streamDiscontinuities > 0
        || sample.audioSafetyMuteEvents > 0;

      if (unstable) {
        stableWindowStartIndex = i + 1;
        break;
      }

      if (i === 0) {
        stableWindowStartIndex = 0;
      }
    }

    if (stableWindowStartIndex >= samples.length - 1) {
      return 0;
    }

    const startMs = Date.parse(samples[stableWindowStartIndex].ts);
    const endMs = Date.parse(samples[samples.length - 1].ts);
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) {
      return 0;
    }

    return Math.max(0, (endMs - startMs) / 1000);
  })();

  const calibrationWizardAssessment = useMemo(() => {
    return runFrequencyCalibrationWizard({
      sourceId: calibrationWizardSourceId,
      observedSNRDb: demodQuality.snrEstimateDb,
      observationSeconds: sessionGradeStabilityWindowSeconds,
      lockStable: demodQuality.lockState === 'locked',
      driftEstimateHzPerSec: frequencyModelState.driftEstimateHzPerSec
    });
  }, [
    calibrationWizardSourceId,
    demodQuality.lockState,
    demodQuality.snrEstimateDb,
    frequencyModelState.driftEstimateHzPerSec,
    sessionGradeStabilityWindowSeconds
  ]);

  const activeBandCalibrationProfile = useMemo(() => {
    void calibrationStoreRevision;
    return getBandCalibrationProfile(activeDeviceProfileKey, activeCalibrationBandId)
      ?? createDefaultBandCalibrationProfile(activeCalibrationBandId, calibrationWizardSourceId);
  }, [activeCalibrationBandId, activeDeviceProfileKey, calibrationStoreRevision, calibrationWizardSourceId]);

  const activeAmplitudeCalibration = useMemo(() => {
    void calibrationStoreRevision;
    return getAmplitudeCalibration(activeDeviceProfileKey, activeCalibrationBandId);
  }, [activeCalibrationBandId, activeDeviceProfileKey, calibrationStoreRevision]);

  const levelCalibrationAssessment = useMemo(() => {
    const observedSignalDbfs = markerReadout?.powerDbfs ?? candidateSignalStats.strongestPeakDbfs;

    return runLevelCalibrationWizard({
      sourceId: calibrationWizardSourceId,
      bandId: activeCalibrationBandId,
      observedSignalDbfs,
      expectedSignalDbm: levelCalibrationReferenceDbm,
      observedNoiseFloorDbfs: candidateSignalStats.noiseFloorDbfs,
      observationSeconds: sessionGradeStabilityWindowSeconds,
      driftConfidence01: frequencyModelState.driftConfidence,
      lockStable: demodQuality.lockState === 'locked',
      rfChainNetGainDb: 0
    });
  }, [
    activeCalibrationBandId,
    calibrationWizardSourceId,
    candidateSignalStats.noiseFloorDbfs,
    candidateSignalStats.strongestPeakDbfs,
    demodQuality.lockState,
    frequencyModelState.driftConfidence,
    levelCalibrationReferenceDbm,
    markerReadout?.powerDbfs,
    sessionGradeStabilityWindowSeconds
  ]);

  const externalReferenceAssessment = useMemo(() => {
    const counters = deviceDebugSnapshot?.counters;
    return assessExternalReferenceStability({
      sourceType,
      isStreaming: connectionState === 'streaming',
      lastClockTruthMode: runtimeTelemetry.lastClockTruthMode,
      driftConfidence: frequencyModelState.driftConfidence,
      phaseErrorRms: frequencyModelState.phaseErrorRms,
      audioResamplerRatioDeltaPpm: runtimeTelemetry.audioResamplerRatioDeltaPpm,
      usbTransferJitterMs: counters?.transferIntervalMsJitter ?? 0,
      usbRetryCount: counters?.retryCount ?? 0,
      usbErrorCount: counters?.bulkInErrorCount ?? 0
    });
  }, [
    connectionState,
    deviceDebugSnapshot?.counters,
    frequencyModelState.driftConfidence,
    frequencyModelState.phaseErrorRms,
    runtimeTelemetry.audioResamplerRatioDeltaPpm,
    runtimeTelemetry.lastClockTruthMode,
    sourceType
  ]);

  const referenceClockVisibility = useMemo(() => {
    return deriveReferenceClockVisibility({
      capabilityModel: activeCapabilityModel,
      sampleClockTruthMode: runtimeTelemetry.lastClockTruthMode,
      externalReferenceAssessment,
      sourceType
    });
  }, [activeCapabilityModel, externalReferenceAssessment, runtimeTelemetry.lastClockTruthMode, sourceType]);

  const referenceClockSupportModel = useMemo(() => {
    return deriveReferenceClockSupportModel({
      sourceType,
      capabilityModel: activeCapabilityModel,
      sampleClockTruthMode: runtimeTelemetry.lastClockTruthMode
    });
  }, [activeCapabilityModel, runtimeTelemetry.lastClockTruthMode, sourceType]);

  const referenceLockProof = useMemo(() => {
    void runtimeTelemetry.lastFrameSequence;
    return evaluateReferenceLockProof({
      supportModel: referenceClockSupportModel,
      sampleClockTruthMode: runtimeTelemetry.lastClockTruthMode,
      samples: referenceLockSamplesRef.current,
      minWindowSeconds: REFERENCE_LOCK_PROOF_WINDOW_SECONDS
    });
  }, [referenceClockSupportModel, runtimeTelemetry.lastClockTruthMode, runtimeTelemetry.lastFrameSequence]);

  const firmwareRecoveryPlan = useMemo(() => {
    if (sourceType !== 'HACKRF') {
      return null;
    }

    return buildHackrfFirmwareRecoveryPlan(deviceDebugSnapshot?.compatibility);
  }, [deviceDebugSnapshot?.compatibility, sourceType]);

  const webUsbRequired = isWebUsbSource(sourceType);

  const timebaseDriftAssessment = useMemo(() => {
    return assessTimebaseDriftTelemetry({
      streamSampleRateHz,
      driftEstimateHzPerSec: frequencyModelState.driftEstimateHzPerSec,
      driftConfidence: frequencyModelState.driftConfidence,
      phaseErrorRms: frequencyModelState.phaseErrorRms,
      audioResamplerRatio: runtimeTelemetry.audioResamplerRatio,
      audioResamplerRatioDeltaPpm: runtimeTelemetry.audioResamplerRatioDeltaPpm,
      audioQueueJitterMs: runtimeTelemetry.audioQueueJitterMs,
      clockTruthMode: runtimeTelemetry.lastClockTruthMode
    });
  }, [
    streamSampleRateHz,
    frequencyModelState.driftEstimateHzPerSec,
    frequencyModelState.driftConfidence,
    frequencyModelState.phaseErrorRms,
    runtimeTelemetry.audioResamplerRatio,
    runtimeTelemetry.audioResamplerRatioDeltaPpm,
    runtimeTelemetry.audioQueueJitterMs,
    runtimeTelemetry.lastClockTruthMode
  ]);

  const timebaseModelState = useMemo(() => {
    return buildTimebaseModelState({
      sampleClockTruthMode: runtimeTelemetry.lastClockTruthMode,
      clockSyncPolicy,
      streamSampleRateHz,
      driftEstimateHzPerSec: frequencyModelState.driftEstimateHzPerSec,
      driftConfidence01: frequencyModelState.driftConfidence,
      phaseErrorRms: frequencyModelState.phaseErrorRms,
      audioResamplerRatio: runtimeTelemetry.audioResamplerRatio,
      audioResamplerRatioDeltaPpm: runtimeTelemetry.audioResamplerRatioDeltaPpm,
      audioQueueJitterMs: runtimeTelemetry.audioQueueJitterMs
    });
  }, [
    clockSyncPolicy,
    frequencyModelState.driftConfidence,
    frequencyModelState.driftEstimateHzPerSec,
    frequencyModelState.phaseErrorRms,
    runtimeTelemetry.audioQueueJitterMs,
    runtimeTelemetry.audioResamplerRatio,
    runtimeTelemetry.audioResamplerRatioDeltaPpm,
    runtimeTelemetry.lastClockTruthMode,
    streamSampleRateHz
  ]);

  const sampleRateMismatchAssessment = useMemo(() => {
    return assessSampleRateMismatchStrategy({
      deviceIqSampleRateHz: streamSampleRateHz,
      dspInputSampleRateHz: streamRatePlan.sampleRateHz,
      dspOutputSampleRateHz: streamRatePlan.outputSampleRateHz,
      audioResamplerRatio: runtimeTelemetry.audioResamplerRatio,
      audioResamplerRatioDeltaPpm: runtimeTelemetry.audioResamplerRatioDeltaPpm
    });
  }, [
    runtimeTelemetry.audioResamplerRatio,
    runtimeTelemetry.audioResamplerRatioDeltaPpm,
    streamRatePlan.outputSampleRateHz,
    streamRatePlan.sampleRateHz,
    streamSampleRateHz
  ]);

  const iqIntegrityAssessment = useMemo(() => {
    const sampleRateMismatchRisk = sampleRateMismatchAssessment.severity === 'warn'
      ? (sampleRateMismatchAssessment.mismatchPpm > 500 ? 'critical' : 'warn')
      : 'nominal';

    return assessIqIntegrityWizard({
      imageRejectionDb: runtimeTelemetry.dsp.rfImpurity.imageRejectionDb,
      iqBalanceRatio: runtimeTelemetry.dsp.rfImpurity.iqImbalanceRatio,
      iqDcOffset01: Math.max(0, Math.min(1, (runtimeTelemetry.dsp.rfImpurity.dcSpurLevelDbfs + 80) / 80)),
      iqPeakLinear: runtimeTelemetry.dsp.amplitude.iqPeakLinear,
      sampleRateMismatchRisk
    });
  }, [
    runtimeTelemetry.dsp.amplitude.iqPeakLinear,
    runtimeTelemetry.dsp.rfImpurity.dcSpurLevelDbfs,
    runtimeTelemetry.dsp.rfImpurity.iqImbalanceRatio,
    runtimeTelemetry.dsp.rfImpurity.imageRejectionDb,
    sampleRateMismatchAssessment.mismatchPpm,
    sampleRateMismatchAssessment.severity
  ]);

  const spurCatalogMatches = useMemo(() => {
    void spurCatalogRevision;
    if (!markerReadout) {
      return [];
    }

    return findSpurCatalogMatches({
      deviceProfileKey: activeDeviceProfileKey,
      sampleRateHz: streamSampleRateHz,
      gainSignature: serializeGainProfile(gains),
      candidateFrequencyHz: markerReadout.frequencyHz,
      toleranceHz: Math.max(100, streamSampleRateHz / 4096)
    });
  }, [
    activeDeviceProfileKey,
    gains,
    markerReadout,
    serializeGainProfile,
    spurCatalogRevision,
    streamSampleRateHz
  ]);

  const signalIdAdvisor = useMemo(() => {
    const peakDbfs = fftData.length > 0
      ? fftData.reduce((max, value) => Math.max(max, value), -Infinity)
      : -160;
    const meanDbfs = fftData.length > 0
      ? fftData.reduce((sum, value) => sum + value, 0) / fftData.length
      : -160;

    return buildSignalIdTuningAdvisor({
      peakDbfs,
      meanDbfs,
      snrEstimateDb: demodQuality.snrEstimateDb,
      demodMode,
      bandwidthHz: Math.max(0, filterState.highCutHz - filterState.lowCutHz),
      dcSpurLevelDbfs: runtimeTelemetry.dsp.rfImpurity.dcSpurLevelDbfs,
      spurDensity01: runtimeTelemetry.dsp.rfImpurity.spurDensity01
    });
  }, [
    demodMode,
    demodQuality.snrEstimateDb,
    fftData,
    filterState.highCutHz,
    filterState.lowCutHz,
    runtimeTelemetry.dsp.rfImpurity.dcSpurLevelDbfs,
    runtimeTelemetry.dsp.rfImpurity.spurDensity01
  ]);

  const bufferTelemetryAssessment = useMemo(() => {
    return assessBufferTelemetry({
      audioQueueAheadMs: runtimeTelemetry.audioQueueAheadMs,
      audioTargetQueueMs: audioPllState.targetQueueMs,
      dspTotalMs: runtimeTelemetry.dsp.pipelineTiming.totalMs,
      usbTransferJitterMs: deviceDebugSnapshot?.counters?.transferIntervalMsJitter ?? 0,
      usbRetryCount: deviceDebugSnapshot?.counters?.retryCount ?? 0,
      usbErrorCount: deviceDebugSnapshot?.counters?.bulkInErrorCount ?? 0,
      droppedFrameEvents: runtimeTelemetry.droppedFrameEvents,
      audioUnderruns: runtimeTelemetry.audioUnderruns
    });
  }, [
    audioPllState.targetQueueMs,
    deviceDebugSnapshot?.counters?.bulkInErrorCount,
    deviceDebugSnapshot?.counters?.retryCount,
    deviceDebugSnapshot?.counters?.transferIntervalMsJitter,
    runtimeTelemetry.audioQueueAheadMs,
    runtimeTelemetry.audioUnderruns,
    runtimeTelemetry.droppedFrameEvents,
    runtimeTelemetry.dsp.pipelineTiming.totalMs
  ]);

  const audioQueueTrend = useMemo(() => {
    const normalizedQueueValues = telemetryWindowRef.current
      .slice(-24)
      .map((sample) => sample.audioQueueAheadMs / Math.max(1, audioPllState.targetQueueMs));

    return buildAsciiOccupancyTrend(normalizedQueueValues);
  }, [audioPllState.targetQueueMs]);

    const healthItems = useMemo(() => {
      const items: Array<{ key: string; level: HealthLevel; label: string; recommendation: string }> = [];

      if (connectionState === 'error') {
        items.push({
          key: 'connection-error',
          level: 'error',
          label: 'Connection failed',
          recommendation: 'Retry stream start and export diagnostics if it repeats.'
        });
      } else if (connectionState === 'pairing') {
        items.push({
          key: 'connection-pairing',
          level: 'warn',
          label: 'Pairing and opening source',
          recommendation: 'Approve browser permission prompts and wait for source open.'
        });
      } else if (connectionState === 'connected') {
        items.push({
          key: 'connection-connected',
          level: 'ok',
          label: 'Source connected',
          recommendation: 'Configuring DSP and stream pipeline.'
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
        const peakDb = frontEndOverloadAssessment?.peakDb ?? fftData.reduce((max, value) => Math.max(max, value), -Infinity);

        if (frontEndOverloadAssessment?.overloadLikely) {
          const actionPlan = frontEndOverloadAssessment.overloadActions.slice(0, 3).join('; ');

          items.push({
            key: 'front-end-overload-suspected',
            level: 'warn',
            label: 'Front-end overload/intermod suspected',
            recommendation: `${frontEndOverloadAssessment.overloadSummary} ${frontEndOverloadAssessment.guidance} Actions: ${actionPlan}.`
          });
        }

        if (frontEndOverloadAssessment) {
          const dynamicActions = frontEndOverloadAssessment.dynamicRangeActions.slice(0, 2).join('; ');
          items.push({
            key: 'dynamic-range-linearity-check',
            level: frontEndOverloadAssessment.dynamicRangeDegraded ? 'warn' : 'ok',
            label: frontEndOverloadAssessment.dynamicRangeDegraded
              ? 'Dynamic range/linearity check: degraded'
              : 'Dynamic range/linearity check: stable',
            recommendation: `${frontEndOverloadAssessment.dynamicRangeSummary} ${dynamicActions}.`
          });
        }

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

      if (runtimeTelemetry.audioSafetyMuteEvents > 0) {
        items.push({
          key: 'audio-safety-mute-events',
          level: 'warn',
          label: `Audio safety mute engaged (${runtimeTelemetry.audioSafetyMuteEvents})`,
          recommendation: 'Output was muted to prevent unsafe transients. Reduce gain/output level and inspect clipping.'
        });
      }

      if (connectionState === 'streaming') {
        items.push({
          key: 'timebase-drift',
          level: timebaseDriftAssessment.severity,
          label: timebaseDriftAssessment.stable
            ? 'Timebase and drift telemetry stable'
            : 'Timebase and drift telemetry warning',
          recommendation: `${timebaseDriftAssessment.summary} ${timebaseDriftAssessment.recommendations.slice(0, 2).join('; ')}.`
        });
        items.push({
          key: 'sample-rate-mismatch-strategy',
          level: sampleRateMismatchAssessment.severity,
          label: sampleRateMismatchAssessment.severity === 'warn'
            ? 'Sample-rate mismatch strategy warning'
            : 'Sample-rate mismatch strategy stable',
          recommendation: `${sampleRateMismatchAssessment.summary} ${sampleRateMismatchAssessment.recommendations.slice(0, 2).join(' ')}`
        });
        items.push({
          key: 'clock-sync-policy',
          level: 'ok',
          label: `Clock sync policy: ${clockSyncPolicy === 'rf-accurate' ? 'RF-accurate' : 'Audio-stable'}`,
          recommendation: describeClockSyncPolicy(clockSyncPolicy)
        });
        items.push({
          key: 'background-audio-reliability',
          level: backgroundAudioGuardActive ? 'ok' : 'warn',
          label: backgroundAudioGuardActive
            ? 'Background audio guard active'
            : 'Background audio guard unavailable',
          recommendation: backgroundAudioGuardActive
            ? 'Wake lock + keep-alive ping enabled while hidden to reduce background stutter risk.'
            : 'Wake lock unavailable; keep the tab foregrounded for best long-run audio stability.'
        });

        items.push({
          key: 'rf-impurity-telemetry',
          level: runtimeTelemetry.dsp.rfImpurity.likelyImpure ? 'warn' : 'ok',
          label: runtimeTelemetry.dsp.rfImpurity.likelyImpure
            ? 'RF impurity indicators elevated'
            : 'RF impurity indicators stable',
          recommendation: runtimeTelemetry.dsp.rfImpurity.likelyImpure
            ? `DC ${runtimeTelemetry.dsp.rfImpurity.dcSpurLevelDbfs.toFixed(1)} dBFS, IRR ${runtimeTelemetry.dsp.rfImpurity.imageRejectionDb.toFixed(1)} dB, reasons: ${runtimeTelemetry.dsp.rfImpurity.reasons.join(', ')}.`
            : `DC ${runtimeTelemetry.dsp.rfImpurity.dcSpurLevelDbfs.toFixed(1)} dBFS, IRR ${runtimeTelemetry.dsp.rfImpurity.imageRejectionDb.toFixed(1)} dB.`
        });

        items.push({
          key: 'signal-id-tuning-advisor',
          level: signalIdAdvisor.warnings.length > 0 ? 'warn' : 'ok',
          label: 'Signal ID & tuning advisor',
          recommendation: `${signalIdAdvisor.summary}${signalIdAdvisor.warnings.length > 0 ? ` Warnings: ${signalIdAdvisor.warnings.join(', ')}.` : ''}`
        });

        items.push({
          key: 'buffer-telemetry',
          level: bufferTelemetryAssessment.counters.audioIssues > 0 || bufferTelemetryAssessment.counters.dspIssues > 0 ? 'warn' : 'ok',
          label: 'Buffer telemetry',
          recommendation: `USB ${(bufferTelemetryAssessment.occupancy01.usb * 100).toFixed(0)}% / DSP ${(bufferTelemetryAssessment.occupancy01.dsp * 100).toFixed(0)}% / Audio ${(bufferTelemetryAssessment.occupancy01.audio * 100).toFixed(0)}%, issues usb=${bufferTelemetryAssessment.counters.usbIssues} dsp=${bufferTelemetryAssessment.counters.dspIssues} audio=${bufferTelemetryAssessment.counters.audioIssues}.`
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

      if (iqIntegrityAssessment.status === 'warn') {
        items.push({
          key: 'iq-integrity-wizard',
          level: 'warn',
          label: 'IQ integrity wizard detected risks',
          recommendation: `${iqIntegrityAssessment.summary} Suggested fixes: ${iqIntegrityAssessment.fixes.join(', ')}.`
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

      if (webUsbRequired && !runtimePrerequisites.webUsbAvailable) {
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

      if (webUsbRequired && permissionState.usb === 'denied') {
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
      runtimeTelemetry.audioSafetyMuteEvents,
      runtimeTelemetry.totalDroppedSamples,
      runtimeTelemetry.renderFps,
      runtimeTelemetry.dsp.rfImpurity.dcSpurLevelDbfs,
      runtimeTelemetry.dsp.rfImpurity.imageRejectionDb,
      runtimeTelemetry.dsp.rfImpurity.likelyImpure,
      runtimeTelemetry.dsp.rfImpurity.reasons,
      signalIdAdvisor,
      bufferTelemetryAssessment,
      sampleRateMismatchAssessment,
      iqIntegrityAssessment,
      backgroundAudioGuardActive,
      frontEndOverloadAssessment,
      timebaseDriftAssessment,
      clockSyncPolicy,
      webUsbRequired,
      demodMode,
      demodQuality.lockState,
      demodQuality.quality,
      demodQuality.snrEstimateDb
    ]);

  const modeContract = MODE_CONTROL_CONTRACTS[demodMode];
  const selectedAudioOutputLabel = useMemo(() => {
    const selected = audioOutputDevices.find((device) => device.deviceId === audioOutputDeviceId);
    return selected?.label ?? 'System default';
  }, [audioOutputDeviceId, audioOutputDevices]);
  const displayedBandwidthHz = Math.max(0, filterState.highCutHz - filterState.lowCutHz);
  const demodLockLabel = lockStateLabel(demodMode, demodQuality.lockState);
  const frontEndEnobBits = estimateEffectiveEnobBits(demodQuality.snrEstimateDb);
  const frontEndClipRisk01 = Math.max(
    0,
    Math.min(1, (runtimeTelemetry.dsp.amplitude.iqPeakLinear - 0.92) / 0.08)
  );
  const overloadClippingTelemetry = useMemo(() => {
    const iqPeakLinear = runtimeTelemetry.dsp.amplitude.iqPeakLinear;
    const audioClippingRatio = runtimeTelemetry.dsp.amplitude.audioClippingRatio;
    const overrangeLikely = iqPeakLinear >= 0.99 || frontEndClipRisk01 >= 0.45;
    const warning = overrangeLikely || audioClippingRatio > 0.03;
    const actions: string[] = [];

    if (warning) {
      actions.push('Reduce RF gain by one stage and watch clip-risk + IQ peak metrics.');
      if ((rfEnvironmentContext.attenuatorNote ?? '').trim().length === 0) {
        actions.push('Insert 6-12 dB attenuation before the SDR if strong local signals are present.');
      }
      if ((rfEnvironmentContext.preampNote ?? '').trim().length > 0) {
        actions.push('Temporarily disable external preamp to validate front-end margin.');
      }
      if (frontEndOverloadAssessment?.guidance) {
        actions.push(frontEndOverloadAssessment.overloadSummary);
      }
    }

    return {
      warning,
      overrangeLikely,
      iqPeakLinear,
      clipRisk01: frontEndClipRisk01,
      audioClippingRatio,
      actions
    };
  }, [
    frontEndClipRisk01,
    frontEndOverloadAssessment?.guidance,
    frontEndOverloadAssessment?.overloadSummary,
    rfEnvironmentContext.attenuatorNote,
    rfEnvironmentContext.preampNote,
    runtimeTelemetry.dsp.amplitude.audioClippingRatio,
    runtimeTelemetry.dsp.amplitude.iqPeakLinear
  ]);
  const gainStagingAssistant = useMemo(() => {
    return assessGainStagingAssistant({
      frequencyHz: tunedDisplayFrequencyHz,
      demodMode,
      gainStages,
      currentGains: gains,
      iqPeakLinear: overloadClippingTelemetry.iqPeakLinear,
      audioClippingRatio: overloadClippingTelemetry.audioClippingRatio,
      snrEstimateDb: demodQuality.snrEstimateDb,
      overloadLikely: overloadClippingTelemetry.overrangeLikely
    });
  }, [
    demodMode,
    demodQuality.snrEstimateDb,
    gainStages,
    gains,
    overloadClippingTelemetry.audioClippingRatio,
    overloadClippingTelemetry.iqPeakLinear,
    overloadClippingTelemetry.overrangeLikely,
    tunedDisplayFrequencyHz
  ]);
  const applyGainStagingAssistantPreset = useCallback(() => {
    if (gainStages.length === 0) {
      setStatusMessage('No gain stages available for assistant preset application.');
      return;
    }

    setGains(gainStagingAssistant.recommendedGains);
    setStatusMessage(`Applied ${gainStagingAssistant.presetLabel}.`);
    pushDiagnosticEvent(`Gain staging assistant applied ${gainStagingAssistant.presetLabel}.`);
  }, [gainStages.length, gainStagingAssistant.presetLabel, gainStagingAssistant.recommendedGains, pushDiagnosticEvent]);

  const trustAssessment = useMemo(() => {
    const reasons: string[] = [];

    if (!runtimePrerequisites.crossOriginIsolated) {
      reasons.push('missing-isolation');
    }

    if (runtimeTelemetry.totalDroppedSamples > 0) {
      reasons.push('dropped-samples');
    }

    if (runtimeTelemetry.audioUnderruns > 0) {
      reasons.push('audio-underruns');
    }

    if (runtimeTelemetry.audioSafetyMuteEvents > 0) {
      reasons.push('audio-safety-mute');
    }

    if (Math.abs(audioPllState.queueErrorMs) > 120) {
      reasons.push('clock-queue-unstable');
    }

    if (reasons.length > 0) {
      return { grade: 'degraded' as const, reasons };
    }

    if (runtimeTelemetry.lastClockTruthMode === 'corrected_ppm' || runtimeTelemetry.lastClockTruthMode === 'disciplined_ref') {
      return { grade: 'measurement' as const, reasons: [] };
    }

    return { grade: 'listening' as const, reasons: [] };
  }, [
    audioPllState.queueErrorMs,
    runtimePrerequisites.crossOriginIsolated,
    runtimeTelemetry.audioUnderruns,
    runtimeTelemetry.audioSafetyMuteEvents,
    runtimeTelemetry.lastClockTruthMode,
    runtimeTelemetry.totalDroppedSamples
  ]);

  const sessionGradeEvaluation = useMemo(() => {
    const hasCalibration = measurementDisclosure.frequency.state !== 'uncalibrated'
      && (measurementDisclosure.level.state !== 'uncalibrated' || activeAmplitudeCalibration !== null);

    return evaluateSessionGradeUpgrade({
      stableWindowSeconds: sessionGradeStabilityWindowSeconds,
      minStableWindowSeconds: SESSION_GRADE_MIN_STABILITY_WINDOW_SECONDS,
      hasCalibration,
      crossOriginIsolated: runtimePrerequisites.crossOriginIsolated,
      hasKnownGoodProfile: stabilityProfile !== null,
      trustGrade: trustAssessment.grade
    });
  }, [
    activeAmplitudeCalibration,
    measurementDisclosure.frequency.state,
    measurementDisclosure.level.state,
    runtimePrerequisites.crossOriginIsolated,
    sessionGradeStabilityWindowSeconds,
    stabilityProfile,
    trustAssessment.grade
  ]);

  const recordingExportIntegrityPreview = useMemo(() => {
    return validateRecordingExportIntegrity({
      lastFrameSequence: runtimeTelemetry.lastFrameSequence,
      lastFrameSampleIndex: runtimeTelemetry.lastFrameSampleIndex,
      lastFrameTimestampNs: runtimeTelemetry.lastFrameTimestampNs,
      discontinuityEventTotal: discontinuityTimelineRef.current.length,
      calibrationState: measurementDisclosure.frequency.state,
      trustGrade: trustAssessment.grade,
      sessionGradeLocked: sessionGradeLockedAtIso !== null,
      droppedSamples: runtimeTelemetry.totalDroppedSamples,
      audioUnderruns: runtimeTelemetry.audioUnderruns
    });
  }, [
    measurementDisclosure.frequency.state,
    runtimeTelemetry.audioUnderruns,
    runtimeTelemetry.lastFrameSampleIndex,
    runtimeTelemetry.lastFrameSequence,
    runtimeTelemetry.lastFrameTimestampNs,
    runtimeTelemetry.totalDroppedSamples,
    sessionGradeLockedAtIso,
    trustAssessment.grade
  ]);

  const sessionGradeStatusLabel = sessionGradeLockedAtIso !== null
    ? 'locked'
    : sessionGradeLockInvalidatedReason !== null
      ? 'lock-invalidated'
      : sessionGradeEvaluation.eligibleToLock
        ? 'measurement-ready'
        : 'upgrade-needed';

  const lockSessionGrade = () => {
    if (!sessionGradeEvaluation.eligibleToLock) {
      const reason = sessionGradeEvaluation.lockBlockedReason ?? 'Session grade checks are incomplete.';
      setStatusMessage(reason);
      pushDiagnosticEvent(`Session lock blocked: ${reason}`, 'warn');
      return;
    }

    const lockedAtIso = new Date().toISOString();
    setSessionGradeLockedAtIso(lockedAtIso);
    setSessionGradeLockInvalidatedReason(null);
    setStatusMessage('Session locked for reproducible exports.');
    pushDiagnosticEvent(`Session locked at ${lockedAtIso}.`);
  };

  useEffect(() => {
    if (sessionGradeLockedAtIso === null) {
      return;
    }

    const reason = deriveSessionLockInvalidationReason(trustAssessment.grade, trustAssessment.reasons);
    if (reason === null) {
      return;
    }

    setSessionGradeLockedAtIso(null);
    setSessionGradeLockInvalidatedReason(reason);
    setStatusMessage(`Session lock invalidated: ${reason}.`);
    pushDiagnosticEvent(`Session lock invalidated: ${reason}.`, 'warn');
  }, [
    pushDiagnosticEvent,
    sessionGradeLockedAtIso,
    trustAssessment.grade,
    trustAssessment.reasons
  ]);

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1 className="app-title">rad.io MVP Preview</h1>
        <div className={`status-pill status-${connectionState}`} aria-live="polite">
          Connection: {connectionState}
        </div>
      </header>

      {safeModeMarker && (
        <div className="health-item health-warn" role="alert" aria-live="assertive">
          <div>
            <strong>Safe mode active:</strong> last session reported `{safeModeMarker.reason}` at {safeModeMarker.triggeredAtIso}. Minimal defaults are active and auto-connect stays disabled.
          </div>
          {pendingSafeRestoreConfirmation && (
            <div className="control-note" role="alert">
              <strong>{pendingSafeRestoreConfirmation.summary}</strong>
              <ul>
                {pendingSafeRestoreConfirmation.reasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
              <div>
                <button
                  className="action-btn btn-secondary"
                  onClick={() => {
                    restoreFromSafeModeSnapshot(pendingSafeRestoreConfirmation.snapshot);
                    clearSafeModeMarker();
                    setStatusMessage('Risk-confirmed restore applied from safe-mode snapshot.');
                    pushDiagnosticEvent('Safe mode restore confirmed with risk acknowledgment.', 'warn');
                  }}
                >
                  Confirm Risky Restore
                </button>
                <button
                  className="action-btn btn-secondary"
                  onClick={() => {
                    setPendingSafeRestoreConfirmation(null);
                    setStatusMessage('Safe-mode restore canceled. Defaults remain active.');
                    pushDiagnosticEvent('Safe mode restore canceled after risk review.');
                  }}
                >
                  Cancel Restore
                </button>
              </div>
            </div>
          )}
          <div>
            <button
              className="action-btn btn-secondary"
              onClick={() => requestSafeRestoreConfirmation(safeModeMarker.snapshot)}
            >
              Restore Previous Settings
            </button>
            <button
              className="action-btn btn-secondary"
              onClick={() => {
                clearSafeModeMarker();
                setStatusMessage('Safe mode marker dismissed. Current defaults kept.');
                pushDiagnosticEvent('Safe mode marker dismissed by user.');
              }}
            >
              Dismiss Safe Mode
            </button>
          </div>
        </div>
      )}

      <p className="status-text" aria-live="polite">{statusMessage}</p>
      <p className="status-subtext">Audio: {audioState} | Keyboard: Ctrl+K palette, ?/F1 help, Ctrl+L/Alt+L frequency focus, Left/Right tune, Shift+Left/Right large tune, Alt+Left/Right fine nudge, Up/Down fine step, C center peak, S snap signal, T tune marker, X clear marker, R return lock, M mute, P panic mute</p>
      
      <div className="visual-grid">
        <section className="panel panel-wide">
            <h2 className="panel-title">RF Waterfall</h2>
            <WaterfallCanvas
              data={fftData}
              minDb={waterfallMinDb}
              maxDb={waterfallMaxDb}
              zoom={zoomLevel}
              centerFrequencyHz={displayCenterFrequencyHz}
              sampleRateHz={streamSampleRateHz}
              autoScale={waterfallAutoScale}
              palette={waterfallPalette}
              freeze={waterfallFrozen}
              vfoOverlays={vfoOverlayDescriptors}
              onCursorChange={setWaterfallCursorReadout}
            />
        </section>
        <section className="panel">
            <h2 className="panel-title">RF Spectrum (FFT)</h2>
            <SpectrumCanvas
              data={analyzerTrace}
              zoom={zoomLevel}
              onPointClick={handleSpectrumClick}
              centerFrequencyHz={displayCenterFrequencyHz}
              sampleRateHz={streamSampleRateHz}
              tunedOffsetHz={fineFreq}
              referenceLevelDb={analyzerReferenceLevelDb}
              averagingMode={analyzerAveragingMode}
              averagingValue={analyzerAveragingMode === 'linear' ? analyzerLinearAveragingFrames : analyzerAveragingValue}
              windowMode={analyzerWindowMode}
              peakHoldEnabled={analyzerPeakHoldEnabled}
              peakHoldMode={analyzerPeakHoldMode}
              peakHoldResetToken={analyzerPeakHoldResetToken}
              markerFrequencyHz={analyzerMarker?.frequencyHz ?? null}
            />
        </section>
        <section className="panel">
            <h2 className="panel-title">Demod Audio (Scope)</h2>
            <AudioScopeCanvas samples={scopeData} sampleRateHz={50_000} />
        </section>
        {showIqScopeView && (
          <section className="panel">
            <h2 className="panel-title">I/Q Scope</h2>
            <IqScopeCanvas samples={scopeData} />
          </section>
        )}
        {showConstellationView && (
          <section className="panel">
            <h2 className="panel-title">Constellation</h2>
            <ConstellationCanvas samples={scopeData} />
          </section>
        )}
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
                <option value="AIRSPY">Airspy (Bridge)</option>
                <option value="SDRPLAY">SDRplay RSP (Bridge)</option>
                <option value="PLUTO">PlutoSDR (Bridge)</option>
                <option value="LIMESDR">LimeSDR (Bridge)</option>
            </select>
        </div>

        {/* Connection Control */}
        <Button
          onClick={toggleStream}
          variant={isRunning ? 'stop' : 'start'}
        >
          {isRunning ? 'Stop' : 'Start'}
        </Button>

        <Button onClick={toggleMute} variant="secondary">
          {isMuted ? 'Unmute' : 'Mute'}
        </Button>

        <Button onClick={() => panicMute('ui')} variant="stop">
          Panic Mute
        </Button>

        <Button onClick={exportDiagnostics} variant="secondary">
          Export Diagnostics
        </Button>

        <Button onClick={() => void copyShareableSessionLink()} variant="secondary">
          Copy Share Link
        </Button>

        <Button
          onClick={openCommandPalette}
          variant="secondary"
          title="Open command palette (Ctrl+K)"
        >
          Command Palette
        </Button>

        <button
          onClick={() => {
            void applyIqWizardFixes();
          }}
          className="action-btn btn-secondary"
          disabled={iqIntegrityAssessment.status !== 'warn'}
          title="Apply one-click IQ integrity wizard fixes"
        >
          Apply IQ Wizard Fixes
        </button>

        <button
          onClick={saveIqWizardProfile}
          className="action-btn btn-secondary"
          title="Persist current IQ wizard results into the active device profile"
        >
          Save IQ Profile
        </button>

        <button
          onClick={() => {
            void forgetUsbDevices();
          }}
          className="action-btn btn-secondary"
          disabled={isRunning || !runtimePrerequisites.webUsbAvailable}
          title="Forget paired WebUSB devices and require re-pair on next connect"
        >
          Forget USB Pairings
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

        <Button
          onClick={scanState === 'running' ? cancelFmBandScan : runFmBandScan}
          variant="secondary"
          disabled={!isRunning}
        >
          {scanState === 'running' ? 'Stop FM Scan' : 'Run FM Scan'}
        </Button>

        <div className="control-group">
          <label className="control-label">Debug Views</label>
          <label className="control-inline-check">
            <input
              type="checkbox"
              checked={showIqScopeView}
              onChange={(e) => setShowIqScopeView(e.target.checked)}
              className="control-check"
            />
            I/Q Scope
          </label>
          <label className="control-inline-check">
            <input
              type="checkbox"
              checked={showConstellationView}
              onChange={(e) => setShowConstellationView(e.target.checked)}
              className="control-check"
            />
            Constellation
          </label>
        </div>

        <div className="control-group">
          <label className="control-label">Latency Policy</label>
          <select
            value={latencyPolicy}
            onChange={(e) => setLatencyPolicy(e.target.value as LatencyPolicy)}
            className="control-input compact"
          >
            <option value="low-latency">Low Latency (60 ms queue target)</option>
            <option value="stable">Stable (120 ms queue target)</option>
          </select>
        </div>

        <div className="control-group">
          <label className="control-label">USB Streaming Profile</label>
          <select
            value={usbStreamingProfile}
            onChange={(e) => {
              const profile = e.target.value as UsbStreamingProfileName;
              void applyUsbStreamingProfile(profile);
            }}
            className="control-input compact"
            disabled={sourceType !== 'HACKRF'}
          >
            <option value="low-latency">Low Latency</option>
            <option value="balanced">Balanced</option>
            <option value="stable">Stable</option>
          </select>
          <div className="control-note">Scheduling recommendation: {deviceDebugSnapshot?.streamingProfile?.scheduleRecommendation ?? 'n/a'}</div>
        </div>

        <div className="control-group">
          <label className="control-label">Adaptive Streaming Policy</label>
          <input
            type="checkbox"
            checked={adaptiveStreamingEnabled}
            onChange={(e) => setAdaptiveStreamingEnabled(e.target.checked)}
            className="control-check"
            disabled={sourceType !== 'HACKRF'}
          />
        </div>

        <button
          onClick={() => {
            void runUsbStreamingAutoTuner();
          }}
          className="action-btn btn-secondary"
          disabled={sourceType !== 'HACKRF' || !isRunning || usbAutoTuneRunning}
          title="Run measured USB profile auto-tuner"
        >
          {usbAutoTuneRunning ? 'USB Auto-Tuning...' : 'Run USB Auto-Tuner'}
        </button>

        <button
          onClick={() => {
            void runHardwareSanitySelfTestFlow();
          }}
          className="action-btn btn-secondary"
          disabled={!isRunning || !isWebUsbSource(sourceType)}
          title="Run hardware bring-up sanity checks for active WebUSB device"
        >
          Run Hardware Self-Test
        </button>

        <div className="control-group">
          <label className="control-label">Clock Sync Policy</label>
          <select
            value={clockSyncPolicy}
            onChange={(e) => setClockSyncPolicy(e.target.value as ClockSyncPolicy)}
            className="control-input compact"
          >
            <option value="audio-stable">Audio-stable (jitter tolerant)</option>
            <option value="rf-accurate">RF-accurate (faster correction)</option>
          </select>
          <div className="control-note">{describeClockSyncPolicy(clockSyncPolicy)}</div>
        </div>

        <div className="control-group">
          <label className="control-label">Scan Progress</label>
          <div className="control-note">
            {scanStepLabel} ({Math.round(scanProgress * 100)}%)
          </div>
          <div className="control-note">
            Planned rate {(streamRatePlan.sampleRateHz / 1_000).toFixed(0)} kHz | Decim {streamRatePlan.decimationFactor} | Audio {(streamRatePlan.outputSampleRateHz / 1_000).toFixed(1)} kHz
          </div>
        </div>

        <div className="control-group">
          <label className="control-label">Scan Dwell ({scanDwellMs} ms)</label>
          <input
            type="range"
            min="0"
            max="3000"
            step="100"
            value={scanDwellMs}
            onChange={(e) => setScanDwellMs(parseInt(e.target.value, 10))}
            className="control-range"
          />
        </div>

        <div className="control-group">
          <label className="control-label">Audio Output Device</label>
          <select
            value={audioOutputDeviceId}
            onChange={(e) => setAudioOutputDeviceId(e.target.value)}
            className="control-input compact"
            disabled={!audioOutputSelectionSupported}
          >
            {audioOutputDevices.map((device) => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.label}
              </option>
            ))}
          </select>
          <div className="control-note">
            {audioOutputSelectionSupported
              ? `Active output: ${selectedAudioOutputLabel}`
              : 'Browser does not support output-device selection; using system default.'}
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
          <label className="control-label">IQ Integrity Wizard</label>
          <div className="control-note">{iqIntegrityAssessment.summary}</div>
          {iqIntegrityAssessment.findings.length > 0 && (
            <div className="control-note">Findings: {iqIntegrityAssessment.findings.join(', ')}</div>
          )}
        </div>

        {hardwareSelfTestReport && (
          <div className="control-group">
            <label className="control-label">Hardware Self-Test</label>
            <div className="control-note">{hardwareSelfTestReport.summary}</div>
            <div className="control-note">
              {hardwareSelfTestReport.checks
                .map((check) => `${check.key}:${check.passed ? 'pass' : 'fail'}`)
                .join(' | ')}
            </div>
          </div>
        )}

        <div className="control-group">
          <Slider
            label={`Zoom (${zoomLevel}x)`}
            min={1}
            max={8}
            step={1}
            value={zoomLevel}
            onChange={(value) => setZoomLevel(Math.round(value))}
          />
        </div>

        <div className="control-group">
          <Slider
            label={`Reference Level (${analyzerReferenceLevelDb.toFixed(1)} dBFS)`}
            min={-80}
            max={0}
            step={1}
            value={analyzerReferenceLevelDb}
            onChange={setAnalyzerReferenceLevelDb}
          />
        </div>

        <div className="control-group">
          <label className="control-label">FFT Window</label>
          <select
            value={analyzerWindowMode}
            onChange={(e) => setAnalyzerWindowMode(e.target.value as AnalyzerWindowMode)}
            className="control-input compact"
          >
            <option value="rectangular">Rectangular</option>
            <option value="hann">Hann</option>
            <option value="blackman-harris">Blackman-Harris</option>
          </select>
          <div className="control-note">ENBW: {getWindowEnbwBins(analyzerWindowMode).toFixed(2)} bins</div>
          <div className="control-note">RBW: {(analyzerSemantics.rbwHz / 1000).toFixed(2)} kHz | VBW: {(analyzerSemantics.vbwHz / 1000).toFixed(2)} kHz</div>
        </div>

        <div className="control-group">
          <label className="control-label">Detector</label>
          <select
            value={analyzerDetectorMode}
            onChange={(e) => setAnalyzerDetectorMode(e.target.value as AnalyzerDetectorMode)}
            className="control-input compact"
          >
            <option value="sample">Sample</option>
            <option value="peak">Peak</option>
            <option value="rms">RMS</option>
            <option value="avg">Average</option>
            <option value="min-hold">Min Hold</option>
            <option value="p95">Percentile P95</option>
          </select>
        </div>

        <div className="control-group">
          <Slider
            label={`VBW Frames (${analyzerVbwFrames})`}
            min={1}
            max={32}
            step={1}
            value={analyzerVbwFrames}
            onChange={(value) => setAnalyzerVbwFrames(Math.round(value))}
          />
        </div>

        <div className="control-group">
          <label className="control-label">Trace Math</label>
          <select
            value={analyzerTraceMathMode}
            onChange={(e) => setAnalyzerTraceMathMode(e.target.value as AnalyzerTraceMathMode)}
            className="control-input compact"
          >
            <option value="a">Trace A</option>
            <option value="a-minus-b">A-B</option>
            <option value="max-a-b">Max(A,B)</option>
          </select>
          <Button variant="secondary" onClick={captureTraceB}>Capture Trace B</Button>
          <Button variant="secondary" onClick={clearTraceB} disabled={!traceB}>Clear Trace B</Button>
        </div>

        <div className="control-group">
          <label className="control-label">Averaging Mode</label>
          <select
            value={analyzerAveragingMode}
            onChange={(e) => setAnalyzerAveragingMode(e.target.value as AnalyzerAveragingMode)}
            className="control-input compact"
          >
            <option value="off">Off</option>
            <option value="exp">Exponential</option>
            <option value="linear">Linear</option>
          </select>
        </div>

        {analyzerAveragingMode === 'exp' && (
          <div className="control-group">
            <Slider
              label={`Exp Averaging (${Math.round(analyzerAveragingValue * 100)}%)`}
              min={0.05}
              max={0.95}
              step={0.01}
              value={analyzerAveragingValue}
              onChange={setAnalyzerAveragingValue}
            />
          </div>
        )}

        {analyzerAveragingMode === 'linear' && (
          <div className="control-group">
            <Slider
              label={`Linear Frames (${analyzerLinearAveragingFrames})`}
              min={2}
              max={32}
              step={1}
              value={analyzerLinearAveragingFrames}
              onChange={(value) => setAnalyzerLinearAveragingFrames(Math.round(value))}
            />
          </div>
        )}

        <div className="control-group">
          <label className="control-label">Peak Hold</label>
          <input
            type="checkbox"
            checked={analyzerPeakHoldEnabled}
            onChange={(e) => setAnalyzerPeakHoldEnabled(e.target.checked)}
            className="control-check"
          />
          <select
            value={analyzerPeakHoldMode}
            onChange={(e) => setAnalyzerPeakHoldMode(e.target.value as AnalyzerPeakHoldMode)}
            className="control-input compact"
            disabled={!analyzerPeakHoldEnabled}
          >
            <option value="decay">Decay Hold</option>
            <option value="max">Max Hold</option>
          </select>
          <Button
            onClick={() => setAnalyzerPeakHoldResetToken((prev) => prev + 1)}
            variant="secondary"
          >
            Reset Peak Hold
          </Button>
        </div>

        <Card className="control-group control-group-wide" title="Signal Discovery">
          <Button variant="secondary" onClick={() => runCenterOnPeak('ui')}>Center On Peak</Button>
          <Button variant="secondary" onClick={() => runSnapToSignal('ui')}>Snap To Signal</Button>
          <Button variant="secondary" onClick={() => returnToLastLock('ui')} disabled={lastLockFrequencyHz === null}>Return To Last Lock</Button>
          <Button variant="secondary" onClick={quickCaptureMarkerOrVfo}>Quick Capture Marker/VFO</Button>
          <Button variant="secondary" onClick={exportAnalyzerSnapshot}>Export Analyzer Snapshot</Button>
          <div className="control-note">
            {occupiedBandwidth
              ? `OBW ${(occupiedBandwidth.percentPower * 100).toFixed(0)}%: ${(occupiedBandwidth.bandwidthHz / 1000).toFixed(1)} kHz`
              : 'OBW unavailable'}
          </div>
          <div className="control-note">
            Noise floor {candidateSignalStats.noiseFloorDbfs.toFixed(1)} dBFS | Peak SNR {candidateSignalStats.strongestPeakSnrDb.toFixed(1)} dB | Occupancy {(candidateSignalStats.occupancy01 * 100).toFixed(1)}% | Persistence {(candidateSignalStats.persistence01 * 100).toFixed(1)}%
          </div>
          {strongestPeaks.length > 0 && (
            <div className="control-note">
              Peaks: {strongestPeaks.map((peak, index) => {
                const peakHz = Math.round(binIndexToFrequencyHz(peak.binIndex, analyzerTrace.length, displayCenterFrequencyHz, streamSampleRateHz));
                return `#${index + 1} ${peakHz.toLocaleString()} Hz (${peak.powerDbfs.toFixed(1)} dBFS)`;
              }).join(' | ')}
            </div>
          )}
          {signalWarnings.length > 0 && (
            <div className="control-note">
              {signalWarnings.map((warning) => (
                <span key={warning.id} style={{ display: 'block', marginTop: 4 }}>
                  [{warning.severity}] {warning.summary}: {warning.why}
                  {warning.mitigation !== 'none' && (
                    <button
                      className="action-btn btn-secondary"
                      onClick={() => applySignalWarningMitigation(warning.id)}
                      style={{ marginLeft: 8 }}
                    >
                      Apply {warning.mitigation}
                    </button>
                  )}
                </span>
              ))}
            </div>
          )}
        </Card>

        <Card className="control-group control-group-wide" title="Marker">
          <Button variant="secondary" onClick={() => placeMarkerAtPeak('ui')}>Place Marker At Peak</Button>
          <Button variant="secondary" onClick={() => placeSecondaryMarkerAtPeak('ui')}>Place Marker B At Peak</Button>
          <Button variant="secondary" onClick={() => tuneToMarker('ui')} disabled={!analyzerMarker}>Tune To Marker</Button>
          <Button variant="secondary" onClick={() => clearMarker('ui')} disabled={!analyzerMarker}>Clear Marker</Button>
          <Button variant="secondary" onClick={() => clearSecondaryMarker('ui')} disabled={!analyzerSecondaryMarker}>Clear Marker B</Button>
          <div className="control-note">
            {markerReadout
              ? `${Math.round(markerReadout.frequencyHz).toLocaleString()} Hz | ${markerReadout.powerDbfs.toFixed(1)} dBFS${markerReadout.inView ? '' : ' (outside visible span)'}`
              : 'No active marker A'}
          </div>
          <div className="control-note">
            {secondaryMarkerReadout
              ? `${Math.round(secondaryMarkerReadout.frequencyHz).toLocaleString()} Hz | ${secondaryMarkerReadout.powerDbfs.toFixed(1)} dBFS${secondaryMarkerReadout.inView ? '' : ' (outside visible span)'} (Marker B)`
              : 'No active marker B'}
          </div>
          {markerDeltaReadout && (
            <div className="control-note">
              Delta A to B: {markerDeltaReadout.deltaFrequencyHz.toLocaleString(undefined, { maximumFractionDigits: 0 })} Hz | {markerDeltaReadout.deltaPowerDb.toFixed(1)} dB
            </div>
          )}
        </Card>

        <Card className="control-group control-group-wide" title="Marker ↔ VFO Binding">
          <div className="control-group">
            <label className="control-label">Active VFO</label>
            <select
              value={activeVfoId}
              onChange={(e) => setActiveVfoId(e.target.value as VfoBindingId)}
              className="control-input compact"
            >
              <option value="main">Main VFO</option>
              <option value="aux" disabled={!secondaryVfoEnabled}>Aux VFO</option>
            </select>
          </div>
          <Button variant="secondary" onClick={() => bindMarkerToActiveVfo(false)}>
            Bind Marker To Active VFO
          </Button>
          <label className="control-inline-check">
            <input
              type="checkbox"
              checked={markerBindingState.followVfo}
              onChange={(e) => {
                const follow = e.target.checked;
                setMarkerBindingState((prev) => ({
                  ...prev,
                  enabled: prev.enabled || follow,
                  boundVfoId: activeVfoId,
                  followVfo: follow
                }));
                if (follow) {
                  bindMarkerToActiveVfo(true);
                }
              }}
              className="control-check"
            />
            Follow Active VFO
          </label>
          <Button variant="secondary" onClick={tuneActiveVfoToMarker} disabled={!analyzerMarker}>
            Tune Active VFO To Marker
          </Button>
          <div className="control-note">
            Main: {Math.round(tunedDisplayFrequencyHz).toLocaleString()} Hz
            {secondaryVfoEnabled ? ` | Aux: ${Math.round(tunedDisplayFrequencyHz + secondaryVfoOffsetHz).toLocaleString()} Hz` : ''}
          </div>
          <div className="control-note">
            Binding: {markerBindingState.enabled ? `${markerBindingState.boundVfoId.toUpperCase()}${markerBindingState.followVfo ? ' (follow)' : ''}` : 'off'}
            {' | '}Active VFO: {activeVfoId.toUpperCase()} @ {Math.round(activeVfoDisplayFrequencyHz).toLocaleString()} Hz
          </div>
        </Card>

        <Card className="control-group control-group-wide" title="VFO Management">
          <div className="control-group" style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <label className="control-inline-check">
              <input
                type="checkbox"
                checked={secondaryVfoEnabled}
                onChange={(e) => setSecondaryVfoEnabled(e.target.checked)}
                className="control-check"
              />
              Enable AUX VFO
            </label>
            <label className="control-label">AUX Offset</label>
            <input
              type="number"
              className="control-input compact"
              value={Math.round(secondaryVfoOffsetHz)}
              onChange={(e) => setSecondaryVfoOffsetHz(Number(e.target.value) || 0)}
              min={-150000}
              max={150000}
              step={250}
              disabled={!secondaryVfoEnabled}
              aria-label="Auxiliary VFO offset in Hertz"
            />
          </div>

          <div className="control-group" style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <label className="control-label">Audio Route</label>
            <select
              value={effectiveVfoAudioRoute}
              onChange={(e) => setVfoAudioRoute(e.target.value as VfoAudioRoute)}
              className="control-input compact"
            >
              <option value="main">Main (Solo)</option>
              <option value="aux" disabled={!secondaryVfoEnabled}>Aux (Solo)</option>
              <option value="mix" disabled={!secondaryVfoEnabled}>Main + Aux Mix</option>
              <option value="mute">Muted</option>
            </select>
            <Button variant="secondary" onClick={() => applyVfoResourceAction('route-main')}>Solo Main</Button>
            <Button variant="secondary" onClick={() => applyVfoResourceAction('route-aux')} disabled={!secondaryVfoEnabled}>Solo Aux</Button>
            <Button variant="secondary" onClick={() => applyVfoResourceAction('route-mix')} disabled={!secondaryVfoEnabled}>Mix</Button>
            <Button variant="secondary" onClick={() => applyVfoResourceAction('mute')}>Mute VFO Audio</Button>
          </div>

          <div className={`control-note ${vfoResourceBudget.severity === 'critical' ? 'health-error' : vfoResourceBudget.severity === 'warn' ? 'health-warn' : 'health-ok'}`}>
            {vfoResourceBudget.headline} {vfoResourceBudget.details.join(' | ')}
          </div>
          {vfoResourceBudget.suggestedActions.length > 0 && (
            <div className="control-group" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {vfoResourceBudget.suggestedActions.map((action) => (
                <Button key={action} variant="secondary" onClick={() => applyVfoResourceAction(action)}>
                  {action === 'route-main' && 'Apply Main Solo'}
                  {action === 'route-aux' && 'Apply Aux Solo'}
                  {action === 'route-mix' && 'Apply Mix Route'}
                  {action === 'mute' && 'Mute VFO Audio'}
                  {action === 'disable-aux' && 'Disable AUX VFO'}
                </Button>
              ))}
            </div>
          )}

          <div className="control-group" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              type="text"
              value={vfoPresetNameDraft}
              onChange={(e) => setVfoPresetNameDraft(e.target.value)}
              placeholder="Preset name"
              className="control-input compact"
              aria-label="VFO preset name"
            />
            <Button variant="secondary" onClick={saveCurrentVfoPreset}>Save Preset</Button>
          </div>
          <div className="control-note">Saved presets: {vfoPresets.length}</div>
          {vfoPresets.slice(0, 8).map((preset) => (
            <div key={preset.id} className="control-note" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <span>
                {preset.name} | {preset.secondaryVfoEnabled ? `AUX ${preset.secondaryVfoOffsetHz.toLocaleString()} Hz` : 'Main only'} | route {preset.audioRoute}
              </span>
              <Button variant="secondary" onClick={() => applyVfoPreset(preset)}>Apply</Button>
              <Button variant="secondary" onClick={() => deleteVfoPreset(preset.id)}>Delete</Button>
            </div>
          ))}
          <div className="control-note">
            Runtime: {vfoState.activeVfoCount} VFO(s)
            {vfoState.vfos.length > 0 ? ` | ${vfoState.vfos.map((vfo) => `${vfo.id.toUpperCase()} ${vfo.strategy} ${vfo.cpuMs.toFixed(2)}ms q${vfo.quality01.toFixed(2)}`).join(' | ')}` : ''}
          </div>
        </Card>

        <Card className="control-group control-group-wide" title="Marker Table (Pro)">
          <div className="control-group">
            <label className="control-label">Sort</label>
            <select
              value={markerTableSortMode}
              onChange={(e) => setMarkerTableSortMode(e.target.value as MarkerTableSortMode)}
              className="control-input compact"
            >
              <option value="power">Power</option>
              <option value="snr">SNR</option>
              <option value="frequency">Frequency</option>
            </select>
          </div>
          <div className="control-group">
            <Slider
              label={`Min SNR (${markerTableSnrMinDb.toFixed(0)} dB)`}
              min={0}
              max={40}
              step={1}
              value={markerTableSnrMinDb}
              onChange={setMarkerTableSnrMinDb}
            />
          </div>
          <div className="control-note">{markerTableRows.length} candidate markers</div>
          {markerTableRows.slice(0, 8).map((row) => (
            <div key={`${row.frequencyHz}-${row.powerDbfs}`} className="control-note" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <span>{row.frequencyHz.toLocaleString()} Hz | {row.powerDbfs.toFixed(1)} dBFS | SNR {row.snrDb.toFixed(1)} dB{row.boundVfoId ? ` | ${row.boundVfoId.toUpperCase()} bound` : ''}</span>
              <Button variant="secondary" onClick={() => tuneToMarkerTableFrequency(row.frequencyHz)}>Tune</Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setAnalyzerMarker({
                    frequencyHz: row.frequencyHz,
                    placedAtIso: new Date().toISOString()
                  });
                  setStatusMessage(`Marker A set from marker table at ${row.frequencyHz.toLocaleString()} Hz.`);
                }}
              >
                Set Marker A
              </Button>
            </div>
          ))}
        </Card>

        <Card className="control-group control-group-wide" title="Sweep / Stitch Analyzer">
          <Button variant="secondary" onClick={() => void runSweepStitch()} disabled={!sweepExecutionPlan.canRun || sweepState === 'running'}>
            {sweepState === 'running' ? 'Sweeping...' : sweepExecutionPlan.buttonLabel}
          </Button>
          <div className="control-note">{sweepExecutionPlan.status}</div>
          <div className="control-note">{sweepStatus}</div>
          <div className="control-note">Stitched points: {sweepStitchedPoints.length}</div>
          {sourceType === 'HACKRF' && (
            <div className="control-note">
              Host bridge: {sweepHostBridgeProbe.available
                ? `available (${sweepHostBridgeProbe.providerLabel ?? 'unnamed provider'})`
                : `unavailable${sweepHostBridgeProbe.reason ? ` (${sweepHostBridgeProbe.reason})` : ''}`}
            </div>
          )}
          {sweepRunEvidence && (
            <div className="control-note">
              Last run: {sweepRunEvidence.executor} | points {sweepRunEvidence.stitchedPointCount} | completed {sweepRunEvidence.completedAtIso}
            </div>
          )}
          {sweepExecutionPlan.blockers.length > 0 && (
            <div className="control-note">
              Blockers: {sweepExecutionPlan.blockers.join(' | ')}
            </div>
          )}
        </Card>

        <Card className="control-group control-group-wide" title="Spur / Artifact Layer">
          <Button variant="secondary" onClick={addSpurAnnotationFromMarker} disabled={!markerReadout}>Add Annotation From Marker A</Button>
          <label className="control-inline-check">
            <input
              type="checkbox"
              checked={artifactMaskEnabled}
              onChange={(e) => setArtifactMaskEnabled(e.target.checked)}
              className="control-check"
            />
            Mask annotated spur bins in marker table
          </label>
          {spurAnnotations.length === 0 && <div className="control-note">No artifact annotations yet.</div>}
          {spurAnnotations.map((annotation) => (
            <div key={annotation.id} className="control-note" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <span>{annotation.frequencyHz.toLocaleString()} Hz | {annotation.kind} | {annotation.label}</span>
              <label className="control-inline-check">
                <input
                  type="checkbox"
                  checked={annotation.masked}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setSpurAnnotations((prev) => prev.map((entry) => {
                      if (entry.id !== annotation.id) {
                        return entry;
                      }
                      return {
                        ...entry,
                        masked: checked
                      };
                    }));
                  }}
                  className="control-check"
                />
                Mask
              </label>
              <Button
                variant="secondary"
                onClick={() => {
                  setSpurAnnotations((prev) => prev.filter((entry) => entry.id !== annotation.id));
                }}
              >
                Remove
              </Button>
            </div>
          ))}
        </Card>

        <Card className="control-group control-group-wide" title="Band Plans & Stepping">
          <div className="control-group">
            <label className="control-label">Region Preset</label>
            <select
              value={bandRegionId}
              onChange={(e) => setBandRegionId(e.target.value as BandRegionId)}
              className="control-input compact"
            >
              {bandRegionPlans.map((plan) => (
                <option key={plan.id} value={plan.id}>{plan.label}</option>
              ))}
            </select>
          </div>
          <div className="control-group">
            <label className="control-label">Band</label>
            <select
              value={selectedBandId}
              onChange={(e) => setSelectedBandId(e.target.value)}
              className="control-input compact"
            >
              {getBandRegionPlan(bandRegionId).bands.map((band) => (
                <option key={band.id} value={band.id}>{band.label}</option>
              ))}
            </select>
          </div>
          <label className="control-inline-check">
            <input
              type="checkbox"
              checked={bandRasterSnapEnabled}
              onChange={(e) => setBandRasterSnapEnabled(e.target.checked)}
              className="control-check"
            />
            Snap To Channel Raster
          </label>
          <label className="control-inline-check">
            <input
              type="checkbox"
              checked={enforceBandLimits}
              onChange={(e) => setEnforceBandLimits(e.target.checked)}
              className="control-check"
            />
            Enforce Band Limits
          </label>
          <label className="control-inline-check">
            <input
              type="checkbox"
              checked={autoApplyBandDefaults}
              onChange={(e) => setAutoApplyBandDefaults(e.target.checked)}
              className="control-check"
            />
            Auto-Apply Band Defaults
          </label>
          <Button
            variant="secondary"
            onClick={() => {
              if (!selectedBand) {
                return;
              }

              const snapped = snapFrequencyToRasterHz(
                clampFrequencyToBandHz(tunedDisplayFrequencyHz, selectedBand),
                selectedBand.rasterHz,
                selectedBand.startHz
              );
              tuneToDisplayFrequency(snapped);
              setStatusMessage(`Snapped to ${Math.round(snapped).toLocaleString()} Hz in ${selectedBand.label}.`);
            }}
            disabled={!selectedBand}
          >
            Snap Now
          </Button>
          <div className="control-note">
            {selectedBand
              ? `${selectedBand.label}: ${(selectedBand.startHz / 1_000_000).toFixed(3)}-${(selectedBand.stopHz / 1_000_000).toFixed(3)} MHz | raster ${selectedBand.rasterHz.toLocaleString()} Hz | default ${selectedBand.defaultMode}`
              : 'No band selected'}
          </div>
          <div className="control-note">
            Active band at tuned frequency: {inferredBandAtTunedFrequency?.label ?? 'outside configured regional bands'}
          </div>
          {bandGuardrailWarning && (
            <div className="control-note" role="alert">
              Warning: {bandGuardrailWarning}
              {!bandGuardrailPromptDismissed && (
                <span style={{ display: 'inline-flex', gap: 8, marginLeft: 8, flexWrap: 'wrap' }}>
                  <Button variant="secondary" onClick={applyBandGuardrailSuggestedDefaults}>Apply Suggested Defaults</Button>
                  <Button variant="secondary" onClick={() => setBandGuardrailPromptDismissed(true)}>Dismiss</Button>
                </span>
              )}
            </div>
          )}
        </Card>

        <Card className="control-group control-group-wide" title="Frequency Mapping / Transverter">
          <label className="control-inline-check">
            <input
              type="checkbox"
              checked={frequencyMapping.transverterEnabled}
              onChange={(e) => setFrequencyMapping((prev) => ({ ...prev, transverterEnabled: e.target.checked }))}
              className="control-check"
            />
            Enable Transverter Offset
          </label>
          <div className="control-group">
            <label className="control-label">Direction</label>
            <select
              value={frequencyMapping.transverterDirection}
              onChange={(e) => setFrequencyMapping((prev) => ({ ...prev, transverterDirection: e.target.value as 'up' | 'down' }))}
              className="control-input compact"
            >
              <option value="up">Upconverter (add LO)</option>
              <option value="down">Downconverter (subtract LO)</option>
            </select>
          </div>
          <div className="control-group">
            <label className="control-label">Transverter LO ({Math.round(frequencyMapping.transverterLoHz).toLocaleString()} Hz)</label>
            <input
              type="range"
              min="1000000"
              max="5000000000"
              step="1000"
              value={frequencyMapping.transverterLoHz}
              onChange={(e) => setFrequencyMapping((prev) => ({ ...prev, transverterLoHz: parseInt(e.target.value, 10) }))}
              className="control-range"
            />
          </div>
          <div className="control-group">
            <label className="control-label">IF Offset ({Math.round(frequencyMapping.ifOffsetHz).toLocaleString()} Hz)</label>
            <input
              type="range"
              min="-25000000"
              max="25000000"
              step="100"
              value={frequencyMapping.ifOffsetHz}
              onChange={(e) => setFrequencyMapping((prev) => ({ ...prev, ifOffsetHz: parseInt(e.target.value, 10) }))}
              className="control-range"
            />
          </div>
          <div className="control-group" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Button
              variant="secondary"
              onClick={() => setFrequencyMapping((prev) => ({
                ...prev,
                ifOffsetHz: Math.max(-25_000_000, Math.min(25_000_000, prev.ifOffsetHz - 12_500))
              }))}
            >
              IF Shift -12.5 kHz
            </Button>
            <Button
              variant="secondary"
              onClick={() => setFrequencyMapping((prev) => ({
                ...prev,
                ifOffsetHz: Math.max(-25_000_000, Math.min(25_000_000, prev.ifOffsetHz + 12_500))
              }))}
            >
              IF Shift +12.5 kHz
            </Button>
            <Button
              variant="secondary"
              onClick={() => setFrequencyMapping((prev) => ({ ...prev, ifOffsetHz: 0 }))}
            >
              Zero IF Shift
            </Button>
          </div>
          <div className="control-note">Use IF shift to move a wanted signal away from center-frequency DC/LO artifacts.</div>
          <div className="control-note">{formatFrequencyModelSummary(tunedTunerFrequencyHz, frequencyMapping)}</div>
        </Card>

        <Card className="control-group control-group-wide" title="History & Recall">
          <Button variant="secondary" onClick={() => setRecallSlotAHz(Math.round(tunedDisplayFrequencyHz))}>Store A</Button>
          <Button variant="secondary" onClick={() => setRecallSlotBHz(Math.round(tunedDisplayFrequencyHz))}>Store B</Button>
          <Button variant="secondary" onClick={() => recallDisplayFrequency('A')} disabled={recallSlotAHz === null}>Recall A</Button>
          <Button variant="secondary" onClick={() => recallDisplayFrequency('B')} disabled={recallSlotBHz === null}>Recall B</Button>
          <Button
            variant="secondary"
            onClick={() => {
              const swapped = swapRecallPair(recallSlotAHz, recallSlotBHz);
              setRecallSlotAHz(swapped.slotAHz);
              setRecallSlotBHz(swapped.slotBHz);
              setStatusMessage('Swapped A/B recall slots.');
            }}
            disabled={recallSlotAHz === null && recallSlotBHz === null}
          >
            Swap A/B
          </Button>
          <div className="control-note">
            A: {recallSlotAHz === null ? 'empty' : `${(recallSlotAHz / 1_000_000).toFixed(3)} MHz`}
            {' | '}B: {recallSlotBHz === null ? 'empty' : `${(recallSlotBHz / 1_000_000).toFixed(3)} MHz`}
          </div>
          <div className="control-note">
            Last tuned: {tuneHistory.length === 0 ? 'none yet' : `${tuneHistory.length} entries`}
          </div>
          {tuneHistory.slice(0, 6).map((entry) => (
            <button
              key={`${entry.tunedAtIso}-${entry.displayFrequencyHz}`}
              className="action-btn btn-secondary"
              onClick={() => {
                tuneToDisplayFrequency(entry.displayFrequencyHz);
                setDemodMode(entry.demodMode as DemodMode);
                setStatusMessage(`Recalled ${(entry.displayFrequencyHz / 1_000_000).toFixed(3)} MHz (${entry.demodMode}).`);
              }}
            >
              {(entry.displayFrequencyHz / 1_000_000).toFixed(3)} MHz ({entry.demodMode})
            </button>
          ))}
          <div className="control-note">
            Last heard: {heardHistory.length === 0 ? 'none yet' : `${heardHistory.length} entries`}
          </div>
          {heardHistory.slice(0, 6).map((entry) => (
            <button
              key={`${entry.heardAtIso}-${entry.displayFrequencyHz}`}
              className="action-btn btn-secondary"
              onClick={() => {
                tuneToDisplayFrequency(entry.displayFrequencyHz);
                setDemodMode(entry.demodMode as DemodMode);
                setStatusMessage(`Recalled heard ${(entry.displayFrequencyHz / 1_000_000).toFixed(3)} MHz (${entry.demodMode}).`);
              }}
            >
              {(entry.displayFrequencyHz / 1_000_000).toFixed(3)} MHz ({entry.demodMode}) SNR {entry.snrEstimateDb.toFixed(1)} dB [{entry.lockState}]
            </button>
          ))}
        </Card>

        {/* Frequency Control */}
        <div className="control-group">
          <label className="control-label">Fine Tune ({fineFreq} Hz)</label>
            <input 
            type="range" min={-maxFineTuneHz} max={maxFineTuneHz} step="1000"
                value={fineFreq}
            onChange={(e) => setFineFreq(clampFineTuneHz(parseInt(e.target.value), filterState.highCutHz, streamSampleRateHz))}
                className="control-range"
            />
          <div className="control-note">Alias-safe fine tune limit: +/-{maxFineTuneHz.toLocaleString()} Hz</div>
        </div>

        <div className="control-group">
          <label className="control-label">Tune Step ({tuningStepHz.toLocaleString()} Hz)</label>
          <select
            value={String(tuningStepHz)}
            onChange={(e) => setTuningStepHz(parseInt(e.target.value, 10))}
            className="control-input compact"
          >
            <option value="50">50 Hz</option>
            <option value="100">100 Hz</option>
            <option value="500">500 Hz</option>
            <option value="1000">1 kHz</option>
            <option value="2500">2.5 kHz</option>
            <option value="5000">5 kHz</option>
            <option value="8333">8.333 kHz</option>
            <option value="10000">10 kHz</option>
            <option value="12500">12.5 kHz</option>
            <option value="25000">25 kHz</option>
            <option value="100000">100 kHz</option>
            <option value="200000">200 kHz</option>
          </select>
        </div>

        <div className="control-group">
          <label className="control-label">Fine Step ({fineTuningStepHz.toLocaleString()} Hz)</label>
          <select
            value={String(fineTuningStepHz)}
            onChange={(e) => setFineTuningStepHz(parseInt(e.target.value, 10))}
            className="control-input compact"
          >
            <option value="50">50 Hz</option>
            <option value="100">100 Hz</option>
            <option value="250">250 Hz</option>
            <option value="500">500 Hz</option>
            <option value="833">833 Hz</option>
            <option value="1000">1 kHz</option>
            <option value="2500">2.5 kHz</option>
            <option value="5000">5 kHz</option>
          </select>
        </div>

        <div className="control-group">
          <label className="control-label">PPM Correction ({ppmCorrection.toFixed(1)} ppm)</label>
          <input
            type="range" min="-100" max="100" step="0.5"
            value={ppmCorrection}
            onChange={(e) => setPpmCorrection(parseFloat(e.target.value))}
            className="control-range"
          />
        </div>

        <Card className="control-group control-group-wide" title="Per-Device Profile">
          <label className="control-inline-check">
            <input
              type="checkbox"
              checked={stabilityProfile?.applyOnConnect?.enabled ?? false}
              onChange={(e) => {
                const existing = getStabilityProfile(activeDeviceProfileKey);
                const next = upsertStabilityProfile({
                  sourceType,
                  profileKey: activeDeviceProfileKey,
                  updatedAtUtc: new Date().toISOString(),
                  driftEstimateHzPerSec: existing?.driftEstimateHzPerSec ?? frequencyModelState.driftEstimateHzPerSec,
                  driftConfidence: existing?.driftConfidence ?? frequencyModelState.driftConfidence,
                  phaseErrorRms: existing?.phaseErrorRms ?? frequencyModelState.phaseErrorRms,
                  ppmCorrectionHz: existing?.ppmCorrectionHz ?? frequencyModelState.ppmCorrectionHz,
                  iqIntegrityLastReport: existing?.iqIntegrityLastReport,
                  calibrationSeed: existing?.calibrationSeed,
                  frequencyCalibration: existing?.frequencyCalibration,
                  applyOnConnect: {
                    enabled: e.target.checked,
                    sampleRateHz: existing?.applyOnConnect?.sampleRateHz ?? streamSampleRateHz,
                    ppmCorrection,
                    gains
                  }
                });
                setStabilityProfile(next);
                setStatusMessage(e.target.checked
                  ? 'Per-device connect profile will apply automatically on stream start.'
                  : 'Per-device connect auto-apply disabled.');
              }}
              className="control-check"
            />
            Apply profile on connect
          </label>
          <Button
            variant="secondary"
            onClick={() => {
              const existing = getStabilityProfile(activeDeviceProfileKey);
              const next = upsertStabilityProfile({
                sourceType,
                profileKey: activeDeviceProfileKey,
                updatedAtUtc: new Date().toISOString(),
                driftEstimateHzPerSec: existing?.driftEstimateHzPerSec ?? frequencyModelState.driftEstimateHzPerSec,
                driftConfidence: existing?.driftConfidence ?? frequencyModelState.driftConfidence,
                phaseErrorRms: existing?.phaseErrorRms ?? frequencyModelState.phaseErrorRms,
                ppmCorrectionHz: existing?.ppmCorrectionHz ?? frequencyModelState.ppmCorrectionHz,
                iqIntegrityLastReport: existing?.iqIntegrityLastReport,
                calibrationSeed: existing?.calibrationSeed,
                frequencyCalibration: existing?.frequencyCalibration,
                applyOnConnect: {
                  enabled: true,
                  sampleRateHz: streamSampleRateHz,
                  ppmCorrection,
                  gains
                }
              });
              setStabilityProfile(next);
              setStatusMessage('Saved current rate/gain/PPM as per-device connect profile.');
              pushDiagnosticEvent(`Per-device connect profile saved for ${activeDeviceProfileKey}.`);
            }}
          >
            Save Current As Connect Profile
          </Button>
          <div className="control-note">
            {stabilityProfile?.applyOnConnect?.enabled
              ? `Auto-apply enabled | ${Math.round(stabilityProfile.applyOnConnect.sampleRateHz ?? streamSampleRateHz).toLocaleString()} S/s | PPM ${(stabilityProfile.applyOnConnect.ppmCorrection ?? ppmCorrection).toFixed(1)}`
              : 'No auto-apply profile enabled for this device identity.'}
          </div>
        </Card>

        <Card className="control-group control-group-wide" title="Frequency Calibration Wizard (Foundation)">
          <div className="control-group">
            <label className="control-label">Known Signal Source</label>
            <select
              value={calibrationWizardSourceId}
              onChange={(e) => setCalibrationWizardSourceId(e.target.value as CalibrationSourceId)}
              className="control-input compact"
            >
              {CALIBRATION_SOURCE_CATALOG.map((entry) => (
                <option key={entry.id} value={entry.id}>{entry.label}</option>
              ))}
            </select>
          </div>
          <div className="control-note">{calibrationWizardAssessment.summary}</div>
          <div className="control-note">
            Confidence {(calibrationWizardAssessment.confidence01 * 100).toFixed(0)}% | Suggested PPM {calibrationWizardAssessment.suggestedPpmCorrection.toFixed(2)}
          </div>
          <div className="control-note">
            Prerequisites: {calibrationWizardAssessment.source.prerequisites.join(' | ')}
          </div>
          {calibrationWizardAssessment.actions.length > 0 && (
            <div className="control-note">Actions: {calibrationWizardAssessment.actions.join(' | ')}</div>
          )}
          {stabilityProfile?.frequencyCalibration && (
            <div className="control-note">
              Last stored calibration: {stabilityProfile.frequencyCalibration.sourceId} | PPM {stabilityProfile.frequencyCalibration.ppmCorrection.toFixed(2)} |
              confidence {(stabilityProfile.frequencyCalibration.confidence01 * 100).toFixed(0)}%
            </div>
          )}
          <Button
            variant="secondary"
            onClick={() => {
              if (!canApplySuggestedPpm(calibrationWizardAssessment)) {
                setStatusMessage('Calibration confidence is not high enough to auto-apply PPM yet.');
                return;
              }

              const nowIso = new Date().toISOString();
              const calibrationResult = buildFrequencyCalibrationResult({
                assessedAtUtc: nowIso,
                assessment: calibrationWizardAssessment,
                driftEstimateHzPerSec: frequencyModelState.driftEstimateHzPerSec,
                observationSeconds: sessionGradeStabilityWindowSeconds
              });
              const existing = getStabilityProfile(activeDeviceProfileKey);
              const next = upsertStabilityProfile({
                sourceType,
                profileKey: activeDeviceProfileKey,
                updatedAtUtc: nowIso,
                driftEstimateHzPerSec: existing?.driftEstimateHzPerSec ?? frequencyModelState.driftEstimateHzPerSec,
                driftConfidence: existing?.driftConfidence ?? frequencyModelState.driftConfidence,
                phaseErrorRms: existing?.phaseErrorRms ?? frequencyModelState.phaseErrorRms,
                ppmCorrectionHz: calibrationResult.ppmCorrection,
                iqIntegrityLastReport: existing?.iqIntegrityLastReport,
                applyOnConnect: existing?.applyOnConnect,
                calibrationSeed: existing?.calibrationSeed,
                frequencyCalibration: calibrationResult
              });

              setPpmCorrection(calibrationResult.ppmCorrection);
              setStabilityProfile(next);
              setStatusMessage(`Applied suggested calibration PPM (${calibrationResult.ppmCorrection.toFixed(2)}).`);
              pushDiagnosticEvent(`Frequency calibration applied and stored for ${activeDeviceProfileKey}.`);
            }}
          >
            Apply Suggested PPM Safely
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              const existing = getStabilityProfile(activeDeviceProfileKey);
              const next = upsertStabilityProfile({
                sourceType,
                profileKey: activeDeviceProfileKey,
                updatedAtUtc: new Date().toISOString(),
                driftEstimateHzPerSec: existing?.driftEstimateHzPerSec ?? frequencyModelState.driftEstimateHzPerSec,
                driftConfidence: existing?.driftConfidence ?? frequencyModelState.driftConfidence,
                phaseErrorRms: existing?.phaseErrorRms ?? frequencyModelState.phaseErrorRms,
                ppmCorrectionHz: existing?.ppmCorrectionHz ?? frequencyModelState.ppmCorrectionHz,
                iqIntegrityLastReport: existing?.iqIntegrityLastReport,
                applyOnConnect: existing?.applyOnConnect,
                frequencyCalibration: existing?.frequencyCalibration,
                calibrationSeed: {
                  updatedAtUtc: new Date().toISOString(),
                  sourceId: calibrationWizardAssessment.source.id,
                  suggestedPpmCorrection: calibrationWizardAssessment.suggestedPpmCorrection,
                  driftEstimateHzPerSec: frequencyModelState.driftEstimateHzPerSec,
                  confidence01: calibrationWizardAssessment.confidence01,
                  notes: calibrationWizardAssessment.actions
                }
              });
              setStabilityProfile(next);
              setStatusMessage('Saved calibration wizard seed to per-device profile.');
              pushDiagnosticEvent(`Calibration wizard seed saved for ${activeDeviceProfileKey}.`);
            }}
          >
            Save Calibration Seed To Device Profile
          </Button>

          <div className="control-group">
            <label className="control-label">Level Reference ({levelCalibrationReferenceDbm.toFixed(1)} dBm)</label>
            <input
              type="range"
              min="-130"
              max="-20"
              step="0.5"
              value={levelCalibrationReferenceDbm}
              onChange={(e) => setLevelCalibrationReferenceDbm(parseFloat(e.target.value))}
              className="control-range"
            />
          </div>
          <div className="control-note">{levelCalibrationAssessment.summary}</div>
          <div className="control-note">
            Band {activeCalibrationBandId.toUpperCase()} | Offset {levelCalibrationAssessment.dbfsToDbmOffset.toFixed(2)} dB | Uncertainty +/-{levelCalibrationAssessment.uncertaintyDb.toFixed(1)} dB
          </div>
          {levelCalibrationAssessment.actions.length > 0 && (
            <div className="control-note">Level actions: {levelCalibrationAssessment.actions.join(' | ')}</div>
          )}
          <Button
            variant="secondary"
            onClick={() => {
              if (levelCalibrationAssessment.readiness !== 'ready') {
                setStatusMessage('Level calibration is not ready yet. Collect more stable evidence first.');
                return;
              }

              upsertAmplitudeCalibration({
                updatedAtUtc: new Date().toISOString(),
                deviceProfileKey: activeDeviceProfileKey,
                bandId: activeCalibrationBandId,
                sourceId: calibrationWizardSourceId,
                centerFrequencyHz: tunedDisplayFrequencyHz,
                sampleRateHz: streamSampleRateHz,
                dbfsToDbmOffset: levelCalibrationAssessment.dbfsToDbmOffset,
                dbfsToDbuvOffset: levelCalibrationAssessment.dbfsToDbuvOffset,
                uncertaintyDb: levelCalibrationAssessment.uncertaintyDb,
                baselineNoiseDbfs: levelCalibrationAssessment.baselineNoiseDbfs,
                gainDbByStage: gains,
                rfChainProfileId: selectedRfChainProfileId || null,
                notes: [
                  `source=${calibrationWizardSourceId}`,
                  `confidence=${levelCalibrationAssessment.confidence01.toFixed(3)}`
                ]
              });
              setCalibrationStoreRevision((prev) => prev + 1);
              setStatusMessage(`Saved ${activeCalibrationBandId.toUpperCase()} amplitude calibration for ${activeDeviceProfileKey}.`);
            }}
          >
            Save Amplitude Calibration For Active Band
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              const nextProfile = upsertBandCalibrationProfile(activeDeviceProfileKey, {
                ...activeBandCalibrationProfile,
                bandId: activeCalibrationBandId,
                preferredSourceId: calibrationWizardSourceId,
                targetUncertaintyDb: levelCalibrationAssessment.uncertaintyDb,
                autoApply: true
              });
              setCalibrationStoreRevision((prev) => prev + 1);
              setStatusMessage(`Saved ${nextProfile.label} calibration profile (target +/-${nextProfile.targetUncertaintyDb.toFixed(1)} dB).`);
            }}
          >
            Save Band Calibration Profile
          </Button>
          {activeAmplitudeCalibration && (
            <div className="control-note">
              Active band calibration: {activeAmplitudeCalibration.bandId.toUpperCase()} | offset {activeAmplitudeCalibration.dbfsToDbmOffset.toFixed(2)} dB | +/-{activeAmplitudeCalibration.uncertaintyDb.toFixed(1)} dB
            </div>
          )}
          <Button
            variant="secondary"
            onClick={() => {
              const bundle = exportCalibrationBundle(activeDeviceProfileKey);
              const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const anchor = document.createElement('a');
              anchor.href = url;
              anchor.download = `rad-io-calibration-${activeDeviceProfileKey.replace(/[^a-zA-Z0-9-_]/g, '_')}.json`;
              anchor.click();
              URL.revokeObjectURL(url);
              setStatusMessage('Exported band calibration profile bundle.');
            }}
          >
            Export Calibration Bundle
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              const entries = buildCatalogEntriesFromAnnotations({
                sampleRateHz: streamSampleRateHz,
                gainSignature: serializeGainProfile(gains),
                annotations: spurAnnotations.map((annotation) => ({
                  frequencyHz: annotation.frequencyHz,
                  label: annotation.label,
                  kind: annotation.kind === 'external'
                    ? 'image'
                    : annotation.kind === 'internal'
                      ? 'spur'
                      : 'lo-leakage'
                }))
              });

              upsertSpurArtifactEntries(activeDeviceProfileKey, entries);
              setSpurCatalogRevision((prev) => prev + 1);
              setStatusMessage(`Saved ${entries.length} spur/LO annotations to the per-device artifact catalog.`);
            }}
            disabled={spurAnnotations.length === 0}
          >
            Save Spur/LO Artifacts To Catalog
          </Button>
        </Card>

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
              <option value="SAM">SAM</option>
              <option value="USB">USB</option>
              <option value="LSB">LSB</option>
              <option value="CW">CW</option>
            </select>
        </div>

        {demodMode === 'NFM' && (
          <>
            <div className="control-group">
              <label className="control-label">NFM De-Emphasis</label>
              <select
                value={nfmAudioPreset}
                onChange={(e) => setNfmAudioPreset(e.target.value as NfmAudioPreset)}
                className="control-input compact"
              >
                <option value="voice-na-75us">Voice NA (75 us)</option>
                <option value="voice-eu-50us">Voice EU (50 us)</option>
                <option value="flat-discriminator">Off / Flat</option>
              </select>
            </div>

            <div className="control-group">
              <label className="control-label">NFM Audio Path</label>
              <select
                value={nfmOutputPath}
                onChange={(e) => setNfmOutputPath(e.target.value as NfmOutputPath)}
                className="control-input compact"
              >
                <option value="voice">Voice</option>
                <option value="discriminator">Discriminator (AFSK/FSK)</option>
              </select>
            </div>

            <div className="control-group">
              <label className="control-label">Tone Decode</label>
              <select
                value={toneDecodeMode}
                onChange={(e) => setToneDecodeMode(e.target.value as ToneDecodeMode)}
                className="control-input compact"
              >
                <option value="OFF">Off</option>
                <option value="CTCSS">CTCSS</option>
                <option value="DCS">DCS (Baseline)</option>
                <option value="AUTO">Auto</option>
              </select>
            </div>
          </>
        )}

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
                  <div className="control-group">
                    <label className="control-label">IQ Correction</label>
                    <input
                      type="checkbox"
                      checked={iqCorrectionEnabled}
                      onChange={(e) => setIqCorrectionEnabled(e.target.checked)}
                      className="control-check"
                    />
                  </div>

                  <div className="control-group">
                    <label className="control-label">Noise Squelch</label>
                    <input
                      type="checkbox"
                      checked={noiseSquelchState.enabled}
                      onChange={(e) => setNoiseSquelchState((prev) => ({ ...prev, enabled: e.target.checked }))}
                      className="control-check"
                    />
                    <div className="control-note">
                      {noiseSquelchState.open ? 'Open' : 'Closed'} | Gate {Math.round(noiseSquelchState.gain * 100)}% | SNR {noiseSquelchState.snrDb.toFixed(1)} dB | Hang {Math.round(noiseSquelchState.hangRemainingMs)} ms
                    </div>
                  </div>

                  <div className="control-group">
                    <label className="control-label">Squelch Threshold ({noiseSquelchState.thresholdDb.toFixed(1)} dB)</label>
                    <input
                      type="range"
                      min="-5"
                      max="25"
                      step="0.5"
                      value={noiseSquelchState.thresholdDb}
                      onChange={(e) => setNoiseSquelchState((prev) => ({ ...prev, thresholdDb: parseFloat(e.target.value) }))}
                      className="control-range"
                    />
                  </div>

                  <div className="control-group">
                    <label className="control-label">Audio Leveler</label>
                    <input
                      type="checkbox"
                      checked={audioLevelerState.enabled}
                      onChange={(e) => setAudioLevelerState((prev) => ({ ...prev, enabled: e.target.checked }))}
                      className="control-check"
                    />
                    <div className="control-note">
                      Gain {audioLevelerState.gainDb.toFixed(1)} dB ({audioLevelerState.gainLinear.toFixed(2)}x)
                    </div>
                  </div>

                  <div className="control-group">
                    <label className="control-label">Audio AGC</label>
                    <input
                      type="checkbox"
                      checked={agcState.enabled}
                      onChange={(e) => setAgcState((prev) => ({ ...prev, enabled: e.target.checked }))}
                      className="control-check"
                    />
                    <div className="control-note">
                      {agcState.state} | Target {agcState.targetLevelDbfs.toFixed(1)} dBFS | Gain {agcState.estimatedGainDb.toFixed(1)} dB
                    </div>
                  </div>

                  <div className="control-group">
                    <label className="control-label">Impulse Blanker</label>
                    <input
                      type="checkbox"
                      checked={impulseBlankerState.enabled}
                      onChange={(e) => setImpulseBlankerState((prev) => ({ ...prev, enabled: e.target.checked }))}
                      className="control-check"
                    />
                    <div className="control-note">
                      Blanked {Math.round(impulseBlankerState.blankingRatio * 100)}% ({impulseBlankerState.blankedSamples} samples)
                    </div>
                  </div>

                  <div className="control-group">
                    <label className="control-label">Carrier Tracking (AFC)</label>
                    <input
                      type="checkbox"
                      checked={afcEnabled}
                      onChange={(e) => setAfcEnabled(e.target.checked)}
                      className="control-check"
                    />
                    <div className="control-note">
                      AFC {frequencyModelState.afcEnabled ? 'enabled' : 'disabled'} | Correction {frequencyModelState.afcCorrectionHz.toFixed(1)} Hz
                    </div>
                  </div>

                  <div className="control-group">
                    <label className="control-label">Stability Characterization</label>
                    <input
                      type="checkbox"
                      checked={stabilityModeEnabled}
                      onChange={(e) => setStabilityModeEnabled(e.target.checked)}
                      className="control-check"
                    />
                    <div className="control-note">
                      Drift {frequencyModelState.driftEstimateHzPerSec.toFixed(2)} Hz/s | Confidence {(frequencyModelState.driftConfidence * 100).toFixed(0)}%
                    </div>
                  </div>

                  <div className="control-group">
                    <label className="control-label">Secondary VFO</label>
                    <input
                      type="checkbox"
                      checked={secondaryVfoEnabled}
                      onChange={(e) => setSecondaryVfoEnabled(e.target.checked)}
                      className="control-check"
                    />
                    <div className="control-note">
                      {secondaryVfoEnabled ? `Offset ${secondaryVfoOffsetHz.toFixed(0)} Hz` : 'Disabled'}
                    </div>
                  </div>

                  {secondaryVfoEnabled && (
                    <div className="control-group">
                      <label className="control-label">Secondary VFO Offset ({secondaryVfoOffsetHz.toFixed(0)} Hz)</label>
                      <input
                        type="range"
                        min="-150000"
                        max="150000"
                        step="250"
                        value={secondaryVfoOffsetHz}
                        onChange={(e) => setSecondaryVfoOffsetHz(parseFloat(e.target.value))}
                        className="control-range"
                      />
                    </div>
                  )}

                  <div className="control-group">
                    <label className="control-label">Squelch Hang ({Math.round(noiseSquelchState.hangMs)} ms)</label>
                    <input
                      type="range"
                      min="0"
                      max="500"
                      step="10"
                      value={noiseSquelchState.hangMs}
                      onChange={(e) => setNoiseSquelchState((prev) => ({ ...prev, hangMs: parseFloat(e.target.value) }))}
                      className="control-range"
                    />
                  </div>

                  <div className="control-group">
                    <label className="control-label">Squelch Tail ({Math.round(noiseSquelchState.tailMs)} ms)</label>
                    <input
                      type="range"
                      min="40"
                      max="500"
                      step="10"
                      value={noiseSquelchState.tailMs}
                      onChange={(e) => setNoiseSquelchState((prev) => ({ ...prev, tailMs: parseFloat(e.target.value) }))}
                      className="control-range"
                    />
                  </div>
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

          {filterState.preset === 'off' && (
            <>
              <div className="control-group">
                <label className="control-label">Notch Frequency ({filterState.notchHz === null ? 'off' : `${Math.round(filterState.notchHz)} Hz`})</label>
                <input
                  type="range"
                  min="0"
                  max="5000"
                  step="50"
                  value={filterState.notchHz ?? 0}
                  onChange={(e) => {
                    const value = parseFloat(e.target.value);
                    setFilterState((prev) => ({
                      ...prev,
                      notchHz: value <= 0 ? null : value
                    }));
                  }}
                  className="control-range"
                />
              </div>

              <div className="control-group">
                <label className="control-label">Notch Q ({filterState.notchQ.toFixed(1)})</label>
                <input
                  type="range"
                  min="2"
                  max="30"
                  step="0.5"
                  value={filterState.notchQ}
                  onChange={(e) => setFilterState((prev) => ({ ...prev, notchQ: parseFloat(e.target.value) }))}
                  className="control-range"
                />
              </div>
            </>
          )}
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
              const clamped = clampFilterForMode(demodMode, filterState.lowCutHz, filterState.lowCutHz + bandwidth, streamSampleRateHz);
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
              const clamped = clampFilterForMode(demodMode, nextLow, filterState.highCutHz, streamSampleRateHz);
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
              const clamped = clampFilterForMode(demodMode, filterState.lowCutHz, nextHigh, streamSampleRateHz);
              setFilterState((prev) => ({ ...prev, ...clamped }));
            }}
            className="control-range"
          />
          <div className="control-note">Alias-safe high cut at current rate: {aliasSafeHighCutHz.toLocaleString()} Hz</div>
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

        <div className="control-group">
          <label className="control-label">Waterfall Freeze</label>
          <input
            type="checkbox"
            checked={waterfallFrozen}
            onChange={(e) => setWaterfallFrozen(e.target.checked)}
            className="control-check"
          />
          <div className="control-note">{waterfallFrozen ? 'Frozen for inspection' : 'Live updating'}</div>
          <div className="control-note">
            {waterfallCursorReadout
              ? `${Math.round(waterfallCursorReadout.frequencyHz).toLocaleString()} Hz | ${waterfallCursorReadout.powerDbfs.toFixed(1)} dB`
              : 'Move cursor over waterfall for readout'}
          </div>
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
            <label htmlFor="frequency-mhz-input" className="control-label">Display Frequency (MHz)</label>
            <input 
                id="frequency-mhz-input"
                ref={frequencyInputRef}
                type="text"
                inputMode="decimal"
              aria-label="Display frequency in MHz"
                value={frequencyInputDraftMhz}
              onFocus={() => setFrequencyInputDraftMhz((tunedDisplayFrequencyHz / 1_000_000).toFixed(3))}
                onChange={(e) => setFrequencyInputDraftMhz(e.target.value)}
                onBlur={cancelFrequencyInputDraft}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    commitFrequencyInputDraft();
                    return;
                  }

                  if (event.key === 'Escape' || event.key === 'Esc') {
                    event.preventDefault();
                    cancelFrequencyInputDraft();
                    frequencyInputRef.current?.blur();
                  }
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
        {gainStages.length > 0 && (
          <Card className="control-group control-group-wide" title="Gain Staging Assistant (Scaffold)">
            <div className="control-note">{gainStagingAssistant.summary}</div>
            <div className="control-note">Band preset: {gainStagingAssistant.presetLabel}</div>
            <div className="control-note">Actions: {gainStagingAssistant.actions.join(' | ')}</div>
            <Button variant="secondary" onClick={applyGainStagingAssistantPreset}>
              Apply Recommended Gain Preset
            </Button>
          </Card>
        )}
      </div>

      {commandPaletteOpen && (
        <section className="health-panel command-palette" aria-live="polite" role="dialog" aria-label="Command palette">
          <h2 className="panel-title">Command Palette</h2>
          <div className="controls-shell">
            <div className="control-group">
              <label className="control-label">Search</label>
              <input
                ref={commandPaletteInputRef}
                type="text"
                value={commandPaletteQuery}
                onChange={(e) => setCommandPaletteQuery(e.target.value)}
                className="control-input"
                placeholder="Type command (e.g. mode, tune, export)"
              />
              <div className="control-note">Ctrl+K open, Esc close, click Run to execute</div>
            </div>
          </div>
          <ul>
            {filteredCommandPaletteActions.length === 0 ? (
              <li className="health-item health-warn">No commands match this query.</li>
            ) : (
              filteredCommandPaletteActions.slice(0, 10).map((action) => (
                <li key={action.id} className="health-item health-ok">
                  <strong>{action.label}</strong>
                  <button
                    onClick={() => runCommandPaletteAction(action)}
                    className="action-btn btn-secondary"
                    type="button"
                  >
                    Run
                  </button>
                </li>
              ))
            )}
          </ul>
        </section>
      )}

      {shortcutsHelpOpen && (
        <section className="health-panel command-palette" aria-live="polite" role="dialog" aria-label="Keyboard shortcuts help">
          <h2 className="panel-title">Keyboard Shortcuts</h2>
          <ul>
            <li className="health-item health-ok"><strong>Tuning</strong><span>ArrowLeft / ArrowRight, Shift+Arrows (large), Alt+Arrows (fine)</span></li>
            <li className="health-item health-ok"><strong>Frequency Input</strong><span>Ctrl+L or Alt+L focus, Enter commit, Escape cancel</span></li>
            <li className="health-item health-ok"><strong>Stream</strong><span>Space toggle, Ctrl+R reconnect, Ctrl+E retry error</span></li>
            <li className="health-item health-ok"><strong>Audio</strong><span>M mute toggle, P panic mute</span></li>
            <li className="health-item health-ok"><strong>Analyzer</strong><span>C center peak, S snap, T tune marker, X clear marker, R return lock</span></li>
            <li className="health-item health-ok"><strong>Diagnostics</strong><span>Ctrl+Shift+D export, Ctrl+/ toggle diagnostics log</span></li>
            <li className="health-item health-ok"><strong>Help and Commands</strong><span>? or F1 help, Ctrl+K command palette</span></li>
          </ul>
          <div className="controls-shell">
            <button onClick={closeShortcutsHelp} className="action-btn btn-secondary" type="button">Close</button>
          </div>
        </section>
      )}

      <section className="health-panel" aria-live="polite">
        <h2 className="panel-title">RF Environment Context</h2>
        <div className="controls-shell">
          <div className="control-group">
            <label className="control-label">Antenna</label>
            <input
              type="text"
              value={rfEnvironmentContext.antennaName}
              onChange={(e) => setRfEnvironmentContext((prev) => ({ ...prev, antennaName: e.target.value }))}
              className="control-input compact"
              placeholder="e.g. VHF whip, discone"
            />
          </div>
          <div className="control-group">
            <label className="control-label">Preamp Note</label>
            <input
              type="text"
              value={rfEnvironmentContext.preampNote}
              onChange={(e) => setRfEnvironmentContext((prev) => ({ ...prev, preampNote: e.target.value }))}
              className="control-input compact"
              placeholder="e.g. +20 dB masthead LNA"
            />
          </div>
          <div className="control-group">
            <label className="control-label">Attenuator Note</label>
            <input
              type="text"
              value={rfEnvironmentContext.attenuatorNote}
              onChange={(e) => setRfEnvironmentContext((prev) => ({ ...prev, attenuatorNote: e.target.value }))}
              className="control-input compact"
              placeholder="e.g. 10 dB inline pad"
            />
          </div>
          <div className="control-group">
            <label className="control-label">Filter Note</label>
            <input
              type="text"
              value={rfEnvironmentContext.filterNote}
              onChange={(e) => setRfEnvironmentContext((prev) => ({ ...prev, filterNote: e.target.value }))}
              className="control-input compact"
              placeholder="e.g. FM broadcast notch"
            />
          </div>
          <div className="control-group">
            <label className="control-label">Bias-Tee Power Safety</label>
            <div className="control-note">
              {activeCapabilityModel?.rfPower.biasTee === 'supported'
                ? 'Arm a timed safety window before enabling antenna power.'
                : 'Active device does not expose bias-tee control in current path.'}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <Button variant="secondary" onClick={armBiasTeeSafetyWindow}>
                {biasTeeArmedUntilMs === null ? 'Arm Bias-Tee Safety' : 'Re-Arm Safety Window'}
              </Button>
              <span className="control-note">
                {biasTeeArmedUntilMs === null
                  ? 'Not armed'
                  : `Armed ${biasTeeSecondsRemaining}s remaining`}
              </span>
            </div>
            <label className="control-label">Auto-Off ({biasTeeAutoOffSeconds}s)</label>
            <input
              type="range"
              min={BIAS_TEE_MIN_AUTO_OFF_SECONDS}
              max={BIAS_TEE_MAX_AUTO_OFF_SECONDS}
              step={5}
              value={biasTeeAutoOffSeconds}
              onChange={(e) => setBiasTeeAutoOffSeconds(parseInt(e.target.value, 10))}
              className="control-range"
            />
            <input
              type="checkbox"
              checked={rfEnvironmentContext.biasTeeEnabled}
              disabled={activeCapabilityModel?.rfPower.biasTee !== 'supported'}
              onChange={(e) => {
                const nextEnabled = e.target.checked;
                if (nextEnabled && biasTeeArmedUntilMs === null) {
                  setStatusMessage('Arm bias-tee safety before enabling antenna power.');
                  return;
                }

                setRfEnvironmentContext((prev) => ({ ...prev, biasTeeEnabled: nextEnabled }));
                void applyRfPowerState({ biasTeeEnabled: nextEnabled });
                if (nextEnabled) {
                  setStatusMessage('Bias-tee enabled inside safety window.');
                } else {
                  setStatusMessage('Bias-tee disabled.');
                }
              }}
              className="control-check"
            />
          </div>
          <div className="control-group">
            <label className="control-label">RF Chain Notes</label>
            <input
              type="text"
              value={rfEnvironmentContext.chainNotes}
              onChange={(e) => setRfEnvironmentContext((prev) => ({ ...prev, chainNotes: e.target.value }))}
              className="control-input compact"
              placeholder="Optional chain/transverter/IF notes"
            />
          </div>
          <div className="control-group">
            <label className="control-label">External IO / GPIO</label>
            <div className="control-note">
              {activeCapabilityModel?.rfPower.gpioControl === 'supported'
                ? 'Toggle external filter/LNA switch lines.'
                : 'GPIO control unavailable on current device path.'}
            </div>
            {Object.keys(gpioOutputs).map((pinName) => (
              <label key={pinName} className="control-inline-check">
                <input
                  type="checkbox"
                  className="control-check"
                  checked={gpioOutputs[pinName]}
                  disabled={activeCapabilityModel?.rfPower.gpioControl !== 'supported'}
                  onChange={(event) => {
                    const next = {
                      ...gpioOutputs,
                      [pinName]: event.target.checked
                    };
                    setGpioOutputs(next);
                    void applyGpioOutputs(next);
                  }}
                />
                {pinName}
              </label>
            ))}
          </div>

          <div className="control-group">
            <label className="control-label">Antenna/Front-End Profiles</label>
            <input
              type="text"
              value={rfContextProfileNameDraft}
              onChange={(e) => setRfContextProfileNameDraft(e.target.value)}
              className="control-input compact"
              placeholder="Profile name"
            />
            <Button
              variant="secondary"
              onClick={() => {
                const id = rfContextProfileNameDraft.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || `context-${Date.now()}`;
                const profile = upsertAntennaFrontEndProfile({
                  id,
                  name: rfContextProfileNameDraft.trim() || 'RF Context',
                  deviceProfileKey: activeDeviceProfileKey,
                  context: rfEnvironmentContext,
                  rfChainProfileId: selectedRfChainProfileId || null,
                  updatedAtUtc: new Date().toISOString()
                });
                const nextProfiles = listAntennaFrontEndProfiles(activeDeviceProfileKey);
                setAntennaContextProfiles(nextProfiles);
                setSelectedAntennaContextProfileId(profile.id);
                setStatusMessage(`Saved antenna/front-end profile: ${profile.name}.`);
              }}
            >
              Save Context Profile
            </Button>
            <select
              value={selectedAntennaContextProfileId}
              onChange={(e) => {
                const nextId = e.target.value;
                setSelectedAntennaContextProfileId(nextId);
                const profile = antennaContextProfiles.find((entry) => entry.id === nextId);
                if (!profile) {
                  return;
                }

                setRfEnvironmentContext(profile.context);
                if (profile.rfChainProfileId) {
                  setSelectedRfChainProfileId(profile.rfChainProfileId);
                }
                setStatusMessage(`Applied context profile: ${profile.name}.`);
              }}
              className="control-input compact"
            >
              <option value="">No saved profile</option>
              {antennaContextProfiles.map((profile) => (
                <option key={profile.id} value={profile.id}>{profile.name}</option>
              ))}
            </select>
          </div>

          <div className="control-group">
            <label className="control-label">RF Chain Profiles (Typed)</label>
            <input
              type="text"
              value={rfChainProfileNameDraft}
              onChange={(e) => setRfChainProfileNameDraft(e.target.value)}
              className="control-input compact"
              placeholder="RF chain profile name"
            />
            <Button
              variant="secondary"
              onClick={() => {
                const profileId = rfChainProfileNameDraft.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || `rf-chain-${Date.now()}`;
                const profile = buildRfChainProfileFromContext({
                  profileId,
                  profileName: rfChainProfileNameDraft.trim() || 'RF Chain',
                  context: rfEnvironmentContext,
                  frequencyMapping,
                  netOffsetDb: 0
                });
                upsertRfChainProfile(activeDeviceProfileKey, profile);
                const nextProfiles = listRfChainProfiles(activeDeviceProfileKey);
                setRfChainProfiles(nextProfiles);
                setSelectedRfChainProfileId(profile.profileId);
                setStatusMessage(`Saved RF chain profile: ${profile.profileName}.`);
              }}
            >
              Save RF Chain Profile
            </Button>
            <select
              value={selectedRfChainProfileId}
              onChange={(e) => {
                const nextId = e.target.value;
                setSelectedRfChainProfileId(nextId);
                const profile = rfChainProfiles.find((entry) => entry.profileId === nextId);
                if (!profile) {
                  return;
                }

                setFrequencyMapping((prev) => applyRfChainProfileToFrequencyMapping(profile, prev));
                setRfEnvironmentContext((prev) => ({
                  ...prev,
                  antennaName: profile.antenna?.descriptor ?? prev.antennaName,
                  chainNotes: profile.antenna?.notes ?? prev.chainNotes,
                  filterNote: profile.filters[0]?.label ?? prev.filterNote,
                  biasTeeEnabled: profile.biasTee.enabled
                }));
                setStatusMessage(`Applied RF chain profile: ${profile.profileName}.`);
              }}
              className="control-input compact"
            >
              <option value="">No saved RF chain</option>
              {rfChainProfiles.map((profile) => (
                <option key={profile.profileId} value={profile.profileId}>{profile.profileName}</option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <details
        className="diagnostics-log"
        open={diagnosticsLogOpen}
        onToggle={(event) => {
          const nextOpen = (event.currentTarget as HTMLDetailsElement).open;
          setDiagnosticsLogOpen(nextOpen);
        }}
      >
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
          <li className="health-item health-ok">
            <strong>Pipeline Timing</strong>
            <span>
              total {runtimeTelemetry.dsp.pipelineTiming.totalMs.toFixed(2)} ms | ddc {runtimeTelemetry.dsp.pipelineTiming.ddcMs.toFixed(2)} | fft {runtimeTelemetry.dsp.pipelineTiming.fftMs.toFixed(2)} | demod {runtimeTelemetry.dsp.pipelineTiming.demodMs.toFixed(2)}
            </span>
          </li>
          <li className={`health-item ${runtimeTelemetry.audioUnderruns > 0 ? 'health-warn' : 'health-ok'}`}>
            <strong>Audio Underruns</strong>
            <span>{runtimeTelemetry.audioUnderruns}</span>
          </li>
          <li className={`health-item ${runtimeTelemetry.audioQueueAheadMs > 250 ? 'health-warn' : 'health-ok'}`}>
            <strong>Audio Queue Ahead</strong>
            <span>{runtimeTelemetry.audioQueueAheadMs.toFixed(1)} ms</span>
          </li>
          <li className={`health-item ${runtimeTelemetry.audioQueueJitterMs > 6 || runtimeTelemetry.audioResamplerRatioDeltaPpm > 120 ? 'health-warn' : 'health-ok'}`}>
            <strong>Audio Clock Drift</strong>
            <span>
              jitter {runtimeTelemetry.audioQueueJitterMs.toFixed(2)} ms | ratio {runtimeTelemetry.audioResamplerRatio.toFixed(6)} | delta {runtimeTelemetry.audioResamplerRatioDeltaPpm.toFixed(1)} ppm
            </span>
          </li>
          <li className={`health-item ${sampleRateMismatchAssessment.severity === 'warn' ? 'health-warn' : 'health-ok'}`}>
            <strong>Sample-Rate Mismatch</strong>
            <span>
              DSP out {streamRatePlan.outputSampleRateHz.toFixed(0)} Hz | est OS {sampleRateMismatchAssessment.estimatedOsOutputRateHz.toFixed(1)} Hz | mismatch {sampleRateMismatchAssessment.mismatchPpm.toFixed(1)} ppm
            </span>
          </li>
          <li className={`health-item ${(bufferTelemetryAssessment.counters.audioIssues + bufferTelemetryAssessment.counters.dspIssues) > 0 ? 'health-warn' : 'health-ok'}`}>
            <strong>Buffer Occupancy</strong>
            <span>
              USB {(bufferTelemetryAssessment.occupancy01.usb * 100).toFixed(0)}% | DSP {(bufferTelemetryAssessment.occupancy01.dsp * 100).toFixed(0)}% | Audio {(bufferTelemetryAssessment.occupancy01.audio * 100).toFixed(0)}% | trend {audioQueueTrend || 'n/a'}
            </span>
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
          <li className={`health-item ${runtimeTelemetry.audioSafetyMuteEvents > 0 ? 'health-warn' : 'health-ok'}`}>
            <strong>Safety Mute Events</strong>
            <span>{runtimeTelemetry.audioSafetyMuteEvents}</span>
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
          <li className={`health-item ${Math.abs(audioPllState.queueErrorMs) > 80 ? 'health-warn' : 'health-ok'}`}>
            <strong>Audio PLL Ratio</strong>
            <span>{audioPllState.ratio.toFixed(5)} (error {audioPllState.queueErrorMs.toFixed(1)} ms)</span>
          </li>
          <li className={`health-item ${trustAssessment.grade === 'degraded' ? 'health-error' : trustAssessment.grade === 'measurement' ? 'health-ok' : 'health-warn'}`}>
            <strong>Session Trust</strong>
            <span>
              {trustAssessment.grade}
              {trustAssessment.reasons.length > 0 ? ` (${trustAssessment.reasons.join(', ')})` : ''}
            </span>
          </li>
          <li className={`health-item ${frequencyModelState.driftConfidence < 0.35 ? 'health-warn' : 'health-ok'}`}>
            <strong>Freq Model</strong>
            <span>
              Drift {frequencyModelState.driftEstimateHzPerSec.toFixed(2)} Hz/s | Total {frequencyModelState.totalCorrectionHz.toFixed(1)} Hz
            </span>
          </li>
          <li className={`health-item ${frontEndClipRisk01 > 0.35 ? 'health-warn' : 'health-ok'}`}>
            <strong>Front-End Health</strong>
            <span>
              clip-risk {(frontEndClipRisk01 * 100).toFixed(0)}% | SNR {demodQuality.snrEstimateDb.toFixed(1)} dB | ENOB {frontEndEnobBits.toFixed(2)} bits
            </span>
          </li>
          <li className={`health-item ${overloadClippingTelemetry.warning ? 'health-warn' : 'health-ok'}`}>
            <strong>Overload/Clipping Telemetry</strong>
            <span>
              IQ peak {overloadClippingTelemetry.iqPeakLinear.toFixed(3)} | audio clip {(overloadClippingTelemetry.audioClippingRatio * 100).toFixed(1)}% | {overloadClippingTelemetry.overrangeLikely ? 'overrange likely' : 'within margin'}
            </span>
          </li>
          {overloadClippingTelemetry.actions.length > 0 && (
            <li className="health-item health-warn">
              <strong>Overload Guidance</strong>
              <span>{overloadClippingTelemetry.actions.join(' | ')}</span>
            </li>
          )}
          <li className={`health-item ${runtimeTelemetry.dsp.rfImpurity.likelyImpure ? 'health-warn' : 'health-ok'}`}>
            <strong>RF Impurity</strong>
            <span>
              DC {runtimeTelemetry.dsp.rfImpurity.dcSpurLevelDbfs.toFixed(1)} dBFS | IRR {runtimeTelemetry.dsp.rfImpurity.imageRejectionDb.toFixed(1)} dB | LO {(runtimeTelemetry.dsp.rfImpurity.loLeakageIndicator01 * 100).toFixed(0)}% | spur {(runtimeTelemetry.dsp.rfImpurity.spurDensity01 * 100).toFixed(1)}%
            </span>
          </li>
          <li className="health-item health-ok">
            <strong>Active VFOs</strong>
            <span>{vfoState.activeVfoCount}</span>
          </li>
          <li className={`health-item ${webUsbContention === 'contended' ? 'health-warn' : 'health-ok'}`}>
            <strong>WebUSB Contention</strong>
            <span>{webUsbContention === 'contended' ? 'another tab active' : 'clear'}</span>
          </li>
          {deviceDebugSnapshot?.descriptor && (
            <>
              <li className="health-item health-ok">
                <strong>USB Interface</strong>
                <span>
                  if {deviceDebugSnapshot.descriptor.interfaceIndex ?? 'n/a'} alt {deviceDebugSnapshot.descriptor.alternateSetting ?? 'n/a'} ep {deviceDebugSnapshot.descriptor.inEndpointNumber ?? 'n/a'}
                </span>
              </li>
              <li className="health-item health-ok">
                <strong>USB Profile</strong>
                <span>
                  {deviceDebugSnapshot.streamingProfile
                    ? `${deviceDebugSnapshot.streamingProfile.transferSizeBytes} B | retry ${deviceDebugSnapshot.streamingProfile.retryDelayMs} ms | max fails ${deviceDebugSnapshot.streamingProfile.maxConsecutiveFailures}`
                    : 'n/a'}
                </span>
              </li>
              <li className={`health-item ${(deviceDebugSnapshot.counters?.bulkInErrorCount ?? 0) > 0 ? 'health-warn' : 'health-ok'}`}>
                <strong>USB Errors</strong>
                <span>
                  bulk err {deviceDebugSnapshot.counters?.bulkInErrorCount ?? 0} | retries {deviceDebugSnapshot.counters?.retryCount ?? 0} | short {deviceDebugSnapshot.counters?.shortPacketCount ?? 0}
                </span>
              </li>
              <li className={`health-item ${(deviceDebugSnapshot.counters?.transferIntervalMsJitter ?? 0) > 4 ? 'health-warn' : 'health-ok'}`}>
                <strong>USB Throughput/Jitter</strong>
                <span>
                  {((deviceDebugSnapshot.counters?.transferRateBps ?? 0) / 1_000_000).toFixed(2)} MB/s | avg {(deviceDebugSnapshot.counters?.transferIntervalMsAvg ?? 0).toFixed(2)} ms | jitter {(deviceDebugSnapshot.counters?.transferIntervalMsJitter ?? 0).toFixed(2)} ms
                </span>
              </li>
              {deviceDebugSnapshot.compatibility && (
                <li className={`health-item ${deviceDebugSnapshot.compatibility.status === 'known-unsupported' ? 'health-error' : deviceDebugSnapshot.compatibility.status === 'unknown' ? 'health-warn' : 'health-ok'}`}>
                  <strong>Firmware Compatibility</strong>
                  <span>
                    board {deviceDebugSnapshot.compatibility.boardId ?? 'n/a'} | fw {deviceDebugSnapshot.compatibility.firmwareVersion ?? 'unknown'} | {deviceDebugSnapshot.compatibility.status}
                    {deviceDebugSnapshot.compatibility.note ? ` (${deviceDebugSnapshot.compatibility.note})` : ''}
                  </span>
                </li>
              )}
              {firmwareRecoveryPlan && (
                <li className={`health-item ${firmwareRecoveryPlan.severity === 'error' ? 'health-error' : firmwareRecoveryPlan.severity === 'warn' ? 'health-warn' : 'health-ok'}`}>
                  <strong>Firmware Recovery Flow</strong>
                  <span>
                    {firmwareRecoveryPlan.headline} {firmwareRecoveryPlan.steps.join(' ')}
                  </span>
                </li>
              )}
            </>
          )}
          <li className={`health-item ${referenceClockVisibility.lockState === 'locked' ? 'health-ok' : referenceClockVisibility.lockState === 'unlocked' ? 'health-warn' : 'health-ok'}`}>
            <strong>Reference Clock</strong>
            <span>
              {referenceClockVisibility.supported ? `${referenceClockVisibility.lockState} (${(referenceClockVisibility.confidence01 * 100).toFixed(0)}%)` : 'not supported'}
            </span>
          </li>
          {referenceClockVisibility.supported && (
            <li className="health-item health-ok">
              <strong>Reference Summary</strong>
              <span>{referenceClockVisibility.summary}</span>
            </li>
          )}
          {referenceClockSupportModel.supported && (
            <li className={`health-item ${referenceLockProof.status === 'pass' ? 'health-ok' : referenceLockProof.status === 'fail' ? 'health-error' : 'health-warn'}`}>
              <strong>Reference Lock Proof</strong>
              <span>{referenceLockProof.summary}</span>
            </li>
          )}
          {spurCatalogMatches.length > 0 && (
            <li className="health-item health-warn">
              <strong>Known Spur Match</strong>
              <span>{spurCatalogMatches.map((entry) => `${entry.kind}:${entry.label}`).join(' | ')}</span>
            </li>
          )}
        </ul>
      </section>

      <section className="health-panel" aria-live="polite">
        <h2 className="panel-title">Session Grade Upgrade</h2>
        <ul>
          <li className={`health-item ${sessionGradeStatusLabel === 'locked' ? 'health-ok' : sessionGradeStatusLabel === 'lock-invalidated' ? 'health-error' : sessionGradeEvaluation.eligibleToLock ? 'health-ok' : 'health-warn'}`}>
            <strong>Status</strong>
            <span>
              {sessionGradeStatusLabel}
              {sessionGradeLockedAtIso === null ? '' : ` (locked ${sessionGradeLockedAtIso})`}
              {sessionGradeLockInvalidatedReason === null ? '' : ` (${sessionGradeLockInvalidatedReason})`}
            </span>
          </li>
          <li className="health-item health-ok">
            <strong>Stability Window</strong>
            <span>
              {sessionGradeStabilityWindowSeconds.toFixed(1)} s / {SESSION_GRADE_MIN_STABILITY_WINDOW_SECONDS.toFixed(0)} s required
            </span>
          </li>
          {sessionGradeEvaluation.checks.map((check) => (
            <li key={check.key} className={`health-item ${check.passed ? 'health-ok' : 'health-warn'}`}>
              <strong>{check.label}</strong>
              <span>{check.detail}</span>
            </li>
          ))}
        </ul>
        <div className="controls-shell">
          <button
            onClick={lockSessionGrade}
            className="action-btn btn-secondary"
            disabled={sessionGradeLockedAtIso !== null || !sessionGradeEvaluation.eligibleToLock}
            title="Lock this session for reproducible diagnostics/exports"
          >
            Lock Session Grade
          </button>
          {sessionGradeEvaluation.lockBlockedReason !== null && sessionGradeLockedAtIso === null && (
            <div className="control-note">{sessionGradeEvaluation.lockBlockedReason}</div>
          )}
        </div>
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
          {demodMode === 'WFM' && (
            <li className={`health-item ${wfmStereoState.locked ? 'health-ok' : 'health-warn'}`}>
              <strong>Stereo</strong>
              <span>
                {wfmStereoState.locked ? 'locked' : 'searching'} | Pilot {(wfmStereoState.pilotLevel * 100).toFixed(0)}% | Sep {wfmStereoState.separationDb.toFixed(1)} dB
              </span>
            </li>
          )}
          {demodMode === 'NFM' && (
            <li className={`health-item ${toneDecodeState.active ? 'health-ok' : 'health-warn'}`}>
              <strong>Tone Decode</strong>
              <span>
                {toneDecodeState.active && toneDecodeState.mode === 'ctcss' && toneDecodeState.ctcssHz !== null
                  ? `CTCSS ${toneDecodeState.ctcssHz.toFixed(1)} Hz (${Math.round(toneDecodeState.confidence * 100)}%)`
                  : toneDecodeState.active && toneDecodeState.mode === 'dcs' && toneDecodeState.dcsDetected
                    ? `DCS ${toneDecodeState.dcsCode === null ? 'present' : toneDecodeState.dcsCode.toString().padStart(3, '0')} (${Math.round(toneDecodeState.confidence * 100)}%)`
                  : 'not detected'}
              </span>
            </li>
          )}
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
          <li className={`health-item ${recordingExportIntegrityPreview.grade === 'degraded' ? 'health-error' : recordingExportIntegrityPreview.grade === 'warning' ? 'health-warn' : 'health-ok'}`}>
            <strong>Export Integrity</strong>
            <span>
              {recordingExportIntegrityPreview.grade}
              {recordingExportIntegrityPreview.warnings.length === 0
                ? ''
                : ` (${recordingExportIntegrityPreview.warnings.length} warning${recordingExportIntegrityPreview.warnings.length === 1 ? '' : 's'})`}
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
                    tuneToDisplayFrequency(result.frequencyHz);
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






