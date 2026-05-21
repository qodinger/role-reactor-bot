---
name: handoff
description: Compact the current conversation into a handoff document for another agent to continue the work.
---

# Skill: handoff

## When to Use This Skill

Use this skill when:
- User wants to hand off work to another agent
- Continuing work in a new session
- Passing work to another developer

## Guidelines

Write a handoff document summarizing the current conversation so a fresh agent can continue.

Save to the user's temp directory - not the current workspace.

Include:
- What has been done
- What's remaining
- Key decisions made
- Suggested skills to use

Do not duplicate content already in PRDs, plans, ADRs, issues, or commits. Reference them by path instead.

Redact sensitive info (API keys, passwords, PII).