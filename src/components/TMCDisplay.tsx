/**
 * TMC (Traffic Message Channel) Display Component
 *
 * Displays decoded TMC traffic information in real-time:
 * - Active traffic messages
 * - Event type and severity
 * - Location and extent
 * - Duration and urgency
 * - Statistics
 */

import { type ReactElement } from "react";
import {
  getSeverityColor,
  TMCEventSeverity,
  TMCDirection,
} from "../models/TMCData";
import type { TMCMessage, TMCDecoderStats } from "../models/TMCData";

interface TMCDisplayProps {
  messages: TMCMessage[];
  stats: TMCDecoderStats | null;
  className?: string;
}

/**
 * TMC Display Component
 */
export function TMCDisplay({
  messages,
  stats,
  className = "",
}: TMCDisplayProps): ReactElement {
  // No TMC data available
  if (messages.length === 0) {
    return (
      <div className={`tmc-display tmc-no-data ${className}`}>
        <div className="tmc-status">
          <div className="tmc-icon">🚦</div>
          <div className="tmc-message">No Traffic Messages</div>
          <div className="tmc-hint">
            TMC data will appear when traffic information is broadcast
          </div>
        </div>
      </div>
    );
  }

  const getSeverityLabel = (severity: TMCEventSeverity): string => {
    switch (severity) {
      case TMCEventSeverity.CRITICAL:
        return "CRITICAL";
      case TMCEventSeverity.SEVERE:
        return "SEVERE";
      case TMCEventSeverity.MODERATE:
        return "MODERATE";
      case TMCEventSeverity.MINOR:
        return "MINOR";
      case TMCEventSeverity.NONE:
        return "INFO";
      default:
        return "INFO";
    }
  };

  const getSeverityIcon = (severity: TMCEventSeverity): string => {
    switch (severity) {
      case TMCEventSeverity.CRITICAL:
        return "🚨";
      case TMCEventSeverity.SEVERE:
        return "⚠️";
      case TMCEventSeverity.MODERATE:
        return "⚡";
      case TMCEventSeverity.MINOR:
        return "ℹ️";
      case TMCEventSeverity.NONE:
        return "📋";
      default:
        return "📋";
    }
  };

  return (
    <div className={`tmc-display ${className}`}>
      {/* Header */}
      <div className="tmc-header">
        <div className="tmc-title">
          <span className="tmc-icon">🚦</span>
          <span className="tmc-title-text">Traffic Messages</span>
          <span className="tmc-count">{messages.length}</span>
        </div>
        {stats && stats.lastMessageAt > 0 && (
          <div className="tmc-last-update">
            Updated: {new Date(stats.lastMessageAt).toLocaleTimeString()}
          </div>
        )}
      </div>

      {/* Message List */}
      <div className="tmc-messages">
        {messages.map((message) => (
          <div
            key={message.messageId}
            className="tmc-message-card"
            style={{
              borderLeftColor: getSeverityColor(message.severity),
              borderLeftWidth: "4px",
              borderLeftStyle: "solid",
            }}
          >
            {/* Message Header */}
            <div className="tmc-message-header">
              <div className="tmc-message-severity">
                <span className="tmc-severity-icon">
                  {getSeverityIcon(message.severity)}
                </span>
                <span
                  className="tmc-severity-label"
                  style={{ color: getSeverityColor(message.severity) }}
                >
                  {getSeverityLabel(message.severity)}
                </span>
              </div>
              {message.diversionAdvice && (
                <div className="tmc-diversion-badge">🔀 Diversion Advised</div>
              )}
            </div>

            {/* Event Text */}
            <div className="tmc-message-event">{message.eventText}</div>

            {/* Location and Details */}
            <div className="tmc-message-details">
              <div className="tmc-detail-item">
                <span className="tmc-detail-label">Location:</span>
                <span className="tmc-detail-value">{message.locationText}</span>
              </div>
              <div className="tmc-detail-item">
                <span className="tmc-detail-label">Extent:</span>
                <span className="tmc-detail-value">{message.extentText}</span>
              </div>
              <div className="tmc-detail-item">
                <span className="tmc-detail-label">Duration:</span>
                <span className="tmc-detail-value">{message.durationText}</span>
              </div>
              <div className="tmc-detail-item">
                <span className="tmc-detail-label">Direction:</span>
                <span className="tmc-detail-value">
                  {message.direction === TMCDirection.POSITIVE
                    ? "Positive"
                    : message.direction === TMCDirection.NEGATIVE
                      ? "Negative"
                      : "Both"}
                </span>
              </div>
            </div>

            {/* Metadata */}
            <div className="tmc-message-meta">
              <span className="tmc-meta-item">
                Updates: {message.updateCount}
              </span>
              {message.expiresAt && (
                <span className="tmc-meta-item">
                  Expires: {new Date(message.expiresAt).toLocaleTimeString()}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Statistics Footer */}
      {stats && (
        <div className="tmc-stats">
          <div className="tmc-stat-item">
            <span className="tmc-stat-label">Total:</span>
            <span className="tmc-stat-value">{stats.messagesReceived}</span>
          </div>
          <div className="tmc-stat-item">
            <span className="tmc-stat-label">Active:</span>
            <span className="tmc-stat-value">{stats.messagesActive}</span>
          </div>
          <div className="tmc-stat-item">
            <span className="tmc-stat-label">Groups:</span>
            <span className="tmc-stat-value">{stats.group8ACount}</span>
          </div>
          {stats.parseErrors > 0 && (
            <div className="tmc-stat-item tmc-stat-error">
              <span className="tmc-stat-label">Errors:</span>
              <span className="tmc-stat-value">{stats.parseErrors}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default TMCDisplay;

/**
 * Compact TMC Display (simplified view)
 */
export function TMCDisplayCompact({
  messages,
  className = "",
}: {
  messages: TMCMessage[];
  className?: string;
}): ReactElement {
  if (messages.length === 0) {
    return (
      <div className={`tmc-display-compact tmc-no-data ${className}`}>
        <span className="tmc-icon">🚦</span>
        <span className="tmc-text">No Traffic</span>
      </div>
    );
  }

  // Show only the most severe message
  const topMessage = messages[0];
  if (!topMessage) {
    return (
      <div className={`tmc-display-compact tmc-no-data ${className}`}>
        <span className="tmc-icon">🚦</span>
        <span className="tmc-text">No Traffic</span>
      </div>
    );
  }

  return (
    <div
      className={`tmc-display-compact ${className}`}
      style={{ borderLeftColor: getSeverityColor(topMessage.severity) }}
    >
      <span className="tmc-icon">🚦</span>
      <span className="tmc-count">{messages.length}</span>
      <span className="tmc-text" title={topMessage.eventText}>
        {topMessage.eventText}
      </span>
    </div>
  );
}
