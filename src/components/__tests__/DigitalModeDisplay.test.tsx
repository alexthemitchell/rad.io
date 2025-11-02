/**
 * Digital Mode Display Component Tests
 */

import { render, screen, fireEvent } from "@testing-library/react";
import { DigitalModeDisplay } from "../DigitalModeDisplay";
import type { DigitalModeMessage } from "../DigitalModeDisplay";

describe("DigitalModeDisplay", () => {
  const mockMessages: DigitalModeMessage[] = [
    {
      timestamp: new Date("2024-01-01T12:00:00Z"),
      mode: "PSK31",
      text: "CQ CQ DE TEST TEST K",
      snr: -5.5,
      frequency: 14070.5,
    },
    {
      timestamp: new Date("2024-01-01T12:00:15Z"),
      mode: "PSK31",
      text: "TEST DE W1AW W1AW K",
      snr: 10.2,
      frequency: 14070.5,
    },
  ];

  describe("No Mode Selected", () => {
    it("should display no mode message when currentMode is null", () => {
      render(
        <DigitalModeDisplay
          messages={[]}
          currentMode={null}
          isActive={false}
        />,
      );

      expect(screen.getByText("No Digital Mode Selected")).toBeInTheDocument();
      expect(
        screen.getByText("Select PSK31, FT8, or RTTY from the mode selector"),
      ).toBeInTheDocument();
    });
  });

  describe("Mode Selected but Inactive", () => {
    it("should display inactive message when isActive is false", () => {
      render(
        <DigitalModeDisplay
          messages={[]}
          currentMode="PSK31"
          isActive={false}
        />,
      );

      expect(screen.getByText("PSK31 Decoder Inactive")).toBeInTheDocument();
      expect(
        screen.getByText("Activate the decoder to receive messages"),
      ).toBeInTheDocument();
    });
  });

  describe("Active Mode with No Messages", () => {
    it("should display waiting message when active but no messages", () => {
      render(
        <DigitalModeDisplay
          messages={[]}
          currentMode="PSK31"
          isActive={true}
        />,
      );

      expect(
        screen.getByText("Waiting for PSK31 signals..."),
      ).toBeInTheDocument();
    });

    it("should show mode badge", () => {
      render(
        <DigitalModeDisplay
          messages={[]}
          currentMode="PSK31"
          isActive={true}
        />,
      );

      expect(screen.getByText("PSK31")).toBeInTheDocument();
      expect(screen.getByText("Decoded Messages")).toBeInTheDocument();
    });

    it("should show message count of 0", () => {
      render(
        <DigitalModeDisplay
          messages={[]}
          currentMode="PSK31"
          isActive={true}
        />,
      );

      expect(screen.getByText("0 messages")).toBeInTheDocument();
    });
  });

  describe("Active Mode with Messages", () => {
    it("should display all messages", () => {
      render(
        <DigitalModeDisplay
          messages={mockMessages}
          currentMode="PSK31"
          isActive={true}
        />,
      );

      expect(screen.getByText("CQ CQ DE TEST TEST K")).toBeInTheDocument();
      expect(screen.getByText("TEST DE W1AW W1AW K")).toBeInTheDocument();
    });

    it("should display message count", () => {
      render(
        <DigitalModeDisplay
          messages={mockMessages}
          currentMode="PSK31"
          isActive={true}
        />,
      );

      expect(screen.getByText("2 messages")).toBeInTheDocument();
    });

    it("should display singular 'message' for single message", () => {
      const firstMessage = mockMessages[0];
      if (!firstMessage) {
        throw new Error("Mock message not found");
      }
      render(
        <DigitalModeDisplay
          messages={[firstMessage]}
          currentMode="PSK31"
          isActive={true}
        />,
      );

      expect(screen.getByText("1 message")).toBeInTheDocument();
    });

    it("should display SNR when provided", () => {
      render(
        <DigitalModeDisplay
          messages={mockMessages}
          currentMode="PSK31"
          isActive={true}
        />,
      );

      expect(screen.getByText("-5.5 dB")).toBeInTheDocument();
      expect(screen.getByText("+10.2 dB")).toBeInTheDocument();
    });

    it("should display frequency when provided", () => {
      render(
        <DigitalModeDisplay
          messages={mockMessages}
          currentMode="PSK31"
          isActive={true}
        />,
      );

      // Frequency 14070.5 Hz = 14.1 kHz (toFixed(1))
      expect(screen.getAllByText("14.1 kHz")).toHaveLength(2);
    });

    it("should handle messages without SNR or frequency", () => {
      const simpleMessage: DigitalModeMessage = {
        timestamp: new Date(),
        mode: "PSK31",
        text: "Simple message",
      };

      render(
        <DigitalModeDisplay
          messages={[simpleMessage]}
          currentMode="PSK31"
          isActive={true}
        />,
      );

      expect(screen.getByText("Simple message")).toBeInTheDocument();
    });
  });

  describe("Auto-scroll Control", () => {
    it("should toggle auto-scroll when button is clicked", () => {
      render(
        <DigitalModeDisplay
          messages={mockMessages}
          currentMode="PSK31"
          isActive={true}
        />,
      );

      const autoScrollButton = screen.getByRole("button", {
        name: /toggle auto-scroll/i,
      });

      // Should be active by default
      expect(autoScrollButton).toHaveClass("active");

      // Click to disable
      fireEvent.click(autoScrollButton);
      expect(autoScrollButton).not.toHaveClass("active");

      // Click to enable
      fireEvent.click(autoScrollButton);
      expect(autoScrollButton).toHaveClass("active");
    });
  });

  describe("Accessibility", () => {
    it("should have proper ARIA attributes", () => {
      render(
        <DigitalModeDisplay
          messages={mockMessages}
          currentMode="PSK31"
          isActive={true}
        />,
      );

      const messagesContainer = screen.getByRole("log");
      expect(messagesContainer).toHaveAttribute("aria-live", "polite");
      expect(messagesContainer).toHaveAttribute("aria-atomic", "false");
      expect(messagesContainer).toHaveAttribute("aria-relevant", "additions");
    });

    it("should have accessible button labels", () => {
      render(
        <DigitalModeDisplay
          messages={mockMessages}
          currentMode="PSK31"
          isActive={true}
        />,
      );

      const autoScrollButton = screen.getByRole("button", {
        name: /toggle auto-scroll/i,
      });
      expect(autoScrollButton).toBeInTheDocument();
    });
  });

  describe("Different Modes", () => {
    it("should display FT8 mode", () => {
      const ft8Message: DigitalModeMessage = {
        timestamp: new Date(),
        mode: "FT8",
        text: "CQ TEST FN42",
        snr: -15,
        frequency: 14074,
      };

      render(
        <DigitalModeDisplay
          messages={[ft8Message]}
          currentMode="FT8"
          isActive={true}
        />,
      );

      expect(screen.getByText("FT8")).toBeInTheDocument();
      expect(screen.getByText("CQ TEST FN42")).toBeInTheDocument();
    });

    it("should display RTTY mode", () => {
      const rttyMessage: DigitalModeMessage = {
        timestamp: new Date(),
        mode: "RTTY",
        text: "RYRYRY DE TEST",
      };

      render(
        <DigitalModeDisplay
          messages={[rttyMessage]}
          currentMode="RTTY"
          isActive={true}
        />,
      );

      expect(screen.getByText("RTTY")).toBeInTheDocument();
      expect(screen.getByText("RYRYRY DE TEST")).toBeInTheDocument();
    });
  });

  describe("Status Indicator", () => {
    it("should show receiving status when active", () => {
      render(
        <DigitalModeDisplay
          messages={mockMessages}
          currentMode="PSK31"
          isActive={true}
        />,
      );

      expect(screen.getByText("Receiving")).toBeInTheDocument();
    });

    it("should show standby status when inactive", () => {
      render(
        <DigitalModeDisplay
          messages={mockMessages}
          currentMode="PSK31"
          isActive={false}
        />,
      );

      expect(screen.getByText("PSK31 Decoder Inactive")).toBeInTheDocument();
    });
  });

  describe("Custom className", () => {
    it("should apply custom className", () => {
      const { container } = render(
        <DigitalModeDisplay
          messages={[]}
          currentMode="PSK31"
          isActive={true}
          className="custom-class"
        />,
      );

      const display = container.querySelector(".digital-mode-display");
      expect(display).toHaveClass("custom-class");
    });
  });
});
