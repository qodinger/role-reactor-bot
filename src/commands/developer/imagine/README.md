# Imagine Command

## Overview

The `/imagine` command lets developers turn detailed text prompts into AI-generated artwork directly inside Discord. It uses ComfyUI with animagine and anything models for high-quality image generation.

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

**With inline parameters:**

```
/imagine prompt:"cyberpunk city --ar 16:9 --model animagine"
/imagine prompt:"fantasy castle --ar 3:2 --model anything"
/imagine prompt:"anime character --nsfw --model animagine --ar 2:3"
```

## Permissions Required

- **Developer** access required
- `Send Messages` permission
- `Embed Links` permission
- `Attach Files` permission

## Key Features

- **Model Selection**: Choose between animagine (best quality) and anything (alternative) models
- **Aspect Ratio Control**: Generate images in various aspect ratios
- **NSFW Support**: Generate mature content in age-restricted channels
- **Queue-Aware Execution**: Leverages the shared `concurrencyManager` to prevent timeouts and rate-limit abuse
- **Consistent UX**: Embeds use the global theme system and clearly outline provider, model, and render time
- **Graceful Failures**: Friendly error messaging for validation issues, rate limits, or provider outages

## Inline Parameter Parsing

The command automatically parses inline parameters from the prompt:

- `--ar` or `--aspect`: Sets aspect ratio (e.g., `--ar 16:9`)
- `--model` or `--m`: Choose model (animagine or anything)
- `--nsfw`: Enable NSFW content generation (requires age-restricted channel)

Parameters are extracted from the prompt before validation, so the cleaned prompt is what gets validated.

## Supported Aspect Ratios

- `1:1` - Square (default)
- `2:3` - Portrait
- `3:4` - Standard portrait
- `4:5` - Tall portrait
- `9:16` - Mobile portrait
- `3:2` - Standard landscape
- `4:3` - Classic photo
- `16:9` - Widescreen

## Model Information

- **animagine** - Animagine XL 4.0 with superior character knowledge (default)
- **anything** - Anything XL model for versatile anime generation

Both models use optimal settings automatically (animagine: 28 steps, CFG 5.0; anything: 20 steps, CFG 7.0).

## Configuration Defaults

- Model: `animagine` (best quality)
- Aspect ratio: `1:1` (square)
- Provider: ComfyUI with automatic model selection

## Implementation Notes

- Always calls `interaction.deferReply()` before kicking off generation to avoid Discord timeouts
- Validation happens up front; users get immediate feedback if the prompt is empty/too short/too long
- Result images are sent as attachments so users can download or share them immediately
- NSFW content requires age-restricted Discord channels
- Uses optimal model settings automatically for best quality

## Dependencies

- Discord.js
- ComfyUI provider integration
- Theme configuration for colors and styling
- Concurrency manager for request queueing
- Storage manager for generation history
