# Documentation Strategy

## 1. Philosophy: "Docs as Code"
Documentation lives in the repo, evolves with the code, and is reviewed like code. We avoid external wikis that rot.

## 2. Structure
| Path | Purpose | Audience |
| :--- | :--- | :--- |
| `docs/roadmap/` | **The "Why" & "When".** Feature definitions, requirements, and the master plan. | Product/Users |
| `docs/decisions/` | **The "Why we chose X".** Immutable Architecture Decision Records (ADRs). | Engineers |
| `docs/architecture/` | **The "How".** High-level diagrams, data flow, state models. | Engineers |
| `src/**/README.md` | **The "What".** Module-level context (e.g., `src/dsp/README.md`). | Engineers |

## 3. Rules of Engagement

### Rule 1: Docs First (The "Spec" Rule)
Before writing significant code (e.g., a new Phase), the corresponding `docs/roadmap` item must be written and approved.
*   *Exception:* Prototyping/Spikes (but findings must be documented back into the Roadmap).

### Rule 2: ADRs for Irreversible Decisions
Any decision that is hard to reverse (e.g., "Use Redux", "Use SharedArrayBuffer") requires an ADR in `docs/decisions/`.
*   Format: [ADR Template](https://adr.github.io/madr/) (Title, Status, Context, Decision, Consequences).

### Rule 3: TSDoc for Contracts
Public interfaces (e.g., `ISDRDevice`, `IDSPNode`) must have TSDoc comments explaining parameters, constraints, and error behavior.

### Rule 4: The Roadmap is the Backlog
We do not use Jira/Linear yet. `ROADMAP.md` is the source of truth.
*   **Checkbox = Issue:** Every checkbox in the roadmap corresponds to a unit of work.
*   **Done = Checked:** Mark it off when the PR merges.

## 4. Maintenance
*   **PR Checklist:** Every PR must answer: "Does this change require a doc update?"
*   **Stale Docs:** Use `grep` or search to find references to renamed components.
