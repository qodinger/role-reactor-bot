---
name: notes
description: Lightweight project logging via NOTES.md. Use with /logday, /recap, /decision, /idea.
---

# Skill: notes

## When to Use This Skill

- /logday - End of session: log what you did
- /recap - Start of session: summarize current state
- /decision - Log a key decision with reasoning
- /idea - Capture a random thought or suggestion

## Process

1. Check if NOTES.md exists in project root
2. If not, create it from TEMPLATE.md
3. Execute the requested command

## Commands

### /logday

Ask the user what they did today in their own rough words.

Take their raw input and:
1. Add a dated entry under "## Log" in NOTES.md
2. Move any resolved items out of "## Open Questions"
3. Add new open questions if implied
4. Update "## Current Focus" if it changed

Keep entries concise - 3-5 lines max.

### /recap

Read NOTES.md and summarize:
- What was last worked on
- What is unresolved
- A suggested next step

Keep it to a short paragraph.

### /decision

Ask the user:
1. What was decided?
2. What alternatives were considered?
3. Why this choice?

Add entry under "## Decisions" with date.

### /idea

Ask the user for their thought or idea.

Add entry under "## Ideas" with date.

Keep it brief - just the idea, not an essay.
