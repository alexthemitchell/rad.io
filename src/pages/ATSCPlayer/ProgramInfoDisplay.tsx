/**
 * Program Info Display Component
 *
 * Shows current program information including title, description, start time, and duration.
 */

import React from "react";

interface ProgramInfo {
  title: string;
  description: string;
  startTime?: Date;
  duration?: number;
}

interface ProgramInfoDisplayProps {
  programInfo: ProgramInfo | null;
}

export function ProgramInfoDisplay({
  programInfo,
}: ProgramInfoDisplayProps): React.JSX.Element {
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
