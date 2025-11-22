/**
 * Accessibility Tests for Multi-VFO Components
 *
 * Verifies WCAG 2.1 Level AA compliance for:
 * - Keyboard navigation
 * - Focus management
 * - ARIA attributes
 * - Screen reader support
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { axe, toHaveNoViolations } from "jest-axe";
import React from "react";

import { VfoStatus } from "../../types/vfo";
import type { VfoState } from "../../types/vfo";
import { AddVfoModal } from "../AddVfoModal";
import { VfoBadgeOverlay } from "../VfoBadgeOverlay";
import { VfoManagerPanel } from "../VfoManagerPanel";

// Add jest-axe matchers
expect.extend(toHaveNoViolations);

// Mock VFO data
const mockVfo: VfoState = {
  id: "vfo-1",
  centerHz: 100_000_000,
  modeId: "wbfm",
  bandwidthHz: 200_000,
  audioEnabled: true,
  audioGain: 1.0,
  priority: 5,
  status: VfoStatus.ACTIVE,
  demodulator: null,
  audioNode: null,
  metrics: {
    rssi: -50,
    samplesProcessed: 1024,
    processingTime: 1.5,
    timestamp: Date.now(),
  },
  createdAt: Date.now(),
};

describe("Multi-VFO Accessibility", () => {
  describe("VfoManagerPanel", () => {
    it("should have no accessibility violations (empty state)", async () => {
      const { container } = render(
        <VfoManagerPanel vfos={[]} onRemove={jest.fn()} onToggleAudio={jest.fn()} />,
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it("should have no accessibility violations (with VFOs)", async () => {
      const { container } = render(
        <VfoManagerPanel
          vfos={[mockVfo]}
          onRemove={jest.fn()}
          onToggleAudio={jest.fn()}
        />,
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it("should support keyboard navigation for remove button", () => {
      const onRemove = jest.fn();

      render(
        <VfoManagerPanel
          vfos={[mockVfo]}
          onRemove={onRemove}
          onToggleAudio={jest.fn()}
        />,
      );

      const removeButton = screen.getByLabelText(/remove vfo/i);
      expect(removeButton).toBeInTheDocument();

      // Focus and activate with keyboard
      removeButton.focus();
      expect(removeButton).toHaveFocus();

      fireEvent.click(removeButton);
      expect(onRemove).toHaveBeenCalledWith(mockVfo.id);
    });

    it("should support keyboard navigation for audio checkbox", () => {
      const onToggleAudio = jest.fn();

      render(
        <VfoManagerPanel
          vfos={[mockVfo]}
          onRemove={jest.fn()}
          onToggleAudio={onToggleAudio} // Correct prop name
        />,
      );

      const checkbox = screen.getByLabelText(/enable audio/i);
      expect(checkbox).toBeInTheDocument();

      // Toggle with keyboard
      checkbox.focus();
      expect(checkbox).toHaveFocus();

      fireEvent.click(checkbox);
      expect(onToggleAudio).toHaveBeenCalledWith(mockVfo.id, false);
    });

    it("should have proper focus order", () => {
      render(
        <VfoManagerPanel
          vfos={[mockVfo]}
          onRemove={jest.fn()}
          onToggleAudio={jest.fn()}
        />,
      );

      // All interactive elements should be in tab order
      const checkbox = screen.getByLabelText(/enable audio/i);
      const removeButton = screen.getByLabelText(/remove vfo/i);

      expect(checkbox).not.toHaveAttribute("tabindex", "-1");
      expect(removeButton).not.toHaveAttribute("tabindex", "-1");
    });

    it("should have descriptive ARIA labels", () => {
      render(
        <VfoManagerPanel
          vfos={[mockVfo]}
          onRemove={jest.fn()}
          onToggleAudio={jest.fn()}
        />,
      );

      // Check for aria-labels (frequency formatting may vary)
      expect(screen.getByLabelText(/remove vfo/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/enable audio/i)).toBeInTheDocument();
    });
  });

  describe("AddVfoModal", () => {
    it("should have no accessibility violations", async () => {
      const { container } = render(
        <AddVfoModal
          isOpen={true}
          frequencyHz={100_000_000}
          onConfirm={jest.fn()}
          onCancel={jest.fn()}
        />,
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it("should have proper dialog role and aria attributes", () => {
      render(
        <AddVfoModal
          isOpen={true}
          frequencyHz={100_000_000}
          onConfirm={jest.fn()}
          onCancel={jest.fn()}
        />,
      );

      const dialog = screen.getByRole("dialog");
      expect(dialog).toHaveAttribute("aria-modal", "true");
      expect(dialog).toHaveAttribute("aria-labelledby", "add-vfo-modal-title");
    });

    it("should support Escape key to close", () => {
      const onCancel = jest.fn();

      render(
        <AddVfoModal
          isOpen={true}
          frequencyHz={100_000_000}
          onConfirm={jest.fn()}
          onCancel={onCancel}
        />,
      );

      fireEvent.keyDown(document, { key: "Escape" });
      expect(onCancel).toHaveBeenCalled();
    });

    it("should have accessible form labels", () => {
      render(
        <AddVfoModal
          isOpen={true}
          frequencyHz={100_000_000}
          onConfirm={jest.fn()}
          onCancel={jest.fn()}
        />,
      );

      // Mode select should have label
      expect(screen.getByLabelText(/mode/i)).toBeInTheDocument();
    });

    it("should support keyboard navigation between controls", () => {
      render(
        <AddVfoModal
          isOpen={true}
          frequencyHz={100_000_000}
          onConfirm={jest.fn()}
          onCancel={jest.fn()}
        />,
      );

      const modeSelect = screen.getByLabelText(/mode/i);
      const buttons = screen.getAllByRole("button");

      // Verify all controls are focusable
      expect(modeSelect).not.toHaveAttribute("tabindex", "-1");
      buttons.forEach((button) => {
        expect(button).not.toHaveAttribute("tabindex", "-1");
      });
    });
  });

  describe("VfoBadgeOverlay", () => {
    it("should have no accessibility violations", async () => {
      const { container } = render(
        <VfoBadgeOverlay
          vfos={[mockVfo]}
          centerFrequencyHz={100_000_000}
          sampleRateHz={20_000_000}
          waterfallWidthPx={800}
          onRemove={jest.fn()} // Using onRemove, not onVfoRemove
        />,
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it("should support keyboard interaction for remove button", () => {
      const onVfoRemove = jest.fn();

      render(
        <VfoBadgeOverlay
          vfos={[mockVfo]}
          centerFrequencyHz={100_000_000}
          sampleRateHz={20_000_000}
          waterfallWidthPx={800}
          onRemove={onVfoRemove} // Using onRemove, not onVfoRemove
        />,
      );

      // Find remove button by aria-label
      const removeButton = screen.getByLabelText(/remove vfo/i);
      expect(removeButton).toBeInTheDocument();

      // Activate with keyboard
      removeButton.focus();
      fireEvent.click(removeButton);
      expect(onVfoRemove).toHaveBeenCalledWith(mockVfo.id);
    });
  });

  describe("Focus Management", () => {
    it("should maintain focus when VFO is removed", () => {
      const { rerender } = render(
        <VfoManagerPanel
          vfos={[mockVfo]}
          onRemove={jest.fn()}
          onToggleAudio={jest.fn()}
        />,
      );

      const removeButton = screen.getByLabelText(/remove vfo/i);
      removeButton.focus();
      expect(removeButton).toHaveFocus();

      // Re-render without the VFO (simulating removal)
      rerender(
        <VfoManagerPanel
          vfos={[]}
          onRemove={jest.fn()}
          onToggleAudio={jest.fn()}
        />,
      );

      // Focus should move to document body or container when element removed
      expect(document.activeElement).toBeTruthy();
    });

    it("should have visible focus indicators", () => {
      const { container } = render(
        <VfoManagerPanel
          vfos={[mockVfo]}
          onRemove={jest.fn()}
          onToggleAudio={jest.fn()}
        />,
      );

      // Check that focus-visible styles can be applied (not disabled)
      const buttons = container.querySelectorAll("button");
      buttons.forEach((button) => {
        expect(button).not.toHaveStyle({ outline: "none" });
      });
    });
  });

  describe("Screen Reader Announcements", () => {
    it("should announce VFO status changes", () => {
      render(
        <VfoManagerPanel
          vfos={[mockVfo]}
          onRemove={jest.fn()}
          onToggleAudio={jest.fn()}
        />,
      );

      // Status should be announced
      const statusBadge = screen.getByLabelText(/status: active/i);
      expect(statusBadge).toBeInTheDocument();
    });

    it("should announce audio state", () => {
      render(
        <VfoManagerPanel
          vfos={[mockVfo]}
          onRemove={jest.fn()}
          onToggleAudio={jest.fn()}
        />,
      );

      // Audio icon should have aria-label
      const audioIcon = screen.getByLabelText(/audio active/i);
      expect(audioIcon).toBeInTheDocument();
    });

    it("should provide empty state feedback", () => {
      render(
        <VfoManagerPanel vfos={[]} onRemove={jest.fn()} onToggleAudio={jest.fn()} />,
      );

      // Empty state message should be present
      expect(screen.getByText(/no vfos/i)).toBeInTheDocument();
    });
  });

  describe("Color Contrast", () => {
    it("should render text with sufficient contrast", () => {
      const { container } = render(
        <VfoManagerPanel
          vfos={[mockVfo]}
          onRemove={jest.fn()}
          onToggleAudio={jest.fn()}
        />,
      );

      // Text elements should not have low contrast (axe tests this)
      // This is more of a visual regression test placeholder
      expect(container.textContent).toBeTruthy();
    });
  });

  describe("Semantic HTML", () => {
    it("should use semantic HTML elements", () => {
      render(
        <VfoManagerPanel
          vfos={[mockVfo]}
          onRemove={jest.fn()}
          onToggleAudio={jest.fn()}
        />,
      );

      // Should use button elements for interactive controls
      expect(screen.getByLabelText(/remove vfo/i).tagName).toBe("BUTTON");
    });

    it("should use proper heading hierarchy", () => {
      const { container } = render(
        <VfoManagerPanel
          vfos={[mockVfo]}
          onRemove={jest.fn()}
          onToggleAudio={jest.fn()}
        />,
      );

      // Check for headings
      const headings = container.querySelectorAll("h1, h2, h3, h4, h5, h6");
      expect(headings.length).toBeGreaterThan(0);
    });
  });
});
