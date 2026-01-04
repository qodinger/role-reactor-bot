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
  - `--ar 21:9` - Ultra-wide

### Seed
- **`--seed`** - Use a specific seed for reproducible results
- **Format:** `--seed number`
- **Range:** Any integer (positive or negative)
- **Examples:**
  - `--seed 12345`
  - `--seed -999`
- **Note:** Same prompt + same seed = same image

### Style
- **`--style`** - Apply specific artistic styles
- **Format:** `--style style_name`
- **Available styles:**
  - `anime` - Japanese animation style
  - `realistic` - Photorealistic images
  - `fantasy` - Fantasy art with magical elements
  - `cyberpunk` - Futuristic neon aesthetic
  - `vintage` - Retro/nostalgic look
  - `minimalist` - Clean, simple design
  - `abstract` - Abstract artistic interpretation
  - `portrait` - Professional portrait photography
  - `landscape` - Scenic landscape photography
  - `macro` - Extreme close-up photography
  - `street` - Street photography style
  - `cinematic` - Movie-like composition
  - `oil` - Oil painting style
  - `watercolor` - Watercolor painting
  - `sketch` - Pencil sketch style
  - `digital` - Modern digital art
- **Note:** Works with both safe and NSFW content. For NSFW, ComfyUI will intelligently select the best model based on your prompt and style.

### Steps
- **`--steps`** - Number of generation steps (quality vs speed)
- **Format:** `--steps number`
- **Range:** 10-50
- **Examples:**
  - `--steps 15` - Fast, good quality
  - `--steps 25` - Standard quality (default)
  - `--steps 35` - High quality, slower
- **Note:** More steps = better quality but slower generation

### CFG Scale
- **`--cfg`** - Controls how closely the AI follows your prompt
- **Format:** `--cfg number`
- **Range:** 1-20 (decimals allowed)
- **Examples:**
  - `--cfg 6` - Loose interpretation, more creative
  - `--cfg 8` - Balanced (default)
  - `--cfg 12` - Strict adherence to prompt
- **Note:** Higher CFG = follows prompt more literally

## Example Commands

### Basic Examples
```
/imagine prompt: a cat sitting on a windowsill

/imagine prompt: a cat sitting on a windowsill --ar 16:9

/imagine prompt: a cat sitting on a windowsill --style anime --ar 1:1
```

### NSFW Examples
```
/imagine prompt: anime girl with blue hair --nsfw --style anime --ar 9:16 --steps 25 --cfg 8

/imagine prompt: sensual portrait --nsfw --style realistic --ar 3:4 --steps 30 --cfg 10

/imagine prompt: anthropomorphic wolf character --nsfw --ar 1:1 --steps 25

/imagine prompt: artistic nude study --nsfw --ar 3:4 --steps 35 --cfg 9
```

### Advanced Safe Content Examples
```
/imagine prompt: cyberpunk city at night --style cyberpunk --ar 21:9 --steps 30 --cfg 10

/imagine prompt: portrait of a wise old wizard --style fantasy --ar 3:4 --steps 35 --seed 54321

/imagine prompt: abstract geometric patterns --style abstract --ar 1:1 --cfg 6 --steps 20

/imagine prompt: mountain landscape at sunrise --style landscape --ar 16:9 --steps 25
```

### Reproducible Results
```
/imagine prompt: mountain landscape at sunrise --seed 12345 --ar 16:9 --style landscape

# Running the same command again will produce the identical image
/imagine prompt: mountain landscape at sunrise --seed 12345 --ar 16:9 --style landscape
```

### Fine-Tuning Quality
```
# Fast generation (good for testing)
/imagine prompt: concept art --steps 15 --cfg 6

# High quality (final images)
/imagine prompt: concept art --steps 35 --cfg 10

# Creative interpretation
/imagine prompt: surreal landscape --cfg 6 --style abstract

# Precise prompt following
/imagine prompt: red sports car --cfg 12 --style realistic
```

## Smart Provider Routing

The bot automatically selects the best AI provider based on your content:

### Safe Content (Default)
- **Providers**: Stability AI (primary) → OpenRouter (fallback)
- **Optimized for**: Fast generation, clean results, professional quality
- **Best for**: Landscapes, portraits, abstract art, general content
- **Parameters**: `--style`, `--ar`, `--seed`, `--steps`, `--cfg`

