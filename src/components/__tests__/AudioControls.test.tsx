import { render, screen, fireEvent } from "@testing-library/react";
import AudioControls from "../AudioControls";

describe("AudioControls", () => {
  const mockHandlers = {
    onTogglePlay: jest.fn(),
    onVolumeChange: jest.fn(),
    onToggleMute: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Basic Rendering", () => {
    it("renders with default props", () => {
      render(
        <AudioControls
          isPlaying={false}
          volume={0.5}
          isMuted={false}
          signalType="FM"
          isAvailable={true}
          {...mockHandlers}
        />,
      );

      expect(screen.getByText("▶ Play Audio")).toBeInTheDocument();
      expect(screen.getByLabelText("Audio volume")).toBeInTheDocument();
      expect(screen.getByText("50%")).toBeInTheDocument();
    });

    it("shows playing state when isPlaying is true", () => {
      render(
        <AudioControls
          isPlaying={true}
          volume={0.7}
          isMuted={false}
          signalType="AM"
          isAvailable={true}
          {...mockHandlers}
        />,
      );

      expect(screen.getByText("⏸ Pause Audio")).toBeInTheDocument();
      expect(screen.getByText("🎵 Playing AM audio")).toBeInTheDocument();
    });

    it("shows paused state when isPlaying is false", () => {
      render(
        <AudioControls
          isPlaying={false}
          volume={0.5}
          isMuted={false}
          signalType="FM"
          isAvailable={true}
          {...mockHandlers}
        />,
      );

      expect(screen.getByText("Audio paused")).toBeInTheDocument();
    });
  });

  describe("Volume Control", () => {
    it("displays correct volume percentage", () => {
      render(
        <AudioControls
          isPlaying={false}
          volume={0.75}
          isMuted={false}
          signalType="FM"
          isAvailable={true}
          {...mockHandlers}
        />,
      );

      expect(screen.getByText("75%")).toBeInTheDocument();
    });

    it("displays 0% when muted", () => {
      render(
        <AudioControls
          isPlaying={false}
          volume={0.5}
          isMuted={true}
          signalType="FM"
          isAvailable={true}
          {...mockHandlers}
        />,
      );

      expect(screen.getByText("0%")).toBeInTheDocument();
    });

    it("calls onVolumeChange when slider is adjusted", () => {
      render(
        <AudioControls
          isPlaying={false}
          volume={0.5}
          isMuted={false}
          signalType="FM"
          isAvailable={true}
          {...mockHandlers}
        />,
      );

      const slider = screen.getByLabelText("Audio volume");
      fireEvent.change(slider, { target: { value: "0.8" } });

      expect(mockHandlers.onVolumeChange).toHaveBeenCalledWith(0.8);
      expect(mockHandlers.onVolumeChange).toHaveBeenCalledTimes(1);
    });
  });

  describe("Play/Pause Button", () => {
    it("calls onTogglePlay when play button is clicked", () => {
      render(
        <AudioControls
          isPlaying={false}
          volume={0.5}
          isMuted={false}
          signalType="FM"
          isAvailable={true}
          {...mockHandlers}
        />,
      );

      const playButton = screen.getByLabelText("Play audio");
      fireEvent.click(playButton);

      expect(mockHandlers.onTogglePlay).toHaveBeenCalledTimes(1);
    });

    it("calls onTogglePlay when pause button is clicked", () => {
      render(
        <AudioControls
          isPlaying={true}
          volume={0.5}
          isMuted={false}
          signalType="FM"
          isAvailable={true}
          {...mockHandlers}
        />,
      );

      const pauseButton = screen.getByLabelText("Pause audio");
      fireEvent.click(pauseButton);

      expect(mockHandlers.onTogglePlay).toHaveBeenCalledTimes(1);
    });

    it("disables play button when not available", () => {
      render(
        <AudioControls
          isPlaying={false}
          volume={0.5}
          isMuted={false}
          signalType="FM"
          isAvailable={false}
          {...mockHandlers}
        />,
      );

      const playButton = screen.getByLabelText("Play audio");
      expect(playButton).toBeDisabled();
    });
  });

  describe("Mute Button", () => {
    it("shows unmuted icon when not muted", () => {
      render(
        <AudioControls
          isPlaying={false}
          volume={0.5}
          isMuted={false}
          signalType="FM"
          isAvailable={true}
          {...mockHandlers}
        />,
      );

      expect(screen.getByText("🔊")).toBeInTheDocument();
    });

    it("shows muted icon when muted", () => {
      render(
        <AudioControls
          isPlaying={false}
          volume={0.5}
          isMuted={true}
          signalType="FM"
          isAvailable={true}
          {...mockHandlers}
        />,
      );

      expect(screen.getByText("🔇")).toBeInTheDocument();
    });

    it("calls onToggleMute when clicked", () => {
      render(
        <AudioControls
          isPlaying={false}
          volume={0.5}
          isMuted={false}
          signalType="FM"
          isAvailable={true}
          {...mockHandlers}
        />,
      );

      const muteButton = screen.getByLabelText("Mute audio");
      fireEvent.click(muteButton);

      expect(mockHandlers.onToggleMute).toHaveBeenCalledTimes(1);
    });

    it("disables mute button when not available", () => {
      render(
        <AudioControls
          isPlaying={false}
          volume={0.5}
          isMuted={false}
          signalType="FM"
          isAvailable={false}
          {...mockHandlers}
        />,
      );

      const muteButton = screen.getByLabelText("Mute audio");
      expect(muteButton).toBeDisabled();
    });
  });

  describe("Accessibility", () => {
    it("has proper ARIA labels for play button", () => {
      render(
        <AudioControls
          isPlaying={false}
          volume={0.5}
          isMuted={false}
          signalType="FM"
          isAvailable={true}
          {...mockHandlers}
        />,
      );

      const playButton = screen.getByLabelText("Play audio");
      expect(playButton).toHaveAttribute("title");
    });

    it("has proper ARIA labels for volume slider", () => {
      render(
        <AudioControls
          isPlaying={false}
          volume={0.6}
          isMuted={false}
          signalType="FM"
          isAvailable={true}
          {...mockHandlers}
        />,
      );

      const slider = screen.getByLabelText("Audio volume");
      expect(slider).toHaveAttribute("aria-valuemin", "0");
      expect(slider).toHaveAttribute("aria-valuemax", "100");
      expect(slider).toHaveAttribute("aria-valuenow", "60");
      expect(slider).toHaveAttribute("aria-valuetext", "60 percent");
    });

    it("has live region for status updates", () => {
      render(
        <AudioControls
          isPlaying={true}
          volume={0.5}
          isMuted={false}
          signalType="FM"
          isAvailable={true}
          {...mockHandlers}
        />,
      );

      const status = screen.getByRole("status");
      expect(status).toHaveAttribute("aria-live", "polite");
    });

    it("has proper role for controls group", () => {
      render(
        <AudioControls
          isPlaying={false}
          volume={0.5}
          isMuted={false}
          signalType="FM"
          isAvailable={true}
          {...mockHandlers}
        />,
      );

      const controls = screen.getByRole("group");
      expect(controls).toHaveAttribute("aria-label", "Audio playback controls");
    });
  });

  describe("Signal Type Integration", () => {
    it("displays FM in status when playing FM", () => {
      render(
        <AudioControls
          isPlaying={true}
          volume={0.5}
          isMuted={false}
          signalType="FM"
          isAvailable={true}
          {...mockHandlers}
        />,
      );

      expect(screen.getByText("🎵 Playing FM audio")).toBeInTheDocument();
    });

    it("displays AM in status when playing AM", () => {
      render(
        <AudioControls
          isPlaying={true}
          volume={0.5}
          isMuted={false}
          signalType="AM"
          isAvailable={true}
          {...mockHandlers}
        />,
      );

      expect(screen.getByText("🎵 Playing AM audio")).toBeInTheDocument();
    });

    it("displays P25 in status when playing P25", () => {
      render(
        <AudioControls
          isPlaying={true}
          volume={0.5}
          isMuted={false}
          signalType="P25"
          isAvailable={true}
          {...mockHandlers}
        />,
      );

      expect(screen.getByText("🎵 Playing P25 audio")).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("handles volume at minimum (0)", () => {
      render(
        <AudioControls
          isPlaying={false}
          volume={0}
          isMuted={false}
          signalType="FM"
          isAvailable={true}
          {...mockHandlers}
        />,
      );

      expect(screen.getByText("0%")).toBeInTheDocument();
    });

    it("handles volume at maximum (1)", () => {
      render(
        <AudioControls
          isPlaying={false}
          volume={1}
          isMuted={false}
          signalType="FM"
          isAvailable={true}
          {...mockHandlers}
        />,
      );

      expect(screen.getByText("100%")).toBeInTheDocument();
    });

    it("disables controls when device is not available", () => {
      render(
        <AudioControls
          isPlaying={false}
          volume={0.5}
          isMuted={false}
          signalType="FM"
          isAvailable={false}
          {...mockHandlers}
        />,
      );

      const playButton = screen.getByLabelText("Play audio");
      const muteButton = screen.getByLabelText("Mute audio");
      const slider = screen.getByLabelText("Audio volume");

      expect(playButton).toBeDisabled();
      expect(muteButton).toBeDisabled();
      expect(slider).toBeDisabled();
    });
  });
});
