---
name: karpathy-guidelines
description: Behavioral guidelines to reduce common LLM coding mistakes. Use when writing, reviewing, or refactoring code.
---

# Skill: karpathy-guidelines

## When to Use This Skill

Use this skill when:
- Writing, reviewing, or refactoring code
- User asks to implement something

## 1. Think Before Coding

- State assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If something is unclear, stop. Ask.

## 2. Simplicity First

- Minimum code that solves the problem.
- No features beyond what was asked.
- No abstractions for single-use code.
- If 200 lines could be 50, rewrite it.

## 3. Surgical Changes

- Touch only what you must.
- Don't "improve" adjacent code.
- Don't refactor things that aren't broken.
- Remove imports YOUR changes made unused.

## 4. Goal-Driven Execution

Define success criteria:
- "Add validation" → "Write tests, then make them pass"
- "Fix the bug" → "Write test that reproduces it, then fix"