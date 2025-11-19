/**
 * Quick Actions Bar Component
 *
 * Provides quick access to common Monitor page actions via icon buttons.
 * Implements UI-DESIGN-SPEC.md Section 4 requirements.
 *
 * Features:
 * - Bookmark current frequency
 * - Start/stop recording
 * - Toggle grid overlay
 * - Show keyboard shortcuts help
 *
 * Accessibility:
 * - ARIA labels for all buttons
 * - Tooltips showing keyboard shortcuts
 * - Keyboard navigation support
 * - Visual state indicators (e.g., recording active)
 */

import {
  BookmarkSimpleIcon,
  GridFourIcon,
  QuestionIcon,
  RecordIcon,
} from "@phosphor-icons/react";
import { useState } from "react";

export interface QuickActionsProps {
  /** Current frequency in Hz */
  currentFrequencyHz: number;
  /** Whether recording is currently active */
  isRecording: boolean;
  /** Whether grid overlay is currently visible */
  showGrid: boolean;
  /** Callback to add current frequency to bookmarks */
  onBookmark: (frequencyHz: number) => void;
  /** Callback to toggle recording */
  onToggleRecording: () => void;
  /** Callback to toggle grid overlay */
  onToggleGrid: () => void;
  /** Callback to show help/shortcuts overlay */
  onShowHelp: () => void;
}

/**
 * Quick actions toolbar for Monitor page
 */
function QuickActions({
  currentFrequencyHz,
  isRecording,
  showGrid,
  onBookmark,
  onToggleRecording,
  onToggleGrid,
  onShowHelp,
}: QuickActionsProps): React.JSX.Element {
  const [tooltipVisible, setTooltipVisible] = useState<string | null>(null);

  return (
    <div
      className="quick-actions"
      role="toolbar"
      aria-label="Quick actions toolbar"
    >
      {/* Bookmark Button */}
      <button
        className="quick-action-btn"
        onClick={() => onBookmark(currentFrequencyHz)}
        onMouseEnter={() => setTooltipVisible("bookmark")}
        onMouseLeave={() => setTooltipVisible(null)}
        onFocus={() => setTooltipVisible("bookmark")}
        onBlur={() => setTooltipVisible(null)}
        aria-label="Bookmark current frequency (B)"
        title="Bookmark (B)"
      >
        <BookmarkSimpleIcon size={20} weight="regular" aria-hidden="true" />
        {tooltipVisible === "bookmark" && (
          <span className="quick-action-tooltip" role="tooltip">
            Bookmark (B)
          </span>
        )}
      </button>

      {/* Recording Button */}
      <button
        className={`quick-action-btn ${isRecording ? "active recording" : ""}`}
        onClick={onToggleRecording}
        onMouseEnter={() => setTooltipVisible("record")}
        onMouseLeave={() => setTooltipVisible(null)}
        onFocus={() => setTooltipVisible("record")}
        onBlur={() => setTooltipVisible(null)}
        aria-label={isRecording ? "Stop recording" : "Start recording"}
        aria-pressed={isRecording}
        title="Record (Ctrl/Cmd+S)"
      >
        <RecordIcon
          size={20}
          weight={isRecording ? "fill" : "regular"}
          aria-hidden="true"
        />
        {tooltipVisible === "record" && (
          <span className="quick-action-tooltip" role="tooltip">
            Record (Ctrl/Cmd+S)
          </span>
        )}
      </button>

      {/* Grid Toggle Button */}
      <button
        className={`quick-action-btn ${showGrid ? "active" : ""}`}
        onClick={onToggleGrid}
        onMouseEnter={() => setTooltipVisible("grid")}
        onMouseLeave={() => setTooltipVisible(null)}
        onFocus={() => setTooltipVisible("grid")}
        onBlur={() => setTooltipVisible(null)}
        aria-label={showGrid ? "Hide grid (G)" : "Show grid (G)"}
        aria-pressed={showGrid}
        title="Grid (G)"
      >
        <GridFourIcon size={20} weight="regular" aria-hidden="true" />
        {tooltipVisible === "grid" && (
          <span className="quick-action-tooltip" role="tooltip">
            Grid (G)
          </span>
        )}
      </button>

      {/* Help Button */}
      <button
        className="quick-action-btn"
        onClick={onShowHelp}
        onMouseEnter={() => setTooltipVisible("help")}
        onMouseLeave={() => setTooltipVisible(null)}
        onFocus={() => setTooltipVisible("help")}
        onBlur={() => setTooltipVisible(null)}
        aria-label="Show keyboard shortcuts (?)"
        title="Help (?)"
      >
        <QuestionIcon size={20} weight="regular" aria-hidden="true" />
        {tooltipVisible === "help" && (
          <span className="quick-action-tooltip" role="tooltip">
            Help (?)
          </span>
        )}
      </button>
    </div>
  );
}

export default QuickActions;
