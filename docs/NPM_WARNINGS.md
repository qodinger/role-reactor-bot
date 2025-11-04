# NPM Warnings Explanation

## About the Warnings

When running `npm run dev` or any npm command, you may see warnings like:

```
npm warn Unknown env config "strict-peer-dependencies"
npm warn Unknown env config "auto-install-peers"
npm warn Unknown env config "store-dir"
npm warn Unknown project config "package-manager"
```

These warnings are **harmless** and can be safely ignored.

## Why They Appear

The project uses **pnpm** as its package manager (as specified in `package.json` engines). The `.npmrc` file contains pnpm-specific configuration options:

- `package-manager=pnpm`
- `strict-peer-dependencies=true`
- `auto-install-peers=true`
- `store-dir=.pnpm-store`

When you run npm commands, npm reads the `.npmrc` file and doesn't recognize these pnpm-specific options, so it shows warnings. However, these warnings don't affect functionality.

## Solutions

### Option 1: Use pnpm (Recommended)

Since the project is configured for pnpm, use it instead:

```bash
# Install pnpm globally if you don't have it
npm install -g pnpm

# Then use pnpm commands
pnpm run dev
```

### Option 2: Suppress Warnings

You can suppress these warnings by setting npm to ignore unknown configs:

```bash
npm config set ignore-scripts false
```

Or create a local `.npmrc` in your home directory with:

```
loglevel=error
```

### Option 3: Ignore the Warnings

Simply ignore the warnings - they're harmless and don't affect functionality. The bot will run normally despite these warnings.

## Project Setup

The project specifies pnpm in `package.json`:

```json
"engines": {
  "node": ">=16.0.0",
  "pnpm": ">=9.0.0"
}
```

For best compatibility, use pnpm for all package management operations.
