# Information Architecture (IA) Map

**ID:** P0-02-01  
**Roadmap:** Phase 0 / 0.2 UX Foundations  
**Roadmap Description:** panels/navigation, what is always visible, and how users discover key actions.

## Summary

Define the MVP information architecture for rad.io: the core screens/panels, navigation model, what is always visible, and how users discover and recover key actions. The IA map is the foundation for consistent UX contracts and component specs.

The IA should prioritize a first successful session: connect → see spectrum/waterfall → tune → hear audio → adjust basics → recover from issues.

## Deliverables

- docs/ux/ia/ia-map.md
- docs/ux/ia/navigation-model.md
- docs/ux/ia/mvp-user-flows.md

## Acceptance Criteria

- [ ] docs/ux/ia/ia-map.md identifies at least 8 primary UI regions/panels and describes their purpose.
- [ ] docs/ux/ia/navigation-model.md defines the navigation paradigm (tabs, panels, drawers) and includes rules for responsive behavior.
- [ ] docs/ux/ia/mvp-user-flows.md includes at least 5 flows with start/end states and primary actions.
- [ ] The IA explicitly lists “Always visible” elements and “Contextual” elements, with rationale.
- [ ] The IA includes a “Discoverability” section that specifies how users find connect, start/stop, tune, and audio enablement.

## Agent Prompt

You are defining the MVP information architecture for rad.io.

Context

- rad.io is a web SDR receiver/analyzer.
- Phase 0 UX foundations require explicit, testable structure.

Required outputs

- Create docs/ux/ia/ia-map.md:

  - A textual map of screens/panels.
  - Always-visible elements vs contextual elements.
  - Primary entry points for key actions.
- Create docs/ux/ia/navigation-model.md:

  - Navigation model and rules.
  - Responsive considerations and keyboard navigation expectations.
- Create docs/ux/ia/mvp-user-flows.md:

  - Flows: first session, retune, adjust bandwidth/filter, mute/unmute, recover from disconnect.

Non-goals

- Do not create pixel-perfect UI designs.
- Do not implement UI; this is a contract artifact.

Validation plan

- Ensure IA supports the core flows without dead ends.
- Ensure all key actions are discoverable within 1–2 interactions.
- Ensure docs contain no TODOs and follow markdownlint formatting.
