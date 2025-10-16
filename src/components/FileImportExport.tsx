/**
 * FileImportExport Component
 *
 * Provides drag-and-drop file upload and export functionality
 * for IQ recordings and preset collections.
 */

import { useState, useRef, DragEvent, ChangeEvent } from "react";
import {
  readFile,
  validateFile,
  importIQRecording,
  importPresets,
  IQRecording,
  PresetCollection,
} from "../utils/fileFormats";

export type FileImportResult =
  | { type: "iq-recording"; data: IQRecording }
  | { type: "presets"; data: PresetCollection };

type FileImportExportProps = {
  onImport: (result: FileImportResult) => void;
  onError: (error: string) => void;
  accept?: string;
  maxSizeMB?: number;
};

export default function FileImportExport({
  onImport,
  onError,
  accept = ".json,application/json",
  maxSizeMB = 100,
}: FileImportExportProps): React.JSX.Element {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragEnter = (e: DragEvent<HTMLDivElement>): void => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>): void => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>): void => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e: DragEvent<HTMLDivElement>): Promise<void> => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    const file = files[0];
    if (file) {
      await processFile(file);
    }
  };

  const handleFileSelect = async (
    e: ChangeEvent<HTMLInputElement>,
  ): Promise<void> => {
    const files = e.target.files;
    const file = files?.[0];
    if (file) {
      await processFile(file);
    }
    // Reset input so the same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const processFile = async (file: File): Promise<void> => {
    setIsProcessing(true);

    try {
      // Validate file
      const validation = validateFile(file, {
        maxSize: maxSizeMB * 1024 * 1024,
        allowedTypes: ["application/json"],
      });

      if (!validation.valid) {
        onError(validation.error || "Invalid file");
        return;
      }

      // Read file content
      const content = await readFile(file);

      // Try to parse as IQ recording first
      try {
        const iqRecording = importIQRecording(content);
        onImport({ type: "iq-recording", data: iqRecording });
        return;
      } catch {
        // Not an IQ recording, try presets
      }

      // Try to parse as presets
      try {
        const presets = importPresets(content);
        onImport({ type: "presets", data: presets });
        return;
      } catch {
        // Not a preset collection either
      }

      // Couldn't parse as either format
      onError("File format not recognized. Expected IQ recording or preset collection.");
    } catch (err) {
      onError(err instanceof Error ? err.message : "Failed to import file");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClick = (): void => {
    fileInputRef.current?.click();
  };

  return (
    <div className="file-import-export">
      <div
        className={`drop-zone ${isDragging ? "dragging" : ""} ${isProcessing ? "processing" : ""}`}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={handleClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleClick();
          }
        }}
        aria-label="Import file: click or drag and drop a JSON file containing IQ recordings or presets"
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          onChange={handleFileSelect}
          style={{ display: "none" }}
          aria-hidden="true"
        />
        {isProcessing ? (
          <div className="drop-zone-content">
            <span className="drop-zone-icon">⏳</span>
            <p className="drop-zone-text">Processing file...</p>
          </div>
        ) : (
          <div className="drop-zone-content">
            <span className="drop-zone-icon">📁</span>
            <p className="drop-zone-text">
              {isDragging
                ? "Drop file here"
                : "Click or drag & drop to import"}
            </p>
            <p className="drop-zone-hint">
              Supports IQ recordings and preset collections (JSON, max{" "}
              {maxSizeMB}MB)
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
