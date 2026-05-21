---
name: tdd
description: Test-driven development guidelines. Use when writing tests or practicing TDD.
---

# Skill: tdd

## When to Use This Skill

Use this skill when:
- User wants to add a feature or fix a bug
- User says "write tests" or "use TDD"
- User wants test coverage for existing code

## The Rule

**Write a failing test before writing any implementation code.**

If you cannot write the test first, stop and explain why before proceeding.

## The Loop

1. **Red** — Write the smallest failing test that defines the desired behavior. Run it. Confirm it fails for the right reason — not a compile error, not a missing import.
2. **Green** — Write the minimum code to make it pass. No more.
3. **Refactor** — Clean up. Tests must still pass after every change.

Each cycle should take minutes, not hours. If a cycle is taking too long, the unit is too large — break it down.

## What to Test

- Test behavior, not implementation. Test what the code does, not how it does it.
- If you're testing a private method, the design is wrong — extract it into its own unit.
- One assertion per test when possible. Multiple assertions hide which one failed.

## Test Names

Write test names as sentences that describe behavior:
- `it('returns null when user is not found')` not `it('test getUserById')`
- `it('throws when input is empty')` not `it('empty input test')`

## When TDD Feels Impossible

If writing the test first feels impossible, it usually signals a design problem:
- Unit is too large — break it down
- Code has hidden side effects — isolate them with dependency injection
- Wrong layer — move the test up (integration) or down (unit)

Never skip the failing test step. A test written after the code has never been seen to fail — you cannot trust it actually tests anything.

## Frameworks

| Stack | Runner | Notes |
|-------|--------|-------|
| Node/TS | Vitest (prefer) or Jest | Vitest is faster, ESM-native |
| React | Vitest + Testing Library | Test user behavior, not DOM structure |
| Python | pytest | Use fixtures for setup |
| Go | testing (built-in) | Table-driven tests for multiple cases |
