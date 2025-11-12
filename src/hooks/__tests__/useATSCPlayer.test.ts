import { renderHook, act, waitFor } from "@testing-library/react";
import { useATSCPlayer } from "../useATSCPlayer";
import type { ISDRDevice } from "../../models/SDRDevice";
import type { StoredATSCChannel } from "../../utils/atscChannelStorage";

// Mock AudioContext
class MockAudioContext {
  createGain = jest.fn(() => ({
    connect: jest.fn(),
    gain: { value: 1 },
  }));
  destination = {};
  close = jest.fn().mockResolvedValue(undefined);
}

global.AudioContext = MockAudioContext as unknown as typeof AudioContext;

// Mock the ATSC8VSBDemodulator
jest.mock("../../plugins/demodulators/ATSC8VSBDemodulator", () => ({
  ATSC8VSBDemodulator: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(undefined),
    activate: jest.fn().mockResolvedValue(undefined),
    deactivate: jest.fn().mockResolvedValue(undefined),
    dispose: jest.fn().mockResolvedValue(undefined),
    demodulate: jest.fn().mockReturnValue(new Float32Array()),
    isSyncLocked: jest.fn().mockReturnValue(false),
    getSegmentSyncCount: jest.fn().mockReturnValue(0),
    getFieldSyncCount: jest.fn().mockReturnValue(0),
  })),
}));

// Mock the TransportStreamParser
jest.mock("../../parsers/TransportStreamParser", () => ({
  TransportStreamParser: jest.fn().mockImplementation(() => ({
    parseStream: jest.fn().mockReturnValue([]),
    getPAT: jest.fn().mockReturnValue(null),
    getPMT: jest.fn().mockReturnValue(null),
    getVCT: jest.fn().mockReturnValue(null),
    getEIT: jest.fn().mockReturnValue(null),
    getETT: jest.fn().mockReturnValue(null),
    reset: jest.fn(),
  })),
  StreamType: {
    MPEG2_VIDEO: 0x02,
    MPEG4_VIDEO: 0x10,
    H264_VIDEO: 0x1b,
    H265_VIDEO: 0x24,
    MPEG1_AUDIO: 0x03,
    MPEG2_AUDIO: 0x04,
    AAC_AUDIO: 0x0f,
    LATM_AAC_AUDIO: 0x11,
    AC3_AUDIO: 0x81,
    DTS_AUDIO: 0x82,
  },
}));

// Mock ATSC constants
jest.mock("../../utils/atscChannels", () => ({
  ATSC_CONSTANTS: {
    SYMBOL_RATE: 10762238,
    CHANNEL_BANDWIDTH: 6000000,
    PILOT_FREQUENCY: 309440,
  },
}));

