/**
 * ATSC Player Page
 *
 * Dedicated page for playing ATSC broadcasts with channel selection,
 * program information display, and playback controls.
 */

import React, { useState, useCallback, useEffect } from "react";
import { useATSCPlayer } from "../hooks/useATSCPlayer";
import { useATSCScanner } from "../hooks/useATSCScanner";
import { useDevice } from "../store";
import { formatATSCChannel } from "../utils/atscChannels";
import type { AudioTrack } from "../hooks/useATSCPlayer";
import type { StoredATSCChannel } from "../utils/atscChannelStorage";

/**
 * Channel selector component
 */
function ChannelSelector({
  channels,
  currentChannel,
  onSelectChannel,
}: {
  channels: StoredATSCChannel[];
  currentChannel: StoredATSCChannel | null;
  onSelectChannel: (channel: StoredATSCChannel) => void;
}): React.JSX.Element {
  return (
    <div className="channel-selector">
      <h3>Available Channels</h3>
      {channels.length === 0 ? (
        <p className="empty-state">
          No channels available. Please scan for channels first.
        </p>
      ) : (
        <div className="channel-list">
          {channels.map((channel) => (
            <button
              key={channel.channel.channel}
              className={`channel-item ${
                currentChannel?.channel.channel === channel.channel.channel
                  ? "active"
                  : ""
              }`}
              onClick={() => onSelectChannel(channel)}
              title={`Tune to ${formatATSCChannel(channel.channel)}`}
            >
              <div className="channel-number">{channel.channel.channel}</div>
              <div className="channel-info">
                <div className="channel-name">
                  {formatATSCChannel(channel.channel)}
                </div>
                <div className="channel-frequency">
                  {(channel.channel.frequency / 1e6).toFixed(1)} MHz
                </div>
              </div>
              <div className="channel-strength">
                <div
                  className="strength-bar"
                  style={{
                    width: `${channel.strength * 100}%`,
                    backgroundColor:
                      channel.strength > 0.7
                        ? "#10b981"
                        : channel.strength > 0.4
                          ? "#f59e0b"
                          : "#ef4444",
                  }}
                />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Program info display component
 */
function ProgramInfoDisplay({
  programInfo,
}: {
  programInfo: {
    title: string;
    description: string;
    startTime?: Date;
    duration?: number;
  } | null;
}): React.JSX.Element {
  if (!programInfo) {
    return (
      <div className="program-info">
        <h3>Program Information</h3>
        <p className="empty-state">No program information available</p>
      </div>
    );
  }

  return (
    <div className="program-info">
      <h3>Now Playing</h3>
      <div className="program-details">
        <h4 className="program-title">{programInfo.title}</h4>
        {programInfo.description && (
          <p className="program-description">{programInfo.description}</p>
        )}
        {programInfo.startTime && (
          <div className="program-meta">
            <span className="meta-label">Start Time:</span>
            <span className="meta-value">
              {programInfo.startTime.toLocaleTimeString()}
            </span>
          </div>
        )}
        {programInfo.duration !== undefined && (
          <div className="program-meta">
            <span className="meta-label">Duration:</span>
            <span className="meta-value">
              {Math.floor(programInfo.duration / 60)} minutes
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Signal quality meters component
 */
function SignalQualityMeters({
  quality,
}: {
  quality: {
    snr: number;
    ber: number;
    mer: number;
    signalStrength: number;
    syncLocked: boolean;
  } | null;
}): React.JSX.Element {
  if (!quality) {
    return (
      <div className="signal-quality">
        <h3>Signal Quality</h3>
        <p className="empty-state">No signal quality data</p>
      </div>
    );
  }

  return (
    <div className="signal-quality">
      <h3>Signal Quality</h3>
      <div className="quality-metrics">
        <div className="metric">
          <span className="metric-label">Signal Strength</span>
          <div className="metric-bar-container">
            <div
              className="metric-bar"
              style={{
                width: `${quality.signalStrength}%`,
                backgroundColor:
                  quality.signalStrength > 70
                    ? "#10b981"
                    : quality.signalStrength > 40
                      ? "#f59e0b"
                      : "#ef4444",
              }}
            />
          </div>
          <span className="metric-value">{quality.signalStrength}%</span>
        </div>

        <div className="metric">
          <span className="metric-label">SNR</span>
          <span className="metric-value">{quality.snr.toFixed(1)} dB</span>
        </div>

        <div className="metric">
          <span className="metric-label">MER</span>
          <span className="metric-value">{quality.mer.toFixed(1)} dB</span>
        </div>

        <div className="metric">
          <span className="metric-label">BER</span>
          <span className="metric-value">{quality.ber.toExponential(2)}</span>
        </div>

        <div className="metric">
          <span className="metric-label">Sync Lock</span>
          <span
            className={`metric-status ${quality.syncLocked ? "locked" : "unlocked"}`}
          >
            {quality.syncLocked ? "Locked" : "Unlocked"}
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * Audio track selector component
 */
function AudioTrackSelector({
  tracks,
  selectedTrack,
  onSelectTrack,
}: {
  tracks: AudioTrack[];
  selectedTrack: AudioTrack | null;
  onSelectTrack: (track: AudioTrack) => void;
}): React.JSX.Element {
  if (tracks.length === 0) {
    return <div className="audio-selector" />;
  }

  return (
    <div className="audio-selector">
      <label htmlFor="audio-track">
        Audio Track:
        <select
          id="audio-track"
          value={selectedTrack?.pid ?? ""}
          onChange={(e) => {
            const pid = parseInt(e.target.value, 10);
            const track = tracks.find((t) => t.pid === pid);
            if (track) {
              onSelectTrack(track);
            }
          }}
        >
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

/**
 * Video player component
 */
function VideoPlayer({
  playerState,
}: {
  playerState: string;
}): React.JSX.Element {
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
      </div>
      <div id="closed-captions" className="closed-captions" />
    </div>
  );
}

/**
 * Playback controls component
 */
function PlaybackControls({
  volume,
  muted,
  closedCaptionsEnabled,
  onVolumeChange,
  onMuteToggle,
  onCCToggle,
  onStop,
  disabled,
}: {
  volume: number;
  muted: boolean;
  closedCaptionsEnabled: boolean;
  onVolumeChange: (volume: number) => void;
  onMuteToggle: () => void;
  onCCToggle: () => void;
  onStop: () => void;
  disabled: boolean;
}): React.JSX.Element {
  return (
    <div className="playback-controls">
      <button
        className="btn btn-danger"
        onClick={onStop}
        disabled={disabled}
        title="Stop playback"
      >
        Stop
      </button>

      <div className="volume-control">
        <button
          className="btn btn-icon"
          onClick={onMuteToggle}
          title={muted ? "Unmute" : "Mute"}
        >
          {muted ? "🔇" : "🔊"}
        </button>
        <input
          type="range"
          min="0"
          max="100"
          value={volume * 100}
          onChange={(e) => onVolumeChange(parseInt(e.target.value, 10) / 100)}
          disabled={disabled}
          title={`Volume: ${Math.round(volume * 100)}%`}
        />
        <span className="volume-label">{Math.round(volume * 100)}%</span>
      </div>

      <button
        className={`btn ${closedCaptionsEnabled ? "btn-primary" : "btn-secondary"}`}
        onClick={onCCToggle}
        disabled={disabled}
        title={
          closedCaptionsEnabled
            ? "Disable closed captions"
            : "Enable closed captions"
        }
      >
        CC
      </button>
    </div>
  );
}

/**
 * ATSC Player Page Component
 */
function ATSCPlayer(): React.JSX.Element {
  const { primaryDevice: device } = useDevice();
  const scanner = useATSCScanner(device);
  const player = useATSCPlayer(device);

  const [showScanner, setShowScanner] = useState(false);

  // Load stored channels on mount
  useEffect(() => {
    void scanner.loadStoredChannels();
  }, [scanner]);

  const handleSelectChannel = useCallback(
    (channel: StoredATSCChannel) => {
      void player.tuneToChannel(channel);
    },
    [player],
  );

  const handleStop = useCallback(() => {
    void player.stop();
  }, [player]);

  const handleMuteToggle = useCallback(() => {
    player.setMuted(!player.muted);
  }, [player]);

  return (
    <div className="atsc-player-page">
      <div className="page-header">
        <h1>ATSC Digital TV Player</h1>
        <button
          className="btn btn-secondary"
          onClick={() => setShowScanner(!showScanner)}
        >
          {showScanner ? "Hide Scanner" : "Show Scanner"}
        </button>
      </div>

      {showScanner && (
        <div className="scanner-section">
          <div className="card">
            <h2>Channel Scanner</h2>
            <p className="scanner-info">
              Scan for ATSC channels in your area. Found channels will appear in
              the channel selector.
            </p>
            {/* Scanner controls would go here - integrate with useATSCScanner */}
            <div className="scanner-controls">
              <button
                className="btn btn-primary"
                onClick={() => void scanner.startScan()}
                disabled={scanner.state !== "idle" || !device}
              >
                Start Scan
              </button>
              {scanner.state === "scanning" && (
                <>
                  <button
                    className="btn btn-warning"
                    onClick={scanner.pauseScan}
                  >
                    Pause
                  </button>
                  <button className="btn btn-danger" onClick={scanner.stopScan}>
                    Stop
                  </button>
                </>
              )}
              {scanner.state === "paused" && (
                <>
                  <button
                    className="btn btn-primary"
                    onClick={scanner.resumeScan}
                  >
                    Resume
                  </button>
                  <button className="btn btn-danger" onClick={scanner.stopScan}>
                    Stop
                  </button>
                </>
              )}
            </div>
            {scanner.state !== "idle" && (
              <div className="scanner-progress">
                <div className="progress-bar-container">
                  <div
                    className="progress-bar-fill"
                    style={{ width: `${scanner.progress}%` }}
                  />
                </div>
                <p className="progress-text">
                  {scanner.currentChannel &&
                    `Scanning: ${formatATSCChannel(scanner.currentChannel)} (${scanner.progress.toFixed(1)}%)`}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="player-layout">
        <aside className="sidebar">
          <ChannelSelector
            channels={scanner.foundChannels}
            currentChannel={player.currentChannel}
            onSelectChannel={handleSelectChannel}
          />
        </aside>

        <main className="player-main">
          <VideoPlayer playerState={player.playerState} />

          <PlaybackControls
            volume={player.volume}
            muted={player.muted}
            closedCaptionsEnabled={player.closedCaptionsEnabled}
            onVolumeChange={player.setVolume}
            onMuteToggle={handleMuteToggle}
            onCCToggle={player.toggleClosedCaptions}
            onStop={handleStop}
            disabled={player.playerState === "idle"}
          />

          <div className="player-info-grid">
            <ProgramInfoDisplay programInfo={player.programInfo} />
            <SignalQualityMeters quality={player.signalQuality} />
          </div>

          {player.audioTracks.length > 0 && (
            <AudioTrackSelector
              tracks={player.audioTracks}
              selectedTrack={player.selectedAudioTrack}
              onSelectTrack={player.selectAudioTrack}
            />
          )}
        </main>
      </div>

      <style>{`
        .atsc-player-page {
          padding: 1rem;
          max-width: 1600px;
          margin: 0 auto;
        }

        .page-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1.5rem;
        }

        .page-header h1 {
          margin: 0;
          font-size: 1.75rem;
        }

        .scanner-section {
          margin-bottom: 1.5rem;
        }

        .scanner-info {
          color: #9ca3af;
          margin-bottom: 1rem;
        }

        .scanner-controls {
          display: flex;
          gap: 0.75rem;
          margin-bottom: 1rem;
        }

        .scanner-progress {
          margin-top: 1rem;
        }

        .progress-bar-container {
          width: 100%;
          height: 1.5rem;
          background: #1f2937;
          border-radius: 0.375rem;
          overflow: hidden;
          margin-bottom: 0.5rem;
        }

        .progress-bar-fill {
          height: 100%;
          background: linear-gradient(90deg, #3b82f6, #8b5cf6);
          transition: width 0.3s ease;
        }

        .progress-text {
          font-size: 0.875rem;
          color: #9ca3af;
          margin: 0;
        }

        .player-layout {
          display: grid;
          grid-template-columns: 300px 1fr;
          gap: 1.5rem;
        }

        .sidebar {
          background: #1f2937;
          border-radius: 0.5rem;
          padding: 1rem;
          height: fit-content;
          max-height: calc(100vh - 200px);
          overflow-y: auto;
        }

        .channel-selector h3 {
          margin: 0 0 1rem 0;
          font-size: 1rem;
          color: #f9fafb;
        }

        .channel-list {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .channel-item {
          display: grid;
          grid-template-columns: 50px 1fr 60px;
          gap: 0.75rem;
          align-items: center;
          padding: 0.75rem;
          background: #111827;
          border: 2px solid transparent;
          border-radius: 0.375rem;
          cursor: pointer;
          transition: all 0.2s;
          text-align: left;
        }

        .channel-item:hover {
          background: #1f2937;
          border-color: #3b82f6;
        }

        .channel-item.active {
          background: #1e40af;
          border-color: #60a5fa;
        }

        .channel-number {
          font-size: 1.25rem;
          font-weight: 700;
          color: #60a5fa;
          font-family: monospace;
        }

        .channel-info {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .channel-name {
          font-size: 0.875rem;
          font-weight: 500;
          color: #f9fafb;
        }

        .channel-frequency {
          font-size: 0.75rem;
          color: #9ca3af;
        }

        .channel-strength {
          width: 60px;
        }

        .strength-bar {
          height: 0.5rem;
          border-radius: 0.25rem;
          transition: width 0.3s ease;
        }

        .player-main {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .video-player {
          background: #000;
          border-radius: 0.5rem;
          overflow: hidden;
        }

        .video-container {
          position: relative;
          width: 100%;
          aspect-ratio: 16 / 9;
        }

        #atsc-video-canvas {
          width: 100%;
          height: 100%;
          display: block;
        }

        .video-overlay {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(0, 0, 0, 0.8);
        }

        .video-status {
          color: #9ca3af;
          font-size: 1.125rem;
        }

        .closed-captions {
          position: absolute;
          bottom: 2rem;
          left: 50%;
          transform: translateX(-50%);
          max-width: 80%;
          padding: 0.5rem 1rem;
          background: rgba(0, 0, 0, 0.8);
          color: #fff;
          font-size: 1.125rem;
          text-align: center;
          border-radius: 0.25rem;
          display: none;
        }

        .closed-captions:not(:empty) {
          display: block;
        }

        .playback-controls {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 1rem;
          background: #1f2937;
          border-radius: 0.5rem;
        }

        .volume-control {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          flex: 1;
        }

        .volume-control input[type="range"] {
          flex: 1;
          max-width: 200px;
        }

        .volume-label {
          min-width: 3rem;
          font-size: 0.875rem;
          color: #9ca3af;
        }

        .player-info-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 1.5rem;
        }

        .program-info,
        .signal-quality {
          background: #1f2937;
          border-radius: 0.5rem;
          padding: 1rem;
        }

        .program-info h3,
        .signal-quality h3 {
          margin: 0 0 1rem 0;
          font-size: 1rem;
          color: #f9fafb;
        }

        .program-title {
          margin: 0 0 0.5rem 0;
          font-size: 1.25rem;
          color: #f9fafb;
        }

        .program-description {
          margin: 0 0 1rem 0;
          color: #d1d5db;
          font-size: 0.875rem;
          line-height: 1.5;
        }

        .program-meta {
          display: flex;
          gap: 0.5rem;
          margin-bottom: 0.5rem;
          font-size: 0.875rem;
        }

        .meta-label {
          color: #9ca3af;
          font-weight: 500;
        }

        .meta-value {
          color: #f9fafb;
        }

        .quality-metrics {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .metric {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
        }

        .metric-label {
          font-size: 0.875rem;
          color: #9ca3af;
          font-weight: 500;
          min-width: 100px;
        }

        .metric-value {
          font-size: 0.875rem;
          color: #f9fafb;
          font-family: monospace;
        }

        .metric-bar-container {
          flex: 1;
          height: 0.5rem;
          background: #111827;
          border-radius: 0.25rem;
          overflow: hidden;
        }

        .metric-bar {
          height: 100%;
          border-radius: 0.25rem;
          transition: width 0.3s ease;
        }

        .metric-status {
          font-size: 0.875rem;
          font-weight: 600;
          padding: 0.25rem 0.5rem;
          border-radius: 0.25rem;
        }

        .metric-status.locked {
          background: #10b981;
          color: #000;
        }

        .metric-status.unlocked {
          background: #ef4444;
          color: #fff;
        }

        .audio-selector {
          padding: 1rem;
          background: #1f2937;
          border-radius: 0.5rem;
        }

        .audio-selector label {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          font-size: 0.875rem;
          color: #f9fafb;
        }

        .audio-selector select {
          flex: 1;
          padding: 0.5rem;
          background: #111827;
          color: #f9fafb;
          border: 1px solid #374151;
          border-radius: 0.375rem;
          font-size: 0.875rem;
        }

        .empty-state {
          padding: 2rem;
          text-align: center;
          color: #9ca3af;
          background: #111827;
          border-radius: 0.375rem;
        }

        @media (max-width: 1024px) {
          .player-layout {
            grid-template-columns: 1fr;
          }

          .sidebar {
            max-height: 400px;
          }

          .player-info-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}

export default ATSCPlayer;
