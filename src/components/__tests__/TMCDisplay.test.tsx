/**
 * Tests for TMC Display Component
 */

import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import TMCDisplay, { TMCDisplayCompact } from "../TMCDisplay";
import type { TMCMessage, TMCDecoderStats } from "../../models/TMCData";
import {
  TMCEventCategory,
  TMCEventSeverity,
  TMCDirection,
  TMCDuration,
  TMCExtent,
} from "../../models/TMCData";

describe("TMCDisplay", () => {
  const mockStats: TMCDecoderStats = {
    messagesReceived: 5,
    messagesActive: 2,
    lastMessageAt: Date.now(),
    group8ACount: 10,
    parseErrors: 0,
  };

  const mockMessage: TMCMessage = {
    messageId: 12345,
    eventCode: 101,
    eventText: "Accident",
    category: TMCEventCategory.ACCIDENT,
    severity: TMCEventSeverity.SEVERE,
    locationCode: 5000,
    locationText: "Location 5000",
    direction: TMCDirection.POSITIVE,
    extent: TMCExtent.PLUS_2_LOCATIONS,
    extentText: "+2 locations",
    duration: TMCDuration.HOUR_1,
    durationText: "~1 hour",
    diversionAdvice: true,
    urgency: 3,
    receivedAt: Date.now(),
    expiresAt: Date.now() + 3600000,
    updateCount: 1,
  };

  describe("Rendering", () => {
    it("should render no data message when messages array is empty", () => {
      render(<TMCDisplay messages={[]} stats={null} />);

      expect(screen.getByText("No Traffic Messages")).toBeInTheDocument();
      expect(
        screen.getByText(
          "TMC data will appear when traffic information is broadcast",
        ),
      ).toBeInTheDocument();
    });

    it("should render traffic messages header", () => {
      render(<TMCDisplay messages={[mockMessage]} stats={mockStats} />);

      expect(screen.getByText("Traffic Messages")).toBeInTheDocument();
      expect(screen.getByText("1")).toBeInTheDocument();
    });

    it("should render message event text", () => {
      render(<TMCDisplay messages={[mockMessage]} stats={mockStats} />);

      expect(screen.getByText("Accident")).toBeInTheDocument();
    });

    it("should render message location", () => {
      render(<TMCDisplay messages={[mockMessage]} stats={mockStats} />);

      expect(screen.getByText("Location:")).toBeInTheDocument();
      expect(screen.getByText("Location 5000")).toBeInTheDocument();
    });

    it("should render message extent", () => {
      render(<TMCDisplay messages={[mockMessage]} stats={mockStats} />);

      expect(screen.getByText("Extent:")).toBeInTheDocument();
      expect(screen.getByText("+2 locations")).toBeInTheDocument();
    });

    it("should render message duration", () => {
      render(<TMCDisplay messages={[mockMessage]} stats={mockStats} />);

      expect(screen.getByText("Duration:")).toBeInTheDocument();
      expect(screen.getByText("~1 hour")).toBeInTheDocument();
    });

    it("should render diversion advice badge when present", () => {
      render(<TMCDisplay messages={[mockMessage]} stats={mockStats} />);

      expect(screen.getByText("🔀 Diversion Advised")).toBeInTheDocument();
    });

    it("should not render diversion advice when not present", () => {
      const messageWithoutDiversion = {
        ...mockMessage,
        diversionAdvice: false,
      };
      render(
        <TMCDisplay messages={[messageWithoutDiversion]} stats={mockStats} />,
      );

      expect(
        screen.queryByText("🔀 Diversion Advised"),
      ).not.toBeInTheDocument();
    });
  });

  describe("Statistics", () => {
    it("should render statistics when stats provided", () => {
      render(<TMCDisplay messages={[mockMessage]} stats={mockStats} />);

      expect(screen.getByText("Total:")).toBeInTheDocument();
      expect(screen.getByText("5")).toBeInTheDocument();
      expect(screen.getByText("Active:")).toBeInTheDocument();
      expect(screen.getByText("2")).toBeInTheDocument();
      expect(screen.getByText("Groups:")).toBeInTheDocument();
      expect(screen.getByText("10")).toBeInTheDocument();
    });

    it("should not render statistics when stats not provided", () => {
      render(<TMCDisplay messages={[mockMessage]} stats={null} />);

      expect(screen.queryByText("Total:")).not.toBeInTheDocument();
    });

    it("should show parse errors when present", () => {
      const statsWithErrors = { ...mockStats, parseErrors: 3 };
      render(<TMCDisplay messages={[mockMessage]} stats={statsWithErrors} />);

      expect(screen.getByText("Errors:")).toBeInTheDocument();
      expect(screen.getByText("3")).toBeInTheDocument();
    });

    it("should not show parse errors when zero", () => {
      render(<TMCDisplay messages={[mockMessage]} stats={mockStats} />);

      expect(screen.queryByText("Errors:")).not.toBeInTheDocument();
    });
  });

  describe("Multiple Messages", () => {
    it("should render multiple messages", () => {
      const message2: TMCMessage = {
        ...mockMessage,
        messageId: 67890,
        eventCode: 1,
        eventText: "Traffic congestion",
        severity: TMCEventSeverity.MODERATE,
      };

      const twoMessageStats = { ...mockStats, messagesActive: 2 };

      render(
        <TMCDisplay
          messages={[mockMessage, message2]}
          stats={twoMessageStats}
        />,
      );

      expect(screen.getByText("Accident")).toBeInTheDocument();
      expect(screen.getByText("Traffic congestion")).toBeInTheDocument();
      // Check the message count in header (should be 2)
      const counts = screen.getAllByText("2");
      expect(counts.length).toBeGreaterThan(0);
    });
  });

  describe("Severity Display", () => {
    it("should show CRITICAL label for critical severity", () => {
      const criticalMessage = {
        ...mockMessage,
        severity: TMCEventSeverity.CRITICAL,
      };
      render(<TMCDisplay messages={[criticalMessage]} stats={mockStats} />);

      expect(screen.getByText("CRITICAL")).toBeInTheDocument();
    });

    it("should show SEVERE label for severe severity", () => {
      render(<TMCDisplay messages={[mockMessage]} stats={mockStats} />);

      expect(screen.getByText("SEVERE")).toBeInTheDocument();
    });

    it("should show MODERATE label for moderate severity", () => {
      const moderateMessage = {
        ...mockMessage,
        severity: TMCEventSeverity.MODERATE,
      };
      render(<TMCDisplay messages={[moderateMessage]} stats={mockStats} />);

      expect(screen.getByText("MODERATE")).toBeInTheDocument();
    });

    it("should show MINOR label for minor severity", () => {
      const minorMessage = {
        ...mockMessage,
        severity: TMCEventSeverity.MINOR,
      };
      render(<TMCDisplay messages={[minorMessage]} stats={mockStats} />);

      expect(screen.getByText("MINOR")).toBeInTheDocument();
    });
  });

  describe("Direction Display", () => {
    it("should show Positive direction", () => {
      render(<TMCDisplay messages={[mockMessage]} stats={mockStats} />);

      expect(screen.getByText("Positive")).toBeInTheDocument();
    });

    it("should show Negative direction", () => {
      const negativeMessage = {
        ...mockMessage,
        direction: TMCDirection.NEGATIVE,
      };
      render(<TMCDisplay messages={[negativeMessage]} stats={mockStats} />);

      expect(screen.getByText("Negative")).toBeInTheDocument();
    });

    it("should show Both directions", () => {
      const bothMessage = { ...mockMessage, direction: TMCDirection.BOTH };
      render(<TMCDisplay messages={[bothMessage]} stats={mockStats} />);

      expect(screen.getByText("Both")).toBeInTheDocument();
    });
  });
});

