# ComfyUI Workflows

This directory contains optimized ComfyUI workflows for different styles and use cases.

## 📁 Available Workflows

### 🎨 Anime Style Workflows

- **`anime-nsfw.json`** - Standard anime NSFW workflow (25 steps, balanced)
- **`anime-nsfw-fast.json`** - Fast anime NSFW workflow (15 steps, quick testing)
- **`anime-nsfw-mps.json`** - macOS Metal optimized anime workflow (28 steps)
- **`anime-nsfw-precision.json`** - High precision anime workflow (fp32, highest quality)

### 📸 Realistic Style Workflows

- **`realistic-nsfw.json`** - Photorealistic NSFW workflow (30 steps, high quality)

## 🎯 Workflow Selection Guide

### By Speed (Fastest to Slowest)

1. **anime-nsfw-fast.json** - 15 steps, Euler A (⚡⚡⚡⚡)
2. **anime-nsfw.json** - 25 steps, DPM++ 2M (⚡⚡⚡)
3. **anime-nsfw-mps.json** - 28 steps, Euler Ancestral (⚡⚡)
4. **realistic-nsfw.json** - 30 steps, DPM++ 2M (⚡⚡)
5. **anime-nsfw-precision.json** - 25 steps + fp32 (⚡)

### By Quality (Highest to Lowest)

1. **anime-nsfw-precision.json** - fp32 precision (⭐⭐⭐⭐⭐)
2. **realistic-nsfw.json** - 30 steps, CFG 8.0 (⭐⭐⭐⭐⭐)
3. **anime-nsfw-mps.json** - 28 steps, CFG 7.5 (⭐⭐⭐⭐)
4. **anime-nsfw.json** - 25 steps, CFG 7.0 (⭐⭐⭐⭐)
5. **anime-nsfw-fast.json** - 15 steps, CFG 6.0 (⭐⭐⭐)

### By System Compatibility

- **Any GPU**: anime-nsfw.json, realistic-nsfw.json
- **Apple Silicon (M1/M2/M3)**: anime-nsfw-mps.json
- **High-end GPU**: anime-nsfw-precision.json
- **Low VRAM**: anime-nsfw-fast.json

## 🔧 Technical Specifications

| Workflow             | Model            | Steps | CFG | Sampler         | Scheduler | Precision |
| -------------------- | ---------------- | ----- | --- | --------------- | --------- | --------- |
| anime-nsfw           | Animagine XL 4.0 | 28    | 5.0 | dpmpp_2m        | karras    | fp16      |
| anime-nsfw-fast      | Animagine XL 4.0 | 15    | 6.0 | euler_ancestral | normal    | fp16      |
| anime-nsfw-mps       | Animagine XL 4.0 | 28    | 7.5 | euler_ancestral | normal    | fp16      |
| anime-nsfw-precision | Animagine XL 4.0 | 25    | 7.0 | dpmpp_2m        | karras    | **fp32**  |
| realistic-nsfw       | RealisticEngine  | 30    | 8.0 | dpmpp_2m        | karras    | fp16      |

## 🎨 Model Information

### animagine-xl-4.0-opt.safetensors

- **Type**: Anime/Manga style (Latest 2025)
- **Best for**: Anime characters, 2D art style, superior character knowledge
- **Training**: 8.4M anime images, Danbooru dataset, tag-based prompting
- **Workflows**: anime-nsfw variants
- **Recommended Settings**: 28 steps, CFG 5.0, DPM++ 2M Karras

### realismEngineSDXL_v30VAE.safetensors

- **Type**: Photorealistic
- **Best for**: Realistic human photos
- **Workflows**: realistic-nsfw

### deliberate_v2.safetensors

### deliberate_v2.safetensors

## 📋 Usage Recommendations

### For Most Users

Use **anime-nsfw.json** - Best balance of speed and quality

### For Quick Testing

Use **anime-nsfw-fast.json** - Fastest generation for testing prompts

### For macOS Users

Use **anime-nsfw-mps.json** - Optimized for Apple Silicon

### For Maximum Quality

Use **anime-nsfw-precision.json** - Highest quality with fp32 precision

### For Realistic Images

Use **realistic-nsfw.json** - Photorealistic results

## 🔄 Workflow Selection Logic

The bot automatically selects workflows based on:

1. **Style parameter** (`--style anime`, `--style realistic`, etc.)
2. **Model type** (determined by style)
3. **System capabilities** (MPS detection for macOS)
4. **Quality preferences** (precision mode if requested)

### Automatic Selection Examples

```bash
# Uses anime-nsfw.json (or anime-nsfw-mps.json on macOS)
/imagine prompt --nsfw --style anime

# Uses realistic-nsfw.json
/imagine prompt --nsfw --style realistic
```

## 🎯 Performance Expectations

### Generation Times (approximate)

- **anime-nsfw-fast.json**: 8-12 seconds
- **anime-nsfw.json**: 15-25 seconds
- **anime-nsfw-mps.json**: 20-30 seconds (on Apple Silicon)
- **realistic-nsfw.json**: 25-35 seconds
- **anime-nsfw-precision.json**: 30-45 seconds

_Times vary based on hardware, image size, and system load_

## 🔧 Customization

All workflows support parameter injection:

- **Prompt**: User prompt is prepended to workflow's quality tags
- **Negative Prompt**: Combined with workflow's negative prompt
- **Seed**: Overrides workflow seed (0 = random)
- **Dimensions**: Aspect ratio controls width/height in EmptyLatentImage node
- **Model**: Can be overridden (though not recommended for optimal results)

## 📝 Notes

- All workflows use 1024x1024 base resolution
- Aspect ratio is handled by the workflowManager
- Prompts are enhanced with style-specific keywords
- Negative prompts are optimized for each style
- All workflows support NSFW content generation

## 🚀 Dynamic Loading

- **No hardcoded workflow names** in the codebase
- **Auto-detection** of all `.json` files in this directory
- **Runtime selection** based on model type or user flags
- **Hot reloading** via API endpoint: `POST /api/v1/comfyui/workflows/reload`

## 🔧 Adding New Workflows

1. Create your workflow in ComfyUI interface
2. Export as "API Format" JSON
3. Save to this directory with descriptive filename
4. The workflow manager will automatically detect and load it on next restart
5. No code changes needed - workflows are loaded dynamically

## 🧪 Testing Workflows

Use the ComfyUI interface to test workflows before adding them:

1. Load the workflow in ComfyUI
2. Test with various parameters
3. Verify output quality and consistency
4. Export and add to this directory
