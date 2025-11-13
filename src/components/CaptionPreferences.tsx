/**
 * Caption Preferences Component
 *
 * UI component for configuring closed caption preferences including
 * service selection, font size, colors, and styling options.
 */

import React, { useState } from "react";
import type {
  CaptionDecoderConfig,
  CaptionService,
} from "../decoders/CEA708Decoder";

/**
 * Caption preferences props
 */
export interface CaptionPreferencesProps {
  config: CaptionDecoderConfig;
  availableServices: CaptionService[];
  currentService: CaptionService | null;
  onConfigChange: (config: CaptionDecoderConfig) => void;
  onServiceChange: (service: CaptionService) => void;
}

/**
 * Caption Preferences Component
 */
export function CaptionPreferences({
  config,
  availableServices,
  currentService,
  onConfigChange,
  onServiceChange,
}: CaptionPreferencesProps): React.JSX.Element {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleFontSizeChange = (size: number): void => {
    onConfigChange({ ...config, fontSize: size });
  };

  const handleTextColorChange = (color: string): void => {
    onConfigChange({ ...config, textColor: color });
  };

  const handleBackgroundColorChange = (color: string): void => {
    onConfigChange({ ...config, backgroundColor: color });
  };

  const handleEdgeStyleChange = (
    style: "none" | "raised" | "depressed" | "uniform" | "drop_shadow",
  ): void => {
    onConfigChange({ ...config, edgeStyle: style });
  };

  const handleOpacityChange = (opacity: number): void => {
    onConfigChange({ ...config, windowOpacity: opacity });
  };

  return (
    <div className="caption-preferences">
      <button
        className="preferences-toggle"
        onClick={() => setIsExpanded(!isExpanded)}
        aria-expanded={isExpanded}
        aria-controls="caption-settings"
      >
        <span>Caption Settings</span>
        <span className={`arrow ${isExpanded ? "expanded" : ""}`}>▼</span>
      </button>

      {isExpanded && (
        <div id="caption-settings" className="preferences-panel">
          {/* Service Selection */}
          {availableServices.length > 0 && (
            <div className="preference-group">
              <label htmlFor="caption-service">
                Caption Service / Language
              </label>
              <select
                id="caption-service"
                value={currentService ?? 1}
                onChange={(e) =>
                  onServiceChange(Number(e.target.value) as CaptionService)
                }
              >
                {availableServices.map((service) => (
                  <option key={service} value={service}>
                    Service {service}
                    {service === 1 && " (Primary)"}
                    {service === 2 && " (Secondary)"}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Font Size */}
          <div className="preference-group">
            <label htmlFor="font-size">
              Font Size: {config.fontSize ?? 20}px
            </label>
            <input
              type="range"
              id="font-size"
              min="12"
              max="36"
              step="2"
              value={config.fontSize ?? 20}
              onChange={(e) => handleFontSizeChange(Number(e.target.value))}
            />
          </div>

          {/* Text Color */}
          <div className="preference-group">
            <label htmlFor="text-color">Text Color</label>
            <div className="color-selector">
              <input
                type="color"
                id="text-color"
                value={config.textColor ?? "#ffffff"}
                onChange={(e) => handleTextColorChange(e.target.value)}
              />
              <button
                className="preset-color"
                onClick={() => handleTextColorChange("#ffffff")}
                title="White"
                style={{ backgroundColor: "#ffffff" }}
              />
              <button
                className="preset-color"
                onClick={() => handleTextColorChange("#ffff00")}
                title="Yellow"
                style={{ backgroundColor: "#ffff00" }}
              />
              <button
                className="preset-color"
                onClick={() => handleTextColorChange("#00ff00")}
                title="Green"
                style={{ backgroundColor: "#00ff00" }}
              />
              <button
                className="preset-color"
                onClick={() => handleTextColorChange("#00ffff")}
                title="Cyan"
                style={{ backgroundColor: "#00ffff" }}
              />
            </div>
          </div>

          {/* Background Color */}
          <div className="preference-group">
            <label htmlFor="background-color">Background Color</label>
            <div className="color-selector">
              <input
                type="color"
                id="background-color"
                value={config.backgroundColor ?? "#000000"}
                onChange={(e) => handleBackgroundColorChange(e.target.value)}
              />
              <button
                className="preset-color"
                onClick={() => handleBackgroundColorChange("#000000")}
                title="Black"
                style={{ backgroundColor: "#000000" }}
              />
              <button
                className="preset-color"
                onClick={() => handleBackgroundColorChange("#808080")}
                title="Gray"
                style={{ backgroundColor: "#808080" }}
              />
              <button
                className="preset-color"
                onClick={() => handleBackgroundColorChange("#000080")}
                title="Navy"
                style={{ backgroundColor: "#000080" }}
              />
            </div>
          </div>

          {/* Edge Style */}
          <div className="preference-group">
            <label htmlFor="edge-style">Text Edge</label>
            <select
              id="edge-style"
              value={config.edgeStyle ?? "drop_shadow"}
              onChange={(e) =>
                handleEdgeStyleChange(
                  e.target.value as
                    | "none"
                    | "raised"
                    | "depressed"
                    | "uniform"
                    | "drop_shadow",
                )
              }
            >
              <option value="none">None</option>
              <option value="drop_shadow">Drop Shadow</option>
              <option value="raised">Raised</option>
              <option value="depressed">Depressed</option>
              <option value="uniform">Uniform</option>
            </select>
          </div>

          {/* Opacity */}
          <div className="preference-group">
            <label htmlFor="opacity">
              Background Opacity:{" "}
              {Math.round((config.windowOpacity ?? 0.8) * 100)}%
            </label>
            <input
              type="range"
              id="opacity"
              min="0"
              max="1"
              step="0.1"
              value={config.windowOpacity ?? 0.8}
              onChange={(e) => handleOpacityChange(Number(e.target.value))}
            />
          </div>
        </div>
      )}

      <style>{`
        .caption-preferences {
          margin: 1rem 0;
        }

        .preferences-toggle {
          width: 100%;
          padding: 0.75rem 1rem;
          background: var(--surface-color, #2a2a2a);
          border: 1px solid var(--border-color, #444);
          border-radius: 4px;
          color: var(--text-color, #fff);
          font-size: 1rem;
          cursor: pointer;
          display: flex;
          justify-content: space-between;
          align-items: center;
          transition: background-color 0.2s;
        }

        .preferences-toggle:hover {
          background: var(--surface-hover, #333);
        }

        .preferences-toggle .arrow {
          transition: transform 0.2s;
        }

        .preferences-toggle .arrow.expanded {
          transform: rotate(180deg);
        }

        .preferences-panel {
          margin-top: 1rem;
          padding: 1rem;
          background: var(--surface-color, #2a2a2a);
          border: 1px solid var(--border-color, #444);
          border-radius: 4px;
        }

        .preference-group {
          margin-bottom: 1.5rem;
        }

        .preference-group:last-child {
          margin-bottom: 0;
        }

        .preference-group label {
          display: block;
          margin-bottom: 0.5rem;
          color: var(--text-color, #fff);
          font-weight: 500;
        }

        .preference-group select,
        .preference-group input[type="range"] {
          width: 100%;
        }

        .preference-group select {
          padding: 0.5rem;
          background: var(--input-bg, #1a1a1a);
          border: 1px solid var(--border-color, #444);
          border-radius: 4px;
          color: var(--text-color, #fff);
          font-size: 1rem;
        }

        .preference-group input[type="range"] {
          accent-color: var(--accent-color, #3b82f6);
        }

        .color-selector {
          display: flex;
          gap: 0.5rem;
          align-items: center;
        }

        .color-selector input[type="color"] {
          width: 60px;
          height: 36px;
          border: 1px solid var(--border-color, #444);
          border-radius: 4px;
          cursor: pointer;
        }

        .preset-color {
          width: 32px;
          height: 32px;
          border: 2px solid var(--border-color, #444);
          border-radius: 4px;
          cursor: pointer;
          transition: transform 0.2s;
        }

        .preset-color:hover {
          transform: scale(1.1);
        }

        .preset-color:active {
          transform: scale(0.95);
        }
      `}</style>
    </div>
  );
}
