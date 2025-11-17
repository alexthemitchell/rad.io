/**
 * Video Player Component
 *
 * Renders the video canvas and overlays for playback status and closed captions.
 */

import React from "react";
import type { PlayerState } from "../../hooks/useATSCPlayer";

interface VideoPlayerProps {
  playerState: PlayerState;
}

export function VideoPlayer({
  playerState,
}: VideoPlayerProps): React.JSX.Element {
  return (
    <div className="video-player">
      <div className="video-container">
        <canvas id="atsc-video-canvas" width={1280} height={720} />
        {playerState !== "playing" && (
          <div className="video-overlay">
            <p className="video-status">
              {playerState === "idle" && "Select a channel to start playback"}
              {playerState === "tuning" && "Tuning..."}
              {playerState === "buffering" && "Buffering..."}
              {playerState === "error" && "Playback error"}
            </p>
          </div>
        )}
        {/* This container will be populated by the caption renderer when CEA-608/708 parsing is implemented */}
        <div
          id="closed-captions"
          className="closed-captions"
          data-caption-target
        />
      </div>
    </div>
  );
}
