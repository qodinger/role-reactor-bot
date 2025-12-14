# Imagine Command

## Overview

The `/imagine` command lets anyone turn a detailed text prompt into AI-generated artwork directly inside Discord. It relies on the shared multi-provider AI service so you can switch between OpenRouter, OpenAI, Stability AI, or self-hosted providers without changing the command.

## File Structure

```
imagine/
├── index.js        # Slash command definition and execution entry point
├── handlers.js     # Core generation workflow (validation, queueing, provider call)
├── embeds.js       # Consistent embeds for loading, success, and error states
├── utils.js        # Prompt helpers, option metadata, and formatting utilities
└── README.md       # This documentation
```

## Architecture

Following the modular pattern established by other developer commands:

- **`index.js`**: Command definition and main execution flow
- **`handlers.js`**: Core business logic, validation, queueing, and provider integration
- **`embeds.js`**: Discord embed creation and formatting
- **`utils.js`**: Helper functions for prompt processing and option metadata

## Usage Examples

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

## Permissions Required

- `Send Messages` permission
- `Embed Links` permission
- `Attach Files` permission

## Key Features

- **Inline Parameters**: Supports inline parameters like `--ar 16:9`, `--quality 2`, `--stylize 750`, `--chaos 50`, `--seed 12345`, and `--no something`
- **Multi-Provider Support**: Automatically uses the same provider as `/avatar` command (self-hosted, Stability AI, OpenRouter, or OpenAI)
- **Prompt Enhancements**: Optional style, quality, and aspect ratio hints are appended to give models more context
- **Queue-Aware Execution**: Leverages the shared `concurrencyManager` to prevent timeouts and rate-limit abuse
- **Consistent UX**: Embeds use the global theme system and clearly outline provider, model, and render time
- **Graceful Failures**: Friendly error messaging for validation issues, rate limits, or provider outages
- **Multiple Aspect Ratios**: Supports 1:1, 2:3, 3:4, 4:5, 9:16, 3:2, 4:3, 16:9, 21:9

## Inline Parameter Parsing

The command automatically parses inline parameters from the prompt:

- `--ar` or `--aspect`: Sets aspect ratio (e.g., `--ar 16:9`)
- `--quality` or `--q`: Sets quality level (0.25, 0.5, 1, 2)
- `--stylize` or `--s`: Sets stylization level (0-1000)
- `--chaos` or `--c`: Sets chaos/variation level (0-100)
- `--seed`: Sets seed for reproducibility
- `--no`: Negative prompts (e.g., `--no helmet, armor`)
- `--v`: Version parameter (maps to quality)

Parameters are extracted from the prompt before validation, so the cleaned prompt is what gets validated.

## Configuration Defaults

- `quality`: `standard`
- Provider: auto-select (same as `/avatar` command)
- Aspect ratio: provider default (usually square)

## Implementation Notes

- Always calls `interaction.deferReply()` before kicking off generation to avoid Discord timeouts
- Validation happens up front; users get immediate feedback if the prompt is empty/too short/too long
- Result images are sent as attachments so users can download or share them immediately
- Embeds include a footer reminding users that provider safety filters still apply, matching project policy

## Dependencies

- Discord.js
- Multi-provider AI service integration
- Theme configuration for colors and styling
- Concurrency manager for request queueing
- Storage manager for generation history