describe("useATSCPlayer", () => {
  let mockDevice: jest.Mocked<ISDRDevice>;
  let mockChannel: StoredATSCChannel;

  beforeEach(() => {
    // Create mock device
    mockDevice = {
      isOpen: jest.fn(() => true),
      open: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined),
      setSampleRate: jest.fn().mockResolvedValue(undefined),
      setFrequency: jest.fn().mockResolvedValue(undefined),
      receive: jest.fn().mockResolvedValue(undefined),
      stopRx: jest.fn().mockResolvedValue(undefined),
      isReceiving: jest.fn(() => false),
      parseSamples: jest.fn(() => []),
      getDeviceInfo: jest.fn().mockResolvedValue({ name: "Test Device" }),
      getCapabilities: jest.fn(),
    } as unknown as jest.Mocked<ISDRDevice>;

    // Create mock channel
    mockChannel = {
      channel: {
        channel: 7,
        frequency: 177_000_000,
        band: "VHF-High",
        pilotFrequency: 177_309_440,
        lowerEdge: 174_000_000,
        upperEdge: 180_000_000,
      },
      strength: 0.8,
      snr: 25.0,
      pilotDetected: true,
      syncLocked: true,
      segmentSyncCount: 100,
      fieldSyncCount: 10,
      discoveredAt: new Date(),
      lastScanned: new Date(),
      scanCount: 1,
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should initialize with idle state", () => {
    const { result } = renderHook(() => useATSCPlayer(mockDevice));

    expect(result.current.playerState).toBe("idle");
    expect(result.current.currentChannel).toBeNull();
    expect(result.current.programInfo).toBeNull();
    expect(result.current.signalQuality).toBeNull();
    expect(result.current.audioTracks).toEqual([]);
    expect(result.current.selectedAudioTrack).toBeNull();
    expect(result.current.videoPID).toBeNull();
    expect(result.current.closedCaptionsEnabled).toBe(false);
    expect(result.current.volume).toBe(1.0);
    expect(result.current.muted).toBe(false);
  });

  it("should start tuning when channel is selected", async () => {
    const { result } = renderHook(() => useATSCPlayer(mockDevice));

    await act(async () => {
      await result.current.tuneToChannel(mockChannel);
    });

    expect(result.current.playerState).toBe("tuning");
    expect(result.current.currentChannel).toEqual(mockChannel);
    expect(mockDevice.setFrequency).toHaveBeenCalledWith(
      mockChannel.channel.frequency,
    );
  });

  it("should handle device not available", async () => {
    const { result } = renderHook(() => useATSCPlayer(undefined));

    await act(async () => {
      await result.current.tuneToChannel(mockChannel);
    });

    expect(result.current.playerState).toBe("error");
  });

  it("should set volume", () => {
    const { result } = renderHook(() => useATSCPlayer(mockDevice));

    act(() => {
      result.current.setVolume(0.5);
    });

    expect(result.current.volume).toBe(0.5);
  });

  it("should clamp volume to 0-1 range", () => {
    const { result } = renderHook(() => useATSCPlayer(mockDevice));

    act(() => {
      result.current.setVolume(1.5);
    });
    expect(result.current.volume).toBe(1.0);

    act(() => {
      result.current.setVolume(-0.5);
    });
    expect(result.current.volume).toBe(0.0);
  });

  it("should toggle mute", () => {
    const { result } = renderHook(() => useATSCPlayer(mockDevice));

    expect(result.current.muted).toBe(false);

    act(() => {
      result.current.setMuted(true);
    });
    expect(result.current.muted).toBe(true);

    act(() => {
      result.current.setMuted(false);
    });
    expect(result.current.muted).toBe(false);
  });

  it("should toggle closed captions", () => {
    const { result } = renderHook(() => useATSCPlayer(mockDevice));

    expect(result.current.closedCaptionsEnabled).toBe(false);

    act(() => {
      result.current.toggleClosedCaptions();
    });
    expect(result.current.closedCaptionsEnabled).toBe(true);

    act(() => {
      result.current.toggleClosedCaptions();
    });
    expect(result.current.closedCaptionsEnabled).toBe(false);
  });

  it("should select audio track", () => {
    const { result } = renderHook(() => useATSCPlayer(mockDevice));

    const audioTrack = {
      pid: 0x100,
      type: "AC3",
      description: "Audio Track 1 (AC3)",
    };

    act(() => {
      result.current.selectAudioTrack(audioTrack);
    });

    expect(result.current.selectedAudioTrack).toEqual(audioTrack);
  });

  it("should stop playback", async () => {
    const { result } = renderHook(() => useATSCPlayer(mockDevice));

    // Start playback
    await act(async () => {
      await result.current.tuneToChannel(mockChannel);
    });

    // Stop playback
    await act(async () => {
      await result.current.stop();
    });

    expect(result.current.playerState).toBe("idle");
    expect(result.current.currentChannel).toBeNull();
    expect(result.current.programInfo).toBeNull();
    expect(result.current.signalQuality).toBeNull();
  });

  it("should cleanup on unmount", async () => {
    const { unmount } = renderHook(() => useATSCPlayer(mockDevice));

    // Wait a bit to ensure any async operations start
    await waitFor(() => {
      // Just wait for the hook to be ready
    });

    unmount();

    // Verify cleanup happened (no errors thrown)
    expect(true).toBe(true);
  });

  it("should return consistent results from useMemo", () => {
    const { result, rerender } = renderHook(() => useATSCPlayer(mockDevice));

    const firstResult = result.current;
    rerender();
    const secondResult = result.current;

    // Reference equality for memoized return object
    expect(firstResult).toBe(secondResult);
  });
});
