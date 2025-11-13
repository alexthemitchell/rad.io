/**
 * Channel Row Component
 *
 * Displays a single channel's programs in the EPG grid.
 */

import React from "react";
import { ProgramCell } from "./ProgramCell";
import type { EPGChannelData, EPGProgram } from "../../utils/epgStorage";

export interface ChannelRowProps {
  channel: EPGChannelData;
  gridStartTime: Date;
  gridEndTime: Date;
  slotDurationMinutes: number;
  onProgramClick: (program: EPGProgram) => void;
  currentTime: Date;
}

/**
 * Filter programs that appear in the current time window
 */
function getVisiblePrograms(
  programs: EPGProgram[],
  startTime: Date,
  endTime: Date,
): EPGProgram[] {
  return programs.filter((program) => {
    // Include if program overlaps with the time window
    return program.endTime > startTime && program.startTime < endTime;
  });
}

/**
 * Channel Row Component
 */
export function ChannelRow({
  channel,
  gridStartTime,
  gridEndTime,
  slotDurationMinutes,
  onProgramClick,
  currentTime,
}: ChannelRowProps): React.JSX.Element {
  const visiblePrograms = getVisiblePrograms(
    channel.programs,
    gridStartTime,
    gridEndTime,
  );

  return (
    <div className="epg-channel-row">
      <div className="epg-channel-header">
        <div className="channel-number">{channel.channelNumber}</div>
        <div className="channel-name">{channel.channelName}</div>
      </div>
      <div className="epg-channel-programs">
        {visiblePrograms.length === 0 ? (
          <div className="epg-no-programs">
            No program information available
          </div>
        ) : (
          visiblePrograms.map((program) => {
            const isCurrentlyAiring =
              program.startTime <= currentTime && program.endTime > currentTime;

            return (
              <ProgramCell
                key={program.eventId}
                program={program}
                slotDurationMinutes={slotDurationMinutes}
                gridStartTime={gridStartTime}
                onProgramClick={onProgramClick}
                isCurrentlyAiring={isCurrentlyAiring}
              />
            );
          })
        )}
      </div>
    </div>
  );
}
