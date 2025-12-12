## Imagine Command

### Overview

`/imagine` lets anyone turn a detailed text prompt into AI-generated artwork directly inside Discord. It relies on the shared multi-provider AI service so you can switch between OpenRouter, OpenAI, or Stability without changing the command.

### File Structure

```
imagine/
├─ index.js        # Slash command definition and execution entry point
├─ handlers.js     # Core generation workflow (validation, queueing, provider call)
├─ embeds.js       # Consistent embeds for loading, success, and error states
├─ utils.js        # Prompt helpers, option metadata, and formatting utilities
└─ README.md       # This document
```

### Key Features

- **Inline parameters** – supports inline parameters like `--ar 16:9`, `--quality 2`, `--stylize 750`, `--chaos 50`, `--seed 12345`, and `--no something`
- **Multi-provider support** – automatically uses the same provider as `/avatar` command
- **Prompt enhancements** – optional style, quality, and aspect ratio hints are appended to give models more context
- **Queue-aware execution** – leverages the shared `concurrencyManager` to prevent timeouts and rate-limit abuse
- **Consistent UX** – embeds use the global theme system and clearly outline provider, model, and render time
- **Graceful failures** – friendly error messaging for validation issues, rate limits, or provider outages
- **Multiple aspect ratios** – supports 1:1, 2:3, 3:4, 4:5, 9:16, 3:2, 4:3, 16:9, 21:9

### Usage Examples

**Basic usage:**

```
/imagine prompt:"a cozy reading nook filled with plants"
```

**With options:**

```
/imagine prompt:"solar punk city skyline at sunset" style:cinematic quality:high
/imagine prompt:"retro arcade cabinet in neon alley" aspect_ratio:landscape
```

**Inline parameters:**

```
/imagine prompt:"cyberpunk city --ar 16:9 --quality 2 --stylize 750"
/imagine prompt:"fantasy castle --ar 21:9 --chaos 50 --seed 12345"
/imagine prompt:"portrait of a warrior --no helmet, armor --ar 2:3"
```

### Permissions

- Default member permission: `SendMessages`
- Works in guild channels (DMs remain enabled by default if the command is deployed globally)

### Implementation Notes

- Always call `interaction.deferReply()` before kicking off generation to avoid Discord timeouts.
- Validation happens up front; users get immediate feedback if the prompt is empty/too short/too long.
- **Inline parameter parsing**: The command automatically parses inline parameters from the prompt:
  - `--ar` or `--aspect`: Sets aspect ratio (e.g., `--ar 16:9`)
  - `--quality` or `--q`: Sets quality level (0.25, 0.5, 1, 2)
  - `--stylize` or `--s`: Sets stylization level (0-1000)
  - `--chaos` or `--c`: Sets chaos/variation level (0-100)
  - `--seed`: Sets seed for reproducibility
  - `--no`: Negative prompts (e.g., `--no helmet, armor`)
  - `--v`: Version parameter (maps to quality)
- Parameters are extracted from the prompt before validation, so the cleaned prompt is what gets validated.
- Configuration defaults:
  - `quality`: `standard`
  - Provider: auto-select (same as `/avatar` command)
  - Aspect ratio: provider default (usually square)
- Result images are sent as attachments so users can download or share them immediately.
- Embeds include a footer reminding users that provider safety filters still apply, matching project policy.
