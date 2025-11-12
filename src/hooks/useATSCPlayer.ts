/**
 * ATSC Player Hook
 *
 * Business logic for playing ATSC broadcasts with channel selection,
 * program information display, and A/V playback using WebCodecs.
 */

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
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
export type PlayerState = "idle" | "tuning" | "playing" | "buffering" | "error";

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
  const videoDecoderRef = useRef<VideoDecoder | null>(null);
  const audioDecoderRef = useRef<AudioDecoder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const receivePromiseRef = useRef<Promise<void> | null>(null);
  const isPlayingRef = useRef(false);
  const metricsIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );

  /**
   * Initialize audio context
   */
  const initializeAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
      gainNodeRef.current = audioContextRef.current.createGain();
      gainNodeRef.current.connect(audioContextRef.current.destination);
      gainNodeRef.current.gain.value = volume;
    }
  }, [volume]);

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

    // TODO: Get actual SNR, BER, MER from demodulator
    // For now, use placeholder values
    setSignalQuality({
      snr: 25.0, // dB
      ber: syncLocked ? 0.0001 : 0.1, // Bit Error Rate
      mer: 28.0, // dB
      signalStrength: syncLocked ? 85 : 50, // 0-100 scale
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

        // Tune to channel
        await device.setFrequency(channel.channel.frequency);
        await device.setSampleRate(ATSC_CONSTANTS.SYMBOL_RATE);

        // Initialize audio context
        if (!audioContextRef.current) {
          initializeAudioContext();
        }

        // Start receiving and demodulating
        isPlayingRef.current = true;
        let tablesReceived = false;

        receivePromiseRef.current = device.receive((data: DataView) => {
          if (!isPlayingRef.current) return;

          try {
            // Parse IQ samples
            const samples = device.parseSamples(data);

            // Demodulate to get transport stream packets
            if (demodulatorRef.current) {
              const tsData = demodulatorRef.current.demodulate(samples);

              // Parse transport stream
              if (parserRef.current && tsData.length > 0) {
                parserRef.current.parseStream(new Uint8Array(tsData.buffer));

                // Once we have PAT/PMT/VCT, extract program info
                if (!tablesReceived) {
                  const pat = parserRef.current.getPAT();
                  if (pat && pat.programs.size > 0) {
                    // Get first program
                    const programNumber = Array.from(pat.programs.keys())[0];
                    if (programNumber !== undefined) {
                      const pmt = parserRef.current.getPMT(programNumber);
                      const vct = parserRef.current.getVCT();

                      if (pmt) {
                        // Extract A/V PIDs
                        const vPID = findVideoPID(pmt);
                        const aTracks = parseAudioTracks(pmt);

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
                      }
                    }
                  }
                }

                // TODO: Demultiplex and decode video/audio using WebCodecs
                // This would involve:
                // 1. Demultiplexing video/audio PIDs
                // 2. Decoding PES packets
                // 3. Feeding to VideoDecoder/AudioDecoder
                // 4. Rendering decoded frames
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
      }
    },
    [
      device,
      initializeAudioContext,
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
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = clampedVolume;
    }
  }, []);

  /**
   * Set muted
   */
  const setMuted = useCallback(
    (newMuted: boolean): void => {
      setMutedState(newMuted);
      if (gainNodeRef.current) {
        gainNodeRef.current.gain.value = newMuted ? 0 : volume;
      }
    },
    [volume],
  );

  /**
   * Toggle closed captions
   */
  const toggleClosedCaptions = useCallback((): void => {
    setClosedCaptionsEnabled((prev) => !prev);
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

    // Cleanup decoders
    if (videoDecoderRef.current) {
      videoDecoderRef.current.close();
      videoDecoderRef.current = null;
    }

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

        if (audioDecoderRef.current) {
          audioDecoderRef.current.close();
        }

        if (audioContextRef.current) {
          await audioContextRef.current.close();
        }
      })();
    };
  }, [device]);

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
