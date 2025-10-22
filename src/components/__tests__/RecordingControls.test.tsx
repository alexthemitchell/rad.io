/**
 * Tests for RecordingControls component
 */

import { render, screen, fireEvent } from "@testing-library/react";
import RecordingControls from "../RecordingControls";
import type { IQRecording } from "../../utils/iqRecorder";

describe("RecordingControls", () => {
  const mockCallbacks = {
    onStartRecording: jest.fn(),
    onStopRecording: jest.fn(),
    onSaveRecording: jest.fn(),
    onLoadRecording: jest.fn(),
    onStartPlayback: jest.fn(),
    onPausePlayback: jest.fn(),
    onStopPlayback: jest.fn(),
    onSeek: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Idle State", () => {
    test("should render with idle state", () => {
      render(
        <RecordingControls
          recordingState="idle"
          canRecord={true}
          canPlayback={false}
          isPlaying={false}
          duration={0}
          sampleCount={0}
          {...mockCallbacks}
        />,
      );

      expect(screen.getByText(/○ Idle/)).toBeInTheDocument();
      expect(screen.getByText(/● Record/)).toBeInTheDocument();
    });

    test("should disable record button when cannot record", () => {
      render(
        <RecordingControls
          recordingState="idle"
          canRecord={false}
          canPlayback={false}
          isPlaying={false}
          duration={0}
          sampleCount={0}
          {...mockCallbacks}
        />,
      );

      const recordBtn = screen.getByText(/● Record/);
      expect(recordBtn).toBeDisabled();
    });

    test("should call onStartRecording when record button clicked", () => {
      render(
        <RecordingControls
          recordingState="idle"
          canRecord={true}
          canPlayback={false}
          isPlaying={false}
          duration={0}
          sampleCount={0}
          {...mockCallbacks}
        />,
      );

      const recordBtn = screen.getByText(/● Record/);
      fireEvent.click(recordBtn);

      expect(mockCallbacks.onStartRecording).toHaveBeenCalledTimes(1);
    });

    test("should disable save button when no samples", () => {
      render(
        <RecordingControls
          recordingState="idle"
          canRecord={true}
          canPlayback={false}
          isPlaying={false}
          duration={0}
          sampleCount={0}
          {...mockCallbacks}
        />,
      );

      const saveBtn = screen.getByText(/💾 Save/);
      expect(saveBtn).toBeDisabled();
    });
  });

  describe("Recording State", () => {
    test("should render with recording state", () => {
      render(
        <RecordingControls
          recordingState="recording"
          canRecord={true}
          canPlayback={false}
          isPlaying={false}
          duration={5.5}
          sampleCount={11264000}
          {...mockCallbacks}
        />,
      );

      expect(screen.getByText(/● Recording/)).toBeInTheDocument();
      expect(screen.getByText(/■ Stop Recording/)).toBeInTheDocument();
      expect(screen.getByText(/00:05/)).toBeInTheDocument();
      expect(screen.getByText(/11,264,000/)).toBeInTheDocument();
    });

    test("should call onStopRecording when stop button clicked", () => {
      render(
        <RecordingControls
          recordingState="recording"
          canRecord={true}
          canPlayback={false}
          isPlaying={false}
          duration={5.5}
          sampleCount={11264000}
          {...mockCallbacks}
        />,
      );

      const stopBtn = screen.getByText(/■ Stop Recording/);
      fireEvent.click(stopBtn);

      expect(mockCallbacks.onStopRecording).toHaveBeenCalledTimes(1);
    });

    test("should disable save button during recording", () => {
      render(
        <RecordingControls
          recordingState="recording"
          canRecord={true}
          canPlayback={false}
          isPlaying={false}
          duration={5.5}
          sampleCount={11264000}
          {...mockCallbacks}
        />,
      );

      const saveBtn = screen.getByText(/💾 Save/);
      expect(saveBtn).toBeDisabled();
    });
  });

  describe("Playback State", () => {
    test("should render with playback state", () => {
      render(
        <RecordingControls
          recordingState="playback"
          canRecord={false}
          canPlayback={true}
          isPlaying={false}
          duration={10}
          playbackProgress={0.5}
          playbackTime={5}
          sampleCount={20480000}
          {...mockCallbacks}
        />,
      );

      expect(screen.getByText(/▶ Playback/)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "▶ Play" })).toBeInTheDocument();
      expect(screen.getByText(/00:05/)).toBeInTheDocument();
      // Duration appears twice - once in info and once in playback time display
      expect(screen.getAllByText(/00:10/)).toHaveLength(2);
    });

    test("should show pause button when playing", () => {
      render(
        <RecordingControls
          recordingState="playback"
          canRecord={false}
          canPlayback={true}
          isPlaying={true}
          duration={10}
          playbackProgress={0.5}
          playbackTime={5}
          sampleCount={20480000}
          {...mockCallbacks}
        />,
      );

      expect(screen.getByText(/⏸ Pause/)).toBeInTheDocument();
    });

    test("should call onStartPlayback when play button clicked", () => {
      render(
        <RecordingControls
          recordingState="playback"
          canRecord={false}
          canPlayback={true}
          isPlaying={false}
          duration={10}
          playbackProgress={0}
          playbackTime={0}
          sampleCount={20480000}
          {...mockCallbacks}
        />,
      );

      const playBtn = screen.getByRole("button", { name: "▶ Play" });
      fireEvent.click(playBtn);

      expect(mockCallbacks.onStartPlayback).toHaveBeenCalledTimes(1);
    });

    test("should call onPausePlayback when pause button clicked", () => {
      render(
        <RecordingControls
          recordingState="playback"
          canRecord={false}
          canPlayback={true}
          isPlaying={true}
          duration={10}
          playbackProgress={0.5}
          playbackTime={5}
          sampleCount={20480000}
          {...mockCallbacks}
        />,
      );

      const pauseBtn = screen.getByText(/⏸ Pause/);
      fireEvent.click(pauseBtn);

      expect(mockCallbacks.onPausePlayback).toHaveBeenCalledTimes(1);
    });

    test("should call onStopPlayback when stop button clicked", () => {
      render(
        <RecordingControls
          recordingState="playback"
          canRecord={false}
          canPlayback={true}
          isPlaying={true}
          duration={10}
          playbackProgress={0.5}
          playbackTime={5}
          sampleCount={20480000}
          {...mockCallbacks}
        />,
      );

      const stopBtn = screen.getByText(/◼ Stop & Return to Live/);
      fireEvent.click(stopBtn);

      expect(mockCallbacks.onStopPlayback).toHaveBeenCalledTimes(1);
    });

    test("should call onSeek when progress bar clicked", () => {
      render(
        <RecordingControls
          recordingState="playback"
          canRecord={false}
          canPlayback={true}
          isPlaying={false}
          duration={10}
          playbackProgress={0.5}
          playbackTime={5}
          sampleCount={20480000}
          {...mockCallbacks}
        />,
      );

      const progressBar = screen.getByRole("progressbar");

      // Mock getBoundingClientRect
      Element.prototype.getBoundingClientRect = jest.fn(() => ({
        width: 400,
        height: 8,
        top: 0,
        left: 0,
        bottom: 8,
        right: 400,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }));

      // Simulate click at 75% position
      fireEvent.click(progressBar, { clientX: 300, clientY: 4 });

      expect(mockCallbacks.onSeek).toHaveBeenCalledWith(0.75);
    });

    test("should enable save button in playback mode", () => {
      render(
        <RecordingControls
          recordingState="playback"
          canRecord={false}
          canPlayback={true}
          isPlaying={false}
          duration={10}
          sampleCount={20480000}
          {...mockCallbacks}
        />,
      );

      const saveBtn = screen.getByText(/💾 Save/);
      expect(saveBtn).not.toBeDisabled();
    });
  });

  describe("Save Dialog", () => {
    test("should open save dialog when save button clicked", () => {
      render(
        <RecordingControls
          recordingState="idle"
          canRecord={true}
          canPlayback={false}
          isPlaying={false}
          duration={10}
          sampleCount={20480000}
          {...mockCallbacks}
        />,
      );

      const saveBtn = screen.getByText(/💾 Save/);
      fireEvent.click(saveBtn);

      expect(screen.getByText(/Save Recording/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Filename:/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Format:/)).toBeInTheDocument();
    });

    test("should call onSaveRecording with correct parameters", () => {
      render(
        <RecordingControls
          recordingState="idle"
          canRecord={true}
          canPlayback={false}
          isPlaying={false}
          duration={10}
          sampleCount={20480000}
          {...mockCallbacks}
        />,
      );

      // Open dialog
      const saveBtn = screen.getByText(/💾 Save/);
      fireEvent.click(saveBtn);

      // Enter filename
      const filenameInput = screen.getByLabelText(/Filename:/);
      fireEvent.change(filenameInput, { target: { value: "test-recording" } });

      // Select format
      const formatSelect = screen.getByLabelText(/Format:/);
      fireEvent.change(formatSelect, { target: { value: "json" } });

      // Click save
      const dialogSaveBtn = screen.getByRole("button", { name: /^Save$/ });
      fireEvent.click(dialogSaveBtn);

      expect(mockCallbacks.onSaveRecording).toHaveBeenCalledWith(
        "test-recording",
        "json",
      );
    });

    test("should close dialog when cancel clicked", () => {
      render(
        <RecordingControls
          recordingState="idle"
          canRecord={true}
          canPlayback={false}
          isPlaying={false}
          duration={10}
          sampleCount={20480000}
          {...mockCallbacks}
        />,
      );

      // Open dialog
      const saveBtn = screen.getByText(/💾 Save/);
      fireEvent.click(saveBtn);

      // Click cancel
      const cancelBtn = screen.getByText(/Cancel/);
      fireEvent.click(cancelBtn);

      // Dialog should be closed
      expect(screen.queryByText(/Save Recording/)).not.toBeInTheDocument();
    });

    test("should alert when trying to save without filename", () => {
      // Mock alert
      const alertMock = jest.spyOn(window, "alert").mockImplementation();

      render(
        <RecordingControls
          recordingState="idle"
          canRecord={true}
          canPlayback={false}
          isPlaying={false}
          duration={10}
          sampleCount={20480000}
          {...mockCallbacks}
        />,
      );

      // Open dialog
      const saveBtn = screen.getByText(/💾 Save/);
      fireEvent.click(saveBtn);

      // Click save without entering filename
      const dialogSaveBtn = screen.getByRole("button", { name: /^Save$/ });
      fireEvent.click(dialogSaveBtn);

      expect(alertMock).toHaveBeenCalledWith("Please enter a filename");
      expect(mockCallbacks.onSaveRecording).not.toHaveBeenCalled();

      alertMock.mockRestore();
    });
  });

  describe("Time Formatting", () => {
    test("should format time correctly", () => {
      render(
        <RecordingControls
          recordingState="idle"
          canRecord={true}
          canPlayback={false}
          isPlaying={false}
          duration={125.7} // 2 minutes 5 seconds
          sampleCount={257433600}
          {...mockCallbacks}
        />,
      );

      expect(screen.getByText(/02:05/)).toBeInTheDocument();
    });

    test("should format zero time correctly", () => {
      render(
        <RecordingControls
          recordingState="idle"
          canRecord={true}
          canPlayback={false}
          isPlaying={false}
          duration={0}
          sampleCount={0}
          {...mockCallbacks}
        />,
      );

      expect(screen.getByText(/00:00/)).toBeInTheDocument();
    });
  });

  describe("Accessibility", () => {
    test("should have proper ARIA labels", () => {
      render(
        <RecordingControls
          recordingState="idle"
          canRecord={true}
          canPlayback={false}
          isPlaying={false}
          duration={0}
          sampleCount={0}
          {...mockCallbacks}
        />,
      );

      expect(
        screen.getByLabelText("Recording controls"),
      ).toBeInTheDocument();
      expect(screen.getByLabelText("Load recording file")).toBeInTheDocument();
    });

    test("should have proper button titles", () => {
      render(
        <RecordingControls
          recordingState="idle"
          canRecord={true}
          canPlayback={false}
          isPlaying={false}
          duration={0}
          sampleCount={0}
          {...mockCallbacks}
        />,
      );

      const recordBtn = screen.getByText(/● Record/);
      expect(recordBtn).toHaveAttribute(
        "title",
        "Start recording IQ samples",
      );
    });
  });
});
