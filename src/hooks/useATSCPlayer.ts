/**
 * ATSC Player Hook
 *
 * Business logic for playing ATSC broadcasts with channel selection,
 * program information display, and A/V playback using WebCodecs.
 */

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import {
  AtscFECPipeline,
  type AtscBasebandPipeline,
} from "../atsc/baseband/pipeline";
import {
  ATSCVideoDecoder,
  VideoRenderer,
  CEA708Decoder,
  CaptionRenderer,
} from "../decoders";
import { notify } from "../lib/notifications";
import { type ISDRDevice } from "../models/SDRDevice";
import {
  TransportStreamParser,
  type VirtualChannel,
  type Event,
  type ProgramMapTable,
  StreamType,
} from "../parsers/TransportStreamParser";
import { ATSC8VSBDemodulator } from "../plugins/demodulators/ATSC8VSBDemodulator";
import { ATSC_CONSTANTS } from "../utils/atscChannels";
import type { DecodedCaption } from "../decoders";
import type { StoredATSCChannel } from "../utils/atscChannelStorage";

/**
 * Audio track information
 */
export interface AudioTrack {
  pid: number;
  language?: string;
  type: string; // "AC3", "AAC", "MPEG"
  description: string;
}

/**
 * Signal quality metrics
 */
export interface SignalQuality {
  snr: number; // Signal-to-Noise Ratio in dB
  ber: number; // Bit Error Rate
  mer: number; // Modulation Error Ratio in dB
  signalStrength: number; // 0-100 scale
  syncLocked: boolean;
}

/**
 * Program information from PSIP
 */
export interface ProgramInfo {
  title: string;
  description: string;
  startTime?: Date;
  duration?: number; // seconds
  rating?: string;
}

/**
 * Player state
 */
export type PlayerState =
  | "idle"
  | "tuning"
  | "demod-only" // Demodulator producing symbols, FEC/TS pipeline not implemented
  | "playing"
  | "buffering"
  | "error";

/**
 * Hook for ATSC player functionality
 */
