/**
 * Channel Selector Component
 *
 * Displays a list of available ATSC channels and allows the user to select one for playback.
 */

import React from "react";
import { formatATSCChannel } from "../../utils/atscChannels";
import type { StoredATSCChannel } from "../../utils/atscChannelStorage";

interface ChannelSelectorProps {
  channels: StoredATSCChannel[];
  currentChannel: StoredATSCChannel | null;
  onSelectChannel: (channel: StoredATSCChannel) => void;
}

export function ChannelSelector({
  channels,
  currentChannel,
  onSelectChannel,
}: ChannelSelectorProps): React.JSX.Element {
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
