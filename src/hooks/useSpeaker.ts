import { useEffect, useState } from "react";

export type AudioState =
  | "unavailable"
  | "suspended"
  | "idle"
  | "playing"
  | "muted";

export type SpeakerInfo = {
  state: AudioState;
  volume?: number; // 0-100
  clipping: boolean;
};

declare global {
  interface Window {
    dbgAudioCtx?: AudioContext;
    dbgLastAudioAt?: number;
    dbgAudioClipping?: boolean;
    dbgVolume?: number;
  }
}

/**
 * useSpeaker - lightweight audio status hook for StatusBar
 *
 * Implementation notes:
 * - Reads a shared AudioContext exposed for diagnostics (dbgAudioCtx)
 * - Uses dbgLastAudioAt timestamps to infer recent playback activity
 * - Uses dbgVolume to infer muted state when available
 * - Surfaces a transient clipping flag when recent buffers approached full scale
 */
export function useSpeaker(pollMs = 1000): SpeakerInfo {
  const [info, setInfo] = useState<SpeakerInfo>({
    state: "unavailable",
    volume: undefined,
    clipping: false,
  });

  useEffect(() => {
    let id: number | undefined;

    const update = (): void => {
      const ctx = window.dbgAudioCtx;
      const vol = window.dbgVolume;
      const lastAt = window.dbgLastAudioAt ?? 0;
      const recent = performance.now() - lastAt < 2500; // within last 2.5s
      const clipping = Boolean(window.dbgAudioClipping && recent);

      let state: AudioState = "unavailable";
      if (ctx) {
        if (ctx.state === "suspended") {
          state = "suspended";
        } else if (typeof vol === "number" && vol <= 0) {
          state = "muted";
        } else if (recent) {
          state = "playing";
        } else {
          state = "idle";
        }
      }

      setInfo({ state, volume: vol, clipping });
      id = window.setTimeout(update, pollMs);
    };

    update();
    return (): void => {
      if (id) {
        window.clearTimeout(id);
      }
    };
  }, [pollMs]);

  return info;
}
