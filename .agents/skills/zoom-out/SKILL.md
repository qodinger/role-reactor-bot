---
name: zoom-out
description: Tell the agent to zoom out and give broader context or a higher-level perspective. Use when you're unfamiliar with a section of code or need to understand how it fits into the bigger picture.
---

# Skill: zoom-out

## When to Use This Skill

Use this skill when:
- You're about to edit code you haven't read the full context of
- Something is behaving unexpectedly and you don't know why
- You've been deep in a file and lost track of the bigger picture

## The Process

Do this before making changes, not after:

1. **Find the entry point** — where does execution start for this feature? Trace from the route, CLI command, or event trigger.
2. **Map the call chain** — who calls what. Write it out as a list: `A → B → C → D`.
3. **Identify the boundaries** — where does this code touch external systems? (DB, API, filesystem, queue)
4. **Read the types** — what data flows through? Types tell you intent faster than implementation.
5. **Check the tests** — existing tests describe expected behavior. Read them before reading implementation.

## What to Produce

Before diving in, write a short summary:
- What this code does in one sentence
- The call chain from entry to the code in question
- What you expected vs. what you found (if something surprised you)

This takes 2 minutes and prevents 30-minute wrong turns.

## When You're Truly Lost

If you can't map the flow after reading the code, say so explicitly:
> "I can see what this code does line by line, but I don't understand why it exists or what calls it. I need more context before making changes."

Then ask the user to explain it or point to the entry point. Never make changes to code you don't understand.
