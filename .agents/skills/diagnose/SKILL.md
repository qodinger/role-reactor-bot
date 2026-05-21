---
name: diagnose
description: Disciplined diagnosis loop for hard bugs and performance regressions. Use when user says "diagnose this" / "debug this", reports a bug, or describes a performance regression.
---

# Skill: diagnose

## When to Use This Skill

Use this skill when:
- User says "diagnose this" or "debug this"
- Reports a bug, something is broken/throwing/failing
- Describes a performance regression

## The Diagnosis Loop (6 Phases)

### Phase 1 — Build a feedback loop

Everything else is mechanical. If you have a fast, deterministic pass/fail signal for the bug, you will find the cause.

**Ways to construct a loop (in order):**
1. Failing test at the bug seam
2. Curl / HTTP script against dev server
3. CLI invocation with fixture input
4. Headless browser script (Playwright)
5. Throwaway harness - minimal subset of the system

A 2-second deterministic loop is a debugging superpower.

### Phase 2 — Reproduce

Run the loop. Watch the bug appear.
- Confirm the failure matches what user described
- Confirm it's reproducible

### Phase 3 — Hypothesise

Generate **3-5 ranked hypotheses** before testing any.

Format: "If X is the cause, then changing Y will make the bug disappear"

Show the ranked list to the user - they often have domain knowledge.

### Phase 4 — Instrument

Each probe must map to a specific prediction. Change one variable at a time.

- Use debugger if available
- Add targeted logs at boundaries
- Tag all debug logs with `[DEBUG-xxx]` for easy cleanup

### Phase 5 — Fix + regression test

Write the regression test **before the fix**:
1. Turn minimised repro into failing test
2. Watch it fail
3. Apply the fix
4. Watch it pass

### Phase 6 — Cleanup

- Original repro no longer reproduces
- Regression test passes
- All `[DEBUG-...]` instrumentation removed
- Document what caused it in the commit message

**Then ask:** What would have prevented this bug?