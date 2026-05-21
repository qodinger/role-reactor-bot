---
name: git-workflow
description: Git workflow guidelines including commit conventions, branch naming, and code review. Use when working with Git branches, writing commits, or merging code.
---

# Skill: git-workflow

## When to Use This Skill

Use this skill when:
- Writing a commit message
- Creating a branch
- Preparing a PR

## Commits

**Format:** `<type>(<scope>): <description>`

- Description is lowercase, present tense, no period
- Scope is optional but useful for large repos
- Keep it under 72 characters

**Types:**
- `feat` — new capability the user can see
- `fix` — bug fix
- `refactor` — restructure without behavior change
- `test` — adding or fixing tests
- `docs` — documentation only
- `chore` — tooling, deps, config

**Rules:**
- One logical change per commit. If you find yourself writing "and" in the message, split it.
- Never commit directly to `main` or `master`.
- Never commit with `--no-verify` unless you have an explicit reason and the user approves.

## Branches

`<type>/<short-description>` — kebab-case, no ticket numbers unless the project uses them.

```
feat/user-auth
fix/null-pointer-login
refactor/extract-payment-service
```

## Pull Requests

- Title follows the same format as a commit message
- Keep PRs focused — one concern per PR
- If a PR is getting large, split it before opening
- Add a short description of *why*, not *what* — the diff shows what

## Before Merging

- All CI checks pass
- At least one review (if team project)
- No unresolved comments
- Branch is up to date with base
