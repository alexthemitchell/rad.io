/**
 * Program Grid Component
 *
 * Time-based grid view of EPG data showing multiple channels
 * and their programs across a time range.
 */

import React, { useState, useEffect, useRef, useMemo } from "react";
import { ChannelRow } from "./ChannelRow";
import type { EPGChannelData, EPGProgram } from "../../utils/epgStorage";

export interface ProgramGridProps {
  channels: EPGChannelData[];
  slotDurationMinutes?: number;
  visibleHours?: number;
  onProgramClick: (program: EPGProgram) => void;
}

/**
 * Generate time slot headers
 */
function generateTimeSlots(
  startTime: Date,
  endTime: Date,
  slotDurationMinutes: number,
): Date[] {
  const slots: Date[] = [];
  const current = new Date(startTime);

  while (current < endTime) {
    slots.push(new Date(current));
    current.setMinutes(current.getMinutes() + slotDurationMinutes);
  }

  return slots;
}

/**
 * Program Grid Component
 */
export function ProgramGrid({
  channels,
  slotDurationMinutes = 30,
  visibleHours = 3,
  onProgramClick,
}: ProgramGridProps): React.JSX.Element {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [gridStartTime, setGridStartTime] = useState(() => {
    const now = new Date();
    // Round down to nearest slot duration
    now.setMinutes(
      Math.floor(now.getMinutes() / slotDurationMinutes) * slotDurationMinutes,
      0,
      0,
    );
    return now;
  });

  const gridRef = useRef<HTMLDivElement>(null);
  const currentTimeMarkerRef = useRef<HTMLDivElement>(null);

  // Calculate grid end time
  const gridEndTime = useMemo(
    () => new Date(gridStartTime.getTime() + visibleHours * 60 * 60 * 1000),
    [gridStartTime, visibleHours],
  );

  // Generate time slots
  const timeSlots = useMemo(
    () => generateTimeSlots(gridStartTime, gridEndTime, slotDurationMinutes),
    [gridStartTime, gridEndTime, slotDurationMinutes],
  );

  // Update current time every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);

    return (): void => {
      clearInterval(interval);
    };
  }, []);

  // Scroll to current time on mount
  useEffect(() => {
    if (currentTimeMarkerRef.current && gridRef.current) {
      const markerOffset = currentTimeMarkerRef.current.offsetLeft;
      const gridWidth = gridRef.current.clientWidth;
      gridRef.current.scrollLeft = markerOffset - gridWidth / 4;
    }
  }, []);

  // Navigate time
  const navigateTime = (hours: number): void => {
    const newStartTime = new Date(gridStartTime);
    newStartTime.setHours(newStartTime.getHours() + hours);
    setGridStartTime(newStartTime);
  };

  const goToNow = (): void => {
    const now = new Date();
    now.setMinutes(
      Math.floor(now.getMinutes() / slotDurationMinutes) * slotDurationMinutes,
      0,
      0,
    );
    setGridStartTime(now);
  };

  // Calculate current time marker position
  const currentTimeOffset =
    (currentTime.getTime() - gridStartTime.getTime()) / 60000;
  const currentTimePosition = currentTimeOffset / slotDurationMinutes;
  const showCurrentTimeMarker =
    currentTime >= gridStartTime && currentTime < gridEndTime;

  return (
    <div className="epg-grid-container">
      <div className="epg-grid-controls">
        <button
          className="btn btn-secondary"
          onClick={() => navigateTime(-3)}
          title="Previous 3 hours"
        >
          ◀ Earlier
        </button>
        <button className="btn btn-primary" onClick={goToNow} title="Go to now">
          Now
        </button>
        <button
          className="btn btn-secondary"
          onClick={() => navigateTime(3)}
          title="Next 3 hours"
        >
          Later ▶
        </button>
      </div>

      <div className="epg-grid" ref={gridRef}>
        <div className="epg-time-header">
          <div className="epg-channel-header-spacer" />
          <div
            className="epg-time-slots"
            style={{
              gridTemplateColumns: `repeat(${timeSlots.length}, 1fr)`,
            }}
          >
            {timeSlots.map((slot, index) => (
              <div key={index} className="epg-time-slot">
                {slot.toLocaleTimeString("en-US", {
                  hour: "numeric",
                  minute: "2-digit",
                  hour12: true,
                })}
              </div>
            ))}
          </div>
        </div>

        <div className="epg-channels-container">
          {channels.length === 0 ? (
            <div className="epg-no-data">
              <p>No EPG data available</p>
              <p className="epg-no-data-hint">
                EPG data is populated when watching ATSC broadcasts
              </p>
            </div>
          ) : (
            channels.map((channel) => (
              <ChannelRow
                key={channel.sourceId}
                channel={channel}
                gridStartTime={gridStartTime}
                gridEndTime={gridEndTime}
                slotDurationMinutes={slotDurationMinutes}
                onProgramClick={onProgramClick}
                currentTime={currentTime}
              />
            ))
          )}

          {showCurrentTimeMarker && (
            <div
              ref={currentTimeMarkerRef}
              className="epg-current-time-marker"
              style={{
                left: `calc(${currentTimePosition} * (100% / ${timeSlots.length}))`,
              }}
              aria-label="Current time"
            />
          )}
        </div>
      </div>
    </div>
  );
}
