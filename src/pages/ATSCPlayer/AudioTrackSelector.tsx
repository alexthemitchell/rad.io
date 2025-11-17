/**
 * Audio Track Selector Component
 *
 * Allows the user to select from available audio tracks.
 */

import React from "react";
import type { AudioTrack } from "../../hooks/useATSCPlayer";

interface AudioTrackSelectorProps {
  tracks: AudioTrack[];
  selectedTrack: AudioTrack | null;
  onSelectTrack: (track: AudioTrack) => void;
}

export function AudioTrackSelector({
  tracks,
  selectedTrack,
  onSelectTrack,
}: AudioTrackSelectorProps): React.JSX.Element {
  if (tracks.length === 0) {
    return <div className="audio-selector" />;
  }

  return (
    <div className="audio-selector">
      <label htmlFor="audio-track">
        Audio Track:
        <select
          id="audio-track"
          value={selectedTrack?.pid.toString() ?? ""}
          onChange={(e) => {
            const pid = parseInt(e.target.value, 10);
            const track = tracks.find((t) => t.pid === pid);
            if (track) {
              onSelectTrack(track);
            }
          }}
        >
          {!selectedTrack && <option value="">Select track...</option>}
          {tracks.map((track) => (
            <option key={track.pid} value={track.pid}>
              {track.description}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
