/**
 * Digital Mode Display Component
 *
 * Displays decoded text from digital modes like PSK31 and FT8
 */

import { useEffect, useState, useRef, type ReactElement } from "react";

export interface DigitalModeMessage {
  timestamp: Date;
  mode: "PSK31" | "FT8" | "RTTY";
  text: string;
  snr?: number;
  frequency?: number;
}

interface DigitalModeDisplayProps {
  messages: DigitalModeMessage[];
  currentMode: "PSK31" | "FT8" | "RTTY" | null;
  isActive: boolean;
  className?: string;
}

/**
 * Digital Mode Display Component
 *
 * Shows real-time decoded text from digital modes with:
 * - Scrollable message history
 * - Mode indicator
 * - Timestamp for each message
 * - SNR and frequency when available
 * - Auto-scroll to latest message
 */
export function DigitalModeDisplay({
  messages,
  currentMode,
  isActive,
  className = "",
}: DigitalModeDisplayProps): ReactElement {
  const [autoScroll, setAutoScroll] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to latest message
  useEffect(() => {
    if (autoScroll && messagesEndRef.current?.scrollIntoView) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, autoScroll]);

  // Detect manual scroll to disable auto-scroll
  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const handleScroll = (): void => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 10;
      setAutoScroll(isAtBottom);
    };

    container.addEventListener("scroll", handleScroll);
    return (): void => {
      container.removeEventListener("scroll", handleScroll);
    };
  }, []);

  // Format timestamp
  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  // Format SNR
  const formatSNR = (snr: number): string => {
    return `${snr > 0 ? "+" : ""}${snr.toFixed(1)} dB`;
  };

  // Format frequency
  const formatFrequency = (freq: number): string => {
    if (freq < 1000) {
      return `${freq.toFixed(1)} Hz`;
    }
    return `${(freq / 1000).toFixed(3)} kHz`;
  };

  // Get SNR color
  const getSNRColor = (snr: number): string => {
    if (snr >= 0) {
      return "#4ade80"; // Green
    } else if (snr >= -10) {
      return "#fbbf24"; // Yellow
    } else {
      return "#f87171"; // Red
    }
  };

  // Get mode color
  const getModeColor = (mode: string): string => {
    switch (mode) {
      case "PSK31":
        return "#60a5fa"; // Blue
      case "FT8":
        return "#a78bfa"; // Purple
      case "RTTY":
        return "#34d399"; // Green
      default:
        return "#9ca3af"; // Gray
    }
  };

  // No active mode
  if (!currentMode) {
    return (
      <div className={`digital-mode-display digital-mode-no-data ${className}`}>
        <div className="digital-mode-status">
          <div className="digital-mode-icon">📡</div>
          <div className="digital-mode-message">No Digital Mode Selected</div>
          <div className="digital-mode-hint">
            Select PSK31, FT8, or RTTY from the mode selector
          </div>
        </div>
      </div>
    );
  }

  // Mode active but not receiving
  if (!isActive) {
    return (
      <div
        className={`digital-mode-display digital-mode-inactive ${className}`}
      >
        <div className="digital-mode-status">
          <div className="digital-mode-icon">⏸️</div>
          <div className="digital-mode-message">
            {currentMode} Decoder Inactive
          </div>
          <div className="digital-mode-hint">
            Activate the decoder to receive messages
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`digital-mode-display ${className}`}>
      {/* Header */}
      <div className="digital-mode-header">
        <div className="digital-mode-title">
          <span
            className="digital-mode-badge"
            style={{ backgroundColor: getModeColor(currentMode) }}
          >
            {currentMode}
          </span>
          <span className="digital-mode-label">Decoded Messages</span>
        </div>
        <div className="digital-mode-controls">
          <button
            type="button"
            className={`digital-mode-auto-scroll ${autoScroll ? "active" : ""}`}
            onClick={(): void => {
              setAutoScroll(!autoScroll);
            }}
            aria-label="Toggle auto-scroll"
            title={autoScroll ? "Auto-scroll enabled" : "Auto-scroll disabled"}
          >
            {autoScroll ? "📌" : "📍"}
          </button>
          <span className="digital-mode-count">
            {messages.length} {messages.length === 1 ? "message" : "messages"}
          </span>
        </div>
      </div>

      {/* Messages Container */}
      <div
        className="digital-mode-messages"
        ref={containerRef}
        role="log"
        aria-live="polite"
        aria-atomic="false"
        aria-relevant="additions"
      >
        {messages.length === 0 ? (
          <div className="digital-mode-empty">
            <div className="digital-mode-empty-icon">⏳</div>
            <div className="digital-mode-empty-text">
              Waiting for {currentMode} signals...
            </div>
          </div>
        ) : (
          messages.map((message, index) => (
            <div
              key={`${message.timestamp.getTime()}-${index}`}
              className="digital-mode-message"
            >
              <div className="digital-mode-message-header">
                <span className="digital-mode-message-time">
                  {formatTime(message.timestamp)}
                </span>
                {message.snr !== undefined && (
                  <span
                    className="digital-mode-message-snr"
                    style={{ color: getSNRColor(message.snr) }}
                  >
                    {formatSNR(message.snr)}
                  </span>
                )}
                {message.frequency !== undefined && (
                  <span className="digital-mode-message-freq">
                    {formatFrequency(message.frequency)}
                  </span>
                )}
              </div>
              <div className="digital-mode-message-text">{message.text}</div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Status Bar */}
      <div className="digital-mode-footer">
        <div className="digital-mode-status-indicator">
          <span
            className="digital-mode-status-dot"
            style={{
              backgroundColor: isActive ? "#4ade80" : "#9ca3af",
            }}
          />
          <span className="digital-mode-status-text">
            {isActive ? "Receiving" : "Standby"}
          </span>
        </div>
      </div>
    </div>
  );
}
