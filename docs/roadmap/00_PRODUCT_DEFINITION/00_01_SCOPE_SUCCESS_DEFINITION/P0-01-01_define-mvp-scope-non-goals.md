# Define MVP Scope + Explicit Non-Goals

**ID:** P0-01-01  
**Roadmap:** Phase 0 / 0.1 Scope & Success Definition (Must Not Churn)  
**Roadmap Description:** lock MVP feature set, polish level, and what is deliberately excluded.

## Summary

Define the rad.io MVP scope and explicit non-goals to prevent feature creep. This includes the minimum user journeys that must work, the quality bar (reliability, usability, accessibility), and what is intentionally excluded until after MVP.

The scope should be phrased as outcomes and capabilities, not implementation details.

## Deliverables

- docs/product/mvp-scope.md
- docs/product/mvp-non-goals.md
- docs/product/mvp-user-journeys.md

## Acceptance Criteria

- [x] docs/product/mvp-scope.md lists 6–10 in-scope MVP capabilities, each mapped to at least one persona and journey.
- [x] docs/product/mvp-non-goals.md lists at least 12 explicit non-goals with rationale.
- [x] docs/product/mvp-user-journeys.md defines at least 5 end-to-end journeys, each with clear start/end states and success criteria.
- [x] Scope includes a quality bar section covering: crash-free expectation, recoverability, and accessibility baseline.
- [x] Non-goals include at least 3 “tempting but out” items in each category: DSP depth, device ecosystem breadth, and advanced workflows.

## Agent Prompt

You are defining the rad.io MVP scope and explicit non-goals.

Context

- rad.io is a browser-based SDR receiver/analyzer.
- Phase 0 output must enable consistent implementation decisions.

Required outputs

- Create docs/product/mvp-scope.md:
  - MVP capabilities (outcome-based).
  - Quality bar (reliability, accessibility, performance) described in user-visible terms.
  - Dependencies and assumptions.
- Create docs/product/mvp-non-goals.md:
  - Explicitly excluded features and why.
  - “Not in MVP even if easy” list.
- Create docs/product/mvp-user-journeys.md:
  - 5+ journeys with steps and success criteria.
  - Include at least one journey that exercises recovery from a failure.

Non-goals

- Do not write product marketing.
- Do not implement features or change code.

Validation plan

- Ensure every in-scope item maps to a persona and a journey.
- Ensure non-goals are unambiguous and defensible.
- Ensure formatting is markdownlint-friendly and contains no TODOs.
