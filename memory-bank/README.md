# Memory Bank

The Memory Bank is our durable project memory. It captures the why, what, and how of Genkit-UI so we can resume work after resets and onboard instantly.

This folder follows the Memory Bank instructions in `.github/instructions/memory-bank.instructions.md` and our Spec‑Driven Workflow (`.github/instructions/spec-driven-workflow-v1.instructions.md`).

## Structure

- `projectbrief.md` – Scope, goals, success metrics (source of truth)
- `productContext.md` – User value, problems, UX goals
- `activeContext.md` – Current focus, recent changes, next steps
- `systemPatterns.md` – Architecture and design patterns
- `techContext.md` – Tech stack, versions, constraints, env
- `progress.md` – What works, what’s left, known issues
- `requirements.md` – EARS requirements (Spec‑Driven)
- `design.md` – Technical design (Spec‑Driven)
- `tasks.md` – Implementation plan (Spec‑Driven)
- `tasks/` – Task files and `_index.md`

## Usage

- Update `activeContext.md` and `progress.md` after meaningful changes.
- Track work with files under `memory-bank/tasks/` and the master `tasks/_index.md`.
- For new work, write/update `requirements.md` → `design.md` → `tasks.md` before implementation.

## Task workflow (human + agent)

- Create: add a file `memory-bank/tasks/TASK###-short-name.md` using the template in the instructions.
- Index: add an entry to `memory-bank/tasks/_index.md` under the right status.
- Update: modify the task’s Subtasks table and add a new Progress Log entry with today’s date.

For detailed rules, see `.github/instructions/memory-bank.instructions.md`.
