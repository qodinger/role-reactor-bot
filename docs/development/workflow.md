# Git Workflow Guide

This document outlines the Git workflow for the Role Reactor Bot project.

## Quick Setup (Git Helpers)

The project includes optional shell helper functions to speed up common Git operations.

### Setup

**Option 1: Source in current session:**
```bash
source scripts/git-helpers.sh
```

**Option 2: Add to shell profile (permanent):**
Add to your `~/.bashrc` or `~/.zshrc`:
```bash
# Git workflow helpers for role-reactor-bot
if [ -f "$HOME/dev/projects/discord-bots/role-reactor-bot/scripts/git-helpers.sh" ]; then
    source "$HOME/dev/projects/discord-bots/role-reactor-bot/scripts/git-helpers.sh"
fi
```

### Available Commands

| Command | Description |
|---------|-------------|
| `git-feature <name>` | Create and switch to `feature/<name>` |
| `git-finish-feature` | Merge current feature to dev and cleanup |
| `git-fix <name>` | Create and switch to `fix/<name>` |
| `git-finish-fix` | Merge current fix to main and cleanup |
| `git-hotfix <name>` | Create and switch to `hotfix/<name>` |
| `git-finish-hotfix` | Merge to main and dev, cleanup |
| `git-sync-main` | Sync current branch with main |
| `git-sync-dev` | Sync current branch with dev |
| `git-cleanup` | Remove merged local branches |
| `git-workflow-help` | Show all available commands |

---

## Branch Strategy

### Branch Types

1. **`main`** - Production-ready code
   - Always stable and deployable
   - Only merged code that has been tested
   - Protected branch (recommended)

2. **`dev`** - Development integration branch
   - Integration branch for multiple features
   - Used for testing feature combinations
   - Merged to `main` when ready for release

3. **`feature/*`** - Feature development branches
   - Named: `feature/command-name`, `feature/userinfo-serverinfo`, etc.
   - Created from `dev` or `main`
   - Merged back to `dev` or `main` when complete

4. **`fix/*`** - Bug fix branches
   - Named: `fix/help-command-patterns`, `fix/level-up-notifications`, etc.
   - Created from `main` for urgent fixes
   - Merged directly to `main` (can also merge to `dev`)

5. **`hotfix/*`** - Critical production fixes
   - Named: `hotfix/deployment-issue`, `hotfix/security-patch`, etc.
   - Created from `main` for urgent production issues
   - Merged to both `main` and `dev`

## Workflow Patterns

### Pattern 1: Small Fixes/Updates (Direct to Main)

For small, low-risk changes:

- Bug fixes
- Documentation updates
- Code cleanup
- Help system updates

```bash
# Work directly on main
git checkout main
git pull origin main

# Make changes and commit
git add .
git commit -m "fix(scope): description"

# Push directly to main
git push origin main
```

### Pattern 2: Feature Development (Feature Branch)

For new features or significant changes:

- New commands
- Major refactoring
- New systems/features

```bash
# Create feature branch from dev
git checkout dev
git pull origin dev
git checkout -b feature/command-name

# Develop and commit
git add .
git commit -m "feat(scope): description"

# Push feature branch
git push origin feature/command-name

# When ready, merge to dev
git checkout dev
git pull origin dev
git merge feature/command-name
git push origin dev

# Test on dev, then merge to main
git checkout main
git pull origin main
git merge dev
git push origin main

# Clean up
git branch -d feature/command-name
git push origin --delete feature/command-name
```

### Pattern 3: Bug Fixes (Fix Branch)

For bug fixes that need isolation:

```bash
# Create fix branch from main
git checkout main
git pull origin main
git checkout -b fix/bug-description

# Fix and commit
git add .
git commit -m "fix(scope): description"

# Push fix branch
git push origin fix/bug-description

# Merge to main
git checkout main
git merge fix/bug-description
git push origin main

# Also merge to dev if applicable
git checkout dev
git merge fix/bug-description
git push origin dev

# Clean up
git branch -d fix/bug-description
git push origin --delete fix/bug-description
```