### NSFW Content (`--nsfw` flag)
- **Providers**: ComfyUI (local, private) → RunPod (serverless fallback)
- **Optimized for**: Detailed control, privacy, artistic freedom
- **Best for**: Adult content, artistic nudity, mature themes
- **Requirements**: Age-restricted Discord server
- **Parameters**: `--style`, `--ar`, `--seed`, `--steps`, `--cfg`
- **Model Selection**: ComfyUI automatically selects the best model based on your prompt content and style

### Examples
```bash
# Safe content - uses Stability AI
/imagine prompt: mountain landscape --ar 16:9 --style landscape

# NSFW content - uses ComfyUI with intelligent model selection
/imagine prompt: artistic nude portrait --nsfw --style realistic --ar 3:4
```

## Parameter Combinations

Parameters work together to create the exact image you want:

```bash
# Safe content with cinematic style
/imagine prompt: mountain sunset --ar 21:9 --style cinematic --steps 30 --cfg 9

# NSFW anime character with consistent seed
/imagine prompt: anime warrior --nsfw --style anime --seed 12345 --ar 9:16 --cfg 8

# High-quality realistic NSFW portrait
/imagine prompt: sensual portrait --nsfw --style realistic --ar 3:4 --steps 35 --cfg 10

# Artistic NSFW content with creative freedom
/imagine prompt: abstract nude study --nsfw --style abstract --ar 1:1 --cfg 6 --steps 25
```

## Tips for Best Results

1. **Start Simple**: Begin with just `--ar` and `--style` (safe) or `--nsfw --anime` (NSFW)
2. **Save Good Seeds**: Note seed numbers from images you like
3. **Steps vs Speed**: 
   - `--steps 15-20` for quick tests
   - `--steps 25-30` for final images (recommended)
   - `--steps 35+` only for highest quality needs
4. **CFG Guidelines**:
   - `--cfg 6-7` for creative, artistic results
   - `--cfg 8-9` for balanced results (recommended)
   - `--cfg 10-12` for precise prompt following
5. **Content Type Optimization**:
   - **Safe content**: Use `--style` for artistic direction
   - **NSFW content**: Use `--nsfw` flag and `--style` - ComfyUI will intelligently select the best model
6. **ComfyUI Model Selection**:
   - ComfyUI automatically chooses the best model based on your prompt content
   - Anime-style prompts → AnythingXL model
   - Realistic prompts → Realism Engine SDXL model
   - Furry/anthropomorphic prompts → Pony Diffusion V6 model
   - Artistic prompts → Deliberate V2 model

## Parameter Order

Parameters can be placed anywhere in your prompt:
```
/imagine prompt: --ar 16:9 a beautiful sunset --style cinematic --seed 999
```

All of these are equivalent for safe content:
```
/imagine prompt: a cat --ar 1:1 --style anime
/imagine prompt: --ar 1:1 a cat --style anime  
/imagine prompt: a cat --style anime --ar 1:1
```

All of these are equivalent for NSFW content:
```
/imagine prompt: anime girl --nsfw --style anime --ar 1:1
/imagine prompt: --nsfw --style anime anime girl --ar 1:1  
/imagine prompt: --ar 1:1 anime girl --nsfw --style anime
```

## ComfyUI Optimization

These parameters are specifically optimized for ComfyUI (NSFW content):
- **Intelligent Model Selection**: ComfyUI automatically selects the best model based on your prompt content and style
- **Steps**: Directly controls ComfyUI sampling steps (10-50, optimal: 20-30)
- **CFG**: Directly controls ComfyUI CFG scale (1-20, optimal: 7-10)
- **Seed**: Uses ComfyUI's native seed system for reproducible results
- **Aspect Ratio**: Sets ComfyUI workflow dimensions (1:1, 16:9, 9:16, etc.)
- **Style**: Influences both prompt enhancement and model selection

### ComfyUI Model Details
- **AnythingXL**: High-quality anime/manga style (auto-selected for anime content)
- **Realism Engine SDXL**: Photorealistic image generation (auto-selected for realistic content)
- **Pony Diffusion V6**: Anthropomorphic and furry art (auto-selected for furry content)
- **Deliberate V2**: Versatile artistic style (auto-selected for artistic content)

### Performance Notes
- ComfyUI generation typically takes 15-30 seconds
- Local ComfyUI provides complete privacy and control
- Progress updates show real-time generation status
- All ComfyUI models support NSFW content generation
- Model selection is automatic based on prompt analysis