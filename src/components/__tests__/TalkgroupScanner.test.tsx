/**
 * Tests for TalkgroupScanner component
 */

import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import TalkgroupScanner, { type Talkgroup } from "../TalkgroupScanner";

describe("TalkgroupScanner", () => {
  const mockTalkgroups: Talkgroup[] = [
    {
      id: "101",
      name: "Fire Dispatch",
      category: "Fire",
      priority: 8,
      enabled: true,
    },
    {
      id: "102",
      name: "Police Channel 1",
      category: "Police",
      priority: 5,
      enabled: false,
    },
  ];

  const mockOnTalkgroupToggle = jest.fn();
  const mockOnAddTalkgroup = jest.fn();
  const mockOnUpdatePriority = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should render the component", () => {
    render(
      <TalkgroupScanner
        talkgroups={mockTalkgroups}
        onTalkgroupToggle={mockOnTalkgroupToggle}
        onAddTalkgroup={mockOnAddTalkgroup}
      />,
    );
    expect(screen.getByText("Add Talkgroup")).toBeInTheDocument();
    expect(screen.getByText(/Monitored Talkgroups/i)).toBeInTheDocument();
  });

  it("should display talkgroups with priorities", () => {
    render(
      <TalkgroupScanner
        talkgroups={mockTalkgroups}
        onTalkgroupToggle={mockOnTalkgroupToggle}
        onAddTalkgroup={mockOnAddTalkgroup}
      />,
    );

    expect(screen.getByText("Fire Dispatch")).toBeInTheDocument();
    expect(screen.getByText(/ID: 101.*Priority: 8/i)).toBeInTheDocument();
    expect(screen.getByText("Police Channel 1")).toBeInTheDocument();
    expect(screen.getByText(/ID: 102.*Priority: 5/i)).toBeInTheDocument();
  });

  it("should show priority controls when onUpdatePriority is provided", () => {
    render(
      <TalkgroupScanner
        talkgroups={mockTalkgroups}
        onTalkgroupToggle={mockOnTalkgroupToggle}
        onAddTalkgroup={mockOnAddTalkgroup}
        onUpdatePriority={mockOnUpdatePriority}
      />,
    );

    const prioritySliders = screen.getAllByLabelText(/Priority for/i);
    expect(prioritySliders.length).toBeGreaterThan(0);
  });

  it("should not show priority controls when onUpdatePriority is not provided", () => {
    render(
      <TalkgroupScanner
        talkgroups={mockTalkgroups}
        onTalkgroupToggle={mockOnTalkgroupToggle}
        onAddTalkgroup={mockOnAddTalkgroup}
      />,
    );

    const prioritySliders = screen.queryAllByLabelText(/Priority for/i);
    expect(prioritySliders.length).toBe(0);
  });

  it("should display priority slider in add form", () => {
    render(
      <TalkgroupScanner
        talkgroups={[]}
        onTalkgroupToggle={mockOnTalkgroupToggle}
        onAddTalkgroup={mockOnAddTalkgroup}
      />,
    );

    expect(screen.getByLabelText("Talkgroup priority")).toBeInTheDocument();
    expect(screen.getByText(/Priority: 5/i)).toBeInTheDocument();
  });

  it("should toggle talkgroup when checkbox is clicked", () => {
    render(
      <TalkgroupScanner
        talkgroups={mockTalkgroups}
        onTalkgroupToggle={mockOnTalkgroupToggle}
        onAddTalkgroup={mockOnAddTalkgroup}
      />,
    );

    const checkbox = screen.getByLabelText(/Disable Fire Dispatch/i);
    fireEvent.click(checkbox);

    expect(mockOnTalkgroupToggle).toHaveBeenCalledWith("101");
  });

  it("should add talkgroup with priority when form is submitted", () => {
    render(
      <TalkgroupScanner
        talkgroups={[]}
        onTalkgroupToggle={mockOnTalkgroupToggle}
        onAddTalkgroup={mockOnAddTalkgroup}
      />,
    );

    const idInput = screen.getByLabelText("Talkgroup ID");
    const nameInput = screen.getByLabelText("Talkgroup name");
    const categorySelect = screen.getByLabelText("Talkgroup category");
    const prioritySlider = screen.getByLabelText("Talkgroup priority");
    const addButton = screen.getByLabelText("Add talkgroup");

    fireEvent.change(idInput, { target: { value: "103" } });
    fireEvent.change(nameInput, { target: { value: "EMS Dispatch" } });
    fireEvent.change(categorySelect, { target: { value: "EMS" } });
    fireEvent.change(prioritySlider, { target: { value: "7" } });
    fireEvent.click(addButton);

    expect(mockOnAddTalkgroup).toHaveBeenCalledWith({
      id: "103",
      name: "EMS Dispatch",
      category: "EMS",
      priority: 7,
    });
  });

  it("should display count of enabled talkgroups", () => {
    render(
      <TalkgroupScanner
        talkgroups={mockTalkgroups}
        onTalkgroupToggle={mockOnTalkgroupToggle}
        onAddTalkgroup={mockOnAddTalkgroup}
      />,
    );

    expect(
      screen.getByText(/Monitored Talkgroups \(1\/2\)/i),
    ).toBeInTheDocument();
  });

  it("should show empty state when no talkgroups", () => {
    render(
      <TalkgroupScanner
        talkgroups={[]}
        onTalkgroupToggle={mockOnTalkgroupToggle}
        onAddTalkgroup={mockOnAddTalkgroup}
      />,
    );

    expect(screen.getByText(/No talkgroups configured/i)).toBeInTheDocument();
  });
});
