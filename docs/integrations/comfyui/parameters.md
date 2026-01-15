# Imagine Command Parameters (ComfyUI Optimized)

The `/imagine` command supports ComfyUI-optimized parameters to give you precise control over your image generation.

## Basic Usage

```
/imagine prompt: a beautiful sunset --ar 16:9 --style cinematic --seed 12345
```

## Available Parameters

### NSFW Content
- **`--nsfw`** - Enable NSFW content generation (requires age-restricted server)
- **Format:** `--nsfw` (flag, no value needed)
- **Examples:**
  - `--nsfw` - Enable NSFW content generation
- **Note:** 
  - Only works in age-restricted Discord servers
  - Automatically routes to ComfyUI for detailed control and privacy
  - Without this flag, uses Stability AI for clean, fast results
  - ComfyUI will automatically select the best model based on your prompt content

### Aspect Ratio
- **`--ar` or `--aspect`** - Controls the width-to-height ratio of your image
- **Format:** `--ar width:height`
- **Examples:**
  - `--ar 1:1` - Square (default)
  - `--ar 16:9` - Widescreen
  - `--ar 9:16` - Portrait/mobile
  - `--ar 4:3` - Classic photo
  - `--ar 3:2` - Standard photo

### Model Selection
- **`--model` or `--m`** - Choose which AI model to use for generation
- **Format:** `--model model_name`
- **Available models:**
  - `animagine` - Animagine XL 4.0 with superior character knowledge (default)
  - `anything` - Anything XL model for versatile anime generation
- **Examples:**
  - `--model animagine`
  - `--m anything`
- **Note:** Both models require `--nsfw` flag for safety and use optimal settings automatically

## Example Commands

### Basic Examples
```
/imagine prompt: a cat sitting on a windowsill

/imagine prompt: a cat sitting on a windowsill --ar 16:9

/imagine prompt: a cat sitting on a windowsill --model animagine --ar 1:1
```

### NSFW Examples
```
/imagine prompt: anime girl with blue hair --nsfw --model animagine --ar 9:16

/imagine prompt: sensual portrait --nsfw --model anything --ar 3:4

/imagine prompt: anthropomorphic wolf character --nsfw --ar 1:1

/imagine prompt: artistic nude study --nsfw --ar 3:4
```

### Advanced Examples
```
/imagine prompt: cyberpunk city at night --model animagine --ar 16:9

/imagine prompt: portrait of a wise old wizard --model anything --ar 3:4

/imagine prompt: abstract geometric patterns --ar 1:1

/imagine prompt: mountain landscape at sunrise --ar 16:9
```

## Smart Provider Routing

The bot automatically uses ComfyUI for all `/imagine` command requests:

### ComfyUI (Local, Private)
- **Optimized for**: Detailed control, privacy, artistic freedom
- **Best for**: All anime content, mature themes, artistic generation
- **Requirements**: `--nsfw` flag required for all anime models
- **Parameters**: `--model`, `--ar`, `--nsfw`
- **Model Selection**: Choose between animagine (default) and anything models

### Examples
```bash
# Animagine model (default, best quality)
/imagine prompt: anime warrior --nsfw --model animagine --ar 9:16

# Anything model (alternative)
/imagine prompt: fantasy landscape --nsfw --model anything --ar 16:9
```

## Parameter Combinations

Parameters work together to create the exact image you want:

```bash
# Animagine model with widescreen aspect
/imagine prompt: mountain sunset --nsfw --model animagine --ar 16:9

# Anything model with portrait aspect
/imagine prompt: anime warrior --nsfw --model anything --ar 9:16

# Square format with animagine
/imagine prompt: character portrait --nsfw --model animagine --ar 1:1
```

## Tips for Best Results

1. **Start Simple**: Begin with just `--nsfw --model animagine --ar 1:1`
2. **Model Selection**: 
   - `animagine` for best quality and character knowledge (recommended)
   - `anything` for alternative anime generation style
3. **Aspect Ratios**:
   - `--ar 1:1` for square images (default)
   - `--ar 16:9` for widescreen landscapes
   - `--ar 9:16` for portrait/mobile format
4. **NSFW Requirement**: All anime models require `--nsfw` flag for safety
5. **Optimal Settings**: Models use optimal steps and CFG automatically

## Parameter Order

Parameters can be placed anywhere in your prompt:
```
/imagine prompt: --ar 16:9 a beautiful sunset --model animagine --nsfw
```

All of these are equivalent:
```
/imagine prompt: a cat --nsfw --ar 1:1 --model animagine
/imagine prompt: --ar 1:1 a cat --model animagine --nsfw  
/imagine prompt: a cat --model animagine --nsfw --ar 1:1
```

## ComfyUI Optimization

These parameters are specifically optimized for ComfyUI:
- **Model Selection**: Choose between animagine (default) and anything models
- **Aspect Ratio**: Sets ComfyUI workflow dimensions (1:1, 16:9, 9:16, etc.)
- **NSFW Flag**: Required for all anime models as a safety measure
- **Automatic Settings**: Models use optimal steps and CFG automatically

### ComfyUI Model Details
- **Animagine XL 4.0**: Superior character knowledge and quality (28 steps, CFG 5.0)
- **Anything XL**: Versatile anime generation (20 steps, CFG 7.0)

### Performance Notes
- ComfyUI generation typically takes 15-30 seconds
- Local ComfyUI provides complete privacy and control
- Progress updates show real-time generation status
- Both models support NSFW content generation
- NSFW flag is required for all anime models