### Pattern 4: Hotfix (Critical Production Fix)

For urgent production issues:

```bash
# Create hotfix from main
git checkout main
git pull origin main
git checkout -b hotfix/issue-description

# Fix and commit
git add .
git commit -m "hotfix(scope): description"

# Push hotfix branch
git push origin hotfix/issue-description

# Merge to main immediately
git checkout main
git merge hotfix/issue-description
git push origin main

# Also merge to dev
git checkout dev
git merge hotfix/issue-description
git push origin dev

# Clean up
git branch -d hotfix/issue-description
git push origin --delete hotfix/issue-description
```

## Commit Message Convention

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types:

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Adding or updating tests
- `chore`: Maintenance tasks
- `hotfix`: Critical production fix

### Examples:

```bash
git commit -m "feat(commands): add userinfo and serverinfo commands"
git commit -m "fix(help): correct command patterns in help system"
git commit -m "docs(changelog): update unreleased section"
git commit -m "refactor(avatar): simplify embed creation"
```

## Branch Naming Conventions

- **Features**: `feature/command-name`, `feature/userinfo-serverinfo`
- **Fixes**: `fix/help-patterns`, `fix/level-up-notifications`
- **Hotfixes**: `hotfix/deployment-issue`, `hotfix/security-patch`
- **Docs**: `docs/update-readme`, `docs/add-workflow-guide`

## Best Practices

1. **Always pull before creating branches**

   ```bash
   git checkout main
   git pull origin main
   ```

2. **Keep branches focused**
   - One feature per branch
   - One fix per branch
   - Avoid mixing unrelated changes

3. **Regular commits**
   - Commit frequently with meaningful messages
   - Don't wait until everything is perfect

4. **Test before merging**
   - Test your changes locally
   - Run linting and tests
   - Verify functionality

5. **Clean up branches**
   - Delete local branches after merging
   - Delete remote branches after merging

   ```bash
   git branch -d branch-name
   git push origin --delete branch-name
   ```

6. **Keep main stable**
   - Only merge tested, working code
   - Use feature branches for experimentation

7. **Sync branches regularly**
   - Keep feature branches up to date with main/dev
   ```bash
   git checkout feature/name
   git merge main  # or dev
   ```

## Quick Reference

### Starting a new feature

```bash
git checkout dev && git pull origin dev
git checkout -b feature/feature-name
```

### Finishing a feature

```bash
git checkout dev && git pull origin dev
git merge feature/feature-name
git push origin dev
git branch -d feature/feature-name
```

### Quick fix (direct to main)

```bash
git checkout main && git pull origin main
# make changes
git add . && git commit -m "fix(scope): description"
git push origin main
```

### Viewing branches

```bash
git branch -a              # All branches
git branch                 # Local branches
git branch -r              # Remote branches
```

### Updating local branches

```bash
git fetch origin           # Fetch all remote branches
git checkout branch-name   # Switch to branch
git pull origin branch-name # Update branch
```

## Workflow Decision Tree

```
New Change?
├─ Small fix/update?
│  └─ Yes → Direct to main
│  └─ No → Continue
├─ New feature?
│  └─ Yes → Feature branch from dev
│  └─ No → Continue
├─ Bug fix?
│  └─ Yes → Fix branch from main
│  └─ No → Continue
└─ Critical production issue?
   └─ Yes → Hotfix branch from main
```

## Integration with CI/CD

When setting up CI/CD:

- Run tests on all branches
- Deploy `main` to production
- Deploy `dev` to staging (optional)
- Block direct pushes to `main` (use pull requests)

## Troubleshooting

### Merge conflicts

```bash
git checkout branch-name
git merge main  # or dev
# Resolve conflicts
git add .
git commit -m "merge: resolve conflicts"
```

### Undo last commit (keep changes)

```bash
git reset --soft HEAD~1
```

### Undo last commit (discard changes)

```bash
git reset --hard HEAD~1
```

### Update branch from main

```bash
git checkout feature/name
git merge main
# or rebase
git rebase main
```