export function useATSCPlayer(device: ISDRDevice | undefined): {
  // State
  playerState: PlayerState;
  currentChannel: StoredATSCChannel | null;
  programInfo: ProgramInfo | null;
  signalQuality: SignalQuality | null;
  audioTracks: AudioTrack[];
  selectedAudioTrack: AudioTrack | null;
  videoPID: number | null;
  closedCaptionsEnabled: boolean;
  volume: number;
  muted: boolean;

  // Actions
  tuneToChannel: (channel: StoredATSCChannel) => Promise<void>;
  selectAudioTrack: (track: AudioTrack) => void;
  setVolume: (volume: number) => void;
  setMuted: (muted: boolean) => void;
  toggleClosedCaptions: () => void;
  stop: () => Promise<void>;
} {
  // State
  const [playerState, setPlayerState] = useState<PlayerState>("idle");
  const [currentChannel, setCurrentChannel] =
    useState<StoredATSCChannel | null>(null);
  const [programInfo, setProgramInfo] = useState<ProgramInfo | null>(null);
  const [signalQuality, setSignalQuality] = useState<SignalQuality | null>(
    null,
  );
  const [audioTracks, setAudioTracks] = useState<AudioTrack[]>([]);
  const [selectedAudioTrack, setSelectedAudioTrack] =
    useState<AudioTrack | null>(null);
  const [videoPID, setVideoPID] = useState<number | null>(null);
  const [closedCaptionsEnabled, setClosedCaptionsEnabled] = useState(false);
  const [volume, setVolumeState] = useState(1.0);
  const [muted, setMutedState] = useState(false);

  // Refs
  const demodulatorRef = useRef<ATSC8VSBDemodulator | null>(null);
  const parserRef = useRef<TransportStreamParser | null>(null);
  const basebandPipelineRef = useRef<AtscBasebandPipeline | null>(null);
  const videoDecoderRef = useRef<ATSCVideoDecoder | null>(null);
  const videoRendererRef = useRef<VideoRenderer | null>(null);
  const audioDecoderRef = useRef<AudioDecoder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const captionDecoderRef = useRef<CEA708Decoder | null>(null);
  const captionRendererRef = useRef<CaptionRenderer | null>(null);
  const closedCaptionsEnabledRef = useRef(false);
  const receivePromiseRef = useRef<Promise<void> | null>(null);
  const isPlayingRef = useRef(false);
  const metricsIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );
  const volumeRef = useRef(1.0); // Track current volume for unmute operation

  /**
   * Initialize audio context
   */
  const initializeAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
      gainNodeRef.current = audioContextRef.current.createGain();
      gainNodeRef.current.connect(audioContextRef.current.destination);
      gainNodeRef.current.gain.value = 1.0; // Use default volume, setVolume handles updates
    }
  }, []);

  /**
   * Get stream type description
   */
  const getStreamTypeDescription = useCallback((streamType: number): string => {
    // Using if-else with explicit number casts to avoid enum comparison lint warnings
    const st = streamType;
    const ac3 = StreamType.AC3_AUDIO as number;
    const aac = StreamType.AAC_AUDIO as number;
    const latmAac = StreamType.LATM_AAC_AUDIO as number;
    const mpeg1Audio = StreamType.MPEG1_AUDIO as number;
    const mpeg2Audio = StreamType.MPEG2_AUDIO as number;
    const mpeg2Video = StreamType.MPEG2_VIDEO as number;
    const h264 = StreamType.H264_VIDEO as number;
    const h265 = StreamType.H265_VIDEO as number;

    if (st === ac3) {
      return "AC3";
    } else if (st === aac || st === latmAac) {
      return "AAC";
    } else if (st === mpeg1Audio || st === mpeg2Audio) {
      return "MPEG";
    } else if (st === mpeg2Video) {
      return "MPEG-2";
    } else if (st === h264) {
      return "H.264";
    } else if (st === h265) {
      return "H.265";
    } else {
      return `Unknown (0x${streamType.toString(16)})`;
    }
  }, []);

  /**
   * Initialize video decoder and renderer
   */
  const initializeVideoDecoder = useCallback(
    async (streamType: StreamType, videoPid: number): Promise<void> => {
      // Get canvas element
      const canvas = document.getElementById(
        "atsc-video-canvas",
      ) as HTMLCanvasElement | null;
      if (!canvas) {
        console.error("ATSC Player: Video canvas not found");
        return;
      }

      // Initialize renderer
      videoRendererRef.current ??= new VideoRenderer({
        canvas,
        maintainAspectRatio: true,
        scaleMode: "fit",
      });

      // Initialize decoder
      if (!videoDecoderRef.current) {
        videoDecoderRef.current = new ATSCVideoDecoder(
          (frame: VideoFrame) => {
            // Render frame callback
            if (videoRendererRef.current) {
              videoRendererRef.current.renderFrame(frame);
            } else {
              frame.close();
            }
          },
          (error: Error) => {
            // Error callback
            console.error("ATSC Video Decoder error:", error);
            setPlayerState("error");
          },
        );

        try {
          await videoDecoderRef.current.initialize(streamType);
          // Log successful initialization
          if (process.env["NODE_ENV"] !== "production") {
            // eslint-disable-next-line no-console
            console.log(
              `ATSC Video Decoder initialized for PID ${videoPid} with ${getStreamTypeDescription(streamType)}`,
            );
          }
        } catch (error) {
          console.error("Failed to initialize video decoder:", error);
          videoDecoderRef.current = null;
        }
      }
    },
    [getStreamTypeDescription],
  );

  /**
   * Initialize caption decoder and renderer
   */
  const initializeCaptionDecoder = useCallback((): void => {
    // Find caption container
    const captionContainer = document.getElementById("closed-captions");
    if (!captionContainer) {
      console.warn("ATSC Player: Caption container not found");
      return;
    }

    // Initialize caption renderer
    captionRendererRef.current ??= new CaptionRenderer({
      container: captionContainer,
      config: {
        fontSize: 20,
        edgeStyle: "drop_shadow",
        windowOpacity: 0.8,
      },
    });

    // Initialize caption decoder
    if (!captionDecoderRef.current) {
      captionDecoderRef.current = new CEA708Decoder(
        (caption: DecodedCaption) => {
          // Caption output callback - use ref to get current enabled state
          if (closedCaptionsEnabledRef.current && captionRendererRef.current) {
            captionRendererRef.current.render(caption);
          }
        },
        (error: Error) => {
          // Error callback
          console.error("CEA-708 Decoder error:", error);
        },
      );

      captionDecoderRef.current.initialize({
        preferredService: 1,
        enabled: closedCaptionsEnabledRef.current,
      });
    }
  }, []); // No dependencies needed: decoder/renderer setup uses refs; the nested callback uses closedCaptionsEnabledRef

  /**
   * Extract PTS from PES packet header
   */
  const extractPTSFromPES = useCallback(
    (payload: Uint8Array): number | undefined => {
      // Check for PES start code (0x000001)
      if (
        payload.length < 14 ||
        payload[0] !== 0x00 ||
        payload[1] !== 0x00 ||
        payload[2] !== 0x01
      ) {
        return undefined;
      }

      // Check PTS flag (bit 7 of byte 7)
      const ptsFlag = ((payload[7] ?? 0) & 0x80) !== 0;
      if (!ptsFlag) {
        return undefined;
      }

      // Parse PTS (33-bit value encoded in 5 bytes)
      const pts = Number(
        ((BigInt(payload[9] ?? 0) & 0x0en) << 29n) |
          ((BigInt(payload[10] ?? 0) & 0xffn) << 22n) |
          ((BigInt(payload[11] ?? 0) & 0xfen) << 14n) |
          ((BigInt(payload[12] ?? 0) & 0xffn) << 7n) |
          ((BigInt(payload[13] ?? 0) & 0xfen) >> 1n),
      );

      return pts;
    },
    [],
  );

  /**
   * Parse audio tracks from PMT
   */
  const parseAudioTracks = useCallback(
    (pmt: ProgramMapTable): AudioTrack[] => {
      const tracks: AudioTrack[] = [];
      let trackNumber = 1;

      for (const stream of pmt.streams) {
        // Check if stream is audio (using numeric comparison to avoid enum lint warnings)
        const isAudio =
          stream.streamType === (StreamType.AC3_AUDIO as number) ||
          stream.streamType === (StreamType.AAC_AUDIO as number) ||
          stream.streamType === (StreamType.LATM_AAC_AUDIO as number) ||
          stream.streamType === (StreamType.MPEG1_AUDIO as number) ||
          stream.streamType === (StreamType.MPEG2_AUDIO as number) ||
          stream.streamType === (StreamType.DTS_AUDIO as number);

        if (isAudio) {
          const type = getStreamTypeDescription(stream.streamType);
          // TODO: Parse language descriptor from stream.descriptors
          tracks.push({
            pid: stream.elementaryPid,
            type,
            description: `Audio Track ${trackNumber} (${type})`,
          });
          trackNumber++;
        }
      }

      return tracks;
    },
    [getStreamTypeDescription],
  );

  /**
   * Find video PID from PMT
   */
  const findVideoPID = useCallback((pmt: ProgramMapTable): number | null => {
    for (const stream of pmt.streams) {
      const isVideo =
        stream.streamType === (StreamType.MPEG2_VIDEO as number) ||
        stream.streamType === (StreamType.MPEG4_VIDEO as number) ||
        stream.streamType === (StreamType.H264_VIDEO as number) ||
        stream.streamType === (StreamType.H265_VIDEO as number);

      if (isVideo) {
        return stream.elementaryPid;
      }
    }
    return null;
  }, []);

  /**
   * Parse program information from PSIP tables
   */
  const parseProgramInfo = useCallback(
    (
      vctChannel: VirtualChannel | undefined,
      sourceid: number,
    ): ProgramInfo | null => {
      if (!parserRef.current || !vctChannel) return null;

      const eit = parserRef.current.getEIT(sourceid);
      if (!eit || eit.events.length === 0) {
        return {
          title: vctChannel.shortName,
          description: "",
        };
      }

      // Get current event (find event that is currently airing)
      const now = Date.now();
      const gpsEpoch = new Date("1980-01-06T00:00:00Z").getTime();

      let currentEvent: Event | null = null;
      for (const event of eit.events) {
        const startTimeMs = gpsEpoch + event.startTime * 1000;
        const endTimeMs = startTimeMs + event.lengthInSeconds * 1000;

        if (now >= startTimeMs && now < endTimeMs) {
          currentEvent = event;
          break;
        }
      }

      currentEvent ??= eit.events[0] ?? null;

      if (!currentEvent) {
        return {
          title: vctChannel.shortName,
          description: "",
        };
      }

      // Extract title from multiple string structure
      const title =
        currentEvent.title.length > 0 && currentEvent.title[0]
          ? currentEvent.title[0].segments
              .map((seg) => new TextDecoder().decode(seg.compressedString))
              .join("")
          : vctChannel.shortName;

      // Try to get ETT (Extended Text Table) for description
      const ett = parserRef.current.getETT(currentEvent.eventid);
      const description = ett
        ? ett.extendedTextMessage
            .flatMap((mss) =>
              mss.segments.map((seg) =>
                new TextDecoder().decode(seg.compressedString),
              ),
            )
            .join("")
        : "";

      return {
        title,
        description,
        startTime: new Date(gpsEpoch + currentEvent.startTime * 1000),
        duration: currentEvent.lengthInSeconds,
      };
    },
    [],
  );

  /**
   * Update signal quality metrics
   */
  const updateSignalQuality = useCallback(() => {
    if (!demodulatorRef.current) {
      setSignalQuality(null);
      return;
    }

    const demod = demodulatorRef.current;
    const syncLocked = demod.isSyncLocked();

    // Note: SNR, BER, and MER calculations require additional demodulator instrumentation.
    // These are simulated values based on sync lock status until the demodulator
    // implements methods to calculate actual metrics from received symbols.
    setSignalQuality({
      snr: syncLocked ? 25.0 : 15.0, // dB (simulated - varies with sync)
      ber: syncLocked ? 0.0001 : 0.1, // Bit Error Rate (simulated)
      mer: syncLocked ? 28.0 : 18.0, // dB (simulated - varies with sync)
      signalStrength: syncLocked ? 85 : 50, // 0-100 scale (simulated)
      syncLocked,
    });
  }, []);

  /**
   * Tune to a channel and start playback
   */
  const tuneToChannel = useCallback(
    async (channel: StoredATSCChannel): Promise<void> => {
      if (!device?.isOpen()) {
        setPlayerState("error");
        console.error("ATSC Player: Device not available");
        return;
      }

      try {
        setPlayerState("tuning");
        setCurrentChannel(channel);
        setProgramInfo(null);
        setAudioTracks([]);
        setSelectedAudioTrack(null);
        setVideoPID(null);

        // Stop any existing playback
        if (device.isReceiving()) {
          await device.stopRx();
        }

        // Initialize demodulator
        if (!demodulatorRef.current) {
          demodulatorRef.current = new ATSC8VSBDemodulator();
          await demodulatorRef.current.initialize();
          await demodulatorRef.current.activate();
        }

        // Ensure parser is initialized
        parserRef.current ??= new TransportStreamParser();

        // Reset parser
        parserRef.current.reset();

        // Configure device in the correct order for HackRF:
        // 1) Sample rate (>= 2 sps recommended for Gardner timing)
        // 2) Frequency (tune LO to pilot to simplify carrier recovery)
        // 3) Bandwidth and gains
        const sampleRateHz = 20_000_000; // ~1.86 sps at 10.76 Msps symbol rate
        await device.setSampleRate(sampleRateHz);

        // Tune to pilot frequency (lower edge + 309.44 kHz) to place pilot near DC
        await device.setFrequency(channel.channel.pilotFrequency);

        // Configure approximate 6 MHz channel bandwidth (ATSC nominal)
        if (device.setBandwidth) {
          try {
            await device.setBandwidth(6_000_000);
          } catch (e) {
            console.warn("ATSC Player: Failed to set 6 MHz bandwidth", e);
          }
        }

        // Enable LNA and RF amp for improved SNR on OTA signals
        try {
          await device.setLNAGain(24);
        } catch (e) {
          console.warn("ATSC Player: Failed to set LNA gain", e);
        }
        try {
          await device.setAmpEnable(true);
        } catch (e) {
          console.warn("ATSC Player: Failed to enable RF amp", e);
        }

        // Initialize audio context
        if (!audioContextRef.current) {
          initializeAudioContext();
        }

        // Start receiving and demodulating
        isPlayingRef.current = true;
        let tablesReceived = false;
        let currentVideoPID: number | null = null;

        receivePromiseRef.current = device.receive((data: DataView) => {
          if (!isPlayingRef.current) return;

          try {
            // Parse IQ samples
            const samples = device.parseSamples(data);

            // Demodulate to get 8-VSB symbol decisions
            if (demodulatorRef.current) {
              // Inform demodulator of actual sample rate and bandwidth
              demodulatorRef.current.setParameters({
                audioSampleRate: sampleRateHz,
                bandwidth: ATSC_CONSTANTS.CHANNEL_BANDWIDTH,
              });
              const symbolData = demodulatorRef.current.demodulate(samples);

              // Initialize baseband pipeline if needed
              basebandPipelineRef.current ??= new AtscFECPipeline();

              // Process symbols via baseband pipeline (FEC + TS framer)
              const tsBytes =
                basebandPipelineRef.current.processSymbols(symbolData);

              // If we have no TS bytes yet, skip processing
              if (tsBytes.length === 0) {
                return;
              }

              // Parse transport stream when bytes become available
              if (parserRef.current && tsBytes.length > 0) {
                const packets = parserRef.current.parseStream(tsBytes);

                // Once we have PAT/PMT/VCT, extract program info
                if (!tablesReceived) {
                  const pat = parserRef.current.getPAT();
                  if (pat && pat.programs.size > 0) {
                    // Get first program - use iterator for safer access
                    const firstKey = pat.programs.keys().next();
                    const programNumber = firstKey.done
                      ? undefined
                      : firstKey.value;
                    if (programNumber !== undefined) {
                      const pmt = parserRef.current.getPMT(programNumber);
                      const vct = parserRef.current.getVCT();

                      if (pmt) {
                        // Extract A/V PIDs
                        const vPID = findVideoPID(pmt);
                        const aTracks = parseAudioTracks(pmt);

                        currentVideoPID = vPID;
                        setVideoPID(vPID);
                        setAudioTracks(aTracks);
                        if (aTracks.length > 0) {
                          setSelectedAudioTrack(aTracks[0] ?? null);
                        }

                        // Get program info from PSIP
                        if (vct) {
                          const vctChannel = vct.channels.find(
                            (ch) => ch.programNumber === programNumber,
                          );
                          if (vctChannel) {
                            const progInfo = parseProgramInfo(
                              vctChannel,
                              vctChannel.sourceid,
                            );
                            setProgramInfo(progInfo);
                          }
                        }

                        tablesReceived = true;
                        setPlayerState("playing");

                        // Initialize video decoder for detected video stream
                        if (vPID !== null && pmt.streams.length > 0) {
                          const videoStream = pmt.streams.find(
                            (s) => s.elementaryPid === vPID,
                          );
                          if (videoStream) {
                            void (async (): Promise<void> => {
                              try {
                                await initializeVideoDecoder(
                                  videoStream.streamType as StreamType,
                                  vPID,
                                );
                                // Initialize caption decoder after video decoder
                                initializeCaptionDecoder();
                              } catch (error) {
                                console.error(
                                  "Failed to initialize video decoder:",
                                  error,
                                );
                                // Player can continue with audio-only
                              }
                            })();
                          }
                        }
                      }
                    }
                  }
                }

                // Demultiplex and decode video using WebCodecs
                if (
                  tablesReceived &&
                  currentVideoPID !== null &&
                  videoDecoderRef.current &&
                  packets.length > 0
                ) {
                  const videoPayloads = parserRef.current.demultiplex(
                    packets,
                    currentVideoPID,
                  );

                  // Feed payloads to video decoder
                  for (const payload of videoPayloads) {
                    videoDecoderRef.current.processPayload(payload);

                    // Also process payload for captions if enabled
                    if (
                      closedCaptionsEnabledRef.current &&
                      captionDecoderRef.current
                    ) {
                      // Extract PTS from PES header in the payload
                      const pts = extractPTSFromPES(payload);

                      captionDecoderRef.current.processVideoPayload(
                        payload,
                        pts,
                      );
                    }
                  }
                }
              }
            }
          } catch (error) {
            console.error("Error processing samples:", error);
          }
        });

        // Start metrics updates
        metricsIntervalRef.current ??= setInterval(updateSignalQuality, 1000);
      } catch (error) {
        console.error("Error tuning to channel:", error);
        setPlayerState("error");

        // Check if this is a firmware corruption error requiring driver reset
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        if (
          errorMessage.includes("firmware corruption") ||
          errorMessage.includes("driver reset")
        ) {
          notify({
            message:
              "HackRF firmware may be corrupted. Use the HackRF driver reset (not the WebUSB reset) from rad.io, then retry tuning.",
            tone: "error",
            duration: 10000, // 10 seconds
            sr: "assertive", // Important alert
          });
        }
      }
    },
    [
      device,
      initializeAudioContext,
      initializeVideoDecoder,
      initializeCaptionDecoder,
      extractPTSFromPES,
      findVideoPID,
      parseAudioTracks,
      parseProgramInfo,
      updateSignalQuality,
    ],
  );

  /**
   * Select audio track
   */
  const selectAudioTrack = useCallback((track: AudioTrack): void => {
    setSelectedAudioTrack(track);
    // TODO: Switch audio decoder to new PID
  }, []);

  /**
   * Set volume
   */
  const setVolume = useCallback((newVolume: number): void => {
    const clampedVolume = Math.max(0, Math.min(1, newVolume));
    setVolumeState(clampedVolume);
    volumeRef.current = clampedVolume; // Update ref for unmute operation
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = clampedVolume;
    }
  }, []);

  /**
   * Set muted
   */
  const setMuted = useCallback((newMuted: boolean): void => {
    setMutedState(newMuted);
    if (gainNodeRef.current) {
      // Use volumeRef to get current volume value, avoiding stale closure
      gainNodeRef.current.gain.value = newMuted ? 0 : volumeRef.current;
    }
  }, []);

  /**
   * Toggle closed captions
   */
  const toggleClosedCaptions = useCallback((): void => {
    setClosedCaptionsEnabled((prev) => {
      const newValue = !prev;

      // Update ref immediately to prevent race condition
      closedCaptionsEnabledRef.current = newValue;

      // Clear captions when disabling
      if (!newValue && captionRendererRef.current) {
        captionRendererRef.current.clear();
      }

      return newValue;
    });
  }, []);

  /**
   * Stop playback
   */
  const stop = useCallback(async (): Promise<void> => {
    isPlayingRef.current = false;
    setPlayerState("idle");
    setCurrentChannel(null);
    setProgramInfo(null);
    setSignalQuality(null);

    if (metricsIntervalRef.current) {
      clearInterval(metricsIntervalRef.current);
      metricsIntervalRef.current = null;
    }

    if (device?.isReceiving()) {
      await device.stopRx();
    }

    if (receivePromiseRef.current) {
      try {
        await receivePromiseRef.current;
      } catch (_error) {
        // Ignore errors during cleanup
      }
      receivePromiseRef.current = null;
    }

    // Cleanup video decoder and renderer
    if (videoDecoderRef.current) {
      videoDecoderRef.current.close();
      videoDecoderRef.current = null;
    }

    if (videoRendererRef.current) {
      videoRendererRef.current.clear();
      videoRendererRef.current = null;
    }

    // Cleanup caption decoder and renderer
    if (captionDecoderRef.current) {
      captionDecoderRef.current.close();
      captionDecoderRef.current = null;
    }

    if (captionRendererRef.current) {
      captionRendererRef.current.destroy();
      captionRendererRef.current = null;
    }

    // Reset closed captions enabled ref
    closedCaptionsEnabledRef.current = false;

    // Cleanup audio decoder
    if (audioDecoderRef.current) {
      audioDecoderRef.current.close();
      audioDecoderRef.current = null;
    }
  }, [device]);

  // Cleanup on unmount
  useEffect(() => {
    return (): void => {
      isPlayingRef.current = false;

      if (metricsIntervalRef.current) {
        clearInterval(metricsIntervalRef.current);
      }

      void (async (): Promise<void> => {
        if (device?.isReceiving()) {
          try {
            await device.stopRx();
          } catch (_error) {
            // Ignore
          }
        }

        if (demodulatorRef.current) {
          try {
            await demodulatorRef.current.deactivate();
            await demodulatorRef.current.dispose();
          } catch (_error) {
            // Ignore
          }
        }

        if (videoDecoderRef.current) {
          videoDecoderRef.current.close();
        }

        if (videoRendererRef.current) {
          videoRendererRef.current.clear();
        }

        if (audioDecoderRef.current) {
          audioDecoderRef.current.close();
        }

        if (audioContextRef.current) {
          await audioContextRef.current.close();
        }
      })();
    };
  }, [device]);

  // Keep closedCaptionsEnabled ref in sync with state
  useEffect(() => {
    closedCaptionsEnabledRef.current = closedCaptionsEnabled;
  }, [closedCaptionsEnabled]);

  return useMemo(
    () => ({
      playerState,
      currentChannel,
      programInfo,
      signalQuality,
      audioTracks,
      selectedAudioTrack,
      videoPID,
      closedCaptionsEnabled,
      volume,
      muted,
      tuneToChannel,
      selectAudioTrack,
      setVolume,
      setMuted,
      toggleClosedCaptions,
      stop,
    }),
    [
      playerState,
      currentChannel,
      programInfo,
      signalQuality,
      audioTracks,
      selectedAudioTrack,
      videoPID,
      closedCaptionsEnabled,
      volume,
      muted,
      tuneToChannel,
      selectAudioTrack,
      setVolume,
      setMuted,
      toggleClosedCaptions,
      stop,
    ],
  );
}
