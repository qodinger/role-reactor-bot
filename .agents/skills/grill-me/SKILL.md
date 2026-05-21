---
name: grill-me
description: Interview the user about a plan until shared understanding. Use when user mentions "grill me".
---

# Skill: grill-me

## When to Use This Skill

Use this skill when:
- User says "grill me" before starting work
- Requirements are vague and need sharpening
- You're about to build something significant and want to reduce risk of building the wrong thing

## The Process

Ask one question at a time. Do not ask multiple questions in one message.

For each question:
1. State your recommended answer with a short reason
2. Ask the user to confirm, correct, or choose differently

Before asking a question that can be answered by reading the codebase, read the codebase first. Don't ask what you can discover yourself.

## What to Cover

Walk the decision tree until every branch is resolved:

- **Goal** — What does success look like? How will you know it's done?
- **Scope** — What's in? What's explicitly out?
- **Users** — Who uses this? What do they need?
- **Data** — What data is created, read, updated, deleted?
- **Edge cases** — What happens when inputs are invalid, missing, or extreme?
- **Errors** — How should failures be handled and surfaced?
- **Integration** — What existing systems does this touch?
- **Constraints** — Any deadline, performance, or compatibility requirements?

Stop when you can write a one-paragraph spec that the user confirms is correct.

## When to Stop

Stop asking when you have enough to write a spec. Over-grilling is as harmful as under-grilling — at some point you're just delaying work.

If the user says "just start" before you're done, note the open questions explicitly and proceed with your best assumptions stated.
