# ComfyUI Workflows - Quality Optimization Guide

## Available Workflows

### High-Quality Workflows (Recommended)

#### 1. `animagine-quality.json` - Animagine XL 4.0 HQ
**Best for:** Character art, portraits, detailed anime scenes
- **Steps:** 35 (main) + 12 (refinement)
- **CFG:** 6.0 → 4.0 (dual-pass)
- **Sampler:** DPM++ 2M SDE → DPM++ 2M
- **Features:**
  - Enhanced quality prompts with 8K, ultra-detailed keywords
  - Comprehensive negative prompts with weighted terms
  - Two-pass generation (main + refinement)
  - Optimized LoRA strength (1.6 vs 2.0)
  - Detail enhancement pass with lower denoising (0.25)

#### 2. `anything-quality.json` - Anything XL HQ  
**Best for:** Versatile anime art, NSFW content, creative scenes
- **Steps:** 30 (main) + 15 (refinement)
- **CFG:** 7.5 → 5.0 (dual-pass)
- **Sampler:** DPM++ 2M SDE → DPM++ 2M
- **Features:**
  - Studio lighting and cinematic quality keywords
  - Advanced negative prompts for texture quality
  - Refinement pass for smooth skin and detailed textures
  - Balanced settings for versatility

### Standard Workflows (Legacy)

#### 3. `animagine.json` - Animagine XL 4.0 Standard
- **Steps:** 28
- **CFG:** 5.0
- **Sampler:** DPM++ 2M
- **Use case:** Faster generation, good quality

#### 4. `anything.json` - Anything XL Standard
- **Steps:** 20  
- **CFG:** 7.0
- **Sampler:** DPM++ 2M
- **Use case:** Quick generation, standard quality

## Quality Improvements in HQ Workflows

### 1. Enhanced Prompting
```
Standard: "masterpiece, best quality, detailed"
HQ: "masterpiece, best quality, ultra detailed, 8k uhd, high resolution, extremely detailed, perfect anatomy, detailed eyes, detailed face, beautiful composition, sharp focus, professional anime art, vibrant colors, perfect lighting, depth of field, cinematic lighting"
```

### 2. Advanced Negative Prompts
- Weighted negative terms: `(bad proportions:1.3)`
- Specific quality issues: `compression artifacts`, `pixelated`, `aliasing`
- Lighting problems: `overexposed`, `underexposed`
- Texture issues: `rough textures`, `bad skin`

### 3. Two-Pass Generation
1. **Main Pass:** Full generation with high steps
2. **Refinement Pass:** Detail enhancement with low denoising (0.25-0.3)

### 4. Optimized Samplers
- **DPM++ 2M SDE:** Better quality, more detailed results
- **Karras Scheduler:** Improved noise scheduling
- **Lower CFG in refinement:** Prevents over-processing

### 5. LoRA Optimization
- Reduced LoRA strength (1.6-1.8 vs 2.0) for better balance
- Prevents over-filtering while maintaining NSFW capability

## Performance vs Quality Trade-offs

| Workflow | Generation Time | Quality | VRAM Usage | Best For |
|----------|----------------|---------|------------|----------|
| `animagine-quality` | ~3-4 min | Excellent | High | Character art, portraits |
| `anything-quality` | ~2.5-3 min | Excellent | High | Versatile scenes, NSFW |
| `animagine` | ~2 min | Good | Medium | Quick character art |
| `anything` | ~1.5 min | Good | Medium | Quick generation |

## Usage Recommendations

### For Maximum Quality:
- Use `animagine-quality` for character-focused art
- Use `anything-quality` for scene/NSFW content
- Allow 3-4 minutes generation time
- Ensure sufficient VRAM (8GB+ recommended)

### For Balanced Speed/Quality:
- Use standard workflows for quick iterations
- Switch to HQ workflows for final renders
- Use HQ workflows for important/showcase images

### Prompt Tips for HQ Workflows:
1. **Be specific:** "detailed blue eyes" vs "blue eyes"
2. **Add quality terms:** "professional art", "studio lighting"
3. **Specify style:** "anime style", "manga art", "cel shading"
4. **Include composition:** "beautiful composition", "rule of thirds"

## Technical Details

### Node Flow (HQ Workflows):
1. **Checkpoint Loader** → Load model
2. **LoRA Loader** → Apply NSFW filter (optimized strength)
3. **CLIP Text Encode** → Process enhanced prompts
4. **KSampler (Main)** → Primary generation (35/30 steps)
5. **KSampler (Refine)** → Detail enhancement (12/15 steps)
6. **VAE Decode** → Convert to image
7. **Save Image** → Output final result

### Memory Requirements:
- **Standard workflows:** 6-8GB VRAM
- **HQ workflows:** 8-12GB VRAM
- **Batch size:** Keep at 1 for HQ workflows

The HQ workflows provide significantly better detail, anatomy, lighting, and overall professional quality at the cost of longer generation times.