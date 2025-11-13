/**
 * Program Cell Component
 *
 * Individual program cell in the EPG grid, displaying program info
 * within a time-based layout.
 */

import React from "react";
import type { EPGProgram } from "../../utils/epgStorage";

export interface ProgramCellProps {
  program: EPGProgram;
  slotDurationMinutes: number;
  gridStartTime: Date;
  onProgramClick: (program: EPGProgram) => void;
  isCurrentlyAiring?: boolean;
}

/**
 * Calculate program position and width in the grid
 */
function calculateProgramLayout(
  program: EPGProgram,
  gridStartTime: Date,
  slotDurationMinutes: number,
): { left: number; width: number } {
  const gridStartMs = gridStartTime.getTime();
  const programStartMs = program.startTime.getTime();
  const programEndMs = program.endTime.getTime();

  // Calculate offset from grid start in minutes
  const offsetMinutes = Math.max(0, (programStartMs - gridStartMs) / 60000);

  // Calculate program duration in minutes
  const durationMinutes = (programEndMs - programStartMs) / 60000;

  // Convert to grid units (slots)
  const left = offsetMinutes / slotDurationMinutes;
  const width = durationMinutes / slotDurationMinutes;

  return { left, width };
}

/**
 * Program Cell Component
 */
export function ProgramCell({
  program,
  slotDurationMinutes,
  gridStartTime,
  onProgramClick,
  isCurrentlyAiring = false,
}: ProgramCellProps): React.JSX.Element {
  const { left, width } = calculateProgramLayout(
    program,
    gridStartTime,
    slotDurationMinutes,
  );

  const handleClick = (): void => {
    onProgramClick(program);
  };

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onProgramClick(program);
    }
  };

  // Determine if program title should be displayed based on width
  const showFullTitle = width >= 2; // Show full title if at least 2 slots wide
  const showTime = width >= 3; // Show time if at least 3 slots wide

  return (
    <div
      className={`epg-program-cell ${isCurrentlyAiring ? "airing" : ""}`}
      style={{
        gridColumn: `${Math.ceil(left) + 1} / span ${Math.max(1, Math.ceil(width))}`,
      }}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      aria-label={`${program.title}, ${program.startTime.toLocaleTimeString()} on channel ${program.channelNumber}`}
      title={`${program.title}\n${program.startTime.toLocaleTimeString()} - ${program.endTime.toLocaleTimeString()}`}
    >
      <div className="program-cell-content">
        {showTime && (
          <div className="program-cell-time">
            {program.startTime.toLocaleTimeString("en-US", {
              hour: "numeric",
              minute: "2-digit",
              hour12: true,
            })}
          </div>
        )}
        <div className="program-cell-title">
          {showFullTitle ? program.title : program.title.substring(0, 20)}
        </div>
        {program.isHD && width >= 2 && (
          <span className="program-cell-hd">HD</span>
        )}
        {isCurrentlyAiring && (
          <span className="program-cell-live-indicator">●</span>
        )}
      </div>
    </div>
  );
}