describe("TMCDisplayCompact", () => {
  const mockMessage: TMCMessage = {
    messageId: 12345,
    eventCode: 101,
    eventText: "Accident on Highway",
    category: TMCEventCategory.ACCIDENT,
    severity: TMCEventSeverity.SEVERE,
    locationCode: 5000,
    locationText: "Location 5000",
    direction: TMCDirection.POSITIVE,
    extent: TMCExtent.PLUS_2_LOCATIONS,
    extentText: "+2 locations",
    duration: TMCDuration.HOUR_1,
    durationText: "~1 hour",
    diversionAdvice: false,
    urgency: 3,
    receivedAt: Date.now(),
    expiresAt: null,
    updateCount: 1,
  };

  it("should render no traffic message when messages array is empty", () => {
    render(<TMCDisplayCompact messages={[]} />);

    expect(screen.getByText("No Traffic")).toBeInTheDocument();
  });

  it("should render message count", () => {
    render(<TMCDisplayCompact messages={[mockMessage]} />);

    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("should render top message text", () => {
    render(<TMCDisplayCompact messages={[mockMessage]} />);

    expect(screen.getByText("Accident on Highway")).toBeInTheDocument();
  });

  it("should show count for multiple messages", () => {
    const message2 = { ...mockMessage, messageId: 67890 };
    render(<TMCDisplayCompact messages={[mockMessage, message2]} />);

    expect(screen.getByText("2")).toBeInTheDocument();
  });
});
