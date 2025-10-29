# Avoid Implementation Result Files in Repository

## Policy

Do NOT commit files that contain implementation results, progress summaries, or derived data to the repository. This includes:

- Files named like `IMPLEMENTATION_RESULTS.md`, `SUMMARY.md`, or similar
- Files that describe what was done in a PR or commit
- Temporary benchmark results or progress reports
- Step-by-step implementation plans that are completed

## Rationale

1. **Version Control Redundancy**: Commit messages and PR descriptions already document what was done
2. **Stale Information**: These files become outdated quickly as code evolves
3. **Maintenance Burden**: Requires updating multiple places for the same information
4. **Signal-to-Noise**: Makes it harder to find actual reference documentation

## Where This Information Belongs

- **Commit messages**: Brief description of changes
- **PR descriptions**: Detailed explanation of implementation
- **PR comments**: Discussion and clarifications
- **Issues**: Requirements and acceptance criteria
- **Reference docs**: Patterns, best practices, and how-to guides (not "what we did")

## What TO Include

- **Reference documentation**: Timeless technical information
- **How-to guides**: Step-by-step instructions for common tasks
- **API documentation**: Interface contracts and usage examples
- **Architecture Decision Records (ADRs)**: Why decisions were made
- **Best practices**: Patterns and anti-patterns

## Examples

❌ **Don't commit**:

- `IMPLEMENTATION_RESULTS.md` - Implementation summary
- `PERFORMANCE_OPTIMIZATION_SUMMARY.md` - What was completed
- `PROJECT_STATUS.md` - Current state of work

✅ **Do commit**:

- `performance-optimization.md` - How to optimize performance
- `performance-benchmarks.md` - Current benchmarks and targets
- `ADR-001-webgpu-acceleration.md` - Why WebGPU was chosen

## Key Principle

Documentation should be **prescriptive** (how to do something) or **descriptive** (how something works), not **historical** (what was done when).
