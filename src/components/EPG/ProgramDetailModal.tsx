/**
 * Program Detail Modal
 *
 * Modal dialog displaying detailed information about a selected program.
 */

import React, { useEffect, useRef } from "react";
import { formatDuration } from "../../utils/psipTextDecoder";
import type { EPGProgram } from "../../utils/epgStorage";

export interface ProgramDetailModalProps {
  program: EPGProgram | null;
  isOpen: boolean;
  onClose: () => void;
  onTuneToChannel?: (channelNumber: string, startTime: Date) => void;
  onSetReminder?: (program: EPGProgram) => void;
  onScheduleRecording?: (program: EPGProgram) => void;
}

/**
 * Program Detail Modal Component
 */
export function ProgramDetailModal({
  program,
  isOpen,
  onClose,
  onTuneToChannel,
  onSetReminder,
  onScheduleRecording,
}: ProgramDetailModalProps): React.JSX.Element | null {
  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Focus trap and escape key handler
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    // Focus close button when modal opens
    closeButtonRef.current?.focus();

    // Handle escape key
    const handleEscape = (e: KeyboardEvent): void => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    // Handle click outside modal
    const handleClickOutside = (e: MouseEvent): void => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener("keydown", handleEscape);
    document.addEventListener("mousedown", handleClickOutside);

    return (): void => {
      document.removeEventListener("keydown", handleEscape);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !program) {
    return null;
  }

  const isPast = program.endTime < new Date();
  const isLive =
    program.startTime <= new Date() && program.endTime > new Date();
  const isFuture = program.startTime > new Date();

  return (
    <div
      className="program-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="program-modal-title"
    >
      <div className="program-modal" ref={modalRef}>
        <div className="program-modal-header">
          <h2 id="program-modal-title" className="program-modal-title">
            {program.title}
          </h2>
          <button
            ref={closeButtonRef}
            className="program-modal-close"
            onClick={onClose}
            aria-label="Close program details"
            title="Close"
          >
            <span aria-hidden="true">✕</span>
          </button>
        </div>

        <div className="program-modal-body">
          <div className="program-modal-meta">
            <div className="program-meta-item">
              <span className="meta-label">Channel:</span>
              <span className="meta-value">{program.channelNumber}</span>
            </div>

            <div className="program-meta-item">
              <span className="meta-label">Time:</span>
              <span className="meta-value">
                {program.startTime.toLocaleTimeString("en-US", {
                  hour: "numeric",
                  minute: "2-digit",
                  hour12: true,
                })}
                {" - "}
                {program.endTime.toLocaleTimeString("en-US", {
                  hour: "numeric",
                  minute: "2-digit",
                  hour12: true,
                })}
              </span>
            </div>

            <div className="program-meta-item">
              <span className="meta-label">Duration:</span>
              <span className="meta-value">
                {formatDuration(program.durationSeconds)}
              </span>
            </div>

            <div className="program-meta-item">
              <span className="meta-label">Date:</span>
              <span className="meta-value">
                {program.startTime.toLocaleDateString("en-US", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                })}
              </span>
            </div>

            {program.genres.length > 0 && (
              <div className="program-meta-item">
                <span className="meta-label">Genre:</span>
                <span className="meta-value">{program.genres.join(", ")}</span>
              </div>
            )}

            {program.rating && (
              <div className="program-meta-item">
                <span className="meta-label">Rating:</span>
                <span className="meta-value">{program.rating}</span>
              </div>
            )}

            {program.isHD && (
              <div className="program-meta-item">
                <span className="hd-badge">HD</span>
              </div>
            )}

            <div className="program-meta-item">
              <span
                className={`status-badge ${
                  isLive ? "live" : isFuture ? "future" : "past"
                }`}
              >
                {isLive ? "Live Now" : isFuture ? "Upcoming" : "Ended"}
              </span>
            </div>
          </div>

          {program.description && (
            <div className="program-modal-description">
              <h3>Description</h3>
              <p>{program.description}</p>
            </div>
          )}
        </div>

        <div className="program-modal-actions">
          {isLive && onTuneToChannel && (
            <button
              className="btn btn-primary"
              onClick={() =>
                onTuneToChannel(program.channelNumber, program.startTime)
              }
              title="Tune to this channel now"
            >
              Watch Now
            </button>
          )}

          {isFuture && onSetReminder && (
            <button
              className="btn btn-secondary"
              onClick={() => onSetReminder(program)}
              title="Set a reminder for this program"
            >
              Set Reminder
            </button>
          )}

          {isFuture && onScheduleRecording && (
            <button
              className="btn btn-secondary"
              onClick={() => onScheduleRecording(program)}
              title="Schedule recording for this program"
            >
              Schedule Recording
            </button>
          )}

          {isPast && onTuneToChannel && (
            <button
              className="btn btn-secondary"
              onClick={() =>
                onTuneToChannel(program.channelNumber, program.startTime)
              }
              title="Tune to this channel"
            >
              Tune to Channel
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
